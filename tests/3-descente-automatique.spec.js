// Test n°3 : une descente complète, jouée par le pilote automatique, avec chacune des trois paires de skis.
//
// Le pilote (tests/outils/pilote-automatique.js) « tient les manettes » à la place d'un joueur et évite
// les obstacles. On vérifie qu'il arrive en bas sans tomber, avant les 2 minutes, que les deux temps
// intermédiaires sont pris et que l'écran des résultats s'affiche.
//
// Ce test attrape les gros problèmes : un obstacle qui fait planter le jeu, une piste impossible,
// une arrivée qui ne se déclenche plus… Si un jour il échoue juste après une modification de la piste
// (un nouvel obstacle, par exemple), il est possible que ce soit le pilote qui ne sache pas encore
// l'éviter : le message d'erreur indique où et pourquoi il est tombé.
const { test, expect } = require('@playwright/test');
const { ouvrirLeJeu, ajouterLePilote } = require('./outils/ouvrir-le-jeu');

const PAIRES = [
  { id: 'rhea', nom: 'Les Tante Rhéa' },
  { id: 'bec', nom: 'Les Madame Bec' },
  { id: 'fourcade', nom: "Les Neige d'en Haut" }
];

for (const paire of PAIRES) {
  test(`descente complète avec ${paire.nom}`, async ({ page }) => {
    const erreurs = await ouvrirLeJeu(page);
    await ajouterLePilote(page);

    // toute la descente se joue d'un coup, image par image, dans la page
    const resultat = await page.evaluate((ski) => window.PiloteAutomatique.descendre({ ski }), paire.id);

    const resume = resultat.chute
      ? `chute « ${resultat.chute} » à ${resultat.y.toFixed(0)} m`
      : `fin de descente « ${resultat.mode} » à ${resultat.y.toFixed(0)} m`;
    const dernieresPositions = JSON.stringify(resultat.etapes.slice(-5));

    expect(resultat.mode, `${resume} — dernières positions : ${dernieresPositions}`).toBe('results');
    expect(resultat.tempsFinal).toBeLessThan(120);
    expect(resultat.intermediaires.length, 'deux temps intermédiaires (500 m et 1 000 m)').toBe(2);
    await expect(page.locator('#screen-results')).toBeVisible();
    expect(erreurs, 'Le jeu ne doit afficher aucune erreur').toEqual([]);

    // le temps s'affiche dans le rapport du test, pour info
    test.info().annotations.push({ type: 'temps', description: `${resultat.tempsFinal.toFixed(2)} s` });
  });
}
