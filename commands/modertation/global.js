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
        .setName("global")
        .setDescription("Global Moderation System")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)

        // GLOBALBAN SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("ban")
                .setDescription("Bans a user from all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to ban")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for ban")
                    .setRequired(false)
                )
        )

        // GLOBALBANVIEW SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("banview")
                .setDescription("Lists global bans or checks a specific user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("Check bans for a specific user")
                        .setRequired(false)
                )
        )

        // GLOBALUNBAN SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("unban")
                .setDescription("Unbans a user from all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to unban")
                        .setRequired(true)
                )
        )

        // GLOBALKICK SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("kick")
                .setDescription("Kicks a user from all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to kick")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for kick")
                    .setRequired(false)
                )
        )

        // GLOBALKICKVIEW SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("kickview")
                .setDescription("List all global kicks or check a specific user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("Check global kicks for a specific user")
                        .setRequired(false)
                )
        )

        // GLOBALMUTE SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("mute")
                .setDescription("Mutes a user from all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to mute")
                        .setRequired(true)
                )
                .addIntegerOption(option => 
                    option.setName("duration")
                    .setDescription("Duration in minutes")
                    .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for mute")
                    .setRequired(false)
                )
        )

        // GLOBALMUTEVIEW SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("muteview")
                .setDescription("List all global mutes or check a specific user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("Check global mutes for a specific user")
                        .setRequired(false)
                )
        )

        // GLOBALUNMUTE SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("unmute")
                .setDescription("Unmutes a user from all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to unmute")
                        .setRequired(true)
                )
        )

        // GLOBALBLACKLIST SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("blacklist")
                .setDescription("Blacklists a user from using the bot in all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to blacklist")
                        .setRequired(true)
                )
                .addStringOption(option => 
                    option.setName("reason")
                    .setDescription("Reason for blacklist")
                    .setRequired(false)
                )
        )

        // GLOBALBLACKLISTVIEW SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("blacklistview")
                .setDescription("List all blacklisted users or view a specific user.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("Check the blacklist of a specific user")
                        .setRequired(false)
                )
        )

        // GLOBALUNBLACKLIST SUBCOMMAND
        .addSubcommand(sub =>
            sub.setName("unblacklist")
                .setDescription("Unblacklists a user from using the bot in all guilds the bot is in.")
                .addUserOption(option =>
                    option.setName("user")
                        .setDescription("User to unblacklist")
                        .setRequired(true)
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

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
            return interaction.reply({ embeds: [permsembed] });

        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser("user");

        //--------------------------------------------------------------------
        // GLOBALBAN
        //--------------------------------------------------------------------
        if (sub === "ban") {
            interaction.deferReply({ ephemeral: true });
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || "No Reason Provided";

            const userGuilds = [];
            for (const guild of interaction.client.guilds.cache.values()) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member) userGuilds.push(guild);
            }

            // Step 2: Build a list of guild names for the DM
            const guildNames = userGuilds.map(g => g.name);
            const guildIds = interaction.client.guilds.cache.map(g => g.id);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                guildId: interaction.guild.id,
                guildIds: guildIds,
                moderatorId: interaction.user.id,
                action: "GlobalBan",
                reason: reason
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("🔨 Global Ban")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}`, inline: true },
                        { name: "Moderator", value: `${interaction.user}`, inline: true },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: false },
                        { name: "Guilds", value: `\`${guildNames.length ? guildNames.join("\n") : "None"}\``, inline: false }
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                    logChannel.send({ embeds: [banlog] });
                }
            } 

            // DM user
            const dmEmbed = new EmbedBuilder()
            .setTitle("🔨 Globally Banned")
            .setDescription("You have been globally banned.")
            .addFields(
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                { name: "Guilds", value: `\`${guildNames.length ? guildNames.join("\n") : "None"}\``, inline: false }
            )
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });

            try {
                await user.send({ embeds: [dmEmbed] });
            } catch (err) {
                if (err.code === 50007) {
                    console.log(`Could not DM ${user.tag}: DMs are closed or user blocked the bot.`);
                } else {
                    console.error(`Failed to DM ${user.tag}:`, err);
                }
            }
            
            const banembed = new EmbedBuilder()
            .setTitle("🔨 Globally Banned")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}`, inline: true },
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                { name: "Guilds", value: `\`${guildNames.length ? guildNames.join("\n") : "None"}\``, inline: false }
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });

            interaction.channel.send({ embeds: [banembed] });

            // Save global ban in DB
            await Global.create({ userId: user.id, reason, moderatorId: interaction.user.id, type: "ban", guildId: interaction.guild.id, guildIds: guildIds });

            // Ban from all guilds
            for (const guild of interaction.client.guilds.cache.values()) {
                const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
                if (member) await member.ban({ reason }).catch(console.error);
            }
        }

        //--------------------------------------------------------------------
        // GLOBALBANVIEW
        //--------------------------------------------------------------------
        if (sub === "banview") {
            const user = interaction.options.getUser('user');

            // If a user is provided, return only their bans
            if (user) {
                const bans = await Global.find({ userId: user.id, type: "ban" });

                if (!bans.length) {
                    const nobansembed = new EmbedBuilder()
                    .setTitle("🔨 Global Bans View")
                    .setDescription(`${user} has no global bans.`)
                    .setColor("Green")
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                    return interaction.reply({ embeds: [nobansembed] });
                }

                const bannedGuilds = [];

                for (const guild of interaction.client.guilds.cache.values()) {
                    try {
                        const ban = await guild.bans.fetch(user.id).catch(() => null);
                        if (ban) bannedGuilds.push(guild);
                    } catch (err) {
                        console.log(`Ban fetch failed in ${guild.name}:`, err);
                    }
                }

                const guildNames = bannedGuilds.length
                ? bannedGuilds.map(g => `• ${g.name}`).join("\n")
                : "Currently not banned in any guilds.";

                const mapped = bans.map(b =>
                    `🔨 **Global Ban**\n• User: <@${b.userId}>\n• Reason: **${b.reason}**\n• By: <@${b.moderatorId}>`
                );

                const banviewembed = new EmbedBuilder()
                    .setTitle("🔨 Global Bans View")
                    .setDescription(`${mapped.join('\n\n')}`)
                    .addFields({ name: "Currently Banned In", value: `\`${guildNames}\``, inline: true})
                    .setColor("Green")
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

                return interaction.reply({ embeds: [banviewembed] });
            }

            // No user selected → list all bans
            const bans = await Global.find();

            if (!bans.length) {
                const nogbansembed = new EmbedBuilder()
                .setTitle("🔨 Global Bans View")
                .setDescription(`There are no global bans.`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

                return interaction.reply({ embeds: [nogbansembed] });
            };;

            const mapped = bans.map(b =>
                `🔨 <@${b.userId}> - Reason: **${b.reason}** - By: <@${b.moderatorId}>`
            );

            const banviewembed2 = new EmbedBuilder()
            .setTitle("🔨 Global Bans View")
            .setDescription(`${mapped.join('\n')}`)
            .addFields({ name: "Currently Banned In", value: `\`${guildNames}\``, inline: true})
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            interaction.reply({ embeds: [banviewembed2] });
        }

        //--------------------------------------------------------------------
        // GLOBALUNBAN
        //--------------------------------------------------------------------
        if (sub === "unban") {
            interaction.deferReply({ ephemeral: true });
            const user = interaction.options.getUser('user');;

            // Remove global ban from DB
            //await Global.findOneAndDelete({ userId: user.id });

           // // Unban from all guilds
            //for (const guild of interaction.client.guilds.cache.values()) {
                //await guild.bans.remove(user.id).catch(() => null);
            //}

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "GlobalUnban",
            });
            await log.save();

            const unbannedGuilds = [];

            for (const guild of interaction.client.guilds.cache.values()) {
                try {
                    const ban = await guild.bans.fetch(user.id).catch(() => null);

                    if (ban) {
                        await guild.bans.remove(user.id, `Global unban by ${interaction.user.tag}`).catch(() => null);
                        unbannedGuilds.push(guild.name); // STORE GUILD NAME
                    }
                } catch (err) {
                    console.error(`Error in guild ${guild.name}:`, err);
                }
            }

            // Convert array → readable string
            const guildListString =
            unbannedGuilds.length > 0
            ? unbannedGuilds.join("\n")
            : "This user was not banned in any guild.";
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("🔨 Global Unbanned")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}`, inline: true },
                        { name: "Moderator", value: `${interaction.user}`, inline: true },
                        { name: "Guilds", value: `\`${guildListString}\``, inline: false}
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            for (const guild of interaction.client.guilds.cache.values()) {
                // Find a channel you can create an invite in
                const channel = guild.channels.cache.find(
                    c => c.type === 0 && c.permissionsFor(guild.members.me).has('CreateInstantInvite')
                );
                const invite = channel ? await channel.createInvite({ maxAge: 3600, maxUses: 1 }).catch(() => null) : null;

                // Build embed
                const dmEmbed = new EmbedBuilder()
                .setTitle("🔨 Globally Unbanned")
                .setDescription(`You have been globally unbanned${invite ? `! Here's an invite: ${invite}` : ''}\nGuilds: \`${guildListString}\``)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail });

                // Try to DM the user
                try {
                    await user.send({ embeds: [dmEmbed] });
                } catch (err) {
                    if (err.code === 50007) {
                        console.log(`Could not DM ${user.tag} (DMs closed or blocked).`);
                    } else {
                        console.error(`Failed to DM ${user.tag}:`, err);
                    }
                }
            }

            const gunbanembed = new EmbedBuilder()
            .setTitle("🔨 Globally Unbanned")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}`, inline: true },
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Guilds", value: `\`${guildListString}\``, inline: false}
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            // Send result (depends on if you deferred)
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [gunbanembed] });
            } else {
                await interaction.reply({ embeds: [gunbanembed] });
            }
            //interaction.followUp({ embeds: [gunbanembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALKICK
        //--------------------------------------------------------------------
        if (sub === "kick") {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || "No reason provided";

            const userGuilds = [];
            for (const guild of interaction.client.guilds.cache.values()) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member) userGuilds.push(guild);
            }

            // Step 2: Build a list of guild names for the DM
            const guildNames = userGuilds.map(g => g.name);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "GlobalKick",
                reason: reason
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("🔨 Global Kick")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}`, inline: true },
                        { name: "Moderator", value: `${interaction.user}`, inline: true },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                        { name: "Guilds", value: `\`${guildNames.length ? guildNames.join("\n") : "None"}\``, inline: false}
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const kickdmembed = new EmbedBuilder()
            .setTitle("🔨 Global Kick")
            .setDescription("You have been globally kicked")
            .setColor("Green")
            .addFields(
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                { name: "Guilds", value: `\`${guildNames.length ? guildNames.join("\n") : "None"}\``, inline: false}
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            try { await user.send({ embeds: [kickdmembed] }); } catch {}

            // Save global ban in DB
            await Global.create({ userId: user.id, reason, moderatorId: interaction.user.id, type: "kick", guildId: interaction.guild.id });

            // Kick from all guilds
            for (const guild of interaction.client.guilds.cache.values()) {
                const member = guild.members.cache.get(user.id) || await guild.members.fetch(user.id).catch(() => null);
                if (member) await member.kick({ reason }).catch(console.error);
            }

            const kickembed = new EmbedBuilder()
            .setTitle("🔨 Global Kick")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}`, inline: true },
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                { name: "Guilds", value: `\`${guildNames.length ? guildNames.join("\n") : "None"}\``, inline: false}
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            return interaction.reply({ embeds: [kickembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALKICKVIEW
        //--------------------------------------------------------------------
        if (sub === "kickview") {
            const user = interaction.options.getUser('user');

            if (user) {
                const kicks = await Global.find({
                    type: "kick",
                    userId: user.id
                });

                const nogkicksembed = new EmbedBuilder()
                .setTitle("🔨 Global Kicks View")
                .setDescription(`❌ ${user} has no global kicks.`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

                if (!kicks.length) {
                    return interaction.reply({ embeds: [nogkicksembed] });
                }

                const userGuilds = [];
                for (const guild of interaction.client.guilds.cache.values()) {
                    const member = await guild.members.fetch(user.id).catch(() => null);
                    if (member) userGuilds.push(guild);
                }

                // Step 2: Build a list of guild names for the DM
                const guildNames = userGuilds.map(g => g.name);

                const list = kicks
                .map(k => 
                    `🔨 **Global Kick**\n• User: <@${k.userId}>\n• Reason: **${k.reason}**\n• Date: <t:${Math.floor(k.date.getTime() / 1000)}:F>\n• Guilds: \`${guildNames.length ? guildNames.join("\n") : "None"}\``
                )
                .join("\n\n");

                const kickslistembed = new EmbedBuilder()
                .setTitle("🔨 Global Kicks View")
                .setDescription(`${list}`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

                return interaction.reply({ embeds: [kickslistembed] });
            }

            // No user provided → show all global kicks
            const kicks = await Global.find({ type: "kick" });

            const nokicksembed = new EmbedBuilder()
            .setTitle("🔨 Global Kicks View")
            .setDescription(`No global kicks found.`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            if (!kicks.length)
                return interaction.reply({ embeds: [nokicksembed] });

            const list = kicks
            .map(k => 
                `User: <@${k.userId}>, Reason: ${k.reason}, Date: <t:${Math.floor(k.date.getTime() / 1000)}:F>, Guilds: \`${guildNames.length ? guildNames.join(", ") : "None"}\``
            )
            .join("\n");

            const listembed = new EmbedBuilder()
            .setTitle("🔨 Global Kicks View")
            .setDescription(`${list}`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            await interaction.reply({ embeds: [listembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALMUTE
        //--------------------------------------------------------------------
        if (sub === "mute") {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || "No Reason Provided";
            const duration = interaction.options.getInteger('duration');

            const guilds = client.guilds.cache.map(g => g);
            for (const guild of guilds) {
                try {
                    const member = await guild.members.fetch(user.id).catch(() => null);
                    if (member) await member.timeout(duration * 60 * 1000, reason);
                } catch {}
            }

            await Global.create({ userId: user.id, type: "mute", reason, duration: duration * 60 * 1000 });

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "GlobalMute",
                reason: reason,
                duration: duration
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Global Mute")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}` },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const gmuteembed = new EmbedBuilder()
            .setTitle("Global Mute")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}` },
                { name: "Duration", value: `${duration}` },
                { name: "Reason", value: `\`\`\`${reason}\`\`\`` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            try { await user.send({ embeds: [gmuteembed] }); } catch {}

            await interaction.reply({ embeds: [gmuteembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALMUTEVIEW
        //--------------------------------------------------------------------
        if (sub === "muteview") {
            const user = interaction.options.getUser('user');

            // If a specific user is requested
            if (user) {
                const mutes = await GlobalKickMute.find({
                     type: "mute",
                     userId: user.id
                });
                
                const nogmutesembed = new EmbedBuilder()
                .setTitle("Global Mutes View")
                .setDescription(`❌ **${user}** has no global mutes.`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })

                if (!mutes.length) {
                    return interaction.reply({ embeds: [nogmutesembed] });
                }

                const list = mutes
                .map(m =>
                    `🔇 **Global Mute**\n` +
                    `• User: <@${m.userId}>\n` +
                    `• Reason: **${m.reason}**\n` +
                    `• Duration: \`${m.duration / 60000}\` min\n` +
                    `• Date: <t:${Math.floor(m.date.getTime() / 1000)}:F>`
                )
                .join("\n\n");

                const listembed2 = new EmbedBuilder()
                .setTitle("Global Mutes View")
                .setDescription(`${list}`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })

                return interaction.reply({ embeds: [listembed2] });
            }

            // Otherwise list all mutes
            const mutes = await Global.find({ type: "mute" });

            const noglobalmutes = new EmbedBuilder()
            .setTitle("Global Mutes View")
            .setDescription(`No global mutes found.`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            if (!mutes.length) {
                return interaction.reply({ embeds: [noglobalmutes] });
            }

            const list = mutes
            .map(m =>
                `User: <@${m.userId}>, Reason: **${m.reason}**, Duration: \`${m.duration / 60000}\` min, Date: <t:${Math.floor(m.date.getTime() / 1000)}:F>`
            )
            .join("\n");

            const listallembed = new EmbedBuilder()
            .setTitle("Global Mutes View")
            .setDescription(`${list}`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            await interaction.reply({ embeds: [listallembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALUNMUTE
        //--------------------------------------------------------------------
        if (sub === "unmute") {
            const user = interaction.options.getUser('user');

            const guilds = client.guilds.cache.map(g => g);
            for (const guild of guilds) {
                try {
                    const member = await guild.members.fetch(user.id).catch(() => null);
                    if (member) await member.timeout(null, "Global unmute");
                } catch {}
            }

            //await Global.deleteMany({ userId: user.id, type: "mute" });

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "GlobalUnmute",
                reason: reason
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Global Unmute")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}` },
                        { name: "Moderator", value: `${interaction.user}` },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}` })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const gunmuteembed = new EmbedBuilder()
            .setTitle("Global Unmute")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}` },
                { name: "Moderator", value: `${interaction.user}` },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })

            try { await user.send({ embeds: [gunmuteembed] }); } catch {}

            await interaction.reply({ embeds: [gunmuteembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALBLACKLIST
        //--------------------------------------------------------------------
        if (sub === "blacklist") {
            const user = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || "No Reason Provided";

            await Global.create({ userId: user.id, reason, moderatorId: interaction.user.id });

            const userGuilds = [];
            for (const guild of interaction.client.guilds.cache.values()) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member) userGuilds.push(guild);
            }

            // Step 2: Build a list of guild names for the DM
            const guildNames = userGuilds.map(g => g.name);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "Blacklist",
                reason: reason
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Global Blacklist")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}`, inline: true },
                        { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                        { name: "Moderator", value: `${interaction.user}`, inline: true },
                        { name: "Guilds", value: `**${guildNames.length ? guildNames.join("\n") : "None"}**`, inline: true },
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const blacklistembed = new EmbedBuilder()
            .setTitle("Global Blacklist")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}`, inline: true },
                { name: "Reason", value: `\`\`\`${reason}\`\`\``, inline: true },
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Guilds", value: `**${guildNames.length ? guildNames.join("\n") : "None"}**`, inline: true },
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            try { await user.send({ embeds: [blacklistembed] }); } catch {}

            interaction.reply({ embeds: [blacklistembed] });
        }

        //--------------------------------------------------------------------
        // GLOBALBLACKLISTVIEW
        //--------------------------------------------------------------------
        if (sub === "blacklistview") {
            const user = interaction.options.getUser('user');

            // If a user is specified → filter by user
            if (user) {
                const entries = await Global.find({ userId: user.id });
                const notblacklstedembed = new EmbedBuilder()
                .setTitle("Global Blacklist")
                .setDescription(`❌ ${user} is not blacklisted.`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}` })

                if (!entries.length) {
                    return interaction.reply({ embeds: [notblacklstedembed] });
                }

                const userGuilds = [];
                for (const guild of interaction.client.guilds.cache.values()) {
                    const member = await guild.members.fetch(user.id).catch(() => null);
                    if (member) userGuilds.push(guild);
                }

                // Step 2: Build a list of guild names for the DM
                const guildNames = userGuilds.map(g => g.name);

                const mapped = entries.map(b =>
                    `🚫 **Blacklist Entry**\n` +
                    `• User: <@${b.userId}>\n` +
                    `• Reason: **${b.reason}**\n` +
                    `• By: <@${b.moderatorId}>`
                    `• Guilds: **${guildNames.length ? guildNames.join("\n") : "None"}**`
                );

                const blacklstlistembed = new EmbedBuilder()
                .setTitle("Global Blacklist")
                .setDescription(`${mapped.join("\n\n")}`)
                .setColor("Green")
                .setTimestamp()
                .setThumbnail(config.Thumbnail)
                .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

                return interaction.reply({ embeds: [blacklstlistembed] });
            }

            // If no user given → list all blacklisted users
            const bls = await Global.find();

            const noblsusers = new EmbedBuilder()
            .setTitle("Global Blacklist")
            .setDescription(`No blacklisted users.`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            if (!bls.length) {
                return interaction.reply({ embeds: [noblsusers] });
            }

            const mapped = bls.map(b =>
                `<@${b.userId}> - Reason: **${b.reason}** - By: <@${b.moderatorId}> - Guilds: **${guildNames.length ? guildNames.join(", ") : "None"}**`
            );

            const blacklistlistembed2 = new EmbedBuilder()
            .setTitle("Global Blacklist")
            .setDescription(`${mapped.join('\n')}`)
            .setColor("Green")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            interaction.reply({ embeds: [blacklistlistembed2] });
        }

        //--------------------------------------------------------------------
        // GLOBALUNBLACKLIST
        //--------------------------------------------------------------------
        if (sub === "unblacklist") {
            const user = interaction.options.getUser('user');

            const blacklisted = await Global.findOne({ userId: user.id });
            const notblacklistedembed = new EmbedBuilder()
            .setTitle("Global Unblacklist")
            .setDescription(`${user} is not blacklised.`)
            .setColor("Red")
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}` })
            if (!blacklisted) {
                return interaction.reply({ embeds: [notblacklistedembed] });
            }

            await Global.findOneAndDelete({ userId: user.id });

            const userGuilds = [];
            for (const guild of interaction.client.guilds.cache.values()) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member) userGuilds.push(guild);
            }

            // Step 2: Build a list of guild names for the DM
            const guildNames = userGuilds.map(g => g.name);

            // Save to DB
            const log = new ModLog({
                guildId: interaction.guild.id,
                userId: user.id,
                moderatorId: interaction.user.id,
                action: "Unblacklist"
            });
            await log.save();
            
            // Send modlog if set
            const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (guildConfig && guildConfig.modLogChannelId) {
                const logChannel = interaction.guild.channels.cache.get(guildConfig.modLogChannelId);
                if (logChannel) {
                    const banlog = new EmbedBuilder()
                    .setTitle("Global Unblacklist")
                    .setColor("Green")
                    .addFields(
                        { name: "User", value: `${user}`, inline: true },
                        { name: "Moderator", value: `${interaction.user}`, inline: true },
                        { name: "Guilds", value: `**${guildNames.length ? guildNames.join("\n") : "None"}**`, inline: true }
                    )
                    .setTimestamp()
                    .setThumbnail(config.Thumbnail)
                    .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })
                    logChannel.send({ embeds: [banlog] });
                }
            }

            const unblacklistembed = new EmbedBuilder()
            .setTitle("Global Unblacklist")
            .setColor("Green")
            .addFields(
                { name: "User", value: `${user}`, inline: true },
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Guilds", value: `**${guildNames.length ? guildNames.join("\n") : "None"}**`, inline: true }
            )
            .setTimestamp()
            .setThumbnail(config.Thumbnail)
            .setFooter({ text: `Requested By: ${interaction.user.tag}`, iconURL: config.Thumbnail })

            try { await user.send({ embeds: [unblacklistembed] }); } catch {}

            interaction.reply({ embeds: [unblacklistembed]});
        }
    }
};
