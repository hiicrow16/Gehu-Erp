const mongoose = require("mongoose");

// Append-only record of who changed what, and when.
// Updates and deletes are blocked at the model level, so a bug or a stray
// route can't rewrite history. (Someone with direct database access still can.)
const auditSchema = new mongoose.Schema(
  {
    actor: {
      id: String,
      name: String, // login username at the time
      role: String,
    },
    action: { type: String, required: true }, // create, update, delete, mark-attendance, enter-marks, ...
    entity: { type: String, required: true, index: true }, // Student, Attendance, Result, Faculty, ...
    entityId: String,
    summary: { type: String, required: true },
    // Field-level before/after, e.g. { label: "22001 - Asha", field: "status", from: "Absent", to: "Present" }
    changes: { type: [{ label: String, field: String, from: mongoose.Schema.Types.Mixed, to: mongoose.Schema.Types.Mixed, _id: false }], default: [] },
    details: mongoose.Schema.Types.Mixed,
    ip: String,
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

const blocked = function () { throw new Error("Audit log entries cannot be modified or deleted"); };
["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"].forEach((op) => auditSchema.pre(op, blocked));

module.exports = mongoose.model("AuditLog", auditSchema);
