// Digital student ID: short-lived, signed QR tokens.
//
// The QR holds NO personal data - only { student id, random token id, expiry } signed with
// a server secret (HMAC-SHA256). Only the server can check it, it expires after 60 seconds
// (the card refreshes every 30), and each token can be accepted once, so a screenshot or a
// photo of someone else's QR is useless within a minute.

const crypto = require("crypto");

const PREFIX = "GEHUID";
const TOKEN_TTL_SECONDS = 60;
const REFRESH_SECONDS = 30;

// Card validity policy: a card is valid until 31 July of (admission year + course duration).
const VALID_UNTIL_MONTH = 6; // July (0-based)
const VALID_UNTIL_DAY = 31;

const secret = () => (process.env.ID_CARD_SECRET || `${process.env.JWT_SECRET || ""}:student-id-card`);
const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest();

function issueToken(studentId, now = Date.now()) {
  const payload = b64(JSON.stringify({ s: String(studentId), j: crypto.randomBytes(9).toString("hex"), e: Math.floor(now / 1000) + TOKEN_TTL_SECONDS }));
  const head = `${PREFIX}.${payload}`;
  return { token: `${head}.${b64(sign(head))}`, expiresAt: (Math.floor(now / 1000) + TOKEN_TTL_SECONDS) * 1000 };
}

// -> { ok: true, studentId, jti, exp } or { ok: false, reason }
function checkToken(raw, now = Date.now()) {
  const parts = String(raw || "").trim().split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return { ok: false, reason: "This is not a GEHU student ID code." };
  const expected = sign(`${parts[0]}.${parts[1]}`);
  let given;
  try { given = Buffer.from(parts[2], "base64url"); } catch (e) { given = Buffer.alloc(0); }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: "Invalid code (it has been altered or is not genuine)." };
  let p;
  try { p = JSON.parse(Buffer.from(parts[1], "base64url").toString()); } catch (e) { return { ok: false, reason: "Invalid code." }; }
  if (!p || !p.s || !p.j || !p.e) return { ok: false, reason: "Invalid code." };
  if (p.e * 1000 < now) return { ok: false, reason: "This code has expired. Ask the student to open the card again (it refreshes every 30 seconds)." };
  return { ok: true, studentId: p.s, jti: p.j, exp: p.e };
}

function validUntil(admissionYear, durationYears) {
  const y = Number(admissionYear);
  if (!y) return null;
  return new Date(Date.UTC(y + Math.round(Number(durationYears) || 3), VALID_UNTIL_MONTH, VALID_UNTIL_DAY, 23, 59, 59));
}

module.exports = { issueToken, checkToken, validUntil, TOKEN_TTL_SECONDS, REFRESH_SECONDS };
