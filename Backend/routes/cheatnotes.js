const express = require("express");
const router = express.Router();

const CheatNote = require("../models/CheatNote");
const { protect, authorize } = require("../middleware/auth");

function validate(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!title || !content.trim()) return { error: "Title and content are required." };
  if (title.length > 80) return { error: "Title must be 80 characters or fewer." };
  if (content.length > 5000) return { error: "Content must be 5000 characters or fewer." };
  return { title, content };
}

// GET /api/cheatnotes - PUBLIC. Everyone (no login) can read the notes.
router.get("/", async (req, res) => {
  try {
    const notes = await CheatNote.find().sort({ createdAt: -1 }).select("title content createdAt updatedAt");
    res.json({ success: true, notes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not load notes." });
  }
});

// Everything below is ADMIN ONLY (enforced here on the server, not just hidden in the UI).

// POST /api/cheatnotes
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const v = validate(req.body);
    if (v.error) return res.status(400).json({ success: false, message: v.error });
    const note = await CheatNote.create({ title: v.title, content: v.content, postedBy: req.user.id });
    res.status(201).json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not save note." });
  }
});

// PUT /api/cheatnotes/:id
router.put("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const v = validate(req.body);
    if (v.error) return res.status(400).json({ success: false, message: v.error });
    const note = await CheatNote.findByIdAndUpdate(
      req.params.id,
      { title: v.title, content: v.content },
      { new: true }
    );
    if (!note) return res.status(404).json({ success: false, message: "Note not found." });
    res.json({ success: true, note });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not update note." });
  }
});

// DELETE /api/cheatnotes/:id
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const note = await CheatNote.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ success: false, message: "Note not found." });
    res.json({ success: true, message: "Note deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Could not delete note." });
  }
});

module.exports = router;
