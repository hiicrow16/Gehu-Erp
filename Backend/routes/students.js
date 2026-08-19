const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/auth");

// GET /api/students  (admin, faculty) - list all students
router.get("/", protect, authorize("admin", "faculty"), async (req, res) => {
  const students = await Student.find().populate("course").sort({ createdAt: -1 });
  res.json({ success: true, students });
});

// GET /api/students/me  (student) - the logged-in student's own profile
router.get("/me", protect, authorize("student"), async (req, res) => {
  const student = await Student.findOne({ user: req.user.id }).populate("course");
  if (!student) return res.status(404).json({ success: false, message: "Profile not found" });
  res.json({ success: true, student });
});

// GET /api/students/:id  (admin, faculty)
router.get("/:id", protect, authorize("admin", "faculty"), async (req, res) => {
  const student = await Student.findById(req.params.id).populate("course");
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, student });
});

// POST /api/students  (admin) - creates both the login User and the Student profile
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { username, password, studentId, name, email, phone, course, semester, department, admissionYear } = req.body;

    if (!username || !password || !studentId || !name) {
      return res.status(400).json({ success: false, message: "username, password, studentId and name are required" });
    }

    const user = await User.create({ username, password, role: "student" });
    const student = await Student.create({
      user: user._id,
      studentId,
      name,
      email,
      phone,
      course: course || undefined,
      semester,
      department,
      admissionYear,
    });

    res.status(201).json({ success: true, student });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Username or student ID already exists" });
    }
    res.status(500).json({ success: false, message: "Could not create student" });
  }
});

// PUT /api/students/:id  (admin)
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  const { name, email, phone, course, semester, department, admissionYear } = req.body;
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { name, email, phone, course, semester, department, admissionYear },
    { new: true, runValidators: true }
  ).populate("course");

  if (!student) return res.status(404).json({ success: false, message: "Student not found" });
  res.json({ success: true, student });
});

// DELETE /api/students/:id  (admin) - removes the student profile and their login
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ success: false, message: "Student not found" });

  await Student.deleteOne({ _id: student._id });
  await User.deleteOne({ _id: student.user });

  res.json({ success: true, message: "Student deleted" });
});

module.exports = router;
