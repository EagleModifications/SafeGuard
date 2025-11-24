const { Schema, model } = require("mongoose");

const ticketLogSchema = new Schema({
  guildId: { type: String, required: true },
  moderatorId: { type: String, required: true },
  action: { type: String, required: true }, // "Ban", "Kick", "Mute", etc.
  reason: { type: String, default: "No reason provided" },
  date: { type: Date, default: Date.now }
});

module.exports = model("TicketLog", ticketLogSchema);
