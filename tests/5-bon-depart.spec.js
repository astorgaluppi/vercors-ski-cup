// Test n°5 : « Quel départ ! » — appuyer vers le bas pile au « Partez ! » donne un bonus de vitesse au départ,
// sauf avec « Les Tante Rhéa ». Appuyer trop tôt (ou tenir la flèche depuis le début) ne donne rien.
const { test, expect } = require('@playwright/test');
const { ouvrirLeJeu } = require('./outils/ouvrir-le-jeu');

// Lance une course, appuie vers le bas « decalage » secondes après le « Partez ! » (négatif = avant),
// et renvoie la vitesse (km/h) 0,3 s après le « Partez ! », ainsi que la bannière affichée.
async function depart(page, ski, decalage) {
  return page.evaluate(([ski, decalage]) => {
    const G = window.PTPSC, S = G.state, IMAGE = 1 / 120;
    G.setSki(ski);
    G.resetRace();
    G.input.override = { steer: 0, tuck: false, brake: false };
    let t = -3; // le « Partez ! » arrive 3 s après le début du compte à rebours
    let banniere = null;
    while (t < 0.3) {
      if (t >= decalage) G.input.override = { steer: 0, tuck: true, brake: false };
      G.step(IMAGE);
      t += IMAGE;
      if (S.banner) banniere = S.banner.text;
    }
    G.input.override = null;
    return { kmh: S.v * 3.6, banniere, bonus: S.bonDepart };
  }, [ski, decalage]);
}

test('appuyer pile au « Partez ! » donne « Quel départ ! » et plus de vitesse', async ({ page }) => {
  await ouvrirLeJeu(page);
  const bon = await depart(page, 'bec', 0.05);
  const tard = await depart(page, 'bec', 0.6);
  expect(bon.bonus).toBe(true);
  expect(bon.banniere).toBe('Quel départ !');
  expect(tard.bonus).toBe(false);
  expect(bon.kmh, 'vitesse avec le bon départ').toBeGreaterThan(tard.kmh + 10);
});

test('juste avant le « Partez ! », ça compte aussi', async ({ page }) => {
  await ouvrirLeJeu(page);
  expect((await depart(page, 'fourcade', -0.1)).bonus).toBe(true);
});

test('appuyer trop tôt ne donne pas de bonus', async ({ page }) => {
  await ouvrirLeJeu(page);
  expect((await depart(page, 'bec', -1)).bonus).toBe(false);
});

test('pas de bonus avec Les Tante Rhéa', async ({ page }) => {
  await ouvrirLeJeu(page);
  const r = await depart(page, 'rhea', 0.05);
  expect(r.bonus).toBe(false);
  expect(r.banniere).not.toBe('Quel départ !');
});
