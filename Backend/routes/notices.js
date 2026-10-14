const express = require("express");
const router = express.Router();

const Notice = require("../models/Notice");
const { protect, authorize } = require("../middleware/auth");

// GET /api/notices/public - NO login. Only notices an admin marked audience "public" (homepage ticker).
router.get("/public", async (req, res) => {
  try {
    const rows = await Notice.find({ audience: "public" }).sort({ createdAt: -1 }).limit(5).select("title content createdAt");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({ success: true, notices: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: "Could not load notices" });
  }
});

// GET /api/notices - returns notices relevant to the logged-in user's role
router.get("/", protect, async (req, res) => {
  const notices = await Notice.find({
    $or: [{ audience: "all" }, { audience: "public" }, { audience: req.user.role }],
  }).sort({ createdAt: -1 });
  res.json({ success: true, notices });
});

// GET /api/notices/mine  (admin, faculty) - notices the caller posted
router.get("/mine", protect, authorize("admin", "faculty"), async (req, res) => {
  const notices = await Notice.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
  res.json({ success: true, notices });
});

// POST /api/notices  (admin, faculty)
router.post("/", protect, authorize("admin", "faculty"), async (req, res) => {
  const { title, content, audience } = req.body;
  if (!title || !content) return res.status(400).json({ success: false, message: "title and content are required" });

  if (req.user.role === "faculty" && audience === "public") return res.status(403).json({ success: false, message: "Only admin can post public notices" });

  const notice = await Notice.create({ title, content, audience, postedBy: req.user.id });
  res.status(201).json({ success: true, notice });
});

// PUT /api/notices/:id  (admin, faculty)
router.put("/:id", protect, authorize("admin", "faculty"), async (req, res) => {
  const { title, content, audience } = req.body;
  if (req.user.role === "faculty") {
    const own = await Notice.findOne({ _id: req.params.id, postedBy: req.user.id });
    if (!own || audience === "public") return res.status(403).json({ success: false, message: "You can only edit your own notices" });
  }
  const notice = await Notice.findByIdAndUpdate(req.params.id, { title, content, audience }, { new: true });
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });
  res.json({ success: true, notice });
});

// DELETE /api/notices/:id  (admin, faculty)
router.delete("/:id", protect, authorize("admin", "faculty"), async (req, res) => {
  if (req.user.role === "faculty") {
    const own = await Notice.findOne({ _id: req.params.id, postedBy: req.user.id });
    if (!own) return res.status(403).json({ success: false, message: "You can only delete your own notices" });
  }
  const notice = await Notice.findByIdAndDelete(req.params.id);
  if (!notice) return res.status(404).json({ success: false, message: "Notice not found" });
  res.json({ success: true, message: "Notice deleted" });
});

module.exports = router;
