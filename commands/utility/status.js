const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const si = require('systeminformation');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Displays the bot status and stats'),

    async execute(interaction, client) {
        await interaction.deferReply();

        // Create a status message
        const statusMessage = await interaction.editReply({
            embeds: [await generateStatusEmbed(client)],
        });

        // Update the embed every minute
        const interval = setInterval(async () => {
            try {
                if (!client.isReady()) throw new Error('Bot is offline');
                await statusMessage.edit({ embeds: [await generateStatusEmbed(client)] });
            } catch (error) {
                // If bot has issues, show error
                const errorEmbed = new EmbedBuilder()
                    .setTitle('⚠️ Bot Status')
                    .setDescription(`The bot is currently having issues:\n\`${error.message}\``)
                    .setColor(0xff0000)
                    .setTimestamp();

                await statusMessage.edit({ embeds: [errorEmbed] });
            }
        }, 60 * 1000); // 1 minute interval
    },
};

// Function to generate status embed
async function generateStatusEmbed(client) {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const uptime = process.uptime();

    const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Status')
        .setColor(0x00ff00)
        .addFields(
            { name: 'Bot Uptime', value: `${formatUptime(uptime)}`, inline: true },
            { name: 'CPU Usage', value: `${cpu.currentLoad.toFixed(2)}%`, inline: true },
            { name: 'RAM Usage', value: `${((mem.active / mem.total) * 100).toFixed(2)}%`, inline: true },
            { name: 'Status', value: 'Online ✅', inline: true }
        )
        .setTimestamp();
    return embed;
}

// Helper to format uptime
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}h ${m}m ${s}s`;
}
