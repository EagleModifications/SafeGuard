const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BotStatusChannel = require('../../models/botStatusChannel');
const os = require('os');
const mongoose = require('mongoose');
const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstatuschannelset')
        .setDescription('Set the channel where the bot status embed will be posted.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to post the bot status')
                .setRequired(true)
        ),

    async execute(interaction, client, statusMessages) {
        const channel = interaction.options.getChannel('channel');

        await BotStatusChannel.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { channelId: channel.id },
            { upsert: true }
        );

        // Send/update the embed immediately
        let msg = statusMessages.get(interaction.guild.id);

        const ping = client.ws.ping;
        const totalSeconds = Math.floor(client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = totalSeconds % 60;
        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const memory = process.memoryUsage().rss / 1024 / 1024;
        const cpuLoad = os.loadavg()[0].toFixed(2);
        const serverCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

        const mongoStatus = mongoose.connection.readyState === 1 ? '✅ Online' : '❌ Offline';
        const discordStatus = client.ws.status === 0 ? '✅ Online' : '⚠️ Issues';

        // Color coding
        let color = 0x00ff00; // green
        if (mongoStatus === '❌ Offline' || discordStatus !== '✅ Online') color = 0xffa500; // orange
        if (mongoStatus === '❌ Offline' && discordStatus !== '✅ Online') color = 0xff0000; // red

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('🤖 Bot Status')
            .addFields(
                { name: '📡 Discord Ping', value: `${ping}ms`, inline: true },
                { name: '⏱️ Uptime', value: uptimeString, inline: true },
                { name: '💾 Memory Usage', value: `${memory.toFixed(2)} MB`, inline: true },
                { name: '🖥️ CPU Load', value: cpuLoad, inline: true },
                { name: '🌐 Servers', value: `${serverCount}`, inline: true },
                { name: '👥 Users', value: `${userCount}`, inline: true },
                { name: '🗄️ Database', value: mongoStatus, inline: true },
                { name: '🔗 Discord API', value: discordStatus, inline: true }
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: 'Status updates every minute' });

        if (!msg) {
            msg = await channel.send({ embeds: [embed] });
            statusMessages.set(interaction.guild.id, msg);
        } else {
            msg.edit({ embeds: [embed] }).catch(console.error);
        }

        interaction.reply({ content: `✅ Bot status channel set to ${channel}`, ephemeral: true });
    }
};
