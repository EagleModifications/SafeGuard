const mongoose = require('mongoose');

const moderationSchema = new mongoose.Schema({
    guildId: { type: String },
    userId: { type: String, required: true },
    type: { type: String, enum: ["kick", "mute"], required: false },
    reason: { type: String, required: false, default: "No reason provided" },
    date: { type: Date, default: Date.now },
    duration: { type: Number }, // For mutes in milliseconds, optional
    days: { type: Number },
    moderatorId: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Moderation', moderationSchema);
