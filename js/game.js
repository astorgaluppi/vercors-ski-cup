// Pas Très Pentu Ski Cup — V1
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
    bannerTime: 2, bannerCooldown: 5, splitShowTime: 3
  };

  const P = window.PISTE_V1;
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
    let k = 1000;
    for (const f of P.champsDeBosses) {
      let row = 0;
      const dy = f.ecartRangs || 5.5, dx = f.ecartBosses || 5.2;
      for (let y = f.debut; y <= f.debut + f.longueur; y += dy, row++) {
        const c = TRACK.center(y), hw = TRACK.halfW(y);
        for (let x = -hw + (row % 2 ? 0.3 : 0.8) * dx; x < hw - 0.6; x += dx) {
          k++;
          bumps.push({ x: c + x + (hash(k) - 0.5) * 0.8, y: y + (hash(k + 9) - 0.5) * 1.2, r: CFG.bumpRadius * (0.9 + hash(k * 7) * 0.2), hit: false });
        }
      }
    }
    bumps.sort((a, b) => a.y - b.y);
  })();

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
      g.strokeStyle = LOOK.outline; g.lineWidth = 5.2 * u;
      g.beginPath(); g.moveTo(fx - dx * 12 * u, -dy * 12 * u); g.lineTo(fx + dx * 19 * u, dy * 19 * u); g.stroke();
      g.strokeStyle = LOOK.ski; g.lineWidth = 3.4 * u;
      g.beginPath(); g.moveTo(fx - dx * 12 * u, -dy * 12 * u); g.lineTo(fx + dx * 16 * u, dy * 16 * u); g.stroke();
      g.strokeStyle = LOOK.skiTip;
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
      g.fillStyle = LOOK.outline;
      roundRect(g, bx - 5.6 * u, -9.6 * u, 11.2 * u, 11 * u, 3 * u); g.fill();
      g.fillStyle = LOOK.boot;
      roundRect(g, bx - 4.6 * u, -8.6 * u, 9.2 * u, 9 * u, 2.5 * u); g.fill();
      g.fillStyle = LOOK.bootLight;
      roundRect(g, bx - 3.6 * u, -8 * u, 3 * u, 6 * u, 1.5 * u); g.fill();
      g.fillStyle = LOOK.buckle;
      g.fillRect(bx - 4 * u, -6 * u, 8 * u, 1.1 * u);
      g.fillRect(bx - 4 * u, -3.4 * u, 8 * u, 1.1 * u);
    };
    // jambes
    const leg = (fx) => {
      const kx = fx * 0.9 + bodyX * 0.5 + (c ? fx * 0.25 : 0);
      g.strokeStyle = LOOK.outline; g.lineWidth = 6.2 * u;
      g.beginPath(); g.moveTo(fx, -8 * u); g.lineTo(kx, -8 * u - legH * 0.5); g.lineTo(bodyX + fx * 0.6, hipY); g.stroke();
      g.strokeStyle = LOOK.skin; g.lineWidth = 4.4 * u;
      g.beginPath(); g.moveTo(fx, -8 * u); g.lineTo(kx, -8 * u - legH * 0.5); g.lineTo(bodyX + fx * 0.6, hipY); g.stroke();
    };
    leg(-spread * u); leg(spread * u);
    boot(-spread * u); boot(spread * u);

    // short de basket
    g.fillStyle = LOOK.outline;
    roundRect(g, bodyX - 9 * u, hipY - 6.5 * u, 18 * u, 10.5 * u, 2.5 * u); g.fill();
    g.fillStyle = LOOK.jersey;
    roundRect(g, bodyX - 8 * u, hipY - 5.5 * u, 16 * u, 8.5 * u, 2 * u); g.fill();
    g.fillStyle = LOOK.trim;
    g.fillRect(bodyX - 8 * u, hipY + 1.6 * u, 3 * u, 1.2 * u);
    g.fillRect(bodyX + 5 * u, hipY + 1.6 * u, 3 * u, 1.2 * u);
    g.fillStyle = LOOK.jerseyDark;
    g.fillRect(bodyX - 0.5 * u, hipY - 1 * u, 1 * u, 4 * u);

    // bras + bâtons (derrière le buste d'un côté, devant de l'autre : simple)
    const sx = bodyX, sy = shoulderY + 2 * u;
    const arm = (side) => {
      const hx = sx + side * (c ? 9 : 12) * u + fwd * 0.2;
      const hy = sy + (c ? 9 : 11) * u;
      // bâton
      g.strokeStyle = LOOK.pole; g.lineWidth = 1.5 * u;
      const px = hx + side * (c ? 6 : 3) * u, py = hy + (c ? -2 : 13) * u;
      const ex = c ? hx + side * 14 * u : px, ey = c ? hy - 12 * u : py;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.stroke();
      if (!c) { g.beginPath(); g.ellipse(px, py, 2.4 * u, 1 * u, 0, 0, Math.PI * 2); g.stroke(); }
      // bras
      g.strokeStyle = LOOK.outline; g.lineWidth = 5.4 * u;
      g.beginPath(); g.moveTo(sx + side * 7 * u, sy); g.lineTo(sx + side * 10.5 * u, sy + 6 * u); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = LOOK.skin; g.lineWidth = 3.8 * u;
      g.beginPath(); g.moveTo(sx + side * 7 * u, sy); g.lineTo(sx + side * 10.5 * u, sy + 6 * u); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = LOOK.skinDark;
      g.beginPath(); g.arc(hx, hy, 2 * u, 0, Math.PI * 2); g.fill();
    };
    arm(-1); arm(1);

    // débardeur
    const ty = shoulderY, tb = hipY - 4 * u;
    g.fillStyle = LOOK.outline;
    g.beginPath();
    g.moveTo(sx - 8.6 * u, ty - 1 * u); g.lineTo(sx + 8.6 * u, ty - 1 * u);
    g.lineTo(sx + 8.2 * u, tb + 1 * u); g.lineTo(sx - 8.2 * u, tb + 1 * u); g.closePath(); g.fill();
    g.fillStyle = LOOK.jersey;
    g.beginPath();
    g.moveTo(sx - 7.5 * u, ty); g.lineTo(sx - 4 * u, ty); g.lineTo(sx, ty + 3.4 * u); g.lineTo(sx + 4 * u, ty); g.lineTo(sx + 7.5 * u, ty);
    g.lineTo(sx + 7.2 * u, tb); g.lineTo(sx - 7.2 * u, tb); g.closePath(); g.fill();
    // liseré col et emmanchures
    g.strokeStyle = LOOK.trim; g.lineWidth = 1.1 * u;
    g.beginPath(); g.moveTo(sx - 4 * u, ty); g.lineTo(sx, ty + 3.4 * u); g.lineTo(sx + 4 * u, ty); g.stroke();
    g.beginPath(); g.moveTo(sx - 7.4 * u, ty + 0.5 * u); g.quadraticCurveTo(sx - 5.5 * u, ty + 4 * u, sx - 7.3 * u, ty + 7 * u); g.stroke();
    g.beginPath(); g.moveTo(sx + 7.4 * u, ty + 0.5 * u); g.quadraticCurveTo(sx + 5.5 * u, ty + 4 * u, sx + 7.3 * u, ty + 7 * u); g.stroke();
    // numéro 9
    const nH = Math.max(6, (tb - ty) - 5 * u);
    g.font = `900 ${nH}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 1.6 * u; g.strokeStyle = LOOK.jerseyDark;
    const ny = ty + 3.6 * u + (tb - ty - 3.6 * u) / 2;
    g.strokeText('9', sx, ny);
    g.fillStyle = LOOK.number;
    g.fillText('9', sx, ny);

    // cou + tête chauve
    g.fillStyle = LOOK.skinDark;
    g.fillRect(sx - 2.2 * u, ty - 3 * u, 4.4 * u, 3.6 * u);
    const hx = sx + Math.sin(th) * 1.5 * u, hy = ty - 8.6 * u;
    g.fillStyle = LOOK.outline;
    g.beginPath(); g.ellipse(hx, hy, 6.8 * u, 7.4 * u, 0, 0, Math.PI * 2); g.fill();
    // oreilles
    g.fillStyle = LOOK.skin;
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
    g.strokeStyle = '#4a2e1a'; g.lineWidth = 0.9 * u;
    g.beginPath(); g.moveTo(hx - 2.4 * u, hy - 1.6 * u); g.lineTo(hx - 0.9 * u, hy - 1.9 * u); g.stroke();
    g.beginPath(); g.moveTo(hx + 0.9 * u, hy - 1.9 * u); g.lineTo(hx + 2.4 * u, hy - 1.6 * u); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(hx - 2.2 * u, hy + 3 * u); g.quadraticCurveTo(hx, hy + 5.4 * u, hx + 2.2 * u, hy + 3 * u); g.closePath(); g.fill();
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
    particles: [], trail: [], lastTrailY: 0, gateOpen: 0, announced: {}
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
    input.keys.clear(); input.touch = null;
    showScreen(null);
  }

  const viewH = () => H / SCALE;

  function showBanner(text) {
    const now = S.t;
    if (S.bannerSeen[text] !== undefined && now - S.bannerSeen[text] < CFG.bannerCooldown) return;
    S.bannerSeen[text] = now;
    S.banner = { text, t0: now };
  }

  function fall(reason) {
    if (S.mode !== 'race') return;
    S.mode = 'fallen';
    S.fallT = 0;
    S.fallReason = reason;
    S.v *= reason === 'arbre' ? 0.15 : 0.5;
    puff(S.x, S.y, 26, 6);
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
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
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

    // banderole quand un champ de bosses entre par le bas
    const bottom = S.camY + viewH();
    for (const f of P.champsDeBosses) {
      if (!S.announced[f.debut] && bottom >= f.debut - 1 && S.y < f.debut + f.longueur && (S.mode === 'race' || S.mode === 'countdown')) {
        S.announced[f.debut] = true;
        showBanner('Champ de bosses !');
      }
    }
  }

  function raceStep(dt) {
    const prevY = S.y;
    // virage : vitesse de rotation = a / v (rayon R = v² / a)
    const grip = CFG.grip * (input.brake ? CFG.brakeGripMul : 1);
    const target = input.steer * CFG.maxAngle;
    const omega = Math.min(CFG.maxTurnRate, grip / Math.max(S.v, 0.5));
    const d = target - S.th;
    S.th += Math.sign(d) * Math.min(Math.abs(d), omega * dt);

    // vitesse
    const cos = Math.cos(S.th);
    if (input.brake) {
      if (S.v > CFG.brakeMin) S.v = Math.max(CFG.brakeMin, S.v - CFG.brakeDec * dt);
      else S.v = Math.min(CFG.brakeMin, S.v + CFG.slopeAcc * cos * dt);
    } else if (input.tuck) {
      if (S.v < CFG.schussMax) S.v = Math.min(CFG.schussMax, S.v + CFG.schussAcc * cos * dt);
    } else {
      if (S.v < CFG.slopeMax) S.v = Math.min(CFG.slopeMax, S.v + CFG.slopeAcc * cos * dt);
      else S.v = Math.max(CFG.slopeMax, S.v - CFG.overDec * dt);
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
      return;
    }

    // arrivée
    if (prevY < FINISH && S.y >= FINISH) {
      S.finalTime = S.clock - (S.y - FINISH) / Math.max(0.01, S.y - prevY) * dt;
      S.clock = S.finalTime;
      S.mode = 'finishing';
      // séquence automatique : on garde la direction du joueur pour choisir le côté de la courbe
      const side = S.th >= 0 ? 1 : -1;
      const yCurve = FINISH + 13, v1 = Math.min(S.v, 45 * KMH);
      S.skidSide = side;
      S.fin = { side, curving: false, yCurve, v1, dec1: Math.max(0, (S.v * S.v - v1 * v1) / (2 * (yCurve - FINISH))), D: 22, s: 0, stopped: false };
      return;
    }

    // sapins du bord
    const c = TRACK.center(S.y), hw = TRACK.halfW(S.y);
    if (Math.abs(S.x - c) > hw - CFG.edgeMargin && S.y > CFG.startY + 1) { fall('arbre'); return; }

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
    if (input.brake && S.v > CFG.brakeMin + 0.5) { if (Math.random() < 0.7) { spray(-1, 1); spray(1, 1); } }
    if (Math.abs(target - S.th) > 0.3 && S.v > 12 && Math.random() < 0.5) spray(Math.sign(S.th) || 1, 1);
  }

  function finishStep(dt) {
    // Séquence automatique après la ligne : grande courbe de freinage puis dérapage avec gerbe de neige.
    const f = S.fin;
    if (!f.curving) {
      // 1) ligne droite vers le centre de l'aire en ralentissant
      const tgt = Math.max(-0.35, Math.min(0.35, (STOP.x - S.x) * 0.06));
      S.th += (tgt - S.th) * (1 - Math.exp(-dt * 3));
      S.v = Math.max(f.v1, S.v - f.dec1 * dt);
      S.y += S.v * Math.cos(S.th) * dt;
      S.x += S.v * Math.sin(S.th) * dt;
      if (S.y >= f.yCurve) {
        f.curving = true; f.th0 = S.th;
        f.side = S.x > STOP.x + 1 ? -1 : (S.x < STOP.x - 1 ? 1 : f.side);
        f.thEnd = f.side * 100 * DEG; S.skidSide = f.side;
        f.dec = Math.max(2, (S.v * S.v) / (2 * f.D));
      }
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
    if (S.v <= 0.05) {
      if (S.v === 0 && !f.stopped) { f.stopped = true; puff(S.x - f.side * 0.8, S.y + 0.3, 18, 3); }
      S.v = 0;
      S.endTimer += dt;
      if (S.endTimer > 1.4 && !S.endShown) { S.endShown = true; showResults(); }
    }
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

    // aire d'arrêt
    if (yBot > STOP.y - STOP.r - 2) {
      ctx.fillStyle = '#f6f9fd';
      ctx.beginPath(); ctx.arc(wx(STOP.x), wy(STOP.y), STOP.r * SCALE, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,185,215,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wx(STOP.x), wy(STOP.y), (STOP.r - 0.5) * SCALE, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(200,215,235,0.7)';
      for (let r = 4; r < STOP.r; r += 4) { ctx.beginPath(); ctx.arc(wx(STOP.x), wy(STOP.y), r * SCALE, 0, Math.PI * 2); ctx.stroke(); }
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
        ctx.lineTo(wx(S.x + Math.cos(S.th) * 0.28 * side), wy(S.y));
        ctx.stroke();
      }
    }

    // bosses (au sol)
    for (let i = lowerBound(bumps, yTop); i < bumps.length && bumps[i].y < yBot; i++) {
      const b = bumps[i], sp = sprites.bump, k = b.r / CFG.bumpRadius;
      ctx.drawImage(sp.c, wx(b.x) - sp.w * k / 2, wy(b.y) - sp.h * k / 2, sp.w * k, sp.h * k);
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
    items.push({ y: S.y, draw: drawPlayer });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // neige soulevée
    ctx.fillStyle = '#ffffff';
    for (const p of S.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.beginPath(); ctx.arc(wx(p.x), wy(p.y), p.r * SCALE, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

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
      skid: S.mode === 'finishing' && (S.skidding || S.v === 0),
      skidSide: S.skidSide,
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
    // temps intermédiaire (3 s)
    if (S.splitMsg && S.t - S.splitMsg.t0 < CFG.splitShowTime) {
      const txt = `Inter ${S.splitMsg.i + 1} : ${fmt(S.splitMsg.t)}`;
      ctx.font = `800 18px ${FONT}`;
      const w = ctx.measureText(txt).width + 28;
      ctx.fillStyle = '#ffca28';
      roundRect(ctx, W / 2 - w / 2, lineY, w, 32, 16); ctx.fill();
      ctx.fillStyle = '#1b2a44';
      ctx.fillText(txt, W / 2, lineY + 17);
      lineY += 40;
    }

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
        ctx.fillStyle = '#c62828';
        ctx.beginPath(); ctx.moveTo(-w / 2 - 14, -bh / 2 + 6); ctx.lineTo(-w / 2, -bh / 2 + 6); ctx.lineTo(-w / 2, bh / 2 + 6); ctx.lineTo(-w / 2 - 14, bh / 2 + 6); ctx.lineTo(-w / 2 - 6, 6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(w / 2 + 14, -bh / 2 + 6); ctx.lineTo(w / 2, -bh / 2 + 6); ctx.lineTo(w / 2, bh / 2 + 6); ctx.lineTo(w / 2 + 14, bh / 2 + 6); ctx.lineTo(w / 2 + 6, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e53935';
        roundRect(ctx, -w / 2, -bh / 2, w, bh, 6); ctx.fill();
        ctx.strokeStyle = '#ffca28'; ctx.lineWidth = 2.5;
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
    results: document.getElementById('screen-results')
  };
  function showScreen(name) {
    for (const [k, el] of Object.entries(screens)) el.classList.toggle('visible', k === name);
    if (name === null) S.endShown = false;
  }
  function showResults() {
    S.mode = 'results';
    document.getElementById('res-time').textContent = fmt(S.finalTime);
    document.getElementById('res-s1').textContent = fmt(S.splits[0]);
    document.getElementById('res-s2').textContent = fmt(S.splits[1]);
    showScreen('results');
  }
  document.querySelectorAll('[data-action="play"]').forEach((b) => b.addEventListener('click', resetRace));
  document.querySelectorAll('[data-action="home"]').forEach((b) => b.addEventListener('click', goHome));

  function goHome() {
    S.mode = 'home';
    S.x = TRACK.center(CFG.startY); S.y = CFG.startY; S.v = 0; S.th = 0; S.started = false; S.gateOpen = 0;
    S.particles = []; S.trail = [];
    S.camX = S.x; S.camY = S.y - viewH() * CFG.skierScreenFrac;
    showScreen('home');
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
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => { resize(); drawHomeSkier(); });
  resize();
  goHome();
  drawHomeSkier();
  requestAnimationFrame(frame);

  // Accès pour les tests automatiques et le dessin des icônes
  window.PTPSC = { drawSkier, state: S, input, track: TRACK, bumps, cfg: CFG, step, fmt };
})();
