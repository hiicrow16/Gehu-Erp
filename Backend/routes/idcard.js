const express = require("express");
const router = express.Router();

const Student = require("../models/Student");
const UsedIdToken = require("../models/UsedIdToken");
const { issueToken, checkToken, validUntil, REFRESH_SECONDS } = require("../lib/idCard");
const { record } = require("../lib/audit");
const { protect, authorize } = require("../middleware/auth");

const load = (id) => Student.findById(id).populate("course", "name durationYears").populate("user", "isActive");

function cardOf(s) {
  const until = validUntil(s.admissionYear, s.course && s.course.durationYears);
  const active = !s.user || s.user.isActive !== false;
  return {
    name: s.name, studentId: s.studentId,
    course: s.course ? s.course.name : null, semester: s.semester || null,
    department: s.department || null, admissionYear: s.admissionYear || null,
    validUntil: until, expired: !!until && until < new Date(), active,
  };
}

// GET /api/idcard/me  (student) - the student's own card details + a fresh QR token
router.get("/me", protect, authorize("student"), async (req, res) => {
  try {
    const s = await load(req.user.profileId);
    if (!s) return res.status(404).json({ success: false, message: "Student profile not found" });
    const { token, expiresAt } = issueToken(s._id);
    res.set("Cache-Control", "no-store");
    res.json({ success: true, card: cardOf(s), token, expiresAt, refreshSeconds: REFRESH_SECONDS, serverTime: Date.now() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load your ID card" });
  }
});

// POST /api/idcard/verify  { token }  (admin, faculty) - check a scanned QR
router.post("/verify", protect, authorize("admin", "faculty"), async (req, res) => {
  const reject = async (reason, student) => {
    await record(req, { action: "verify-id-failed", entity: "Student ID", entityId: student && student._id, summary: `Rejected an ID scan: ${reason}` });
    res.set("Cache-Control", "no-store").json({ success: true, valid: false, reason });
  };
  try {
    const t = checkToken(req.body.token);
    if (!t.ok) return reject(t.reason);

    const s = await load(t.studentId);
    if (!s) return reject("No student matches this code.");
    const card = cardOf(s);
    if (!card.active) return reject("This student's account is disabled.", s);

    // One scan per code: a second use of the same QR is refused
    try {
      await UsedIdToken.create({ jti: t.jti, expireAt: new Date((t.exp + 120) * 1000) });
    } catch (e) {
      if (e.code === 11000) return reject("This code was already scanned. Ask the student to refresh their card for a new one.", s);
      throw e;
    }

    await record(req, { action: "verify-id", entity: "Student ID", entityId: s._id, summary: `Verified ID of ${s.studentId} - ${s.name}${card.expired ? " (card expired)" : ""}` });
    res.set("Cache-Control", "no-store").json({
      success: true, valid: true, cardStatus: card.expired ? "Expired" : "Valid", student: card, verifiedAt: new Date(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not verify this code" });
  }
});

module.exports = router;
