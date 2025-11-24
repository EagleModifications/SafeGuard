const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Get info about a user")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to get info about")
                .setRequired(false)
        ),
    async execute(interaction) {
        const user = interaction.options.getUser("user") || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);

        const embed = new EmbedBuilder()
            .setTitle(`${user.tag}'s Info`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: "User ID", value: user.id, inline: true },
                { name: "Bot?", value: user.bot ? "Yes" : "No", inline: true },
                { name: "Joined Server", value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "N/A", inline: true },
                { name: "Account Created", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
            )
            .setColor("Blue")
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
