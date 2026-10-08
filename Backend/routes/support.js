const express = require("express");
const router = express.Router();

// GET /api/support/whatsapp
// The WhatsApp number lives ONLY in the server's environment, never in the
// website's HTML/JS. The "WhatsApp" card links here, and the visitor is
// forwarded straight into WhatsApp. They only see the number if they actually
// start the chat (WhatsApp itself shows who you are chatting with).
//
// Env options (set on Render):
//   SUPPORT_WHATSAPP_LINK  - a WhatsApp Business short link (https://wa.me/message/XXXX).
//                            If set, it is used as is and the number is never in any URL.
//   SUPPORT_WHATSAPP       - your number, e.g. 9876543210 or 919876543210.
router.get("/whatsapp", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");

  const link = (process.env.SUPPORT_WHATSAPP_LINK || "").trim();
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(link)) return res.redirect(302, link);

  let num = String(process.env.SUPPORT_WHATSAPP || "").replace(/\D/g, "");
  if (num.length === 10) num = "91" + num;
  if (num.length < 11 || num.length > 15) {
    return res
      .status(503)
      .send("<h3 style='font-family:sans-serif'>WhatsApp support isn't set up yet. Please use the email option.</h3>");
  }

  const text = String(req.query.text || "Hi GEHU Portal team, I need help with ").slice(0, 200);
  res.redirect(302, `https://wa.me/${num}?text=${encodeURIComponent(text)}`);
});

module.exports = router;
