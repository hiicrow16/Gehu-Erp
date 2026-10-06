const mongoose = require("mongoose");

const cheatNoteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    content: { type: String, required: true, maxlength: 5000 },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CheatNote", cheatNoteSchema);
