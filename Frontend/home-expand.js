/* Expandable cards: Departments, Programs, Outcomes.
   Desktop: hover to preview, click to pin open. Touch/keyboard: tap or Enter/Space to toggle. */
(function () {
  "use strict";
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var li = function (a) { return "<ul>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };

  /* EDIT THESE to match your real syllabus, careers and courses */
  var DEPT = {
    "Computer Science": { c: "B.Tech", a: ["AI and machine learning", "Data structures and algorithms", "Software engineering", "Operating systems and networks"], b: ["Software developer", "Data / ML engineer", "Cloud and DevOps", "Cybersecurity analyst"] },
    "Business Administration": { c: "BBA", a: ["Management principles", "Finance and accounting", "Marketing and HR", "Entrepreneurship"], b: ["Business analyst", "Finance executive", "HR manager", "Startup founder"] },
    "Mechanical Engineering": { c: "B.Tech", a: ["Machine design", "Thermal systems", "Robotics and automation", "Manufacturing processes"], b: ["Design engineer", "Robotics engineer", "Manufacturing / production", "R&D engineer"] },
    "Biotechnology": { a: ["Genomics", "Bioprocess engineering", "Molecular biology", "Lab and research methods"], b: ["Research scientist", "Bioprocess engineer", "Quality / regulatory roles", "Higher studies"] },
    "Architecture": { a: ["Design studio", "Building structures", "Sustainable design", "Drawing and modelling"], b: ["Architect", "Interior / urban designer", "Sustainability consultant", "Higher studies"] },
    "Pharmacy": { a: ["Pharmaceutics", "Clinical practice", "Drug discovery", "Pharmacology"], b: ["Pharmacist", "Clinical research", "Drug development", "Regulatory affairs"] }
  };
  var PROG = {
    "B.Tech": { t: "Engineering depth with AI, ML and Data Science specialisations.", w: "Students finishing 12th who like maths, physics and building things." },
    "MBA": { t: "Postgraduate management with Finance and HR specialisations.", w: "Graduates aiming for leadership and management roles." },
    "BCA": { t: "A software-first degree with AI and Software Development.", w: "Students finishing 12th who want to build apps and products early." },
    "BBA": { t: "Business Management foundations for a career in the corporate world.", w: "Students finishing 12th interested in planning, people and leadership." }
  };
  var OUT = {
    "₹25 LPA": "The highest package quoted by the university. Offers vary by role and year, so ask the placement cell for the year-wise report.",
    "Top Companies": "Recruiters include Amazon, Google and Infosys, with 200+ recruiters visiting campus.",
    "Internships": "Students can start internships from the 2nd year, building real experience before final placements."
  };

  /* EDIT: bios and social links. Leave a link as "" and its icon is hidden. */
   var TEAM = {
    "Hiicrow": {
      bio: "Full-stack developer behind the GEHU Portal. Built the 3D homepage, the dashboards and the backend, then shipped it all live.",
      instagram: "",          // e.g. "hiicrow"
      github: "hiicrow16",
      linkedin: "",           // e.g. "your-linkedin-name"
      email: ""               // e.g. "you@gmail.com"
    },
    "Garry": {
      bio: "Frontend developer who makes the portal look good and feel smooth, from layouts to every little animation.",
      instagram: "",
      github: "",
      linkedin: "",
      email: ""
    },
    "Rakshit": {
      bio: "Backend developer who builds the APIs and database that keep student data and logins running safely.",
      instagram: "",
      github: "",
      linkedin: "",
      email: ""
    },
    "Deepak": {
      bio: "Backend developer who handles the server logic behind attendance, the store and notices, so everything works when you tap it.",
      instagram: "",
      github: "",
      linkedin: "",
      email: ""
    }
  };
  var ICON = {
    github: ["GitHub", "M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z"],
    linkedin: ["LinkedIn", "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11.5H3zM9.5 9.75h3.83v1.57h.05c.53-1 1.84-2.07 3.78-2.07 4.04 0 4.79 2.66 4.79 6.12v5.88h-4v-5.2c0-1.24-.02-2.84-1.73-2.84-1.73 0-2 1.35-2 2.75v5.29h-4z"],
    instagram: ["Instagram", "M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.25-3.1a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3z"],
    email: ["Email", "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1.6 2L12 12.4 19.4 7zM4 8.6V17h16V8.6l-8 5.8z"]
  };
  function url(k, v) {
    if (/^https?:/i.test(v)) return v;
    v = v.replace(/^@/, "");
    return k === "instagram" ? "https://instagram.com/" + v : k === "github" ? "https://github.com/" + v : k === "linkedin" ? "https://linkedin.com/in/" + v : "mailto:" + v;
  }
  function label(k, v) {
    if (k === "email") return v;
    if (/^https?:/i.test(v)) { try { v = new URL(v).pathname.split("/").filter(Boolean).pop() || v; } catch (e) {} }
    return "@" + v.replace(/^@/, "");
  }
  /* Accepts a handle ("hiicrow16", "@hiicrow") or a full URL. Empty = hidden. */
  function social(d) {
    var out = ["instagram", "github", "linkedin", "email"].filter(function (k) { return d[k]; }).map(function (k) {
      return '<a class="soc" href="' + esc(url(k, d[k])) + '" target="_blank" rel="noopener" aria-label="' + ICON[k][0] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICON[k][1] + '"/></svg><span>' + esc(label(k, d[k])) + "</span></a>";
    }).join("");
    return out ? '<div class="more-social">' + out + "</div>" : "";
  }

  var timer;
  function refresh() { clearTimeout(timer); timer = setTimeout(function () { window.ScrollTrigger && ScrollTrigger.refresh(); }, 800); }
  function set(card, open) { card.classList.toggle("is-open", open); card.setAttribute("aria-expanded", String(open)); if (!card._flat) refresh(); }

  function attach(card, html, host) {
    var m = document.createElement("div");
    m.className = "more"; m.innerHTML = '<div class="more-in">' + html + "</div>";
    (host || card).appendChild(m);
    card.classList.add("expandable");
    card.setAttribute("aria-expanded", "false");
    if (!card.matches("a,button")) { card.tabIndex = 0; card.setAttribute("role", "button"); }
    var pinned = false;
    card.addEventListener("click", function (e) {
      if (e.target.closest(".more a")) return;
      e.preventDefault();
      pinned = !pinned;
      if (pinned) $$(".expandable.is-open").forEach(function (o) { if (o !== card && o._unpin) o._unpin(); });
      set(card, pinned);
    });
    card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); } });
    if (fine) {
      card.addEventListener("pointerenter", function () { set(card, true); });
      card.addEventListener("pointerleave", function () { if (!pinned) set(card, false); });
    }
    card._unpin = function () { pinned = false; set(card, false); };
  }
  function apply(course) { return '<a class="more-apply" href="apply.html' + (course ? "?course=" + encodeURIComponent(course) : "") + '">Apply now →</a>'; }

  function init() {
    $$(".dept-grid article").forEach(function (c) {
      var d = DEPT[(c.querySelector("h3") || {}).textContent]; if (!d) return;
      attach(c, '<div class="more-cols"><div><h4>What you\'ll explore</h4>' + li(d.a) + "</div><div><h4>Career paths</h4>" + li(d.b) + "</div></div>" + apply(d.c));
    });
    $$(".program").forEach(function (c) {
      var d = PROG[(c.querySelector("h3") || {}).textContent]; if (!d) return;
      var name = c.querySelector("h3").textContent;
      attach(c, '<div class="more-cols"><div><h4>About</h4><p>' + esc(d.t) + "</p></div><div><h4>Who it's for</h4><p>" + esc(d.w) + "</p></div></div>" + apply(name));
    });
    $$(".member").forEach(function (c) {
      var d = TEAM[(c.querySelector("h3") || {}).textContent]; if (!d) return;
      c._flat = true;
      attach(c, "<p>" + esc(d.bio) + "</p>" + social(d), c.querySelector("figcaption"));
    });
    $$(".outcome").forEach(function (c) {
      var d = OUT[(c.querySelector("b") || {}).textContent]; if (!d) return;
      attach(c, "<p>" + esc(d) + "</p>");
    });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
