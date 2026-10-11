const express = require("express");
const path = require("path");
const fs = require("fs");
const router = express.Router();

const Admission = require("../models/Admission");
const { protect, authorize } = require("../middleware/auth");
const { uploadDocuments, UPLOAD_ROOT } = require("../middleware/upload");

const staff = [protect, authorize("admin", "faculty")];

function genTrackingId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GEHU-ADM-${stamp}${rand}`;
}

// POST /api/admissions - PUBLIC. Submit a new application, with optional document uploads.
router.post("/", (req, res) => {
  uploadDocuments(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, message: uploadErr.message || "Could not upload documents" });
    }
    try {
      const { name, email, phone, course, message } = req.body;
      if (!name || !email || !phone || !course) {
        // Uploaded files for a rejected submission shouldn't linger on disk
        (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
        return res.status(400).json({ success: false, message: "name, email, phone and course are required" });
      }

      const documents = (req.files || []).map((f) => ({
        originalName: f.originalname,
        storedName: f.filename,
        mimeType: f.mimetype,
        size: f.size,
      }));

      // trackingId collisions are astronomically unlikely, but retry once just in case
      let application;
      for (let attempt = 0; attempt < 2 && !application; attempt++) {
        try {
          application = await Admission.create({
            trackingId: genTrackingId(),
            name,
            email,
            phone,
            course,
            message,
            documents,
          });
        } catch (err) {
          if (err.code !== 11000 || attempt === 1) throw err;
        }
      }

      res.status(201).json({
        success: true,
        trackingId: application.trackingId,
        message: "Application submitted. Save your tracking ID to check its status later.",
      });
    } catch (err) {
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
      res.status(500).json({ success: false, message: "Could not submit application" });
    }
  });
});

// GET /api/admissions/track?trackingId=&email= - PUBLIC. Both fields required so a
// tracking ID alone (easy to guess the format of) can't be used to pull up someone else's application.
router.get("/track", async (req, res) => {
  try {
    const trackingId = String(req.query.trackingId || "").trim();
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!trackingId || !email) {
      return res.status(400).json({ success: false, message: "Tracking ID and email are required" });
    }

    const app = await Admission.findOne({ trackingId, email });
    if (!app) {
      // Same message whether the ID doesn't exist or the email doesn't match - no enumeration
      return res.status(404).json({ success: false, message: "No application found for that tracking ID and email" });
    }

    res.json({
      success: true,
      application: {
        trackingId: app.trackingId,
        name: app.name,
        course: app.course,
        status: app.status,
        reviewNotes: app.status === "Documents Required" ? app.reviewNotes : undefined,
        submittedAt: app.createdAt,
        updatedAt: app.updatedAt,
        documentsReceived: app.documents.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not look up application" });
  }
});

// GET /api/admissions?status=&course=&q=  (admin, faculty)
router.get("/", ...staff, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.course) filter.course = req.query.course;
    if (req.query.q) {
      const q = String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
        { phone: new RegExp(q, "i") },
        { trackingId: new RegExp(q, "i") },
      ];
    }
    const applications = await Admission.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load applications" });
  }
});

// GET /api/admissions/:id  (admin, faculty)
router.get("/:id", ...staff, async (req, res) => {
  const app = await Admission.findById(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: "Application not found" });
  res.json({ success: true, application: app });
});

// PATCH /api/admissions/:id  (admin, faculty) - update status and/or review notes
router.patch("/:id", ...staff, async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    const valid = ["Submitted", "Under Review", "Documents Required", "Approved", "Rejected"];
    const update = { reviewedBy: req.user.id };
    if (status !== undefined) {
      if (!valid.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
      update.status = status;
    }
    if (reviewNotes !== undefined) update.reviewNotes = reviewNotes;

    const app = await Admission.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!app) return res.status(404).json({ success: false, message: "Application not found" });
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not update application" });
  }
});

// GET /api/admissions/:id/documents/:docId  (admin, faculty) - stream one uploaded file securely
router.get("/:id/documents/:docId", ...staff, async (req, res) => {
  const app = await Admission.findById(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: "Application not found" });
  const doc = app.documents.id(req.params.docId);
  if (!doc) return res.status(404).json({ success: false, message: "Document not found" });

  const filePath = path.join(UPLOAD_ROOT, doc.storedName);
  if (!filePath.startsWith(UPLOAD_ROOT) || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "File is no longer available on the server" });
  }
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${doc.originalName.replace(/"/g, "")}"`);
  res.sendFile(filePath);
});

// DELETE /api/admissions/:id  (admin) - also removes its uploaded files from disk
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  const app = await Admission.findByIdAndDelete(req.params.id);
  if (!app) return res.status(404).json({ success: false, message: "Application not found" });
  app.documents.forEach((d) => fs.unlink(path.join(UPLOAD_ROOT, d.storedName), () => {}));
  res.json({ success: true, message: "Application deleted" });
});

module.exports = router;
