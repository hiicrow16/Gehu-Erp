const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Student = require("../models/Student");
const { protect, authorize } = require("../middleware/auth");

// Student logins that no Student profile points to.
async function findOrphanLogins() {
  const users = await User.find({ role: "student" }).select("username createdAt");
  const linked = await Student.find({ user: { $in: users.map((u) => u._id) } }).select("user");
  const linkedIds = new Set(linked.map((s) => String(s.user)));
  return users.filter((u) => !linkedIds.has(String(u._id)));
}

// Which field a Mongo duplicate-key (11000) error was actually about.
function dupField(err) {
  return Object.keys(err.keyPattern || err.keyValue || {})[0] || "unknown field";
}

// GET /api/students  (admin, faculty) - list all students
router.get("/", protect, authorize("admin", "faculty"), async (req, res) => {
  try {
    const students = await Student.find()
      .populate("course")
      .populate("user", "username isActive")
      .sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (err) {
    console.error("List students failed:", err);
    res.status(500).json({ success: false, message: "Could not load students" });
  }
});

// GET /api/students/orphans  (admin) - logins with role "student" that have no
// Student profile. These are leftovers from failed "Add Student" attempts.
router.get("/orphans", protect, authorize("admin"), async (req, res) => {
  try {
    res.json({ success: true, orphans: await findOrphanLogins() });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not check for orphan logins" });
  }
});

// DELETE /api/students/orphans  (admin) - removes those leftover logins.
// Only role "student" users are ever touched; admin/faculty logins are safe.
router.delete("/orphans", protect, authorize("admin"), async (req, res) => {
  try {
    const orphans = await findOrphanLogins();
    await User.deleteMany({ _id: { $in: orphans.map((u) => u._id) } });
    res.json({ success: true, removed: orphans.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not clean up orphan logins" });
  }
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
    const { password, name, email, phone, course, semester, department, admissionYear } = req.body;
    const username = String(req.body.username || "").trim();
    const studentId = String(req.body.studentId || "").trim();

    if (!username || !password || !studentId || !name) {
      return res.status(400).json({ success: false, message: "username, password, studentId and name are required" });
    }

    // 1) Student ID must be unique - check it first so a failure here can't leave a login behind.
    const sameId = await Student.findOne({ studentId });
    if (sameId) {
      return res.status(409).json({ success: false, message: `Student ID "${studentId}" already belongs to ${sameId.name}` });
    }

    // 2) Username check, with an honest explanation of WHO owns it.
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      const linked = await Student.findOne({ user: existingUser._id });
      if (linked) {
        return res.status(409).json({
          success: false,
          message: `Username "${username}" is already used by student ${linked.name} (ID ${linked.studentId})`,
        });
      }
      if (existingUser.role !== "student") {
        // Never delete admin/faculty accounts, even if they have no student profile.
        return res.status(409).json({
          success: false,
          message: `Username "${username}" belongs to a ${existingUser.role} account. Choose a different username.`,
        });
      }
      // Leftover student login with no profile (failed earlier attempt): safe to replace.
      await User.deleteOne({ _id: existingUser._id });
    }

    let user;
    try {
      user = await User.create({ username, password, role: "student" });
    } catch (err) {
      if (err.code === 11000) {
        const field = dupField(err);
        return res.status(409).json({
          success: false,
          message: field === "username"
            ? "Username already exists"
            : `Duplicate value on the users "${field}" field (leftover database index - restart the backend to clear it)`,
        });
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
      // Roll back the just-created login so it can't become an orphan.
      await User.deleteOne({ _id: user._id });
      if (err.code === 11000) {
        const field = dupField(err);
        return res.status(409).json({
          success: false,
          message: field === "studentId" ? "Student ID already exists" : `Duplicate value on the students "${field}" field`,
        });
      }
      if (err.name === "ValidationError" || err.name === "CastError") {
        return res.status(400).json({ success: false, message: err.message });
      }
      throw err;
    }

    res.status(201).json({ success: true, student });
  } catch (err) {
    console.error("Create student failed:", err);
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
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    await Student.deleteOne({ _id: student._id });
    await User.deleteOne({ _id: student.user });

    res.json({ success: true, message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not delete student" });
  }
});

module.exports = router;
