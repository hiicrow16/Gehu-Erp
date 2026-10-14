const express = require("express");
const router = express.Router();

const FaceProfile = require("../models/FaceProfile");
const FacultyAttendance = require("../models/FacultyAttendance");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Subject = require("../models/Subject");
const { protect, authorize } = require("../middleware/auth");
const { record: auditRecord } = require("../lib/audit");

const MAX_PHOTO_BYTES = 600 * 1024; // browser resizes to ~480px, so real files are ~30-80KB
const day = (s) => { const d = new Date(s); return isNaN(d) ? null : d; };
const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };

async function canManage(req, subjectId) {
  if (req.user.role === "admin") return true;
  const f = await Faculty.findOne({ user: req.user.id });
  return !!f && f.subjects.map(String).includes(String(subjectId));
}

// GET /api/face/people?kind=student|faculty  (admin) - everyone + whether a face is enrolled
router.get("/people", protect, authorize("admin"), async (req, res) => {
  try {
    const kind = req.query.kind === "faculty" ? "faculty" : "student";
    const profiles = await FaceProfile.find({ kind }).select("student faculty updatedAt");
    const done = new Map(profiles.map((p) => [String(kind === "student" ? p.student : p.faculty), p]));
    const list = kind === "student"
      ? await Student.find().populate("course", "name").sort({ studentId: 1 })
      : await Faculty.find().sort({ facultyId: 1 });
    res.json({
      success: true,
      people: list.map((x) => ({
        id: x._id, code: kind === "student" ? x.studentId : x.facultyId, name: x.name,
        info: kind === "student" ? `${x.course ? x.course.name : "-"}${x.semester ? " · Sem " + x.semester : ""}` : x.department || "",
        enrolled: done.has(String(x._id)), enrolledAt: done.get(String(x._id)) ? done.get(String(x._id)).updatedAt : null,
        profileId: done.get(String(x._id)) ? done.get(String(x._id))._id : null,
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load people" });
  }
});

// POST /api/face/enroll  (admin) { kind, personId, descriptor[128], photo: "data:image/jpeg;base64,..." }
router.post("/enroll", protect, authorize("admin"), async (req, res) => {
  try {
    const { kind, personId, descriptor, photo } = req.body || {};
    if (!["student", "faculty"].includes(kind) || !personId) return res.status(400).json({ success: false, message: "kind and personId are required" });
    if (!Array.isArray(descriptor) || descriptor.length !== 128 || !descriptor.every((n) => typeof n === "number" && isFinite(n))) {
      return res.status(400).json({ success: false, message: "A valid face descriptor is required" });
    }
    const person = kind === "student" ? await Student.findById(personId) : await Faculty.findById(personId);
    if (!person) return res.status(404).json({ success: false, message: "Person not found" });

    let buf, type = "image/jpeg";
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo || "");
    if (m) { type = m[1]; buf = Buffer.from(m[2], "base64"); if (buf.length > MAX_PHOTO_BYTES) return res.status(400).json({ success: false, message: "Photo is too large" }); }

    const key = kind === "student" ? { student: personId } : { faculty: personId };
    const update = { kind, ...key, descriptor, enrolledBy: req.user.id };
    if (buf) { update.photo = buf; update.photoType = type; }
    await FaceProfile.findOneAndUpdate({ kind, ...key }, update, { upsert: true, new: true, setDefaultsOnInsert: true });

    await auditRecord(req, { action: "face-enroll", entity: "Face profile", entityId: personId, summary: `Enrolled face of ${kind} ${person.name} from ID photo` });
    res.status(201).json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not save face profile" });
  }
});

// DELETE /api/face/:profileId  (admin) - remove a face template + photo
router.delete("/:profileId", protect, authorize("admin"), async (req, res) => {
  try {
    const p = await FaceProfile.findByIdAndDelete(req.params.profileId);
    if (p) await auditRecord(req, { action: "face-delete", entity: "Face profile", entityId: p._id, summary: `Deleted a ${p.kind} face profile` });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not delete" });
  }
});

// GET /api/face/photo/:profileId  (admin) - the stored ID-card photo
router.get("/photo/:profileId", protect, authorize("admin"), async (req, res) => {
  try {
    const p = await FaceProfile.findById(req.params.profileId).select("+photo photoType");
    if (!p || !p.photo) return res.status(404).end();
    res.set({ "Content-Type": p.photoType, "Cache-Control": "private, no-store" }).send(p.photo);
  } catch (e) {
    res.status(404).end();
  }
});

// GET /api/face/roster/subject/:subjectId  (faculty of that subject, admin) - templates for one class
router.get("/roster/subject/:subjectId", protect, authorize("faculty", "admin"), async (req, res) => {
  try {
    if (!(await canManage(req, req.params.subjectId))) return res.status(403).json({ success: false, message: "You are not assigned to this subject" });
    const sub = await Subject.findById(req.params.subjectId);
    if (!sub) return res.status(404).json({ success: false, message: "Subject not found" });
    const students = await Student.find({ course: sub.course, semester: sub.semester }).select("studentId name").sort({ studentId: 1 });
    const profiles = await FaceProfile.find({ kind: "student", student: { $in: students.map((s) => s._id) } }).select("student descriptor");
    const d = new Map(profiles.map((p) => [String(p.student), p.descriptor]));
    res.set("Cache-Control", "no-store").json({
      success: true,
      roster: students.map((s) => ({ id: s._id, code: s.studentId, name: s.name, descriptor: d.get(String(s._id)) || null })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load class roster" });
  }
});

// POST /api/face/mark  (faculty of that subject, admin) { subject, date, students: [id...] }
// Marks the recognised students Present (method "face"). Never downgrades anyone to Absent.
router.post("/mark", protect, authorize("faculty", "admin"), async (req, res) => {
  try {
    const { subject, date, students } = req.body || {};
    const d = day(date);
    if (!subject || !d || !Array.isArray(students)) return res.status(400).json({ success: false, message: "subject, date and students are required" });
    if (!(await canManage(req, subject))) return res.status(403).json({ success: false, message: "You are not assigned to this subject" });
    const sub = await Subject.findById(subject);
    if (!sub) return res.status(404).json({ success: false, message: "Subject not found" });
    const valid = new Set((await Student.find({ course: sub.course, semester: sub.semester }).select("_id")).map((x) => String(x._id)));
    const ids = [...new Set(students.map(String))].filter((i) => valid.has(i));
    const faculty = await Faculty.findOne({ user: req.user.id });
    if (ids.length) {
      await Attendance.bulkWrite(ids.map((s) => ({
        updateOne: { filter: { student: s, subject, date: d }, update: { $set: { status: "Present", method: "face", markedBy: faculty ? faculty._id : undefined } }, upsert: true },
      })));
      await auditRecord(req, { action: "mark-attendance", entity: "Attendance", entityId: subject, summary: `Face attendance: ${ids.length} student(s) marked Present in ${sub.name} on ${d.toISOString().slice(0, 10)}` });
    }
    res.json({ success: true, saved: ids.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not save attendance" });
  }
});

// GET /api/face/roster/faculty  (admin) - all enrolled faculty templates (for the gate kiosk)
router.get("/roster/faculty", protect, authorize("admin"), async (req, res) => {
  try {
    const list = await Faculty.find().select("facultyId name department").sort({ facultyId: 1 });
    const profiles = await FaceProfile.find({ kind: "faculty" }).select("faculty descriptor");
    const d = new Map(profiles.map((p) => [String(p.faculty), p.descriptor]));
    res.set("Cache-Control", "no-store").json({ success: true, roster: list.map((f) => ({ id: f._id, code: f.facultyId, name: f.name, descriptor: d.get(String(f._id)) || null })) });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load faculty" });
  }
});

// POST /api/face/faculty-checkin  (admin) { faculty }  - first scan of the day is kept
router.post("/faculty-checkin", protect, authorize("admin"), async (req, res) => {
  try {
    const f = await Faculty.findById(req.body.faculty);
    if (!f) return res.status(404).json({ success: false, message: "Faculty not found" });
    const date = todayUTC();
    const existing = await FacultyAttendance.findOne({ faculty: f._id, date });
    if (existing) return res.json({ success: true, already: true, checkIn: existing.checkIn });
    const rec = await FacultyAttendance.create({ faculty: f._id, date, checkIn: new Date(), method: "face", markedBy: req.user.id });
    await auditRecord(req, { action: "faculty-checkin", entity: "Faculty attendance", entityId: f._id, summary: `Face check-in: ${f.facultyId} - ${f.name}` });
    res.status(201).json({ success: true, already: false, checkIn: rec.checkIn });
  } catch (e) {
    if (e.code === 11000) return res.json({ success: true, already: true });
    res.status(500).json({ success: false, message: "Could not record check-in" });
  }
});

// GET /api/face/faculty-attendance?date=YYYY-MM-DD  (admin) - who checked in
router.get("/faculty-attendance", protect, authorize("admin"), async (req, res) => {
  try {
    const d = req.query.date ? day(req.query.date) : todayUTC();
    if (!d) return res.status(400).json({ success: false, message: "Bad date" });
    const recs = await FacultyAttendance.find({ date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }).populate("faculty", "facultyId name department");
    res.json({ success: true, records: recs });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load" });
  }
});

module.exports = router;
