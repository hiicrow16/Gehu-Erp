const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { protect, authorize } = require("../middleware/auth");

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/audit?entity=&action=&actor=&q=&from=&to=&page=&limit=   (admin only, read-only)
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const f = {};
    if (req.query.entity) f.entity = String(req.query.entity);
    if (req.query.action) f.action = String(req.query.action);
    if (req.query.actor) f["actor.name"] = new RegExp(esc(String(req.query.actor).trim()), "i");
    if (req.query.q) {
      const r = new RegExp(esc(String(req.query.q).trim()), "i");
      f.$or = [{ summary: r }, { "changes.label": r }, { entityId: r }];
    }
    const at = {};
    if (req.query.from && !isNaN(new Date(req.query.from))) at.$gte = new Date(req.query.from);
    if (req.query.to && !isNaN(new Date(req.query.to))) at.$lte = new Date(new Date(req.query.to).getTime() + 86399999);
    if (Object.keys(at).length) f.at = at;

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const [logs, total] = await Promise.all([
      AuditLog.find(f).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(f),
    ]);
    res.json({ success: true, logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load the audit log" });
  }
});

module.exports = router;
