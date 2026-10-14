const mongoose = require("mongoose");

// A record of who changed attendance, grades (Results), or student details, and when.
// Deliberately schema-loose (Mixed before/after) since it covers several entity types.
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ["create", "update", "delete"], required: true },
    entityType: { type: String, required: true, trim: true }, // "Attendance" | "Result" | "Student"
    entityId: { type: mongoose.Schema.Types.ObjectId },
    entityLabel: { type: String, trim: true }, // human-readable summary, e.g. "Jane Doe — Data Structures"
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    performedByRole: { type: String, trim: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
