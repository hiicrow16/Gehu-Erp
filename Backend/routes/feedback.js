const express = require("express");
const router = express.Router();

const Feedback = require("../models/Feedback");
const { protect, optionalAuth, authorize } = require("../middleware/auth");

// --- tiny in-memory spam guard: max 5 reviews per IP per hour -----------------
const hits = new Map();
function tooMany(ip) {
  const now = Date.now(), hour = 3600 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < hour);
  if (list.length >= 5) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  return false;
}
setInterval(() => { // keep the map from growing forever
  const cutoff = Date.now() - 3600 * 1000;
  for (const [ip, list] of hits) if (!list.some((t) => t > cutoff)) hits.delete(ip);
}, 15 * 60 * 1000).unref();

// POST /api/feedback  (public) - anyone can leave a rating + review
router.post("/", optionalAuth, async (req, res) => {
  try {
    const { rating, name, message, page, website } = req.body || {};

    // Hidden "website" field is a honeypot: real people never fill it in.
    if (website) return res.status(201).json({ success: true });

    const r = Number(rating);
    if (!Number.isInteger(r) || r < 1 || r > 5) {
      return res.status(400).json({ success: false, message: "Please choose a rating from 1 to 5 stars" });
    }
    if (tooMany(req.ip)) {
      return res.status(429).json({ success: false, message: "You have sent several reviews already. Please try again later." });
    }

    await Feedback.create({
      rating: r,
      name: String(name || "").slice(0, 60),
      message: String(message || "").slice(0, 1000),
      page: String(page || "").slice(0, 120),
      fromRole: req.user && req.user.role ? req.user.role : "guest",
    });
    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Create feedback failed:", err);
    res.status(500).json({ success: false, message: "Could not send your review. Please try again." });
  }
});

// Everything below is ADMIN ONLY - visitors can write reviews but never read them.

// GET /api/feedback  (admin) - all reviews + summary numbers
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const feedback = await Feedback.find().sort({ createdAt: -1 }).limit(500);
    const total = feedback.length;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0, unread = 0;
    feedback.forEach((f) => { distribution[f.rating]++; sum += f.rating; if (!f.isRead) unread++; });
    res.json({
      success: true,
      feedback,
      summary: { total, unread, average: total ? Number((sum / total).toFixed(2)) : 0, distribution },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not load feedback" });
  }
});

// PATCH /api/feedback/:id  (admin) - mark read / unread
router.patch("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const f = await Feedback.findByIdAndUpdate(req.params.id, { isRead: !!req.body.isRead }, { new: true });
    if (!f) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, feedback: f });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not update" });
  }
});

// DELETE /api/feedback/:id  (admin)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const f = await Feedback.findByIdAndDelete(req.params.id);
    if (!f) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Could not delete" });
  }
});

module.exports = router;
