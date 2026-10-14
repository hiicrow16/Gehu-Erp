const express = require("express");
const router = express.Router();

const AuditLog = require("../models/AuditLog");
const { protect, authorize } = require("../middleware/auth");

// GET /api/audit?entityType=&action=&from=&to=&limit=  (admin)
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const filter = {};
    if (req.query.entityType) filter.entityType = req.query.entityType;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to + "T23:59:59.999Z");
    }
    const limit = Math.min(Number(req.query.limit) || 200, 500);

    const logs = await AuditLog.find(filter)
      .populate("performedBy", "username")
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load audit logs" });
  }
});

module.exports = router;
