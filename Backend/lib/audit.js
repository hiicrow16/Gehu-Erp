// Audit trail helpers. Logging is best-effort: a failure here is printed to the
// server log but NEVER breaks the request that was being audited.

const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

const SECRET = /pass|token|secret|hash/i;
const OID = /^[a-f0-9]{24}$/i;

// Safe-to-store copy of a request body: secrets removed, long text trimmed.
function sanitize(v, depth = 0) {
  if (v == null || depth > 2) return v == null ? v : undefined;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => sanitize(x, depth + 1));
  if (typeof v === "object") {
    const o = {};
    Object.keys(v).slice(0, 30).forEach((k) => { o[k] = SECRET.test(k) ? "[hidden]" : sanitize(v[k], depth + 1); });
    return o;
  }
  return typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "…" : v;
}

const plain = (x) => (x && typeof x.toObject === "function" ? x.toObject() : x);
const norm = (v) => (v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v));

// Field-by-field difference between two plain objects (only the listed fields).
function diffObjects(before, after, fields) {
  const a = plain(before) || {}, b = plain(after) || {};
  const out = [];
  for (const f of fields) {
    if (norm(a[f]) !== norm(b[f])) out.push({ field: f, from: a[f] == null ? null : a[f], to: b[f] == null ? null : b[f] });
  }
  return out;
}

async function record(req, { action, entity, entityId, summary, changes = [], details }) {
  try {
    let name = req.user && req.user.id;
    try {
      const u = req.user && (await User.findById(req.user.id).select("username"));
      if (u) name = u.username;
    } catch (e) { /* keep id */ }
    await AuditLog.create({
      actor: { id: req.user && req.user.id, name, role: req.user && req.user.role },
      action, entity, entityId: entityId ? String(entityId) : undefined,
      summary, changes: changes.slice(0, 300), details: sanitize(details),
      ip: req.ip,
    });
  } catch (e) {
    console.error("Audit log failed:", e.message);
  }
}

// Mount in front of a router to log every successful POST/PUT/PATCH/DELETE under it.
//   app.use("/api/students", auditMutations("Student", { snap, fields, label, actions, entityMap, skip }), routes)
// snap(req) -> current stored object (read before and after a PUT/PATCH to produce a field diff, and before a DELETE)
// Only authenticated actions are logged (public form submissions have no actor).
function auditMutations(entity, opts = {}) {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || (opts.skip && opts.skip(req))) return next();
    const seg = req.path.split("/").filter(Boolean);
    const idIdx = seg.findIndex((x) => OID.test(x));
    req.auditId = idIdx >= 0 ? seg[idIdx] : undefined;
    const collection = idIdx >= 0 ? seg.slice(0, idIdx) : seg;
    const rest = idIdx >= 0 ? seg.slice(idIdx + 1) : [];
    const ent = (opts.entityMap && opts.entityMap[collection[0]]) || entity;
    const snap = opts.snap && (typeof opts.snap === "function" ? opts.snap : opts.snap[collection[0] || ""]);
    const wantsDiff = !!(snap && req.auditId && req.method !== "POST");
    Promise.resolve(wantsDiff ? snap(req).catch(() => null) : null).then((before) => {
      const json = res.json.bind(res);
      res.json = (body) => {
        res.json = json;
        const ok = res.statusCode < 400 && body && body.success !== false;
        const sent = json(body);
        if (ok && req.user) {
          (async () => {
            const sub = rest[rest.length - 1];
            const action = (sub && opts.actions && opts.actions[sub]) || sub || (req.method === "DELETE" ? "delete" : req.method === "POST" ? "create" : "update");
            const after = wantsDiff && req.method !== "DELETE" ? await snap(req).catch(() => null) : null;
            const subject = after || before || (body && (body[opts.one] || body.item)) || req.body || {};
            const label = opts.label ? opts.label(plain(subject)) : "";
            const fields = Array.isArray(opts.fields) ? opts.fields : (opts.fields && opts.fields[collection[0] || ""]);
            const changes = after && before && fields ? diffObjects(before, after, fields) : [];
            await record(req, {
              action, entity: ent, entityId: req.auditId,
              summary: `${action} ${ent.toLowerCase()}${label ? " " + label : collection.length ? " (" + collection.join("/") + ")" : ""}`,
              changes, details: req.method === "DELETE" ? undefined : req.body,
            });
          })().catch((e) => console.error("Audit log failed:", e.message));
        }
        return sent;
      };
      next();
    });
  };
}

module.exports = { record, auditMutations, diffObjects, sanitize };
