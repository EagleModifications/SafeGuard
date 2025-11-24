const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, PermissionsBitField } = require("discord.js");
const Global = require('../../models/Global');
const ModLog = require('../../models/ModLog');
const GuildConfig = require("../../models/GuildConfig");

const config = require("../../config.json");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manages users roles.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

        // ASSIGN SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("assign")
                .setDescription("Assign a role to a user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to assign role to.")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName("role")
                    .setDescription("Role to assign.")
                    .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for assigning role.")
                    .setRequired(false)
                )
        )

        // UNASSIGN SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("unassign")
                .setDescription("Unassign a role from a user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to assign role to.")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName("role")
                    .setDescription("Role to assign.")
                    .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for assigning role.")
                    .setRequired(false)
                )
        )

        // TEMPROLE SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("temp")
                .setDescription("Temporarily give a user a role.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to assign role to.")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName("role")
                    .setDescription("Role to assign.")
                    .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName("duration")
                    .setDescription("Duration (e.g., 10m, 2h)")
                    .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for assigning role.")
                    .setRequired(false)
                )
        ),

    async execute(interaction) {
        const permsembed = new EmbedBuilder()
        .setTitle("Missing Permissions")
        .setDescription("You don't have permission to use this command.")
        .setColor("Red")
        .setTimestamp()
        .setThumbnail(config.Thumbnail)
        .setFooter({ text: `Requested By: ${interaction.user.tag}` })

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
            return interaction.reply({ embeds: [permsembed] });

        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");

        //--------------------------------------------------------------------
        // GLOBALBAN
        //--------------------------------------------------------------------
        if (sub === "assign") {
            const user = interaction.options.getUser("user");
            const role = interaction.options.getRole("role");
            const reason = interaction.options.getString("reason") || "No Reason Provided";

            const botMember = await interaction.guild.members.fetchMe();

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            const usernotinserverembed = new EmbedBuilder()
            .setTitle("Role Assign")
            .setDescription("❌ That user is not in the server.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!member) 
                return interaction.reply({ embeds: [usernotinserverembed] });

            const noassignembed = new EmbedBuilder()
            .setTitle("Role Assign")
            .setDescription("❌ I cannot assign a role higher than or equal to my highest role.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (role.position >= botMember.roles.highest.position)
                return interaction.reply({ embeds: [noassignembed] });

            const noassignembed2 = new EmbedBuilder()
            .setTitle("Role Assign")
            .setDescription("❌ You cannot assign a role higher than your highest role.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (role.position >= interaction.member.roles.highest.position)
                return interaction.reply({ embeds: [noassignembed2] });

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "AssignRole",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Role Assign")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Role", value: `${role}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            try {
                await member.roles.add(role, `Assigned by ${interaction.user.tag}: ${reason}`);
                const successembed = new EmbedBuilder()
                .setTitle("Role Assign")
                .setColor("Green")
                .addFields(
                    { name: "User", value: `${member}` },
                    { name: "Role", value: `${role}` },
                    { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                    { name: "Moderator", value: `${interaction.user}` },
                )
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                interaction.reply({ embeds: [successembed] });
            } catch (err) {
                const failedembed = new EmbedBuilder()
                .setTitle("Role Assign")
                .setDescription("❌ Failed to assign the role.")
                .setColor("Red")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                console.error(err);
                interaction.reply({ embeds: [failedembed] });
            }
        }

        //--------------------------------------------------------------------
        // UNASSIGN
        //--------------------------------------------------------------------
        if (sub === "unassign") {
            const user = interaction.options.getUser("user");
            const role = interaction.options.getRole("role");
            const reason = interaction.options.getString("reason") || "No Reason Provided";

            const botMember = await interaction.guild.members.fetchMe();

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            const usernotinserverembed = new EmbedBuilder()
            .setTitle("Role Unassign")
            .setDescription("❌ That user is not in the server.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!member) 
                return interaction.reply({ embeds: [usernotinserverembed] });

            const noassignembed = new EmbedBuilder()
            .setTitle("Role Unassign")
            .setDescription("❌ I cannot remove a role higher than or equal to my highest role.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (role.position >= botMember.roles.highest.position)
                return interaction.reply({ embeds: [noassignembed] });

            const noassignembed2 = new EmbedBuilder()
            .setTitle("Role Assign")
            .setDescription("❌ You cannot remove a role higher than your highest role.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (role.position >= interaction.member.roles.highest.position)
                return interaction.reply({ embeds: [noassignembed2] });

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "UnassignRole",
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Role Unassign")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Role", value: `${role}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }
            
            try {
                await member.roles.remove(role, `Removed by ${interaction.user.tag}: ${reason}`);
                const successembed = new EmbedBuilder()
                .setTitle("Role Assign")
                .setColor("Green")
                .addFields(
                    { name: "User", value: `${member}` },
                    { name: "Role", value: `${role}` },
                    { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                    { name: "Moderator", value: `${interaction.user}` },
                )
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                interaction.reply({ embeds: [successembed] });
            } catch (err) {
                const failedembed = new EmbedBuilder()
                .setTitle("Role Assign")
                .setDescription("❌ Failed to assign the role.")
                .setColor("Red")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                console.error(err);
                interaction.reply({ embeds: [failedembed] });
            }
        }

        //--------------------------------------------------------------------
        // TEMPROLE
        //--------------------------------------------------------------------
        if (sub === "temp") {
            const user = interaction.options.getUser('user');
            const role = interaction.options.getRole('role');
            const durationStr = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason') || 'No Reason Provided';

            // Convert duration string to milliseconds
            const duration = parseDuration(durationStr);
            const invaliddurationembed = new EmbedBuilder()
            .setTitle("Role Temprole")
            .setDescription("❌ Invalid duration format. Example: 10m, 2h, 1d")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!duration) {
                return interaction.reply({ embeds: [invaliddurationembed] });
            }

            const member = await interaction.guild.members.fetch(user.id).catch(() => null);
            const usernotinserverembed = new EmbedBuilder()
            .setTitle("Role Temprole")
            .setDescription("❌ User not found in the server.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!member) return interaction.reply({ embeds: [usernotinserverembed] });

            const botMember = await interaction.guild.members.fetchMe();

            const cannotassignembed = new EmbedBuilder()
            .setTitle("Role Temprole")
            .setDescription("❌ I cannot assign a role higher than or equal to my highest role.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (role.position >= botMember.roles.highest.position)
                return interaction.reply({ embeds: [cannotassignembed] });

            const cannotassignembed2 = new EmbedBuilder()
            .setTitle("Role Temprole")
            .setDescription("❌ You cannot assign a role higher than your highest role.")
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (role.position >= interaction.member.roles.highest.position)
                return interaction.reply({ embeds: [cannotassignembed2] });

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "TemproleAdd",
                duration: durationStr,
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Role Temprole")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Role", value: `${role}` },
                        { name: "Duration", value: `\`${durationStr}\`` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            try {
                await member.roles.add(role, `Temporary role by ${interaction.user.tag}: ${reason}`);
                const successembed = new EmbedBuilder()
                .setTitle("Role Temprole")
                .setColor("Green")
                .addFields(
                    { name: "User", value: `${member}` },
                    { name: "Role", value: `${role}` },
                    { name: "Duration", value: `\`${durationStr}\`` },
                    { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                    { name: "Moderator", value: `${interaction.user}` },
                )
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                interaction.reply({ embeds: [successembed]});

                // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: member.id,
                moderatorId: interaction.user.id,
                action: "TemproleAdd",
                duration: durationStr,
                reason: reason
            });
            await log.save();

            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Role Temprole Expired")
                    .setColor("Red")
                    .addFields(
                        { name: "User", value: `${member}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

                // Schedule removal
                setTimeout(async () => {
                    try {
                        const refreshedMember = await interaction.guild.members.fetch(user.id).catch(() => null);
                        if (refreshedMember && refreshedMember.roles.cache.has(role.id)) {
                            const expiredembed = new EmbedBuilder()
                            .setTitle("Role Temprole Expired")
                            .setColor("Red")
                            .addFields(
                                { name: "User", value: `${member}` },
                                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                                { name: "Guild", value: `**${interaction.guild.name}**` },
                                { name: "Moderator", value: `${interaction.user}` },
                            )
                            .setTimestamp()
                            .setThumbnail(config.Thumbnail)
                            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                            await user.send({ embeds: [expiredembed] }).catch(() => {});
                        }
                    } catch (err) {
                        console.error(`Failed to remove temporary role from ${user.tag}:`, err);
                    }
                }, duration);
            
            } catch (err) {
                console.error(err);
                const errorembed = new EmbedBuilder()
                .setTitle("Role Temprole")
                .setDescription("❌ Failed to assign the temporary role.")
                .setColor("Red")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                interaction.reply({ embeds: [errorembed] });
            }

            function parseDuration(str) {
                const match = str.match(/^(\d+)(s|m|h|d)$/);
                if (!match) return null;
                const value = parseInt(match[1]);
                const unit = match[2];

                switch (unit) {
                    case 's': return value * 1000;
                    case 'm': return value * 60 * 1000;
                    case 'h': return value * 60 * 60 * 1000;
                    case 'd': return value * 24 * 60 * 60 * 1000;
                    default: return null;
                }
            }
        }
    }
};