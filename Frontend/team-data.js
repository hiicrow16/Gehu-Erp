/* ============================================================
   TEAM DATA — edit this file only.
   For each person, paste full profile URLs. Empty ("") links are hidden automatically.
   `bio` is optional: leave "" to show the default one-line role description.
   Example:  instagram: "https://www.instagram.com/yourhandle",
             linkedin:  "https://www.linkedin.com/in/yourname",
             github:    "https://github.com/yourname",
             x:         "https://x.com/yourhandle",
             email:     "you@example.com"      (just the address)
             website:   "https://yoursite.com"
   ============================================================ */
window.GEHU_TEAM = [
  { id:"hiicrow", name:"Hiicrow", role:"Full stack", photo:"img/neeraj.webp",
    tagline:"Built and maintains the whole portal.",
    bio:"",
    links:{ instagram:"", linkedin:"", github:"", x:"", email:"", website:"https://hiicrow.site/" } },
  { id:"garry", name:"Garry", role:"Frontend", photo:"img/gaurav.webp",
    tagline:"Designs and builds what you see on screen.",
    bio:"",
    links:{ instagram:"https://www.instagram.com/theycallme_garry__?rpxt=MTZhcW13a241NW9hbw==", linkedin:"", github:"", x:"", email:"", website:"" } },
  { id:"rakshit", name:"Rakshit", role:"Backend", photo:"img/rakshit.webp",
    tagline:"Works on the APIs and data behind the portal.",
    bio:"",
    links:{ instagram:"https://www.instagram.com/rakshitjoshi_029?rpxt=N3RnbzdmbGp0ZGpm", linkedin:"", github:"", x:"", email:"", website:"" } },
  { id:"deepak", name:"Deepak", role:"Backend", photo:"img/deepak.webp",
    tagline:"Works on the APIs and data behind the portal.",
    bio:"",
    links:{ instagram:"", linkedin:"", github:"", x:"", email:"", website:"" } }
];

/* Shared social icon renderer (used by team.html and the homepage footer). */
window.GEHU_ICONS = {
  instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
  linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.2 8.6H2.4V21h2.8V8.6zM3.8 3a1.6 1.6 0 100 3.2A1.6 1.6 0 003.8 3zM21.6 14.3c0-3.3-1.8-5-4.2-5-1.6 0-2.6.9-3 1.6V8.6h-2.8V21h2.8v-6.5c0-1.5.8-2.6 2.1-2.6 1.3 0 1.9.9 1.9 2.6V21h2.8v-6.7z"/></svg>',
  github:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 00-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.8.8.1-.6.3-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-4.9 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 015 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.8-2.3 4.6-4.6 4.9.4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0012 2z"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.100l-6.8 7.700L22 21h-6.200l-4.900-6.300L5.300 21H2.200l7.200-8.300L1.8 3h6.400l4.400 5.8L17.8 3zm-1.100 16.200h1.700L7.300 4.700H5.500l11.200 14.5z"/></svg>',
  email:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 7l8.500 6 8.500-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  website:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
};
window.GEHU_LABELS = { instagram:"Instagram", linkedin:"LinkedIn", github:"GitHub", x:"X", email:"Email", website:"Website" };
window.gehuSocials = function(person){
  var out = "";
  Object.keys(window.GEHU_ICONS).forEach(function(k){
    var v = (person.links && person.links[k] || "").trim();
    if(!v) return;
    var href = k === "email" ? "mailto:" + v : v;
    if(k !== "email" && !/^https:\/\//i.test(href)) return;   // only https links
    out += '<a href="' + href.replace(/"/g,"&quot;") + '" target="_blank" rel="noopener noreferrer me" aria-label="' +
      person.name + " on " + window.GEHU_LABELS[k] + '">' + window.GEHU_ICONS[k] + '</a>';
  });
  return out;
};
