// Pas Très Pentu Ski Cup — V4
// Jeu 2D en Canvas, sans dépendance. Le skieur est en haut de l'écran,
// la piste défile vers le haut et les obstacles arrivent par le bas.
(() => {
  'use strict';

  const DEG = Math.PI / 180;
  const KMH = 1 / 3.6; // km/h -> m/s

  // ---------- Réglages (valeurs de la spec, à ajuster en jouant) ----------
  const CFG = {
    timeLimit: 120,
    screenMeters: 34,          // largeur de piste visible à l'écran
    skierScreenFrac: 0.27,     // skieur dans le tiers haut
    skierPx: 50,               // hauteur du skieur à l'écran (px)
    maxAngle: 70 * DEG,
    slopeAcc: 4 * KMH, slopeMax: 55 * KMH,
    schussAcc: 8 * KMH, schussMax: 90 * KMH,
    brakeDec: 15 * KMH, brakeMin: 10 * KMH,
    overDec: 3 * KMH,          // retour progressif à 50 km/h quand on quitte le schuss
    grip: 22,                  // adhérence latérale a (m/s²) : R = v²/a
    brakeGripMul: 1.5,
    maxTurnRate: 4.5,          // rad/s, à très basse vitesse
    startSpeed: 8 * KMH,
    bumpRadius: 1.15,
    bumpHitRadius: 0.95,
    bumpFallAngle: 30 * DEG,
    bumpFallSpeed: 50 * KMH,
    bumpLoss: 5 * KMH,
    edgeMargin: 0.15,
    startY: -9, gateY: -6.5,
    stopRadius: 24, stopOffset: 32,
    skidDec: 45 * KMH,
    bannerTime: 2, bannerCooldown: 5, bannerLead: 1.5, splitShowTime: 3,
    // V2 : chasse-neige garés (taille en m, angle de biais)
    plowScale: 1.8,            // taille des chasse-neige (1 = taille réelle d'une dameuse moyenne)
    plowW: 3.4 * 1.8, plowL: 6.8 * 1.8, plowAngle: 28 * DEG, plowMargin: 0.3,
    // V2 : « La soupe et les cailloux » (neige lourde + plaques de terre)
    heavyGripMul: 0.65,        // adhérence réduite : virages plus larges
    heavySpeedMul: 0.85,       // vitesses maximales réduites de 15 %
    heavyDec: 6 * KMH,         // freinage naturel jusqu'à la nouvelle vitesse maximale
    mudHitMul: 0.82            // zone de chute un peu plus petite que la plaque dessinée
  };

  const P = window.PISTE_V1;

  // V3 : les trois paires de skis (vitesse max en schuss, vitesse min en chasse-neige, adhérence dans les virages)
  const SKIS = [
    { id: 'rhea', nom: 'Tante Rhéa', devise: 'rustiques mais efficaces', max: 75, min: 5, grip: 1.3,
      look: { ski: '#b5793a', skiTip: '#7a4a1e' } },
    { id: 'bec', nom: 'Madame Bec', devise: 'hors de prix mais plutôt polyvalents', max: 90, min: 10, grip: 1,
      look: { ski: '#e53935', skiTip: '#ffca28' } },
    { id: 'fourcade', nom: 'Père Fourcade', devise: 'le haut de gamme mais ils se méritent…', max: 100, min: 15, grip: 0.8,
      // faute de carre : au-dessus de 40 km/h, relâcher puis redonner la même direction en moins de 0,5 s fait tomber
      carre: { vitesse: 40, delai: 0.5 },
      look: { ski: '#15171c', skiTip: '#00e5ff' } }
  ];
  let ski = SKIS[1]; // Madame Bec présélectionné

  const FINISH = P.longueur;

  // ---------- Hasard déterministe (même décor pour tous) ----------
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  // ---------- Construction du tracé ----------
  const TRACK = (() => {
    const step = 0.5, y0 = -80;
    const total = P.troncons.reduce((a, t) => a + t.longueur, 0);
    const y1 = Math.max(total, FINISH + CFG.stopOffset + CFG.stopRadius + 60);
    const n = Math.ceil((y1 - y0) / step) + 1;
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = y0 + i * step;
      let acc = 0, ang = 0;
      for (const t of P.troncons) {
        if (y >= acc && y < acc + t.longueur) { ang = t.angle; break; }
        acc += t.longueur;
      }
      raw[i] = ang * DEG;
    }
    // Lissage : virages arrondis, jamais d'angle droit (2 passes de moyenne glissante de 18 m)
    const smooth = (src, win) => {
      const out = new Float32Array(n), h = Math.round(win / step / 2);
      let sum = 0;
      const get = (k) => src[Math.min(n - 1, Math.max(0, k))];
      for (let k = -h; k <= h; k++) sum += get(k);
      for (let i = 0; i < n; i++) {
        out[i] = sum / (2 * h + 1);
        sum += get(i + h + 1) - get(i - h);
      }
      return out;
    };
    const ang = smooth(smooth(raw, 18), 18);
    const cx = new Float32Array(n);
    for (let i = 1; i < n; i++) cx[i] = cx[i - 1] + Math.tan((ang[i] + ang[i - 1]) / 2) * step;
    const off = cx[Math.round((0 - y0) / step)];
    for (let i = 0; i < n; i++) cx[i] -= off;
    const idx = (y) => {
      const f = (y - y0) / step;
      const i = Math.max(0, Math.min(n - 2, Math.floor(f)));
      return [i, Math.max(0, Math.min(1, f - i))];
    };
    return {
      center(y) { const [i, t] = idx(y); return cx[i] + (cx[i + 1] - cx[i]) * t; },
      angle(y) { const [i, t] = idx(y); return ang[i] + (ang[i + 1] - ang[i]) * t; },
      halfW(y) { return (P.largeur / 2) / Math.cos(this.angle(y)); },
      y0, y1
    };
  })();

  const STOP = { x: TRACK.center(FINISH + CFG.stopOffset), y: FINISH + CFG.stopOffset, r: CFG.stopRadius };
  const inStopZone = (x, y, extra) => Math.hypot(x - STOP.x, y - STOP.y) < STOP.r + extra;

  // ---------- Objets du décor (statiques, triés par y) ----------
  const trees = [];
  (() => {
    let k = 0;
    for (let y = TRACK.y0 + 4; y < TRACK.y1; y += 2.6) {
      for (const side of [-1, 1]) {
        k++;
        const c = TRACK.center(y), hw = TRACK.halfW(y);
        const x = c + side * (hw + 1.25 + hash(k) * 0.5);
        if (y > FINISH - 6 && inStopZone(x, y, 7)) continue;
        if (y > FINISH - 2 && y < STOP.y + STOP.r + 4 && Math.abs(x - STOP.x) < STOP.r + 6) continue;
        trees.push({ x, y: y + (hash(k + 0.5) - 0.5) * 0.8, s: 0.92 + hash(k * 3.1) * 0.22, v: k % 3 });
      }
    }
    for (let y = TRACK.y0; y < TRACK.y1; y += 3.4) {
      for (const side of [-1, 1]) {
        for (let j = 0; j < 4; j++) {
          k++;
          if (hash(k * 1.7) < 0.25) continue;
          const c = TRACK.center(y), hw = TRACK.halfW(y);
          const x = c + side * (hw + 3.6 + hash(k) * 22);
          const yy = y + hash(k * 2.3) * 3.4;
          if (yy > FINISH - 10 && inStopZone(x, yy, 9)) continue;
          trees.push({ x, y: yy, s: 0.8 + hash(k * 5.3) * 0.45, v: k % 3 });
        }
      }
    }
    trees.sort((a, b) => a.y - b.y);
  })();

  const bumps = [];
  (() => {
    // V3.1 : bosses réparties au hasard (le même hasard pour tout le monde) et isolées les unes des autres.
    // Pour que personne ne traverse un champ tout droit, une partie des bosses est placée en « couloirs » :
    // chaque bande verticale de la piste reçoit au moins une bosse, à une hauteur tirée au hasard.
    for (const [fi, f] of P.champsDeBosses.entries()) {
      let seed = 1000 + fi * 977;
      const rnd = () => hash(seed++);
      const placed = [];
      const lanes = f.couloirs || 14, margin = 0.9;
      const ok = (x, y, d) => placed.every((b) => Math.hypot(b.x - x, b.y - y) >= d);
      const add = (xOf, rFix) => {
        for (let d = f.ecartMin; d > 1.5; d -= 0.25) {
          for (let tries = 0; tries < 300; tries++) {
            const y = f.debut + rnd() * f.longueur;
            const c = TRACK.center(y), hw = TRACK.halfW(y);
            const x = c + xOf(hw);
            if (ok(x, y, d)) { placed.push({ x, y, r: CFG.bumpRadius * (rFix ? 1 + rnd() * 0.1 : 0.9 + rnd() * 0.2), hit: false }); return; }
          }
        }
      };
      // un couloir après l'autre, dans un ordre mélangé
      const order = Array.from({ length: lanes }, (_, k) => k).sort(() => rnd() - 0.5);
      for (const k of order) add((hw) => -hw + 0.2 + (k + 0.5) * (2 * hw - 0.4) / lanes + (rnd() - 0.5) * 0.2, true);
      for (let n = lanes; n < f.nombre; n++) add((hw) => -hw + margin + rnd() * (2 * hw - 2 * margin), false);
      bumps.push(...placed);
    }
    // V4.1 : quelques bosses isolées, cachées dans le nuage des canons à neige
    for (const b of P.bossesIsolees || []) {
      bumps.push({ x: TRACK.center(b.y) + b.x * TRACK.halfW(b.y), y: b.y, r: CFG.bumpRadius, hit: false });
    }
    bumps.sort((a, b) => a.y - b.y);
  })();

  // V2 : chasse-neige garés de biais, en chicane
  const plows = (P.chasseNeige || []).map((e) => {
    const c = TRACK.center(e.y), hw = TRACK.halfW(e.y);
    const phi = -e.cote * CFG.plowAngle; // l'avant (la lame) pointe vers le milieu de la piste, vers le bas
    const ext = (CFG.plowW / 2) * Math.cos(phi) + (CFG.plowL / 2) * Math.abs(Math.sin(phi));
    return { x: c + e.cote * (hw - ext - 0.2), y: e.y, phi };
  });

  // V3 : école de ski. Le chemin du moniteur est calculé d'avance (zigzag arrondi d'un bord à l'autre),
  // avec sa longueur, pour avancer à vitesse constante ; les enfants suivent le même chemin, en file.
  const ECOLE = (() => {
    const E = P.ecoleDeSki;
    if (!E) return null;
    const pts = [], n = 2400, turns = 12; // 12 traversées, bien plus que nécessaire
    let len = 0, px = 0, py = 0;
    for (let i = 0; i <= n; i++) {
      const ph = i / n * turns * Math.PI;
      const y = E.debut + E.descente * ph / Math.PI;
      const x = TRACK.center(y) - Math.cos(ph) * (TRACK.halfW(y) - E.marge);
      if (i) len += Math.hypot(x - px, y - py);
      pts.push({ x, y, s: len });
      px = x; py = y;
    }
    const at = (sv) => {
      sv = Math.max(0, Math.min(len - 0.01, sv));
      let lo = 0, hi = pts.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= sv) lo = m; else hi = m; }
      const a = pts[lo], b = pts[hi], t = (sv - a.s) / Math.max(1e-6, b.s - a.s);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, th: Math.atan2(b.x - a.x, b.y - a.y) };
    };
    const kidCols = ['#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#00acc1', '#f06292', '#7cb342'];
    const helmets = ['#1e88e5', '#e53935', '#fdd835', '#ffffff', '#43a047', '#f06292', '#fb8c00', '#212121'];
    const skins = ['#f1c27d', '#e0ac69', '#8d5524', '#c68642', '#ffdbac', '#a0673a'];
    const members = [];
    const nKids = E.enfants || 8;
    for (let i = 0; i <= nKids; i++) {
      const kid = i > 0;
      const sk = skins[(i * 5) % skins.length];
      const col = kidCols[(i * 3) % kidCols.length];
      members.push({
        kid, r: kid ? 0.8 : 1.0, hit: kid ? 1.35 : 1.6, px: kid ? 34 : 48,
        look: kid
          // enfants : combinaison de ski d'une seule couleur, gants et casque
          ? { jersey: col, jerseyDark: col, trim: col, legs: col, arms: col, gloves: '#263238', helmet: helmets[(i * 3) % helmets.length],
              noNumber: true, skin: sk, skinDark: sk, ski: kidCols[(i * 3 + 2) % 8], skiTip: '#ffffff' }
          // moniteur : combinaison intégrale rouge à motifs blancs, bonnet rouge, lunettes de soleil, pas de sourire
          : { jersey: '#d32f2f', jerseyDark: '#9a1f1f', trim: '#ffffff', legs: '#d32f2f', arms: '#d32f2f', gloves: '#212121',
              motif: '#ffffff', helmet: '#c62828', beanie: true, beanieTrim: '#ffffff', glasses: true, serious: true, noNumber: true,
              skin: '#e0ac69', skinDark: '#c68642', ski: '#212121', skiTip: '#d32f2f' }
      });
    }
    return {
      E, members,
      // positions du moniteur et des enfants au temps t (s) depuis la mise en route
      positions(t) {
        const lead = (members.length - 1) * E.ecart + E.vitesse * KMH * t;
        return members.map((m, i) => Object.assign({ m }, at(lead - i * E.ecart)));
      }
    };
  })();

  // V4 : canons à neige, au bord de la piste, tournés vers le milieu
  const CANONS = (() => {
    const C = P.canonsANeige;
    if (!C) return null;
    const list = C.canons.map((c) => {
      const hw = TRACK.halfW(c.y);
      return { x: TRACK.center(c.y) + c.cote * (hw + 0.9), y: c.y, cote: c.cote };
    });
    return { C, list, top: Math.min(...list.map((c) => c.y)), bot: Math.max(...list.map((c) => c.y)) };
  })();
  // force du nuage (0..1) t secondes après la mise en marche : il monte en 1 s et se dissipe en 1,2 s
  const fogLevel = (t) => {
    if (!CANONS || t < 0 || t > CANONS.C.duree) return 0;
    return Math.max(0, Math.min(1, t / 1, (CANONS.C.duree - t) / 1.2));
  };

  // V4 : le biathlète remonte la piste à contresens. V4.1 : tant qu'il est devant le joueur (plus bas que lui),
  // il se décale vers lui pour lui foncer dessus, à vitesse de côté limitée : on peut l'esquiver en tournant.
  const BIATH = (() => {
    const B = P.biathlete;
    if (!B) return null;
    return {
      B,
      // état de départ : bx = position en travers sans le balancement du pas ; ph : phase du pas de patineur
      init() { return { t: 0, bx: TRACK.center(B.debut), x: TRACK.center(B.debut), y: B.debut, ph: 0 }; },
      update(b, dt, px, py) {
        b.t += dt;
        b.y = B.debut - B.vitesse * KMH * b.t;
        b.ph = b.t * Math.PI * 2 * 0.75;
        const c = TRACK.center(b.y), hw = TRACK.halfW(b.y) - 1.2;
        if (b.y > py) {
          const aim = Math.max(c - hw, Math.min(c + hw, px));
          const maxd = B.lateral * KMH * dt;
          b.bx += Math.max(-maxd, Math.min(maxd, aim - b.bx));
        }
        b.bx = Math.max(c - hw, Math.min(c + hw, b.bx));
        b.x = b.bx + Math.sin(b.ph) * 0.35;
      }
    };
  })();

  // V4 : les Frères Lhuillier, un de chaque côté, juste devant les sapins
  const LHU = (() => {
    const L = P.lhuillier;
    if (!L) return null;
    const freres = L.freres.map((f, i) => {
      const c = TRACK.center(f.y), hw = TRACK.halfW(f.y);
      return { y: f.y, cote: f.cote, xIn: c + f.cote * (hw + 0.7), xOut: c + f.cote * (hw + 4), i };
    });
    return { L, freres };
  })();

  // V2 : neige lourde et plaques de terre
  const HEAVY = P.neigeLourde || null;
  const inHeavy = (y) => !!HEAVY && y >= HEAVY.debut && y <= HEAVY.fin;
  const muds = (P.plaquesDeTerre || []).map((m, i) => {
    const c = TRACK.center(m.y), hw = TRACK.halfW(m.y);
    const rx = m.r * 1.25, ry = m.r * 0.8, k = 7000 + i * 50;
    const pts = [];
    const n = 16;
    for (let j = 0; j < n; j++) {
      const a = j / n * Math.PI * 2, f = 0.82 + hash(k + j) * 0.32;
      pts.push([Math.cos(a) * rx * f, Math.sin(a) * ry * f]);
    }
    const stones = [];
    for (let j = 0; j < 7; j++) {
      const a = hash(k + 20 + j) * Math.PI * 2, d = Math.sqrt(hash(k + 30 + j)) * 0.75;
      stones.push({ x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d, r: 0.12 + hash(k + 40 + j) * 0.22, g: j % 3 });
    }
    return { x: c + m.x * hw, y: m.y, rx, ry, pts, stones };
  }).sort((a, b) => a.y - b.y);

  // Public et barrières de l'aire d'arrêt
  const crowd = [], barriers = [];
  (() => {
    const entry = Math.asin(Math.min(1, (P.largeur / 2 + 1) / STOP.r));
    for (let a = 0; a < Math.PI * 2; a += 0.11) {
      // angle 0 = vers le haut de l'écran (entrée de l'aire)
      if (Math.abs(((a + Math.PI) % (2 * Math.PI)) - Math.PI) < entry) continue;
      barriers.push({ x: STOP.x + Math.sin(a) * STOP.r, y: STOP.y - Math.cos(a) * STOP.r, a, b: barriers.length });
    }
    let k = 5000;
    const colors = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00', '#00acc1', '#f06292'];
    const skins = ['#f1c27d', '#e0ac69', '#8d5524', '#c68642', '#ffdbac', '#5a3825'];
    for (let a = 0; a < Math.PI * 2; a += 0.075) {
      if (Math.abs(((a + Math.PI) % (2 * Math.PI)) - Math.PI) < entry + 0.1) continue;
      for (let r = 0; r < 2; r++) {
        k++;
        const rr = STOP.r + 1.6 + r * 1.3 + hash(k) * 0.6;
        crowd.push({ x: STOP.x + Math.sin(a + hash(k * 3) * 0.05) * rr, y: STOP.y - Math.cos(a) * rr, c: colors[k % colors.length], s: skins[(k * 7) % skins.length], ph: hash(k * 11) * 6.28, hat: hash(k * 13) < 0.5 });
      }
    }
  })();

  // ---------- Canvas et mise à l'échelle ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const safeProbe = document.getElementById('safe-probe');
  let W = 0, H = 0, DPR = 1, SCALE = 10, SAFE_TOP = 0;
  let sprites = {};

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    SCALE = W / CFG.screenMeters;
    SAFE_TOP = safeProbe ? parseFloat(getComputedStyle(safeProbe).paddingTop) || 0 : 0;
    buildSprites();
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    const g = c.getContext('2d');
    g.scale(DPR, DPR);
    return [c, g];
  }

  function buildSprites() {
    sprites.trees = [0, 1, 2].map((v) => {
      const w = 3.1 * SCALE, h = 4.6 * SCALE;
      const [c, g] = makeCanvas(w, h + 0.6 * SCALE);
      drawTree(g, w / 2, h, w, h, v);
      return { c, w, h: h + 0.6 * SCALE, ax: w / 2, ay: h };
    });
    const bw = 2.8 * SCALE, bh = 1.9 * SCALE;
    const [bc, bg] = makeCanvas(bw, bh);
    drawBump(bg, bw / 2, bh / 2, CFG.bumpRadius * SCALE);
    sprites.bump = { c: bc, w: bw, h: bh };
  }

  function drawTree(g, x, baseY, w, h, v) {
    // ombre portée
    g.fillStyle = 'rgba(80,110,150,0.22)';
    g.beginPath(); g.ellipse(x + w * 0.12, baseY, w * 0.36, w * 0.12, 0, 0, Math.PI * 2); g.fill();
    // tronc
    g.fillStyle = '#6d4c2f';
    g.fillRect(x - w * 0.06, baseY - h * 0.16, w * 0.12, h * 0.16);
    const greens = [['#1f5e3a', '#174a2d'], ['#22673f', '#18502f'], ['#1b5534', '#134226']][v];
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const top = baseY - h * (0.42 + t * 0.2) - h * 0.38 * (1 - t) * 0;
      const yb = baseY - h * 0.12 - i * h * 0.24;
      const yt = yb - h * 0.42;
      const hw = w * (0.48 - i * 0.11);
      g.fillStyle = greens[0];
      g.beginPath(); g.moveTo(x, yt); g.lineTo(x + hw, yb); g.lineTo(x - hw, yb); g.closePath(); g.fill();
      g.fillStyle = greens[1];
      g.beginPath(); g.moveTo(x, yt); g.lineTo(x + hw, yb); g.lineTo(x + hw * 0.15, yb); g.closePath(); g.fill();
      // neige sur les pointes
      g.fillStyle = '#f4f9ff';
      g.beginPath();
      g.moveTo(x - hw * 0.95, yb);
      g.quadraticCurveTo(x - hw * 0.7, yb - h * 0.07, x - hw * 0.45, yb - h * 0.02);
      g.quadraticCurveTo(x - hw * 0.2, yb - h * 0.08, x + hw * 0.05, yb - h * 0.02);
      g.quadraticCurveTo(x + hw * 0.4, yb - h * 0.08, x + hw * 0.95, yb);
      g.closePath(); g.fill();
      void top;
    }
    g.fillStyle = '#f4f9ff';
    g.beginPath(); g.moveTo(x, baseY - h * 0.99); g.lineTo(x + w * 0.07, baseY - h * 0.88); g.lineTo(x - w * 0.07, baseY - h * 0.88); g.closePath(); g.fill();
  }

  function drawBump(g, x, y, r) {
    g.fillStyle = 'rgba(90,120,170,0.35)';
    g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.28, r * 1.05, r * 0.6, 0, 0, Math.PI * 2); g.fill();
    const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.7, '#e8f0fa');
    grd.addColorStop(1, '#c9d8ec');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(x, y, r, r * 0.68, 0, 0, Math.PI * 2); g.fill();
  }

  // ---------- Le skieur ----------
  // Jeune, sportif, teint très mat, chauve, débardeur de basket n°9, short, grosses chaussures.
  const LOOK = {
    skin: '#c8996c', skinDark: '#a97a50', skinLight: '#dcb48a',
    jersey: '#1d3a8a', jerseyDark: '#152b66', trim: '#ffffff', number: '#ffffff',
    boot: '#2b2f36', bootLight: '#4a5160', buckle: '#c9ced6',
    ski: '#e53935', skiTip: '#ffca28', pole: '#9aa3ad', outline: '#16202e'
  };

  // pose : { theta, crouch 0..1, plow, skid, fallen, lift, t }
  function drawSkier(g, x, y, hPx, pose) {
    const u = hPx / 52;
    const L = pose.look ? Object.assign({}, LOOK, pose.look) : LOOK;
    g.save();
    g.translate(x, y);
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (pose.fallen) { drawFallen(g, u, pose); g.restore(); return; }
    const th = pose.theta || 0;
    const lift = (pose.lift || 0) * u;
    // ombre
    g.fillStyle = 'rgba(60,90,140,0.25)';
    g.beginPath(); g.ellipse(2 * u, 2 * u, 14 * u, 5 * u, 0, 0, Math.PI * 2); g.fill();
    g.translate(0, -lift);

    // skis
    const ski = (fx, ang) => {
      const dx = Math.sin(ang), dy = Math.cos(ang);
      g.strokeStyle = L.outline; g.lineWidth = 5.2 * u;
      g.beginPath(); g.moveTo(fx - dx * 12 * u, -dy * 12 * u); g.lineTo(fx + dx * 19 * u, dy * 19 * u); g.stroke();
      g.strokeStyle = L.ski; g.lineWidth = 3.4 * u;
      g.beginPath(); g.moveTo(fx - dx * 12 * u, -dy * 12 * u); g.lineTo(fx + dx * 16 * u, dy * 16 * u); g.stroke();
      g.strokeStyle = L.skiTip;
      g.beginPath(); g.moveTo(fx + dx * 16 * u, dy * 16 * u); g.lineTo(fx + dx * 19 * u, dy * 19 * u); g.stroke();
    };
    let aL = th, aR = th;
    if (pose.plow) { aL = th - 22 * DEG; aR = th + 22 * DEG; }
    if (pose.skid) { const s = pose.skidSide || 1; aL = aR = Math.max(-90 * DEG, Math.min(90 * DEG, th)) || s * 82 * DEG; }
    const spread = pose.plow ? 7 : 5;
    const lean = Math.sin(th) * 5 * u * (pose.skid ? -0.6 : 1);
    ski(-spread * u, aL);
    ski(spread * u, aR);

    const c = Math.max(0, Math.min(1, pose.crouch || 0));
    const legH = (12 - c * 5) * u;
    const hipY = -8 * u - legH;
    const torsoH = (13 - c * 3) * u;
    const shoulderY = hipY - 8 * u - torsoH + c * 2 * u;
    const bodyX = lean;
    const fwd = c * 3 * u;

    // chaussures (grosses)
    const boot = (bx) => {
      g.fillStyle = L.outline;
      roundRect(g, bx - 5.6 * u, -9.6 * u, 11.2 * u, 11 * u, 3 * u); g.fill();
      g.fillStyle = L.boot;
      roundRect(g, bx - 4.6 * u, -8.6 * u, 9.2 * u, 9 * u, 2.5 * u); g.fill();
      g.fillStyle = L.bootLight;
      roundRect(g, bx - 3.6 * u, -8 * u, 3 * u, 6 * u, 1.5 * u); g.fill();
      g.fillStyle = L.buckle;
      g.fillRect(bx - 4 * u, -6 * u, 8 * u, 1.1 * u);
      g.fillRect(bx - 4 * u, -3.4 * u, 8 * u, 1.1 * u);
    };
    // jambes
    const leg = (fx) => {
      const kx = fx * 0.9 + bodyX * 0.5 + (c ? fx * 0.25 : 0);
      g.strokeStyle = L.outline; g.lineWidth = 6.2 * u;
      g.beginPath(); g.moveTo(fx, -8 * u); g.lineTo(kx, -8 * u - legH * 0.5); g.lineTo(bodyX + fx * 0.6, hipY); g.stroke();
      g.strokeStyle = L.legs || L.skin; g.lineWidth = 4.4 * u;
      g.beginPath(); g.moveTo(fx, -8 * u); g.lineTo(kx, -8 * u - legH * 0.5); g.lineTo(bodyX + fx * 0.6, hipY); g.stroke();
    };
    leg(-spread * u); leg(spread * u);
    boot(-spread * u); boot(spread * u);

    // short de basket
    g.fillStyle = L.outline;
    roundRect(g, bodyX - 9 * u, hipY - 6.5 * u, 18 * u, 10.5 * u, 2.5 * u); g.fill();
    g.fillStyle = L.jersey;
    roundRect(g, bodyX - 8 * u, hipY - 5.5 * u, 16 * u, 8.5 * u, 2 * u); g.fill();
    g.fillStyle = L.trim;
    g.fillRect(bodyX - 8 * u, hipY + 1.6 * u, 3 * u, 1.2 * u);
    g.fillRect(bodyX + 5 * u, hipY + 1.6 * u, 3 * u, 1.2 * u);
    g.fillStyle = L.jerseyDark;
    g.fillRect(bodyX - 0.5 * u, hipY - 1 * u, 1 * u, 4 * u);

    // bras + bâtons (derrière le buste d'un côté, devant de l'autre : simple)
    const sx = bodyX, sy = shoulderY + 2 * u;
    const arm = (side) => {
      if (pose.cheer) {
        // bras levés, bâtons en l'air (le skieur est arrêté dans l'aire d'arrivée)
        const wave = Math.sin((pose.t || 0) * 7 + side) * 1.5 * u;
        const ex = sx + side * 12 * u, ey = sy - 5 * u;
        const hx = sx + side * 14 * u + wave * side, hy = sy - 17 * u;
        g.strokeStyle = L.pole; g.lineWidth = 1.5 * u;
        g.beginPath(); g.moveTo(hx, hy + 2 * u); g.lineTo(hx + side * 6 * u, hy - 16 * u); g.stroke();
        g.strokeStyle = L.outline; g.lineWidth = 5.4 * u;
        g.beginPath(); g.moveTo(sx + side * 7 * u, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
        g.strokeStyle = L.arms || L.skin; g.lineWidth = 3.8 * u;
        g.beginPath(); g.moveTo(sx + side * 7 * u, sy); g.lineTo(ex, ey); g.lineTo(hx, hy); g.stroke();
        g.fillStyle = L.gloves || L.skinDark;
        g.beginPath(); g.arc(hx, hy, 2 * u, 0, Math.PI * 2); g.fill();
        return;
      }
      const hx = sx + side * (c ? 9 : 12) * u + fwd * 0.2;
      const hy = sy + (c ? 9 : 11) * u;
      // bâton
      g.strokeStyle = L.pole; g.lineWidth = 1.5 * u;
      const px = hx + side * (c ? 6 : 3) * u, py = hy + (c ? -2 : 13) * u;
      const ex = c ? hx + side * 14 * u : px, ey = c ? hy - 12 * u : py;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
      if (!c) { g.beginPath(); g.ellipse(px, py, 2.4 * u, 1 * u, 0, 0, Math.PI * 2); g.stroke(); }
      // bras
      g.strokeStyle = L.outline; g.lineWidth = 5.4 * u;
      g.beginPath(); g.moveTo(sx + side * 7 * u, sy); g.lineTo(sx + side * 10.5 * u, sy + 6 * u); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = L.arms || L.skin; g.lineWidth = 3.8 * u;
      g.beginPath(); g.moveTo(sx + side * 7 * u, sy); g.lineTo(sx + side * 10.5 * u, sy + 6 * u); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = L.gloves || L.skinDark;
      g.beginPath(); g.arc(hx, hy, 2 * u, 0, Math.PI * 2); g.fill();
    };
    arm(-1); arm(1);

    // débardeur
    const ty = shoulderY, tb = hipY - 4 * u;
    g.fillStyle = L.outline;
    g.beginPath();
    g.moveTo(sx - 8.6 * u, ty - 1 * u); g.lineTo(sx + 8.6 * u, ty - 1 * u);
    g.lineTo(sx + 8.2 * u, tb + 1 * u); g.lineTo(sx - 8.2 * u, tb + 1 * u); g.closePath(); g.fill();
    g.fillStyle = L.jersey;
    g.beginPath();
    g.moveTo(sx - 7.5 * u, ty); g.lineTo(sx - 4 * u, ty); g.lineTo(sx, ty + 3.4 * u); g.lineTo(sx + 4 * u, ty); g.lineTo(sx + 7.5 * u, ty);
    g.lineTo(sx + 7.2 * u, tb); g.lineTo(sx - 7.2 * u, tb); g.closePath(); g.fill();
    // liseré col et emmanchures
    g.strokeStyle = L.trim; g.lineWidth = 1.1 * u;
    g.beginPath(); g.moveTo(sx - 4 * u, ty); g.lineTo(sx, ty + 3.4 * u); g.lineTo(sx + 4 * u, ty); g.stroke();
    g.beginPath(); g.moveTo(sx - 7.4 * u, ty + 0.5 * u); g.quadraticCurveTo(sx - 5.5 * u, ty + 4 * u, sx - 7.3 * u, ty + 7 * u); g.stroke();
    g.beginPath(); g.moveTo(sx + 7.4 * u, ty + 0.5 * u); g.quadraticCurveTo(sx + 5.5 * u, ty + 4 * u, sx + 7.3 * u, ty + 7 * u); g.stroke();
    if (L.motif) {
      // combinaison : motifs blancs (bande en travers de la poitrine et liseré)
      g.fillStyle = L.motif;
      g.fillRect(sx - 7.3 * u, ty + 5.5 * u, 14.6 * u, 2.2 * u);
      g.fillRect(sx - 7.3 * u, ty + 9 * u, 14.6 * u, 0.9 * u);
    }
    // numéro 9
    const nH = Math.max(6, (tb - ty) - 5 * u);
    g.font = `900 ${nH}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 1.6 * u; g.strokeStyle = L.jerseyDark;
    const ny = ty + 3.6 * u + (tb - ty - 3.6 * u) / 2;
    if (!L.noNumber) {
      g.strokeText('9', sx, ny);
      g.fillStyle = L.number;
      g.fillText('9', sx, ny);
    }

    // cou + tête chauve
    g.fillStyle = L.skinDark;
    g.fillRect(sx - 2.2 * u, ty - 3 * u, 4.4 * u, 3.6 * u);
    const hx = sx + Math.sin(th) * 1.5 * u, hy = ty - 8.6 * u;
    g.fillStyle = L.outline;
    g.beginPath(); g.ellipse(hx, hy, 6.8 * u, 7.4 * u, 0, 0, Math.PI * 2); g.fill();
    // oreilles
    g.fillStyle = L.skin;
    g.beginPath(); g.ellipse(hx - 6.2 * u, hy + 0.5 * u, 1.6 * u, 2.2 * u, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(hx + 6.2 * u, hy + 0.5 * u, 1.6 * u, 2.2 * u, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(hx, hy, 5.8 * u, 6.5 * u, 0, 0, Math.PI * 2); g.fill();
    // reflet sur le crâne
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.ellipse(hx - 2 * u, hy - 3.8 * u, 2.2 * u, 1.3 * u, -0.4, 0, Math.PI * 2); g.fill();
    // visage
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(hx - 2.1 * u, hy + 0.4 * u, 1.3 * u, 1.5 * u, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(hx + 2.1 * u, hy + 0.4 * u, 1.3 * u, 1.5 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111';
    const look = Math.sin(th) * 0.5 * u;
    g.beginPath(); g.arc(hx - 2.1 * u + look, hy + 0.7 * u, 0.7 * u, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(hx + 2.1 * u + look, hy + 0.7 * u, 0.7 * u, 0, Math.PI * 2); g.fill();
    if (L.glasses) {
      // lunettes de soleil
      g.fillStyle = '#111';
      roundRect(g, hx - 4.3 * u, hy - 0.9 * u, 3.9 * u, 2.9 * u, 1 * u); g.fill();
      roundRect(g, hx + 0.4 * u, hy - 0.9 * u, 3.9 * u, 2.9 * u, 1 * u); g.fill();
      g.fillRect(hx - 0.6 * u, hy - 0.3 * u, 1.2 * u, 0.7 * u);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(hx - 3.6 * u, hy - 0.4 * u, 1.2 * u, 0.6 * u); g.fillRect(hx + 1.1 * u, hy - 0.4 * u, 1.2 * u, 0.6 * u);
    }
    g.strokeStyle = '#4a2e1a'; g.lineWidth = 0.9 * u;
    g.beginPath(); g.moveTo(hx - 2.4 * u, hy - 1.6 * u); g.lineTo(hx - 0.9 * u, hy - 1.9 * u); g.stroke();
    g.beginPath(); g.moveTo(hx + 0.9 * u, hy - 1.9 * u); g.lineTo(hx + 2.4 * u, hy - 1.6 * u); g.stroke();
    if (L.serious) {
      // bouche fermée : il ne sourit pas
      g.strokeStyle = '#4a2e1a'; g.lineWidth = 0.9 * u;
      g.beginPath(); g.moveTo(hx - 1.8 * u, hy + 3.8 * u); g.lineTo(hx + 1.8 * u, hy + 3.8 * u); g.stroke();
    } else {
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(hx - 2.2 * u, hy + 3 * u); g.quadraticCurveTo(hx, hy + 5.4 * u, hx + 2.2 * u, hy + 3 * u); g.closePath(); g.fill();
    }
    if (L.helmet) {
      // casque (ou bonnet) des skieurs de l'école de ski
      g.fillStyle = L.outline;
      g.beginPath(); g.ellipse(hx, hy - 1.2 * u, 7.3 * u, 6.9 * u, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = L.helmet;
      g.beginPath(); g.ellipse(hx, hy - 1.2 * u, 6.4 * u, 6.1 * u, 0, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.ellipse(hx - 2.2 * u, hy - 4.6 * u, 2 * u, 1.1 * u, -0.4, 0, Math.PI * 2); g.fill();
      if (L.beanie) {
        // bonnet : revers et pompon
        g.fillStyle = L.beanieTrim || '#ffffff';
        g.fillRect(hx - 6.4 * u, hy - 2.6 * u, 12.8 * u, 1.6 * u);
        g.fillStyle = L.outline;
        g.beginPath(); g.arc(hx, hy - 8 * u, 2.5 * u, 0, Math.PI * 2); g.fill();
        g.fillStyle = L.beanieTrim || '#ffffff';
        g.beginPath(); g.arc(hx, hy - 8 * u, 1.8 * u, 0, Math.PI * 2); g.fill();
      }
    }
    g.restore();
  }

  function drawFallen(g, u, pose) {
    const t = pose.t || 0;
    // skis et bâtons éparpillés
    const piece = (x, y, a, col, w, len) => {
      g.save(); g.translate(x * u, y * u); g.rotate(a);
      g.strokeStyle = LOOK.outline; g.lineWidth = (w + 1.6) * u;
      g.beginPath(); g.moveTo(-len / 2 * u, 0); g.lineTo(len / 2 * u, 0); g.stroke();
      g.strokeStyle = col; g.lineWidth = w * u;
      g.beginPath(); g.moveTo(-len / 2 * u, 0); g.lineTo(len / 2 * u, 0); g.stroke();
      g.restore();
    };
    g.fillStyle = 'rgba(60,90,140,0.25)';
    g.beginPath(); g.ellipse(0, 2 * u, 22 * u, 7 * u, 0, 0, Math.PI * 2); g.fill();
    piece(-14, -10, 0.5, LOOK.ski, 3.4, 30);
    piece(16, 6, -0.9, LOOK.ski, 3.4, 30);
    piece(-20, 8, 1.3, LOOK.pole, 1.4, 24);
    piece(18, -14, 0.2, LOOK.pole, 1.4, 24);
    // corps allongé
    g.save(); g.rotate(-0.25);
    // jambes
    g.strokeStyle = LOOK.outline; g.lineWidth = 6 * u;
    g.beginPath(); g.moveTo(4 * u, 0); g.lineTo(16 * u, -3 * u); g.moveTo(4 * u, 2 * u); g.lineTo(15 * u, 6 * u); g.stroke();
    g.strokeStyle = LOOK.skin; g.lineWidth = 4.2 * u;
    g.beginPath(); g.moveTo(4 * u, 0); g.lineTo(16 * u, -3 * u); g.moveTo(4 * u, 2 * u); g.lineTo(15 * u, 6 * u); g.stroke();
    g.fillStyle = LOOK.boot;
    roundRect(g, 15 * u, -7 * u, 7 * u, 8 * u, 2 * u); g.fill();
    roundRect(g, 14 * u, 3 * u, 7 * u, 8 * u, 2 * u); g.fill();
    // short + débardeur
    g.fillStyle = LOOK.jersey;
    roundRect(g, -2 * u, -4.5 * u, 8 * u, 10 * u, 2 * u); g.fill();
    roundRect(g, -15 * u, -6 * u, 14 * u, 12 * u, 3 * u); g.fill();
    g.fillStyle = LOOK.number;
    g.font = `900 ${8 * u}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('9', -8 * u, 0.5 * u);
    // bras en l'air
    g.strokeStyle = LOOK.skin; g.lineWidth = 3.8 * u;
    const wave = Math.sin(t * 9) * 3 * u;
    g.beginPath(); g.moveTo(-12 * u, -6 * u); g.lineTo(-16 * u, -14 * u + wave); g.moveTo(-12 * u, 6 * u); g.lineTo(-17 * u, 13 * u - wave); g.stroke();
    // tête
    g.fillStyle = LOOK.skin;
    g.beginPath(); g.arc(-21 * u, 0, 6 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath(); g.ellipse(-23 * u, -3 * u, 2 * u, 1.2 * u, -0.4, 0, Math.PI * 2); g.fill();
    // yeux en spirale (étourdi)
    g.strokeStyle = '#fff'; g.lineWidth = 0.9 * u;
    for (const ey of [-2.2, 2.2]) {
      g.beginPath(); g.arc(-20 * u, ey * u, 1.3 * u, t * 6, t * 6 + 5); g.stroke();
    }
    g.restore();
    // étoiles qui tournent
    g.fillStyle = '#ffca28';
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + i * 2.09;
      star(g, (-6 + Math.cos(a) * 12) * u, (-22 + Math.sin(a) * 4) * u, 2.6 * u);
    }
  }

  function star(g, x, y, r) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---------- Commandes ----------
  const input = { steer: 0, tuck: false, brake: false, keys: new Set(), touch: null, override: null };

  const KEYMAP = {
    ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D',
    KeyA: 'L', KeyQ: 'L', KeyD: 'R', KeyW: 'U', KeyZ: 'U', KeyS: 'D'
  };
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') {
      if (e.code === 'Enter') { const btn = document.querySelector('.screen.visible .btn-primary'); if (btn) { e.preventDefault(); btn.click(); } }
      return;
    }
    const k = KEYMAP[e.code];
    if (k) { input.keys.add(k); e.preventDefault(); }
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      const btn = document.querySelector('.screen.visible .btn-primary');
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input.keys.delete(k); });
  window.addEventListener('blur', () => { input.keys.clear(); input.touch = null; });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    input.touch = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (input.touch && input.touch.id === e.pointerId) { input.touch.x = e.clientX; input.touch.y = e.clientY; }
  });
  const endTouch = (e) => { if (input.touch && input.touch.id === e.pointerId) input.touch = null; };
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

  function readInput() {
    if (input.override) { Object.assign(input, input.override); return; }
    let steer = 0, tuck = false, brake = false;
    const k = input.keys;
    if (k.has('L')) steer -= 1;
    if (k.has('R')) steer += 1;
    if (k.has('D')) tuck = true;
    if (k.has('U')) brake = true;
    const t = input.touch;
    if (t) {
      const dx = t.x - t.ox, dy = t.y - t.oy;
      const dead = 8, full = 55;
      if (Math.abs(dx) > dead) steer = Math.max(-1, Math.min(1, (dx - Math.sign(dx) * dead) / (full - dead)));
      if (dy > 24) tuck = true;
      if (dy < -24) brake = true;
    }
    if (brake && tuck) tuck = false;
    input.steer = steer; input.tuck = tuck; input.brake = brake;
  }

  // ---------- État de la partie ----------
  const S = {
    mode: 'home', t: 0, clock: 0, started: false,
    x: 0, y: CFG.startY, v: 0, th: 0,
    camX: 0, camY: 0,
    countdown: 0, splits: [], finalTime: null,
    endTimer: 0, fallT: 0, skidSide: 1, lift: 0,
    banner: null, bannerSeen: {}, splitMsg: null,
    particles: [], trail: [], lastTrailY: 0, gateOpen: 0, announced: {},
    fogT: -1, bia: BIATH ? BIATH.init() : null, lhu: { t: -1, next: 0, n: 0, bags: [] }, coins: [], groundCoins: []
  };

  function resetRace() {
    for (const b of bumps) b.hit = false;
    Object.assign(S, {
      mode: 'countdown', t: 0, clock: 0, started: false,
      x: TRACK.center(CFG.startY), y: CFG.startY, v: 0, th: 0,
      countdown: 3.6, frac: CFG.skierScreenFrac, splits: [], finalTime: null, endTimer: 0, fallT: 0, lift: 0,
      banner: null, bannerSeen: {}, splitMsg: null, particles: [], trail: [], lastTrailY: CFG.startY,
      gateOpen: 0, announced: {}, fallReason: ''
    });
    S.camX = S.x; S.camY = S.y - viewH() * CFG.skierScreenFrac;
    S.lastBeep = null; S.heavy = false; S.turnAmt = 0; S.schoolT = 0; S.edgeT = 0; S.edgeDir = 0; S.edgeLast = 0;
    // V4 : canons à neige (fogT < 0 : pas encore en marche), biathlète, Frères Lhuillier
    S.fogT = -1; S.bia = BIATH ? BIATH.init() : null;
    S.lhu = { t: -1, next: 0, n: 0, bags: [] }; S.coins = []; S.groundCoins = [];
    S.ref = window.Famille ? Famille.reference() : null; // record de la famille au départ
    input.keys.clear(); input.touch = null;
    showScreen(null);
    if (window.Sons) { Sons.unlock(); Sons.on.start(); }
  }

  const viewH = () => H / SCALE;

  function showBanner(text, style) {
    const now = S.t;
    if (S.bannerSeen[text] !== undefined && now - S.bannerSeen[text] < CFG.bannerCooldown) return;
    S.bannerSeen[text] = now;
    S.banner = { text, t0: now, style };
  }

  function fall(reason) {
    if (S.mode !== 'race') return;
    S.mode = 'fallen';
    S.fallT = 0;
    S.fallReason = reason;
    S.v *= reason === 'arbre' || reason === 'engin' ? 0.15 : 0.5;
    puff(S.x, S.y, 26, 6);
    if (window.Sons) Sons.on.fall(reason);
    if (window.Famille) Famille.onRunEnd({ ski: ski.id, finished: false });
  }

  function puff(x, y, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * spd;
      S.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 0.5, life: 0.5 + Math.random() * 0.7, r: 0.15 + Math.random() * 0.3 });
    }
  }

  function spray(side, amount, big = 1) {
    for (let i = 0; i < amount; i++) {
      S.particles.push({
        x: S.x + side * 0.6 + (Math.random() - 0.5) * 0.6, y: S.y + 0.3,
        vx: side * (2 + Math.random() * 4) + Math.sin(S.th) * S.v * 0.4, vy: Math.cos(S.th) * S.v * 0.5 + (Math.random() - 0.3) * 2,
        life: (0.35 + Math.random() * 0.4) * big, r: (0.1 + Math.random() * 0.22) * big
      });
    }
  }

  // ---------- Physique ----------
  function step(dt) {
    S.t += dt;
    readInput();

    if (S.mode === 'countdown' || (S.mode === 'race' && S.countdown > 0)) {
      const cd = S.countdown - (S.mode === 'countdown' ? dt : 0);
      const n = cd > 2.6 ? 3 : cd > 1.6 ? 2 : cd > 0.6 ? 1 : 0;
      if (n !== S.lastBeep) { S.lastBeep = n; if (window.Sons) Sons.on.countdown(n); }
    }
    if (S.mode === 'countdown' && !S.ref && window.Famille) S.ref = Famille.reference(); // classement arrivé pendant le compte à rebours
    if (S.mode === 'countdown') {
      S.countdown -= dt;
      if (S.countdown <= 0.6 && S.gateOpen === 0) S.gateOpen = 0.001;
      if (S.countdown <= 0.6) {
        S.mode = 'race';
        S.v = CFG.startSpeed;
      }
    }
    if (S.gateOpen > 0 && S.gateOpen < 1) S.gateOpen = Math.min(1, S.gateOpen + dt * 3);
    if (S.mode === 'race' && S.countdown > -1) S.countdown -= dt;

    if (ECOLE && S.y >= ECOLE.E.depart && (S.mode === 'race' || S.mode === 'fallen')) S.schoolT += dt;
    v4Step(dt);
    if (S.mode === 'race') raceStep(dt);
    else if (S.mode === 'finishing') finishStep(dt);
    else if (S.mode === 'fallen') {
      S.fallT += dt;
      S.v = Math.max(0, S.v - 18 * dt);
      S.y += S.v * Math.cos(S.th) * dt;
      S.x += S.v * Math.sin(S.th) * dt;
      if (S.fallT > 1.4 && !S.endShown) { S.endShown = true; showScreen('fall'); }
    }

    // particules
    for (const p of S.particles) {
      const dr = p.drag || 0.92;
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= dr; p.vy *= dr;
    }
    S.particles = S.particles.filter((p) => p.life > 0);
    if (S.particles.length > 400) S.particles.splice(0, S.particles.length - 400);

    // caméra : suit le couloir avec un peu d'anticipation, et le skieur
    const target = 0.6 * TRACK.center(S.y + 10) + 0.4 * S.x;
    const endView = S.mode === 'finishing' || S.mode === 'results';
    S.frac = (S.frac || CFG.skierScreenFrac) + ((endView ? 0.42 : CFG.skierScreenFrac) - (S.frac || CFG.skierScreenFrac)) * (1 - Math.exp(-dt / 0.8));
    const ty = S.y - viewH() * S.frac;
    const k = 1 - Math.exp(-dt / 0.28);
    S.camX += (target - S.camX) * k;
    S.camY = ty;

    // banderole d'annonce : V4.1, elle arrive environ 1,5 s avant que l'obstacle entre dans l'écran par le bas
    // (et pas au moment où il entre), pour qu'on ait le temps de la lire avant de l'aborder
    const lead = Math.max(12, S.v * CFG.bannerLead);
    const bottom = S.camY + viewH() + lead;
    for (const f of P.champsDeBosses) {
      if (!S.announced[f.debut] && bottom >= f.debut - 1 && S.y < f.debut + f.longueur && (S.mode === 'race' || S.mode === 'countdown')) {
        S.announced[f.debut] = true;
        showBanner('Champ de bosses !');
      }
    }
    if (ECOLE && !S.announced.ecole && (S.mode === 'race' || S.mode === 'countdown')) {
      const ks = ECOLE.positions(S.schoolT || 0);
      const top = Math.min(...ks.map((k) => k.y)), bot = Math.max(...ks.map((k) => k.y));
      if (bottom >= top - 1 && S.y < bot) { S.announced.ecole = true; showBanner('Le moniteur de ski !'); }
    }
    if (S.mode === 'race' || S.mode === 'countdown') {
      if (CANONS && !S.announced.canons && bottom >= CANONS.top - 1 && S.y < CANONS.bot) { S.announced.canons = true; showBanner('Canons à neige !'); }
      if (BIATH && !S.announced.biath) {
        // il vient vers nous : on compte aussi sa propre vitesse
        const b = S.bia;
        if (bottom + BIATH.B.vitesse * KMH * CFG.bannerLead >= b.y - 1 && S.y < b.y) { S.announced.biath = true; showBanner('Martin Fourcade !'); }
      }
      if (LHU && !S.announced.lhu && bottom >= LHU.freres[0].y - 1 && S.y < LHU.L.fin) { S.announced.lhu = true; showBanner('Les frères Lhuillier !'); }
    }
    if (HEAVY && !S.announced.heavy && bottom >= HEAVY.debut - 1 && S.y < HEAVY.fin && (S.mode === 'race' || S.mode === 'countdown')) {
      S.announced.heavy = true;
      showBanner('La soupe et les cailloux !');
    }
  }

  // ---------- V4 : canons à neige, biathlète, Frères Lhuillier ----------
  // volume (0..1) d'un son qui vient de la hauteur y : nul hors de l'écran, plus fort quand c'est près du skieur
  function nearness(y) {
    if (y < S.camY - 3 || y > S.camY + viewH() + 3) return 0;
    return Math.max(0.15, 1 - Math.abs(y - S.y) / (viewH() * 0.9));
  }
  const panOf = (x) => Math.max(-0.8, Math.min(0.8, (x - S.x) / 12));

  function v4Step(dt) {
    if (S.mode !== 'race' && S.mode !== 'fallen' && S.mode !== 'finishing') return;
    // canons à neige : ils se mettent en marche quand le joueur arrive, et crachent de la neige sur la piste
    if (CANONS) {
      if (S.fogT < 0 && S.mode === 'race' && S.y >= CANONS.C.depart) S.fogT = 0;
      if (S.fogT >= 0) {
        S.fogT += dt;
        if (S.fogT < CANONS.C.duree) {
          for (const c of CANONS.list) {
            if (c.y < S.camY - 10 || c.y > S.camY + viewH() + 10 || Math.random() > 0.35) continue;
            const d = -c.cote;
            S.particles.push({
              x: c.x + d * 1.3, y: c.y - 2.4 + (Math.random() - 0.5) * 0.4,
              vx: d * (8 + Math.random() * 9), vy: 1 + Math.random() * 4,
              life: 0.9 + Math.random() * 0.9, r: 0.18 + Math.random() * 0.32, drag: 0.996
            });
          }
        }
      }
    }
    // biathlète : il se met en route quand le joueur passe « depart » ; un pas de patineur à chaque demi-tour
    if (BIATH && S.y >= BIATH.B.depart) {
      const b = S.bia, prev = b.ph;
      BIATH.update(b, dt, S.x, S.y);
      if (Math.floor(b.ph / Math.PI) > Math.floor(prev / Math.PI) && window.Sons && Sons.on.pas) {
        const vol = nearness(b.y), n = Math.floor(b.ph / Math.PI);
        if (vol > 0) { Sons.on.pas(vol, panOf(b.x)); if (n % 2 === 0) Sons.on.souffle(vol, panOf(b.x)); }
      }
    }
    if (LHU) lhuStep(dt);
    // pièces d'or qui volent puis retombent et restent sur la neige
    for (const c of S.coins) {
      c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.vz -= 30 * dt; c.spin += c.vs * dt;
      if (c.z <= 0) {
        c.z = 0; c.vz = -c.vz * 0.35; c.vx *= 0.55; c.vy *= 0.55;
        if (c.vz < 1.2) { c.done = true; S.groundCoins.push({ x: c.x, y: c.y, a: c.spin }); }
      }
    }
    S.coins = S.coins.filter((c) => !c.done);
    if (S.groundCoins.length > 300) S.groundCoins.splice(0, S.groundCoins.length - 300);
  }

  function lhuStep(dt) {
    const L = LHU.L, st = S.lhu;
    if (st.t < 0) {
      if (S.mode !== 'race' || S.y < L.depart) return;
      st.t = 0; st.next = 0;
    }
    st.t += dt;
    // lancer : le sac vise l'endroit où le joueur sera quand il tombera, à un ou deux mètres près
    if (S.mode === 'race' && S.y >= L.debut && S.y < L.fin && st.t >= st.next) {
      const f = LHU.freres[st.n % LHU.freres.length];
      const r1 = hash(st.n * 7.77 + 3.1), r2 = hash(st.n * 3.31 + 9.7);
      const ty = S.y + S.v * Math.cos(S.th) * L.preavis + (r2 - 0.5) * 3;
      const c = TRACK.center(ty), hw = TRACK.halfW(ty) - 0.8;
      const tx = Math.max(c - hw, Math.min(c + hw, S.x + S.v * Math.sin(S.th) * L.preavis + (r1 - 0.5) * 2.6));
      st.n++;
      st.next = st.t + L.intervalle;
      if (ty < L.fin + 6) {
        f.throwT = st.t;
        st.bags.push({ fx: f.xIn - f.cote * 0.6, fy: f.y, tx, ty, t0: st.t, t1: st.t + L.preavis, landed: false, spin: r1 * 6 });
        if (window.Sons && Sons.on.lancer) Sons.on.lancer(panOf(f.xIn));
      }
    }
    for (const b of st.bags) {
      if (b.landed || st.t < b.t1) continue;
      b.landed = true;
      coinBurst(b.tx, b.ty);
      if (window.Sons && Sons.on.pieces) Sons.on.pieces(Math.max(0.3, nearness(b.ty)), panOf(b.tx));
      if (S.mode === 'race' && Math.hypot(S.x - b.tx, (S.y - b.ty) * 1.25) < L.rayon) { fall('lhuillier'); }
    }
    st.bags = st.bags.filter((b) => !b.landed || st.t - b.t1 < 0.4);
  }

  function coinBurst(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 5;
      S.coins.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8, z: 0.3, vz: 5 + Math.random() * 6, spin: Math.random() * 6, vs: 8 + Math.random() * 10 });
    }
    puff(x, y, 10, 3);
  }

  function raceStep(dt) {
    const prevY = S.y;
    // virage : vitesse de rotation = a / v (rayon R = v² / a)
    const heavy = inHeavy(S.y);
    S.heavy = heavy;
    const grip = CFG.grip * ski.grip * (input.brake ? CFG.brakeGripMul : 1) * (heavy ? CFG.heavyGripMul : 1);
    const omega = Math.min(CFG.maxTurnRate * ski.grip, grip / Math.max(S.v, 0.5));
    const target = input.steer * CFG.maxAngle;
    const d = target - S.th;
    const dth = Math.sign(d) * Math.min(Math.abs(d), omega * dt);
    S.th += dth;
    // Père Fourcade : relâcher puis redonner la même direction trop vite = faute de carre
    if (ski.carre) {
      const C = ski.carre;
      const dir = Math.abs(input.steer) > 0.35 ? Math.sign(input.steer) : (Math.abs(input.steer) < 0.15 ? 0 : S.edgeDir);
      if (dir === 0 && S.edgeDir !== 0) { S.edgeLast = S.edgeDir; S.edgeT = 0; }
      else if (dir === 0) S.edgeT += dt;
      else if (S.edgeDir === 0 && dir === S.edgeLast && S.edgeT < C.delai && S.v > C.vitesse * KMH) {
        S.edgeDir = 0; S.edgeLast = 0; showBanner('Faute de carre !', 'noir'); fall('carre'); return;
      }
      if (dir !== 0 && S.edgeDir === 0) S.edgeLast = 0;
      S.edgeDir = dir;
    }
    // force du virage pour le son : skis sur la carre (trajectoire en travers) + vitesse de rotation
    S.turnAmt = Math.min(1, Math.abs(Math.sin(S.th)) * 1.4 + Math.abs(dth / dt) / 1.5);

    // vitesse (en neige lourde, les vitesses maximales baissent)
    const cos = Math.cos(S.th);
    const hv = heavy ? CFG.heavySpeedMul : 1;
    const brakeMin = ski.min * KMH;
    if (input.brake) {
      if (S.v > brakeMin) S.v = Math.max(brakeMin, S.v - CFG.brakeDec * dt);
      else S.v = Math.min(brakeMin, S.v + CFG.slopeAcc * cos * dt);
    } else if (input.tuck) {
      const cap = ski.max * KMH * hv;
      if (S.v < cap) S.v = Math.min(cap, S.v + CFG.schussAcc * cos * dt);
      else S.v = Math.max(cap, S.v - CFG.heavyDec * dt);
    } else {
      const cap = CFG.slopeMax * hv;
      if (S.v < cap) S.v = Math.min(cap, S.v + CFG.slopeAcc * cos * dt);
      else S.v = Math.max(cap, S.v - (heavy ? CFG.heavyDec : CFG.overDec) * dt);
    }

    S.y += S.v * Math.cos(S.th) * dt;
    S.x += S.v * Math.sin(S.th) * dt;

    // chrono
    if (S.started) S.clock += dt;
    if (!S.started && prevY < 0 && S.y >= 0) {
      S.started = true;
      S.clock = (S.y - 0) / Math.max(0.01, S.y - prevY) * dt;
    }
    // temps intermédiaires
    P.intermediaires.forEach((sy, i) => {
      if (S.splits[i] === undefined && prevY < sy && S.y >= sy) {
        const tt = S.clock - (S.y - sy) / Math.max(0.01, S.y - prevY) * dt;
        S.splits[i] = tt;
        S.splitMsg = { i, t: tt, t0: S.t };
      }
    });

    if (S.started && S.clock >= CFG.timeLimit) {
      S.clock = CFG.timeLimit;
      S.mode = 'timeout';
      showScreen('timeout');
      if (window.Sons) Sons.on.timeout();
      if (window.Famille) Famille.onRunEnd({ ski: ski.id, finished: false });
      return;
    }

    // arrivée
    if (prevY < FINISH && S.y >= FINISH) {
      S.finalTime = S.clock - (S.y - FINISH) / Math.max(0.01, S.y - prevY) * dt;
      S.clock = S.finalTime;
      S.mode = 'finishing';
      // séquence automatique : on garde la direction du joueur pour choisir le côté de la courbe
      const side = S.th >= 0 ? 1 : -1;
      // la courbe finale doit s'arrêter dans le bas de l'aire d'arrivée, au milieu en largeur :
      // on calcule le chemin parcouru pendant la courbe pour savoir où la commencer
      const D = 22, thEnd = side * 100 * DEG;
      let cdx = 0, cdy = 0;
      for (let i = 0; i < 100; i++) {
        const q = (i + 0.5) / 100, a = thEnd * q * q * (3 - 2 * q);
        cdx += Math.sin(a) * D / 100; cdy += Math.cos(a) * D / 100;
      }
      const yStop = STOP.y + STOP.r * 0.55;
      const yCurve = Math.max(FINISH + 13, yStop - cdy), v1 = Math.min(S.v, 45 * KMH);
      S.skidSide = side;
      S.fin = { side, thEnd, xAim: STOP.x - cdx, curving: false, yCurve, v1, dec1: Math.max(0, (S.v * S.v - v1 * v1) / (2 * (yCurve - FINISH))), D, s: 0, stopped: false };
      S.heavy = false;
      if (window.Sons) Sons.on.finish();
      if (window.Famille) Famille.onRunEnd({ ski: ski.id, finished: true, time: S.finalTime, splits: S.splits.slice() });
      return;
    }

    // sapins du bord
    const c = TRACK.center(S.y), hw = TRACK.halfW(S.y);
    if (Math.abs(S.x - c) > hw - CFG.edgeMargin && S.y > CFG.startY + 1) { fall('arbre'); return; }

    // chasse-neige garés
    for (const e of plows) {
      if (Math.abs(S.y - e.y) > CFG.plowL) continue;
      const dx = S.x - e.x, dy = S.y - e.y;
      const along = dx * Math.sin(e.phi) + dy * Math.cos(e.phi);
      const across = dx * Math.cos(e.phi) - dy * Math.sin(e.phi);
      if (Math.abs(across) < CFG.plowW / 2 + CFG.plowMargin && Math.abs(along) < CFG.plowL / 2 + CFG.plowMargin) { fall('engin'); return; }
    }

    // école de ski : toucher le moniteur ou un enfant fait tomber
    if (ECOLE) {
      for (const k of ECOLE.positions(S.schoolT || 0)) {
        if (Math.abs(k.y - S.y) < 2 && Math.hypot(k.x - S.x, k.y - S.y) < k.m.hit) { fall('ecole'); return; }
      }
    }

    // V4 : biathlète qui remonte la piste : le toucher fait tomber
    if (BIATH) {
      const b = S.bia;
      if (Math.abs(b.y - S.y) < 1.1 && Math.abs(b.x - S.x) < 1.35) { fall('biathlete'); return; }
    }

    // plaques de terre : chute à n'importe quelle vitesse
    for (let i = lowerBound(muds, S.y - 4); i < muds.length && muds[i].y < S.y + 4; i++) {
      const m = muds[i];
      const qx = (S.x - m.x) / (m.rx * CFG.mudHitMul), qy = (S.y - m.y) / (m.ry * CFG.mudHitMul);
      if (qx * qx + qy * qy < 1) { fall('terre'); return; }
    }

    // bosses
    if (S.lift > 0) S.lift = Math.max(0, S.lift - dt * 40);
    for (let i = lowerBound(bumps, S.y - 2); i < bumps.length && bumps[i].y < S.y + 2; i++) {
      const b = bumps[i];
      if (b.hit) continue;
      if (Math.hypot((S.x - b.x), (S.y - b.y) * 1.2) < CFG.bumpHitRadius * (b.r / CFG.bumpRadius)) {
        b.hit = true;
        if (Math.abs(S.th) < CFG.bumpFallAngle && S.v > CFG.bumpFallSpeed) { fall('bosse'); return; }
        S.v = Math.max(CFG.brakeMin * 0.6, S.v - CFG.bumpLoss);
        S.lift = 7;
        puff(b.x, b.y, 6, 2);
      }
    }

    // traces de ski
    if (S.y - S.lastTrailY > 0.4) {
      S.trail.push({ x: S.x, y: S.y, th: S.th });
      S.lastTrailY = S.y;
      if (S.trail.length > 260) S.trail.shift();
    }
    if (input.brake && S.v > ski.min * KMH + 0.5) { if (Math.random() < 0.7) { spray(-1, 1); spray(1, 1); } }
    if (Math.abs(target - S.th) > 0.3 && S.v > 12 && Math.random() < 0.5) spray(Math.sign(S.th) || 1, 1);
  }

  function finishStep(dt) {
    // Séquence automatique après la ligne : grande courbe de freinage puis dérapage avec gerbe de neige.
    const f = S.fin;
    if (!f.curving) {
      // 1) ligne droite vers le centre de l'aire en ralentissant
      const tgt = Math.max(-0.45, Math.min(0.45, (f.xAim - S.x) * 0.06));
      S.th += (tgt - S.th) * (1 - Math.exp(-dt * 3));
      S.v = Math.max(f.v1, S.v - f.dec1 * dt);
      S.y += S.v * Math.cos(S.th) * dt;
      S.x += S.v * Math.sin(S.th) * dt;
      if (S.y >= f.yCurve) {
        f.curving = true; f.th0 = S.th;
        f.dec = Math.max(2, (S.v * S.v) / (2 * f.D));
      }
      finishTrail();
      return;
    }
    // 2) grande courbe de freinage, puis dérapage
    S.v = Math.max(0, S.v - f.dec * dt);
    f.s += S.v * dt;
    const prog = Math.min(1, f.s / f.D);
    const e = prog * prog * (3 - 2 * prog);
    S.th = f.th0 + (f.thEnd - f.th0) * e;
    S.y += S.v * Math.cos(S.th) * dt;
    S.x += S.v * Math.sin(S.th) * dt;
    S.skidding = prog > 0.45 && S.v > 0.3;
    if (S.v > 1) {
      const n = S.skidding ? Math.round(4 + S.v * 0.8) : (Math.random() < 0.4 ? 1 : 0);
      spray(-f.side, n, S.skidding ? 1.8 : 1);
    }
    finishTrail();
    if (S.v <= 0.05) {
      if (S.v === 0 && !f.stopped) { f.stopped = true; puff(S.x - f.side * 0.8, S.y + 0.3, 18, 3); }
      S.v = 0;
      S.endTimer += dt;
      if (S.endTimer > 1.4 && !S.endShown) { S.endShown = true; showResults(); }
    }
  }

  // Pendant la séquence d'arrivée le skieur part en travers : on pose les traces selon la distance
  // parcourue (et plus selon la descente), pour qu'elles restent figées là où il est passé.
  function finishTrail() {
    const last = S.trail[S.trail.length - 1];
    if (last && Math.hypot(S.x - last.x, S.y - last.y) < 0.4) return;
    S.trail.push({ x: S.x, y: S.y, th: Math.max(-90 * DEG, Math.min(90 * DEG, S.th)) });
    if (S.trail.length > 400) S.trail.shift();
  }

  function lowerBound(arr, y) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].y < y) lo = m + 1; else hi = m; }
    return lo;
  }

  // ---------- Rendu ----------
  const wx = (x) => (x - S.camX) * SCALE + W / 2;
  const wy = (y) => (y - S.camY) * SCALE;

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // neige hors-piste
    ctx.fillStyle = '#e4edf7';
    ctx.fillRect(0, 0, W, H);

    const yTop = S.camY - 6, yBot = S.camY + viewH() + 6;

    // texture légère hors piste
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let yy = Math.floor(yTop / 7) * 7; yy < yBot; yy += 7) {
      for (let j = 0; j < 6; j++) {
        const h1 = hash(yy * 13 + j);
        const x = S.camX + (h1 - 0.5) * CFG.screenMeters * 1.6;
        ctx.beginPath(); ctx.ellipse(wx(x), wy(yy + hash(yy + j * 7) * 7), 10 + h1 * 14, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      }
    }

    // couloir damé
    ctx.fillStyle = '#f6f9fd';
    ctx.beginPath();
    const yEnd = Math.min(yBot, FINISH + CFG.stopOffset);
    for (let y = yTop; y <= yEnd; y += 1) ctx.lineTo(wx(TRACK.center(y) - TRACK.halfW(y)), wy(y));
    for (let y = yEnd; y >= yTop; y -= 1) ctx.lineTo(wx(TRACK.center(y) + TRACK.halfW(y)), wy(y));
    ctx.closePath(); ctx.fill();
    // bord du couloir (ombre douce)
    ctx.strokeStyle = 'rgba(150,175,205,0.35)'; ctx.lineWidth = 3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let y = yTop; y <= Math.min(yEnd, FINISH + 4); y += 1) ctx.lineTo(wx(TRACK.center(y) + side * TRACK.halfW(y)), wy(y));
      ctx.stroke();
    }

    // neige lourde, un peu plus jaune (neige sale)
    if (HEAVY && yBot > HEAVY.debut - 10 && yTop < HEAVY.fin) {
      const y0 = Math.max(yTop, HEAVY.debut - 8), y1 = Math.min(yEnd, HEAVY.fin);
      if (y1 > y0) {
        const grd = ctx.createLinearGradient(0, wy(HEAVY.debut - 8), 0, wy(HEAVY.debut));
        grd.addColorStop(0, 'rgba(232,214,160,0)');
        grd.addColorStop(1, 'rgba(232,212,150,0.38)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        for (let y = y0; y <= y1; y += 1) ctx.lineTo(wx(TRACK.center(y) - TRACK.halfW(y)), wy(y));
        ctx.lineTo(wx(TRACK.center(y1) - TRACK.halfW(y1)), wy(y1));
        ctx.lineTo(wx(TRACK.center(y1) + TRACK.halfW(y1)), wy(y1));
        for (let y = y1; y >= y0; y -= 1) ctx.lineTo(wx(TRACK.center(y) + TRACK.halfW(y)), wy(y));
        ctx.closePath(); ctx.fill();
        // petites taches de neige sale
        ctx.fillStyle = 'rgba(170,140,90,0.16)';
        for (let yy = Math.floor(y0 / 2) * 2; yy < y1; yy += 2) {
          for (let j = 0; j < 3; j++) {
            const h1 = hash(yy * 7.3 + j * 1.9);
            if (yy < HEAVY.debut) continue;
            const x = TRACK.center(yy) + (h1 - 0.5) * 2 * TRACK.halfW(yy) * 0.95;
            ctx.beginPath(); ctx.ellipse(wx(x), wy(yy + hash(yy + j) * 2), 2 + h1 * 5, 1 + h1, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // aire d'arrêt
    if (yBot > STOP.y - STOP.r - 2) {
      ctx.fillStyle = '#f6f9fd';
      ctx.beginPath(); ctx.arc(wx(STOP.x), wy(STOP.y), STOP.r * SCALE, 0, Math.PI * 2); ctx.fill();
    }

    // lignes au sol
    groundLine(0, '#e53935', false);
    groundLine(FINISH, '#1e3a8a', true);

    // traces de ski
    if (S.trail.length > 1) {
      ctx.strokeStyle = 'rgba(140,165,200,0.45)'; ctx.lineWidth = 1.4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        for (const p of S.trail) {
          const ox = Math.cos(p.th) * 0.28 * side, oy = -Math.sin(p.th) * 0.28 * side;
          ctx.lineTo(wx(p.x + ox), wy(p.y + oy));
        }
        if (S.mode === 'race') ctx.lineTo(wx(S.x + Math.cos(S.th) * 0.28 * side), wy(S.y - Math.sin(S.th) * 0.28 * side));
        ctx.stroke();
      }
    }

    // bosses (au sol)
    for (let i = lowerBound(bumps, yTop); i < bumps.length && bumps[i].y < yBot; i++) {
      const b = bumps[i], sp = sprites.bump, k = b.r / CFG.bumpRadius;
      ctx.drawImage(sp.c, wx(b.x) - sp.w * k / 2, wy(b.y) - sp.h * k / 2, sp.w * k, sp.h * k);
    }

    // plaques de terre (au sol)
    for (let i = lowerBound(muds, yTop - 4); i < muds.length && muds[i].y < yBot + 4; i++) drawMud(muds[i]);

    // V4 : pièces d'or tombées sur la neige et cibles des Frères Lhuillier (au sol)
    const v4 = S.mode !== 'home';
    if (v4) {
      for (const c of S.groundCoins) if (c.y > yTop && c.y < yBot) drawCoin(wx(c.x), wy(c.y), 0, c.a, 0.75);
      if (LHU) for (const b of S.lhu.bags) drawTarget(b);
    }

    // objets debout, triés par y
    const items = [];
    for (let i = lowerBound(trees, yTop); i < trees.length && trees[i].y < yBot + 5; i++) {
      const t = trees[i];
      const sx = wx(t.x);
      if (sx < -3 * SCALE || sx > W + 3 * SCALE) continue;
      items.push({ y: t.y, draw: () => drawTreeSprite(t) });
    }
    if (yTop < 2 && yBot > -12) {
      items.push({ y: 0.01, draw: () => drawArch(0, 'DÉPART', '#e53935') });
      items.push({ y: CFG.gateY, draw: drawGate });
    }
    if (yTop < FINISH + 2 && yBot > FINISH - 12) items.push({ y: FINISH + 0.01, draw: () => drawArch(FINISH, 'ARRIVÉE', '#1e3a8a') });
    P.intermediaires.forEach((sy, i) => {
      if (yTop < sy + 1 && yBot > sy - 6) {
        for (const side of [-1, 1]) items.push({ y: sy, draw: () => drawSplitFlag(sy, side, i + 1) });
      }
    });
    if (yBot > STOP.y - STOP.r - 6) {
      for (const b of barriers) items.push({ y: b.y, draw: () => drawBarrier(b) });
      for (const p of crowd) items.push({ y: p.y, draw: () => drawPerson(p) });
    }
    for (const e of plows) if (e.y > yTop - 12 && e.y < yBot + 12) items.push({ y: e.y, draw: () => drawPlow(e) });
    if (ECOLE && S.mode !== 'home') {
      for (const k of ECOLE.positions(S.schoolT || 0)) {
        if (k.y < yTop - 6 || k.y > yBot + 6) continue;
        items.push({ y: k.y, draw: () => drawSkier(ctx, wx(k.x), wy(k.y), k.m.px, { theta: k.th, plow: k.m.kid, look: k.m.look, t: S.t }) });
      }
    }
    if (v4 && CANONS) {
      const on = S.fogT >= 0 && S.fogT < CANONS.C.duree;
      for (const c of CANONS.list) if (c.y > yTop - 6 && c.y < yBot + 6) items.push({ y: c.y, draw: () => drawCanon(c, on) });
    }
    if (v4 && BIATH) {
      const b = S.bia;
      if (b.y > yTop - 6 && b.y < yBot + 6) items.push({ y: b.y, draw: () => drawBiathlete(ctx, wx(b.x), wy(b.y), 52, b.ph) });
    }
    if (v4 && LHU) {
      const prog = S.lhu.t < 0 ? 0 : Math.min(1, S.lhu.t / 0.8);
      for (const f of LHU.freres) {
        if (f.y < yTop - 6 || f.y > yBot + 6) continue;
        const x = f.xOut + (f.xIn - f.xOut) * prog;
        const throwing = f.throwT !== undefined && S.lhu.t >= 0 && S.lhu.t - f.throwT < 0.3;
        items.push({ y: f.y, draw: () => drawBrother(wx(x), wy(f.y), 50, f.cote, throwing) });
      }
    }
    items.push({ y: S.y, draw: drawPlayer });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // V4 : sacs en vol et pièces d'or qui retombent (au-dessus de tout)
    if (v4 && LHU) for (const b of S.lhu.bags) if (!b.landed) drawFlyingBag(b);
    if (v4) for (const c of S.coins) drawCoin(wx(c.x), wy(c.y), c.z * SCALE, c.spin, 1);

    // neige soulevée
    ctx.fillStyle = '#ffffff';
    for (const p of S.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.beginPath(); ctx.arc(wx(p.x), wy(p.y), p.r * SCALE, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // V4 : nuage des canons à neige, par-dessus la piste et le skieur (mais pas le chrono)
    if (v4 && CANONS) { const f = fogLevel(S.fogT); if (f > 0) drawFog(f); }

    drawHUD();
    drawJoystick();
  }

  function groundLine(y, color, checkered) {
    if (y < S.camY - 2 || y > S.camY + viewH() + 2) return;
    const c = TRACK.center(y), hw = TRACK.halfW(y);
    const x0 = wx(c - hw), x1 = wx(c + hw), sy = wy(y);
    if (checkered) {
      const n = 24, w = (x1 - x0) / n, h = 0.45 * SCALE;
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#1b2a44' : '#ffffff';
        ctx.fillRect(x0 + i * w, sy - h + j * h, w + 0.5, h);
      }
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x0, sy - 0.25 * SCALE, x1 - x0, 0.5 * SCALE);
    }
  }

  // Chasse-neige vu de dessus : chenilles, carrosserie orange, cabine, lame à l'avant
  function drawPlow(e) {
    const s = SCALE;
    ctx.save();
    ctx.translate(wx(e.x), wy(e.y));
    ctx.rotate(-e.phi);
    ctx.scale(CFG.plowScale, CFG.plowScale);
    // ombre
    ctx.fillStyle = 'rgba(60,90,140,0.25)';
    roundRect(ctx, -1.6 * s + 0.35 * s, -3.2 * s + 0.35 * s, 3.2 * s, 6.6 * s, 0.4 * s); ctx.fill();
    // chenilles
    ctx.fillStyle = '#2b2f36';
    roundRect(ctx, -1.7 * s, -3.0 * s, 0.75 * s, 4.9 * s, 0.3 * s); ctx.fill();
    roundRect(ctx, 0.95 * s, -3.0 * s, 0.75 * s, 4.9 * s, 0.3 * s); ctx.fill();
    ctx.fillStyle = '#4a5160';
    for (let y = -2.8; y < 1.8; y += 0.45) {
      ctx.fillRect(-1.65 * s, y * s, 0.65 * s, 0.12 * s);
      ctx.fillRect(1.0 * s, y * s, 0.65 * s, 0.12 * s);
    }
    // carrosserie
    ctx.fillStyle = '#16202e';
    roundRect(ctx, -1.15 * s, -3.25 * s, 2.3 * s, 5.0 * s, 0.35 * s); ctx.fill();
    ctx.fillStyle = '#f57c00';
    roundRect(ctx, -1.05 * s, -3.15 * s, 2.1 * s, 4.8 * s, 0.3 * s); ctx.fill();
    ctx.fillStyle = '#ff9800';
    roundRect(ctx, -0.9 * s, -3.0 * s, 0.6 * s, 4.4 * s, 0.25 * s); ctx.fill();
    // grille du moteur à l'arrière
    ctx.fillStyle = '#bf5f00';
    for (let i = 0; i < 4; i++) ctx.fillRect(-0.7 * s, (-2.9 + i * 0.28) * s, 1.4 * s, 0.12 * s);
    // cabine (toit) et pare-brise vers l'avant
    ctx.fillStyle = '#16202e';
    roundRect(ctx, -1.0 * s, -0.6 * s, 2.0 * s, 2.1 * s, 0.3 * s); ctx.fill();
    ctx.fillStyle = '#e65100';
    roundRect(ctx, -0.9 * s, -0.5 * s, 1.8 * s, 1.6 * s, 0.25 * s); ctx.fill();
    ctx.fillStyle = '#9fd3f5';
    roundRect(ctx, -0.85 * s, 1.0 * s, 1.7 * s, 0.4 * s, 0.12 * s); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-0.6 * s, 1.08 * s, 0.5 * s, 0.1 * s);
    // gyrophare qui clignote
    const on = Math.floor(S.t * 3) % 2 === 0;
    ctx.fillStyle = on ? '#ffeb3b' : '#ffa000';
    ctx.beginPath(); ctx.arc(0, 0.2 * s, 0.28 * s, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,235,59,0.25)';
      ctx.beginPath(); ctx.arc(0, 0.2 * s, 0.75 * s, 0, Math.PI * 2); ctx.fill();
    }
    // bras et lame
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 0.18 * s;
    ctx.beginPath(); ctx.moveTo(-0.7 * s, 1.7 * s); ctx.lineTo(-0.9 * s, 2.5 * s); ctx.moveTo(0.7 * s, 1.7 * s); ctx.lineTo(0.9 * s, 2.5 * s); ctx.stroke();
    // tas de neige poussé par la lame
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 3.15 * s, 1.75 * s, 0.45 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16202e';
    ctx.beginPath();
    ctx.moveTo(-1.85 * s, 2.45 * s); ctx.quadraticCurveTo(0, 2.95 * s, 1.85 * s, 2.45 * s);
    ctx.lineTo(1.85 * s, 2.9 * s); ctx.quadraticCurveTo(0, 3.4 * s, -1.85 * s, 2.9 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.beginPath();
    ctx.moveTo(-1.75 * s, 2.52 * s); ctx.quadraticCurveTo(0, 3.0 * s, 1.75 * s, 2.52 * s);
    ctx.lineTo(1.75 * s, 2.8 * s); ctx.quadraticCurveTo(0, 3.28 * s, -1.75 * s, 2.8 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#16202e';
    for (let i = -3; i <= 3; i += 2) ctx.fillRect(i * 0.45 * s - 0.1 * s, 2.62 * s + Math.abs(i) * -0.03 * s, 0.2 * s, 0.18 * s);
    ctx.restore();
  }

  // Plaque de terre : terre brune, cailloux gris, quelques touffes d'herbe sèche
  function drawMud(m) {
    const x = wx(m.x), y = wy(m.y), s = SCALE;
    const path = (k) => {
      ctx.beginPath();
      m.pts.forEach(([px, py], j) => { if (j) ctx.lineTo(x + px * s * k, y + py * s * k); else ctx.moveTo(x + px * s * k, y + py * s * k); });
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(150,120,70,0.28)'; path(1.25); ctx.fill();
    ctx.fillStyle = '#5d4128'; path(1); ctx.fill();
    ctx.fillStyle = '#7a5a3a'; path(0.7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.ellipse(x - m.rx * 0.55 * s, y - m.ry * 0.5 * s, 0.5 * s, 0.18 * s, -0.3, 0, Math.PI * 2); ctx.fill();
    for (const st of m.stones) {
      const sx = x + st.x * s, sy = y + st.y * s, r = st.r * s;
      ctx.fillStyle = 'rgba(40,30,20,0.35)';
      ctx.beginPath(); ctx.ellipse(sx + r * 0.25, sy + r * 0.3, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ['#9e9e9e', '#8a8580', '#b0aca5'][st.g];
      ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.75, st.g, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy - r * 0.25, r * 0.35, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#8a8a3a'; ctx.lineWidth = 1.5;
    for (let j = 0; j < 3; j++) {
      const [px, py] = m.pts[(j * 5 + 2) % m.pts.length];
      const gx = x + px * s * 0.85, gy = y + py * s * 0.85;
      ctx.beginPath();
      ctx.moveTo(gx - 3, gy); ctx.lineTo(gx - 5, gy - 6);
      ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - 7);
      ctx.moveTo(gx + 3, gy); ctx.lineTo(gx + 5, gy - 6);
      ctx.stroke();
    }
  }

  // ---------- V4 : dessins des nouveaux obstacles ----------
  // Canon à neige : mât sur trépied et tube jaune tourné vers le milieu de la piste ; l'hélice tourne quand il marche
  function drawCanon(c, on) {
    const s = SCALE, d = -c.cote;
    ctx.save();
    ctx.translate(wx(c.x), wy(c.y));
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(60,90,140,0.25)';
    ctx.beginPath(); ctx.ellipse(0.3 * s, 0.1 * s, 1.1 * s, 0.4 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 0.22 * s;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -2.6 * s); ctx.stroke();
    ctx.lineWidth = 0.14 * s;
    ctx.beginPath(); ctx.moveTo(0, -0.5 * s); ctx.lineTo(-0.7 * s, 0.15 * s); ctx.moveTo(0, -0.5 * s); ctx.lineTo(0.7 * s, 0.15 * s); ctx.stroke();
    ctx.translate(0, -2.7 * s);
    ctx.scale(d, 1);
    ctx.rotate(0.22);
    // tube
    ctx.fillStyle = '#16202e';
    roundRect(ctx, -1.1 * s, -0.62 * s, 2.3 * s, 1.24 * s, 0.35 * s); ctx.fill();
    ctx.fillStyle = '#fdd835';
    roundRect(ctx, -1.0 * s, -0.52 * s, 2.1 * s, 1.04 * s, 0.3 * s); ctx.fill();
    ctx.fillStyle = '#f9a825';
    ctx.fillRect(-1.0 * s, 0.2 * s, 2.1 * s, 0.25 * s);
    // buse à l'avant
    ctx.fillStyle = '#90a4ae';
    ctx.beginPath(); ctx.ellipse(1.2 * s, 0, 0.22 * s, 0.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    // arrière : grille et hélice
    ctx.fillStyle = '#263238';
    ctx.beginPath(); ctx.ellipse(-1.1 * s, 0, 0.3 * s, 0.66 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 0.08 * s;
    const a0 = on ? S.t * 25 : 0;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * 2.09;
      ctx.beginPath(); ctx.moveTo(-1.1 * s, 0); ctx.lineTo(-1.1 * s + Math.cos(a) * 0.25 * s, Math.sin(a) * 0.58 * s); ctx.stroke();
    }
    ctx.restore();
  }

  // Nuage de neige : un voile blanc et de gros paquets qui dérivent ; on ne voit plus qu'environ 30 % de l'écran
  function drawFog(level) {
    const vis = CANONS.C.visible === undefined ? 0.3 : CANONS.C.visible;
    ctx.fillStyle = `rgba(242,247,253,${(0.86 - vis) * level})`;
    ctx.fillRect(0, 0, W, H);
    const R = Math.max(W, H);
    for (let i = 0; i < 12; i++) {
      const sp = 0.4 + hash(i + 3) * 0.8;
      const x = (hash(i * 1.7) * 1.4 - 0.2) * W + Math.sin(S.t * 0.5 + i) * W * 0.18;
      const span = H * 1.6;
      const y = ((hash(i + 7) * span + S.t * 90 * sp) % span) - H * 0.3;
      const r = (0.22 + hash(i + 11) * 0.25) * R;
      const grd = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${0.6 * level})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // flocons qui filent en travers
    ctx.fillStyle = `rgba(255,255,255,${0.9 * level})`;
    for (let i = 0; i < 70; i++) {
      const x = ((hash(i * 2.3) * W * 1.2 + S.t * (180 + hash(i) * 220) * (i % 2 ? 1 : -1)) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1;
      const y = ((hash(i * 5.1) * H + S.t * 140) % H);
      ctx.beginPath(); ctx.arc(x, y, 1.5 + hash(i * 9.3) * 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Le biathlète, vu de dos (il remonte la piste) : combinaison noire et jaune, carabine dans le dos,
  // skis de fond écartés en pas de patineur
  function drawBiathlete(g, x, y, hPx, ph) {
    const u = hPx / 52;
    const BLK = '#15171c', YEL = '#ffd600', OUT = '#0b0d12';
    g.save();
    g.translate(x, y);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const push = Math.sin(ph); // > 0 : la jambe droite pousse vers l'extérieur ; < 0 : la gauche
    g.fillStyle = 'rgba(60,90,140,0.25)';
    g.beginPath(); g.ellipse(0, 2 * u, 20 * u, 5 * u, 0, 0, Math.PI * 2); g.fill();
    const feet = [-1, 1].map((side) => {
      const out = Math.max(0, side * push);
      return { side, x: side * (5 + out * 8) * u, y: -out * 2 * u, out };
    });
    const line = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    // skis de fond, longs et fins, pointes vers le haut de l'écran
    for (const f of feet) {
      const a = f.side * (20 + f.out * 12) * DEG, dx = Math.sin(a), dy = -Math.cos(a);
      g.strokeStyle = OUT; g.lineWidth = 3.4 * u;
      line(f.x - dx * 13 * u, f.y - dy * 13 * u, f.x + dx * 25 * u, f.y + dy * 25 * u);
      g.strokeStyle = YEL; g.lineWidth = 1.9 * u;
      line(f.x - dx * 12 * u, f.y - dy * 12 * u, f.x + dx * 20 * u, f.y + dy * 20 * u);
      g.strokeStyle = BLK;
      line(f.x + dx * 20 * u, f.y + dy * 20 * u, f.x + dx * 24 * u, f.y + dy * 24 * u);
    }
    const hipY = -21 * u, shY = -36 * u;
    // bâtons : plantés derrière lui (plus bas à l'écran), ils poussent ensemble à chaque pas
    const pp = (Math.sin(ph * 2) + 1) / 2;
    for (const side of [-1, 1]) {
      const hx = side * 11 * u, hy = shY + 8 * u + pp * 6 * u;
      g.strokeStyle = '#9aa3ad'; g.lineWidth = 1.4 * u;
      line(hx, hy - 3 * u, side * (14 + pp * 3) * u, (5 + pp * 5) * u);
      g.beginPath(); g.ellipse(side * (14 + pp * 3) * u, (5 + pp * 5) * u, 1.6 * u, 0.7 * u, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 5 * u;
      line(side * 7.5 * u, shY + 2 * u, side * 11 * u, shY + 9 * u); line(side * 11 * u, shY + 9 * u, hx, hy);
      g.strokeStyle = side > 0 ? BLK : BLK; g.lineWidth = 3.4 * u;
      line(side * 7.5 * u, shY + 2 * u, side * 11 * u, shY + 9 * u); line(side * 11 * u, shY + 9 * u, hx, hy);
      g.fillStyle = YEL;
      g.beginPath(); g.arc(hx, hy, 1.8 * u, 0, Math.PI * 2); g.fill();
    }
    // jambes : collant noir à bande jaune
    for (const f of feet) {
      const kx = (f.x + f.side * 3.5 * u) * 0.6;
      g.strokeStyle = OUT; g.lineWidth = 6 * u;
      line(f.x, f.y - 2 * u, kx, hipY * 0.5); line(kx, hipY * 0.5, f.side * 4 * u, hipY);
      g.strokeStyle = BLK; g.lineWidth = 4.3 * u;
      line(f.x, f.y - 2 * u, kx, hipY * 0.5); line(kx, hipY * 0.5, f.side * 4 * u, hipY);
      g.strokeStyle = YEL; g.lineWidth = 1 * u;
      line(f.x + f.side * 1.3 * u, f.y - 3 * u, kx + f.side * 1.4 * u, hipY * 0.5);
      g.fillStyle = OUT;
      roundRect(g, f.x - 2.6 * u, f.y - 4 * u, 5.2 * u, 5 * u, 1.5 * u); g.fill();
    }
    // buste
    g.fillStyle = OUT;
    g.beginPath(); g.moveTo(-9 * u, shY - 1 * u); g.lineTo(9 * u, shY - 1 * u); g.lineTo(7 * u, hipY + 2 * u); g.lineTo(-7 * u, hipY + 2 * u); g.closePath(); g.fill();
    g.fillStyle = BLK;
    g.beginPath(); g.moveTo(-8 * u, shY); g.lineTo(8 * u, shY); g.lineTo(6.2 * u, hipY + 1 * u); g.lineTo(-6.2 * u, hipY + 1 * u); g.closePath(); g.fill();
    g.fillStyle = YEL;
    g.beginPath(); g.moveTo(-8 * u, shY); g.lineTo(-5 * u, shY); g.lineTo(-4.4 * u, hipY + 1 * u); g.lineTo(-6.2 * u, hipY + 1 * u); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(8 * u, shY); g.lineTo(5 * u, shY); g.lineTo(4.4 * u, hipY + 1 * u); g.lineTo(6.2 * u, hipY + 1 * u); g.closePath(); g.fill();
    // carabine dans le dos, en travers, avec ses bretelles
    g.strokeStyle = '#3a3f47'; g.lineWidth = 1 * u;
    line(-6 * u, shY + 0.5 * u, -2 * u, hipY + 1 * u); line(6 * u, shY + 0.5 * u, 2 * u, hipY + 1 * u);
    g.save();
    g.translate(0, (shY + hipY) / 2);
    g.rotate(-0.55);
    g.fillStyle = OUT;
    roundRect(g, -12 * u, -1.6 * u, 24 * u, 3.2 * u, 1 * u); g.fill();
    g.fillStyle = '#4e342e';
    roundRect(g, -11.4 * u, -2.2 * u, 9 * u, 4.4 * u, 1.4 * u); g.fill();
    g.fillStyle = '#607d8b';
    g.fillRect(-2.4 * u, -1 * u, 13.6 * u, 2 * u);
    g.fillStyle = '#263238';
    g.fillRect(1 * u, 0.8 * u, 2.4 * u, 2.4 * u);
    g.restore();
    // tête vue de dos : bonnet noir à bande jaune
    const hy = shY - 7.5 * u;
    g.fillStyle = '#c8996c';
    g.fillRect(-2.2 * u, shY - 3 * u, 4.4 * u, 3.4 * u);
    g.fillStyle = OUT;
    g.beginPath(); g.ellipse(0, hy, 6.4 * u, 7 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e0ac69';
    g.beginPath(); g.ellipse(-5.8 * u, hy + 1 * u, 1.4 * u, 2 * u, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(5.8 * u, hy + 1 * u, 1.4 * u, 2 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e0ac69';
    g.beginPath(); g.ellipse(0, hy, 5.5 * u, 6.2 * u, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = BLK;
    g.beginPath(); g.ellipse(0, hy - 0.5 * u, 5.8 * u, 6 * u, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillRect(-5.8 * u, hy - 0.6 * u, 11.6 * u, 2.2 * u);
    g.fillStyle = YEL;
    g.fillRect(-5.8 * u, hy - 2.4 * u, 11.6 * u, 1.6 * u);
    // il souffle fort : petit nuage de buée à chaque pas
    const br = ((ph % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (br < 1.6) {
      const k = br / 1.6;
      g.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`;
      g.beginPath(); g.arc(0, hy - 9 * u - k * 6 * u, (2 + k * 4) * u, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // Un des Frères Lhuillier : treillis militaire, casquette, un sac de pièces d'or à la main (ou en train de lancer)
  function drawBrother(x, y, hPx, cote, throwing) {
    const u = hPx / 52, d = -cote; // d : côté de la piste
    const g = ctx;
    const OUT = '#1b1f14', C1 = '#5b6b34', C2 = '#3b4724', C3 = '#8a7a4a';
    g.save();
    g.translate(x, y);
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = 'rgba(60,90,140,0.25)';
    g.beginPath(); g.ellipse(2 * u, 1 * u, 13 * u, 4 * u, 0, 0, Math.PI * 2); g.fill();
    const camo = (x0, y0, w, h) => {
      g.save();
      roundRect(g, x0, y0, w, h, 2 * u); g.fillStyle = OUT; g.fill();
      roundRect(g, x0 + 0.8 * u, y0 + 0.8 * u, w - 1.6 * u, h - 1.6 * u, 1.6 * u); g.fillStyle = C1; g.fill(); g.clip();
      for (let k = 0; k < 7; k++) {
        g.fillStyle = k % 2 ? C2 : C3;
        g.beginPath(); g.ellipse(x0 + hash(k * 3.7 + w) * w, y0 + hash(k * 5.3 + h) * h, 2.6 * u, 1.6 * u, k, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    };
    // jambes et rangers
    camo(-7 * u, -17 * u, 6 * u, 15 * u);
    camo(1 * u, -17 * u, 6 * u, 15 * u);
    g.fillStyle = '#111';
    roundRect(g, -8 * u, -3.5 * u, 7.5 * u, 4.5 * u, 1.5 * u); g.fill();
    roundRect(g, 0.5 * u, -3.5 * u, 7.5 * u, 4.5 * u, 1.5 * u); g.fill();
    // veste
    camo(-9 * u, -35 * u, 18 * u, 20 * u);
    g.fillStyle = '#2e2a1e';
    g.fillRect(-9 * u, -18 * u, 18 * u, 2 * u);
    // bras côté sapins : le long du corps
    g.strokeStyle = OUT; g.lineWidth = 5.4 * u;
    g.beginPath(); g.moveTo(-d * 8 * u, -32 * u); g.lineTo(-d * 11 * u, -18 * u); g.stroke();
    g.strokeStyle = C1; g.lineWidth = 3.8 * u;
    g.beginPath(); g.moveTo(-d * 8 * u, -32 * u); g.lineTo(-d * 11 * u, -18 * u); g.stroke();
    // bras côté piste : levé pour lancer, ou qui tient un sac
    const hx = throwing ? d * 13 * u : d * 12 * u, hy = throwing ? -50 * u : -19 * u;
    g.strokeStyle = OUT; g.lineWidth = 5.4 * u;
    g.beginPath(); g.moveTo(d * 8 * u, -32 * u); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = C1; g.lineWidth = 3.8 * u;
    g.beginPath(); g.moveTo(d * 8 * u, -32 * u); g.lineTo(hx, hy); g.stroke();
    if (!throwing) drawSack(g, hx, hy + 5 * u, 5 * u, 0);
    g.fillStyle = '#c68642';
    g.beginPath(); g.arc(hx, hy, 2 * u, 0, Math.PI * 2); g.fill();
    // tête et casquette
    const hyy = -41 * u;
    g.fillStyle = OUT;
    g.beginPath(); g.arc(0, hyy, 6.6 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d9a066';
    g.beginPath(); g.arc(0, hyy, 5.8 * u, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111';
    g.beginPath(); g.arc(-2 * u, hyy + 0.5 * u, 0.8 * u, 0, Math.PI * 2); g.arc(2 * u, hyy + 0.5 * u, 0.8 * u, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a2e1a'; g.lineWidth = 1 * u;
    g.beginPath(); g.moveTo(-2.4 * u, hyy + 3 * u); g.quadraticCurveTo(0, hyy + 5 * u, 2.4 * u, hyy + 3 * u); g.stroke();
    g.fillStyle = '#3b2a1a';
    g.fillRect(-2.6 * u, hyy + 2.2 * u, 5.2 * u, 0.9 * u); // moustache
    g.fillStyle = C2;
    g.beginPath(); g.ellipse(0, hyy - 2.5 * u, 6.4 * u, 4.4 * u, 0, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = C3;
    g.beginPath(); g.ellipse(-2 * u, hyy - 4.5 * u, 2 * u, 1.2 * u, 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = OUT;
    g.fillRect(-7 * u, hyy - 3 * u, 14 * u, 1.6 * u);
    g.restore();
  }

  // Sac de toile brune fermé par une ficelle, marqué d'une pièce d'or
  function drawSack(g, x, y, r, rot) {
    g.save();
    g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#3e2a14';
    g.beginPath(); g.ellipse(0, 0.25 * r, r * 1.05, r * 0.95, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a0723c';
    g.beginPath(); g.ellipse(0, 0.25 * r, r * 0.9, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-0.35 * r, -0.5 * r); g.lineTo(-0.5 * r, -1.0 * r); g.lineTo(0.5 * r, -1.0 * r); g.lineTo(0.35 * r, -0.5 * r); g.closePath(); g.fill();
    g.strokeStyle = '#5d3a17'; g.lineWidth = Math.max(1, r * 0.14);
    g.beginPath(); g.moveTo(-0.4 * r, -0.55 * r); g.lineTo(0.4 * r, -0.55 * r); g.stroke();
    g.fillStyle = '#ffca28';
    g.beginPath(); g.arc(0, 0.3 * r, r * 0.38, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e09b00';
    g.beginPath(); g.arc(0, 0.3 * r, r * 0.22, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawFlyingBag(b) {
    const p = Math.max(0, Math.min(1, (S.lhu.t - b.t0) / (b.t1 - b.t0)));
    const gx = b.fx + (b.tx - b.fx) * p, gy = b.fy + (b.ty - b.fy) * p;
    const h = Math.sin(Math.PI * p) * (3 + Math.hypot(b.tx - b.fx, b.ty - b.fy) * 0.15) + (1 - p) * 2;
    ctx.fillStyle = 'rgba(60,90,140,0.25)';
    ctx.beginPath(); ctx.ellipse(wx(gx), wy(gy), 0.7 * SCALE * (0.6 + p * 0.4), 0.3 * SCALE, 0, 0, Math.PI * 2); ctx.fill();
    drawSack(ctx, wx(gx), wy(gy) - h * SCALE, 0.85 * SCALE, b.spin + p * 5);
  }

  // Cible au sol : elle apparaît au lancer et se resserre jusqu'à la chute du sac
  function drawTarget(b) {
    const L = LHU.L, now = S.lhu.t;
    const p = Math.max(0, Math.min(1, (now - b.t0) / (b.t1 - b.t0)));
    const a = b.landed ? Math.max(0, 1 - (now - b.t1) / 0.4) : 0.45 + 0.5 * p;
    const x = wx(b.tx), y = wy(b.ty), r = L.rayon * SCALE, ky = 0.8;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(229,57,53,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * ky, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.66, r * 0.66 * ky, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.ellipse(x, y, r * 0.33, r * 0.33 * ky, 0, 0, Math.PI * 2); ctx.fill();
    if (!b.landed) {
      const rr = r * (1.8 - 0.8 * p);
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * ky, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // Pièce d'or (z : hauteur au-dessus de la neige, en pixels ; spin : la pièce tourne sur elle-même)
  function drawCoin(x, y, z, spin, k) {
    const r = 0.32 * SCALE * k, w = Math.max(0.25, Math.abs(Math.cos(spin)));
    if (z > 0) {
      ctx.fillStyle = 'rgba(60,90,140,0.2)';
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#b07800';
    ctx.beginPath(); ctx.ellipse(x, y - z, r * w + 1, r + 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.ellipse(x, y - z, r * w, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.ellipse(x - r * w * 0.3, y - z - r * 0.3, r * w * 0.3, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawTreeSprite(t) {
    const sp = sprites.trees[t.v];
    const k = t.s;
    ctx.drawImage(sp.c, wx(t.x) - sp.ax * k, wy(t.y) - sp.ay * k, sp.w * k, sp.h * k);
  }

  function drawArch(y, label, color) {
    const c = TRACK.center(y), hw = TRACK.halfW(y) + 0.6;
    const xl = wx(c - hw), xr = wx(c + hw), by = wy(y);
    const postH = 4.2 * SCALE, bannerH = Math.max(22, 1.9 * SCALE);
    ctx.fillStyle = 'rgba(60,90,140,0.2)';
    ctx.fillRect(xl, by - 0.2 * SCALE, xr - xl, 0.4 * SCALE);
    ctx.fillStyle = '#37474f';
    ctx.fillRect(xl - 3, by - postH, 6, postH);
    ctx.fillRect(xr - 3, by - postH, 6, postH);
    ctx.fillStyle = color;
    roundRect(ctx, xl - 6, by - postH - bannerH * 0.5, xr - xl + 12, bannerH, 5); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    roundRect(ctx, xl - 3, by - postH - bannerH * 0.5 + 3, xr - xl + 6, bannerH - 6, 3); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(bannerH * 0.62)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, (xl + xr) / 2, by - postH + 1);
    // petits fanions
    const n = 8;
    for (let i = 0; i < n; i++) {
      const fx = xl + (i + 0.5) * (xr - xl) / n;
      ctx.fillStyle = ['#ffca28', '#e53935', '#43a047', '#1e88e5'][i % 4];
      ctx.beginPath(); ctx.moveTo(fx - 5, by - postH + bannerH * 0.5); ctx.lineTo(fx + 5, by - postH + bannerH * 0.5); ctx.lineTo(fx, by - postH + bannerH * 0.5 + 9); ctx.closePath(); ctx.fill();
    }
  }

  function drawGate() {
    const y = CFG.gateY, c = TRACK.center(y);
    const sy = wy(y), half = 1.8 * SCALE;
    ctx.fillStyle = '#37474f';
    ctx.fillRect(wx(c) - half - 4, sy - 1.1 * SCALE, 5, 1.1 * SCALE);
    ctx.fillRect(wx(c) + half - 1, sy - 1.1 * SCALE, 5, 1.1 * SCALE);
    ctx.save();
    ctx.translate(wx(c) - half, sy - 0.8 * SCALE);
    ctx.rotate(-S.gateOpen * Math.PI / 2);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(0, -3, half * 2, 6);
    ctx.fillStyle = '#fff';
    for (let i = 1; i < 6; i += 2) ctx.fillRect(i * half / 3, -3, half / 3, 6);
    ctx.restore();
  }

  function drawSplitFlag(y, side, n) {
    const c = TRACK.center(y), hw = TRACK.halfW(y);
    const x = wx(c + side * (hw - 0.3)), by = wy(y);
    const h = 2.6 * SCALE;
    ctx.fillStyle = 'rgba(60,90,140,0.25)';
    ctx.beginPath(); ctx.ellipse(x, by, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by - h); ctx.stroke();
    const fw = 1.6 * SCALE * -side, fh = 1.1 * SCALE;
    ctx.fillStyle = '#ffca28';
    ctx.beginPath(); ctx.moveTo(x, by - h); ctx.lineTo(x + fw, by - h + fh * 0.15); ctx.lineTo(x + fw, by - h + fh * 0.85); ctx.lineTo(x, by - h + fh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b2a44';
    ctx.font = `900 ${Math.round(fh * 0.7)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x + fw / 2, by - h + fh / 2 + 1);
  }

  function drawBarrier(b) {
    const x = wx(b.x), y = wy(b.y);
    const w = 2.6 * SCALE * Math.abs(Math.cos(b.a)) + 0.6 * SCALE, h = 0.9 * SCALE;
    ctx.fillStyle = b.b % 6 === 0 ? '#1e3a8a' : (b.b % 2 ? '#e53935' : '#ffffff');
    ctx.strokeStyle = '#9e2a2a'; ctx.lineWidth = 1;
    roundRect(ctx, x - w / 2, y - h, w, h, 2); ctx.fill(); ctx.stroke();
    if (b.b % 6 === 0 && w > 1.5 * SCALE) {
      ctx.fillStyle = '#ffca28';
      ctx.font = `900 ${Math.round(h * 0.62)}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('PTP', x, y - h / 2 + 1);
    }
  }

  function drawPerson(p) {
    const x = wx(p.x), y = wy(p.y), s = SCALE;
    const jump = S.mode === 'finishing' || S.mode === 'results' ? Math.max(0, Math.sin(S.t * 8 + p.ph)) * 0.35 * s : Math.max(0, Math.sin(S.t * 3 + p.ph)) * 0.08 * s;
    ctx.fillStyle = p.c;
    roundRect(ctx, x - 0.4 * s, y - 1.5 * s - jump, 0.8 * s, 1.2 * s, 0.25 * s); ctx.fill();
    ctx.fillStyle = p.s;
    ctx.beginPath(); ctx.arc(x, y - 1.75 * s - jump, 0.32 * s, 0, Math.PI * 2); ctx.fill();
    if (p.hat) {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(x, y - 1.85 * s - jump, 0.32 * s, Math.PI, 0); ctx.fill();
    }
    if (S.mode === 'finishing' || S.mode === 'results') {
      ctx.strokeStyle = p.s; ctx.lineWidth = 0.14 * s;
      ctx.beginPath(); ctx.moveTo(x - 0.35 * s, y - 1.3 * s - jump); ctx.lineTo(x - 0.6 * s, y - 2.2 * s - jump);
      ctx.moveTo(x + 0.35 * s, y - 1.3 * s - jump); ctx.lineTo(x + 0.6 * s, y - 2.2 * s - jump); ctx.stroke();
    }
  }

  function drawPlayer() {
    const pose = {
      theta: S.th,
      crouch: input.tuck && S.mode === 'race' ? 1 : 0,
      plow: input.brake && S.mode === 'race',
      look: ski.look,
      skid: S.mode === 'finishing' && (S.skidding || S.v === 0),
      skidSide: S.skidSide,
      cheer: (S.mode === 'finishing' || S.mode === 'results') && !!(S.fin && S.fin.stopped),
      fallen: S.mode === 'fallen',
      lift: S.lift, t: S.t
    };
    drawSkier(ctx, wx(S.x), wy(S.y), CFG.skierPx, pose);
  }

  // ---------- Interface en jeu ----------
  const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", "Arial Rounded MT Bold", system-ui, sans-serif';

  function fmt(t) {
    if (t === null || t === undefined) return '--';
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    const tenth = Math.floor(s * 10 + 1e-6) / 10;
    return `${m}:${tenth.toFixed(1).padStart(4, '0')}`;
  }

  function drawHUD() {
    if (S.mode === 'home') return;
    const top = SAFE_TOP + 8;
    // barre de progression
    const prog = Math.max(0, Math.min(1, S.y / FINISH));
    ctx.fillStyle = 'rgba(27,42,68,0.15)';
    roundRect(ctx, 16, top, W - 32, 6, 3); ctx.fill();
    ctx.fillStyle = '#e53935';
    roundRect(ctx, 16, top, Math.max(6, (W - 32) * prog), 6, 3); ctx.fill();
    for (const sy of P.intermediaires) {
      ctx.fillStyle = S.y >= sy ? '#ffca28' : '#ffffff';
      ctx.beginPath(); ctx.arc(16 + (W - 32) * sy / FINISH, top + 3, 4, 0, Math.PI * 2); ctx.fill();
    }

    // chrono
    const cy = top + 16;
    const big = S.mode === 'finishing' || S.mode === 'results';
    const cw = big ? 190 : 150, ch = big ? 64 : 50;
    ctx.fillStyle = 'rgba(27,42,68,0.85)';
    roundRect(ctx, W / 2 - cw / 2, cy, cw, ch, 16); ctx.fill();
    ctx.fillStyle = big ? '#ffca28' : '#ffffff';
    ctx.font = `800 ${big ? 44 : 34}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(fmt(S.started ? S.clock : 0), W / 2, cy + ch / 2 + 2);

    // vitesse
    const kmh = Math.round(S.v * 3.6);
    ctx.fillStyle = 'rgba(27,42,68,0.85)';
    roundRect(ctx, 12, cy + 4, 74, 42, 12); ctx.fill();
    ctx.fillStyle = kmh >= 70 ? '#ff7043' : '#ffffff';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText(String(kmh), 49, cy + 20);
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = '#b8c7de';
    ctx.fillText('km/h', 49, cy + 38);

    // distance restante
    const rest = Math.max(0, Math.ceil(FINISH - Math.max(0, S.y)));
    ctx.fillStyle = 'rgba(27,42,68,0.85)';
    roundRect(ctx, W - 86, cy + 4, 74, 42, 12); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText(String(rest), W - 49, cy + 20);
    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = '#b8c7de';
    ctx.fillText('m', W - 49, cy + 38);

    let lineY = cy + ch + 10;
    const pill = (txt, bg, fg) => {
      ctx.font = `800 18px ${FONT}`;
      const w = ctx.measureText(txt).width + 28;
      ctx.fillStyle = bg;
      roundRect(ctx, W / 2 - w / 2, lineY, w, 32, 16); ctx.fill();
      ctx.fillStyle = fg;
      ctx.fillText(txt, W / 2, lineY + 17);
      lineY += 40;
    };
    const gapPill = (g) => pill(window.Famille.fmtGap(g), g < 0 ? '#2e7d32' : '#c62828', '#ffffff');
    // record de la famille, affiché au départ
    if (S.ref && (S.mode === 'countdown' || (S.mode === 'race' && !S.started))) {
      pill(`Record : ${S.ref.prenom} ${fmt(S.ref.ms / 1000)}`, 'rgba(255,255,255,0.92)', '#1b2a44');
    }
    // temps intermédiaire (3 s), avec l'écart au record de la famille
    if (S.splitMsg && S.t - S.splitMsg.t0 < CFG.splitShowTime) {
      pill(`Inter ${S.splitMsg.i + 1} : ${fmt(S.splitMsg.t)}`, '#ffca28', '#1b2a44');
      const rs = S.ref && (S.splitMsg.i ? S.ref.i2 : S.ref.i1);
      if (rs) gapPill(S.splitMsg.t - rs / 1000);
    }
    // écart final à l'arrivée
    if (S.ref && S.finalTime !== null && (S.mode === 'finishing' || S.mode === 'results')) gapPill(S.finalTime - S.ref.ms / 1000);

    // banderole d'obstacle
    if (S.banner) {
      const e = S.t - S.banner.t0, dur = CFG.bannerTime + 0.6;
      if (e > dur) S.banner = null;
      else {
        const slide = Math.min(1, e / 0.3) * Math.min(1, (dur - e) / 0.3);
        const bh = 40, y = lineY - (1 - slide) * (bh + lineY);
        ctx.font = `900 22px ${FONT}`;
        const w = Math.min(W - 24, ctx.measureText(S.banner.text).width + 56);
        ctx.save();
        ctx.translate(W / 2, y + bh / 2);
        ctx.rotate(-0.02);
        const noir = S.banner.style === 'noir';
        ctx.fillStyle = noir ? '#000000' : '#c62828';
        ctx.beginPath(); ctx.moveTo(-w / 2 - 14, -bh / 2 + 6); ctx.lineTo(-w / 2, -bh / 2 + 6); ctx.lineTo(-w / 2, bh / 2 + 6); ctx.lineTo(-w / 2 - 14, bh / 2 + 6); ctx.lineTo(-w / 2 - 6, 6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w / 2 + 14, -bh / 2 + 6); ctx.lineTo(w / 2, -bh / 2 + 6); ctx.lineTo(w / 2, bh / 2 + 6); ctx.lineTo(w / 2 + 14, bh / 2 + 6); ctx.lineTo(w / 2 + 6, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = noir ? '#1a1a1a' : '#e53935';
        roundRect(ctx, -w / 2, -bh / 2, w, bh, 6); ctx.fill();
        ctx.strokeStyle = noir ? '#ffffff' : '#ffca28'; ctx.lineWidth = 2.5;
        roundRect(ctx, -w / 2 + 4, -bh / 2 + 4, w - 8, bh - 8, 4); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(S.banner.text, 0, 2);
        ctx.restore();
      }
    }

    // compte à rebours
    if (S.mode === 'countdown' || (S.mode === 'race' && S.countdown > -0.4)) {
      const cd = S.countdown;
      let txt, col = '#ffffff';
      if (cd > 2.6) txt = '3'; else if (cd > 1.6) txt = '2'; else if (cd > 0.6) txt = '1'; else { txt = 'Partez !'; col = '#ffca28'; }
      const frac = cd > 0.6 ? (cd - 0.6) % 1 : 0.5;
      const size = txt.length > 1 ? 64 : 110 + frac * 30;
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(27,42,68,0.85)';
      ctx.strokeText(txt, W / 2, H * 0.55);
      ctx.fillStyle = col;
      ctx.fillText(txt, W / 2, H * 0.55);
    }
  }

  function drawJoystick() {
    const t = input.touch;
    if (!t || (S.mode !== 'race' && S.mode !== 'countdown')) return;
    const r = canvas.getBoundingClientRect();
    const ox = t.ox - r.left, oy = t.oy - r.top;
    let dx = t.x - t.ox, dy = t.y - t.oy;
    const d = Math.hypot(dx, dy), max = 55;
    if (d > max) { dx *= max / d; dy *= max / d; }
    ctx.strokeStyle = 'rgba(27,42,68,0.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ox, oy, max, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(27,42,68,0.35)';
    ctx.beginPath(); ctx.arc(ox + dx, oy + dy, 22, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- Écrans ----------
  const screens = {
    home: document.getElementById('screen-home'),
    fall: document.getElementById('screen-fall'),
    timeout: document.getElementById('screen-timeout'),
    results: document.getElementById('screen-results'),
    board: document.getElementById('screen-board'),
    skis: document.getElementById('screen-skis')
  };
  function showScreen(name) {
    for (const [k, el] of Object.entries(screens)) el.classList.toggle('visible', k === name);
    document.body.classList.toggle('accueil', name === 'home');
    if (name === null) S.endShown = false;
  }
  function showResults() {
    S.mode = 'results';
    document.getElementById('res-time').textContent = fmt(S.finalTime);
    document.getElementById('res-s1').textContent = fmt(S.splits[0]);
    document.getElementById('res-s2').textContent = fmt(S.splits[1]);
    const ref = window.Famille && Famille.reference && S.ref;
    ['res-g1', 'res-g2'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (!el) return;
      const rs = ref && (i ? ref.i2 : ref.i1);
      if (rs && S.splits[i] !== undefined) {
        const g = S.splits[i] - rs / 1000;
        el.textContent = Famille.fmtGap(g); el.className = 'gap ' + (g < 0 ? 'good' : 'bad');
      } else { el.textContent = ''; el.className = 'gap'; }
    });
    if (window.Famille) Famille.fillResults();
    showScreen('results');
  }
  // « Jouer » (accueil, classement) : on passe d'abord par le choix des skis.
  // « Rejouer » repart tout de suite avec la même paire ; « Changer de skis » rouvre le choix.
  function play() {
    if (window.Famille && !Famille.canPlay()) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (window.Sons) Sons.unlock();
    openSkis();
  }
  function replay() {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    resetRace();
  }

  // ---------- V3 : choix des skis ----------
  function drawSkiPair(c, model) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 54, h = c.clientHeight || 120;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.lineJoin = 'round'; g.lineCap = 'round';
    const one = (cx) => {
      const sw = w * 0.3, top = 6, bot = h - 4;
      // planche avec spatule arrondie en haut
      const path = () => {
        g.beginPath();
        g.moveTo(cx - sw / 2, bot);
        g.lineTo(cx - sw / 2, top + sw * 0.9);
        g.quadraticCurveTo(cx - sw / 2, top, cx, top);
        g.quadraticCurveTo(cx + sw / 2, top, cx + sw / 2, top + sw * 0.9);
        g.lineTo(cx + sw / 2, bot);
        g.closePath();
      };
      path(); g.fillStyle = '#16202e'; g.fill();
      g.save(); g.translate(cx, (top + bot) / 2); g.scale(0.78, 0.97); g.translate(-cx, -(top + bot) / 2);
      path();
      if (model.id === 'rhea') {
        g.fillStyle = '#b5793a'; g.fill(); g.clip();
        g.strokeStyle = 'rgba(90,50,20,0.55)'; g.lineWidth = 1;
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(cx + k * sw * 0.16, top); g.bezierCurveTo(cx + k * sw * 0.16 + 3, h * 0.4, cx + k * sw * 0.16 - 3, h * 0.6, cx + k * sw * 0.16, bot); g.stroke(); }
      } else if (model.id === 'bec') {
        g.fillStyle = '#e53935'; g.fill(); g.clip();
        g.fillStyle = '#ffca28'; g.fillRect(cx - sw, top, sw * 2, sw * 0.9);
        g.fillStyle = '#ffffff'; g.fillRect(cx - sw, h * 0.62, sw * 2, 3);
      } else {
        g.fillStyle = '#15171c'; g.fill(); g.clip();
        g.fillStyle = '#00e5ff'; g.fillRect(cx - 1.5, top, 3, bot - top);
        g.fillStyle = '#ff2e88'; g.fillRect(cx - sw, top + sw * 0.6, sw * 2, 2.5);
        g.fillStyle = '#ff2e88'; g.fillRect(cx - sw, bot - 14, sw * 2, 2.5);
      }
      g.restore();
      // fixation
      const fy = h * 0.55;
      if (model.id === 'rhea') {
        g.fillStyle = '#5a3a1c'; g.fillRect(cx - sw / 2 - 1, fy - 6, sw + 2, 4); g.fillRect(cx - sw / 2 - 1, fy + 4, sw + 2, 4);
        g.fillStyle = '#9aa3ad'; g.fillRect(cx - sw * 0.3, fy - 9, sw * 0.6, 3);
      } else {
        g.fillStyle = model.id === 'fourcade' ? '#00e5ff' : '#2b2f36';
        g.fillRect(cx - sw * 0.38, fy - 9, sw * 0.76, 6);
        g.fillRect(cx - sw * 0.38, fy + 6, sw * 0.76, 6);
        g.fillStyle = '#c9ced6'; g.fillRect(cx - sw * 0.2, fy - 2, sw * 0.4, 8);
      }
    };
    g.clearRect(0, 0, w, h);
    one(w * 0.3); one(w * 0.7);
  }

  function skiStats() {
    const box = document.getElementById('ski-stats');
    const grip = Math.round((ski.grip - 1) * 100);
    const row = (label, frac, text) => `<span>${label}</span><span class="bar" title="${text}"><span style="width:${Math.round(frac * 100)}%"></span></span>` +
      `<span></span><span class="ski-model">${text}</span>`;
    box.innerHTML =
      row('Vitesse', (ski.max - 60) / 45, `${ski.max} km/h en schuss`) +
      row('Freinage', (20 - ski.min) / 17, `chasse-neige jusqu'à ${ski.min} km/h`) +
      row('Virages', (ski.grip - 0.6) / 0.8, grip ? `adhérence ${grip > 0 ? '+' : '−'}${Math.abs(grip)} %` : 'adhérence de référence') +
      (ski.carre ? `<span class="ski-model carre-text">⚠ Au-dessus de ${ski.carre.vitesse} km/h, relâcher puis redonner la même direction trop vite : faute de carre !</span>` : '');
  }

  function openSkis() {
    const list = document.getElementById('ski-list');
    if (!list.children.length) {
      list.innerHTML = SKIS.map((k) => `<button class="ski-card" type="button" data-ski="${k.id}"><canvas aria-hidden="true"></canvas><b>${k.nom}</b><i>${k.devise}</i></button>`).join('');
      list.querySelectorAll('.ski-card').forEach((b) => b.addEventListener('click', () => {
        ski = SKIS.find((k) => k.id === b.dataset.ski) || ski;
        list.querySelectorAll('.ski-card').forEach((x) => x.classList.toggle('sel', x === b));
        skiStats();
      }));
    }
    showScreen('skis');
    list.querySelectorAll('.ski-card').forEach((b) => {
      b.classList.toggle('sel', b.dataset.ski === ski.id);
      drawSkiPair(b.querySelector('canvas'), SKIS.find((k) => k.id === b.dataset.ski));
    });
    skiStats();
  }
  document.getElementById('ski-go').addEventListener('click', replay);
  document.querySelectorAll('[data-action="play"]').forEach((b) => b.addEventListener('click', play));
  document.querySelectorAll('[data-action="replay"]').forEach((b) => b.addEventListener('click', replay));
  document.querySelectorAll('[data-action="skis"]').forEach((b) => b.addEventListener('click', openSkis));
  document.querySelectorAll('[data-action="home"]').forEach((b) => b.addEventListener('click', goHome));

  function goHome() {
    S.mode = 'home';
    S.x = TRACK.center(CFG.startY); S.y = CFG.startY; S.v = 0; S.th = 0; S.started = false; S.gateOpen = 0;
    S.particles = []; S.trail = [];
    S.camX = S.x; S.camY = S.y - viewH() * CFG.skierScreenFrac;
    showScreen('home');
    if (window.Sons) { Sons.on.stop(); Sons.music(true); }
    if (window.Famille) Famille.updateHome();
  }

  // Skieur de l'écran d'accueil
  function drawHomeSkier() {
    const c = document.getElementById('home-skier');
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 160, h = c.clientHeight || 190;
    c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    drawSkier(g, w / 2, h * 0.78, h * 0.72, { theta: 0.25, crouch: 0 });
  }

  // ---------- Boucle ----------
  let last = performance.now(), acc = 0;
  const FIXED = 1 / 120;
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (S.mode !== 'home') {
      acc += dt;
      while (acc >= FIXED) { step(FIXED); acc -= FIXED; }
    } else {
      S.t += dt;
    }
    if (window.Sons) {
      const active = S.mode === 'race' || S.mode === 'finishing';
      Sons.update(dt, {
        moving: active, v: S.v,
        turn: S.mode === 'race' ? (S.turnAmt || 0) : 0,
        brake: S.mode === 'race' && input.brake,
        skid: S.mode === 'finishing' && S.skidding,
        heavy: S.mode === 'race' && S.heavy,
        // bip de recul quand un chasse-neige est à l'écran (plus fort quand il est proche)
        reverse: (S.mode === 'race' || S.mode === 'countdown') ? plows.reduce((m, e) => {
          const top = S.camY - CFG.plowL / 2, bot = S.camY + viewH() + CFG.plowL / 2;
          if (e.y < top || e.y > bot) return m;
          return Math.max(m, 1 - Math.min(1, Math.abs(e.y - S.y) / (viewH() * 1.2)));
        }, 0) : 0,
        // V4 : souffle des canons à neige pendant qu'ils marchent, plus fort quand on est près d'eux
        canon: (CANONS && S.mode !== 'home') ? fogLevel(S.fogT) * Math.max(0.35, 1 - Math.min(1, Math.max(0, Math.max(CANONS.top - S.y, S.y - CANONS.bot)) / 60)) : 0,
        progress: Math.max(0, Math.min(1, S.y / FINISH)),
        ambient: S.mode === 'race' || S.mode === 'countdown'
      });
    }
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => { resize(); drawHomeSkier(); });
  resize();
  if (window.Famille) Famille.init();
  goHome();
  drawHomeSkier();
  requestAnimationFrame(frame);

  // Accès pour les tests automatiques et le dessin des icônes
  window.PTPSC = { drawSkier, state: S, input, track: TRACK, bumps, plows, muds, ecole: ECOLE, canons: CANONS, biathlete: BIATH, lhuillier: LHU, skis: SKIS, setSki: (id) => { ski = SKIS.find((k) => k.id === id) || ski; }, cfg: CFG, step, fmt, resetRace, goHome, showScreen };
})();
