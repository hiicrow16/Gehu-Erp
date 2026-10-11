const express = require("express");
const router = express.Router();
const AcademicTerm = require("../models/AcademicTerm");
const Course = require("../models/Course");
const Student = require("../models/Student");
const User = require("../models/User");
const { record } = require("../lib/audit");
const { protect, authorize } = require("../middleware/auth");

const admin = [protect, authorize("admin")];
const pick = (b) => ({ name: b.name, academicYear: b.academicYear, type: b.type, startDate: b.startDate, endDate: b.endDate });

router.get("/", protect, async (req, res) => {
  res.json({ success: true, terms: await AcademicTerm.find().sort({ startDate: -1 }) });
});

function validDates(b) {
  const s = new Date(b.startDate), e = new Date(b.endDate);
  return !isNaN(s) && !isNaN(e) && e > s;
}

router.post("/", ...admin, async (req, res) => {
  try {
    if (!req.body.name || !req.body.academicYear) return res.status(400).json({ success: false, message: "Name and academic year are required" });
    if (!validDates(req.body)) return res.status(400).json({ success: false, message: "End date must be after the start date" });
    res.status(201).json({ success: true, term: await AcademicTerm.create(pick(req.body)) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "A term with that name already exists" });
    res.status(500).json({ success: false, message: "Could not create term" });
  }
});

router.put("/:id", ...admin, async (req, res) => {
  try {
    if (!validDates(req.body)) return res.status(400).json({ success: false, message: "End date must be after the start date" });
    const term = await AcademicTerm.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });
    if (!term) return res.status(404).json({ success: false, message: "Term not found" });
    res.json({ success: true, term });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 500).json({ success: false, message: err.code === 11000 ? "A term with that name already exists" : "Could not update term" });
  }
});

router.delete("/:id", ...admin, async (req, res) => {
  const t = await AcademicTerm.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Term not found" });
  if (t.isCurrent) return res.status(400).json({ success: false, message: "Make another term current before deleting this one" });
  await t.deleteOne();
  res.json({ success: true });
});

// Make one term the current one (all others are switched off)
router.post("/:id/current", ...admin, async (req, res) => {
  const t = await AcademicTerm.findById(req.params.id);
  if (!t) return res.status(404).json({ success: false, message: "Term not found" });
  await AcademicTerm.updateMany({ _id: { $ne: t._id } }, { isCurrent: false });
  t.isCurrent = true;
  await t.save();
  res.json({ success: true, term: t });
});

// POST /api/terms/promote  { course, fromSemester, dryRun? }
// Moves every ACTIVE student of that course from semester N to N+1. Students already
// in the course's final semester are left alone (they are graduating). dryRun only counts.
router.post("/promote", ...admin, async (req, res) => {
  try {
    const from = Number(req.body.fromSemester);
    const course = await Course.findById(req.body.course);
    if (!course || !Number.isInteger(from) || from < 1) return res.status(400).json({ success: false, message: "Choose a course and a semester" });
    const last = Math.round((course.durationYears || 3) * 2);
    if (from >= last) return res.status(400).json({ success: false, message: `${course.name} has ${last} semesters, so semester ${from} is the last one.` });

    const active = await User.find({ role: "student", isActive: { $ne: false } }).select("_id");
    const filter = { course: course._id, semester: from, user: { $in: active.map((u) => u._id) } };
    const ids = (await Student.find(filter).select("_id studentId name")).map((s) => s);
    if (req.body.dryRun) return res.json({ success: true, count: ids.length, to: from + 1 });

    await Student.updateMany({ _id: { $in: ids.map((s) => s._id) } }, { $inc: { semester: 1 } });
    await record(req, {
      action: "promote", entity: "Student", entityId: course._id,
      summary: `Promoted ${ids.length} ${course.name} student(s) from semester ${from} to ${from + 1}`,
      changes: ids.slice(0, 300).map((s) => ({ label: `${s.studentId} - ${s.name}`, field: "semester", from, to: from + 1 })),
    });
    res.json({ success: true, promoted: ids.length, to: from + 1 });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not promote students" });
  }
});

module.exports = router;
