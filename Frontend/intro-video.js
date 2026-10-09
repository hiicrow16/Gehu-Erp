/* Cinematic intro video that plays over the loader, then fades out into the site.
   - Muted autoplay (browsers block autoplay with sound), Skip button + Esc.
   - Holds the hero animation until the video ends so nobody misses it.
   - Falls back instantly to the normal loader if the video can't play. */
(function () {
  "use strict";
  var SRC = "video/intro.mp4", POSTER = "video/intro-poster.jpg";
  var PLAY_ONCE_PER_SESSION = false;   // true = only the first visit per browser tab; false = every page load
  var COVER_ON_DESKTOP = false;       // true = crop the video to fill a wide desktop screen (it is portrait, so faces get cut)
  var MAX_MS = 14000;                  // safety: never block the site longer than this

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { if (PLAY_ONCE_PER_SESSION && sessionStorage.getItem("gehu-intro")) return; } catch (e) {}

  var root = document.createElement("div");
  root.className = "iv"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "GEHU intro video");
  var wide = innerWidth > 700 && !COVER_ON_DESKTOP;     // blurred side-fill only on wide screens
  if (COVER_ON_DESKTOP) root.classList.add("cover");
  root.innerHTML =
    (wide ? '<video class="iv-bg" src="' + SRC + '" poster="' + POSTER + '" muted playsinline webkit-playsinline preload="auto" aria-hidden="true" tabindex="-1"></video>' : "") +
    '<div class="iv-card">' +
      '<video class="iv-main" src="' + SRC + '" poster="' + POSTER + '" muted playsinline webkit-playsinline preload="auto"></video>' +
      '<div class="iv-top"><img src="img/logo-96.png" alt=""><span>GEHU<small>Graphic Era Hill University</small></span></div>' +
      '<p class="iv-tag">Inspire · Innovate · Impact</p>' +
    '</div>' +
    '<button class="iv-play" type="button" aria-label="Play intro"><span><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span><em>Tap to play</em></button>' +
    '<div class="iv-bar"><b></b></div>' +
    '<button class="iv-skip" type="button">Skip <i>›</i></button>';
  document.body.insertBefore(root, document.body.firstChild);
  document.documentElement.classList.add("iv-lock");

  var main = root.querySelector(".iv-main"), bg = root.querySelector(".iv-bg"), bar = root.querySelector(".iv-bar b"), skip = root.querySelector(".iv-skip");
  var play = root.querySelector(".iv-play");
  main.muted = true; main.playsInline = true;
  if (bg) { bg.muted = true; bg.playsInline = true; }
  var done = false, paused = false, raf;

  /* keep the page still while the video plays */
  function block(e) { e.preventDefault(); e.stopPropagation(); }
  addEventListener("wheel", block, { capture: true, passive: false });
  addEventListener("touchmove", block, { capture: true, passive: false });

  /* hold GSAP's timeline (hero reveal) until we're done; gsap loads after this script, so poll */
  var gt = setInterval(function () {
    if (done) return clearInterval(gt);
    if (window.gsap) { gsap.globalTimeline.pause(); paused = true; clearInterval(gt); }
  }, 25);

  function finish() {
    if (done) return; done = true;
    clearInterval(gt); cancelAnimationFrame(raf);
    removeEventListener("wheel", block, true); removeEventListener("touchmove", block, true);
    removeEventListener("keydown", onKey);
    try { sessionStorage.setItem("gehu-intro", "1"); } catch (e) {}
    root.classList.add("out");
    document.documentElement.classList.remove("iv-lock");
    if (paused && window.gsap) gsap.globalTimeline.resume();
    setTimeout(function () { main.pause(); if (bg) bg.pause(); root.remove(); }, 1000);
  }
  function onKey(e) { if (e.key === "Escape") finish(); }
  addEventListener("keydown", onKey);
  skip.addEventListener("click", finish);
  main.addEventListener("ended", function () { setTimeout(finish, 250); });
  main.addEventListener("error", finish);
  setTimeout(finish, MAX_MS);
  setTimeout(function () { root.classList.add("skipok"); }, 700);

  var late = false, running = false;
  function loop() {
    var d = main.duration || 5.9, t = main.currentTime || 0;
    bar.style.transform = "scaleX(" + Math.min(1, t / d) + ")";
    if ((t > 3.9) !== late) { late = !late; root.classList.toggle("late", late); }
    raf = requestAnimationFrame(loop);
  }
  function go() {
    root.classList.remove("needtap");
    var pr = main.play();
    var ok = function () { if (bg) bg.play().catch(function () {}); if (!running) { running = true; loop(); } };
    if (pr && pr.then) pr.then(ok).catch(function () { root.classList.add("needtap", "skipok"); });   // autoplay blocked (low-power / data saver): ask for a tap
    else ok();
  }
  play.addEventListener("click", go);
  go();
})();
