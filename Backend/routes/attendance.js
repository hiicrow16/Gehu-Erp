const express = require("express");
const router = express.Router();

const Attendance = require("../models/Attendance");
const Faculty = require("../models/Faculty");
const { protect, authorize } = require("../middleware/auth");

// POST /api/attendance  (faculty) - mark one student present/absent for a subject/date
router.post("/", protect, authorize("faculty"), async (req, res) => {
  try {
    const { student, subject, date, status } = req.body;
    if (!student || !subject || !date || !status) {
      return res.status(400).json({ success: false, message: "student, subject, date and status are required" });
    }

    const faculty = await Faculty.findOne({ user: req.user.id });

    const record = await Attendance.findOneAndUpdate(
      { student, subject, date: new Date(date) },
      { status, markedBy: faculty ? faculty._id : undefined },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({ success: true, record });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not mark attendance" });
  }
});

// GET /api/attendance/student/:studentId?subject=<id>
// Students can view their own record; admin/faculty can view any student's.
router.get("/student/:studentId", protect, async (req, res) => {
  const Student = require("../models/Student");

  if (req.user.role === "student") {
    const own = await Student.findOne({ user: req.user.id });
    if (!own || String(own._id) !== req.params.studentId) {
      return res.status(403).json({ success: false, message: "You can only view your own attendance" });
    }
  }

  const filter = { student: req.params.studentId };
  if (req.query.subject) filter.subject = req.query.subject;

  const records = await Attendance.find(filter).populate("subject").sort({ date: -1 });

  const present = records.filter((r) => r.status === "Present").length;
  const total = records.length;
  const percentage = total > 0 ? Number(((present / total) * 100).toFixed(2)) : 0;

  res.json({ success: true, records, summary: { present, absent: total - present, total, percentage } });
});

// GET /api/attendance/subject/:subjectId?date=YYYY-MM-DD  (faculty, admin)
router.get("/subject/:subjectId", protect, authorize("faculty", "admin"), async (req, res) => {
  const filter = { subject: req.params.subjectId };
  if (req.query.date) filter.date = new Date(req.query.date);

  const records = await Attendance.find(filter).populate("student").sort({ date: -1 });
  res.json({ success: true, records });
});

module.exports = router;
