const express = require("express");
const router = express.Router();

const Course = require("../models/Course");
const { protect, authorize } = require("../middleware/auth");

// GET /api/courses - any authenticated user can view the list
router.get("/", protect, async (req, res) => {
  const courses = await Course.find().sort({ name: 1 });
  res.json({ success: true, courses });
});

// POST /api/courses  (admin)
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, code, department, durationYears } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: "name and code are required" });

    const course = await Course.create({ name, code, department, durationYears });
    res.status(201).json({ success: true, course });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Course code already exists" });
    res.status(500).json({ success: false, message: "Could not create course" });
  }
});

// PUT /api/courses/:id  (admin)
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  const { name, code, department, durationYears } = req.body;
  const course = await Course.findByIdAndUpdate(
    req.params.id,
    { name, code, department, durationYears },
    { new: true, runValidators: true }
  );
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });
  res.json({ success: true, course });
});

// DELETE /api/courses/:id  (admin)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) return res.status(404).json({ success: false, message: "Course not found" });
  res.json({ success: true, message: "Course deleted" });
});

module.exports = router;
