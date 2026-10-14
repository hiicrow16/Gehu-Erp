const mongoose = require("mongoose");

// One face template per person (student OR faculty), built from the photo on their ID card.
// The 128-number descriptor is computed in the admin's browser at enrolment; the ID photo is
// kept in the database (only served through an authenticated route) so an admin can review it.
const faceProfileSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["student", "faculty"], required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty" },
    descriptor: { type: [Number], required: true, validate: (v) => v.length === 128 },
    photo: { type: Buffer, select: false }, // small JPEG (resized in the browser); kept in the DB, not on disk
    photoType: { type: String, default: "image/jpeg" },
    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

faceProfileSchema.index({ student: 1 }, { unique: true, sparse: true });
faceProfileSchema.index({ faculty: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("FaceProfile", faceProfileSchema);
