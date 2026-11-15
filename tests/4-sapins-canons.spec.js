// Test n°4 : les sapins cachés dans le nuage des canons à neige (« sapinsCanons » dans js/piste.js).
//
// On vérifie :
//   a) qu'il y a bien le nombre de sapins demandé, tous entre « debut » et « fin », sur la piste ;
//   b) que deux sapins ne sont jamais plus proches que « ecartMin » (on peut toujours passer entre eux) ;
//   c) qu'ils sont les mêmes à chaque chargement du jeu (même hasard pour tout le monde) ;
//   d) que foncer droit sur un sapin fait tomber, avec la cause « Dans les sapins ».
const { test, expect } = require('@playwright/test');
const { ouvrirLeJeu } = require('./outils/ouvrir-le-jeu');

async function lireLesSapins(page) {
  return page.evaluate(() => {
    const G = window.PTPSC, T = G.track;
    return {
      zone: window.PISTE_V1.sapinsCanons,
      sapins: G.pisteTrees.map((t) => ({ x: t.x, y: t.y, decalage: t.x - T.center(t.y), demiLargeur: T.halfW(t.y) }))
    };
  });
}

test('5 ou 6 sapins sur la piste, dans le nuage des canons, bien espacés', async ({ page }) => {
  await ouvrirLeJeu(page);
  const { zone, sapins } = await lireLesSapins(page);
  expect(zone.nombre, 'nombre de sapins demandé dans piste.js').toBeGreaterThanOrEqual(5);
  expect(zone.nombre).toBeLessThanOrEqual(6);
  expect(sapins.length, 'nombre de sapins plantés').toBe(zone.nombre);
  for (const s of sapins) {
    expect(s.y, `sapin à ${s.y.toFixed(0)} m`).toBeGreaterThanOrEqual(zone.debut);
    expect(s.y, `sapin à ${s.y.toFixed(0)} m`).toBeLessThanOrEqual(zone.fin);
    expect(Math.abs(s.decalage), `sapin à ${s.y.toFixed(0)} m : sur la piste`).toBeLessThan(s.demiLargeur);
  }
  for (let i = 0; i < sapins.length; i++) {
    for (let j = i + 1; j < sapins.length; j++) {
      const d = Math.hypot(sapins[i].x - sapins[j].x, sapins[i].y - sapins[j].y);
      expect(d, `sapins à ${sapins[i].y.toFixed(0)} m et ${sapins[j].y.toFixed(0)} m`).toBeGreaterThanOrEqual(zone.ecartMin);
    }
  }
});

test('les sapins sont les mêmes à chaque partie', async ({ page }) => {
  await ouvrirLeJeu(page);
  const avant = (await lireLesSapins(page)).sapins;
  await page.reload();
  await page.waitForFunction(() => window.PTPSC && window.PISTE_V1);
  const apres = (await lireLesSapins(page)).sapins;
  expect(apres).toEqual(avant);
});

test('foncer sur un sapin fait tomber', async ({ page }) => {
  await ouvrirLeJeu(page);
  const resultat = await page.evaluate(() => {
    const G = window.PTPSC, S = G.state;
    const t = G.pisteTrees[0];
    G.resetRace();
    G.input.override = { steer: 0, tuck: false, brake: false };
    // on pose le skieur juste au-dessus du sapin, tout droit vers lui
    S.mode = 'race'; S.y = t.y - 3; S.x = t.x; S.th = 0; S.v = 30 / 3.6;
    for (let i = 0; i < 240 && S.mode === 'race'; i++) G.step(1 / 120);
    G.input.override = null;
    return { mode: S.mode, chute: S.fallReason };
  });
  expect(resultat.mode).toBe('fallen');
  expect(resultat.chute).toBe('arbre');
});
