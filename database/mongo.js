const config = require("../config.json");
const mongoose = require("mongoose");

async function connectDB() {
  try {
    await mongoose.connect(config.mongoURI);
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1); // Stop the bot if DB fails
  }
}

module.exports = { connectDB };
