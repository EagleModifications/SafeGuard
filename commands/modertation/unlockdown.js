// commands/unlockdown.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const LockdownSetup = require('../../models/LockdownSetup');
const ModLog = require('../../models/ModLog');
const GuildConfig = require("../../models/GuildConfig");
const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unlockdown')
        .setDescription('Unlockdown commands')
        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Unlock a channel')
                .addChannelOption(opt => opt.setName('channel').setDescription('Channel to unlock')))
        .addSubcommand(sub =>
            sub.setName('server')
                .setDescription('Unlock the server')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const channel = interaction.options.getChannel('channel') || interaction.channel;

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

            const notlocked = new EmbedBuilder()
            .setTitle("🔓 Not Locked")
            .setDescription(`❌ **${channel.name}** is not locked!`)
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            if (!isChannelLocked(channel)) {
                return interaction.reply({ embeds: [notlocked] });
            }

            await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                action: "UnlockdownChannel",
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("🔓 Channel Unlocked")
                    .setColor("Red")
                    .addFields(
                        { name: "Channel", value: `${channel}`, inline: true},
                        { name: "Moderator", value: `${interaction.user}`, inline: true },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });
                    logChannel.send({ embeds: [banlog] });
                }
            }
            
            const channelunlockembed = new EmbedBuilder()
            .setTitle("🔓 Channel Unlocked")
            .setDescription(`✅ Unlocked **${channel.name}**`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
            interaction.reply({ embeds: [channelunlockembed] });
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

            const notlocked = new EmbedBuilder()
            .setTitle("🔓 Not Locked")
            .setDescription(`❌ The server is not locked!`)
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            if (lockedChannels.size === 0) {
                return interaction.reply({ embeds: [notlocked] });
            }
            guild.channels.cache.forEach(ch => {
                if (ch.isTextBased()) {
                    ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
                }
            });

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                action: "UnlockdownServer",
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("🔓 Server Unlocked")
                    .setColor("Red")
                    .addFields(
                        { name: "Moderator", value: `${interaction.user}`, inline: false },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });
                    logChannel.send({ embeds: [banlog] });
                }
            }
            
            const serverunlockembed = new EmbedBuilder()
            .setTitle("🔓 Server Unlocked")
            .setDescription(`✅ Unlocked the server`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
            interaction.reply({ embeds: [serverunlockembed] });
        }
    }
};

function isChannelLocked(channel) {
    const everyonePerm = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
    if (!everyonePerm) return false; // no overwrite → not locked
    if (channel.isTextBased()) return everyonePerm.deny.has('SendMessages');
    if (channel.isVoiceBased()) return everyonePerm.deny.has('Connect');
    return false;
}
