// Test n°2 : les champs de bosses respectent les règles écrites dans js/piste.js.
//
// Pour chaque champ (« champsDeBosses » dans piste.js), on vérifie :
//   a) qu'il y a exactement le nombre de bosses demandé (« nombre ») ;
//   b) que chaque couloir (bande verticale de la piste) a le même nombre de bosses (« couloirs ») ;
//   c) que deux bosses ne sont jamais plus proches que « ecartMin » mètres ;
//   d) qu'on ne peut pas traverser le champ tout droit, dans le sens de la piste, sans toucher de bosse.
//
// Les bosses sont placées « au hasard », mais c'est un hasard fixé d'avance (le même pour tout le monde) :
// le résultat est donc toujours le même, et le test aussi.
const { test, expect } = require('@playwright/test');
const { ouvrirLeJeu } = require('./outils/ouvrir-le-jeu');

// On récupère, dans la page, les bosses de chaque champ et ce qu'il faut pour les mesurer.
async function lireLesChamps(page) {
  return page.evaluate(() => {
    const G = window.PTPSC, T = G.track;
    return window.PISTE_V1.champsDeBosses.map((champ) => {
      const bosses = G.bumps
        .filter((b) => b.y >= champ.debut && b.y <= champ.debut + champ.longueur)
        .map((b) => ({
          x: b.x, y: b.y,
          // position en travers par rapport au milieu de la piste (0 = milieu, en mètres)
          decalage: b.x - T.center(b.y),
          demiLargeur: T.halfW(b.y),
          // rayon dans lequel on touche la bosse (même calcul que dans game.js)
          rayonContact: G.cfg.bumpHitRadius * b.r / G.cfg.bumpRadius
        }));
      return { champ, bosses, margeSapins: G.cfg.edgeMargin };
    });
  });
}

test('chaque champ a le bon nombre de bosses', async ({ page }) => {
  await ouvrirLeJeu(page);
  for (const { champ, bosses } of await lireLesChamps(page)) {
    expect(bosses.length, `champ de bosses à ${champ.debut} m`).toBe(champ.nombre);
  }
});

test('les bosses sont réparties de la même façon dans chaque couloir', async ({ page }) => {
  await ouvrirLeJeu(page);
  for (const { champ, bosses } of await lireLesChamps(page)) {
    // même découpage en couloirs que dans game.js : la piste moins 0,2 m de chaque côté
    const parCouloir = new Array(champ.couloirs).fill(0);
    for (const b of bosses) {
      const largeurCouloir = (2 * b.demiLargeur - 0.4) / champ.couloirs;
      const numero = Math.floor((b.decalage + b.demiLargeur - 0.2) / largeurCouloir);
      parCouloir[numero]++;
    }
    // ex. 24 bosses pour 8 couloirs -> 3 par couloir ; si la division ne tombe pas juste, 1 d'écart au plus
    const min = Math.floor(champ.nombre / champ.couloirs), max = Math.ceil(champ.nombre / champ.couloirs);
    for (const [numero, n] of parCouloir.entries()) {
      expect(n, `champ à ${champ.debut} m, couloir n°${numero + 1} (bosses par couloir : ${parCouloir.join(', ')})`)
        .toBeGreaterThanOrEqual(min);
      expect(n, `champ à ${champ.debut} m, couloir n°${numero + 1} (bosses par couloir : ${parCouloir.join(', ')})`)
        .toBeLessThanOrEqual(max);
    }
  }
});

test('deux bosses ne sont jamais plus proches que ecartMin', async ({ page }) => {
  await ouvrirLeJeu(page);
  for (const { champ, bosses } of await lireLesChamps(page)) {
    for (let i = 0; i < bosses.length; i++) {
      for (let j = i + 1; j < bosses.length; j++) {
        const distance = Math.hypot(bosses[i].x - bosses[j].x, bosses[i].y - bosses[j].y);
        expect(distance, `champ à ${champ.debut} m : bosses à ${bosses[i].y.toFixed(1)} m et ${bosses[j].y.toFixed(1)} m`)
          .toBeGreaterThanOrEqual(champ.ecartMin);
      }
    }
  }
});

test('aucune ligne droite ne traverse un champ sans toucher de bosse', async ({ page }) => {
  await ouvrirLeJeu(page);
  for (const { champ, bosses, margeSapins } of await lireLesChamps(page)) {
    // On essaie toutes les lignes droites dans le sens de la piste, tous les 5 cm, d'un bord à l'autre
    // (sans compter la bande au ras des sapins, où l'on tombe de toute façon).
    // Une ligne est « libre » si elle passe à côté de toutes les bosses.
    const demiLargeur = bosses[0].demiLargeur - margeSapins;
    const libres = [];
    for (let d = -demiLargeur; d <= demiLargeur; d += 0.05) {
      const toucheUneBosse = bosses.some((b) => Math.abs(b.decalage - d) < b.rayonContact);
      if (!toucheUneBosse) libres.push(`${d.toFixed(2)} m`);
    }
    expect(libres, `champ à ${champ.debut} m : lignes droites libres (décalage depuis le milieu de la piste)`).toEqual([]);
  }
});
