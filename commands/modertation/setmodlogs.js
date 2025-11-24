const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const GuildConfig = require("../../models/GuildConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setmodlogs")
    .setDescription("Setup the moderation log channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName("channel").setDescription("Channel for moderation logs").setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({ content: "❌ Please select a valid text channel.", ephemeral: true });
    }

    let guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!guildConfig) {
      guildConfig = new GuildConfig({ guildId: interaction.guild.id, modLogChannelId: channel.id });
    } else {
      guildConfig.modLogChannelId = channel.id;
    }

    await guildConfig.save();
    await interaction.reply(`✅ Mod log channel set to ${channel}`);
  }
};
