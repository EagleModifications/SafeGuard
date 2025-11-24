const { Schema, model } = require("mongoose");

const warningSchema = new Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    warnings: [
        {
            reason: String,
            moderator: String,
            date: { type: Date, default: Date.now }
        }
    ]
});

module.exports = model("Warnings", warningSchema);
