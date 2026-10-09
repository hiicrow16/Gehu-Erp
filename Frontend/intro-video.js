/* Cinematic intro video that plays over the loader, then fades out into the site.
   - Muted autoplay (browsers block autoplay with sound), Skip button + Esc.
   - Holds the hero animation until the video ends so nobody misses it.
   - Falls back instantly to the normal loader if the video can't play. */
(function () {
  "use strict";
  var SRC = "video/intro.mp4", POSTER = "video/intro-poster.jpg";
  var PLAY_ONCE_PER_SESSION = false;   // true = only the first visit per browser tab; false = every page load
  var MAX_MS = 12000;                  // safety: never block the site longer than this

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { if (PLAY_ONCE_PER_SESSION && sessionStorage.getItem("gehu-intro")) return; } catch (e) {}

  var root = document.createElement("div");
  root.className = "iv"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "GEHU intro video");
  root.innerHTML =
    '<video class="iv-bg" src="' + SRC + '" poster="' + POSTER + '" muted playsinline preload="auto" aria-hidden="true" tabindex="-1"></video>' +
    '<div class="iv-card">' +
      '<video class="iv-main" src="' + SRC + '" poster="' + POSTER + '" muted playsinline preload="auto"></video>' +
      '<div class="iv-top"><img src="img/logo-96.png" alt=""><span>GEHU<small>Graphic Era Hill University</small></span></div>' +
      '<p class="iv-tag">Inspire · Innovate · Impact</p>' +
    '</div>' +
    '<div class="iv-bar"><b></b></div>' +
    '<button class="iv-skip" type="button">Skip <i>›</i></button>';
  document.body.insertBefore(root, document.body.firstChild);
  document.documentElement.classList.add("iv-lock");

  var main = root.querySelector(".iv-main"), bg = root.querySelector(".iv-bg"), bar = root.querySelector(".iv-bar b"), skip = root.querySelector(".iv-skip");
  main.muted = bg.muted = true; main.playsInline = bg.playsInline = true;
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
    setTimeout(function () { main.pause(); bg.pause(); root.remove(); }, 1000);
  }
  function onKey(e) { if (e.key === "Escape") finish(); }
  addEventListener("keydown", onKey);
  skip.addEventListener("click", finish);
  main.addEventListener("ended", function () { setTimeout(finish, 250); });
  main.addEventListener("error", finish);
  setTimeout(finish, MAX_MS);
  setTimeout(function () { root.classList.add("skipok"); }, 700);

  function loop() {
    var d = main.duration || 5.96, t = main.currentTime || 0;
    bar.style.transform = "scaleX(" + Math.min(1, t / d) + ")";
    root.classList.toggle("late", t > 3.9);
    raf = requestAnimationFrame(loop);
  }
  var start = main.play();
  if (start && start.then) {
    start.then(function () { bg.play().catch(function () {}); loop(); }).catch(finish);   // autoplay blocked -> normal loader
  } else { bg.play(); loop(); }
})();
