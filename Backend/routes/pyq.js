const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const multer = require("multer");
const router = express.Router();

const Pyq = require("../models/Pyq");
const Course = require("../models/Course");
const Subject = require("../models/Subject");
const { protect, optionalAuth, authorize } = require("../middleware/auth");
const { record: auditRecord } = require("../lib/audit");

const MAX_BYTES = 6 * 1024 * 1024;            // 6 MB per paper
const UPLOADS_PER_HOUR = 5;                    // per visitor (by hashed IP)
const EXAM_TYPES = ["Mid-term", "End-term", "Supplementary", "Other"];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 12 } }).single("file");

const salt = () => process.env.JWT_SECRET || "gehu-pyq";
const hashIp = (ip) => crypto.createHash("sha256").update(`${salt()}:${ip || ""}`).digest("hex").slice(0, 32);
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const validId = (id) => mongoose.isValidObjectId(id);
const maxYear = () => new Date().getFullYear() + 1;

// Real file type from the first bytes - the browser-supplied type and filename are never trusted.
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf.slice(0, 5).toString("latin1") === "%PDF-") return { type: "application/pdf", ext: "pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: "image/png", ext: "png" };
  if (buf.slice(0, 4).toString("latin1") === "RIFF" && buf.slice(8, 12).toString("latin1") === "WEBP") return { type: "image/webp", ext: "webp" };
  return null;
}

// Simple in-memory limiter (resets if the server restarts; fine for a college site).
// Only papers that were actually saved count, so a typo in the form never locks anyone out.
const hits = new Map();
const recentHits = (key, now = Date.now()) => (hits.get(key) || []).filter((t) => now - t < 3600e3);
const isLimited = (key) => recentHits(key).length >= UPLOADS_PER_HOUR;
function markHit(key) {
  const now = Date.now(); hits.set(key, [...recentHits(key, now), now]);
  if (hits.size > 5000) for (const [k] of hits) if (!recentHits(k, now).length) hits.delete(k);
}

const card = (p) => ({
  id: p._id, title: `${p.subjectName} - ${p.examType} ${p.examYear}`,
  course: p.course && p.course.name ? p.course.name : null, courseId: p.course && p.course._id ? p.course._id : p.course,
  semester: p.semester || null, subjectName: p.subjectName, examType: p.examType, examYear: p.examYear,
  sharedBy: p.uploaderName || null, contentType: p.contentType, size: p.size, downloads: p.downloads || 0, createdAt: p.createdAt,
});

// ---------------------------------------------------------------- public ----------------------------------------------------------------

// GET /api/pyq/meta - courses and known subjects, to fill the upload and filter forms
router.get("/meta", async (req, res) => {
  try {
    const [courses, subjects] = await Promise.all([
      Course.find().select("name").sort({ name: 1 }).lean(),
      Subject.find().select("name course semester").sort({ name: 1 }).lean(),
    ]);
    res.set("Cache-Control", "public, max-age=300").json({
      success: true, maxMb: MAX_BYTES / 1048576, examTypes: EXAM_TYPES, maxYear: maxYear(),
      courses: courses.map((c) => ({ id: c._id, name: c.name })),
      subjects: subjects.map((s) => ({ name: s.name, course: s.course, semester: s.semester })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load options" });
  }
});

// GET /api/pyq?course=&semester=&year=&type=&q=&page=  - approved papers only
router.get("/", async (req, res) => {
  try {
    const f = { status: "approved" };
    if (req.query.course && validId(req.query.course)) f.course = req.query.course;
    if (Number(req.query.semester)) f.semester = Number(req.query.semester);
    if (Number(req.query.year)) f.examYear = Number(req.query.year);
    if (EXAM_TYPES.includes(req.query.type)) f.examType = req.query.type;
    const q = clean(req.query.q, 60);
    if (q) f.subjectName = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 60), page = Math.max(Number(req.query.page) || 1, 1);
    const [items, total] = await Promise.all([
      Pyq.find(f).populate("course", "name").sort({ examYear: -1, subjectName: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Pyq.countDocuments(f),
    ]);
    res.json({ success: true, total, page, pages: Math.ceil(total / limit) || 1, items: items.map(card) });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load papers" });
  }
});

// POST /api/pyq  (multipart: file + fields) - anyone; goes into the review queue
router.post("/", (req, res) => {
  upload(req, res, async (err) => {
    try {
      if (err) {
        const big = err.code === "LIMIT_FILE_SIZE";
        return res.status(big ? 413 : 400).json({ success: false, message: big ? `The file is larger than ${MAX_BYTES / 1048576} MB.` : "Could not read the upload." });
      }
      const b = req.body || {};
      if (b.website) return res.status(201).json({ success: true, message: "Thanks - your paper is waiting for review." }); // honeypot: pretend success to bots
      const ip = hashIp(req.ip);
      if (isLimited(ip)) return res.status(429).json({ success: false, message: "You have reached the upload limit for now. Please try again in an hour." });

      if (!req.file) return res.status(400).json({ success: false, message: "Choose a file to upload." });
      const kind = sniff(req.file.buffer);
      if (!kind) return res.status(400).json({ success: false, message: "Only PDF, JPG, PNG or WEBP files are accepted." });

      const subjectName = clean(b.subjectName, 120), year = Number(b.examYear);
      const examType = EXAM_TYPES.includes(b.examType) ? b.examType : "End-term";
      const semester = Number(b.semester) || undefined;
      if (!validId(b.course) || !(await Course.exists({ _id: b.course }))) return res.status(400).json({ success: false, message: "Choose a course." });
      if (subjectName.length < 2) return res.status(400).json({ success: false, message: "Enter the subject name." });
      if (!Number.isInteger(year) || year < 2000 || year > maxYear()) return res.status(400).json({ success: false, message: "Enter a valid exam year." });
      if (semester && (semester < 1 || semester > 12)) return res.status(400).json({ success: false, message: "Semester must be between 1 and 12." });
      if (String(b.rights) !== "true" && String(b.rights) !== "on") return res.status(400).json({ success: false, message: "Please confirm this is a past exam paper you are allowed to share." });

      const sha256 = crypto.createHash("sha256").update(req.file.buffer).digest("hex");
      if (await Pyq.exists({ sha256, status: { $in: ["pending", "approved"] } })) {
        return res.status(409).json({ success: false, message: "This exact file has already been uploaded." });
      }
      await Pyq.create({
        course: b.course, semester, subjectName, examType, examYear: year, uploaderName: clean(b.uploaderName, 60) || undefined,
        originalName: clean(req.file.originalname, 160), contentType: kind.type, size: req.file.size, sha256, data: req.file.buffer, ipHash: ip,
      });
      markHit(ip);
      res.status(201).json({ success: true, message: "Thanks - your paper is waiting for review. It will appear once an admin approves it." });
    } catch (e) {
      console.error("PYQ upload failed:", e.message);
      res.status(500).json({ success: false, message: "Could not save the paper. Please try again." });
    }
  });
});

// ---------------------------------------------------------------- admin ----------------------------------------------------------------

// GET /api/pyq/admin/list?status=pending|approved|rejected|all
router.get("/admin/list", protect, authorize("admin"), async (req, res) => {
  try {
    const f = ["pending", "approved", "rejected"].includes(req.query.status) ? { status: req.query.status } : {};
    const q = clean(req.query.q, 60);
    if (q) f.subjectName = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const [items, counts] = await Promise.all([
      Pyq.find(f).populate("course", "name").populate("reviewedBy", "username").sort({ createdAt: -1 }).limit(200).lean(),
      Pyq.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);
    const c = { pending: 0, approved: 0, rejected: 0 }; counts.forEach((x) => { c[x._id] = x.n; });
    res.set("Cache-Control", "no-store").json({
      success: true, counts: c,
      items: items.map((p) => ({ ...card(p), status: p.status, rejectReason: p.rejectReason || null, originalName: p.originalName, reviewedBy: p.reviewedBy && p.reviewedBy.username, reviewedAt: p.reviewedAt })),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load the queue" });
  }
});

// PATCH /api/pyq/admin/:id/review  { action: "approve"|"reject", reason?, edits?: {subjectName, semester, examYear, examType, course} }
router.patch("/admin/:id/review", protect, authorize("admin"), async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Bad id" });
    const { action, reason, edits } = req.body || {};
    if (!["approve", "reject"].includes(action)) return res.status(400).json({ success: false, message: "action must be approve or reject" });
    const p = await Pyq.findById(req.params.id);
    if (!p) return res.status(404).json({ success: false, message: "Paper not found" });

    if (edits && typeof edits === "object") { // admin can fix typos before publishing
      if (edits.subjectName != null) { const s = clean(edits.subjectName, 120); if (s.length < 2) return res.status(400).json({ success: false, message: "Subject name is too short" }); p.subjectName = s; }
      if (edits.examYear != null) { const y = Number(edits.examYear); if (!Number.isInteger(y) || y < 2000 || y > maxYear()) return res.status(400).json({ success: false, message: "Bad year" }); p.examYear = y; }
      if (edits.semester != null) { const s = Number(edits.semester); p.semester = s >= 1 && s <= 12 ? s : undefined; }
      if (edits.examType && EXAM_TYPES.includes(edits.examType)) p.examType = edits.examType;
      if (edits.course && validId(edits.course) && (await Course.exists({ _id: edits.course }))) p.course = edits.course;
    }
    p.status = action === "approve" ? "approved" : "rejected";
    p.rejectReason = action === "reject" ? clean(reason, 300) || "Not accepted" : undefined;
    p.reviewedBy = req.user.id; p.reviewedAt = new Date();
    await p.save();
    await auditRecord(req, { action: `pyq-${action}`, entity: "Question paper", entityId: p._id, summary: `${action === "approve" ? "Approved" : "Rejected"} paper: ${p.subjectName} ${p.examType} ${p.examYear}${action === "reject" ? ` (${p.rejectReason})` : ""}` });
    res.json({ success: true, status: p.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Could not update the paper" });
  }
});

// DELETE /api/pyq/admin/:id
router.delete("/admin/:id", protect, authorize("admin"), async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Bad id" });
    const p = await Pyq.findById(req.params.id).select("subjectName examType examYear");
    if (p) await Pyq.deleteOne({ _id: p._id });
    if (p) await auditRecord(req, { action: "pyq-delete", entity: "Question paper", entityId: req.params.id, summary: `Deleted paper: ${p.subjectName} ${p.examType} ${p.examYear}` });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not delete" });
  }
});

// GET /api/pyq/:id/file - approved papers are public; pending/rejected only for an admin
router.get("/:id/file", optionalAuth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).end();
    const p = await Pyq.findById(req.params.id).select("+data subjectName examType examYear contentType status");
    const isAdmin = req.user && req.user.role === "admin";
    if (!p || (p.status !== "approved" && !isAdmin)) return res.status(404).end();
    if (p.status === "approved" && !isAdmin) Pyq.updateOne({ _id: p._id }, { $inc: { downloads: 1 } }).catch(() => {});
    const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[p.contentType] || "bin";
    const name = `${p.subjectName}-${p.examType}-${p.examYear}`.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 100) + "." + ext;
    res.set({
      "Content-Type": p.contentType, "Content-Length": p.data.length, "Content-Disposition": `inline; filename="${name}"`,
      "X-Content-Type-Options": "nosniff", "Cache-Control": p.status === "approved" ? "public, max-age=3600" : "private, no-store",
    }).send(p.data);
  } catch (e) {
    res.status(404).end();
  }
});

module.exports = router;
