/* Shared shell: page-transition curtain (every page) + matching nav and ember
   background (pages with <body class="shell">). No dependencies. */
(function () {
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FLAG = "gehu-nav";

  /* ---------- curtain ---------- */
  var curtain = doc.createElement("div");
  curtain.className = "sh-curtain";
  curtain.setAttribute("aria-hidden", "true");
  curtain.innerHTML = '<img src="img/logo-96.png" alt="">';
  doc.body.appendChild(curtain);

  function setT(y, animate) {
    curtain.style.transition = animate ? "transform .6s cubic-bezier(.76,0,.24,1)" : "none";
    curtain.style.transform = "translateY(" + y + ")";
  }
  var entering = root.classList.contains("entering");
  if (entering && !reduce) {
    setT("0%", false);                       // match the html::before cover exactly
    root.classList.remove("entering");
    try { sessionStorage.removeItem(FLAG); } catch (e) {}
    curtain.getBoundingClientRect();         // reflow
    setTimeout(function () { setT("-100%", true); setTimeout(function () { setT("100%", false); }, 700); }, 80);
  } else {
    root.classList.remove("entering");
    try { sessionStorage.removeItem(FLAG); } catch (e) {}
    setT("100%", false);
  }

  function go(url) {
    if (reduce) { location.href = url; return; }
    try { sessionStorage.setItem(FLAG, "1"); } catch (e) {}
    curtain.style.pointerEvents = "auto";
    setT("0%", true);
    setTimeout(function () { location.href = url; }, 560);
  }
  window.gehuGo = go;

  function norm(p) { return p.replace(/index\.html$/, "").replace(/\/+$/, ""); }
  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin !== location.origin) return;
    if (norm(u.pathname) === norm(location.pathname)) return;   // same page / in-page anchor
    e.preventDefault();
    go(u.href);
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) { curtain.style.pointerEvents = "none"; setT("100%", false); }
  });

  /* ---------- shell pages: nav + embers ---------- */
  if (!doc.body.classList.contains("shell")) return;

  var nav = doc.createElement("header");
  nav.className = "sh-nav";
  nav.innerHTML =
    '<a href="index.html" class="sh-brand"><img src="img/logo-96.png" alt="GEHU logo"><span>GEHU<small>Graphic Era Hill University</small></span></a>' +
    '<nav class="sh-links" id="shLinks">' +
      '<a href="index.html">Home</a><a href="index.html#departments">Departments</a>' +
      '<a href="store.html">Store</a><a href="index.html#help">Help</a><a href="apply.html">Apply</a>' +
    '</nav>' +
    '<div class="nav-actions sh-actions"><button id="studentBtn" type="button">Student / Faculty Login</button></div>' +
    '<button class="sh-burger" id="shBurger" aria-label="Menu" aria-expanded="false"><i></i><i></i></button>';
  doc.body.insertBefore(nav, doc.body.firstChild);

  var here = norm(location.pathname).split("/").pop();
  [].forEach.call(nav.querySelectorAll(".sh-links a"), function (a) {
    var p = norm(new URL(a.href).pathname).split("/").pop();
    if (p && p === here && !a.hash) a.classList.add("active");
  });
  var burger = doc.getElementById("shBurger"), links = doc.getElementById("shLinks");
  burger.addEventListener("click", function () {
    var open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", String(open));
    links.classList.toggle("open", open);
  });
  window.addEventListener("scroll", function () { nav.classList.toggle("scrolled", window.scrollY > 20); }, { passive: true });

  // login button (nav-auth.js swaps it for a user menu when signed in)
  setTimeout(function () {
    var b = doc.getElementById("studentBtn");
    if (b && !doc.getElementById("navUserDrop")) b.addEventListener("click", function () { go("login.html"); });
  }, 0);

  /* embers */
  if (reduce) return;
  var cv = doc.createElement("canvas");
  cv.className = "sh-embers"; cv.setAttribute("aria-hidden", "true");
  doc.body.insertBefore(cv, doc.body.firstChild);
  var ctx = cv.getContext("2d"), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5), P = [];
  function size() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function mk(init) {
    return { x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: 0.6 + Math.random() * 1.9,
             v: 8 + Math.random() * 26, d: (Math.random() - 0.5) * 12, a: 0.25 + Math.random() * 0.6, hot: Math.random() > 0.45, t: Math.random() * 6 };
  }
  size();
  var count = innerWidth < 700 ? 45 : 90;
  for (var i = 0; i < count; i++) P.push(mk(true));
  window.addEventListener("resize", size);
  var last = performance.now();
  (function loop(now) {
    requestAnimationFrame(loop);
    if (doc.hidden) { last = now; return; }
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.y -= p.v * dt; p.t += dt; p.x += (p.d + Math.sin(p.t * 1.3) * 8) * dt;
      if (p.y < -10) P[i] = mk(false);
      var fade = Math.min(1, p.y / (H * 0.35), (H - p.y) / 60);
      ctx.beginPath();
      ctx.fillStyle = p.hot ? "rgba(255,120,40," + (p.a * fade) + ")" : "rgba(255,238,220," + (p.a * 0.6 * fade) + ")";
      ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fill();
    }
  })(last);
})();
