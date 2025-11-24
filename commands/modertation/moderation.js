const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');

const config = require("../../config.json");

const MuteRole = require('../../models/muteRole');
const parseDuration = require('../../utils/duration');
const ModLog = require('../../models/ModLog');
const GuildConfig = require("../../models/GuildConfig");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('moderation')
        .setDescription('Moderation tools.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        
        // ban
        .addSubcommand(sub => 
            sub.setName('ban')
                .setDescription('Bans a member.')
                .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
                .addIntegerOption(o => o.setName('days').setDescription('Delete message history in days'))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )

        // unban
        .addSubcommand(sub => 
            sub.setName('unban')
                .setDescription('Unbans a member.')
                .addUserOption(o => o.setName('user').setDescription('User to unban').setRequired(true))
        )
        
        // kick
        .addSubcommand(sub =>
            sub.setName('kick')
                .setDescription('Kicks a member.')
                .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )
        
        // softban
        .addSubcommand(sub =>
            sub.setName('softban')
                .setDescription('Ban For 7 Days & unban to purge messages.')
                .addUserOption(o => o.setName('user').setDescription('User to softban').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )
        
        // mute
        .addSubcommand(sub =>
            sub.setName('mute')
                .setDescription('Mute a member.')
                .addUserOption(o => o.setName('user').setDescription('Member to mute').setRequired(true))
                .addStringOption(o => o.setName('time').setDescription('Duration (10m, 1h, 3d...)'))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )
        
        // hardmute
        .addSubcommand(sub =>
            sub.setName('hardmute')
                .setDescription('Mute + remove all roles.')
                .addUserOption(o => o.setName('user').setDescription('Member to hardmute').setRequired(true))
                .addStringOption(o => o.setName('time').setDescription('Duration'))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )
        
        // unmute
        .addSubcommand(sub =>
            sub.setName('unmute')
                .setDescription('Unmute a member.')
                .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true))
        )
        
        // timeout
        .addSubcommand(sub =>
            sub.setName('timeout')
                .setDescription('Apply timeout to a member.')
                .addUserOption(o => o.setName('user').setDescription('User to timeout').setRequired(true))
                .addStringOption(o => o.setName('time').setDescription('Duration'))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )
        
        // removetimeout
        .addSubcommand(sub =>
            sub.setName('removetimeout')
                .setDescription('Remove timeout from a member.')
                .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
        )
        
        // tempban
        .addSubcommand(sub =>
            sub.setName('tempban')
                .setDescription('Temporarily ban a member.')
                .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
                .addStringOption(o => o.setName('time').setDescription('Duration'))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        )
        
        // massban
        .addSubcommand(sub =>
            sub.setName('massban')
                .setDescription('Ban multiple users.')
                .addStringOption(o => o.setName('ids').setDescription('User IDs separated by commas').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason'))
        ),

    async execute(interaction) {
        const permsembed = new EmbedBuilder()
        .setTitle("Missing Permissions")
        .setDescription("You don't have permission to use this command.")
        .setColor("Red")
        .setTimestamp()
        .setThumbnail(config.Thumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}` })

        if (!interaction.memberPermissions.has(PermissionsBitField.Flags.BanMembers))
        return interaction.reply({ embeds: [permsembed] });

        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;

        async function getMuteRole() {
            const data = await MuteRole.findOne({ guildId: guild.id });
            return data?.roleId || null;
        }

        // ================================
        // BAN
        // ================================
        if (sub === 'ban') {
            const user = interaction.options.getUser('user');
            const days = interaction.options.getInteger('days') || 0;
            const reason = interaction.options.getString('reason') || 'No Reason Provided';

            await guild.members.ban(user.id, { days, reason });
            
            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "Ban",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Ban")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const banembed1 = new EmbedBuilder()
            .setTitle("Ban")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}` },
                { name: "Days", value: `\`${days}\`` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [banembed1]});
        }

        // ================================
        // UNBAN
        // ================================
        if (sub === 'unban') {
            const user = interaction.options.getUser('user');

            await guild.members.unban(user.id);
            
            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "Unban",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Unban")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const banembed1 = new EmbedBuilder()
            .setTitle("Unban")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [banembed1]});
        }

        // ================================
        // KICK
        // ================================
        if (sub === 'kick') {
            const member = interaction.options.getMember('user');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';

            const kicknoembed1 = new EmbedBuilder()
            .setTitle("Kick")
            .setDescription("User not in the server.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            if (!member) return interaction.reply({ embeds: [kicknoembed1] });

            await member.kick(reason);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "Kick",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Kick")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const kickembed1 = new EmbedBuilder()
            .setTitle("Kick")
            .setColor("Red")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [kickembed1] });
        }

        // ================================
        // SOFTBAN
        // ================================
        if (sub === 'softban') {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';

            await guild.members.ban(user.id, { days: 7, reason });
            await guild.members.unban(user.id);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "SoftBan",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Soft Ban")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const softbanembed1 = new EmbedBuilder()
            .setTitle("Soft Ban")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [softbanembed1] });
        }

        // ================================
        // MUTE
        // ================================
        if (sub === 'mute') {
            const muteRoleId = await getMuteRole();
            const muterolenotset = new EmbedBuilder()
            .setTitle("Mute")
            .setDescription("❌ Mute role not set.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!muteRoleId)
                return interaction.reply({ embeds: [muterolenotset] });

            const member = interaction.options.getMember('user');
            const timeStr = interaction.options.getString('time');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';

            const duration = parseDuration(timeStr);

            await member.roles.add(muteRoleId);

            if (duration)
                setTimeout(() => member.roles.remove(muteRoleId), duration);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "Mute",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Mute")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Time", value: `\`${duration}\`` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const muteembed1 = new EmbedBuilder()
            .setTitle("Mute")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Time", value: `\`${duration}\`` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [muteembed1] });
        }

        // ================================
        // HARDMUTE
        // ================================
        if (sub === 'hardmute') {
            const muteRoleId = await getMuteRole();
            const muterolenotset = new EmbedBuilder()
            .setTitle("Hard Mute")
            .setDescription("❌ Mute role not set.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!muteRoleId)
                return interaction.reply({ embeds: [muterolenotset] });

            const member = interaction.options.getMember('user');
            const timeStr = interaction.options.getString('time');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';
            const duration = parseDuration(timeStr);

            const rolesBackup = [...member.roles.cache.keys()];

            await member.roles.set([muteRoleId]);

            if (duration)
                setTimeout(() => member.roles.set(rolesBackup), duration);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "HardMute",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Mute")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Time", value: `\`${duration}\`` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const hardmuteembed1 = new EmbedBuilder()
            .setTitle("Hard Mute")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Time", value: `\`${duration}\`` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [hardmuteembed1]});
        }

        // ================================
        // UNMUTE
        // ================================
        if (sub === 'unmute') {
            const muteRoleId = await getMuteRole();
            const muterolenotset = new EmbedBuilder()
            .setTitle("Unmute")
            .setDescription("❌ Mute role not set.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!muteRoleId)
                return interaction.reply({ embeds: [muterolenotset] });

            const member = interaction.options.getMember('user');

            await member.roles.remove(muteRoleId);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "Unmute",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Unmute")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const unmuteembed = new EmbedBuilder()
            .setTitle("Unmute")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            return interaction.reply(`🔈 Unmuted **${member.user.tag}**`);
        }

        // ================================
        // TIMEOUT
        // ================================
        if (sub === 'timeout') {
            const member = interaction.options.getMember('user');
            const timeStr = interaction.options.getString('time');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';
            const duration = parseDuration(timeStr);

            const invalidtimeembed = new EmbedBuilder()
            .setTitle("Timeout")
            .setDescription("❌ Invalid time format.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!duration)
                return interaction.reply({ embeds: [invalidtimeembed] });

            await member.disableCommunicationUntil(Date.now() + duration, reason);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "Timeout",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Timeout")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Guild", value: `**${guild.name}**` },
                        { name: "Duration", value: `\`${duration}\`` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const dmembed = new EmbedBuilder()
            .setTitle("Timeout")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Guild", value: `**${guild.name}**` },
                { name: "Duration", value: `\`${duration}\`` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            member.send({ embeds: [dmembed] })
                .catch(() => {});

            const timeoutembed = new EmbedBuilder()
            .setTitle("Timeout")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Duration", value: `\`${duration}\`` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [timeoutembed]});
        }

        // ================================
        // REMOVE TIMEOUT
        // ================================
        if (sub === 'removetimeout') {
            const member = interaction.options.getMember('user');

            await member.timeout(null);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "RemoveTimeout",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Remove Timeout")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const untimeoutembed = new EmbedBuilder()
            .setTitle("Remove Timeout")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [untimeoutembed]});
        }

        // ================================
        // TEMPBAN
        // ================================
        if (sub === 'tempban') {
            const user = interaction.options.getUser('user');
            const timeStr = interaction.options.getString('time');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';
            const duration = parseDuration(timeStr);

            const invalidtimeembed = new EmbedBuilder()
            .setTitle("Temp Ban")
            .setDescription("❌ Invalid time format.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!duration)
                return interaction.reply({ embeds: [invalidtimeembed] });

            await guild.members.ban(user.id, { reason });

            setTimeout(() => {
                guild.members.unban(user.id).catch(() => {});
            }, duration);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "TempBan",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Temp Ban")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Duration", value: `\`${duration}\`` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const tempbanembed = new EmbedBuilder()
            .setTitle("Temp Ban")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${member}` },
                { name: "Duration", value: `\`${duration}\`` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            return interaction.reply({ embeds: [tempbanembed] });
        }

        // ================================
        // MASSBAN
        // ================================
        if (sub === 'massban') {
            const ids = interaction.options.getString('ids').split(',').map(i => i.trim());
            const reason = interaction.options.getString('reason') || 'No Reason Provided';

            for (const id of ids) {
                guild.members.ban(id, { reason }).catch(() => {});
            }

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: ids,
                moderatorId: interaction.user.id,
                action: "MassBan",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Mass Ban")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${ids.length}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const massbanembed = new EmbedBuilder()
            .setTitle("Mass Ban")
            .setColor("Green")
            .addFields(
                { name: "Users", value: `${ids.length}` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            return interaction.reply({ embeds: [massbanembed] });
        }
    }
};
