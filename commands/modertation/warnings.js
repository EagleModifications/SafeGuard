const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const Warnings = require("../../models/warnings");

const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("Manage user warnings")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        // VIEW SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("view")
                .setDescription("View a user's warnings.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to view")
                        .setRequired(true)
                )
        )

        // REMOVE WARNING SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("remove")
                .setDescription("Remove a specific warning from a user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to modify")
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName("id")
                        .setDescription("Warning ID number (1, 2, 3...)")
                        .setRequired(true)
                )
        )

        // CLEAR ALL WARNINGS SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("clear")
                .setDescription("Clear all warnings from a user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to clear")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");

        let data = await Warnings.findOne({
            userId: user.id,
            guildId: interaction.guild.id
        });

        //--------------------------------------------------------------------
        // VIEW
        //--------------------------------------------------------------------
        if (sub === "view") {
            const viewembed = new EmbedBuilder()
            .setTitle("Warnings")
            .setDescription(`${user} Does not have any warnings.`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!data || data.warnings.length === 0)
                return interaction.reply({ embeds: [viewembed] });

            const list = data.warnings
                .map((warn, i) =>
                    `**${i + 1}.** ${warn.reason} — <@${warn.moderator}> (${warn.date.toLocaleString()})`
                )
                .join("\n");
                
            const listembed = new EmbedBuilder()
            .setTitle("Warnings")
            .setDescription(`Warnings for ${user}`)
            .setColor("Green")
            .addFields(
                { name: "Warnings", value: `${list}`}
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            
            return interaction.reply({ embeds: [listembed]});
        }

        //--------------------------------------------------------------------
        // REMOVE
        //--------------------------------------------------------------------
        if (sub === "remove") {
            const id = interaction.options.getInteger("id");

            const invalidIDembed = new EmbedBuilder()
            .setTitle("Warnings")
            .setDescription("❌ Invalid warning ID.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            if (!data || !data.warnings[id - 1])
                return interaction.reply({ embeds: [invalidIDembed]});

            data.warnings.splice(id - 1, 1);
            await data.save();

            const removeembed = new EmbedBuilder()
            .setTitle("Warnings")
            .setDescription("🗑️ Removed warning")
            .addFields(
                { name: "User", value: `${user}` },
                { name: "Warning Removed", value: `#${id}` }
            )
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [removeembed]});
        }

        //--------------------------------------------------------------------
        // CLEAR
        //--------------------------------------------------------------------
        if (sub === "clear") {
            const clearnoneembed = new EmbedBuilder()
            .setTitle("Warnings")
            .setDescription(`❌ ${user} has no warnings to clear.`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            
            if (!data || data.warnings.length === 0)
                return interaction.reply({embeds: [clearnoneembed]});

            await Warnings.deleteOne({
                userId: user.id,
                guildId: interaction.guild.id
            });

            const clearembed = new EmbedBuilder()
            .setTitle("Warnings")
            .setDescription(`🧹 Cleared all warnings from ${user}`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            return interaction.reply({ embeds: [clearembed] });
        }
    }
};
