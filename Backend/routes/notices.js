const express = require("express");
const router = express.Router();

const Notice = require("../models/Notice");
const { protect, authorize } = require("../middleware/auth");

// GET /api/notices - returns notices relevant to the logged-in user's role
router.get("/", protect, async (req, res) => {
  const notices = await Notice.find({
    $or: [{ audience: "all" }, { audience: req.user.role }],
  }).sort({ createdAt: -1 });
  res.json({ success: true, notices });
});

// POST /api/notices  (admin, faculty)
router.post("/", protect, authorize("admin", "faculty"), async (req, res) => {
  const { title, content, audience } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: "title and content are required" });

  const notice = await Notice.create({ title, content, audience, postedBy: req.user.id });
  res.status(201).json({ success: true, notice });
});

// PUT /api/notices/:id  (admin, faculty)
router.put("/:id", protect, authorize("admin", "faculty"), async (req, res) => {
  const { title, content, audience } = req.body;
  const notice = await Notice.findByIdAndUpdate(req.params.id, { title, content, audience }, { new: true });
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });
  res.json({ success: true, notice });
});

// DELETE /api/notices/:id  (admin, faculty)
router.delete("/:id", protect, authorize("admin", "faculty"), async (req, res) => {
  const notice = await Notice.findByIdAndDelete(req.params.id);
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });
  res.json({ success: true, message: "Notice deleted" });
});

module.exports = router;
