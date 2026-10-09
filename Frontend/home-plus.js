/* ============================================================
   GEHU homepage upgrades (plain JS, no build step needed)
   1. Command palette  (Ctrl/Cmd+K  or  /)
   2. Campus Pulse     (wakes the backend + live public notices)
   3. Program Finder   (3-question recommender -> apply form)
   4. Chapter rail     (section dots)
   5. PWA install + service worker
   ============================================================ */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var API = String(window.API_BASE || "").replace(/\/$/, "");
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- navigation helper (reuses the page's own smooth-scroll) ---------- */
  function goSection(sel) {
    var link = $('#navLinks a[href="' + sel + '"]');
    if (link) return link.click();
    var el = sel === "#top" ? document.body : $(sel);
    if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }
  function goPage(url) { window.gehuGo ? window.gehuGo(url) : (location.href = url); }
  function openHelp(tab) {
    goSection("#help");
    setTimeout(function () { var t = $('.h-tab[data-tab="' + tab + '"]'); if (t) t.click(); }, 700);
  }

  /* ============================================================
     1. COMMAND PALETTE
     ============================================================ */
  var deferredInstall = null;
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredInstall = e; });

  function buildItems() {
    var S = function (label, sel, ico, kw) { return { g: "Jump to", ico: ico, label: label, kw: kw || "", run: function () { goSection(sel); } }; };
    var items = [
      S("Discover GEHU", "#about", "✦", "about university who we are stats"),
      S("Departments", "#departments", "▦", "schools computer science business mechanical biotech architecture pharmacy"),
      S("Campus life", "#campus", "◐", "photos hostel fest convocation sports"),
      S("Programs", "#programs", "☰", "courses btech mba bca bba"),
      S("Find my program", "#finder", "◎", "quiz recommend which course"),
      S("Student journey", "#journey", "→", "how it works steps"),
      S("Placements", "#outcomes", "★", "package recruiters internships jobs"),
      S("Team", "#team", "☺", "developers"),
      S("Help centre", "#help", "?", "support contact"),
      { g: "Go to", ico: "🎓", label: "Apply for admission", kw: "apply form 2026 enroll", run: function () { goPage("apply.html"); } },
      { g: "Go to", ico: "🔑", label: "Student / Faculty login", kw: "sign in dashboard portal", run: function () { goPage("login.html"); } },
      { g: "Go to", ico: "🛍", label: "College store", kw: "buy shop merchandise", run: function () { goPage("store.html"); } },
      { g: "Help", ico: "📦", label: "Track an order", kw: "order status delivery payment", run: function () { openHelp("track"); } },
      { g: "Help", ico: "🎫", label: "Raise a support ticket", kw: "issue problem complaint", run: function () { openHelp("ticket"); } },
      { g: "Help", ico: "▮", label: "Cheat notes terminal", kw: "notes study grep", run: function () { openHelp("notes"); } }
    ];
    var wa = $('[data-support="whatsapp"]');
    if (wa) items.push({ g: "Help", ico: "💬", label: "Chat on WhatsApp", kw: "whatsapp message contact", run: function () { window.open(wa.href, "_blank", "noopener"); } });
    $$("#panel-faq .faq-i").forEach(function (f) {
      var q = $(".faq-q span", f), a = $(".faq-a p", f);
      if (!q) return;
      items.push({ g: "FAQ", ico: "Q", label: q.textContent, sub: a ? a.textContent : "", kw: a ? a.textContent : "",
        run: function () { openHelp("faq"); setTimeout(function () { var b = $(".faq-q", f); if (b && !f.classList.contains("open") && !f.classList.contains("active")) b.click(); }, 900); } });
    });
    if (deferredInstall) items.push({ g: "App", ico: "⬇", label: "Install GEHU Portal as an app", kw: "install pwa home screen", run: function () { deferredInstall.prompt(); deferredInstall = null; } });
    return items;
  }

  function initPalette() {
    var root = document.createElement("div");
    root.className = "cmdk"; root.setAttribute("data-lenis-prevent", "");
    root.innerHTML = '<div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search the portal">' +
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
        for (var i = 0; i < words.length; i++) {
          if (hay.indexOf(words[i]) < 0) return { it: it, s: -1 };
          s += lab.indexOf(words[i]) === 0 ? 4 : lab.indexOf(words[i]) > 0 ? 3 : 1;
        }
        return { it: it, s: s };
      }).filter(function (x) { return x.s > 0; });
      if (words.length) shown.sort(function (a, b) { return b.s - a.s; });
      shown = shown.slice(0, 40).map(function (x) { return x.it; });
      sel = 0;
      if (!shown.length) { list.innerHTML = '<li class="cmdk-empty">No results for “' + esc(input.value) + '”. Try “apply”, “attendance” or “fees”.</li>'; return; }
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
      var cur = $("#cmdk-" + sel, list);
      if (cur) { input.setAttribute("aria-activedescendant", "cmdk-" + sel); cur.scrollIntoView({ block: "nearest" }); }
    }
    function open() {
      items = buildItems(); last = document.activeElement; input.value = ""; render();
      root.classList.add("open"); document.documentElement.style.overflow = "hidden"; setTimeout(function () { input.focus(); }, 30);
    }
    function close() {
      root.classList.remove("open"); document.documentElement.style.overflow = "";
      if (last && last.focus) last.focus();
    }
    function run(i) { var it = shown[i]; if (!it) return; close(); setTimeout(it.run, 120); }

    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); run(sel); }
      else if (e.key === "Tab") { e.preventDefault(); }
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

    // nav trigger
    var actions = $(".nav-actions");
    if (actions) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "cmdk-btn"; b.setAttribute("aria-label", "Search the portal");
      var mac = /Mac|iPhone|iPad/.test(navigator.platform || "");
      b.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span class="cmdk-txt">Search</span><kbd>' + (mac ? "⌘K" : "Ctrl K") + "</kbd>";
      b.addEventListener("click", open);
      actions.insertBefore(b, actions.firstChild);
    }
  }

  /* ============================================================
     2. CAMPUS PULSE  (warms the Render backend + shows live notices)
     ============================================================ */
  function fetchJSON(url, ms) {
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    return fetch(url, { signal: c.signal, headers: { Accept: "application/json" } })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function (e) { clearTimeout(t); throw e; });
  }
  function ago(d) {
    var s = (Date.now() - new Date(d)) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 14) return Math.round(s / 86400) + " d ago";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }
  function initPulse() {
    var box = $("#pulse"); if (!box || !API) { if (box) box.hidden = true; return; }
    var label = $("#pulseState"), feed = $("#pulseFeed"), t0 = performance.now();
    label.textContent = "Waking portal…";
    fetchJSON(API + "/health", 60000).then(function () {
      box.dataset.state = "online";
      label.textContent = "Portal online · " + Math.round(performance.now() - t0) + " ms";
    }).catch(function () { box.dataset.state = "offline"; label.textContent = "Portal unreachable"; });

    fetchJSON(API + "/notices/public", 60000).then(function (d) {
      var n = (d && d.notices) || [];
      if (!n.length) { feed.innerHTML = '<div class="pulse-item on"><b>Campus announcements will appear here.</b></div>'; return; }
      feed.innerHTML = n.map(function (x, i) {
        return '<div class="pulse-item' + (i ? "" : " on") + '"><span class="pulse-tag">Notice</span><b>' + esc(x.title) + "</b><span>" + esc(ago(x.createdAt)) + "</span></div>";
      }).join("");
      if (n.length < 2 || reduce) return;
      var els = $$(".pulse-item", feed), k = 0, hold = false;
      feed.addEventListener("pointerenter", function () { hold = true; });
      feed.addEventListener("pointerleave", function () { hold = false; });
      setInterval(function () {
        if (hold || document.hidden) return;
        var cur = els[k]; k = (k + 1) % els.length; var nx = els[k];
        cur.classList.remove("on"); cur.classList.add("out");
        nx.classList.remove("out"); nx.style.transition = "none"; nx.style.transform = "translateY(100%)"; nx.offsetHeight;
        nx.style.transition = ""; nx.style.transform = ""; nx.classList.add("on");
        setTimeout(function () { cur.classList.remove("out"); }, 800);
      }, 4800);
    }).catch(function () { feed.innerHTML = '<div class="pulse-item on"><b>Live announcements are offline right now.</b></div>'; });
  }

  /* ============================================================
     3. PROGRAM FINDER
     ============================================================ */
  var PROG = {
    "B.Tech": { sub: "AI, ML, Data Science", why: "Deep engineering foundations with room to specialise." },
    "BCA":    { sub: "AI, Software Development", why: "A software-first path — build apps and products early." },
    "BBA":    { sub: "Business Management", why: "A people-and-planning path into management." },
    "MBA":    { sub: "Finance, HR", why: "The postgraduate route for leadership roles." }
  };
  var DEPT = { code: "Computer Science", biz: "Business Administration", make: "Mechanical Engineering or Architecture", sci: "Biotechnology or Pharmacy" };
  function initFinder() {
    var box = $("#finder"); if (!box) return;
    var qs = $$(".fq[data-q]", box), res = $(".fres", box), dots = $$(".finder-dots i", box);
    var ans = [], step = 0;
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
      if (a[0] === "make" || a[0] === "sci") { s["B.Tech"] += 3; }
      if (a[1] === "school") { s.MBA -= 9; } else { s["B.Tech"] -= 9; s.BCA -= 9; s.BBA -= 9; s.MBA += 4; }
      if (a[2] === "depth") s["B.Tech"] += 2; if (a[2] === "apply") s.BCA += 2; if (a[2] === "people") { s.BBA += 2; s.MBA += 2; }
      var r = Object.keys(s).sort(function (x, y) { return s[y] - s[x]; });
      return { top: r[0], alt: r[1], altOK: s[r[1]] > 0 };
    }
    function finish() {
      var r = score(), p = PROG[r.top], note = "";
      if (ans[1] === "grad" && ans[0] !== "biz") note = " It's the closest postgraduate option listed here — ask admissions about other PG programs too.";
      if ((ans[0] === "make" || ans[0] === "sci") && ans[1] === "school") note = " Matching school: " + DEPT[ans[0]] + " — confirm available branches with admissions.";
      if (ans[0] === "code" || ans[0] === "biz") note = note || " Matching school: " + DEPT[ans[0]] + ".";
      $(".fres h3", box).textContent = r.top;
      $(".fres .why", box).textContent = p.why + " Specialisations: " + p.sub + "." + note;
      $(".fres .alt", box).textContent = r.altOK ? "Also worth a look: " + r.alt : "";
      var a = $(".fres .apply", box); a.href = "apply.html?course=" + encodeURIComponent(r.top);
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

  /* ============================================================
     4. CHAPTER RAIL
     ============================================================ */
  function initRail() {
    var map = [["#top", "Home"], ["#about", "Discover"], ["#departments", "Departments"], ["#campus", "Campus"], ["#programs", "Programs"], ["#finder", "Finder"], ["#journey", "Journey"], ["#outcomes", "Outcomes"], ["#team", "Team"], ["#help", "Help"], ["#admissions", "Apply"]]
      .filter(function (m) { return m[0] === "#top" || $(m[0]); });
    var rail = document.createElement("nav"); rail.className = "rail"; rail.setAttribute("aria-label", "Page sections");
    rail.innerHTML = map.map(function (m) { return '<a href="' + m[0] + '" aria-label="' + m[1] + '"><span>' + m[1] + "</span></a>"; }).join("");
    document.body.appendChild(rail);
    var links = $$("a", rail);
    rail.addEventListener("click", function (e) { var a = e.target.closest("a"); if (!a) return; e.preventDefault(); goSection(a.getAttribute("href")); });
    var tick = false;
    function update() {
      tick = false;
      var y = scrollY, probe = innerHeight * 0.4, idx = 0;
      map.forEach(function (m, i) {
        var el = m[0] === "#top" ? null : $(m[0]); if (!el) return;
        if (el.getBoundingClientRect().top <= probe) idx = i;
      });
      links.forEach(function (a, i) { a.classList.toggle("on", i === idx); });
      rail.classList.toggle("show", y > innerHeight * 0.6);
    }
    addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ============================================================
     5. small polish: skip link, reveal, PWA
     ============================================================ */
  function initPolish() {
    var s = document.createElement("a"); s.className = "skip"; s.href = "#help"; s.textContent = "Skip to help & support";
    s.addEventListener("click", function (e) { e.preventDefault(); goSection("#help"); });
    document.body.insertBefore(s, document.body.firstChild);
    var fx = $$(".fx");
    if ("IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { threshold: 0.12 });
      fx.forEach(function (el) { io.observe(el); });
    } else fx.forEach(function (el) { el.classList.add("in"); });
    if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  function boot() { initPolish(); initPalette(); initPulse(); initFinder(); initRail(); if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 2600); }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
})();
