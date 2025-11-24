// commands/lockdown.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LockdownSetup = require('../../models/LockdownSetup');
const ModLog = require('../../models/ModLog');
const GuildConfig = require("../../models/GuildConfig");
const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Lockdown commands')
        // Main lockdown commands
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Lock a channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to lockdown'))
                .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h)'))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for lockdown')))
        .addSubcommand(sub =>
            sub.setName('server')
                .setDescription('Lock the entire server')
                .addStringOption(opt => opt.setName('duration').setDescription('Duration (e.g. 10m, 1h)'))
                .addStringOption(opt => opt.setName('reason').setDescription('Reason for lockdown')))
        // Setup subcommand group
        .addSubcommandGroup(group =>
            group.setName('setup')
            .setDescription('Configure roles allowed to use lockdown commands')
            .addSubcommand(sub =>
                sub.setName('view')
                .setDescription('View currently set lockdown roles')
                .addStringOption(opt => opt.setName('type').setDescription('Channel or Server').setRequired(true).addChoices(
                    { name: 'Channel', value: 'channel' },
                    { name: 'Server', value: 'server' }
                )))
                .addSubcommand(sub =>
                    sub.setName('edit')
                    .setDescription('Edit roles allowed to use lockdown commands')
                    .addStringOption(opt => opt.setName('type').setDescription('Channel or Server').setRequired(true).addChoices(
                        { name: 'Channel', value: 'channel' },
                        { name: 'Server', value: 'server' }
                    ))
                    .addRoleOption(opt => opt.setName('role1').setDescription('Role 1'))
                    .addRoleOption(opt => opt.setName('role2').setDescription('Role 2')))
                ),

                async execute(interaction) {
                    const subGroup = interaction.options.getSubcommandGroup(false);
                    const sub = interaction.options.getSubcommand();

                    // If the user is using the setup subcommand group
                    if (subGroup === 'setup') {
                        const type = interaction.options.getString('type'); // 'channel' or 'server'
                        let setup = await LockdownSetup.findOne({ guildId: interaction.guild.id });
                        if (!setup) setup = new LockdownSetup({ guildId: interaction.guild.id });

                        const currentRoles = type === 'channel' ? setup.channelRoles : setup.serverRoles;
                        const currentRolesDisplay = currentRoles?.length ? currentRoles.map(id => `<@&${id}>`).join(' or ') : "None";

                        if (sub === 'view') {
                            return interaction.reply({
                                content: `ℹ️ Current ${type} lockdown roles: ${currentRolesDisplay}`,
                                ephemeral: true
                            });
                        }

                        if (sub === 'edit') {
                            const role1 = interaction.options.getRole('role1');
                            const role2 = interaction.options.getRole('role2');
                            const newRoles = [];
                            if (role1) newRoles.push(role1.id);
                            if (role2) newRoles.push(role2.id);

                            if (currentRoles?.length && !role1 && !role2) {
                                // Roles are already set, but no new roles given
                                return interaction.reply({
                                    content: `⚠️ ${type} lockdown roles are already set: ${currentRolesDisplay}\nRun \`/lockdown setup edit ${type}\` with new roles to change them.`,
                                    ephemeral: true
                                });
                            }

                            // Update roles
                            if (type === 'channel') setup.channelRoles = newRoles;
                            if (type === 'server') setup.serverRoles = newRoles;
                            await setup.save();

                            return interaction.reply({
                                content: `✅ ${type} lockdown roles have been set/updated successfully!\nRoles: ${newRoles.map(id => `<@&${id}>`).join(' or ')}`,
                                ephemeral: true
                            });
                        }
                    }

                    // Otherwise, handle normal lockdown commands
                    const guild = interaction.guild;
                    const channel = interaction.options.getChannel('channel') || interaction.channel;
                    const duration = interaction.options.getString('duration') || 'No Duration Provided';
                    const reason = interaction.options.getString('reason') || 'No Reason Provided';


                    // Check permissions based on MongoDB
                    // Check permissions based on MongoDB
                    // Check permissions based on MongoDB
                    const setup = await LockdownSetup.findOne({ guildId: guild.id });
                    const memberRoles = interaction.member.roles.cache.map(r => r.id);
                    let allowedRoles = sub === 'channel' ? setup?.channelRoles : setup?.serverRoles;
                    const channelrolesToPing = setup.channelRoles.map(id => `<@&${id}>`).join(' or ');
                    const serverrolesToPing = setup.serverRoles.map(id => `<@&${id}>`).join(' or ');

                    if (sub === 'channel') {
                        const nopermsembed = new EmbedBuilder()
                        .setTitle("❌ Missing permissions")
                        .setDescription(`You don't have permission to use this command.`)
                        .addFields({ name: "Roles Needed", value: `${channelrolesToPing}`, inline: true})
                        .setColor("Red")
                        .setTimestamp()
                        .setThumbnail(config.Thumbnail)
                        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                        if (!allowedRoles || !memberRoles.some(r => allowedRoles.includes(r))) {
                            return interaction.reply({ embeds: [nopermsembed] });
                        }

                        const alreadyembed = new EmbedBuilder()
                        .setTitle("🔒 Already Locked")
                        .setDescription(`❌ **${channel.name}** is already locked!`)
                        .setColor("Red")
                        .setTimestamp()
                        .setThumbnail(config.Thumbnail)
                        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                        if (isChannelLocked(channel)) {
                            return interaction.reply({ embeds: [alreadyembed] });
                        }

                        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });

                        // Save to DB
                        const log = new ModLog({
                            guildId: interaction.guild.id,
                            moderatorId: interaction.user.id,
                            action: "LockdownChannel",
                            reason: reason
                        });
                        await log.save();

                        // Send modlog if set
                        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
                        if (guildConfig && guildConfig.modLogChannelId) {
                            const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                            if (logChannel) {
                                const banlog = new EmbedBuilder()
                                .setTitle("🔒 Channel Lockdown")
                                .setColor("Green")
                                .addFields(
                                    { name: "Channel", value: `${channel}`, inline: true},
                                    { name: "Duration", value: `\`${duration}\``, inline: true },
                                    { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                                    { name: "Moderator", value: `${interaction.user}`, inline: false },
                                )
                                .setTimestamp()
                                .setThumbnail(config.Thumbnail)
                                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });
                                logChannel.send({ embeds: [banlog] });
                            }
                        }

                        const channellockembed = new EmbedBuilder()
                        .setTitle("🔒 Channel Lockdown")
                        .setDescription(`✅ Locked down **${channel.name}**`)
                        .setColor("Green")
                        .setTimestamp()
                        .setThumbnail(config.Thumbnail)
                        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                        interaction.reply({ embeds: [channellockembed] });
                    } else if (sub === 'server') {
                        const nopermsembed = new EmbedBuilder()
                        .setTitle("❌ Missing permissions")
                        .setDescription(`You don't have permission to use this command.`)
                        .addFields({ name: "Roles Needed", value: `${serverrolesToPing}`, inline: true})
                        .setColor("Red")
                        .setTimestamp()
                        .setThumbnail(config.Thumbnail)
                        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                        if (!allowedRoles || !memberRoles.some(r => allowedRoles.includes(r))) {
                            return interaction.reply({ embeds: [nopermsembed] });
                        }

                        const guild = interaction.guild;

                        const lockedChannels = guild.channels.cache.filter(ch => 
                            (ch.isTextBased() || ch.isVoiceBased()) && isChannelLocked(ch)
                        );

                        const alreadyembed = new EmbedBuilder()
                        .setTitle("🔒 Already Locked")
                        .setDescription(`❌ The server is already locked!`)
                        .setColor("Red")
                        .setTimestamp()
                        .setThumbnail(config.Thumbnail)
                        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

                        if (lockedChannels.size > 0) {
                            return interaction.reply({ embeds: [alreadyembed] });
                        }

                        guild.channels.cache.forEach(ch => {
                            if (ch.isTextBased()) {
                                ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
                            }
                        });

                        // Save to DB
                        const log = new ModLog({
                            guildId: interaction.guild.id,
                            moderatorId: interaction.user.id,
                            action: "LockdownServer",
                            reason: reason
                        });
                        await log.save();

                        // Send modlog if set
                        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
                        if (guildConfig && guildConfig.modLogChannelId) {
                            const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                            if (logChannel) {
                                const banlog = new EmbedBuilder()
                                .setTitle("🔒 Server Lockdown")
                                .setColor("Green")
                                .addFields(
                                    { name: "Duration", value: `\`${duration}\``, inline: true },
                                    { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                                    { name: "Moderator", value: `${interaction.user}`, inline: false },
                                )
                                .setTimestamp()
                                .setThumbnail(config.Thumbnail)
                                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });
                                logChannel.send({ embeds: [banlog] });
                            }
                        }

                        const serverlockembed = new EmbedBuilder()
                        .setTitle("🔒 Server Lockdown")
                        .setDescription(`✅ Locked down the server`)
                        .setColor("Green")
                        .setTimestamp()
                        .setThumbnail(config.Thumbnail)
                        .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                        interaction.reply({ embeds: [serverlockembed] });
                    }

                    // Handle automatic unlock if duration is set
                    if (duration) {
                        const ms = parseDuration(duration);
                        if (ms) {
                            setTimeout(async () => {
                                if (sub === 'channel') await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
                                else guild.channels.cache.forEach(ch => { if (ch.isTextBased()) ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }); });
                            }, ms);
                        }
                    }
                }
};

function parseDuration(duration) {
    const match = duration.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    const n = parseInt(match[1]);
    switch (match[2]) {
        case 's': return n * 1000;
        case 'm': return n * 60 * 1000;
        case 'h': return n * 60 * 60 * 1000;
        case 'd': return n * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function isChannelLocked(channel) {
    const everyonePerm = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
    if (!everyonePerm) return false; // no overwrite → not locked
    if (channel.isTextBased()) return everyonePerm.deny.has('SendMessages');
    if (channel.isVoiceBased()) return everyonePerm.deny.has('Connect');    return false;
}