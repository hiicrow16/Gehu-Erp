const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true }, // e.g. "10th marksheet", "ID proof"
    originalName: { type: String, required: true, trim: true },
    storedName: { type: String, required: true, trim: true }, // randomized name on disk - never trust the original name
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const admissionSchema = new mongoose.Schema(
  {
    trackingId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    message: { type: String, trim: true }, // optional note from the applicant

    status: {
      type: String,
      enum: ["Submitted", "Under Review", "Documents Required", "Approved", "Rejected"],
      default: "Submitted",
    },
    reviewNotes: { type: String, trim: true }, // admin-facing note, e.g. what document is missing
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    documents: [documentSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admission", admissionSchema);
