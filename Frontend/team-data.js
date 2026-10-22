/* ============================================================
   TEAM DATA — edit this file only.
   For each person, just write the USERNAME (with or without @). The full links are built for you.
   Leave "" to hide a link.

     instagram:"hiicrow"          ->  instagram.com/hiicrow
     linkedin:"neeraj-kumar"      ->  linkedin.com/in/neeraj-kumar
     github:"hiicrow"             ->  github.com/hiicrow   (and the GitHub bio is fetched automatically)
     x:"hiicrow"                  ->  x.com/hiicrow
     email:"you@example.com"      ->  mailto link
     website:"yoursite.com"       ->  https://yoursite.com

   A full https:// link also still works. `bio` is optional: if empty, the GitHub bio is used
   when a GitHub username is set, otherwise the short `tagline` shows.
   ============================================================ */
window.GEHU_TEAM = [
  { id:"hiicrow", name:"Hiicrow", role:"Full stack", photo:"img/neeraj.webp",
    tagline:"Built and maintains the whole portal.",
    bio:"",
    links:{ instagram:"hiicrow", linkedin:"", github:"", x:"", email:"", website:"" } },
  { id:"garry", name:"Garry", role:"Frontend", photo:"img/gaurav.webp",
    tagline:"Designs and builds what you see on screen.",
    bio:"",
    links:{ instagram:"theycallme_garry__", linkedin:"", github:"", x:"", email:"", website:"" } },
  { id:"rakshit", name:"Rakshit", role:"Backend", photo:"img/rakshit.webp",
    tagline:"Works on the APIs and data behind the portal.",
    bio:"",
    links:{ instagram:"rakshitjoshi_029", linkedin:"", github:"", x:"", email:"", website:"" } },
  { id:"deepak", name:"Deepak", role:"Backend", photo:"img/deepak.webp",
    tagline:"Works on the APIs and data behind the portal.",
    bio:"",
    links:{ instagram:"", linkedin:"", github:"", x:"", email:"", website:"" } }
];

/* Shared social icon renderer (used by team.html and the homepage footer). */
window.GEHU_ICONS = {
  instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>',
  linkedin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  github:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
  email:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5.5A2.5 2.5 0 015.5 3h13A2.5 2.5 0 0121 5.5v13a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18.5v-13zm2.4.5L12 11.2 18.6 6H5.4zM19 7.9l-6.4 5a1 1 0 01-1.2 0L5 7.9v10.6c0 .3.2.5.5.5h13c.3 0 .5-.2.5-.5V7.9z" fill-rule="evenodd"/></svg>',
  website:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 100 20 10 10 0 000-20zm6.9 9h-3.1a15.7 15.7 0 00-1.3-5.5A8 8 0 0118.9 11zM12 4c.8 1 1.7 3 1.8 7h-3.6C10.300 7 11.200 5 12 4zM4 12.7V12c0-.3 0-.7.100-1h3.1c-.1.7-.2 1.3-.2 2s.1 1.3.2 2H4.100a8 8 0 01-.1-1.3zM5.100 15h3.1c.3 2 .8 3.800 1.3 5A8 8 0 015.100 15zM8.200 9H5.100a8 8 0 014.4-5.5C9 5.7 8.500 7.200 8.200 9zM12 20c-.8-1-1.7-3-1.8-7h3.6c-.1 4-1 6-1.8 7zm2.500 0c.5-1.200 1-3 1.3-5h3.1a8 8 0 01-4.4 5zM16 13c.1-.7.2-1.3.2-2h-8.400c0 .7.1 1.3.2 2h8z"/></svg>'
};
window.GEHU_BRAND = { instagram:"#E4405F", linkedin:"#0A66C2", github:"#24292F", x:"#000000", email:"#B3261E", website:"#2F6F5E" };
window.GEHU_LABELS = { instagram:"Instagram", linkedin:"LinkedIn", github:"GitHub", x:"X", email:"Email", website:"Website" };

/* Turn a username (or full link) into a safe https link. */
window.gehuLink = function(kind, raw){
  var v = String(raw || "").trim(); if(!v) return "";
  if(kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "mailto:" + v : "";
  if(kind === "website"){ v = /^https?:\/\//i.test(v) ? v : "https://" + v; return /^https:\/\/[^\s"<>]+$/i.test(v) ? v : ""; }
  if(/^https:\/\//i.test(v)) return /^https:\/\/[^\s"<>]+$/i.test(v) ? v : "";
  v = v.replace(/^@/, "").replace(/\/+$/, "");
  if(!/^[A-Za-z0-9._-]{1,60}$/.test(v)) return "";
  var base = { instagram:"https://www.instagram.com/", linkedin:"https://www.linkedin.com/in/", github:"https://github.com/", x:"https://x.com/" }[kind];
  return base ? base + v : "";
};
/* GitHub username for a person (from a username or a github.com link). */
window.gehuGithubUser = function(p){
  var g = String((p.links && p.links.github) || "").trim().replace(/^https:\/\/github\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  return /^[A-Za-z0-9-]{1,39}$/.test(g) ? g : "";
};
/* Fetch missing bios from GitHub's public API (cached for the session; fails silently). */
window.gehuHydrate = function(done){
  var team = window.GEHU_TEAM || [], pending = 0, finished = false;
  var finish = function(){ if(!finished && pending === 0){ finished = true; done && done(); } };
  team.forEach(function(p){
    if(p.bio) return; var u = window.gehuGithubUser(p); if(!u) return;
    var key = "gehu-gh-" + u, cached = null;
    try { cached = sessionStorage.getItem(key); } catch(e){}
    if(cached !== null){ p.bio = cached; return; }
    pending++;
    fetch("https://api.github.com/users/" + encodeURIComponent(u), { headers:{ Accept:"application/vnd.github+json" } })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ var b = (d && typeof d.bio === "string") ? d.bio.trim().slice(0, 200) : ""; p.bio = b; try { sessionStorage.setItem(key, b); } catch(e){} })
      .catch(function(){})
      .then(function(){ pending--; finish(); });
  });
  finish();
};
window.gehuSocials = function(person){
  var out = "";
  Object.keys(window.GEHU_ICONS).forEach(function(k){
    var href = window.gehuLink(k, person.links && person.links[k]); if(!href) return;
    out += '<a data-k="' + k + '" href="' + href.replace(/"/g,"&quot;") + '" target="_blank" rel="noopener noreferrer me" aria-label="' +
      person.name + " on " + window.GEHU_LABELS[k] + '">' + window.GEHU_ICONS[k] + '</a>';
  });
  return out;
};
