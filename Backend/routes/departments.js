const express = require("express");
const router = express.Router();
const Department = require("../models/Department");
const Course = require("../models/Course");
const Faculty = require("../models/Faculty");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/auth");

const admin = [protect, authorize("admin")];
const dup = (res) => res.status(409).json({ success: false, message: "A department with that name or code already exists" });
const pick = (b) => ({ name: b.name, code: b.code, head: b.head, description: b.description });

router.get("/", protect, async (req, res) => {
  const items = await Department.find().sort({ name: 1 });
  res.json({ success: true, departments: items });
});

router.post("/", ...admin, async (req, res) => {
  try {
    if (!req.body.name || !req.body.code) return res.status(400).json({ success: false, message: "Name and code are required" });
    res.status(201).json({ success: true, department: await Department.create(pick(req.body)) });
  } catch (err) {
    if (err.code === 11000) return dup(res);
    res.status(500).json({ success: false, message: "Could not create department" });
  }
});

// Renaming also updates the department name stored on courses, faculty and students.
router.put("/:id", ...admin, async (req, res) => {
  try {
    const old = await Department.findById(req.params.id);
    if (!old) return res.status(404).json({ success: false, message: "Department not found" });
    const upd = pick(req.body);
    Object.keys(upd).forEach((k) => upd[k] === undefined && delete upd[k]);
    const dept = await Department.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true });
    if (upd.name && upd.name !== old.name) {
      await Promise.all([Course, Faculty, Student].map((M) => M.updateMany({ department: old.name }, { department: dept.name })));
    }
    res.json({ success: true, department: dept });
  } catch (err) {
    if (err.code === 11000) return dup(res);
    res.status(500).json({ success: false, message: "Could not update department" });
  }
});

// Refuses to delete a department that is still in use.
router.delete("/:id", ...admin, async (req, res) => {
  const d = await Department.findById(req.params.id);
  if (!d) return res.status(404).json({ success: false, message: "Department not found" });
  const [c, f, s] = await Promise.all([Course, Faculty, Student].map((M) => M.countDocuments({ department: d.name })));
  if (c + f + s) return res.status(400).json({ success: false, message: `In use by ${c} course(s), ${f} faculty and ${s} student(s). Reassign them first.` });
  await d.deleteOne();
  res.json({ success: true });
});

module.exports = router;
