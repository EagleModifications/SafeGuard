const { Schema, model } = require("mongoose");

const guildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  modLogChannelId: { type: String, required: false }
});

module.exports = model("GuildConfig", guildConfigSchema);
