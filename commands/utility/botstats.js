const { SlashCommandBuilder, EmbedBuilder, version } = require('discord.js');
const os = require('os');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botstats')
        .setDescription('Shows the bot status and statistics.'),

    async execute(interaction) {
        const client = interaction.client;

        // Ping
        const ping = client.ws.ping;

        // Uptime
        const totalSeconds = Math.floor(client.uptime / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor(totalSeconds / 3600) % 24;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const seconds = totalSeconds % 60;

        const uptimeString =
            `${days}d ${hours}h ${minutes}m ${seconds}s`;

        // Memory usage
        const memory = process.memoryUsage().rss / 1024 / 1024; // MB

        // CPU usage
        const cpuLoad = os.loadavg()[0].toFixed(2);

        // Stats
        const serverCount = client.guilds.cache.size;
        const userCount = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

        const embed = new EmbedBuilder()
            .setColor('Random')
            .setTitle('🤖 Bot Stats')
            .addFields(
                { name: '📡 Ping', value: `${ping}ms`, inline: true },
                { name: '⏱️ Uptime', value: uptimeString, inline: true },
                { name: '💾 Memory Usage', value: `${memory.toFixed(2)} MB`, inline: true },

                { name: '🖥️ CPU Load', value: `${cpuLoad}`, inline: true },
                { name: '🌐 Servers', value: `${serverCount}`, inline: true },
                { name: '👥 Users', value: `${userCount}`, inline: true },

                { name: '⚙️ Node.js', value: process.version, inline: true },
                { name: '📚 discord.js', value: version, inline: true }
            )
            .setTimestamp();

        interaction.reply({ embeds: [embed] });
    }
};