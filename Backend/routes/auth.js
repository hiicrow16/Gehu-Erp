const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../models/User");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");

// POST /api/auth/login
// Accepts { username, password }. Verifies against the hashed password in
// MongoDB (never plain text) and returns a signed JWT.
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    const user = await User.findOne({ username, isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Look up the linked profile so the frontend gets a display name immediately
    let profile = null;
    if (user.role === "student") {
      profile = await Student.findOne({ user: user._id }).populate("course");
    } else if (user.role === "faculty") {
      profile = await Faculty.findOne({ user: user._id });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, profileId: profile ? profile._id : null },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      success: true,
      token,
      role: user.role,
      username: user.username,
      profile,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

module.exports = router;
