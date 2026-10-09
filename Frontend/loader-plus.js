/* Anime / manga style intro loader.
   Speed lines + halftone, a progress ring around the logo, and big readable
   INSPIRE -> INNOVATE -> IMPACT words that "slam" in with a flash, shake and slash.
   Sits on the existing loader (#loader, #loaderNum, #loaderBar, .done); nothing else changes. */
(function () {
  "use strict";
  var L = document.getElementById("loader"), num = document.getElementById("loaderNum");
  if (!L || !num) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var inner = L.querySelector(".loader-inner"), logo = L.querySelector(".loader-logo");
  if (!inner || !logo) return;
  L.classList.add("ld-plus");

  function div(cls, parent, first) { var d = document.createElement("div"); d.className = cls; d.setAttribute("aria-hidden", "true"); first ? parent.insertBefore(d, parent.firstChild) : parent.appendChild(d); return d; }

  /* anime backdrop layers */
  var lines = div("loader-lines", L, true), halftone = div("loader-halftone", L, true);
  var flash = div("loader-flash", L), slash = div("loader-slash", L), slash2 = div("loader-slash s2", L);

  /* ring + orb */
  var orb = document.createElement("div"); orb.className = "loader-orb";
  orb.innerHTML = '<svg class="ring" viewBox="0 0 200 200" aria-hidden="true"><defs><linearGradient id="ldg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb020"/><stop offset=".55" stop-color="#ff6a1a"/><stop offset="1" stop-color="#e5301f"/></linearGradient></defs>' +
    '<circle class="ring-ticks" cx="100" cy="100" r="95"/><circle class="ring-track" cx="100" cy="100" r="84"/>' +
    '<circle class="ring-bar" cx="100" cy="100" r="84" pathLength="100" transform="rotate(-90 100 100)"/></svg>';
  logo.parentNode.insertBefore(orb, logo); orb.appendChild(logo);
  var bar = orb.querySelector(".ring-bar");

  /* big slam word + readable caption */
  var stage = document.createElement("div"); stage.className = "loader-slam";
  stage.innerHTML = '<span class="slam-word" aria-live="polite"></span>';
  var sub = document.createElement("p"); sub.className = "loader-sub"; sub.textContent = "Transforming dreams into reality";
  inner.appendChild(stage); inner.appendChild(sub);
  var word = stage.firstChild;

  var STEPS = [[0, "Inspire", "w1"], [33, "Innovate", "w2"], [66, "Impact", "w3"]];
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function burst() { if (reduce) return; restart(flash, "go"); restart(slash, "go"); restart(inner, "shake"); restart(lines, "pulse"); }
  function hit(i) {
    word.textContent = STEPS[i][1]; word.className = "slam-word " + STEPS[i][2];
    if (!reduce) { void word.offsetWidth; word.classList.add("hit"); }
    burst();
  }

  var p = -1, idx = -1;
  function tick() {
    var v = parseInt(num.textContent, 10) || 0;
    if (v !== p) {
      p = v; bar.style.strokeDashoffset = String(100 - p);
      var k = 0; STEPS.forEach(function (s, i) { if (p >= s[0]) k = i; });
      if (k !== idx) { idx = k; hit(k); }
      if (p >= 100 && !L.classList.contains("ready")) { L.classList.add("ready"); if (!reduce) { restart(flash, "go"); restart(slash2, "go"); } }
    }
    if (!L.classList.contains("done")) requestAnimationFrame(tick);
  }
  tick();

  /* embers */
  if (reduce) return;
  var cv = document.createElement("canvas"); cv.className = "loader-embers"; cv.setAttribute("aria-hidden", "true");
  L.insertBefore(cv, L.firstChild);
  var g = cv.getContext("2d"), W = 0, H = 0, dpr = Math.min(devicePixelRatio || 1, 2), parts = [], last = performance.now(), doneAt = 0;
  function size() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  size(); addEventListener("resize", size);
  function spawn(init) { return { x: Math.random() * W, y: init ? Math.random() * H : H + 10, vy: 22 + Math.random() * 60, r: 0.7 + Math.random() * 2, ph: Math.random() * 6.28, hot: Math.random() < 0.35, a: 0.3 + Math.random() * 0.7 }; }
  var N = innerWidth < 760 ? 40 : 80;
  for (var i = 0; i < N; i++) parts.push(spawn(true));
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = "lighter";
    var boost = 0.7 + Math.max(p, 0) / 100 * 0.9;
    parts.forEach(function (o, i) {
      o.y -= o.vy * dt * boost; o.ph += dt * 2;
      var x = o.x + Math.sin(o.ph) * 14, fl = 0.6 + 0.4 * Math.sin(o.ph * 3), al = o.a * fl * Math.min(1, o.y / (H * 0.5) + 0.2);
      g.fillStyle = o.hot ? "rgba(255,190,110," + al + ")" : "rgba(255,106,26," + al * 0.8 + ")";
      g.beginPath(); g.arc(x, o.y, o.r, 0, 6.283); g.fill();
      if (o.y < -10) parts[i] = spawn(false);
    });
    if (L.classList.contains("done") && !doneAt) doneAt = now;
    if (doneAt && now - doneAt > 1200) { cv.remove(); return; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
