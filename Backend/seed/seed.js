// One-time script to create the first admin login.
// Run with:  npm run seed:admin
// Reads ADMIN_SEED_USERNAME / ADMIN_SEED_PASSWORD from your .env file.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const connectDB = require("../config/db");
const User = require("../models/User");

async function run() {
  await connectDB();

  const username = process.env.ADMIN_SEED_USERNAME;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!username || !password) {
    console.error("Set ADMIN_SEED_USERNAME and ADMIN_SEED_PASSWORD in your .env file first.");
    process.exit(1);
  }

  const existing = await User.findOne({ username });
  if (existing) {
    console.log(`User "${username}" already exists. Nothing to do.`);
    process.exit(0);
  }

  await User.create({ username, password, role: "admin" });
  console.log(`Admin account "${username}" created. You can now log in with it.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
