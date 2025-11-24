const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    ips: { type: [String], default: [] },        // Array of IP addresses
    macs: { type: [String], default: [] },       // Array of MAC addresses
    warnings: { type: Number, default: 0 },
});

module.exports = mongoose.model("User", userSchema);
