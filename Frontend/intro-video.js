/* Cinematic intro video - PHONES ONLY (desktop never loads or plays it).
   Muted autoplay, full screen, Skip button, tap-to-play fallback.
   Holds the hero animation until it ends; falls back to the normal loader if it can't play. */
(function () {
  "use strict";
  var SRC = "video/intro-mobile.mp4", POSTER = "video/intro-poster.jpg";
  var PLAY_ONCE_PER_SESSION = false;   // true = only first visit per browser tab
  var MAX_MS = 14000;                  // safety: never block the site longer than this

  var phone = /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent) ||
    (matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 600);
  if (!phone) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { if (PLAY_ONCE_PER_SESSION && sessionStorage.getItem("gehu-intro")) return; } catch (e) {}

  var root = document.createElement("div");
  root.className = "iv"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "GEHU intro video");
  root.innerHTML =
    '<video class="iv-main" src="' + SRC + '" poster="' + POSTER + '" muted playsinline webkit-playsinline preload="auto"></video>' +
    '<div class="iv-top"><img src="img/logo-96.png" alt=""><span>GEHU<small>Graphic Era Hill University</small></span></div>' +
    '<p class="iv-tag">Inspire · Innovate · Impact</p>' +
    '<button class="iv-play" type="button" aria-label="Play intro"><span><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><em>Tap to play</em></button>' +
    '<div class="iv-bar"><b></b></div>' +
    '<button class="iv-skip" type="button">Skip <i>›</i></button>';
  document.body.insertBefore(root, document.body.firstChild);
  document.documentElement.classList.add("iv-lock");

  var main = root.querySelector(".iv-main"), bar = root.querySelector(".iv-bar b"), skip = root.querySelector(".iv-skip"), play = root.querySelector(".iv-play");
  main.muted = true; main.playsInline = true;
  var done = false, paused = false, raf, late = false, running = false;

  function block(e) { e.preventDefault(); e.stopPropagation(); }
  addEventListener("touchmove", block, { capture: true, passive: false });

  /* hold GSAP's timeline (hero reveal) until we finish; gsap loads after this script, so poll */
  var gt = setInterval(function () {
    if (done) return clearInterval(gt);
    if (window.gsap) { gsap.globalTimeline.pause(); paused = true; clearInterval(gt); }
  }, 25);

  function finish() {
    if (done) return; done = true;
    clearInterval(gt); cancelAnimationFrame(raf);
    removeEventListener("touchmove", block, true);
    try { sessionStorage.setItem("gehu-intro", "1"); } catch (e) {}
    root.classList.add("out");
    document.documentElement.classList.remove("iv-lock");
    if (paused && window.gsap) gsap.globalTimeline.resume();
    setTimeout(function () { main.pause(); root.remove(); }, 900);
  }
  skip.addEventListener("click", finish);
  main.addEventListener("ended", function () { setTimeout(finish, 200); });
  main.addEventListener("error", finish);
  setTimeout(finish, MAX_MS);
  setTimeout(function () { root.classList.add("skipok"); }, 700);

  function loop() {
    var d = main.duration || 5.9, t = main.currentTime || 0;
    bar.style.transform = "scaleX(" + Math.min(1, t / d) + ")";
    if ((t > 3.9) !== late) { late = !late; root.classList.toggle("late", late); }
    raf = requestAnimationFrame(loop);
  }
  function go() {
    root.classList.remove("needtap");
    var pr = main.play();
    var ok = function () { if (!running) { running = true; loop(); } };
    if (pr && pr.then) pr.then(ok).catch(function () { root.classList.add("needtap", "skipok"); });   // autoplay blocked: ask for a tap
    else ok();
  }
  play.addEventListener("click", go);
  go();
})();
