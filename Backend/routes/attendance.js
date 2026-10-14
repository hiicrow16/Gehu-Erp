const express = require("express");
const router = express.Router();

const Attendance = require("../models/Attendance");
const Faculty = require("../models/Faculty");
const Subject = require("../models/Subject");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/auth");
const { logAudit } = require("../middleware/audit");

// Faculty may only mark/view attendance for subjects assigned to them (admin: any)
async function canManage(req, subjectId) {
  if (req.user.role === "admin") return true;
  const f = await Faculty.findOne({ user: req.user.id });
  return !!f && f.subjects.map(String).includes(String(subjectId));
}

// POST /api/attendance/bulk  { subject, date, records: [{ student, status }] } - whole class at once
router.post("/bulk", protect, authorize("faculty", "admin"), async (req, res) => {
  try {
    const { subject, date, records } = req.body;
    const d = new Date(date);
    if (!subject || isNaN(d) || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: "subject, date and records are required" });
    }
    if (!(await canManage(req, subject))) return res.status(403).json({ success: false, message: "You are not assigned to this subject" });
    const sub = await Subject.findById(subject);
    if (!sub) return res.status(404).json({ success: false, message: "Subject not found" });
    const valid = new Set((await Student.find({ course: sub.course, semester: sub.semester }).select("_id")).map((x) => String(x._id)));
    const faculty = await Faculty.findOne({ user: req.user.id });
    const ops = records
      .filter((r) => valid.has(String(r.student)) && ["Present", "Absent"].includes(r.status))
      .map((r) => ({
        updateOne: {
          filter: { student: r.student, subject, date: d },
          update: { $set: { status: r.status, markedBy: faculty ? faculty._id : undefined } },
          upsert: true,
        },
      }));
    if (ops.length) await Attendance.bulkWrite(ops);
    logAudit(req, {
      action: "update",
      entityType: "Attendance",
      entityLabel: `Bulk mark — ${sub.name} — ${d.toLocaleDateString()} (${ops.length} student${ops.length === 1 ? "" : "s"})`,
      after: { subject: sub.name, date: d, count: ops.length },
    });
    res.json({ success: true, saved: ops.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not save attendance" });
  }
});

// POST /api/attendance  (faculty, admin) - mark one student present/absent for a subject/date
router.post("/", protect, authorize("faculty", "admin"), async (req, res) => {
  try {
    const { student, subject, date, status } = req.body;
    if (!student || !subject || !date || !status) {
      return res.status(400).json({ success: false, message: "student, subject, date and status are required" });
    }

    if (!(await canManage(req, subject))) return res.status(403).json({ success: false, message: "You are not assigned to this subject" });
    const faculty = await Faculty.findOne({ user: req.user.id });
    const before = await Attendance.findOne({ student, subject, date: new Date(date) }).lean();

    const record = await Attendance.findOneAndUpdate(
      { student, subject, date: new Date(date) },
      { status, markedBy: faculty ? faculty._id : undefined },
      { new: true, upsert: true, runValidators: true }
    );

    const [stu, sub] = await Promise.all([
      Student.findById(student).select("name studentId"),
      Subject.findById(subject).select("name"),
    ]);
    logAudit(req, {
      action: before ? "update" : "create",
      entityType: "Attendance",
      entityId: record._id,
      entityLabel: `${stu ? stu.name + " (" + stu.studentId + ")" : student} — ${sub ? sub.name : subject} — ${new Date(date).toLocaleDateString()}`,
      before: before ? { status: before.status } : null,
      after: { status },
    });

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
  if (!(await canManage(req, req.params.subjectId))) return res.status(403).json({ success: false, message: "You are not assigned to this subject" });
  const filter = { subject: req.params.subjectId };
  if (req.query.date) filter.date = new Date(req.query.date);

  const records = await Attendance.find(filter).populate("student").sort({ date: -1 });
  res.json({ success: true, records });
});

module.exports = router;
