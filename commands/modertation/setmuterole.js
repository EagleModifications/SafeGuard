const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const MuteRole = require('../../models/muteRole');
const ModLog = require('../../models/ModLog');
const GuildConfig = require("../../models/GuildConfig");

const config = require("../../config.json");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setmuterole')
        .setDescription('Set the mute role for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to use for mutes.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const permsembed = new EmbedBuilder()
        .setTitle("Missing Permissions")
        .setDescription("You don't have permission to use this command.")
        .setColor("Red")
        .setTimestamp()
        .setThumbnail(config.Thumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}` })
        
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
            return interaction.reply({ embeds: [permsembed] });

        const role = interaction.options.getRole('role');

        await MuteRole.findOneAndUpdate(
            { guildId: interaction.guild.id },
            { roleId: role.id },
            { upsert: true }
        );

        // Save to DB
        const log = new ModLog({
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            moderatorId: interaction.user.id,
            action: "SetMuteRole",
        });
        await log.save();

        // Send modlog if set
        const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
        if (guildConfig && guildConfig.modLogChannelId) {
            const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
            if (logChannel) {
                const banlog = new EmbedBuilder()
                .setTitle("Set Mute Role")
                .setColor("Green")
                .addFields(
                    { name: "Role", value: `${role}` },
                    { name: "Moderator", value: `${interaction.user}` },
                )
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                logChannel.send({ embeds: [banlog] });
            }
        }

        const mutesetembed = new EmbedBuilder()
        .setTitle("Set Mute Role")
        .setColor("Green")
        .addFields(
            { name: "Role", value: `${role}` },
        )
        .setTimestamp()
        .setThumbnail(config.Thumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}` })
        
        interaction.reply({ embeds: [mutesetembed] });
    }
};
