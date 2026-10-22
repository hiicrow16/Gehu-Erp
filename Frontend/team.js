(function(){
  var list = document.getElementById("teamList"); if(!list || !window.GEHU_TEAM) return;
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); };
  list.innerHTML = window.GEHU_TEAM.map(function(p){
    var socials = window.gehuSocials(p);
    return '<article class="member" id="' + esc(p.id) + '">' +
      '<img class="member-photo" src="' + esc(p.photo) + '" alt="Portrait of ' + esc(p.name) + '" width="160" height="160" loading="lazy">' +
      '<div class="member-body">' +
        '<p class="member-role">' + esc(p.role) + '</p>' +
        '<h2 class="member-name">' + esc(p.name) + '</h2>' +
        '<p class="member-tag">' + esc(p.tagline || "") + '</p>' +
        (p.bio ? '<p class="member-bio">' + esc(p.bio) + '</p>' : '') +
        (socials ? '<div class="member-links">' + socials + '</div>' : '') +
      '</div></article>';
  }).join("");
  if(location.hash){ var t = document.getElementById(location.hash.slice(1)); if(t) t.scrollIntoView(); }
})();
