const express = require("express");
const router = express.Router();

const Student = require("../models/Student");
const Timetable = require("../models/Timetable");
const Exam = require("../models/Exam");
const Result = require("../models/Result");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Subject = require("../models/Subject");
const Faculty = require("../models/Faculty");
const { protect, authorize } = require("../middleware/auth");
const { logAudit } = require("../middleware/audit");

const staff = [protect, authorize("admin", "faculty")];
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    const msg = err.name === "ValidationError" || err.code === 11000 ? err.message : "Server error";
    res.status(err.code === 11000 || err.name === "ValidationError" ? 400 : 500).json({ success: false, message: msg });
  });

// The logged-in student's profile (course + semester decide what they see)
async function me(req, res) {
  const s = await Student.findOne({ user: req.user.id });
  if (!s || !s.course || !s.semester) {
    res.json({ success: true, items: [], note: "Course/semester not assigned yet" });
    return null;
  }
  return s;
}

/* ---------------- STUDENT (own data only) ---------------- */

router.get("/me/timetable", protect, authorize("student"), wrap(async (req, res) => {
  const s = await me(req, res); if (!s) return;
  const items = await Timetable.find({ course: s.course, semester: s.semester }).populate("subject").sort({ dayOfWeek: 1, startTime: 1 });
  res.json({ success: true, items });
}));

router.get("/me/exams", protect, authorize("student"), wrap(async (req, res) => {
  const s = await me(req, res); if (!s) return;
  const items = await Exam.find({ course: s.course, semester: s.semester }).populate("subject").sort({ date: 1 });
  res.json({ success: true, items });
}));

// Published results only: unpublished marks never leave the server for students
router.get("/me/results", protect, authorize("student"), wrap(async (req, res) => {
  const s = await Student.findOne({ user: req.user.id });
  if (!s) return res.json({ success: true, items: [] });
  const items = await Result.find({ student: s._id, published: true }).populate("subject").sort({ updatedAt: -1 });
  res.json({ success: true, items });
}));

router.get("/me/assignments", protect, authorize("student"), wrap(async (req, res) => {
  const s = await me(req, res); if (!s) return;
  const list = await Assignment.find({ course: s.course, semester: s.semester }).populate("subject").sort({ dueDate: 1 });
  const done = new Set((await Submission.find({ student: s._id })).map((x) => String(x.assignment)));
  const items = list.map((a) => ({ ...a.toObject(), done: done.has(String(a._id)) }));
  res.json({ success: true, items });
}));

router.post("/assignments/:id/done", protect, authorize("student"), wrap(async (req, res) => {
  const s = await Student.findOne({ user: req.user.id });
  if (!s) return res.status(404).json({ success: false, message: "Profile not found" });
  const a = await Assignment.findOne({ _id: req.params.id, course: s.course, semester: s.semester });
  if (!a) return res.status(404).json({ success: false, message: "Assignment not found" });
  await Submission.updateOne({ assignment: a._id, student: s._id }, {}, { upsert: true });
  res.json({ success: true });
}));

router.delete("/assignments/:id/done", protect, authorize("student"), wrap(async (req, res) => {
  const s = await Student.findOne({ user: req.user.id });
  if (!s) return res.status(404).json({ success: false, message: "Profile not found" });
  await Submission.deleteOne({ assignment: req.params.id, student: s._id });
  res.json({ success: true });
}));

/* ---------------- ADMIN / FACULTY (manage) ---------------- */

// null = unrestricted (admin); otherwise the subject ids this faculty member teaches
async function mySubjectIds(req) {
  if (req.user.role === "admin") return null;
  const f = await Faculty.findOne({ user: req.user.id });
  return f ? f.subjects.map(String) : [];
}
const owns = (ids, subjectId) => ids === null || ids.includes(String(subjectId));
const deny = (res) => res.status(403).json({ success: false, message: "You are not assigned to this subject" });
const bad = (res, m) => res.status(400).json({ success: false, message: m });

// Subjects the caller may manage (faculty: only their own)
router.get("/faculty/subjects", ...staff, wrap(async (req, res) => {
  const ids = await mySubjectIds(req);
  const items = await Subject.find(ids === null ? {} : { _id: { $in: ids } }).populate("course").sort({ name: 1 });
  res.json({ success: true, items });
}));

// Students enrolled for a subject = students of its course + semester
router.get("/faculty/subjects/:id/students", ...staff, wrap(async (req, res) => {
  if (!owns(await mySubjectIds(req), req.params.id)) return deny(res);
  const sub = await Subject.findById(req.params.id);
  if (!sub) return res.status(404).json({ success: false, message: "Subject not found" });
  const items = await Student.find({ course: sub.course, semester: sub.semester }).select("name studentId email phone").sort({ studentId: 1 });
  res.json({ success: true, items });
}));

// Timetable / exams are admin-managed (faculty can view their own subjects'); assignments are faculty-managed.
// course + semester are always taken from the chosen subject, never trusted from the request.
function crud(path, Model, fields, writeRoles) {
  router.get(`/${path}`, ...staff, wrap(async (req, res) => {
    const ids = await mySubjectIds(req);
    const f = {};
    if (req.query.course) f.course = req.query.course;
    if (req.query.semester) f.semester = Number(req.query.semester);
    if (ids !== null) f.subject = { $in: ids };
    const items = await Model.find(f).populate("subject").sort({ createdAt: -1 });
    res.json({ success: true, items });
  }));
  router.post(`/${path}`, protect, authorize(...writeRoles), wrap(async (req, res) => {
    if (!owns(await mySubjectIds(req), req.body.subject)) return deny(res);
    const sub = await Subject.findById(req.body.subject);
    if (!sub) return bad(res, "Choose a valid subject");
    const data = {};
    fields.forEach((k) => { if (req.body[k] !== undefined && req.body[k] !== "") data[k] = req.body[k]; });
    data.course = sub.course;
    data.semester = sub.semester;
    if (path === "assignments") data.postedBy = req.user.id;
    const item = await Model.create(data);
    res.status(201).json({ success: true, item });
  }));
  router.delete(`/${path}/:id`, protect, authorize(...writeRoles), wrap(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    if (!owns(await mySubjectIds(req), doc.subject)) return deny(res);
    await doc.deleteOne();
    if (path === "assignments") await Submission.deleteMany({ assignment: doc._id });
    res.json({ success: true });
  }));
}
crud("timetable", Timetable, ["subject", "dayOfWeek", "startTime", "endTime", "room"], ["admin"]);
crud("exams", Exam, ["subject", "title", "date", "startTime", "venue"], ["admin"]);
crud("assignments", Assignment, ["subject", "title", "description", "dueDate"], ["admin", "faculty"]);

// Single result by roll number (admin page)
router.post("/results", ...staff, wrap(async (req, res) => {
  const { studentId, subject, examTitle, marksObtained, maxMarks, published } = req.body;
  if (!owns(await mySubjectIds(req), subject)) return deny(res);
  const sub = await Subject.findById(subject);
  const st = await Student.findOne({ studentId: String(studentId || "").trim() });
  if (!sub || !st) return res.status(404).json({ success: false, message: "Subject or student not found" });
  if (String(st.course) !== String(sub.course) || st.semester !== sub.semester) return bad(res, "That student is not in this subject's course/semester");
  if (Number(marksObtained) > Number(maxMarks)) return bad(res, "Marks cannot exceed max marks");
  const before = await Result.findOne({ student: st._id, subject, examTitle }).lean();
  const item = await Result.findOneAndUpdate(
    { student: st._id, subject, examTitle },
    { marksObtained, maxMarks, published: !!published },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  logAudit(req, {
    action: before ? "update" : "create",
    entityType: "Result",
    entityId: item._id,
    entityLabel: `${st.name} (${st.studentId}) — ${sub.name} — ${examTitle}`,
    before: before ? { marksObtained: before.marksObtained, maxMarks: before.maxMarks, published: before.published } : null,
    after: { marksObtained: item.marksObtained, maxMarks: item.maxMarks, published: item.published },
  });
  res.status(201).json({ success: true, item });
}));

// Whole class at once (faculty portal): entries = [{ student: <_id>, marks }]; blank marks are skipped
router.post("/results/bulk", ...staff, wrap(async (req, res) => {
  const { subject, examTitle, maxMarks, published, entries } = req.body;
  if (!owns(await mySubjectIds(req), subject)) return deny(res);
  const sub = await Subject.findById(subject);
  const max = Number(maxMarks);
  if (!sub || !String(examTitle || "").trim() || !(max > 0) || !Array.isArray(entries)) return bad(res, "Subject, exam name, max marks and entries are required");
  const valid = new Set((await Student.find({ course: sub.course, semester: sub.semester }).select("_id")).map((s) => String(s._id)));
  const ops = [];
  for (const e of entries) {
    if (e.marks === "" || e.marks == null) continue;
    const m = Number(e.marks);
    if (!valid.has(String(e.student)) || isNaN(m) || m < 0 || m > max) return bad(res, "Invalid marks entry (must be between 0 and max marks)");
    ops.push({ updateOne: { filter: { student: e.student, subject, examTitle: String(examTitle).trim() }, update: { $set: { marksObtained: m, maxMarks: max, published: !!published } }, upsert: true } });
  }
  if (ops.length) await Result.bulkWrite(ops);
  logAudit(req, {
    action: "update",
    entityType: "Result",
    entityLabel: `Bulk entry — ${sub.name} — ${examTitle} (${ops.length} student${ops.length === 1 ? "" : "s"})`,
    after: { subject: sub.name, examTitle, maxMarks: max, published: !!published, count: ops.length },
  });
  res.json({ success: true, saved: ops.length });
}));

router.get("/results", ...staff, wrap(async (req, res) => {
  const ids = await mySubjectIds(req);
  const f = {};
  if (req.query.subject) { if (!owns(ids, req.query.subject)) return deny(res); f.subject = req.query.subject; }
  else if (ids !== null) f.subject = { $in: ids };
  if (req.query.examTitle) f.examTitle = req.query.examTitle;
  const items = await Result.find(f).populate("subject").populate("student", "name studentId").sort({ updatedAt: -1 }).limit(500);
  res.json({ success: true, items });
}));

// Publish every draft result for a subject + exam in one go
router.put("/results/publish", ...staff, wrap(async (req, res) => {
  const { subject, examTitle } = req.body;
  if (!owns(await mySubjectIds(req), subject)) return deny(res);
  const r = await Result.updateMany({ subject, examTitle }, { published: true });
  const subDoc = await Subject.findById(subject).select("name");
  logAudit(req, {
    action: "update",
    entityType: "Result",
    entityLabel: `Published all results — ${subDoc ? subDoc.name : subject} — ${examTitle} (${r.modifiedCount} updated)`,
    after: { subject: subDoc ? subDoc.name : subject, examTitle, published: true, count: r.modifiedCount },
  });
  res.json({ success: true, published: r.modifiedCount });
}));

router.delete("/results/:id", ...staff, wrap(async (req, res) => {
  const doc = await Result.findById(req.params.id).populate("subject", "name").populate("student", "name studentId");
  if (!doc) return res.status(404).json({ success: false, message: "Not found" });
  if (!owns(await mySubjectIds(req), doc.subject?._id)) return deny(res);
  logAudit(req, {
    action: "delete",
    entityType: "Result",
    entityId: doc._id,
    entityLabel: `${doc.student?.name || "?"} (${doc.student?.studentId || "?"}) — ${doc.subject?.name || "?"} — ${doc.examTitle}`,
    before: { marksObtained: doc.marksObtained, maxMarks: doc.maxMarks, published: doc.published },
  });
  await doc.deleteOne();
  res.json({ success: true });
}));

module.exports = router;
