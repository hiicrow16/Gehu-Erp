const mongoose = require("mongoose");

// A previous-year question paper. Anyone can submit one (no login); it stays hidden until an admin approves it.
// The file itself lives in the database (select:false, so list queries never load it) because the
// hosting disk is wiped on every redeploy.
const pyqSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    semester: { type: Number, min: 1, max: 12 },
    subjectName: { type: String, required: true, trim: true, maxlength: 120 },
    examType: { type: String, enum: ["Mid-term", "End-term", "Supplementary", "Other"], default: "End-term" },
    examYear: { type: Number, required: true, min: 2000 },
    uploaderName: { type: String, trim: true, maxlength: 60 }, // optional, shown as "Shared by"

    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    rejectReason: { type: String, trim: true, maxlength: 300 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },

    originalName: { type: String, maxlength: 160 },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true, index: true }, // blocks the same file being submitted twice
    data: { type: Buffer, required: true, select: false },

    ipHash: { type: String, select: false }, // salted hash, only for tracing abuse - never the raw IP
    downloads: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pyqSchema.index({ status: 1, course: 1, semester: 1, examYear: -1 });

module.exports = mongoose.model("Pyq", pyqSchema);
