const { Schema, model } = require("mongoose");

const modLogSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: false },
  guildId: { type: String },
  guildIds: [{ type: String }],
  moderatorId: { type: String, required: true },
  action: { type: String, required: true }, // "Ban", "Kick", "Mute", etc.
  reason: { type: String, default: "No reason provided" },
  date: { type: Date, default: Date.now }
});

module.exports = model("ModLog", modLogSchema);
