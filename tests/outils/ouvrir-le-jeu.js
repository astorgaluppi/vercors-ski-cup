// Ouvre le jeu dans le navigateur de test et prépare tout ce dont les tests ont besoin.
//
// - Le « bouchon » réseau : toutes les adresses qui ne sont pas notre petit serveur local
//   sont bloquées (en particulier le classement en ligne Supabase). Les tests ne touchent
//   donc jamais au vrai classement de la famille, et marchent même sans Internet.
//   Le jeu est prévu pour fonctionner sans réseau, donc ce blocage ne le gêne pas.
// - Les erreurs JavaScript de la page sont notées dans une liste, pour que les tests
//   puissent vérifier qu'il n'y en a aucune.
// - On attend que window.PTPSC existe : c'est la « porte d'entrée » pour les tests,
//   en bas de js/game.js, qui donne accès à l'état du skieur, aux bosses, à step()…
const path = require('path');

async function ouvrirLeJeu(page) {
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(`Erreur JavaScript : ${e.message}`));
  page.on('console', (m) => {
    // les ressources bloquées exprès par le bouchon réseau ne comptent pas comme des erreurs du jeu
    if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_BLOCKED/i.test(m.text())) {
      erreurs.push(`Console : ${m.text()}`);
    }
  });

  await page.route((adresse) => adresse.hostname !== 'localhost', (requete) => requete.abort());

  await page.goto('/');
  await page.waitForFunction(() => window.PTPSC && window.PISTE_V1);
  return erreurs;
}

// Ajoute le pilote automatique dans la page (il n'est pas chargé par le vrai jeu).
async function ajouterLePilote(page) {
  await page.addScriptTag({ path: path.join(__dirname, 'pilote-automatique.js') });
}

module.exports = { ouvrirLeJeu, ajouterLePilote };
