const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "Computer Science"
    code: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. "CSE"
    head: { type: String, trim: true }, // head of department (free text)
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
