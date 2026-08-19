const jwt = require("jsonwebtoken");

// Verifies the JWT sent in the Authorization header and attaches the
// decoded payload ({ id, role, profileId }) to req.user.
function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// Restricts a route to specific roles. Use after protect().
// Example: router.get('/', protect, authorize('admin', 'faculty'), handler)
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions" });
    }
    next();
  };
}

module.exports = { protect, authorize };
