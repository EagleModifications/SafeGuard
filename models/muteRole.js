const { Schema, model } = require('mongoose');

const muteRoleSchema = new Schema({
    guildId: { type: String, required: true, unique: true },
    roleId: { type: String, required: true }
});

module.exports = model('MuteRole', muteRoleSchema);
