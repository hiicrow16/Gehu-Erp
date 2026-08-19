const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Faculty = require("../models/Faculty");
const { protect, authorize } = require("../middleware/auth");

// GET /api/faculty  (admin)
router.get("/", protect, authorize("admin"), async (req, res) => {
  const faculty = await Faculty.find().populate("subjects").sort({ createdAt: -1 });
  res.json({ success: true, faculty });
});

// GET /api/faculty/me  (faculty)
router.get("/me", protect, authorize("faculty"), async (req, res) => {
  const faculty = await Faculty.findOne({ user: req.user.id }).populate("subjects");
  if (!faculty) return res.status(404).json({ success: false, message: "Profile not found" });
  res.json({ success: true, faculty });
});

// POST /api/faculty  (admin) - creates both the login User and the Faculty profile
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { username, password, facultyId, name, email, phone, department, subjects } = req.body;

    if (!username || !password || !facultyId || !name) {
      return res.status(400).json({ success: false, message: "username, password, facultyId and name are required" });
    }

    const user = await User.create({ username, password, role: "faculty" });
    const faculty = await Faculty.create({
      user: user._id,
      facultyId,
      name,
      email,
      phone,
      department,
      subjects: subjects || [],
    });

    res.status(201).json({ success: true, faculty });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Username or faculty ID already exists" });
    }
    res.status(500).json({ success: false, message: "Could not create faculty" });
  }
});

// PUT /api/faculty/:id  (admin)
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  const { name, email, phone, department, subjects } = req.body;
  const faculty = await Faculty.findByIdAndUpdate(
    req.params.id,
    { name, email, phone, department, subjects },
    { new: true, runValidators: true }
  ).populate("subjects");

  if (!faculty) return res.status(404).json({ success: false, message: "Faculty not found" });
  res.json({ success: true, faculty });
});

// DELETE /api/faculty/:id  (admin)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) return res.status(404).json({ success: false, message: "Faculty not found" });

  await Faculty.deleteOne({ _id: faculty._id });
  await User.deleteOne({ _id: faculty.user });

  res.json({ success: true, message: "Faculty deleted" });
});

module.exports = router;
