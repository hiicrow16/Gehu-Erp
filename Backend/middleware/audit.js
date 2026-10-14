const AuditLog = require("../models/AuditLog");

// Writes one audit trail entry. Never allowed to break the real request -
// a logging failure is swallowed (and printed) rather than surfaced to the caller.
async function logAudit(req, { action, entityType, entityId, entityLabel, before, after }) {
  try {
    if (!req.user || !req.user.id) return; // only ever called from authenticated routes
    await AuditLog.create({
      action,
      entityType,
      entityId,
      entityLabel,
      performedBy: req.user.id,
      performedByRole: req.user.role,
      before,
      after,
    });
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
}

module.exports = { logAudit };
