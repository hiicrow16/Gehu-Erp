// Single place to point the frontend at your backend.
// For local development this defaults to localhost.
// When you deploy to hiicrow.site, change this to your deployed backend URL,
// e.g. "https://api.hiicrow.site/api"
window.API_BASE = "https://gehu-erp-backend.onrender.com/api";

/* ------------------------------------------------------------------
   SUPPORT CONTACTS
   The WhatsApp number is NOT stored here. It lives on the backend
   (Render environment variable SUPPORT_WHATSAPP) and the WhatsApp card
   links to <API_BASE>/support/whatsapp, which forwards into WhatsApp.
------------------------------------------------------------------- */
window.SUPPORT = {
  email: "support@hiicrow.site",
  message: "Hi GEHU Portal team, I need help with "
};

(function () {
  var S = window.SUPPORT || {};
  function apply() {
    document.querySelectorAll('[data-support="whatsapp"]').forEach(function (a) {
      a.href = window.API_BASE + "/support/whatsapp" + (S.message ? "?text=" + encodeURIComponent(S.message) : "");
    });
    if (S.email) {
      document.querySelectorAll('a[href^="mailto:support@"]').forEach(function (a) { a.href = "mailto:" + S.email; });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();

/* ------------------------------------------------------------------
   HOMEPAGE CONTENT YOU CAN FILL IN (both are empty on purpose: the
   homepage only shows verified information)
------------------------------------------------------------------- */
// Real photographs for the Campus and facilities grid (library, labs, hostels...).
// Put the files in Frontend/img and list them here:
// window.GEHU_GALLERY = [
//   { src: "img/library.webp", alt: "Reading hall of the central library", caption: "Library" },
//   { src: "img/laboratory.webp", alt: "A teaching laboratory", caption: "Laboratories" }
// ];
window.GEHU_GALLERY = [];

// Placement / achievement figures. Each needs a value, a label and a source (with year).
// window.GEHU_FIGURES = [{ value: "2,270+", label: "Offers made", source: "Placement report 2025" }];
window.GEHU_FIGURES = [];
