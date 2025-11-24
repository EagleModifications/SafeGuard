const { EmbedBuilder, version } = require('discord.js');
const os = require('os');
const mongoose = require('mongoose');
const BotStatusChannel = require('../models/botStatusChannel');

module.exports = async (client) => {
    const statusMessages = new Map(); // store status messages per guild

    const updateStatus = async () => {
        for (const guild of client.guilds.cache.values()) {
            const channelData = await BotStatusChannel.findOne({ guildId: guild.id });
            if (!channelData) continue;

            const channel = guild.channels.cache.get(channelData.channelId);
            if (!channel || !channel.isTextBased()) continue;

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
                .setFooter({ text: 'Status updates every minute' });

            let msg = statusMessages.get(guild.id);
            if (!msg) {
                msg = await channel.send({ embeds: [embed] }).catch(console.error);
                statusMessages.set(guild.id, msg);
            } else {
                msg.edit({ embeds: [embed] }).catch(console.error);
            }
        }
    };

    updateStatus();
    setInterval(updateStatus, 60 * 1000);

    return statusMessages; // return the map so /botstatuschannelset can use it
};
