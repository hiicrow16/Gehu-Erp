// Requires config.js to be loaded first (defines window.API_BASE)
const API = window.API_BASE;

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     NAVBAR SHRINK ON SCROLL
  ========================== */
  const topNav = document.getElementById("topNav");
  if (topNav) {
    window.addEventListener("scroll", () => {
      topNav.classList.toggle("scrolled", window.scrollY > 30);
    }, { passive: true });
  }

  /* =========================
     MOBILE NAV TOGGLE
  ========================== */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navToggle.classList.toggle("open");
      navLinks.classList.toggle("open");
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navToggle.classList.remove("open");
        navLinks.classList.remove("open");
      });
    });
  }

  /* =========================
     NAVBAR LOGIN DROPDOWN (home page quick-login panel)
  ========================== */
  const studentBtn = document.getElementById("studentBtn");
  const loginPanel = document.getElementById("loginPanel");

  if (studentBtn && loginPanel) {
    studentBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = loginPanel.style.display === "block";
      loginPanel.style.display = isOpen ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!loginPanel.contains(e.target) && e.target !== studentBtn) {
        loginPanel.style.display = "none";
      }
    });
  }

  // The navbar quick-login panel now logs in directly (same request the
  // full login.html page makes), instead of discarding what was typed here
  // and bouncing to login.html for a second, empty attempt.
  const homeLoginBtn = document.getElementById("homeLoginBtn");
  if (homeLoginBtn) {
    homeLoginBtn.addEventListener("click", async () => {
      const campusIdField = document.getElementById("campusId");
      const passwordField = document.getElementById("password");
      const username = campusIdField ? campusIdField.value.trim() : "";
      const password = passwordField ? passwordField.value.trim() : "";

      let msg = document.getElementById("homeLoginMessage");
      if (!msg && loginPanel) {
        msg = document.createElement("small");
        msg.id = "homeLoginMessage";
        msg.className = "form-note";
        loginPanel.appendChild(msg);
      }
      if (msg) msg.textContent = "";

      if (!username || !password) {
        if (msg) msg.textContent = "Enter your Campus ID and password.";
        return;
      }

      homeLoginBtn.disabled = true;
      homeLoginBtn.textContent = "Signing in…";

      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("role", data.role);
          localStorage.setItem("username", data.username);
          if (data.profile && data.profile._id) {
            localStorage.setItem("profileId", data.profile._id);
          }

          if (data.role === "student") {
            window.location.href = "student-dashboard.html";
          } else if (data.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else if (data.role === "faculty") {
            if (msg) msg.textContent = "Faculty login succeeded, but the faculty dashboard page isn't built yet.";
          }
        } else if (msg) {
          msg.textContent = data.message || "Login failed.";
        }
      } catch (error) {
        if (msg) msg.textContent = "Can't reach the backend. Check config.js API_BASE and that the server is running.";
      } finally {
        homeLoginBtn.disabled = false;
        homeLoginBtn.textContent = "Login";
      }
    });
  }

  /* =========================
     SCROLL REVEAL ANIMATIONS
  ========================== */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  /* =========================
     ANIMATED STAT COUNTERS
  ========================== */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.getAttribute("data-count"), 10);
        const suffix = el.getAttribute("data-suffix") || "";
        const duration = 1400;
        const start = performance.now();

        function tick(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = Math.round(eased * target).toLocaleString() + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        counterIO.unobserve(el);
      });
    }, { threshold: 0.5 });

    counters.forEach(el => counterIO.observe(el));
  }

  /* =========================
     LOGIN FORM (login.html) — real backend auth
  ========================== */
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value.trim();
      const msg = document.getElementById("loginMessage");
      const submitBtn = loginForm.querySelector("button[type='submit']");

      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Signing in…"; }
      if (msg) msg.textContent = "";

      try {
        const res = await fetch(`${API}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
          localStorage.setItem("token", data.token);
          localStorage.setItem("role", data.role);
          localStorage.setItem("username", data.username);
          if (data.profile && data.profile._id) {
            localStorage.setItem("profileId", data.profile._id);
          }

          if (data.role === "student") {
            window.location.href = "student-dashboard.html";
          } else if (data.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else if (data.role === "faculty") {
            // Faculty dashboard UI isn't built yet — see README "Next phases".
            if (msg) msg.textContent = "Faculty login succeeded, but the faculty dashboard page isn't built yet.";
          }
        } else if (msg) {
          msg.textContent = data.message || "Login failed.";
        }
      } catch (error) {
        if (msg) msg.textContent = "Can't reach the backend. Check config.js API_BASE and that the server is running.";
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Login"; }
      }
    });
  }

  /* =========================
     LOAD DATA ON STUDENT DASHBOARD
  ========================== */
  const profileId = localStorage.getItem("profileId");
  if (profileId && localStorage.getItem("role") === "student") {
    loadStudentAttendance(profileId);
    loadCourses();
  }

  /* =========================
     SHOW ATTENDANCE SECTION
  ========================== */
  window.showAttendance = function () {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    const sec = document.getElementById("attendanceSection");
    if (sec) sec.classList.add("active");
  };

  /* =========================
     MARK ATTENDANCE (faculty-only endpoint; needs a logged-in faculty token)
  ========================== */
  window.markAttendance = async function () {
    const student = document.getElementById("attStudentId").value;
    const subjectField = document.getElementById("attSubjectId");
    const subject = subjectField ? subjectField.value : null;
    const date = document.getElementById("attDate").value;
    const status = document.getElementById("attStatus").value;

    if (!student || !subject || !date) {
      alert("Fill all fields (student, subject, date)");
      return;
    }

    const res = await fetch(`${API}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ student, subject, date, status })
    });

    if (res.ok) {
      alert("Attendance marked successfully");
      viewAttendance(student);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Could not mark attendance");
    }
  };

  /* =========================
     APPLY FORM (apply.html) — static, submits via Formspree, no backend
  ========================== */
  const applyForm = document.getElementById("applyForm");
  if (applyForm) {
    applyForm.addEventListener("submit", () => {
      const btn = applyForm.querySelector("button[type='submit']");
      if (btn) {
        btn.textContent = "Submitting…";
        btn.disabled = true;
      }
    });
  }

  /* =========================
     TRACK YOUR ORDER (index.html - Help & Support)
  ========================== */
  const trackForm = document.getElementById("trackOrderForm");
  if (trackForm) {
    const resultBox = document.getElementById("trackResult");

    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-");

    trackForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const orderId = document.getElementById("trackOrderId").value.trim();
      const studentId = document.getElementById("trackStudentId").value.trim();
      const btn = trackForm.querySelector("button[type='submit']");

      if (btn) { btn.disabled = true; btn.textContent = "Checking…"; }
      resultBox.className = "track-result hidden";
      resultBox.innerHTML = "";

      try {
        const res = await fetch(`${API}/store/track?orderId=${encodeURIComponent(orderId)}&studentId=${encodeURIComponent(studentId)}`);
        const data = await res.json();

        if (!data.success) {
          resultBox.className = "track-result error";
          resultBox.textContent = data.message || "No matching order found.";
        } else {
          const o = data.order;
          const itemsList = o.items.map(i => `${i.name} x${i.quantity}`).join(", ");
          const dateStr = new Date(o.createdAt).toLocaleString();

          resultBox.className = "track-result";
          resultBox.innerHTML = `
            <div class="track-row"><span>Order Date</span><span>${dateStr}</span></div>
            <div class="track-row"><span>Total</span><span>₹${o.totalAmount}</span></div>
            <div class="track-row"><span>Payment</span><span>${o.paymentMethod}</span></div>
            <div class="track-row"><span>Payment Status</span><span class="track-badge ${slug(o.paymentStatus)}">${o.paymentStatus}</span></div>
            <div class="track-row"><span>Order Status</span><span class="track-badge ${slug(o.status)}">${o.status}</span></div>
            <div class="track-row track-items"><span>Items</span><span>${itemsList}</span></div>
          `;
        }
      } catch (err) {
        resultBox.className = "track-result error";
        resultBox.textContent = "Couldn't reach the server. Try again in a moment.";
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Track Order"; }
      }
    });
  }

  /* =========================
     HELP & SUPPORT — TABS
  ========================== */
  const tabButtons = document.querySelectorAll(".support-tab-btn");
  if (tabButtons.length) {
    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".support-panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const panel = document.getElementById(`panel-${btn.dataset.tab}`);
        if (panel) panel.classList.add("active");
      });
    });
  }

  /* =========================
     HELP & SUPPORT — FAQ ACCORDION
  ========================== */
  document.querySelectorAll(".faq-question").forEach(q => {
    q.addEventListener("click", () => {
      const item = q.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(el => el.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });

  /* =========================
     HELP & SUPPORT — RAISE A TICKET (Formspree, no backend needed)
  ========================== */
  const ticketForm = document.getElementById("ticketForm");
  if (ticketForm) {
    ticketForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = document.getElementById("ticketMsg");
      const btn = document.getElementById("ticketSubmitBtn");
      msg.textContent = "";
      btn.disabled = true;
      btn.textContent = "Submitting…";

      try {
        const res = await fetch(ticketForm.action, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(ticketForm),
        });

        if (res.ok) {
          ticketForm.style.display = "none";
          document.getElementById("ticketSuccess").classList.add("open");
        } else {
          msg.textContent = "Couldn't submit right now. Please try again or email us directly.";
        }
      } catch (err) {
        msg.textContent = "Couldn't reach the server. Please try again in a moment.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Submit Ticket";
      }
    });
  }

  /* =========================
     FLOATING HELP LAUNCHER + BACK TO TOP
  ========================== */
  const helpLauncher = document.getElementById("helpLauncher");
  if (helpLauncher) {
    helpLauncher.addEventListener("click", () => {
      const helpSection = document.getElementById("help-section");
      if (helpSection) helpSection.scrollIntoView({ behavior: "smooth" });
    });
  }

  const backToTop = document.getElementById("backToTop");
  if (backToTop) {
    window.addEventListener("scroll", () => {
      backToTop.classList.toggle("show", window.scrollY > 500);
    }, { passive: true });
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

});

/* =========================
   LOAD LOGGED-IN STUDENT'S OWN COURSE + SUBJECTS (database-driven)
========================== */
async function loadCourses() {
  try {
    const meRes = await fetch(`${API}/students/me`, { headers: authHeaders() });
    const meData = await meRes.json();

    const container = document.getElementById("coursesContainer");
    if (!container) return;

    if (!meData.success || !meData.student || !meData.student.course) {
      container.innerHTML = "<p>No course assigned yet</p>";
      return;
    }

    const course = meData.student.course;
    const semester = meData.student.semester;

    const subjectsRes = await fetch(
      `${API}/subjects?course=${course._id}${semester ? `&semester=${semester}` : ""}`,
      { headers: authHeaders() }
    );
    const subjectsData = await subjectsRes.json();
    const subjects = subjectsData.success ? subjectsData.subjects : [];

    container.innerHTML = "";
    const card = document.createElement("div");
    card.className = "course-card";

    const list = subjects.length
      ? subjects.map(s => `<li>${s.name}</li>`).join("")
      : "<li>No subjects added for this semester yet</li>";

    card.innerHTML = `<h3>${course.name}</h3><ul>${list}</ul>`;
    container.appendChild(card);
  } catch (err) {
    console.log("Course load error", err);
  }
}

/* =========================
   STUDENT ATTENDANCE SUMMARY
========================== */
async function loadStudentAttendance(profileId) {
  try {
    const res = await fetch(`${API}/attendance/student/${profileId}`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) return;

    const percent = data.summary.percentage;
    const card = document.getElementById("attPercent");
    if (card) {
      card.innerText = percent + "%";
      card.style.color = percent >= 75 ? "#00ff88" : "#ff4d6d";
    }
  } catch (err) {
    console.log("Attendance load error", err);
  }
}

/* =========================
   VIEW ATTENDANCE (detailed table)
========================== */
async function viewAttendance(profileId) {
  if (typeof showAttendance === "function") showAttendance();

  const res = await fetch(`${API}/attendance/student/${profileId}`, { headers: authHeaders() });
  const data = await res.json();

  const tableBody = document.querySelector("#attendanceTable tbody");
  const percentageEl = document.getElementById("percentage");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!data.success || !data.records || data.records.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="2">No Data</td></tr>`;
    if (percentageEl) percentageEl.innerText = "";
    return;
  }

  data.records.forEach(record => {
    const dateStr = new Date(record.date).toLocaleDateString();
    tableBody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td style="color:${record.status === 'Present' ? '#00ff88' : '#ff4d6d'}">
          ${record.status}
        </td>
      </tr>
    `;
  });

  if (percentageEl) {
    percentageEl.innerText = `Attendance: ${data.summary.percentage}%`;
  }

  localStorage.setItem("currentStudentProfileId", profileId);
}

/* =========================
   FILTER (re-fetches, then filters client-side)
========================== */
async function applyFilter() {
  const profileId = localStorage.getItem("currentStudentProfileId");
  const filterEl = document.getElementById("filterStatus");
  if (!profileId || !filterEl) return;

  const filter = filterEl.value;
  const res = await fetch(`${API}/attendance/student/${profileId}`, { headers: authHeaders() });
  const data = await res.json();
  if (!data.success) return;

  const tableBody = document.querySelector("#attendanceTable tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";
  data.records.forEach(record => {
    if (filter === "All" || record.status === filter) {
      const dateStr = new Date(record.date).toLocaleDateString();
      tableBody.innerHTML += `
        <tr>
          <td>${dateStr}</td>
          <td style="color:${record.status === 'Present' ? '#00ff88' : '#ff4d6d'}">
            ${record.status}
          </td>
        </tr>
      `;
    }
  });
}

/* ============
   SPOTIFY
============= */
function getPlaylistByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "37i9dQZF1DX8NTLI2TtZa6";
  if (hour < 18) return "37i9dQZF1DX3PFzdbtx1Us";
  return "37i9dQZF1DX4WYpdgoIcn6";
}
function loadPlaylist() {
  const playlistId = getPlaylistByTime();
  const frame = document.getElementById("spotifyFrame");
  if (frame) frame.src = `https://open.spotify.com/embed/playlist/${playlistId}`;
}
loadPlaylist();

window.logout = function () {
  localStorage.clear();
  window.location.href = "login.html";
};

/* ============================================================
   COLLEGE STORE (public — no login required)
   Features: product popup, sizes/colors, wishlist, recently viewed,
   sorting, coupon codes, student discount + pre-filled checkout.
   Prices, discounts and totals are ALWAYS decided by the backend
   (POST /store/quote and /store/orders); the browser only displays them.
   ============================================================ */

// Fallback copy in case the backend is unreachable (e.g. cold-starting on
// Render). The real catalog is fetched from `${API}/store/items`, which is
// also the source of truth the backend uses to validate orders.
// Keep in sync with Backend/lib/storeCatalog.js.
const STORE_FALLBACK_PRODUCTS = [
  {"id": "uni-blazer", "name": "College Blazer", "category": "Dress", "price": 1499, "icon": "🧥", "stock": 40, "sold": 0, "description": "College blazer for the GEHU uniform. Choose your size.", "sizes": ["S", "M", "L", "XL", "XXL"]},
  {"id": "uni-tie", "name": "GEHU Tie", "category": "Dress", "price": 199, "icon": "👔", "stock": 100, "sold": 0, "description": "GEHU tie to go with the college uniform."},
  {"id": "uni-shirt", "name": "Formal Shirt (White)", "category": "Dress", "price": 599, "icon": "👕", "stock": 80, "sold": 0, "description": "White formal shirt to go with the college uniform. Choose your size.", "sizes": ["S", "M", "L", "XL", "XXL"]},
  {"id": "uni-id", "name": "ID Card Lanyard", "category": "Dress", "price": 99, "icon": "🪪", "stock": 200, "sold": 0, "description": "Lanyard for your college ID card."},
  {"id": "st-notebook", "name": "Ruled Notebook (200pg)", "category": "Stationery", "price": 60, "icon": "📓", "stock": 300, "sold": 0, "description": "Ruled notebook, 200 pages."},
  {"id": "st-fileset", "name": "File Folder Set (5pc)", "category": "Stationery", "price": 150, "icon": "🗂️", "stock": 120, "sold": 0, "description": "Set of 5 file folders."},
  {"id": "st-calc", "name": "Scientific Calculator", "category": "Stationery", "price": 899, "icon": "🧮", "stock": 35, "sold": 0, "description": "Scientific calculator."},
  {"id": "st-geo", "name": "Geometry Box", "category": "Stationery", "price": 220, "icon": "📐", "stock": 60, "sold": 0, "description": "Geometry box."},
  {"id": "pen-blue", "name": "Blue Ball Pen (Pack of 5)", "category": "Pens", "price": 75, "icon": "🖊️", "stock": 250, "sold": 0, "description": "Pack of 5 blue ball pens."},
  {"id": "pen-gel", "name": "Premium Gel Pen", "category": "Pens", "price": 40, "icon": "✒️", "stock": 150, "sold": 0, "description": "Premium gel pen."},
  {"id": "pen-highlight", "name": "Highlighter Set (4 colors)", "category": "Pens", "price": 130, "icon": "🖍️", "stock": 90, "sold": 0, "description": "Set of 4 highlighters in different colors."},
  {"id": "bk-firstyear", "name": "1st Year Core Book Set", "category": "Books", "price": 2499, "icon": "📚", "stock": 25, "sold": 0, "description": "Core book set for 1st year students."},
  {"id": "bk-labmanual", "name": "Lab Manual (Semester)", "category": "Books", "price": 249, "icon": "📗", "stock": 70, "sold": 0, "description": "Lab manual for the semester."},
  {"id": "bk-referenceguide", "name": "Reference Guide", "category": "Books", "price": 399, "icon": "📘", "stock": 45, "sold": 0, "description": "Reference guide."},
  {"id": "cl-hoodie", "name": "GEHU Hoodie", "category": "Clothes", "price": 999, "icon": "🧶", "stock": 50, "sold": 0, "description": "GEHU hoodie. Choose your size and color.", "sizes": ["S", "M", "L", "XL", "XXL"], "colors": ["Black", "Navy", "Grey"]},
  {"id": "cl-tshirt", "name": "GEHU T-Shirt", "category": "Clothes", "price": 449, "icon": "👚", "stock": 90, "sold": 0, "description": "GEHU t-shirt. Choose your size and color.", "sizes": ["S", "M", "L", "XL", "XXL"], "colors": ["Black", "White", "Navy"]},
  {"id": "cl-cap", "name": "Campus Cap", "category": "Clothes", "price": 249, "icon": "🧢", "stock": 65, "sold": 0, "description": "Campus cap. Choose your color.", "colors": ["Black", "Navy"]}
];

// Icons aren't stored server-side, so we map them back on by product id.
const STORE_ICONS = STORE_FALLBACK_PRODUCTS.reduce((map, p) => {
  map[p.id] = p.icon;
  return map;
}, {});

const STORE_CATEGORIES = ["All", "Dress", "Stationery", "Pens", "Books", "Clothes"];
const STORE_COLOR_HEX = { Black: "#14161c", White: "#f4f4f4", Navy: "#1f2f6b", Grey: "#8b909a", Red: "#c62828", Blue: "#1e5bd8" };
const STORE_MAX_QTY = 50;       // must match the limit in Backend/lib/pricing.js
const STORE_RECENT_MAX = 6;

let storeProducts = [];
let storeActiveCategory = "All";
let storeSortMode = "featured";
let storeWishOnly = false;
let storeStudent = null;        // { name, email, phone, studentId } when a student is logged in
let storeQuote = null;          // last price quote from the backend
let storeCouponCode = "";       // coupon the buyer applied
let storeCouponMsg = { text: "", ok: false };
let storeQuoteSeq = 0;
let pm = null;                  // product popup state: { id, size, color, qty }
let pmLastFocus = null;

/* ---------- small helpers ---------- */
function storeRead(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function storeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/blocked: ignore */ }
}
function escapeStoreHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
const rupee = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const getStoreProduct = id => storeProducts.find(p => p.id === id);
const needsOptions = p => !!(p && ((p.sizes && p.sizes.length) || (p.colors && p.colors.length)));
const maxQtyFor = p => Math.max(1, Math.min(STORE_MAX_QTY, p ? p.stock : STORE_MAX_QTY));
function variantText(size, color) {
  return [size, color].filter(Boolean).join(", ");
}
function productVisual(p, big) {
  if (p.image) {
    return `<img src="${escapeStoreHtml(p.image)}" alt="${escapeStoreHtml(p.name)}" loading="lazy"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${p.icon || "🛍️"}'}))">`;
  }
  return `<span>${p.icon || "🛍️"}</span>`;
}

let storeToastTimer;
function showStoreToast(text, opts = {}) {
  const { cart = true, info = false } = opts;
  let toast = document.getElementById("storeToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "storeToast";
    toast.className = "store-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.classList.toggle("info", info);
  toast.innerHTML = `<span class="store-toast-tick">${info ? "i" : "✓"}</span><span></span>${cart ? `<button type="button" onclick="openStoreCart()">View Cart</button>` : ""}`;
  toast.children[1].textContent = text;
  toast.classList.add("show");
  clearTimeout(storeToastTimer);
  storeToastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

/* ---------- catalog ---------- */
async function loadStoreProducts() {
  const grid = document.getElementById("storeGrid");
  if (!grid) return; // store section isn't on this page

  try {
    const res = await fetch(`${API}/store/items`);
    const data = await res.json();
    storeProducts = data.success && data.items.length
      ? data.items.map(p => ({ ...p, icon: STORE_ICONS[p.id] || "🛍️" }))
      : STORE_FALLBACK_PRODUCTS;
  } catch (err) {
    storeProducts = STORE_FALLBACK_PRODUCTS;
  }

  pruneStoreCart();
  renderStoreFilters();
  renderStoreProducts();
  renderStoreRecent();
  saveStoreCart(getStoreCart());
  refreshStoreQuote();
}

/* ---------- cart ----------
   Each cart LINE is one product + size + color, so a blazer in M and a blazer
   in L are separate lines. Stored as { "id|size|color": { productId, size, color, qty } }.
   Carts saved by the older version ({ id: qty }) are converted on the fly. */
function storeLineKey(productId, size, color) {
  return [productId, size || "", color || ""].join("|");
}
function getStoreCart() {
  const raw = storeRead("storeCart", {});
  const cart = {};
  Object.entries(raw).forEach(([key, v]) => {
    if (typeof v === "number") {
      if (v > 0) cart[storeLineKey(key)] = { productId: key, size: "", color: "", qty: Math.floor(v) };
    } else if (v && v.productId && v.qty > 0) {
      cart[key] = { productId: v.productId, size: v.size || "", color: v.color || "", qty: Math.floor(v.qty) };
    }
  });
  return cart;
}
function saveStoreCart(cart) {
  storeWrite("storeCart", cart);
  const countEl = document.getElementById("storeCartCount");
  if (countEl) countEl.innerText = Object.values(cart).reduce((sum, l) => sum + l.qty, 0);
}
// Drop lines that can no longer be ordered (product gone, or a size/color is
// missing - e.g. a cart saved before sizes existed).
function pruneStoreCart() {
  const cart = getStoreCart();
  let removed = 0;
  Object.entries(cart).forEach(([key, line]) => {
    const p = getStoreProduct(line.productId);
    const bad = !p
      || (p.sizes && !p.sizes.includes(line.size))
      || (!p.sizes && line.size)
      || (p.colors && !p.colors.includes(line.color))
      || (!p.colors && line.color);
    if (bad) { delete cart[key]; removed++; }
  });
  if (removed) {
    saveStoreCart(cart);
    showStoreToast("Some cart items were removed because they need a size or color. Please add them again.", { cart: false, info: true });
  }
}

function addToStoreCart(productId, opts = {}, btn) {
  const p = getStoreProduct(productId);
  if (!p || p.stock <= 0) return false;
  const size = opts.size || "";
  const color = opts.color || "";
  const addQty = Math.max(1, opts.qty || 1);

  const cart = getStoreCart();
  const key = storeLineKey(productId, size, color);
  const line = cart[key] || { productId, size, color, qty: 0 };
  line.qty = Math.min(maxQtyFor(p), line.qty + addQty);
  cart[key] = line;
  saveStoreCart(cart);

  const vt = variantText(size, color);
  showStoreToast(`${p.name}${vt ? ` (${vt})` : ""} added to cart${line.qty > 1 ? ` (x${line.qty})` : ""}`);

  if (btn) {
    const original = btn.dataset.label || btn.textContent.trim();
    btn.dataset.label = original;
    btn.textContent = "✓ Added";
    btn.classList.add("added");
    clearTimeout(btn._resetTimer);
    btn._resetTimer = setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("added");
    }, 1200);
  }

  const badge = document.getElementById("storeCartCount");
  if (badge) {
    badge.classList.remove("pop");
    void badge.offsetWidth; // restart the animation
    badge.classList.add("pop");
  }
  refreshStoreQuote();
  return true;
}

function changeStoreQty(key, delta) {
  const cart = getStoreCart();
  const line = cart[key];
  if (!line) return;
  line.qty = Math.min(maxQtyFor(getStoreProduct(line.productId)), line.qty + delta);
  if (line.qty <= 0) delete cart[key];
  saveStoreCart(cart);
  renderStoreCartItems();
  refreshStoreQuote();
}

function removeFromStoreCart(key) {
  const cart = getStoreCart();
  delete cart[key];
  saveStoreCart(cart);
  renderStoreCartItems();
  refreshStoreQuote();
}

function openStoreCart() {
  closeProductModal();
  renderStoreCartItems();
  renderStoreSummary();
  document.getElementById("storeCartDrawer").classList.add("open");
  document.getElementById("storeOverlay").classList.add("open");
  refreshStoreQuote();
}
function closeStoreCart() {
  document.getElementById("storeCartDrawer").classList.remove("open");
  document.getElementById("storeOverlay").classList.remove("open");
}

function renderStoreCartItems() {
  const cart = getStoreCart();
  const container = document.getElementById("storeCartItems");
  if (!container) return;
  const keys = Object.keys(cart);

  if (!keys.length) {
    container.innerHTML = `<div class="store-cart-empty">Your cart is empty</div>`;
    renderStoreSummary();
    return;
  }

  container.innerHTML = "";
  keys.forEach(key => {
    const line = cart[key];
    const product = getStoreProduct(line.productId);
    if (!product) return;
    const vt = variantText(line.size, line.color);

    const row = document.createElement("div");
    row.className = "store-cart-item";
    row.dataset.key = key;
    row.innerHTML = `
      <div class="info">
        <h5>${product.icon || "🛍️"} ${escapeStoreHtml(product.name)}</h5>
        ${vt ? `<em class="store-cart-variant">${escapeStoreHtml(vt)}</em>` : ""}
        <span>${rupee(product.price)} x ${line.qty} = ${rupee(product.price * line.qty)}</span>
      </div>
      <div class="store-qty-controls">
        <button type="button" data-act="dec" aria-label="Decrease quantity">-</button>
        <span>${line.qty}</span>
        <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
        <button type="button" class="store-remove-btn" data-act="remove">Remove</button>
      </div>
    `;
    container.appendChild(row);
  });
  renderStoreSummary();
}

/* ---------- price quote (discounts come from the backend) ---------- */
function storeCartPayload() {
  return Object.values(getStoreCart()).map(l => ({
    productId: l.productId, quantity: l.qty, size: l.size || undefined, color: l.color || undefined
  }));
}
function storeLocalSubtotal() {
  return Object.values(getStoreCart()).reduce((sum, l) => {
    const p = getStoreProduct(l.productId);
    return sum + (p ? p.price * l.qty : 0);
  }, 0);
}
async function postStoreQuote(couponCode) {
  const emailEl = document.getElementById("cf-email");
  const idEl = document.getElementById("cf-studentid");
  const res = await fetch(`${API}/store/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      items: storeCartPayload(),
      couponCode,
      email: emailEl ? emailEl.value.trim() : "",
      studentId: idEl ? idEl.value.trim() : "",
    }),
  });
  return res.json();
}

async function refreshStoreQuote() {
  const items = storeCartPayload();
  if (!items.length) {
    storeQuote = null;
    storeCouponMsg = { text: "", ok: false };
    renderStoreSummary();
    return;
  }
  const seq = ++storeQuoteSeq;
  try {
    let data = await postStoreQuote(storeCouponCode);
    if (seq !== storeQuoteSeq) return; // a newer request superseded this one

    if (!data.success && storeCouponCode) {
      // The coupon doesn't apply right now (e.g. cart below the minimum): say why, price without it.
      storeCouponMsg = { text: data.message, ok: false };
      data = await postStoreQuote("");
      if (seq !== storeQuoteSeq) return;
    } else if (data.success && storeCouponCode) {
      storeCouponMsg = data.couponSkipped
        ? { text: `${storeCouponCode} saves less than your student discount, so the student discount was used.`, ok: true }
        : { text: `${data.couponCode} applied: ${data.discountLabel}`, ok: true };
    }
    storeQuote = data.success ? data : null;
  } catch (err) {
    if (seq !== storeQuoteSeq) return;
    storeQuote = null; // backend unreachable: show the plain subtotal
  }
  renderStoreSummary();
}

function summaryHtml() {
  const subtotal = storeLocalSubtotal();
  if (!subtotal) return `<div class="store-summary-row total"><span>Total</span><span>₹0</span></div>`;
  const q = storeQuote;
  if (!q || !q.discountAmount) {
    return `<div class="store-summary-row total"><span>Total</span><span>${rupee(q ? q.totalAmount : subtotal)}</span></div>`;
  }
  return `
    <div class="store-summary-row"><span>Subtotal</span><span>${rupee(q.subtotal)}</span></div>
    <div class="store-summary-row discount"><span>${escapeStoreHtml(q.discountLabel)}</span><span>−${rupee(q.discountAmount)}</span></div>
    <div class="store-summary-row total"><span>Total</span><span>${rupee(q.totalAmount)}</span></div>`;
}
function renderStoreSummary() {
  const html = summaryHtml();
  ["storeCartSummary", "checkoutSummary"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  const total = storeQuote ? storeQuote.totalAmount : storeLocalSubtotal();
  const upi = document.getElementById("storeUpiAmount");
  if (upi) upi.textContent = rupee(total);

  const msg = document.getElementById("storeCouponMsg");
  if (msg) {
    msg.textContent = storeCouponMsg.text;
    msg.className = "store-coupon-msg" + (storeCouponMsg.text ? (storeCouponMsg.ok ? " ok" : " err") : "");
  }
  const input = document.getElementById("storeCouponInput");
  const btn = document.getElementById("storeCouponBtn");
  if (input && btn) {
    const applied = !!storeCouponCode && storeCouponMsg.ok;
    btn.textContent = applied ? "Remove" : "Apply";
    btn.dataset.mode = applied ? "remove" : "apply";
    input.readOnly = applied;
    if (applied) input.value = storeCouponCode;
  }
}

async function applyStoreCoupon() {
  const input = document.getElementById("storeCouponInput");
  const btn = document.getElementById("storeCouponBtn");

  if (btn.dataset.mode === "remove") {
    storeCouponCode = "";
    storeCouponMsg = { text: "", ok: false };
    input.value = "";
    storeWrite("storeCoupon", "");
    refreshStoreQuote();
    return;
  }

  const code = input.value.trim().toUpperCase();
  if (!code) { storeCouponMsg = { text: "Enter a coupon code first.", ok: false }; renderStoreSummary(); return; }
  if (!storeCartPayload().length) { storeCouponMsg = { text: "Add something to your cart first.", ok: false }; renderStoreSummary(); return; }

  btn.disabled = true;
  try {
    const data = await postStoreQuote(code);
    if (data.success) {
      storeCouponCode = code;
      storeWrite("storeCoupon", code);
      storeQuote = data;
      storeCouponMsg = data.couponSkipped
        ? { text: `${code} saves less than your student discount, so the student discount was used.`, ok: true }
        : { text: `${data.couponCode} applied: ${data.discountLabel}`, ok: true };
    } else {
      storeCouponMsg = { text: data.message || "That coupon didn't work.", ok: false };
    }
  } catch (err) {
    storeCouponMsg = { text: "Can't check the coupon right now. Please try again.", ok: false };
  } finally {
    btn.disabled = false;
    renderStoreSummary();
  }
}

/* ---------- wishlist + recently viewed (saved on this device) ---------- */
const getWishlist = () => storeRead("storeWishlist", []);
const isWished = id => getWishlist().includes(id);

function toggleWishlist(id) {
  const list = getWishlist();
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  storeWrite("storeWishlist", list);
  const p = getStoreProduct(id);
  showStoreToast(i >= 0 ? "Removed from wishlist" : `${p ? p.name : "Item"} saved to wishlist`, { cart: false });
  renderStoreFilters();
  renderStoreProducts();
  if (pm && pm.id === id) renderProductModal();
}

function pushRecent(id) {
  const list = storeRead("storeRecent", []).filter(x => x !== id);
  list.unshift(id);
  storeWrite("storeRecent", list.slice(0, STORE_RECENT_MAX));
  renderStoreRecent();
}
function renderStoreRecent() {
  const wrap = document.getElementById("storeRecent");
  const row = document.getElementById("storeRecentRow");
  if (!wrap || !row) return;
  const items = storeRead("storeRecent", []).map(getStoreProduct).filter(Boolean);
  wrap.hidden = !items.length;
  row.innerHTML = items.map(p => `
    <button type="button" class="store-recent-item" data-id="${escapeStoreHtml(p.id)}">
      <span class="store-recent-icon">${productVisual(p)}</span>
      <span class="store-recent-name">${escapeStoreHtml(p.name)}</span>
      <span class="store-recent-price">${rupee(p.price)}</span>
    </button>`).join("");
}

/* ---------- listing: filters, sorting, cards ---------- */
function renderStoreFilters() {
  const bar = document.getElementById("storeFilterBar");
  if (!bar) return;
  bar.innerHTML = "";
  STORE_CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "store-filter-btn" + (!storeWishOnly && cat === storeActiveCategory ? " active" : "");
    btn.innerText = cat;
    btn.onclick = () => { storeActiveCategory = cat; storeWishOnly = false; renderStoreFilters(); renderStoreProducts(); };
    bar.appendChild(btn);
  });
  const wish = document.createElement("button");
  wish.className = "store-filter-btn wish" + (storeWishOnly ? " active" : "");
  wish.innerText = `♥ Wishlist (${getWishlist().length})`;
  wish.onclick = () => { storeWishOnly = !storeWishOnly; renderStoreFilters(); renderStoreProducts(); };
  bar.appendChild(wish);
}

function sortStoreProducts(list) {
  const indexOf = new Map(storeProducts.map((p, i) => [p.id, i]));
  const byFeatured = (a, b) => indexOf.get(a.id) - indexOf.get(b.id);
  const sorted = [...list];
  switch (storeSortMode) {
    case "popular":    sorted.sort((a, b) => (b.sold || 0) - (a.sold || 0) || byFeatured(a, b)); break;
    case "price-asc":  sorted.sort((a, b) => a.price - b.price || byFeatured(a, b)); break;
    case "price-desc": sorted.sort((a, b) => b.price - a.price || byFeatured(a, b)); break;
    case "name":       sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
    default:           sorted.sort(byFeatured);
  }
  return sorted;
}

function variantHint(p) {
  const bits = [];
  if (p.sizes && p.sizes.length) bits.push(p.sizes.length > 1 ? `${p.sizes[0]}–${p.sizes[p.sizes.length - 1]}` : p.sizes[0]);
  if (p.colors && p.colors.length) bits.push(`${p.colors.length} color${p.colors.length > 1 ? "s" : ""}`);
  return bits.join(" · ");
}

function renderStoreProducts() {
  const grid = document.getElementById("storeGrid");
  const searchEl = document.getElementById("storeSearch");
  if (!grid) return;
  const search = searchEl ? searchEl.value.trim().toLowerCase() : "";
  const wished = getWishlist();

  const filtered = storeProducts.filter(p => {
    const matchesCategory = storeWishOnly ? wished.includes(p.id) : (storeActiveCategory === "All" || p.category === storeActiveCategory);
    const matchesSearch = !search || p.name.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  if (!filtered.length) {
    grid.innerHTML = `<div class="store-empty-note">${storeWishOnly && !search
      ? "Your wishlist is empty. Tap the ♡ on any item to save it for later."
      : "No items match your search."}</div>`;
    return;
  }

  sortStoreProducts(filtered).forEach(p => {
    const outOfStock = p.stock <= 0;
    const opts = needsOptions(p);
    const hint = variantHint(p);
    const liked = wished.includes(p.id);
    const card = document.createElement("div");
    card.className = "store-product-card";
    card.dataset.id = p.id;
    card.innerHTML = `
      <button type="button" class="store-heart${liked ? " on" : ""}" data-act="wish" aria-pressed="${liked}"
        aria-label="${liked ? "Remove from wishlist" : "Save to wishlist"}">${liked ? "♥" : "♡"}</button>
      <button type="button" class="store-card-open" data-act="open" aria-label="View details for ${escapeStoreHtml(p.name)}">
        <div class="store-product-icon">${productVisual(p)}</div>
        <div class="cat-tag">${escapeStoreHtml(p.category)}</div>
        <h4>${escapeStoreHtml(p.name)}</h4>
      </button>
      <div class="store-price">${rupee(p.price)}</div>
      ${hint ? `<div class="store-variant-hint">${escapeStoreHtml(hint)}</div>` : ""}
      <div class="store-stock-note">${outOfStock ? "Out of stock" : p.stock + " in stock"}</div>
      <button class="store-add-btn" data-act="${opts ? "open" : "add"}" ${outOfStock ? "disabled" : ""}>
        ${outOfStock ? "Unavailable" : (opts ? "Select Options" : "Add to Cart")}
      </button>
    `;
    grid.appendChild(card);
  });
}

/* ---------- product detail popup ---------- */
function openProductModal(id) {
  const p = getStoreProduct(id);
  if (!p) return;
  pm = {
    id,
    size: p.sizes && p.sizes.length === 1 ? p.sizes[0] : "",
    color: p.colors && p.colors.length === 1 ? p.colors[0] : "",
    qty: 1,
  };
  pmLastFocus = document.activeElement;
  pushRecent(id);
  renderProductModal();
  const modal = document.getElementById("productModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("productOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("pmClose").focus();
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (!modal || !modal.classList.contains("open")) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.getElementById("productOverlay").classList.remove("open");
  document.body.style.overflow = "";
  pm = null;
  if (pmLastFocus && pmLastFocus.focus) pmLastFocus.focus();
}

function renderProductModal() {
  if (!pm) return;
  const p = getStoreProduct(pm.id);
  const body = document.getElementById("productModalBody");
  if (!p || !body) return;
  const out = p.stock <= 0;
  const liked = isWished(p.id);
  const low = !out && p.stock <= 10;

  const sizeHtml = p.sizes ? `
    <div class="pm-group" data-group="size">
      <div class="pm-label">Size <b>*</b><span class="pm-chosen">${escapeStoreHtml(pm.size)}</span></div>
      <div class="pm-chips">${p.sizes.map(s => `
        <button type="button" class="pm-chip${pm.size === s ? " on" : ""}" data-act="size" data-v="${escapeStoreHtml(s)}" aria-pressed="${pm.size === s}">${escapeStoreHtml(s)}</button>`).join("")}
      </div>
    </div>` : "";

  const colorHtml = p.colors ? `
    <div class="pm-group" data-group="color">
      <div class="pm-label">Color <b>*</b><span class="pm-chosen">${escapeStoreHtml(pm.color)}</span></div>
      <div class="pm-chips">${p.colors.map(c => `
        <button type="button" class="pm-chip pm-color${pm.color === c ? " on" : ""}" data-act="color" data-v="${escapeStoreHtml(c)}" aria-pressed="${pm.color === c}">
          <i style="background:${STORE_COLOR_HEX[c] || "#888"}"></i>${escapeStoreHtml(c)}</button>`).join("")}
      </div>
    </div>` : "";

  body.innerHTML = `
    <div class="pm-grid">
      <div class="pm-photo">${productVisual(p, true)}</div>
      <div class="pm-info">
        <div class="cat-tag">${escapeStoreHtml(p.category)}</div>
        <h3 id="pmName">${escapeStoreHtml(p.name)}</h3>
        <div class="pm-price">${rupee(p.price)}</div>
        <p class="pm-desc">${escapeStoreHtml(p.description || "")}</p>
        ${sizeHtml}${colorHtml}
        <div class="pm-stock ${out ? "out" : low ? "low" : ""}">${out ? "Out of stock" : low ? `Only ${p.stock} left` : "In stock"}</div>
        <div class="pm-row">
          <div class="store-qty-controls pm-qty">
            <button type="button" data-act="dec" aria-label="Decrease quantity">-</button>
            <span>${pm.qty}</span>
            <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="store-heart pm-heart${liked ? " on" : ""}" data-act="wish" aria-pressed="${liked}"
            aria-label="${liked ? "Remove from wishlist" : "Save to wishlist"}">${liked ? "♥" : "♡"}</button>
        </div>
        <p class="pm-msg" id="pmMsg" aria-live="polite"></p>
        <button type="button" class="store-checkout-btn" data-act="add" ${out ? "disabled" : ""}>
          ${out ? "Unavailable" : `Add to Cart · ${rupee(p.price * pm.qty)}`}
        </button>
      </div>
    </div>`;
}

function handleProductModalClick(e) {
  const btn = e.target.closest("[data-act]");
  if (!btn || !pm) return;
  const p = getStoreProduct(pm.id);
  switch (btn.dataset.act) {
    case "size":  pm.size = pm.size === btn.dataset.v ? "" : btn.dataset.v; renderProductModal(); break;
    case "color": pm.color = pm.color === btn.dataset.v ? "" : btn.dataset.v; renderProductModal(); break;
    case "inc":   pm.qty = Math.min(maxQtyFor(p), pm.qty + 1); renderProductModal(); break;
    case "dec":   pm.qty = Math.max(1, pm.qty - 1); renderProductModal(); break;
    case "wish":  toggleWishlist(pm.id); break;
    case "add": {
      const missing = [];
      if (p.sizes && !pm.size) missing.push("size");
      if (p.colors && !pm.color) missing.push("color");
      if (missing.length) {
        document.getElementById("pmMsg").textContent = `Please choose a ${missing.join(" and ")}.`;
        missing.forEach(g => {
          const el = document.querySelector(`.pm-group[data-group="${g}"]`);
          if (el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake", "need"); }
        });
        return;
      }
      if (addToStoreCart(pm.id, { size: pm.size, color: pm.color, qty: pm.qty })) closeProductModal();
      break;
    }
  }
}

/* ---------- receipt ---------- */
let lastStoreReceiptHtml = "";

function buildReceiptHtml(order) {
  const fmt = d => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const rows = order.items.map(i => {
    const vt = variantText(i.size, i.color);
    return `
    <tr>
      <td>${escapeStoreHtml(i.name)}${vt ? `<br><small>${escapeStoreHtml(vt)}</small>` : ""}</td>
      <td class="num">${i.quantity}</td>
      <td class="num">₹${i.price}</td>
      <td class="num">₹${i.price * i.quantity}</td>
    </tr>`;
  }).join("");
  const payLabel = order.paymentMethod === "UPI" ? "UPI (awaiting verification)" : "Cash on Delivery / Pickup";
  const discountRows = order.discountAmount > 0 ? `
        <tr><td colspan="3">Subtotal</td><td class="num">₹${order.subtotal != null ? order.subtotal : order.totalAmount + order.discountAmount}</td></tr>
        <tr><td colspan="3">${escapeStoreHtml(order.discountLabel || "Discount")}${order.couponCode ? ` (${escapeStoreHtml(order.couponCode)})` : ""}</td><td class="num">−₹${order.discountAmount}</td></tr>` : "";

  return `
    <div class="receipt">
      <h3>GEHU Store — Order Receipt</h3>
      <p class="receipt-sub">Graphic Era Hill University</p>
      <div class="receipt-meta">
        <div><span>Order ID</span><b>${escapeStoreHtml(order._id)}</b></div>
        <div><span>Date</span><b>${fmt(order.createdAt)}</b></div>
        <div><span>Customer</span><b>${escapeStoreHtml(order.customerName)}</b></div>
        <div><span>Phone</span><b>${escapeStoreHtml(order.phone)}</b></div>
        <div><span>Deliver to</span><b>${escapeStoreHtml(order.address)}</b></div>
        <div><span>Payment</span><b>${payLabel}</b></div>
        <div><span>Expected delivery</span><b>Within 7 days (by ${fmt(order.estimatedDelivery || new Date(new Date(order.createdAt).getTime() + 7 * 86400000))})</b></div>
      </div>
      <table>
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>${discountRows}<tr class="grand"><td colspan="3">Total</td><td class="num">₹${order.totalAmount}</td></tr></tfoot>
      </table>
      <p class="receipt-foot">Keep your Order ID — you need it with your Student ID to track this order.</p>
    </div>`;
}

function showOrderConfirmation(order) {
  lastStoreReceiptHtml = buildReceiptHtml(order);
  const box = document.getElementById("checkoutSuccess");
  box.innerHTML = `
    <h4>Order placed! 🎉</h4>
    <p>Thank you, ${escapeStoreHtml(order.customerName.split(" ")[0])}! Your package will be delivered within 7 days.
       We've sent a confirmation SMS to <b>${escapeStoreHtml(order.phone)}</b>.</p>
    ${lastStoreReceiptHtml}
    <div class="receipt-actions">
      <button class="store-checkout-btn" onclick="printStoreReceipt()">Download / Print Receipt</button>
      <button class="store-checkout-btn secondary" onclick="closeCheckoutForm()">Done</button>
    </div>`;
  box.classList.add("open");
}

function printStoreReceipt() {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to download your receipt."); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>GEHU Store Receipt</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;padding:32px;max-width:640px;margin:auto}
      h3{margin:0}.receipt-sub{color:#666;margin:2px 0 18px}
      .receipt-meta div{display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #eee;font-size:14px}
      .receipt-meta span{color:#666}.receipt-meta b{text-align:right;word-break:break-all}
      table{width:100%;border-collapse:collapse;margin-top:18px;font-size:14px}
      th,td{padding:8px 4px;border-bottom:1px solid #ddd;text-align:left}
      small{color:#666}
      .num{text-align:right}tfoot td{border-bottom:none}tfoot tr.grand td{font-weight:bold;font-size:16px}
      .receipt-foot{color:#666;font-size:12px;margin-top:20px}
    </style></head><body>${lastStoreReceiptHtml}</body></html>`);
  w.document.close();
  w.focus();
  w.print(); // choose "Save as PDF" in the print dialog to download
}

/* ---------- student: pre-filled details + banner ---------- */
async function loadStoreStudent() {
  const banner = document.getElementById("storeStudentBanner");
  if (!banner) return;

  if (localStorage.getItem("token") && localStorage.getItem("role") === "student") {
    try {
      const res = await fetch(`${API}/store/me`, { headers: authHeaders() });
      const data = await res.json();
      if (data.success && data.student) storeStudent = data.student;
    } catch (err) { /* offline: behave like a guest */ }
  }

  if (storeStudent) {
    banner.innerHTML = `🎓 Hi <b>${escapeStoreHtml(storeStudent.name.split(" ")[0])}</b>! Your student discount is applied automatically at checkout, and your details are pre-filled.`;
    banner.classList.add("on");
  } else {
    banner.innerHTML = `🎓 Are you a GEHU student? <a href="login.html">Log in</a> for an automatic student discount and faster checkout. You can still order without logging in.`;
    banner.classList.remove("on");
  }
  banner.hidden = false;
  refreshStoreQuote(); // pick up the student discount in the cart totals
}

function prefillCheckoutForStudent() {
  const note = document.getElementById("checkoutStudentNote");
  const idEl = document.getElementById("cf-studentid");
  if (!storeStudent) {
    if (note) note.hidden = true;
    if (idEl) idEl.readOnly = false;
    return;
  }
  const fill = (id, val) => {
    const el = document.getElementById(id);
    if (el && !el.value && val) el.value = val;
  };
  fill("cf-name", storeStudent.name);
  fill("cf-email", storeStudent.email);
  fill("cf-phone", storeStudent.phone);
  if (idEl) { idEl.value = storeStudent.studentId; idEl.readOnly = true; }
  if (note) {
    note.textContent = "Details filled from your student account. You can edit anything except your Student ID.";
    note.hidden = false;
  }
}

/* ---------- checkout modal ---------- */
function openCheckoutForm() {
  const cart = getStoreCart();
  if (!Object.keys(cart).length) return;

  closeStoreCart();
  document.getElementById("checkoutForm").style.display = "flex";
  document.getElementById("checkoutSuccess").classList.remove("open");
  document.getElementById("checkoutMsg").textContent = "";
  document.getElementById("checkoutModal").classList.add("open");
  document.getElementById("checkoutOverlay").classList.add("open");
  prefillCheckoutForStudent();
  updateStorePaymentUI();
  renderStoreSummary();
  refreshStoreQuote();
}
function closeCheckoutForm() {
  document.getElementById("checkoutModal").classList.remove("open");
  document.getElementById("checkoutOverlay").classList.remove("open");
}

function getSelectedPaymentMethod() {
  const checked = document.querySelector('input[name="paymentMethod"]:checked');
  return checked ? checked.value : "UPI";
}

function updateStorePaymentUI() {
  const upiBox = document.getElementById("storeUpiBox");
  const transactionInput = document.getElementById("cf-transactionref");
  if (!upiBox) return;
  const isUpi = getSelectedPaymentMethod() === "UPI";
  upiBox.classList.toggle("open", isUpi);
  if (transactionInput) transactionInput.required = isUpi;
}

function initCheckoutForm() {
  const form = document.getElementById("checkoutForm");
  if (!form) return;

  document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener("change", updateStorePaymentUI);
  });

  // Re-check the price when the buyer types their email / student ID, so a
  // once-per-customer coupon that was already used is caught BEFORE they pay.
  ["cf-email", "cf-studentid"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", refreshStoreQuote);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("checkoutMsg");
    const submitBtn = document.getElementById("checkoutSubmitBtn");
    msg.textContent = "";

    const items = storeCartPayload();
    if (!items.length) {
      msg.textContent = "Your cart is empty.";
      return;
    }

    const paymentMethod = getSelectedPaymentMethod();
    const transactionRef = document.getElementById("cf-transactionref").value.trim();

    const body = {
      customerName: document.getElementById("cf-name").value.trim(),
      email: document.getElementById("cf-email").value.trim(),
      phone: document.getElementById("cf-phone").value.trim(),
      studentId: document.getElementById("cf-studentid").value.trim(),
      address: document.getElementById("cf-address").value.trim(),
      items,
      paymentMethod,
      transactionRef,
      couponCode: storeCouponMsg.ok ? storeCouponCode : "",
    };

    if (!body.customerName || !body.email || !body.phone || !body.address) {
      msg.textContent = "Please fill in all required fields.";
      return;
    }

    if (paymentMethod === "UPI" && !transactionRef) {
      msg.textContent = "Enter your UPI transaction/reference ID after paying.";
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Placing order…";

    try {
      const res = await fetch(`${API}/store/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        storeWrite("storeCart", {});
        saveStoreCart({});
        storeCouponCode = "";
        storeCouponMsg = { text: "", ok: false };
        storeQuote = null;
        storeWrite("storeCoupon", "");
        form.reset();
        form.style.display = "none";
        updateStorePaymentUI();
        renderStoreSummary();
        showOrderConfirmation(data.order);
      } else {
        msg.textContent = data.message || "Could not place order. Please try again.";
        refreshStoreQuote(); // keep the amount on screen honest
      }
    } catch (err) {
      msg.textContent = "Can't reach the backend right now. Please try again in a moment.";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
    }
  });
}

/* ---------- wiring ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("storeGrid")) return;

  storeCouponCode = storeRead("storeCoupon", "") || "";
  const couponInput = document.getElementById("storeCouponInput");
  if (couponInput && storeCouponCode) couponInput.value = storeCouponCode;

  loadStoreProducts();
  loadStoreStudent();
  initCheckoutForm();
  saveStoreCart(getStoreCart()); // sync the cart count badge on page load

  const searchEl = document.getElementById("storeSearch");
  if (searchEl) searchEl.addEventListener("input", renderStoreProducts);

  const sortEl = document.getElementById("storeSort");
  if (sortEl) sortEl.addEventListener("change", () => { storeSortMode = sortEl.value; renderStoreProducts(); });

  // product grid: heart / open details / quick add (one listener for all cards)
  document.getElementById("storeGrid").addEventListener("click", e => {
    const card = e.target.closest(".store-product-card");
    if (!card) return;
    const id = card.dataset.id;
    const act = e.target.closest("[data-act]");
    if (act && act.dataset.act === "wish") return toggleWishlist(id);
    if (act && act.dataset.act === "add") return addToStoreCart(id, {}, act);
    if (act && act.disabled) return;
    openProductModal(id); // "Select Options", the photo/title, or a click anywhere else on the card
  });

  document.getElementById("storeRecentRow").addEventListener("click", e => {
    const item = e.target.closest(".store-recent-item");
    if (item) openProductModal(item.dataset.id);
  });
  document.getElementById("storeRecentClear").addEventListener("click", () => {
    storeWrite("storeRecent", []);
    renderStoreRecent();
  });

  document.getElementById("productModal").addEventListener("click", handleProductModalClick);
  document.getElementById("productOverlay").addEventListener("click", closeProductModal);
  document.getElementById("pmClose").addEventListener("click", closeProductModal);

  // cart lines: + / - / remove
  document.getElementById("storeCartItems").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    const row = e.target.closest(".store-cart-item");
    if (!btn || !row) return;
    const key = row.dataset.key;
    if (btn.dataset.act === "inc") changeStoreQty(key, 1);
    else if (btn.dataset.act === "dec") changeStoreQty(key, -1);
    else if (btn.dataset.act === "remove") removeFromStoreCart(key);
  });

  document.getElementById("storeCouponForm").addEventListener("submit", e => {
    e.preventDefault();
    applyStoreCoupon();
  });

  // Esc closes whatever is open, topmost first
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (document.getElementById("productModal").classList.contains("open")) closeProductModal();
    else if (document.getElementById("checkoutModal").classList.contains("open")) closeCheckoutForm();
    else if (document.getElementById("storeCartDrawer").classList.contains("open")) closeStoreCart();
  });
});

/* ============================================================
   CHEAT NOTES TERMINAL
   - Everyone can read (public GET /cheatnotes).
   - Only a logged-in admin sees edit controls; the server also
     enforces admin-only writes, so hiding the UI is not the only guard.
   ============================================================ */
(function initCheatTerminal() {
  document.addEventListener("DOMContentLoaded", () => {
    const wrap = document.getElementById("cheatTerminal");
    if (!wrap) return;

    const listEl = document.getElementById("termNotes");
    const searchEl = document.getElementById("termSearch");
    const newBtn = document.getElementById("termNewBtn");
    const badge = document.getElementById("termAdminBadge");

    const isAdmin = !!localStorage.getItem("token") && localStorage.getItem("role") === "admin";
    let notes = [];
    let editingId = null; // note id being edited, or "new"

    if (isAdmin) {
      newBtn.hidden = false;
      badge.hidden = false;
    }

    function el(tag, cls, text) {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (text !== undefined) n.textContent = text; // textContent => no HTML injection
      return n;
    }

    function slug(title) {
      return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "note";
    }

    function fmtDate(d) {
      return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    }

    async function api(path, options = {}) {
      const res = await fetch(`${API}/cheatnotes${path}`, {
        ...options,
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      let data = {};
      try { data = await res.json(); } catch (e) { /* non-JSON error */ }
      if (res.status === 401 || res.status === 403) {
        throw new Error("Your admin session has expired. Please log in again.");
      }
      if (!res.ok || !data.success) throw new Error(data.message || "Something went wrong.");
      return data;
    }

    function buildEditor(note) {
      const box = el("div", "term-editor");
      box.appendChild(el("label", "", "title"));
      const title = el("input");
      title.maxLength = 80;
      title.placeholder = "e.g. git-basics";
      title.value = note ? note.title : "";
      box.appendChild(title);

      box.appendChild(el("label", "", "content"));
      const content = el("textarea");
      content.maxLength = 5000;
      content.placeholder = "Write your note here…";
      content.value = note ? note.content : "";
      box.appendChild(content);

      const err = el("div", "term-error");
      const actions = el("div", "term-editor-actions");
      const save = el("button", "term-btn primary", "save");
      save.type = "button";
      const cancel = el("button", "term-btn", "cancel");
      cancel.type = "button";
      actions.append(save, cancel, err);
      box.appendChild(actions);

      cancel.addEventListener("click", () => { editingId = null; render(); });
      save.addEventListener("click", async () => {
        err.textContent = "";
        if (!title.value.trim() || !content.value.trim()) {
          err.textContent = "Title and content are required.";
          return;
        }
        save.disabled = true;
        save.textContent = "saving…";
        try {
          const body = JSON.stringify({ title: title.value, content: content.value });
          if (note) await api(`/${note._id}`, { method: "PUT", body });
          else await api("", { method: "POST", body });
          editingId = null;
          await load();
        } catch (e) {
          err.textContent = e.message;
          save.disabled = false;
          save.textContent = "save";
        }
      });
      setTimeout(() => title.focus(), 0);
      return box;
    }

    function render() {
      listEl.textContent = "";
      const q = searchEl.value.trim().toLowerCase();

      if (isAdmin && editingId === "new") listEl.appendChild(buildEditor(null));

      const shown = notes.filter((n) =>
        !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );

      if (!shown.length && editingId !== "new") {
        listEl.appendChild(el("div", "term-dim",
          notes.length ? "grep: no matches found." : "(empty) — no notes yet."));
        return;
      }

      shown.forEach((n) => {
        if (isAdmin && editingId === n._id) {
          listEl.appendChild(buildEditor(n));
          return;
        }
        const item = el("div", "term-note");
        const head = el("div", "term-note-head");
        const cmd = el("span", "term-cmd");
        cmd.append(el("span", "term-prompt", "$"), document.createTextNode(`cat ${slug(n.title)}.txt`));
        head.appendChild(cmd);

        const copy = el("button", "term-btn", "copy");
        copy.type = "button";
        copy.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(n.content); copy.textContent = "copied"; }
          catch (e) { copy.textContent = "failed"; }
          setTimeout(() => (copy.textContent = "copy"), 1200);
        });
        head.appendChild(copy);

        if (isAdmin) {
          const edit = el("button", "term-btn", "edit");
          edit.type = "button";
          edit.addEventListener("click", () => { editingId = n._id; render(); });
          const del = el("button", "term-btn danger", "delete");
          del.type = "button";
          del.addEventListener("click", async () => {
            if (!confirm(`Delete "${n.title}"?`)) return;
            try { await api(`/${n._id}`, { method: "DELETE" }); await load(); }
            catch (e) { alert(e.message); }
          });
          head.append(edit, del);
        }
        item.appendChild(head);
        item.appendChild(el("pre", "term-note-body", n.content));
        item.appendChild(el("div", "term-note-meta", `# ${n.title} · updated ${fmtDate(n.updatedAt || n.createdAt)}`));
        listEl.appendChild(item);
      });
    }

    async function load() {
      try {
        const res = await fetch(`${API}/cheatnotes`);
        const data = await res.json();
        if (!data.success) throw new Error();
        notes = data.notes;
        render();
      } catch (e) {
        listEl.textContent = "";
        listEl.appendChild(el("div", "term-dim", "error: can't reach the server. It may be waking up — try again in a moment."));
      }
    }

    searchEl.addEventListener("input", render);
    newBtn.addEventListener("click", () => { editingId = "new"; searchEl.value = ""; render(); });

    load();
  });
})();
