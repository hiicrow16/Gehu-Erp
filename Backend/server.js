require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const facultyRoutes = require("./routes/faculty");
const courseRoutes = require("./routes/courses");
const subjectRoutes = require("./routes/subjects");
const attendanceRoutes = require("./routes/attendance");
const noticeRoutes = require("./routes/notices");

const app = express();

// CLIENT_URL can be a comma-separated list of allowed origins
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/", (req, res) =>
  res.json({ success: true, message: "GEHU ERP API. See /api/health for a status check." })
);
app.get("/api/health", (req, res) => res.json({ success: true, status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/notices", noticeRoutes);

// 404 handler for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Central error handler - never leaks stack traces to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`GEHU Backend running on port ${PORT}`);
  });
});
