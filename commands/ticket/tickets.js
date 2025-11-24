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
    .setName("tickets")
    .setDescription("Advanced multi-panel ticket system")
    // Ticket moderation (used inside ticket channel)
    .addSubcommand(sub => sub.setName("add").setDescription("Add a user to the ticket").addUserOption(opt => opt.setName("user").setDescription("User to add to the ticket").setRequired(true)))
    .addSubcommand(sub => sub.setName("remove").setDescription("Remove a user from the ticket").addUserOption(opt => opt.setName("user").setDescription("User to remove from the ticket").setRequired(true)))
    .addSubcommand(sub => sub.setName("blacklist").setDescription("Blacklist a user from creating tickets").addUserOption(opt => opt.setName("user").setDescription("User to blacklist").setRequired(true)))
    .addSubcommand(sub => sub.setName("unblacklist").setDescription("Remove a user from the ticket blacklist").addUserOption(opt => opt.setName("user").setDescription("User to unblacklist").setRequired(true)))
    .addSubcommand(sub => sub.setName("blacklistview").setDescription("View all blacklisted users"))
    .addSubcommand(sub => sub.setName('rename').setDescription('Rename this ticket').addStringOption(option => option.setName('new_name').setDescription('The new name for the ticket').setRequired(true))),

async execute(interaction) {
    const sub = interaction.options.getSubcommand(false);

    //
    // ─── ADD ─────────────────────────────────────
    //
    if (sub === "add") {
        await interaction.deferReply({ ephemeral: true });

        const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });
        if (!ticketDoc)
            return interaction.editReply("❌ This is not a ticket channel.");

        const panelDoc = await Panel.findOne({ guildId: interaction.guild.id });
        if (!panelDoc)
            return interaction.editReply("❌ Panel configuration not found.");

        if (!interaction.member.roles.cache.has(panelDoc.supportRole))
            return interaction.editReply("❌ You are not staff for this panel.");

        const user = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member)
            return interaction.editReply("❌ Could not fetch that user.");

        await interaction.channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        // Log action
        const log = new TicketLog({
          guildId: interaction.guild.id,
          moderatorId: interaction.user.id,
          action: "TicketAdd"
        });
        await log.save();

        channel = interaction.channel;

        // Send mod log if set
        if (panelDoc.logChannel) {
          const logChannel = await interaction.guild.channels.fetch(panelDoc.logChannel).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const tickets = await Ticket.findOne({ channelId: channel.id });
            const creator = await interaction.client.users.fetch(tickets.creatorId);
            const embed = new EmbedBuilder()
            .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
            .setTitle("🎫 Ticket Add")
            .setColor("Green")
            .addFields(
              { name: "Moderator", value: `<@${interaction.user.id}>`, inline: true },
              { name: "Added User", value: `<@${member.id}>`, inline: true },
              { name: "Channel", value: `<#${interaction.channel.id}>`, inline: true },
              { name: "Ticket Type", value: `\`${panelDoc.name}\``, inline: true }
            )
            .setTimestamp()
            .setThumbnail(config.TicketsThumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail });

            await logChannel.send({ embeds: [embed] }).catch(console.error);
          }
        }

        const addEmbed = new EmbedBuilder()
        .setTitle("🎫 Ticket Add")
        .setDescription(`✅ Added <@${member.id}> to the ticket.`)
        .setColor("Green")
        .setTimestamp()
        .setThumbnail(config.TicketsThumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail });

        return interaction.editReply({ embeds: [addEmbed] });
    }

    //
    // ─── REMOVE ──────────────────────────────────
    //
    else if (sub === "remove") {
        await interaction.deferReply({ ephemeral: true });

        const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });
        if (!ticketDoc)
            return interaction.editReply("❌ This is not a ticket channel.");

        const panelDoc = await Panel.findOne({ guildId: interaction.guild.id });
        if (!panelDoc)
            return interaction.editReply("❌ Panel config missing.");

        if (!interaction.member.roles.cache.has(panelDoc.supportRole))
            return interaction.editReply("❌ You are not staff.");

        const user = interaction.options.getUser("user");
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member)
            return interaction.editReply("❌ User not in server.");

        if (user.id === ticketDoc.creatorId)
            return interaction.editReply("❌ Cannot remove ticket creator.");

        await interaction.channel.permissionOverwrites.edit(user.id, {
            ViewChannel: false,
            SendMessages: false,
            ReadMessageHistory: false
        });

        // Save to DB
        const tickets = await Ticket.findOne({ guildId: interaction.guild.id });
        const panels = await Panel.findOne({ guildId: interaction.guild.id });
        const log = new TicketLog({
            guildId: interaction.guild.id,
            moderatorId: interaction.user.id,
            action: "TicketRemove"
        });
        await log.save();

        channel = interaction.channel;

        // Send modlog if set
        const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
              const tickets = await Ticket.findOne({ channelId: channel.id });
              const creator = await interaction.client.users.fetch(tickets.creatorId);
                const banlog = new EmbedBuilder()
                .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
                .setTitle(`🎫 Ticket Remove`)
                .setColor("Red")
                .addFields(
                    { name: "User", value: `${interaction.user}`, inline: true },
                    { name: "Removed", value: `${user}`, inline: true },
                    { name: "Channel", value: `${channel}`, inline: true },
                    { name: "Ticket Type", value: `\`${panels.name}\``, inline: true },
                )
                .setTimestamp()
                .setThumbnail(config.TicketsThumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
                logChannel.send({ embeds: [banlog] });
            }
          }

          const removeembed = new EmbedBuilder()
          .setTitle("🎫 Ticket Remove")
          .setDescription(`✅ Removed ${user} from the ticket.`)
          .setColor("Green")
          .setTimestamp()
          .setThumbnail(config.TicketsThumbnail)
          .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
            
          return interaction.editReply({ embeds: [removeembed] });
    }

    //
    // ─── BLACKLIST ───────────────────────────────
    //
    else if (sub === "blacklist") {
        const user = interaction.options.getUser("user");

        const panel = await Panel.findOne({ guildId: interaction.guild.id });
        if (!panel)
            return interaction.reply({ ephemeral: true, content: "No panel found." });

        if (!panel.blacklist) panel.blacklist = [];

        if (panel.blacklist.includes(user.id))
            return interaction.reply({ ephemeral: true, content: "User already blacklisted." });

        panel.blacklist.push(user.id);
        await Panel.create({
          guildId: interaction.guild.id,
          name: panel.name,
          blacklist: user.id
        });
        await panel.save();

        // Save to DB
        const tickets = await Ticket.findOne({ guildId: interaction.guild.id });
        const panels = await Panel.findOne({ guildId: interaction.guild.id });
        const log = new TicketLog({
            guildId: interaction.guild.id,
            moderatorId: interaction.user.id,
            action: "TicketBlacklist"
        });
        await log.save();

        channel = interaction.channel;

        // Send modlog if set
        const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
              const tickets = await Ticket.findOne({ channelId: channel.id });
                const banlog = new EmbedBuilder()
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setTitle(`🎫 Ticket Blacklist`)
                .setColor("Green")
                .addFields(
                    { name: "User", value: `${user}`, inline: true },
                    { name: "Moderator", value: `${interaction.user}`, inline: true },
                )
                .setTimestamp()
                .setThumbnail(config.TicketsThumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
                logChannel.send({ embeds: [banlog] });
            }
          }

        const blacklistedembed = new EmbedBuilder()
        .setTitle("🎫 Ticket Blacklist")
        .setDescription(`✅ Blacklisted <@${user.id}>`)
        .setColor("Green")
        .setTimestamp()
        .setThumbnail(config.TicketsThumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })

        return interaction.reply({ embeds: [blacklistedembed] });
    }

    //
    // ─── UNBLACKLIST ─────────────────────────────
    //
    else if (sub === "unblacklist") {
        const user = interaction.options.getUser("user");

        const panel = await Panel.findOne({ guildId: interaction.guild.id });
        if (!panel)
            return interaction.reply({ ephemeral: true, content: "No panel found." });

        if (!panel.blacklist || !panel.blacklist.includes(user.id))
            return interaction.reply({ ephemeral: true, content: "User not blacklisted." });

        panel.blacklist = panel.blacklist.filter(id => id !== user.id);
        await panel.save();

        // Save to DB
        const tickets = await Ticket.findOne({ guildId: interaction.guild.id });
        const panels = await Panel.findOne({ guildId: interaction.guild.id });
        const log = new TicketLog({
            guildId: interaction.guild.id,
            moderatorId: interaction.user.id,
            action: "TicketBlacklist"
        });
        await log.save();

        channel = interaction.channel;

        // Send modlog if set
        const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
              const tickets = await Ticket.findOne({ channelId: channel.id });
                const banlog = new EmbedBuilder()
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
                .setTitle(`🎫 Ticket Unblacklist`)
                .setColor("Red")
                .addFields(
                    { name: "User", value: `${user}`, inline: true },
                    { name: "Moderator", value: `${interaction.user}`, inline: true },
                )
                .setTimestamp()
                .setThumbnail(config.TicketsThumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
                logChannel.send({ embeds: [banlog] });
            }
          }

        const unblacklistedembed = new EmbedBuilder()
        .setTitle("🎫 Ticket Unblacklist")
        .setDescription(`✅ Unblacklisted <@${user.id}>`)
        .setColor("Green")
        .setTimestamp()
        .setThumbnail(config.TicketsThumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })

        return interaction.reply({ embeds: [unblacklistedembed] });
    }

    //
    // ─── BLACKLISTVIEW ───────────────────────────
    //
    else if (sub === "blacklistview") {
        const panel = await Panel.findOne({ guildId: interaction.guild.id });

        if (!panel?.blacklist?.length)
            return interaction.reply({ ephemeral: true, content: "No users blacklisted." });

        const blacklistviewembed = new EmbedBuilder()
        .setTitle("🎫 Ticket Blacklist View")
        .setColor("Green")
        .addFields({ name: "Blacklisted:", value: `${panel.blacklist.map(id => `<@${id}>`).join("\n")}`, inline: true})
        .setTimestamp()
        .setThumbnail(config.TicketsThumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })

        return interaction.reply({ embeds: [blacklistviewembed] });
    }

    //
    // ─── RENAME ──────────────────────────────────
    //
    else if (sub === "rename") {
        await interaction.deferReply({ ephemeral: true });

        const ticketDoc = await Ticket.findOne({ channelId: interaction.channel.id });
        if (!ticketDoc)
            return interaction.editReply("❌ This is not a ticket channel.");

        const panelDoc = await Panel.findOne({ guildId: interaction.guild.id });
        if (!panelDoc)
            return interaction.editReply("❌ Panel config not found.");

        if (!interaction.member.roles.cache.has(panelDoc.supportRole))
            return interaction.editReply("❌ You are not staff for this panel.");

        const newName = interaction.options.getString("new_name");

        // Save to DB
        const tickets = await Ticket.findOne({ guildId: interaction.guild.id });
        const panels = await Panel.findOne({ guildId: interaction.guild.id });
        const log = new TicketLog({
            guildId: interaction.guild.id,
            moderatorId: interaction.user.id,
            action: "TicketRemove"
        });
        await log.save();

        channel = interaction.channel;

        const oldName = interaction.channel.name;

        // Send modlog if set
        const guildConfig = await Panel.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.logChannel) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannel);
            if (logChannel) {
              const tickets = await Ticket.findOne({ channelId: channel.id });
              const creator = await interaction.client.users.fetch(tickets.creatorId);
                const banlog = new EmbedBuilder()
                .setAuthor({ name: creator.tag, iconURL: creator.displayAvatarURL() })
                .setTitle(`🎫 Ticket Renamed`)
                .setColor("Red")
                .addFields(
                    { name: "Old Channel", value: `${oldName}`, inline: true },
                    { name: "New Channel", value: `${newName}`, inline: true },
                    { name: "Ticket Type", value: `\`${panels.name}\``, inline: true },
                )
                .setTimestamp()
                .setThumbnail(config.TicketsThumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })
                logChannel.send({ embeds: [banlog] });
            }
          }

        try {
            await interaction.channel.setName(newName);
            ticketDoc.channelName = newName;
            await ticketDoc.save();

            const renameembed = new EmbedBuilder()
            .setTitle("🎫 Ticket Rename")
            .setDescription(`✅ Renamed the ticket to \`${newName}\``)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.TicketsThumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.TicketsThumbnail })

            return interaction.editReply({ embeds: [renameembed] });
        } catch (err) {
            console.log(err);
            return interaction.editReply("❌ Failed to rename channel.");
        }
    }
}}