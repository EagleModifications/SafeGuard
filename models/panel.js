const mongoose = require("mongoose");

const PanelSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  panelChannel: String,
  ticketCategory: String,
  supportRole: String,
  logChannel: String,
  ticketDescription: { type: String, default: '' },
  reasons: [String],
  blacklist: [String],
  options: {
    claimEnabled: { type: Boolean, default: true },
    transcriptToFile: { type: Boolean, default: true },
    transcriptToChannel: { type: Boolean, default: true }
  },
  panelMessageId: String 
}, { timestamps: true });

module.exports = mongoose.models.Panel || mongoose.model("Panel", PanelSchema);
