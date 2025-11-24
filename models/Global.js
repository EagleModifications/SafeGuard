const mongoose = require('mongoose');

const globalSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, enum: ["kick", "mute", "ban", "unban", "kick", "mute", "unmute", "blacklist", "unblacklist"], required: false },
    guildId: { type: String },
    guildIds: [{ type: String }],
    reason: { type: String, required: false, default: "No reason provided" },
    date: { type: Date, default: Date.now },
    duration: { type: Number }, // For mutes in milliseconds, optional
    moderatorId: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Global', globalSchema);
