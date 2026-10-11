const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

// Stored OUTSIDE anything express.static ever serves, and never made public -
// the only way to reach a file in here is the authenticated admin download route.
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "admissions");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB per file
const MAX_FILES = 5;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    // Random name on disk - the applicant's original filename is kept only as
    // metadata in the database, never used to build a path (blocks path traversal).
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, "");
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error("Only PDF, JPG, PNG or WEBP files are allowed"));
  }
  cb(null, true);
}

const uploadDocuments = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
}).array("documents", MAX_FILES);

module.exports = { uploadDocuments, UPLOAD_ROOT };
