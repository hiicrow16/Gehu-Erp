/* "Rate Us" - adds a ★ Rate Us link to the top navbar. It opens a small popup where
   anyone can give 1-5 stars and an optional review. Reviews are write-only for
   visitors: only the admin can read them (Admin Panel -> Feedback). */
(function () {
  var navLinks = document.getElementById("navLinks");
  if (!navLinks || !window.API_BASE) return;

  var style = document.createElement("style");
  style.textContent =
    "#rateLink{color:#ffb020 !important;font-weight:600}" +
    "#fbOverlay{position:fixed;inset:0;background:rgba(2,6,23,.72);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:2000;padding:16px}" +
    "#fbOverlay.on{display:flex}" +
    ".fb-box{background:#101218;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:26px;width:100%;max-width:440px;color:#e8eaf0;box-shadow:0 24px 70px rgba(0,0,0,.6);font-family:inherit}" +
    ".fb-box h3{margin:0 0 4px;font-size:22px}.fb-box p.sub{margin:0 0 16px;color:#98a0b3;font-size:14px}" +
    ".fb-stars{display:flex;gap:6px;margin-bottom:6px}" +
    ".fb-stars button{background:none;border:0;font-size:36px;line-height:1;cursor:pointer;color:#3a3f4d;padding:0;transition:transform .15s,color .15s}" +
    ".fb-stars button.on{color:#ffb020}.fb-stars button:hover{transform:scale(1.15)}" +
    "#fbLabel{min-height:20px;color:#ffb020;font-size:14px;margin-bottom:10px}" +
    ".fb-box input,.fb-box textarea{width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:10px;color:#fff;font:inherit;font-size:14px;padding:11px 12px;margin-bottom:10px;outline:0}" +
    ".fb-box input:focus,.fb-box textarea:focus{border-color:#ff8a1f}" +
    ".fb-hp{position:absolute;left:-9999px;opacity:0;height:0}" +
    ".fb-row{display:flex;gap:10px;justify-content:flex-end;margin-top:4px}" +
    ".fb-row button{font:inherit;font-size:14px;padding:10px 18px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#e8eaf0;cursor:pointer}" +
    ".fb-row button.go{background:linear-gradient(115deg,#ffb020,#ff4b2b);color:#16090a;border:0;font-weight:700}" +
    ".fb-row button:disabled{opacity:.6;cursor:wait}" +
    "#fbMsg{min-height:20px;font-size:13.5px;color:#fca5a5;margin:2px 0 6px}#fbMsg.ok{color:#86efac}";
  document.head.appendChild(style);

  var li = document.createElement("li");
  li.innerHTML = '<a href="#" id="rateLink">★ Rate Us</a>';
  navLinks.appendChild(li);

  var overlay = document.createElement("div");
  overlay.id = "fbOverlay";
  overlay.innerHTML =
    '<div class="fb-box" role="dialog" aria-modal="true" aria-labelledby="fbTitle">' +
      '<h3 id="fbTitle">Rate our website</h3>' +
      '<p class="sub">Your review goes privately to the site owner.</p>' +
      '<div class="fb-stars" id="fbStars">' +
        [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-v="' + n + '" aria-label="' + n + ' star">★</button>'; }).join("") +
      '</div><div id="fbLabel"></div>' +
      '<input id="fbName" maxlength="60" placeholder="Your name (optional)">' +
      '<textarea id="fbText" rows="4" maxlength="1000" placeholder="Tell us what you liked or what we should improve…"></textarea>' +
      '<input class="fb-hp" id="fbWebsite" tabindex="-1" autocomplete="off" aria-hidden="true" placeholder="Leave empty">' +
      '<div id="fbMsg"></div>' +
      '<div class="fb-row"><button type="button" id="fbCancel">Close</button><button type="button" class="go" id="fbSend">Send review</button></div>' +
    '</div>';
  document.body.appendChild(overlay);

  var rating = 0, words = ["", "Poor", "Fair", "Good", "Very good", "Excellent!"];
  var stars = overlay.querySelectorAll("#fbStars button");
  function paint(n) { stars.forEach(function (b) { b.classList.toggle("on", Number(b.dataset.v) <= n); }); document.getElementById("fbLabel").textContent = words[n] || ""; }
  stars.forEach(function (b) {
    b.addEventListener("mouseenter", function () { paint(Number(b.dataset.v)); });
    b.addEventListener("click", function () { rating = Number(b.dataset.v); paint(rating); });
  });
  overlay.querySelector("#fbStars").addEventListener("mouseleave", function () { paint(rating); });

  function open() {
    var name = localStorage.getItem("displayName") || "";
    if (name && !document.getElementById("fbName").value) document.getElementById("fbName").value = name;
    document.getElementById("fbMsg").textContent = ""; document.getElementById("fbMsg").className = "";
    overlay.classList.add("on");
  }
  function close() { overlay.classList.remove("on"); }
  document.getElementById("rateLink").addEventListener("click", function (e) {
    e.preventDefault(); open();
    var nl = document.getElementById("navLinks"); if (nl) nl.classList.remove("open");
  });
  document.getElementById("fbCancel").addEventListener("click", close);
  overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  document.getElementById("fbSend").addEventListener("click", async function () {
    var msg = document.getElementById("fbMsg"), btn = this;
    msg.className = "";
    if (!rating) { msg.textContent = "Please tap a star rating first."; return; }
    btn.disabled = true;
    try {
      var headers = { "Content-Type": "application/json" };
      var t = localStorage.getItem("token"); if (t) headers.Authorization = "Bearer " + t;
      var res = await fetch(window.API_BASE + "/feedback", {
        method: "POST", headers: headers,
        body: JSON.stringify({
          rating: rating,
          name: document.getElementById("fbName").value.trim(),
          message: document.getElementById("fbText").value.trim(),
          website: document.getElementById("fbWebsite").value,
          page: location.pathname.split("/").pop() || "index.html"
        })
      });
      var d = await res.json().catch(function () { return {}; });
      if (d.success) {
        msg.className = "ok"; msg.textContent = "Thank you! Your review was sent.";
        rating = 0; paint(0); document.getElementById("fbText").value = "";
        setTimeout(close, 1800);
      } else {
        msg.textContent = d.message || "Could not send your review.";
      }
    } catch (e) {
      msg.textContent = "Could not reach the server. Please try again in a moment.";
    }
    btn.disabled = false;
  });
})();
