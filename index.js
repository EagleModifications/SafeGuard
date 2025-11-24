const { Client, Collection, GatewayIntentBits, REST, Routes, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require("discord.js");
const fs = require("fs");
const path = require("path");
const config = require("./config.json");
const { connectDB } = require("./database/mongo");

const startTranscriptServer = require("./transcriptServer");

const Panel = require("./models/panel");
const Ticket = require("./models/ticket");
const Counter = require("./models/counter");
const TicketLog = require("./models/TicketLog");
const { fetchAllMessages, createTranscriptFile } = require("./utils/transcript");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,

  ],
});

client.commands = new Collection();

// ----------------- Load Commands -----------------
const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
    }
  }
}

// ----------------- Deploy Commands -----------------
const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log("⏳ Deploying application (/) commands...");
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
    console.log("✅ Successfully deployed commands.");

    // Connect to MongoDB AFTER deploying commands
    await connectDB();
  } catch (error) {
    console.error("❌ Error during startup:", error);
  }
})();

// ----------------- Load Events -----------------
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

/////////////
// TICKETS //
/////////////
client.on("interactionCreate", async (interaction) => {
    // Select menu for reason
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("ticket_reason:")) {
      const panelId = interaction.customId.split(":")[1];
      const idx = interaction.values[0];
      const panel = await Panel.findById(panelId);
      const reason = panel?.reasons?.[Number(idx)] || null;

      return await interaction.reply({
        content: reason ? `Selected reason: **${reason}**` : "No reason selected.",
        ephemeral: true
      });
    }

    // Button interactions
    if (interaction.isButton()) {
      const [action, panelIdOrChannelId] = interaction.customId.split(":");

      // Ticket creation button
      if (action === "ticket_create") {
        const panelId = panelIdOrChannelId;
        const panel = await Panel.findById(panelId);
        if (!panel) return interaction.reply({ content: "Panel config missing.", ephemeral: true });

        // Blacklist check
        const panell = await Panel.findOne({ guildId: interaction.guild.id });

        if (panell.blacklist && panell.blacklist.includes(interaction.user.id)) {
          return interaction.reply({
            content: "⛔ You are blacklisted and cannot create tickets.",
            ephemeral: true
          });
        }

        const guild = interaction.guild;
        const category = guild.channels.cache.get(panel.ticketCategory);
        if (!category || category.type !== 4) return interaction.reply({ content: "Ticket category misconfigured.", ephemeral: true });

        // Get next ticket number
        let counter = await Counter.findOne({ guildId: guild.id });
        if (!counter) counter = await Counter.create({ guildId: guild.id, count: 0 });
        counter.count += 1;
        await counter.save();
        const ticketNum = counter.count;

        // Create ticket channel
        const channel = await guild.channels.create({
          name: `ticket-${ticketNum.toString().padStart(4, "0")}`,
          parent: category.id,
          permissionOverwrites: [
            { id: guild.id, deny: ["ViewChannel"] },
            { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
            { id: panel.supportRole, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
          ],
          reason: `Ticket ${ticketNum} created by ${interaction.user.tag}`
        });

        // Save ticket
        await Ticket.create({
          guildId: guild.id,
          panelId: panel._id,
          channelId: channel.id,
          channelName: channel.name,
          creatorId: interaction.user.id,
          ticketId: ticketNum.toString(),
          status: "open"
        });
        
        // Save to DB
        const log = new TicketLog({
          guildId: interaction.guild.id,
          moderatorId: interaction.user.id,
          action: "TicketCreate"
        });
        await log.save();

        // Send modlog if set
        const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.logChannel) {
          const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
          if (logChannel) {
            const tickets = await Ticket.findOne({ channelId: channel.id });
            const panels = await Panel.findOne({ guildId: interaction.guild.id });
            const channeln = interaction.guild.channels.fetch(tickets.channelId).catch(() => null);
            const creator = await interaction.client.users.fetch(tickets.creatorId);
            const banlog = new EmbedBuilder()
            .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
            .setTitle(`🎫 Ticket Created`)
            .setColor("Green")
            .addFields(
              { name: "Creator", value: `<@${tickets.creatorId}>`, inline: true },
              { name: "Channel", value: `${channel.name}`, inline: true },
              { name: "Ticket Type", value: `\`${panels.name}\``, inline: true }
            )
            .setTimestamp()
            .setThumbnail(config.TicketsThumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
            logChannel.send({ embeds: [banlog] });
          }
        }

        const now = new Date();

        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const formattedTime = `${day}/${month}/${year} ${String(hours).padStart(2,'0')}:${minutes} ${ampm}`;

        const tickets = await Ticket.findOne({ channelId: channel.id });
        const panels = await Panel.findOne({ guildId: interaction.guild.id });
        const creator = await interaction.client.users.fetch(tickets.creatorId);

        // Send header embed
        const headerEmbed = {
          author: {
            name: creator.tag,
            iconURL: creator.displayAvatarURL(),
          },
          title: `🎫 ${panel.name} Ticket`,
          description: `Please provide as much detail as possible about the issue you are having and someone will be with you shortly.\n\n**Ticket Opened By**\n<@${tickets.creatorId}>`,
          color: 0xFAA61A,
          timestamp: new Date(),
          footer: {
            text: 'Ticket Opened',
            iconURL: config.TicketsThumbnail, // or a URL to an image
          },
          thumbnail: { url: config.TicketsThumbnail },
        };

        await interaction.deferReply({ ephemeral: true });

        const controls = new ActionRowBuilder();
        if (panel.options.claimEnabled) controls.addComponents(
          new ButtonBuilder().setCustomId(`ticket_close:${channel.id}`).setLabel("🔒 Close Ticket").setStyle(ButtonStyle.Danger)
        );
        controls.addComponents(
          new ButtonBuilder().setCustomId(`ticket_claim:${channel.id}`).setLabel("Claim").setStyle(ButtonStyle.Secondary)
        );
        const supportMention = panel.supportRole ? `<@&${panel.supportRole}>` : "";

        const ticket = await Ticket.findOne({ guildiD: interaction.guild.id });

        await channel.send({ content: `Welcome <@${tickets.creatorId}>, ${supportMention} will be with you shortly`, embeds: [headerEmbed], components: [controls] });
        await interaction.followUp({ content: `✅ Ticket created: ${channel}`});
      }

      // In-channel buttons: claim, close, lock
      if (["ticket_claim", "ticket_close", "ticket_lock"].includes(action)) {
        const ticket = await Ticket.findOne({ channelId: panelIdOrChannelId, guildId: interaction.guild.id }).populate("panelId");
        if (!ticket) return interaction.reply({ content: "Ticket record not found.", ephemeral: true });
        const panel = ticket.panelId;

        // Staff check
        if (!interaction.member.roles.cache.has(panel.supportRole) && !interaction.member.permissions.has("Administrator")) {
          return interaction.reply({ content: "You are not staff for this ticket.", ephemeral: true });
        }

        // Claim
        if (action === "ticket_claim") {
          if (ticket.claimedBy) {
            return interaction.reply({ content: `❌ This ticket is already claimed by <@${ticket.claimedBy}>`, ephemeral: true });
          }

          ticket.claimedBy = interaction.user.id;
          await ticket.save();

          const channel = interaction.channel;
          try {
            await channel.setName(`${interaction.user.tag}-dealing`);
          } catch (error) {
            console.error("Failed to rename channel:", error);
          }

          // Save to DB
          const log = new TicketLog({
            guildId: interaction.guild.id,
            moderatorId: interaction.user.id,
            action: "TicketClaim"
          });
          await log.save();

          // Send modlog if set
          const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
          if (guildConfig && guildConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
              const tickets = await Ticket.findOne({ channelId: channel.id });
              const panels = await Panel.findOne({ guildId: interaction.guild.id });
              const channeln = interaction.guild.channels.fetch(tickets.channelId).catch(() => null);
              const creator = await interaction.client.users.fetch(tickets.creatorId);
              const banlog = new EmbedBuilder()
              .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
              .setTitle(`🎫 Ticket Claimed`)
              .setColor("Green")
              .addFields(
                { name: "Creator", value: `<@${tickets.creatorId}>`, inline: true },
                { name: "Channel ID", value: `${channel}`, inline: true },
                { name: "Ticket Type", value: `\`${panels.name}\``, inline: true },
                { name: "Claimed By", value: `${interaction.user}`, inline: true}
              )
              .setTimestamp()
              .setThumbnail(config.TicketsThumbnail)
              .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
              logChannel.send({ embeds: [banlog] });
            }
          }
          
          return channel.send({ content: `Hello <@${ticket.creatorId}>,\n\n My name is ${interaction.user} and i will be assisting you today. Please give me a few moments to review your ticket.`, ephemeral: true });
        }

        // Close
        if (action === "ticket_close") {
          const channel = await interaction.guild.channels.fetch(panelIdOrChannelId);
          await interaction.deferReply({ ephemeral: true }); // Defer reply for long operations

          const allMessages = await fetchAllMessages(channel);

          const panelDoc = await Panel.findOne({ guildId: interaction.guild.id }); // you already had panelss variable; reuse if present
          const supportRolesRaw = panelDoc?.supportRole ?? panelss?.supportRole ?? null;
          let supportRoles = [];
          if (supportRolesRaw) {
            if (Array.isArray(supportRolesRaw)) supportRoles = supportRolesRaw;
            else if (typeof supportRolesRaw === "string") {
              // comma-separated maybe? handle both single id and CSV
              supportRoles = supportRolesRaw.includes(",") ? supportRolesRaw.split(",").map(s=>s.trim()).filter(Boolean) : [supportRolesRaw];
            }
          }

          const ticketDoc = await Ticket.findOne({ channelId: channel.id });
          const ownerId = ticketDoc?.creatorId || ticketss?.creatorId || null;

          const { txtPath, htmlURL } = await createTranscriptFile(channel, allMessages, {
            ownerId,
            staffRoleIds: supportRoles,
            baseUrl: config.transcriptBaseURL || "https://localhost:3001/transcripts/"
          });

          const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
            .setLabel("Transcript")
            .setStyle(ButtonStyle.Link)
            .setURL(htmlURL)
          );

          //////

          // Save to DB
          const ticketss = await Ticket.findOne({ channelId: channel.id });
          const panelss = await Panel.findOne({ guildId: interaction.guild.id });
          const log = new TicketLog({
            guildId: interaction.guild.id,
            moderatorId: interaction.user.id,
            action: "TicketClose"
          });
          await log.save();
          
          // Send modlog if set
          const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
          if (guildConfig && guildConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
              // Attachments summary
              const attachments = [];
              for (const m of allMessages) {
                if (m.attachments && m.attachments.size) {
                  for (const a of m.attachments.values()) attachments.push(a.url);
                }
              }

              const usersInTicket = [
                  ...new Set(allMessages.map(m => m.author.id))
              ];

              const resolvedUsers = [];

              for (const id of usersInTicket) {
                const u = await interaction.client.users.fetch(id).catch(() => null);
                if (u) {
                  resolvedUsers.push({
                    id,
                    tag: u.tag
                  });
                }
              }

              const formattedUserList = resolvedUsers
              .map((u, i) => `${i + 1} — <@${u.id}> — ${u.tag}`)
              .join("\n");

              const creator = await interaction.client.users.fetch(ticketss.creatorId);
              const banlog = new EmbedBuilder()
              .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
              .setTitle("🎫 Ticket Closed")
              .setColor("Red")
              .addFields(
                { name: "Ticket Owner", value: `<@${ticketss.creatorId}>`, inline: true },
                { name: "Channel", value: `${channel ? channel.name : "Unknown Channel"}`, inline: true },
                { name: "Panel Name", value: `${panelss.name}`, inline: true },
                { name: "Closed By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Messages", value: `${allMessages.length}`, inline: true },
                { name: "Users in transcript", value: formattedUserList.length > 0 ? formattedUserList : "No users found", inline: false },
              )
              .setTimestamp()
              .setThumbnail(config.TicketsThumbnail)
              .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
              logChannel.send({ embeds: [banlog], components: [row], files: [txtPath] });
            }
          }
          //await logCh.send({ embeds: [embed], files: panel.options.transcriptToFile ? [txtPath] : [] });
          

          // -------------------------
          // Update ticket in DB
          // -------------------------
          ticket.status = "closed";
          ticket.closedAt = new Date();
          await ticket.save();

          // -------------------------
          // DM the ticket creator
          // -------------------------
          const tickets = await Ticket.findOne({ channelId: channel.id });
          const panels = await Panel.findOne({ guildId: interaction.guild.id });
          try {
            const usersInTicket = [
              ...new Set(allMessages.map(m => m.author.id))
            ];

            const resolvedUsers = [];

            for (const id of usersInTicket) {
              const u = await interaction.client.users.fetch(id).catch(() => null);
              if (u) {
                resolvedUsers.push({
                  id,
                  tag: u.tag
                });
              }
            }

            const formattedUserList = resolvedUsers
            .map((u, i) => `${i + 1} — <@${u.id}> — ${u.tag}`)
            .join("\n");
            const user = await client.users.fetch(tickets.creatorId);
            if (user) {
              const creator = await interaction.client.users.fetch(tickets.creatorId);
              const dmembed = new EmbedBuilder()
              .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
              .setTitle("🎫 Ticket Closed")
              .setColor("Red")
              .addFields(
                { name: "Ticket Owner", value: `<@${tickets.creatorId}>`, inline: true },
                { name: "Channel", value: `${channel ? channel.name : "Unknown Channel"}`, inline: true },
                { name: "Panel Name", value: `${panels.name}`, inline: true },
                { name: "Closed By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Messages", value: `${allMessages.length}`, inline: true },
                { name: "Users in transcript", value: formattedUserList.length > 0 ? formattedUserList : "No users found", inline: false },
              )
              .setTimestamp()
              .setThumbnail(config.TicketsThumbnail)
              .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
              await user.send({ embeds: [dmembed], components: [row], files: [txtPath] }).catch(() => {});
            }
          } catch (e) {
            console.log("Failed to DM ticket creator:", e);
          }

          // -------------------------
          // Helper function to wait
          // -------------------------
          function wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
          }

          // -------------------------
          // Send closing messages and delete channel
          // -------------------------
          const deleteEmbed1 = new EmbedBuilder()
          .setTitle("🎫 Ticket Closing")
          .setColor(0x942626)
          .setDescription("✅ Ticket closed and transcript saved.")
          .setTimestamp()
          .setThumbnail(config.TicketsThumbnail)
          .setFooter({ text: `Requested By: ${interaction.user.tag}` });

          const deleteEmbed2 = new EmbedBuilder()
          .setTitle("🎫 Ticket Closing")
          .setColor(0x942626)
          .setDescription("Deleting ticket in a few seconds...")
          .setTimestamp()
          .setThumbnail(config.TicketsThumbnail)
          .setFooter({ text: `Requested By: ${interaction.user.tag}` });
        
          await interaction.followUp({ embeds: [deleteEmbed1] });

          await new Promise(resolve => setTimeout(resolve, 3000));

          await interaction.followUp({ embeds: [deleteEmbed2] });

          await new Promise(resolve => setTimeout(resolve, 3000));

          await channel.delete(`Closed by ${interaction.user.tag}`); 
      }
     }
  }
});

try {
    // Start transcript server
    startTranscriptServer();

    // Login bot
    client.login(config.token);
} catch (error) {
    console.error("❌ Error during startup:", error);
};

//client.login(config.token);
