const express = require("express");
const router = express.Router();

const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/auth");

// GET /api/departments - any authenticated user can view the list
router.get("/", protect, async (req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  res.json({ success: true, departments });
});

// POST /api/departments  (admin)
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "name is required" });
    const department = await Department.create({ name, code });
    res.status(201).json({ success: true, department });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: "Department already exists" });
    res.status(500).json({ success: false, message: "Could not create department" });
  }
});

// PUT /api/departments/:id  (admin)
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  const { name, code } = req.body;
  const department = await Department.findByIdAndUpdate(req.params.id, { name, code }, { new: true, runValidators: true });
  if (!department) return res.status(404).json({ success: false, message: "Department not found" });
  res.json({ success: true, department });
});

// DELETE /api/departments/:id  (admin)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) return res.status(404).json({ success: false, message: "Department not found" });
  res.json({ success: true, message: "Department deleted" });
});

module.exports = router;
