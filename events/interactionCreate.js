const { EmbedBuilder } = require("discord.js");
const Global = require("../models/Global");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    // Global Blacklist
    const isBlacklisted = await Global.findOne({ userId: interaction.user.id });

    if (isBlacklisted) {
      
      const blacklistedembed = new EmbedBuilder()
      .setTitle("Global Blacklist")
      .setDescription("🚫 You are globally blacklisted and cannot use commands.")
      .setColor("Red")
      .addFields(
        { name: "User", value: `${interaction.user}` },
        { name: "Reason", value: `\`\`\`${isBlacklisted.reason}\`\`\`` },
      )
      .setTimestamp()
      .setFooter({ text: `Requested By: ${interaction.user.tag}` })
      
      return interaction.reply({ embeds: [blacklistedembed] });
    }

    // Carry on Commands
    const command = client.commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({ content: "❌ Command not found!", ephemeral: true });
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.reply({ content: "⚠️ There was an error executing this command.", ephemeral: true });
      }
    }
  }
};
