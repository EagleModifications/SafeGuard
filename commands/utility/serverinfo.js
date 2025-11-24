const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Get info about this server"),
    async execute(interaction) {
        const guild = interaction.guild;

        const embed = new EmbedBuilder()
            .setTitle(`${guild.name} Info`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: "Server ID", value: guild.id, inline: true },
                { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
                { name: "Member Count", value: `${guild.memberCount}`, inline: true },
                { name: "Boost Tier", value: `${guild.premiumTier}`, inline: true },
                { name: "Boost Count", value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
                { name: "Creation Date", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            )
            .setColor("Green")
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
