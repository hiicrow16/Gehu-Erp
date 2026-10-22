/* Footer team popout: tap a name or photo to see that person's social profiles.
   Data comes from team-data.js. Without JS the names still link to team.html. */
(function(){
  var ul = document.getElementById("footTeam");
  if(!ul || !window.GEHU_TEAM) return;
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); };
  var pop = document.createElement("div");
  pop.className = "tpop"; pop.id = "teamPop"; pop.hidden = true;
  pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Team member profile");
  document.body.appendChild(pop);
  var current = null;

  function rows(p){
    var out = "";
    Object.keys(window.GEHU_ICONS).forEach(function(k){
      var href = window.gehuLink(k, p.links && p.links[k]); if(!href) return;
      out += '<a class="tpop-link" data-k="' + k + '" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer me">' +
             window.GEHU_ICONS[k] + '<span>' + window.GEHU_LABELS[k] + '</span></a>';
    });
    return out;
  }
  function close(){ pop.hidden = true; if(current){ current.setAttribute("aria-expanded","false"); current.focus({preventScroll:true}); current = null; } }
  function place(btn){
    var r = btn.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 24);
    pop.style.width = w + "px";
    var left = Math.max(12, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 12));
    pop.style.left = left + "px";
    var h = pop.offsetHeight, above = r.top - h - 12;
    var top = above > 8 ? above + window.scrollY : r.bottom + window.scrollY + 12;   // footer is at page bottom: prefer opening upward
    pop.style.top = top + "px";
    pop.style.setProperty("--ax", Math.max(18, Math.min(w - 18, r.left + r.width/2 + window.scrollX - left)) + "px");
    pop.classList.toggle("below", above <= 8);
  }
  var hydrated = false;
  function open(btn, p){
    if(!hydrated){ hydrated = true; window.gehuHydrate(function(){ if(!pop.hidden && current === btn) render(btn, p); }); }
    render(btn, p);
  }
  function render(btn, p){
    var links = rows(p);
    pop.innerHTML =
      '<button class="tpop-x" type="button" aria-label="Close">×</button>' +
      '<div class="tpop-head"><img src="' + esc(p.photo) + '" alt="" width="52" height="52"><div><b>' + esc(p.name) + '</b><span>' + esc(p.role) + '</span></div></div>' +
      (p.bio ? '<p class="tpop-bio">' + esc(p.bio) + '</p>' : (p.tagline ? '<p class="tpop-bio">' + esc(p.tagline) + '</p>' : '')) +
      (links ? '<div class="tpop-links">' + links + '</div>' : '<p class="tpop-none">Social links coming soon.</p>') +
      '<a class="tpop-more" href="team.html#' + esc(p.id) + '">Full profile →</a>';
    pop.hidden = false; current = btn; btn.setAttribute("aria-expanded","true");
    place(btn);
    var first = pop.querySelector(".tpop-link") || pop.querySelector(".tpop-more"); if(first) first.focus({preventScroll:true});
  }

  Array.prototype.forEach.call(ul.querySelectorAll("li"), function(li, i){
    var p = window.GEHU_TEAM[i]; if(!p) return;
    var a = li.querySelector(".tl-name"), img = li.querySelector("img");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "tl-name"; btn.textContent = a ? a.textContent : p.name;
    btn.setAttribute("aria-haspopup","dialog"); btn.setAttribute("aria-expanded","false"); btn.setAttribute("aria-controls","teamPop");
    if(a) a.replaceWith(btn);
    var toggle = function(e){ e.preventDefault(); e.stopPropagation(); if(current === btn && !pop.hidden){ close(); } else { if(current) current.setAttribute("aria-expanded","false"); open(btn, p); } };
    btn.addEventListener("click", toggle);
    if(img){ img.style.cursor = "pointer"; img.addEventListener("click", toggle); }
  });

  pop.addEventListener("click", function(e){ e.stopPropagation(); if(e.target.closest(".tpop-x")) close(); });
  document.addEventListener("click", function(){ if(!pop.hidden) close(); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && !pop.hidden) close(); });
  window.addEventListener("resize", function(){ if(!pop.hidden && current) place(current); });
})();
