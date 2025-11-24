const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show help about command categories.')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select a command category')
                .addChoices(
                    { name: 'Moderation', value: 'moderation' },
                    { name: 'Utility', value: 'utility' },
                    { name: 'Fun', value: 'fun' },
                    { name: 'All Commands', value: 'all' },
                )
        ),

    async execute(interaction) {
        const category = interaction.options.getString('category') || 'all';

        // ---- CATEGORIES ---- //
        const categories = {
            moderation: [
                "**/global** — `/global ban` `/global banview` `/global unban` `/global kick` `/global kickview` `/global mute` `/global muteview` `/global unmute` `/global blacklist` `/global blacklistview` `/global unblacklist`",
                "**/moderation** — `/moderation ban` `/moderation unban` `/moderation kick` `/moderation softban` `/moderation mute` `/moderation hardmute` `/moderation unmute` `/moderation timeout` `/moderation removetimeout` `/moderation tempban` `/moderation massban`",
                "**/warnings** — `/warnings view` `/warnings remove` `/warnings clear`",
                "**/role** — `/role assign` `/role unassign` `/role temp`",
                "`/warn` — Warn a user.",
                "`/modhistory` — Check a user's moderation history.",
                "`/setmodlogs` — Setup the moderation log channel.",
                "`/setmuterole` — Set the mute role for this server.",
                "`/botstatuschannelset` - Set the channel where the bot status embed will be posted."
            ],
            ticket: [
                "**/ticket** — `/ticket claim` `/ticket unclaim` `/ticket close` `/ticket panel create` `/ticket panel send` `/ticket panel list` `/ticket panel delete` `/ticket panel edit`",
                "`/tickets` — `/tickets add` `/tickets remove` `/tickets rename` `/tickets blacklist` `/tickets blacklistview` `/tickets unblacklist`",
            ],
            utility: [
                "`/ping` — Check bot latency",
                "`/serverinfo` — Info about the server",
                "`botstats` - Shows the bot status and statistics."
            ]
        };

        // Build dynamic embed
        const embed = new EmbedBuilder()
            .setColor("Blue")
            .setTitle('📘 Help Menu')
            .setThumbnail(config.Thumbnail)
            .setTimestamp();

        if (category === 'all') {
            embed.setDescription('Here are all available command categories:');

            for (const [name, cmds] of Object.entries(categories)) {
                embed.addFields({ name: name.toUpperCase(), value: cmds.join('\n') });
            }
        } else {
            embed.setTitle(`📘 Help: ${category.toUpperCase()}`);
            embed.setDescription('Here are the commands in this category:');
            embed.addFields({
                name: category.toUpperCase(),
                value: categories[category].join('\n')
            });
        }

        await interaction.reply({ embeds: [embed] });
    }
};