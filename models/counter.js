const mongoose = require("mongoose");

const CounterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 }
});

module.exports = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);
