const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");
const config = require("../../config.json");

const Panel = require("../../models/panel");
const Ticket = require("../../models/ticket");
const Counter = require("../../models/counter");
const TicketLog = require("../../models/TicketLog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Advanced multi-panel ticket system")
    .addSubcommandGroup(group =>
      group.setName("panel").setDescription("Panel management")
        .addSubcommand(sub =>
          sub.setName("create")
            .setDescription("Create a new panel")
            .addStringOption(o => o.setName("name").setDescription("Panel name").setRequired(true))
            .addChannelOption(o => o.setName("channel").setDescription("Panel channel").addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addChannelOption(o => o.setName("category").setDescription("Ticket category").addChannelTypes(ChannelType.GuildCategory).setRequired(true))
            .addRoleOption(o => o.setName("role").setDescription("Support role").setRequired(true))
            .addChannelOption(o => o.setName("log").setDescription("Log channel").addChannelTypes(ChannelType.GuildText).setRequired(false))
            .addStringOption(o => o.setName("description").setDescription("Ticket embed description (use commas for multiple lines)").setRequired(false))
            .addStringOption(o => o.setName("reasons").setDescription("Comma separated reasons").setRequired(false))
        )
        .addSubcommand(sub =>
          sub.setName("send")
            .setDescription("Send a panel by id")
            .addStringOption(o => o.setName("id").setDescription("Panel id").setRequired(true))
        )
        .addSubcommand(sub => sub.setName("list").setDescription("List panels"))
        .addSubcommand(sub => sub.setName("delete").setDescription("Delete panel").addStringOption(o => o.setName("id").setDescription("Panel id").setRequired(true)))
        .addSubcommand(sub =>
          sub.setName("edit")
            .setDescription("Edit panel text/buttons (resend embed)")
            .addStringOption(o => o.setName("id").setDescription("Panel id").setRequired(true))
            .addStringOption(o => o.setName("text").setDescription("New panel text").setRequired(false))
        )
    )
    .addSubcommandGroup(group =>
      group.setName("config").setDescription("Panel options")
        .addSubcommand(sub =>
          sub.setName("edit")
            .setDescription("Edit panel options/toggles")
            .addStringOption(o => o.setName("id").setDescription("Panel id").setRequired(true))
            .addBooleanOption(o => o.setName("claim").setDescription("Enable claim button"))
            .addBooleanOption(o => o.setName("transcriptfile").setDescription("Save transcript file to logs"))
            .addBooleanOption(o => o.setName("transcriptchannel").setDescription("Send transcript to log channel"))
        )
    )
    // Ticket moderation (used inside ticket channel)
    .addSubcommand(sub => sub.setName("claim").setDescription("Claim this ticket"))
    .addSubcommand(sub => sub.setName("unclaim").setDescription("Unclaim"))
    .addSubcommand(sub => sub.setName("close").setDescription("Close ticket").addBooleanOption(o => o.setName("file").setDescription("Attach transcript file"))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand(false);
    const group = interaction.options.getSubcommandGroup(false);

    // PANEL CREATE
    if (group === "panel" && sub === "create") {
      const permsembed = new EmbedBuilder()
      .setTitle("Missing Permissions")
      .setDescription("You don't have permission to use this command.")
      .setColor("Red")
      .setTimestamp()
      .setThumbnail(config.TicketsThumbnail)
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ embeds: [permsembed] });

      const name = interaction.options.getString("name");
      const channel = interaction.options.getChannel("channel");
      const category = interaction.options.getChannel("category");
      const role = interaction.options.getRole("role");
      const log = interaction.options.getChannel("log");
      const reasonsRaw = interaction.options.getString("reasons");
      const reasons = reasonsRaw ? reasonsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

      const doc = await Panel.create({
        guildId: interaction.guild.id,
        name, panelChannel: channel.id, ticketCategory: category.id,
        supportRole: role.id, logChannel: log ? log.id : null, reasons
      });

      return interaction.reply({ content: `✅ Panel created: **${name}** (id: \`${doc._id}\`)`, ephemeral: true });
    }

    // PANEL LIST
    if (group === "panel" && sub === "list") {
      const permsembed = new EmbedBuilder()
      .setTitle("Missing Permissions")
      .setDescription("You don't have permission to use this command.")
      .setColor("Red")
      .setTimestamp()
      .setThumbnail(config.TicketsThumbnail)
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ embeds: [permsembed] });

      const docs = await Panel.find({ guildId: interaction.guild.id });
      if (!docs.length) return interaction.reply({ content: "No panels.", ephemeral: true });
      const lines = docs.map(d => `• **${d.name}** — id: \`${d._id}\` — channel: <#${d.panelChannel}>`);
      return interaction.reply({ content: lines.join("\n"), ephemeral: true });
    }

    // PANEL DELETE
    if (group === "panel" && sub === "delete") {
      const permsembed = new EmbedBuilder()
      .setTitle("Missing Permissions")
      .setDescription("You don't have permission to use this command.")
      .setColor("Red")
      .setTimestamp()
      .setThumbnail(config.TicketsThumbnail)
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ embeds: [permsembed] });

      const id = interaction.options.getString("id");
      const doc = await Panel.findOne({ _id: id, guildId: interaction.guild.id });
      if (!doc) return interaction.reply({ content: "Not found", ephemeral: true });
      await doc.deleteOne();
      return interaction.reply({ content: `✅ Deleted panel ${id}`, ephemeral: true });
    }

    // PANEL SEND
    if (group === "panel" && sub === "send") {
      const permsembed = new EmbedBuilder()
      .setTitle("Missing Permissions")
      .setDescription("You don't have permission to use this command.")
      .setColor("Red")
      .setTimestamp()
      .setThumbnail(config.TicketsThumbnail)
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ embeds: [permsembed] });

      const id = interaction.options.getString("id");
      const doc = await Panel.findOne({ _id: id, guildId: interaction.guild.id });
      if (!doc) return interaction.reply({ content: "Panel not found", ephemeral: true });
      const channel = interaction.guild.channels.cache.get(doc.panelChannel);
      if (!channel || !channel.isTextBased()) return interaction.reply({ content: "Panel channel invalid.", ephemeral: true });

      // Build embed
      const embed = {
        title: doc.name,
        description: "To create a ticket use the Create ticket button",
        color: 0x388e3c,
        fields: [],
        footer: {
          text: "SafeGuard Ticket System",
          iconURL: config.TicketsThumbnail // optional
        }
      };
      if (doc.reasons && doc.reasons.length) embed.fields.push({ name: "Reasons", value: doc.reasons.slice(0, 5).map((r,i)=>`${i+1}. ${r}`).join("\n") });

      const components = [];
      // reason select
      if (doc.reasons && doc.reasons.length) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`ticket_reason:${doc._id}`)
          .setPlaceholder("Optional: select a reason")
          .setMinValues(0).setMaxValues(1)
          .addOptions(doc.reasons.map((r, i) => ({ label: r.slice(0,100), value: String(i) })));
        components.push(new ActionRowBuilder().addComponents(select));
      }

      const row = new ActionRowBuilder()
        .addComponents(new ButtonBuilder().setCustomId(`ticket_create:${doc._id}`).setLabel("📩 Create Ticket").setStyle(ButtonStyle.Secondary));
      components.push(row);

      const sent = await channel.send({ embeds: [embed], components });
      doc.panelMessageId = sent.id;
      await doc.save();
      return interaction.reply({ content: `✅ Panel sent to ${channel}`, ephemeral: true });
    }

    // PANEL EDIT (resend/update text)
    if (group === "panel" && sub === "edit") {
      const permsembed = new EmbedBuilder()
      .setTitle("Missing Permissions")
      .setDescription("You don't have permission to use this command.")
      .setColor("Red")
      .setTimestamp()
      .setThumbnail(config.TicketsThumbnail)
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ embeds: [permsembed] });

      const id = interaction.options.getString("id");
      const text = interaction.options.getString("text") || null;
      const doc = await Panel.findOne({ _id: id, guildId: interaction.guild.id });
      if (!doc) return interaction.reply({ content: "Panel not found", ephemeral: true });
      const channel = interaction.guild.channels.cache.get(doc.panelChannel);
      if (!channel || !channel.isTextBased()) return interaction.reply({ content: "Panel channel invalid.", ephemeral: true });

      const embed = {
        title: doc.name,
        description: text ?? "Click the button to create a ticket.",
        color: 0x57F287
      };

      const components = [];
      if (doc.reasons && doc.reasons.length) {
        const select = new StringSelectMenuBuilder()
          .setCustomId(`ticket_reason:${doc._id}`)
          .setPlaceholder("Optional: select a reason")
          .setMinValues(0).setMaxValues(1)
          .addOptions(doc.reasons.map((r, i) => ({ label: r.slice(0,100), value: String(i) })));
        components.push(new ActionRowBuilder().addComponents(select));
      }

      const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_create:${doc._id}`).setLabel("📩 Create Ticket").setStyle(ButtonStyle.Secondary));
      components.push(row);

      // If panelMessageId exists, try to edit; otherwise send new and save id
      if (doc.panelMessageId) {
        try {
          const existing = await channel.messages.fetch(doc.panelMessageId).catch(() => null);
          if (existing) {
            await existing.edit({ embeds: [embed], components });
            await interaction.reply({ content: "✅ Panel updated (edited message).", ephemeral: true });
            return;
          }
        } catch (e) { /* fallback to sending new */ }
      }

      const sent = await channel.send({ embeds: [embed], components });
      doc.panelMessageId = sent.id;
      await doc.save();
      return interaction.reply({ content: "✅ Panel updated (sent new message).", ephemeral: true });
    }

    // CONFIG EDIT
    if (group === "config" && sub === "edit") {
      const permsembed = new EmbedBuilder()
      .setTitle("Missing Permissions")
      .setDescription("You don't have permission to use this command.")
      .setColor("Red")
      .setTimestamp()
      .setThumbnail(config.TicketsThumbnail)
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator))
        return interaction.reply({ embeds: [permsembed] });
      
      const id = interaction.options.getString("id");
      const doc = await Panel.findOne({ _id: id, guildId: interaction.guild.id });
      if (!doc) return interaction.reply({ content: "Panel not found", ephemeral: true });

      const claim = interaction.options.getBoolean("claim");
      const file = interaction.options.getBoolean("transcriptfile");
      const ch = interaction.options.getBoolean("transcriptchannel");

      if (claim !== null) doc.options.claimEnabled = claim;
      if (file !== null) doc.options.transcriptToFile = file;
      if (ch !== null) doc.options.transcriptToChannel = ch;

      await doc.save();
      return interaction.reply({ content: `✅ Panel options updated for **${doc.name}**.`, ephemeral: true });
    }

    // the next commands need ticket context (inside ticket channel)
    const ticketDoc = await Ticket.findOne({ channelId: interaction.channelId, guildId: interaction.guild.id }).populate("panelId");
    if (!ticketDoc && ["claim","unclaim","close","lock","unlock"].includes(sub)) {
      return interaction.reply({ content: "This command must be used inside a ticket channel.", ephemeral: true });
    }

    // CLAIM
    if (sub === "claim") {
      const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });
      if (!ticketDoc) {
        return interaction.reply({
          content: "❌ This is not a ticket channel.",
          ephemeral: true
        });
      }

      const panelDoc = await Panel.findOne({ guildId: interaction.guild.id });

      if (!interaction.member.roles.cache.has(panelDoc.supportRole)) {
        return interaction.reply({
          content: "❌ You are not staff for this panel.",
          ephemeral: true
        });
      }

      if (ticketDoc.claimedBy) {
        return interaction.reply({ content: `❌ This ticket is already claimed by <@${ticketDoc.claimedBy}>`, ephemeral: true });
      }

      ticketDoc.claimedBy = interaction.user.id;
      await ticketDoc.save();

      const channel = interaction.channel;
      try {
        await channel.setName(`${interaction.user.tag}-dealing`);
      } catch (error) {
        console.error("Failed to rename channel:", error);
      }

      return channel.send({ content: `✅ Claimed by <@${interaction.user.id}>` });
    }

    // UNCLAIM
    if (sub === "unclaim") {
      const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });
      if (!ticketDoc) {
        return interaction.reply({
          content: "❌ This is not a ticket channel.",
          ephemeral: true
        });
      }

      const panelDoc = await Panel.findOne({ guildId: interaction.guild.id });

      if (!interaction.member.roles.cache.has(panelDoc.supportRole)) {
        return interaction.reply({
          content: "❌ You are not staff for this panel.",
          ephemeral: true
        });
      }

      if (!ticketDoc.claimedBy) return interaction.reply({ content: "Ticket not claimed.", ephemeral: true });
      if (ticketDoc.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: "Only claimer or admin can unclaim.", ephemeral: true });
      ticketDoc.claimedBy = null;

      // Save to DB
      const tickets = await Ticket.findOne({ guildId: interaction.guild.id });
      const panels = await Panel.findOne({ guildId: interaction.guild.id });
      const log = new TicketLog({
        guildId: interaction.guild.id,
        moderatorId: interaction.user.id,
        action: "TicketUnclaim"
      });
      await log.save();

      channel = interaction.channel;

      // Send modlog if set
      const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
      if (guildConfig && guildConfig.logChannel) {
        const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
        if (logChannel) {
          const channeln = interaction.guild.channels.fetch(tickets.channelId).catch(() => null);
          const banlog = new EmbedBuilder()
          .setTitle(`Ticket Unclaim`)
          .setColor("Red")
          .addFields(
            { name: "Creator", value: `<@${tickets.creatorId}>` },
            { name: "Channel ID", value: `${channel}` },
            { name: "Ticket Type", value: `\`${panels.name}\`` },
            { name: "Unclaimed By", value: `${interaction.user}`}
          )
          .setTimestamp()
          .setThumbnail(config.TicketsThumbnail)
          .setFooter({ text: `Requested By: ${interaction.user.tag}` })
          logChannel.send({ embeds: [banlog] });
        }

      await ticketDoc.save();
      return interaction.reply({ content: "✅ Unclaimed." });
    }

    // CLOSE
    if (sub === "close") {      
      const panel = await Panel.findById(ticketDoc.panelId);
      const attachFile = interaction.options.getBoolean("file") ?? panel.options.transcriptToFile;

      await interaction.reply({ content: "⏳ Closing ticket and generating transcript...", ephemeral: true });

      // fetch full message history and create transcript
      const { fetchAllMessages, createTranscriptFile } = require("../../utils/transcript");
      const channel = interaction.channel;
      const allMessages = await fetchAllMessages(channel);
      const filePath = await createTranscriptFile(channel, allMessages);

      // send to log channel embed with link(s)
      // Save to DB
      const tickets = await Ticket.findOne({ channelId: channel.id });
      const panels = await Panel.findOne({ guildId: interaction.guild.id });
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
          const banlog = new EmbedBuilder()
          .setTitle(`Ticket Closed`)
          .setColor("Green")
          .addFields(
            { name: "Creator", value: `<@${tickets.creatorId}>` },
            { name: "Closed By", value: `<@${interaction.user.id}>` },
            { name: "Messages", value: `${allMessages.length}` },
            { name: "Channel", value: `<#${tickets.channelId}>` },
            { name: "Ticket Type", value: `\`${panels.name}\`` },

          )
          .setTimestamp()
          .setThumbnail(config.TicketsThumbnail)
          .setFooter({ text: `Requested By: ${interaction.user.tag}` })
          logChannel.send({ embeds: [banlog], files: [filePath] });
        }

      // update ticket doc
      ticketDoc.status = "closed";
      ticketDoc.closedAt = new Date();
      await ticketDoc.save();

      // DM creator with optional file
      try {
        const user = await interaction.client.users.fetch(ticketDoc.creatorId);
        if (user) {
          await user.send({ content: `Your ticket (#${ticketDoc.ticketNum.toString().padStart(4,"0")}) in ${interaction.guild.name} was closed.`, files: attachFile ? [filePath] : [] }).catch(()=>{});
        }
      } catch (e) {}

      // delete channel
      await channel.delete(`Closed by ${interaction.user.tag}`);
      return;
    }
  }}
}}