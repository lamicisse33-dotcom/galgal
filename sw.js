/* ═══════════════════════════════════════════════════════════════════════
   GALGAL — Service Worker
   © 2026 KHALAM (Khadi & Lamine). Tous droits réservés.

   · Rend le jeu installable et jouable hors ligne.
   · HTML : réseau d'abord, pour que tes mises à jour arrivent ; repli sur
     le cache quand il n'y a pas de réseau.
   · Icônes et manifeste : cache d'abord.
   · Le nouveau service worker ATTEND que le joueur accepte la mise à jour :
     on ne recharge jamais quelqu'un en pleine partie.

   ⚠ Change VERSION à CHAQUE dépôt, sinon les joueurs gardent l'ancien jeu.
   ═══════════════════════════════════════════════════════════════════════ */
const VERSION = "galgal-v1";
const COQUILLE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("message", function(e){
  // Envoyé par la bannière « Mettre à jour » de la page.
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(VERSION).then(function(cache){
      // Au mieux : une ressource manquante ne doit pas faire échouer
      // l'installation entière.
      return Promise.allSettled(COQUILLE.map(function(u){ return cache.add(u); }));
    })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(cles){
      return Promise.all(cles.filter(function(k){ return k !== VERSION; })
                            .map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  var estHTML = req.mode === "navigate" ||
                (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  if (estHTML){
    e.respondWith(
      fetch(req).then(function(res){
        var copie = res.clone();
        caches.open(VERSION).then(function(c){ c.put("./index.html", copie); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(m){ return m || caches.match("./index.html"); });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function(m){
      return m || fetch(req).then(function(res){
        var copie = res.clone();
        caches.open(VERSION).then(function(c){ c.put(req, copie); });
        return res;
      }).catch(function(){ return m; });
    })
  );
});
