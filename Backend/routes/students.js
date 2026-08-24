const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/auth");

// GET /api/students  (admin, faculty) - list all students
router.get("/", protect, authorize("admin", "faculty"), async (req, res) => {
  const students = await Student.find()
    .populate("course")
    .populate("user", "username isActive")
    .sort({ createdAt: -1 });
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
  const student = await Student.findById(req.params.id)
    .populate("course")
    .populate("user", "username isActive");
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

    // Self-heal: if a User with this username already exists but has no
    // matching Student profile (left over from an earlier failed attempt,
    // e.g. this route erroring out between creating the User and the
    // Student), clean it up first instead of permanently blocking the
    // username. A User that DOES have a linked Student is a real conflict
    // and is left alone - that case still correctly fails as a duplicate.
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      const linkedStudent = await Student.findOne({ user: existingUser._id });
      if (!linkedStudent) {
        await User.deleteOne({ _id: existingUser._id });
      }
    }

    let user;
    try {
      user = await User.create({ username, password, role: "student" });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: "Username already exists" });
      }
      throw err;
    }

    let student;
    try {
      student = await Student.create({
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
    } catch (err) {
      // Roll back the just-created login so it doesn't become another
      // orphaned User blocking this username on the next attempt.
      await User.deleteOne({ _id: user._id });
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: "Student ID already exists" });
      }
      throw err;
    }

    res.status(201).json({ success: true, student });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not create student" });
  }
});

// PUT /api/students/:id  (admin) - updates profile fields, and optionally the
// linked login's username (password is changed separately, see below).
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, phone, course, semester, department, admissionYear, username } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    if (username) {
      const trimmed = String(username).trim();
      const existing = await User.findOne({ username: trimmed, _id: { $ne: student.user } });
      if (existing) {
        return res.status(409).json({ success: false, message: "That username is already taken" });
      }
      await User.findByIdAndUpdate(student.user, { username: trimmed });
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, email, phone, course, semester, department, admissionYear },
      { new: true, runValidators: true }
    )
      .populate("course")
      .populate("user", "username isActive");

    res.json({ success: true, student: updated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "Student ID or username already exists" });
    }
    res.status(500).json({ success: false, message: "Could not update student" });
  }
});

// PUT /api/students/:id/password  (admin) - resets a student's login password.
// Goes through User.save() (not a raw update) so the pre-save hook rehashes it.
router.put("/:id/password", protect, authorize("admin"), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const user = await User.findById(student.user);
    if (!user) return res.status(404).json({ success: false, message: "Linked login not found" });

    user.password = password; // pre-save hook rehashes this
    await user.save();

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not update password" });
  }
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
