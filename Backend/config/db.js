const mongoose = require("mongoose");

// Older versions of this app stored a "campusId" on users with a UNIQUE index.
// The current code never sets it, so every new user would have campusId = null
// and collide with the first one (the admin). That blocked adding any student
// with a misleading "Username already exists". Drop any such leftover index.
async function dropStaleIndexes() {
  try {
    const col = mongoose.connection.collection("users");
    const indexes = await col.indexes();
    for (const ix of indexes) {
      const keys = Object.keys(ix.key || {});
      if (ix.name !== "_id_" && ix.name !== "username_1" && ix.unique && keys.every((k) => k !== "username")) {
        await col.dropIndex(ix.name);
        console.log(`Dropped stale unique index on users: ${ix.name}`);
      }
    }
  } catch (err) {
    console.warn("Index cleanup skipped:", err.message);
  }
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(
      "MONGODB_URI is not set. Copy .env.example to .env and fill it in."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
    await dropStaleIndexes();
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
