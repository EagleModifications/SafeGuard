const mongoose = require('mongoose');

const LockdownSetupSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelRoles: { type: [String], default: [] },
    serverRoles: { type: [String], default: [] }
});

module.exports = mongoose.model('LockdownSetup', LockdownSetupSchema);
