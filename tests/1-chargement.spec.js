// Test n°1 : le jeu se charge correctement.
// C'est le test le plus simple et le plus important : si une modification casse le code
// (une faute de frappe, une parenthèse oubliée…), le jeu ne démarre plus et ce test échoue.
const { test, expect } = require('@playwright/test');
const { ouvrirLeJeu } = require('./outils/ouvrir-le-jeu');

test('la page d\'accueil s\'affiche sans erreur JavaScript', async ({ page }) => {
  const erreurs = await ouvrirLeJeu(page);

  // l'écran d'accueil est visible, avec son bouton pour jouer
  await expect(page.locator('#screen-home')).toBeVisible();

  // on laisse tourner le jeu une seconde (animations, sons…) pour laisser le temps à une erreur d'apparaître
  await page.waitForTimeout(1000);
  expect(erreurs, 'Le jeu ne doit afficher aucune erreur').toEqual([]);
});

test('la piste est complète et cohérente', async ({ page }) => {
  await ouvrirLeJeu(page);
  const piste = await page.evaluate(() => {
    const P = window.PISTE_V1;
    return {
      longueur: P.longueur,
      totalTroncons: P.troncons.reduce((somme, t) => somme + t.longueur, 0),
      intermediaires: P.intermediaires,
      nbChamps: P.champsDeBosses.length
    };
  });
  // les tronçons doivent aller au moins jusqu'à la ligne d'arrivée (et un peu après, pour l'aire d'arrêt)
  expect(piste.totalTroncons).toBeGreaterThanOrEqual(piste.longueur);
  // les temps intermédiaires sont sur la piste, dans l'ordre
  for (const y of piste.intermediaires) expect(y).toBeLessThan(piste.longueur);
  expect([...piste.intermediaires].sort((a, b) => a - b)).toEqual(piste.intermediaires);
  expect(piste.nbChamps).toBeGreaterThan(0);
});
