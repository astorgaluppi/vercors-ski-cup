// Pilote automatique pour les tests.
//
// Ce fichier n'est PAS chargé par le jeu : seuls les tests l'ajoutent dans la page.
// Il joue une descente complète à la place d'un joueur, en se servant uniquement de
// la « porte d'entrée » prévue pour les tests en bas de js/game.js : l'objet window.PTPSC.
//
// Principe, image par image (120 images par seconde de jeu, comme le vrai jeu) :
//   1. il regarde un peu plus bas sur la piste et essaie une trentaine de points d'arrivée
//      possibles, d'un bord à l'autre ;
//   2. pour chaque point, il imagine la trajectoire en ligne droite et donne une « note de danger »
//      si elle passe près d'un obstacle (plaque de terre, chasse-neige, école de ski,
//      biathlète, sac des Frères Lhuillier, bosse quand il va vite) ;
//   3. il vise le point le moins dangereux et règle sa vitesse (schuss, normal ou chasse-neige)
//      selon le secteur ;
//   4. il avance le jeu d'une image avec PTPSC.step, exactement comme le fait la boucle du jeu.
//
// Le pilote ne triche pas : il ne déplace jamais le skieur lui-même, il ne fait que
// « tenir les manettes » (PTPSC.input.override = gauche/droite, schuss, chasse-neige).
(() => {
  const KMH = 1 / 3.6;            // km/h -> m/s
  const IMAGE = 1 / 120;          // durée d'une image de jeu (s), la même que dans game.js

  function descendre(options = {}) {
    const G = window.PTPSC;
    const S = G.state, T = G.track, P = window.PISTE_V1, CFG = G.cfg;
    const dureeMax = options.dureeMax || 200; // secondes de jeu, au-delà on arrête (sécurité)

    if (options.ski) G.setSki(options.ski);
    G.resetRace();
    G.input.override = { steer: 0, tuck: false, brake: false };

    let cible = S.x;               // point visé à l'image précédente (pour ne pas zigzaguer sans arrêt)
    let images = 0;
    let dernierSens = 1;           // dernier côté vers lequel on a tourné (-1 gauche, 1 droite)
    const etapes = [];             // quelques positions notées en route, utiles si un test échoue

    const dansUnChamp = (y) => P.champsDeBosses.some((f) => y > f.debut - 12 && y < f.debut + f.longueur + 2);

    // Virage de la piste dans les « distance » mètres qui viennent ? (changement d'angle, en degrés)
    function virageDevant(y, distance) {
      const a0 = T.angle(y);
      let max = 0;
      for (let d = 2; d <= distance; d += 2) max = Math.max(max, Math.abs(T.angle(y + d) - a0));
      return max * 180 / Math.PI;
    }

    // Note de danger d'un point (x, y) que le skieur atteindra dans « dt » secondes.
    function danger(x, y, dt) {
      let note = 0;
      const pres = (d, rayon) => { if (d < rayon) note += 100 * (rayon - d) / rayon; };

      // bords de la piste (les sapins)
      const bord = T.halfW(y) - Math.abs(x - T.center(y));
      if (bord < 1.4) note += 60 * (1.4 - bord);

      // plaques de terre (forme ovale)
      for (const m of G.muds) {
        if (Math.abs(m.y - y) > 6) continue;
        const qx = (x - m.x) / (m.rx * CFG.mudHitMul + 0.9), qy = (y - m.y) / (m.ry * CFG.mudHitMul + 0.9);
        const q = Math.hypot(qx, qy);
        if (q < 1) note += 100 * (1 - q);
      }
      // chasse-neige garés de biais : on teste plusieurs points le long de l'engin
      for (const e of G.plows) {
        if (Math.abs(e.y - y) > CFG.plowL) continue;
        for (let s = -0.5; s <= 0.5; s += 0.125) {
          const ex = e.x + s * CFG.plowL * Math.sin(e.phi), ey = e.y + s * CFG.plowL * Math.cos(e.phi);
          pres(Math.hypot(x - ex, y - ey), CFG.plowW / 2 + 1.2);
        }
      }
      // école de ski : on calcule où seront le moniteur et les enfants dans dt secondes
      if (G.ecole) {
        const E = G.ecole.E;
        const vy = Math.max(2, S.v);
        const attente = Math.max(0, (E.depart - S.y) / vy);  // temps avant que l'école se mette en route
        const tEcole = (S.schoolT || 0) + Math.max(0, dt - attente);
        for (const k of G.ecole.positions(tEcole)) {
          if (Math.abs(k.y - y) > 4) continue;
          pres(Math.hypot(x - k.x, y - k.y), k.m.hit + 0.6);
        }
      }
      // biathlète : il remonte vers nous et se décale vers nous (au pire, de toute sa vitesse de côté)
      if (G.biathlete) {
        const b = S.bia, B = G.biathlete.B;
        const by = b.y - B.vitesse * KMH * dt;
        if (Math.abs(by - y) < 4) {
          const pas = B.lateral * KMH * dt;
          const bx = b.x + Math.max(-pas, Math.min(pas, x - b.x));
          pres(Math.hypot((x - bx) * 0.9, y - by), 2.6);
        }
      }
      // bosses : seulement si on va vite (à moins de 50 km/h une bosse ralentit sans faire tomber)
      if (S.v > CFG.bumpFallSpeed * 0.9) {
        for (const b of G.bumps) {
          if (b.hit || Math.abs(b.y - y) > 2) continue;
          pres(Math.hypot(x - b.x, (y - b.y) * 1.2), 1.6);
        }
      }
      return note;
    }

    while (images < dureeMax * 120) {
      if (S.mode === 'race') {
        const vy = Math.max(2, S.v * Math.cos(S.th));
        const devant = Math.max(5, S.v * 0.9);
        const ya = S.y + devant;
        const c = T.center(ya), hw = T.halfW(ya) - 1.6;

        // on essaie 31 points d'arrivée possibles, d'un bord à l'autre
        let meilleur = cible, meilleureNote = Infinity;
        for (let i = 0; i <= 30; i++) {
          const x = c - hw + (2 * hw) * i / 30;
          let note = 0.08 * Math.abs(x - c) + 0.15 * Math.abs(x - cible);
          for (let k = 1; k <= 8; k++) {
            const f = k / 8;
            const px = S.x + (x - S.x) * f, py = S.y + devant * f;
            note += danger(px, py, (py - S.y) / vy);
          }
          // sacs des Frères Lhuillier déjà lancés : on regarde où l'on sera au moment précis où chacun tombe
          if (G.lhuillier && S.lhu) {
            for (const sac of S.lhu.bags) {
              if (sac.landed) continue;
              const tombe = sac.t1 - S.lhu.t;
              const px = S.x + (x - S.x) * tombe * vy / devant, py = S.y + vy * tombe;
              const d = Math.hypot(px - sac.tx, (py - sac.ty) * 1.25), rayon = G.lhuillier.L.rayon + 1.5;
              if (d < rayon) note += 300 * (rayon - d) / rayon;
            }
          }
          if (note < meilleureNote) { meilleureNote = note; meilleur = x; }
        }
        cible = meilleur;

        // direction : on tourne vers le point visé
        const cap = Math.atan2(cible - S.x, devant);
        let steer = Math.max(-1, Math.min(1, (cap - S.th) * 3 + cap / CFG.maxAngle));
        // Avec « Les Neige d'en Haut », relâcher la direction puis la redonner trop vite fait une
        // « faute de carre » : le pilote garde donc toujours un tout petit peu de direction.
        if (options.ski === 'fourcade' && Math.abs(steer) < 0.16) steer = 0.16 * (Math.sign(steer || dernierSens) || 1);
        if (Math.abs(steer) > 0.15) dernierSens = Math.sign(steer);

        // vitesse : prudence dans les champs de bosses, près des obstacles qui bougent et dans la neige lourde
        let vVoulue = 85;
        if (dansUnChamp(S.y + devant) || dansUnChamp(S.y)) vVoulue = 42;
        if (G.ecole && S.y > G.ecole.E.depart && S.y < G.ecole.E.debut + 60) vVoulue = 35;
        if (G.biathlete && S.bia.y > S.y - 2 && S.bia.y - S.y < 60) vVoulue = 45;
        if (G.lhuillier && S.y > G.lhuillier.L.depart && S.y < G.lhuillier.L.fin + 5) vVoulue = 45;
        if (P.neigeLourde && S.y > P.neigeLourde.debut - 10) vVoulue = 40;
        if (virageDevant(S.y, 35) > 10) vVoulue = Math.min(vVoulue, 50);
        if (meilleureNote > 20) vVoulue = Math.min(vVoulue, 35);
        const v = S.v / KMH;
        G.input.override = { steer, tuck: v < vVoulue - 3 && vVoulue > 55, brake: v > vVoulue + 2 };
      }

      G.step(IMAGE);
      images++;
      if (images % 120 === 0) etapes.push({ t: +(images / 120).toFixed(1), y: +S.y.toFixed(1), x: +S.x.toFixed(1), kmh: Math.round(S.v / KMH), mode: S.mode });

      // fin de la descente : écran des résultats (après l'arrivée), chute ou hors délai
      if (S.mode === 'results' || S.mode === 'fallen' || S.mode === 'timeout') break;
    }

    G.input.override = null;
    return {
      mode: S.mode,
      chute: S.mode === 'fallen' ? S.fallReason : null,
      y: S.y,
      tempsFinal: S.finalTime,
      intermediaires: S.splits.slice(),
      etapes
    };
  }

  window.PiloteAutomatique = { descendre };
})();
