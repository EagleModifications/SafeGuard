const mongoose = require("mongoose");

const ticketguildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    panelChannel: String,
    supportRole: String,
    ticketCategory: String
});

// FIX OverwriteModelError
module.exports =
    mongoose.models.TicketGuildConfig ||
    mongoose.model("TicketGuildConfig", ticketguildConfigSchema);
