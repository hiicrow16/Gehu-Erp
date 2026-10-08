/* Navbar session: when someone is logged in, replace the "Student / Faculty Login"
   button with their name + a small menu (Dashboard / Logout). Works on every page
   that has the standard #studentBtn in .nav-actions. */
(function () {
  var AUTH_KEYS = ["token", "role", "username", "profileId", "displayName", "currentStudentProfileId"];
  var DASH = { student: "student-dashboard.html", admin: "admin-dashboard.html" };
  var LABEL = { student: "Student", admin: "Admin", faculty: "Faculty" };

  function tokenValid(t) {
    try {
      var p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return !p.exp || p.exp * 1000 > Date.now();
    } catch (e) { return false; }
  }
  function clearAuth() { AUTH_KEYS.forEach(function (k) { localStorage.removeItem(k); }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function render(btn, name, role) {
    var wrap = btn.closest(".nav-actions");
    if (!wrap) return;
    var loginPanel = document.getElementById("loginPanel");
    if (loginPanel) loginPanel.remove(); // not needed once logged in
    var dash = DASH[role];
    wrap.style.position = "relative";
    wrap.innerHTML =
      '<button id="studentBtn" type="button" title="' + esc(name) + '">👤 ' + esc(name.length > 18 ? name.slice(0, 17) + "…" : name) + ' ▾</button>' +
      '<div class="nav-user-drop" id="navUserDrop">' +
        '<div class="nud-head"><b>' + esc(name) + '</b><span>' + esc(LABEL[role] || role) + '</span></div>' +
        (dash ? '<a href="' + dash + '">' + (role === "admin" ? "Admin Dashboard" : "My Dashboard") + '</a>'
              : '<span class="nud-note">Faculty dashboard coming soon</span>') +
        '<button type="button" id="navLogout">Logout</button>' +
      '</div>';
    var drop = document.getElementById("navUserDrop");
    document.getElementById("studentBtn").addEventListener("click", function (e) {
      e.stopPropagation();
      drop.classList.toggle("open");
    });
    document.addEventListener("click", function () { drop.classList.remove("open"); });
    document.getElementById("navLogout").addEventListener("click", function () {
      clearAuth(); location.href = "index.html";
    });
  }

  function init() {
    var token = localStorage.getItem("token"), role = localStorage.getItem("role");
    var btn = document.getElementById("studentBtn");
    if (!btn || !token || !role) return;
    if (!tokenValid(token)) { clearAuth(); return; } // expired session: keep the Login button

    var style = document.createElement("style");
    style.textContent =
      ".nav-user-drop{display:none;position:absolute;right:0;top:calc(100% + 10px);min-width:210px;background:#12141b;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px;box-shadow:0 18px 40px rgba(0,0,0,.55);z-index:1000}" +
      ".nav-user-drop.open{display:block}" +
      ".nud-head{padding:8px 10px 10px;border-bottom:1px solid rgba(255,255,255,.1);margin-bottom:6px;display:flex;flex-direction:column;gap:2px;color:#fff}" +
      ".nud-head span{font-size:12px;color:#ffb020;text-transform:uppercase;letter-spacing:.6px}" +
      ".nav-user-drop a,.nav-user-drop button,.nud-note{display:block;width:100%;text-align:left;padding:9px 10px;border:0;border-radius:9px;background:transparent;color:#e2e8f0;font:inherit;font-size:14px;cursor:pointer;text-decoration:none;box-sizing:border-box}" +
      ".nav-user-drop a:hover,.nav-user-drop button:hover{background:rgba(255,255,255,.08)}" +
      "#navLogout{color:#fca5a5}.nud-note{color:#8b9bb8;cursor:default}";
    document.head.appendChild(style);

    var name = localStorage.getItem("displayName") || localStorage.getItem("username") || LABEL[role] || "Account";
    render(btn, name, role);

    // Old sessions have no saved display name: fetch the student's real name once.
    if (role === "student" && !localStorage.getItem("displayName") && window.API_BASE) {
      fetch(window.API_BASE + "/students/me", { headers: { Authorization: "Bearer " + token } })
        .then(function (r) { if (r.status === 401) { clearAuth(); location.reload(); return null; } return r.json(); })
        .then(function (d) {
          if (d && d.success && d.student && d.student.name) {
            localStorage.setItem("displayName", d.student.name);
            render(document.getElementById("studentBtn"), d.student.name, role);
          }
        }).catch(function () {});
    }
  }
  init();
})();
