/* GEHU homepage behaviour. Plain JS, no dependencies.
   - header state, mobile menu, active-section highlight
   - scroll reveals, gentle parallax, small pointer tilt (all off under prefers-reduced-motion)
   - live public notices (strip + news list), program finder, admission tracking
   - command palette (Ctrl/Cmd+K or "/"), PWA service worker
   The help centre (tabs, FAQ, order tracking, tickets, cheat notes) lives in help.min.js. */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = matchMedia("(hover:hover) and (pointer:fine)").matches;
  var API = String(window.API_BASE || "").replace(/\/$/, "");
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  function goPage(url) { window.gehuGo ? window.gehuGo(url) : (location.href = url); }
  function goSection(sel) {
    var el = sel === "#top" ? document.body : $(sel);
    if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  function openHelp(tab) {
    goSection("#help");
    setTimeout(function () { var t = $('.h-tab[data-tab="' + tab + '"]'); if (t) t.click(); }, reduce ? 50 : 650);
  }

  /* ---------- header ---------- */
  var header = $("#siteHeader"), burger = $("#burger"), nav = $("#primaryNav");
  function headerState() { header.classList.toggle("solid", scrollY > 40); }
  addEventListener("scroll", headerState, { passive: true }); headerState();
  function menu(open) {
    burger.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
    header.classList.toggle("menu-open", open);
  }
  burger.addEventListener("click", function () { menu(burger.getAttribute("aria-expanded") !== "true"); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a")) menu(false); });
  addEventListener("keydown", function (e) { if (e.key === "Escape") menu(false); });
  matchMedia("(min-width:921px)").addEventListener("change", function () { menu(false); });

  // highlight the nav link of the section in view
  var secMap = {};
  $$("#primaryNav a[href^='#']").forEach(function (a) { secMap[a.getAttribute("href")] = a; });
  var secs = Object.keys(secMap).map(function (h) { return $(h); }).filter(Boolean);
  // "Campus Life" is the student-life section; research/placements etc. map one-to-one
  if ("IntersectionObserver" in window) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var a = secMap["#" + en.target.id]; if (!a) return;
        if (en.isIntersecting) { $$("#primaryNav a.on").forEach(function (x) { x.classList.remove("on"); }); a.classList.add("on"); }
        else a.classList.remove("on");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secs.forEach(function (s) { so.observe(s); });
  }

  /* ---------- reveals ---------- */
  function reveals() {
    var els = $$(".reveal, .reveal-img");
    if (!("IntersectionObserver" in window) || reduce) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    // stagger siblings that enter together
    els.forEach(function (el) {
      var sibs = $$(".reveal", el.parentNode); var i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty("--d", Math.min(i, 4) * 0.08 + "s");
    });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- parallax (transform-only, rAF-throttled) ---------- */
  function parallax() {
    if (reduce) return;
    var hero = $(".hero-media img"), items = $$("[data-parallax]").filter(function (i) { return i !== hero; }), ticking = false;
    function update() {
      ticking = false;
      var vh = innerHeight;
      if (hero && scrollY < vh * 1.2) hero.style.setProperty("--py", Math.min(scrollY, vh) * 0.05 + "px");
      items.forEach(function (img) {
        var f = img.parentNode.getBoundingClientRect();
        if (f.bottom < -50 || f.top > vh + 50) return;
        var delta = (f.top + f.height / 2) - vh / 2, max = f.height * 0.035;
        var y = Math.max(-max, Math.min(max, -delta * parseFloat(img.dataset.parallax)));
        img.style.setProperty("--ty", y.toFixed(1) + "px");
      });
    }
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update); update();
  }


  /* ---------- hero depth: the photograph turns a degree or so toward the pointer while the
     text moves a few pixels the other way. One effect, mouse only, off for reduced motion. ---------- */
  function heroDepth() {
    var hero = $(".hero"), media = $(".hero-media"), copy = $(".hero-copy");
    if (reduce || !finePointer || !hero || !media) return;
    var tx = 0, ty = 0, raf = 0;
    function apply() {
      raf = 0;
      media.style.setProperty("--hy", (tx * 1.1).toFixed(2) + "deg");
      media.style.setProperty("--hx", (-ty * 0.8).toFixed(2) + "deg");
      if (copy) { copy.style.setProperty("--cx", (tx * -6).toFixed(1) + "px"); copy.style.setProperty("--cy", (ty * -4).toFixed(1) + "px"); }
    }
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener("pointerleave", function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }


  /* ---------- phone menu: a signed-in person goes straight to their dashboard ---------- */
  function mobilePortal() {
    var a = $(".portal-m"); if (!a) return;
    var DASH = { student: "student-dashboard.html", faculty: "faculty-dashboard.html", admin: "admin-dashboard.html" };
    try {
      var t = localStorage.getItem("token"), r = localStorage.getItem("role");
      if (t && DASH[r]) { a.href = DASH[r]; a.textContent = r === "student" ? "My dashboard" : r === "faculty" ? "Faculty portal" : "Admin dashboard"; }
    } catch (e) {}
  }

  /* ---------- tilt: a few photographs only, max 3 degrees ---------- */
  function tilt() {
    if (reduce || !finePointer) return;
    $$("[data-tilt]").forEach(function (el) {
      el.addEventListener("pointerenter", function () { el.classList.add("is-hover", "tilting"); });
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty("--ry", (x * 5).toFixed(2) + "deg"); el.style.setProperty("--rx", (-y * 5).toFixed(2) + "deg");
      });
      el.addEventListener("pointerleave", function () {
        el.classList.remove("is-hover", "tilting"); el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg");
      });
    });
  }

  /* ---------- extra campus photographs ----------
     Add real photographs in config.js and they join the grid, e.g.
     window.GEHU_GALLERY = [{ src: "img/library.webp", alt: "Reading hall of the central library", caption: "Library" }];  */
  function gallery() {
    var list = window.GEHU_GALLERY, grid = $(".mosaic");
    if (!grid || !Array.isArray(list)) return;
    list.slice(0, 6).forEach(function (g) {
      if (!g || !g.src) return;
      var fig = document.createElement("figure");
      fig.className = "photo reveal-img m-x";
      fig.innerHTML = '<div class="frame"><img loading="lazy" decoding="async"></div>' + (g.caption ? "<figcaption></figcaption>" : "");
      var img = $("img", fig); img.src = g.src; img.alt = g.alt || g.caption || "";
      if (g.caption) $("figcaption", fig).textContent = g.caption;
      grid.appendChild(fig);
    });
    reveals();
  }

  /* ---------- optional verified figures: set window.GEHU_FIGURES in config.js ----------
     window.GEHU_FIGURES = [{ value: "2,270+", label: "Offers made", source: "Placement report 2025" }];  */
  function figures() {
    var list = window.GEHU_FIGURES, box = $("#figures");
    if (!box || !Array.isArray(list) || !list.length) return;
    box.innerHTML = list.filter(function (f) { return f && f.value && f.label && f.source; }).map(function (f) {
      return "<div><b>" + esc(f.value) + "</b><span>" + esc(f.label) + " · " + esc(f.source) + "</span></div>";
    }).join("");
    box.hidden = !box.innerHTML;
  }

  /* ---------- live public notices ---------- */
  function fetchJSON(url, ms) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    return fetch(url, { signal: c.signal, headers: { Accept: "application/json" } })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { clearTimeout(t); throw e; });
  }
  function dateText(d) { try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } }
  function notices() {
    if (!API) return;
    var strip = $("#pulse"), feed = $("#pulseFeed"), list = $("#newsList"), status = $("#newsStatus");
    fetchJSON(API + "/notices/public", 60000).then(function (d) {
      var n = (d && d.notices) || [];
      if (!n.length) return;
      // news list (newest first, above the static event)
      var html = n.map(function (x) {
        var body = x.content ? "<p>" + esc(x.content) + "</p>" : "";
        return '<li class="news-item"><time datetime="' + esc(x.createdAt) + '">' + esc(dateText(x.createdAt)) + '</time><div><span class="tag">Notice</span>' +
          (body ? "<details><summary><h3>" + esc(x.title) + "</h3></summary>" + body + "</details>" : "<h3>" + esc(x.title) + "</h3>") + "</div></li>";
      }).join("");
      list.insertAdjacentHTML("afterbegin", html);
      if (status) status.textContent = "Notices posted by the university for the public appear here automatically.";
      // strip
      feed.innerHTML = n.map(function (x, i) { return '<div class="strip-item' + (i ? "" : " on") + '"><b>' + esc(x.title) + "</b><span>" + esc(dateText(x.createdAt)) + "</span></div>"; }).join("");
      strip.hidden = false;
      var els = $$(".strip-item", feed), k = 0;
      if (els.length > 1 && !reduce) {
        var hold = false;
        feed.addEventListener("pointerenter", function () { hold = true; }); feed.addEventListener("pointerleave", function () { hold = false; });
        setInterval(function () { if (hold || document.hidden) return; els[k].classList.remove("on"); k = (k + 1) % els.length; els[k].classList.add("on"); }, 5000);
      }
    }).catch(function () { if (status) status.textContent = "Live notices could not be loaded right now."; });
  }

  /* ---------- program finder ---------- */
  var PROG = {
    "B.Tech": { sub: "AI & Machine Learning, Cyber Security, AI & Data Science (Computer Science)", why: "Engineering foundations with room to specialise." },
    "BCA": { sub: "AI and software development", why: "A software-first path — build apps and products early." },
    "BBA": { sub: "business management", why: "A people-and-planning path into management." },
    "MBA": { sub: "Finance, HR and other specialisations", why: "The postgraduate route into management roles." }
  };
  var DEPT = { code: "Computer Science or Computer Applications", biz: "Management", make: "Mechanical or Civil Engineering", sci: "Science or Pharmacy" };
  function finder() {
    var box = $("#finder"); if (!box) return;
    var qs = $$(".fq[data-q]", box), res = $(".fres", box), dots = $$(".finder-dots i", box), ans = [], step = 0;
    function show(n) {
      step = n;
      qs.forEach(function (q, i) { q.classList.toggle("on", i === n); });
      res.hidden = n < qs.length; if (n >= qs.length) qs.forEach(function (q) { q.classList.remove("on"); });
      dots.forEach(function (d, i) { d.classList.toggle("done", i < n || n >= qs.length); });
    }
    function score() {
      var s = { "B.Tech": 0, BCA: 0, BBA: 0, MBA: 0 }, a = ans;
      if (a[0] === "code") { s["B.Tech"] += 2; s.BCA += 2; }
      if (a[0] === "biz") { s.BBA += 2; s.MBA += 2; }
      if (a[0] === "make" || a[0] === "sci") s["B.Tech"] += 3;
      if (a[1] === "school") s.MBA -= 9; else { s["B.Tech"] -= 9; s.BCA -= 9; s.BBA -= 9; s.MBA += 4; }
      if (a[2] === "depth") s["B.Tech"] += 2; if (a[2] === "apply") s.BCA += 2; if (a[2] === "people") { s.BBA += 2; s.MBA += 2; }
      var r = Object.keys(s).sort(function (x, y) { return s[y] - s[x]; });
      return { top: r[0], alt: r[1], altOK: s[r[1]] > 0 };
    }
    function finish() {
      var r = score(), p = PROG[r.top], note = "";
      if (ans[1] === "grad" && ans[0] !== "biz") note = " It is the closest postgraduate option listed here — ask the Admissions Office about other postgraduate programs.";
      if ((ans[0] === "make" || ans[0] === "sci") && ans[1] === "school") note = " Related area: " + DEPT[ans[0]] + " — confirm available programs with the Admissions Office.";
      if (ans[0] === "code" || ans[0] === "biz") note = note || " Related area: " + DEPT[ans[0]] + ".";
      $(".fres h4", box).textContent = r.top;
      $(".fres .why", box).textContent = p.why + " Specialisations: " + p.sub + "." + note;
      $(".fres .alt", box).textContent = r.altOK ? "Also worth a look: " + r.alt : "";
      $(".fres .apply", box).href = "apply.html?course=" + encodeURIComponent(r.top);
      $(".fres .apply span", box).textContent = "Apply for " + r.top;
      show(qs.length);
    }
    box.addEventListener("click", function (e) {
      var o = e.target.closest(".fq-opt"); if (o) { ans[step] = o.dataset.v; step + 1 < qs.length ? show(step + 1) : finish(); return; }
      if (e.target.closest(".fq-back")) { show(Math.max(0, step - 1)); return; }
      if (e.target.closest(".fres-redo")) { ans = []; show(0); }
    });
    show(0);
  }

  /* ---------- track an admission application ---------- */
  function admissionTrack() {
    var form = $("#trackAdmissionForm"); if (!form) return;
    var box = $("#trackAdmResult"), slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-"); };
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = $("#trackAdmTrackingId").value.trim(), email = $("#trackAdmEmail").value.trim(), btn = $("button[type=submit]", form);
      btn.disabled = true; btn.textContent = "Checking…"; box.className = "track-result"; box.innerHTML = "";
      fetch(API + "/admissions/track?trackingId=" + encodeURIComponent(id) + "&email=" + encodeURIComponent(email), { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.success) { box.className = "track-result show error"; box.textContent = d.message || "No matching application found."; return; }
          var a = d.application; box.className = "track-result show";
          box.innerHTML =
            '<div class="track-row"><span>Applicant</span><span>' + esc(a.name) + "</span></div>" +
            '<div class="track-row"><span>Course</span><span>' + esc(a.course) + "</span></div>" +
            '<div class="track-row"><span>Submitted</span><span>' + new Date(a.submittedAt).toLocaleDateString() + "</span></div>" +
            '<div class="track-row"><span>Documents received</span><span>' + a.documentsReceived + "</span></div>" +
            '<div class="track-row"><span>Status</span><span class="track-badge ' + slug(a.status) + '">' + esc(a.status) + "</span></div>" +
            (a.status === "Documents Required" && a.reviewNotes ? '<div class="track-row"><span>Note from admissions</span><span>' + esc(a.reviewNotes) + "</span></div>" : "");
        })
        .catch(function () { box.className = "track-result show error"; box.textContent = "Couldn't reach the server. Try again in a moment."; })
        .then(function () { btn.disabled = false; btn.textContent = "Track application"; });
    });
    // "Track an application" link in the admissions section
    $$("[data-help-tab]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); openHelp(a.dataset.helpTab); }); });
  }

  /* ---------- command palette ---------- */
  var deferredInstall = null;
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredInstall = e; });
  function paletteItems() {
    var S = function (label, sel, ico, kw) { return { g: "Jump to", ico: ico, label: label, kw: kw || "", run: function () { goSection(sel); } }; };
    var items = [
      S("About the university", "#about", "—", "who we are founded campuses"),
      S("Academics and programs", "#academics", "—", "courses btech bca bba mba degrees"),
      S("Find my program", "#finder", "—", "quiz recommend which course"),
      S("Campus and facilities", "#campus", "—", "classrooms library hostel labs addresses"),
      S("Research and specialisations", "#research", "—", "ai machine learning cyber security robotics"),
      S("Campus life", "#student-life", "—", "sports grafest culture clubs"),
      S("Placements", "#placements", "—", "jobs recruiters report"),
      S("Admissions", "#admissions", "—", "apply eligibility process dates"),
      S("News and events", "#news", "—", "notices announcements"),
      S("Help and support", "#help", "—", "support contact faq"),
      { g: "Go to", ico: "→", label: "Apply for admission", kw: "apply form 2026 enroll", run: function () { goPage("apply.html"); } },
      { g: "Go to", ico: "→", label: "Student / faculty login", kw: "sign in dashboard portal", run: function () { goPage("login.html"); } },
      { g: "Go to", ico: "→", label: "College store", kw: "buy shop merchandise", run: function () { goPage("store.html"); } },
      { g: "Help", ico: "?", label: "Track an order", kw: "order status delivery payment", run: function () { openHelp("track"); } },
      { g: "Help", ico: "?", label: "Track an admission application", kw: "application tracking id", run: function () { openHelp("admission"); } },
      { g: "Help", ico: "?", label: "Raise a support ticket", kw: "issue problem complaint", run: function () { openHelp("ticket"); } },
      { g: "Help", ico: "?", label: "Cheat notes", kw: "notes study grep terminal", run: function () { openHelp("notes"); } }
    ];
    var wa = $('[data-support="whatsapp"]');
    if (wa) items.push({ g: "Help", ico: "?", label: "Chat on WhatsApp", kw: "whatsapp message contact", run: function () { window.open(wa.href, "_blank", "noopener"); } });
    $$("#panel-faq .faq-i").forEach(function (f) {
      var q = $(".faq-q span", f), a = $(".faq-a p", f); if (!q) return;
      items.push({ g: "FAQ", ico: "Q", label: q.textContent, sub: a ? a.textContent : "", kw: a ? a.textContent : "",
        run: function () { openHelp("faq"); setTimeout(function () { var b = $(".faq-q", f); if (b && !f.classList.contains("open")) b.click(); }, 900); } });
    });
    if (deferredInstall) items.push({ g: "App", ico: "↓", label: "Install GEHU Portal as an app", kw: "install pwa home screen", run: function () { deferredInstall.prompt(); deferredInstall = null; } });
    return items;
  }
  function palette() {
    var root = document.createElement("div");
    root.className = "cmdk";
    root.innerHTML = '<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search the site">' +
      '<div class="cmdk-in"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>' +
      '<input type="text" placeholder="Search sections, pages, FAQs…" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="cmdkList"><span class="cmdk-esc">ESC</span></div>' +
      '<ul class="cmdk-list" id="cmdkList" role="listbox"></ul>' +
      '<div class="cmdk-foot"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div></div>';
    document.body.appendChild(root);
    var input = $("input", root), list = $(".cmdk-list", root), items = [], shown = [], sel = 0, last = null;
    function render() {
      var q = input.value.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean);
      shown = items.map(function (it) {
        var hay = (it.label + " " + it.kw + " " + it.g).toLowerCase(), lab = it.label.toLowerCase(), s = 0;
        if (!words.length) return { it: it, s: 1 };
        for (var i = 0; i < words.length; i++) { if (hay.indexOf(words[i]) < 0) return { it: it, s: -1 }; s += lab.indexOf(words[i]) === 0 ? 4 : lab.indexOf(words[i]) > 0 ? 3 : 1; }
        return { it: it, s: s };
      }).filter(function (x) { return x.s > 0; });
      if (words.length) shown.sort(function (a, b) { return b.s - a.s; });
      shown = shown.slice(0, 40).map(function (x) { return x.it; }); sel = 0;
      if (!shown.length) { list.innerHTML = '<li class="cmdk-empty">No results for “' + esc(input.value) + '”. Try “apply”, “fees” or “login”.</li>'; return; }
      var html = "", g = "";
      shown.forEach(function (it, n) {
        if (!words.length && it.g !== g) { g = it.g; html += '<li class="cmdk-grp" role="presentation">' + esc(g) + "</li>"; }
        var sub = it.sub ? "<small>" + esc(it.sub) + "</small>" : (words.length ? "<small>" + esc(it.g) + "</small>" : "");
        html += '<li class="cmdk-item" role="option" id="cmdk-' + n + '" data-i="' + n + '"><i>' + esc(it.ico) + "</i><div><b>" + esc(it.label) + "</b>" + sub + "</div></li>";
      });
      list.innerHTML = html; mark();
    }
    function mark() {
      $$(".cmdk-item", list).forEach(function (el) { el.setAttribute("aria-selected", String(+el.dataset.i === sel)); });
      var cur = $("#cmdk-" + sel, list); if (cur) { input.setAttribute("aria-activedescendant", "cmdk-" + sel); cur.scrollIntoView({ block: "nearest" }); }
    }
    function open() { items = paletteItems(); last = document.activeElement; input.value = ""; render(); root.classList.add("open"); document.documentElement.style.overflow = "hidden"; setTimeout(function () { input.focus(); }, 30); }
    function close() { root.classList.remove("open"); document.documentElement.style.overflow = ""; if (last && last.focus) last.focus(); }
    function run(i) { var it = shown[i]; if (!it) return; close(); setTimeout(it.run, 120); }
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); run(sel); } else if (e.key === "Tab") e.preventDefault();
    });
    list.addEventListener("click", function (e) { var li = e.target.closest(".cmdk-item"); if (li) run(+li.dataset.i); });
    list.addEventListener("pointermove", function (e) { var li = e.target.closest(".cmdk-item"); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; mark(); } });
    root.addEventListener("pointerdown", function (e) { if (e.target === root) close(); });
    addEventListener("keydown", function (e) {
      var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || "");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); root.classList.contains("open") ? close() : open(); }
      else if (e.key === "/" && !typing && !root.classList.contains("open")) { e.preventDefault(); open(); }
      else if (e.key === "Escape" && root.classList.contains("open")) close();
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    reveals(); gallery(); mobilePortal(); parallax(); heroDepth(); tilt(); figures(); notices(); finder(); admissionTrack(); palette();
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
