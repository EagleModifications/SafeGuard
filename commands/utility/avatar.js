// avatar.js
const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Get the avatar of a user with download options')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want the avatar of')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;

        // Default URLs
        const png = user.displayAvatarURL({ extension: 'png', size: 1024 });
        const jpg = user.displayAvatarURL({ extension: 'jpg', size: 1024 });
        const webp = user.displayAvatarURL({ extension: 'webp', size: 1024 });

        // Only generate GIF button if avatar is animated
        const isGif = user.displayAvatarURL({ dynamic: true }).endsWith('.gif');
        const gif = isGif
            ? user.displayAvatarURL({ extension: 'gif', size: 1024 })
            : null;

        // Create buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('PNG')
                .setStyle(ButtonStyle.Link)
                .setURL(png),

            new ButtonBuilder()
                .setLabel('JPG')
                .setStyle(ButtonStyle.Link)
                .setURL(jpg),

            new ButtonBuilder()
                .setLabel('WEBP')
                .setStyle(ButtonStyle.Link)
                .setURL(webp),
        );

        // Add GIF button separately if animated
        if (gif) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('GIF')
                    .setStyle(ButtonStyle.Link)
                    .setURL(gif)
            );
        }

        await interaction.reply({
            content: `### 🖼️ Avatar for **${user.username}**`,
            files: [{ attachment: png, name: `${user.username}_avatar.png` }],
            components: [row]
        });
    }
};
