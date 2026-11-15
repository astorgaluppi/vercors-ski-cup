// Test n°6 : le dérapage. Un virage brusque fait déraper le skieur et lui fait perdre de la vitesse ;
// un virage progressif (une belle trajectoire) ne fait rien perdre. Les skis qui accrochent le mieux
// (Les Tante Rhéa) perdent moins que ceux qui accrochent le moins (Les Neige d'en Haut).
const { test, expect } = require('@playwright/test');
const { ouvrirLeJeu } = require('./outils/ouvrir-le-jeu');

// Pose le skieur sur la longue ligne droite (vers 520 m) à 50 km/h, tout droit, puis tourne pendant 0,5 s :
// « brusque » = direction à fond d'un coup, « progressif » = un petit peu de direction seulement.
// Renvoie la vitesse (km/h) à la fin et le dérapage le plus fort vu en route.
async function virage(page, ski, direction) {
  return page.evaluate(([ski, direction]) => {
    const G = window.PTPSC, S = G.state, IMAGE = 1 / 120;
    G.setSki(ski);
    G.resetRace();
    for (let i = 0; i < 480 && S.mode !== 'race'; i++) G.step(IMAGE); // fin du compte à rebours
    S.y = 520; S.x = G.track.center(520); S.th = 0; S.v = 50 / 3.6;
    G.input.override = { steer: direction, tuck: false, brake: false };
    let maxDerapage = 0;
    for (let i = 0; i < 60; i++) { G.step(IMAGE); maxDerapage = Math.max(maxDerapage, S.derapage || 0); }
    G.input.override = null;
    return { kmh: S.v * 3.6, maxDerapage, mode: S.mode };
  }, [ski, direction]);
}

test('un virage brusque fait déraper et perdre de la vitesse, pas un virage progressif', async ({ page }) => {
  await ouvrirLeJeu(page);
  const brusque = await virage(page, 'bec', 1);
  const progressif = await virage(page, 'bec', 0.3);
  expect(brusque.mode).toBe('race');
  expect(brusque.maxDerapage, 'dérapage dans le virage brusque').toBeGreaterThan(0.3);
  expect(progressif.maxDerapage, 'pas de dérapage dans le virage progressif').toBe(0);
  expect(brusque.kmh, 'vitesse après le virage brusque').toBeLessThan(progressif.kmh);
});

test('Les Tante Rhéa dérapent moins que Les Neige d\'en Haut', async ({ page }) => {
  await ouvrirLeJeu(page);
  const rhea = await virage(page, 'rhea', 1);
  const neige = await virage(page, 'fourcade', 1);
  expect(rhea.kmh).toBeGreaterThan(neige.kmh);
});
