const express = require("express");
const router = express.Router();

const Subject = require("../models/Subject");
const { protect, authorize } = require("../middleware/auth");

// GET /api/subjects?course=<courseId>&semester=<n>
// Any authenticated user can view; this is how a student's subject list
// is derived from their assigned course/semester instead of being hardcoded.
router.get("/", protect, async (req, res) => {
  const filter = {};
  if (req.query.course) filter.course = req.query.course;
  if (req.query.semester) filter.semester = Number(req.query.semester);

  const subjects = await Subject.find(filter).populate("course").sort({ name: 1 });
  res.json({ success: true, subjects });
});

// POST /api/subjects  (admin)
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, code, course, semester } = req.body;
    if (!name || !code || !course || !semester) {
      return res.status(400).json({ success: false, message: "name, code, course and semester are required" });
    }
    const subject = await Subject.create({ name, code, course, semester });
    res.status(201).json({ success: true, subject });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Subject code already exists for this course" });
    res.status(500).json({ success: false, message: "Could not create subject" });
  }
});

// PUT /api/subjects/:id  (admin)
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  const { name, code, course, semester } = req.body;
  const subject = await Subject.findByIdAndUpdate(
    req.params.id,
    { name, code, course, semester },
    { new: true, runValidators: true }
  ).populate("course");
  if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });
  res.json({ success: true, subject });
});

// DELETE /api/subjects/:id  (admin)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  const subject = await Subject.findByIdAndDelete(req.params.id);
  if (!subject) return res.status(404).json({ success: false, message: "Subject not found" });
  res.json({ success: true, message: "Subject deleted" });
});

module.exports = router;
