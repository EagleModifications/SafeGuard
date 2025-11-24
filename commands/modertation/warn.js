const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const Warnings = require("../../models/warnings");
const ModLog = require("../../models/ModLog");
const GuildConfig = require("../../models/GuildConfig");

const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option.setName("user")
                .setDescription("User to warn")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the warning")
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.member.permissions.has('ModerateMembers'))
            return interaction.reply({ content: 'You do not have permission to warn members!', ephemeral: true });
        
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "No Reason Provided";

        let data = await Warnings.findOne({
            userId: user.id,
            guildId: interaction.guild.id
        });

        if (!data) {
            data = new Warnings({
                userId: user.id,
                guildId: interaction.guild.id,
                warnings: []
            });
        }

        data.warnings.push({
            reason,
            moderator: interaction.user.id
        });

        await data.save();

        const warnembed = new EmbedBuilder()
        .setTitle("Warning")
        .setColor("Green")
        .addFields(
            { name: "User", value: `${user}` },
            { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
            { name: "Total Warnings", value: `**${data.warnings.length}**` },
            { name: "Moderator", value: `${interaction.user}` },
        )
        .setTimestamp()
        .setThumbnail(config.Thumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}` })

        interaction.reply({ embeds: [warnembed] });

        // Save to DB
        const log = new ModLog({
            guildId: interaction.guild.id,
            userId: user.id,
            moderatorId: interaction.user.id,
            action: "Warning",
            reason: reason
        });
        await log.save();

        // Send modlog if set
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.modLogChannelId) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
            if (logChannel) {
                const banlog = new EmbedBuilder()
                .setTitle("Warning")
                .setColor("Green")
                .addFields(
                    { name: "User", value: `${user}` },
                    { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                    { name: "Total Warnings", value: `**${data.warnings.length}**` },
                    { name: "Moderator", value: `${interaction.user}` }
                )
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                logChannel.send({ embeds: [banlog] });
              }
            }
    }
};
