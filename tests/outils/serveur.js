// Petit serveur web pour les tests : il sert les fichiers du dépôt sur http://localhost:8123,
// comme GitHub Pages le fait sur Internet. Playwright le démarre tout seul avant les tests
// (voir « webServer » dans playwright.config.js) et l'arrête à la fin.
const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..'); // le dossier du dépôt
const PORT = Number(process.env.PORT) || 8123;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'
};

http.createServer((demande, reponse) => {
  // « /js/game.js?v=5.0 » -> « js/game.js » (on ignore ce qui suit le « ? »)
  let chemin = decodeURIComponent(demande.url.split('?')[0]);
  if (chemin.endsWith('/')) chemin += 'index.html';
  const fichier = path.join(RACINE, chemin);
  if (!fichier.startsWith(RACINE)) { reponse.writeHead(403); reponse.end(); return; } // pas de sortie du dossier
  fs.readFile(fichier, (erreur, contenu) => {
    if (erreur) { reponse.writeHead(404); reponse.end('Introuvable'); return; }
    reponse.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    reponse.end(contenu);
  });
}).listen(PORT, () => console.log(`Jeu servi sur http://localhost:${PORT}`));
