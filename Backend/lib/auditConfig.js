// Which parts of the API are audited, and how their changes are described.
// Attendance and results are NOT here: their routes log richer per-student changes themselves.

const { auditMutations } = require("./audit");
const Student = require("../models/Student");
const Faculty = require("../models/Faculty");
const Course = require("../models/Course");
const Subject = require("../models/Subject");
const Notice = require("../models/Notice");
const Department = require("../models/Department");
const AcademicTerm = require("../models/AcademicTerm");
const Admission = require("../models/Admission");
const Order = require("../models/Order");

const id = (req) => req.auditId;
const plainModel = (M, extra) => (req) => (extra ? M.findById(id(req)).populate(extra.path, extra.sel) : M.findById(id(req))).lean();

// Students: show course by name and the login's username / active flag
const snapStudent = async (req) => {
  const s = await Student.findById(id(req)).populate("course", "name").populate("user", "username isActive").lean();
  if (!s) return null;
  return { ...s, course: s.course && s.course.name, username: s.user && s.user.username, active: s.user ? s.user.isActive !== false : undefined };
};
const snapFaculty = async (req) => {
  const f = await Faculty.findById(id(req)).populate("subjects", "code").lean();
  return f && { ...f, subjects: (f.subjects || []).map((x) => x.code).sort().join(", ") };
};

const audited = {
  students: auditMutations("Student", {
    snap: snapStudent, one: "student",
    fields: ["name", "email", "phone", "course", "semester", "department", "admissionYear", "username", "active"],
    label: (s) => [s.studentId, s.name].filter(Boolean).join(" - "),
    actions: { password: "reset-password", active: "set-active" },
  }),
  faculty: auditMutations("Faculty", {
    snap: snapFaculty, one: "faculty",
    fields: ["name", "email", "phone", "department", "subjects"],
    label: (f) => [f.facultyId, f.name].filter(Boolean).join(" - "),
  }),
  courses: auditMutations("Course", { snap: plainModel(Course), one: "course", fields: ["name", "code", "department", "durationYears"], label: (c) => c.name }),
  subjects: auditMutations("Subject", { snap: plainModel(Subject), one: "subject", fields: ["name", "code", "semester"], label: (s) => s.name }),
  notices: auditMutations("Notice", { snap: plainModel(Notice), one: "notice", fields: ["title", "content", "audience"], label: (n) => n.title }),
  departments: auditMutations("Department", { snap: plainModel(Department), one: "department", fields: ["name", "code", "head", "description"], label: (d) => d.name }),
  terms: auditMutations("Term", {
    snap: plainModel(AcademicTerm), one: "term", fields: ["name", "academicYear", "type", "startDate", "endDate"], label: (t) => t.name,
    skip: (req) => req.path === "/promote", // logs its own entry
  }),
  admissions: auditMutations("Admission", {
    snap: plainModel(Admission), one: "application", fields: ["status", "reviewNotes"], label: (a) => [a.trackingId, a.name].filter(Boolean).join(" - "),
  }),
  store: auditMutations("Order", {
    snap: { orders: plainModel(Order) }, fields: { orders: ["status", "paymentStatus", "refundStatus"] },
    label: (o) => o.customerName || "", entityMap: { stock: "Stock" },
    skip: (req) => req.method === "POST" && (req.path === "/orders" || req.path === "/quote"),
  }),
  academics: auditMutations("Academics", {
    entityMap: { timetable: "Timetable", exams: "Exam", assignments: "Assignment" },
    skip: (req) => req.path.startsWith("/results"), // results log their own per-student changes
  }),
};

module.exports = audited;
