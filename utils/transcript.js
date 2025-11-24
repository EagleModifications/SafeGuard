// utils/transcript.js
const fs = require("fs-extra");
const path = require("path");
const config = require("../config.json");

/**
 * fetchAllMessages(channel)
 * paginates and returns all messages in the channel (array of Message)
 */
async function fetchAllMessages(channel) {
  const all = [];
  let lastId = null;
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const msgs = await channel.messages.fetch(options);
    if (!msgs || msgs.size === 0) break;
    all.push(...msgs.values());
    lastId = msgs.last().id;
    if (msgs.size < 100) break;
  }
  return Array.from(all).reverse(); // oldest -> newest
}

/**
 * createTranscriptFile(channel, messages, opts)
 * opts:
 *   - ownerId: ticket owner user id (string)
 *   - staffRoleIds: array of role IDs (strings) to mark as staff
 *   - baseUrl: the public base URL where /transcripts/ is served (string)
 *
 * returns: { txtPath, htmlURL }
 */
async function createTranscriptFile(channel, messages, opts = {}) {
  const ownerId = opts.ownerId || null;
  const staffRoleIds = Array.isArray(opts.staffRoleIds) ? opts.staffRoleIds : (opts.staffRoleIds ? [opts.staffRoleIds] : []);
  const baseUrl = opts.baseUrl || `${config.transcriptBaseURL}`;

  // Prepare lines for TXT
  const lines = [];

  // Resolve members once (unique authors) to determine staff status
  const uniqueAuthorIds = [...new Set(messages.map(m => (m.author && m.author.id) || null))].filter(Boolean);
  const memberMap = new Map(); // id -> { roles: Set, tag, avatarURL }

  // Try to fetch guild members for those authors (best-effort)
  try {
    // For large numbers of members, fetching all can be heavy; do them sequentially but don't fail entire process on a single error
    for (const id of uniqueAuthorIds) {
      try {
        const member = await channel.guild.members.fetch(id);
        memberMap.set(id, {
          roles: new Set(member.roles.cache.map(r => r.id)),
          tag: member.user.tag,
          avatarURL: member.user.displayAvatarURL({ dynamic: true, size: 64 })
        });
      } catch {
        // Fallback to user info from message
        const msgUser = messages.find(x => x.author && x.author.id === id)?.author;
        if (msgUser) {
          memberMap.set(id, {
            roles: new Set(),
            tag: msgUser.tag,
            avatarURL: msgUser.displayAvatarURL ? msgUser.displayAvatarURL({ dynamic: true, size: 64 }) : null
          });
        } else {
          memberMap.set(id, {
            roles: new Set(),
            tag: `Unknown (${id})`,
            avatarURL: null
          });
        }
      }
    }
  } catch (e) {
    // If something goes wrong, keep going — memberMap may be partial
    console.warn("Warning: failed to fully resolve members for transcript:", e);
  }

  // Build html message blocks
  const htmlBlocks = [];

  for (const m of messages) {
    const timeISO = new Date(m.createdTimestamp).toLocaleString();
    const authorTag = m.author ? (m.author.tag || `${m.author.username}#${m.author.discriminator}`) : "Unknown";
    let content = m.content || "";

    // Attachments
    let attachmentHTML = "";
    if (m.attachments && m.attachments.size) {
      const items = [];
      for (const a of m.attachments.values()) {
        // show each attachment as a link (image will still be link; browsers will try to render inline if img tag used)
        items.push(`<a class="attachment-link" href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.name || a.url)}</a>`);
      }
      if (items.length) {
        content += `\n[attachments] ${items.join(" ")}`;
        attachmentHTML = `<div class="attachments">${items.join("<br>")}</div>`;
      }
    }

    // Embeds (brief)
    let embedHTML = "";
    if (m.embeds && m.embeds.length) {
      const embParts = m.embeds.map((e, idx) => {
        const title = e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : "";
        const desc = e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : "";
        return `<div class="embed">${title}${desc}</div>`;
      });
      if (embParts.length) embedHTML = `<div class="embeds">${embParts.join("")}</div>`;
    }

    // TXT lines
    lines.push(`[${timeISO}] ${authorTag}: ${content}`);

    // Determine classes (owner/staff/normal)
    const isOwner = m.author && ownerId && (m.author.id === ownerId);
    const memberInfo = m.author && memberMap.get(m.author.id);
    const isStaff = memberInfo && staffRoleIds.length > 0 && [...staffRoleIds].some(rid => memberInfo.roles.has(rid));

    const roleClass = isOwner ? "owner" : (isStaff ? "staff" : "user");

    const avatar = (m.author && (memberInfo?.avatarURL || m.author.displayAvatarURL?.({ dynamic: true, size: 64 }))) || "https://i.imgur.com/AfFp7pu.png";

    // Build the HTML block for this message
    htmlBlocks.push(`
      <div class="message ${roleClass}">
        <img class="avatar" src="${escapeHtml(avatar)}" alt="avatar" />
        <div class="message-content">
          <div class="meta">
            <span class="username">${escapeHtml(authorTag)}</span>
            <span class="timestamp">${escapeHtml(timeISO)}</span>
            ${isOwner ? '<span class="badge owner-badge">Owner</span>' : (isStaff ? '<span class="badge staff-badge">Staff</span>' : '')}
          </div>
          <div class="text">${escapeHtml(content).replace(/\n/g, "<br>")}</div>
          ${attachmentHTML}
          ${embedHTML}
        </div>
      </div>
    `);
  }

  // Ensure transcripts dir exists
  const transcriptsDir = path.join(__dirname, "..", "transcripts");
  await fs.ensureDir(transcriptsDir);

  const baseName = `transcript-${channel.guild.id}-${channel.id}-${Date.now()}`;
  const txtFileName = `${baseName}.txt`;
  const htmlFileName = `${baseName}.html`;
  const txtPath = path.join(transcriptsDir, txtFileName);
  const htmlPath = path.join(transcriptsDir, htmlFileName);

  // Write TXT
  await fs.writeFile(txtPath, lines.join("\n\n"), "utf8");

  // Write HTML with styling, theme toggle and owner/staff highlights
  const htmlContent = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Transcript - #${escapeHtml(channel.name)}</title>
<style>
  :root{
    --bg-dark:#2f3136; --bg-panel-dark:#36393f; --text:#dcddde;
    --bg-light:#f5f5f5; --bg-panel-light:#e1e1e1; --text-dark:#2f3136;
    --owner-accent:#f6c85f; --staff-accent:#5bd18b;
  }
  body { margin:0; font-family: "Segoe UI", Roboto, Arial, sans-serif; transition: background .2s, color .2s; }
  body.dark { background:var(--bg-dark); color:var(--text); }
  body.light { background:var(--bg-light); color:var(--text-dark); }
  header { padding:14px; text-align:center; font-weight:600; border-bottom:1px solid rgba(0,0,0,.08); }
  body.dark header{ background:#202225; border-color:#40444b }
  body.light header{ background:#ffffff; border-color:#e6e6e6 }

  .theme-toggle { position:fixed; right:12px; top:12px; z-index:999; padding:8px 10px; border-radius:6px; border:none; cursor:pointer; font-weight:600; }
  body.dark .theme-toggle { background:#7289da; color:#fff }
  body.light .theme-toggle { background:#4f545c; color:#fff }

  .messages { max-width:920px; margin: 12px auto; padding:12px; height:calc(100vh - 80px); overflow:auto; box-sizing:border-box; }
  .message { display:flex; gap:12px; margin:10px 0; align-items:flex-start; }
  .avatar { width:48px; height:48px; border-radius:50%; flex:0 0 48px; object-fit:cover; }
  .message .message-content { padding:10px 12px; border-radius:8px; width:100%; box-sizing:border-box; background:var(--bg-panel-dark); transition:background .2s; }
  body.light .message .message-content { background:var(--bg-panel-light); }

  .meta { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; }
  .username{ font-weight:700; color:#00b0f4; }
  .timestamp{ color:#9aa0a6; font-size:0.85rem; }
  .badge { padding:3px 8px; border-radius:999px; font-weight:700; font-size:0.75rem; }
  .owner .message-content { outline: 2px solid rgba(246,200,95,0.14); box-shadow: 0 0 0 1px rgba(246,200,95,0.06) inset; }
  .staff .message-content { outline: 2px solid rgba(91,209,139,0.12); box-shadow: 0 0 0 1px rgba(91,209,139,0.04) inset; }
  .owner-badge{ background:var(--owner-accent); color:#1b1b1b; }
  .staff-badge{ background:var(--staff-accent); color:#06351a; }

  .text{ white-space:pre-wrap; word-break:break-word; }
  .attachments a{ display:inline-block; margin-top:6px; color:#00b0f4; text-decoration:none; }
  .embed{ margin-top:6px; padding:8px; border-radius:6px; background:#4f545c; }
  body.light .embed{ background:#dcdcdc; }
  @media (max-width:700px){ .messages{ padding:10px; } .username{ font-size:0.95rem; } .timestamp{ font-size:0.75rem; } }
</style>
</head>
<body class="dark">
<header>Transcript — #${escapeHtml(channel.name)}</header>
<button class="theme-toggle" onclick="toggleTheme()">Toggle theme</button>
<div class="messages">
${htmlBlocks.join("\n")}
</div>
<script>
  function toggleTheme(){
    document.body.classList.toggle('dark');
    document.body.classList.toggle('light');
    // remember preference (optional)
    try{ localStorage.setItem('transcriptTheme', document.body.classList.contains('dark') ? 'dark' : 'light'); } catch(e){}
  }
  (function applyPref(){ try{ const t=localStorage.getItem('transcriptTheme'); if(t) { document.body.classList.remove('dark','light'); document.body.classList.add(t); } } catch(e){} })();
</script>
</body>
</html>`;

  await fs.writeFile(htmlPath, htmlContent, "utf8");

  // Ensure baseUrl ends with slash
  const finalBase = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const htmlURL = `${finalBase}${encodeURIComponent(htmlFileName)}`;
  return { txtPath, htmlURL };
}

// very small helper to escape HTML to avoid injection in transcript
function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

module.exports = { fetchAllMessages, createTranscriptFile };
