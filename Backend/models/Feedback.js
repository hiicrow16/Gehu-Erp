const mongoose = require("mongoose");

// Visitor reviews of the website. Only admins can read them (see routes/feedback.js).
const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    name: { type: String, trim: true, maxlength: 60 },
    message: { type: String, trim: true, maxlength: 1000 },
    page: { type: String, trim: true, maxlength: 120 }, // which page it was sent from
    fromRole: { type: String, enum: ["guest", "student", "faculty", "admin"], default: "guest" },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
