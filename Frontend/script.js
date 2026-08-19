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

  // The navbar panel is a shortcut into the real login page rather than a
  // second login form, so credentials are only ever submitted from login.html.
  const homeLoginBtn = document.getElementById("homeLoginBtn");
  if (homeLoginBtn) {
    homeLoginBtn.addEventListener("click", () => {
      window.location.href = "login.html";
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
