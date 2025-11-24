const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const ModLog = require("../../models/ModLog");

const config = require("../../config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modhistory")
    .setDescription("Check a user's moderation history.")
    .addUserOption(option =>
      option.setName("user").setDescription("The user to check").setRequired(true)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("user");
    const logs = await ModLog.find({ guildId: interaction.guild.id, userId: user.id });

    if (logs.length === 0) {
      return interaction.reply(`✅ ${user} has a clean record.`);
    }

    const history = logs.map(
      (log, i) => `**#${i + 1}** | ${log.action} By <@${log.moderatorId}> on <t:${Math.floor(log.date.getTime() / 1000)}> | Reason: \`\`\`${log.reason}\`\`\``
    ).join("\n");

    const historyembed = new EmbedBuilder()
    .setTitle("🚨 Moderation History")
    .setColor("Green")
    .addFields(
        { name: "👤 User", value: `${user} (${user.id})` },
        { name: "📜 History", value: `${history}` },
    )
    .setTimestamp()
    .setThumbnail(config.Thumbnail)
    .setFooter({ text: 'SafeGuard Moderation System' })
    await interaction.reply({ embeds: [historyembed] });
  }
};
