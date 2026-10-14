const mongoose = require("mongoose");

// A managed reference list so "department" is picked from one canonical set
// instead of being freely typed on every Course/Faculty/Student form.
// Course/Faculty/Student still store department as plain text (no schema
// migration), but the admin UI now sources that text from here.
const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
