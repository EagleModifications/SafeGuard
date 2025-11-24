const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  guildId: String,
  panelId: String,
  channelId: String,
  channelName: String,
  creatorId: String,
  ticketId: {
    type: String,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  claimedBy: { type: String, default: null },
  status: { type: String, enum: ["open", "closed", "locked"], default: "open" }
});

module.exports = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
