// Pas Très Pentu Ski Cup — page d'accueil (V3) : son (vent, V4.1) au premier toucher ; forêt de sapins (V5).
(() => {
  'use strict';
  const home = document.getElementById('screen-home');

  // Musique d'attente. Les navigateurs interdisent le son tant qu'on n'a pas touché la page :
  // on essaie quand même dès le chargement (certains le permettent), sinon elle part au
  // premier toucher, n'importe où sur l'écran. Une bulle « 🎵 » le rappelle en attendant.
  const hint = document.getElementById('music-hint');
  const refresh = () => {
    if (!hint || !window.Sons) return;
    hint.hidden = Sons.running() || Sons.isMuted() || !home.classList.contains('visible');
  };
  const firstTouch = () => {
    if (window.Sons && home.classList.contains('visible')) { Sons.unlock(); Sons.music(true); }
    setTimeout(refresh, 300);
  };
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click']) document.addEventListener(ev, firstTouch, { capture: true, passive: true });
  if (window.Sons && Sons.supported()) {
    Sons.onState(refresh);
    Sons.onChange(refresh);
    new MutationObserver(refresh).observe(home, { attributes: true, attributeFilter: ['class'] });
    if (home.classList.contains('visible')) { Sons.unlock(); Sons.music(true); }
    refresh();
  }

  // ---------- V5 : forêt de sapins en perspective (remplace l'ombre chinoise du Vercors et le tire-fesses) ----------
  // Elle commence sous la ligne de crêtes du logo et descend jusqu'au bas de l'écran : petits sapins gris-bleu
  // au loin, en haut, puis de plus en plus grands et verts vers le bas.
  const c = document.getElementById('foret');
  const logo = home.querySelector('.logo');
  if (!c || !logo) return;
  const g = c.getContext('2d');
  const hash = (n) => { const s = Math.sin(n * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  // couleurs du feuillage (clair, ombre) et de la neige au sol, du plus lointain au plus proche
  const FAR = { leaf: [150, 172, 198], shade: [132, 155, 184], snow: [214, 226, 241] };
  const MID = { leaf: [74, 122, 128], shade: [58, 104, 112], snow: [228, 237, 247] };
  const NEAR = { leaf: [31, 94, 58], shade: [22, 74, 45], snow: [244, 248, 253] };
  const colorAt = (d, key) => d < 0.5 ? mix(FAR[key], MID[key], d / 0.5) : mix(MID[key], NEAR[key], (d - 0.5) / 0.5);

  function tree(x, base, h, d, k) {
    const w = h * 0.62, leaf = rgb(colorAt(d, 'leaf')), shade = rgb(colorAt(d, 'shade'));
    const snowA = 0.35 + d * 0.6;
    if (d > 0.35) { g.fillStyle = `rgba(90,110,140,${0.12 * d})`; g.beginPath(); g.ellipse(x + w * 0.15, base, w * 0.45, h * 0.06, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = rgb(mix([150, 160, 175], [109, 76, 47], d));
    g.fillRect(x - w * 0.06, base - h * 0.14, w * 0.12, h * 0.14);
    for (let i = 0; i < 3; i++) {
      const yb = base - h * 0.1 - i * h * 0.25, yt = yb - h * 0.45, hw = w * (0.5 - i * 0.12) * (0.92 + hash(k + i) * 0.16);
      g.fillStyle = leaf;
      g.beginPath(); g.moveTo(x, yt); g.lineTo(x + hw, yb); g.lineTo(x - hw, yb); g.closePath(); g.fill();
      g.fillStyle = shade;
      g.beginPath(); g.moveTo(x, yt); g.lineTo(x + hw, yb); g.lineTo(x + hw * 0.15, yb); g.closePath(); g.fill();
      // neige sur les branches
      g.fillStyle = `rgba(248,251,255,${snowA})`;
      g.beginPath(); g.moveTo(x - hw * 0.95, yb);
      g.quadraticCurveTo(x - hw * 0.5, yb - h * 0.08, x, yb - h * 0.02);
      g.quadraticCurveTo(x + hw * 0.5, yb - h * 0.08, x + hw * 0.95, yb);
      g.closePath(); g.fill();
    }
  }

  function draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    // haut de la forêt : sous la ligne de crêtes du logo (vers le milieu de l'image)
    const hr = home.getBoundingClientRect(), lr = logo.getBoundingClientRect();
    const top = Math.max(40, lr.top - hr.top + lr.height * 0.7);
    // neige du sous-bois, plus claire vers le bas
    const sg = g.createLinearGradient(0, top - 10, 0, h);
    sg.addColorStop(0, 'rgba(214,226,241,0)'); sg.addColorStop(0.08, 'rgb(214,226,241)'); sg.addColorStop(1, 'rgb(244,248,253)');
    g.fillStyle = sg; g.fillRect(0, top - 10, w, h - top + 10);
    // rangées de sapins, des plus lointaines (petites) aux plus proches (grandes)
    let y = top, row = 0;
    while (y < h + 80) {
      const d = Math.min(1, Math.max(0, (y - top) / Math.max(1, h - top)));
      const th = 10 + Math.pow(d, 1.6) * 120;            // hauteur des sapins de la rangée (px)
      const gap = th * (0.75 + hash(row * 3.3) * 0.2);   // écart entre deux sapins de la rangée
      let x = -hash(row * 7.1) * gap;
      let k = row * 100;
      while (x < w + gap) {
        k++;
        if (hash(k * 1.3) > 0.3) tree(x + (hash(k) - 0.5) * gap * 0.5, y + (hash(k * 2.7) - 0.5) * th * 0.12, th * (0.85 + hash(k * 4.1) * 0.3), d, k);
        x += gap * (0.8 + hash(k * 5.9) * 0.4);
      }
      y += Math.max(5, th * 0.3);
      row++;
    }
    // légère brume sur les rangées du fond
    const fog = g.createLinearGradient(0, top - 20, 0, top + (h - top) * 0.35);
    fog.addColorStop(0, 'rgba(212,232,253,0.55)'); fog.addColorStop(1, 'rgba(212,232,253,0)');
    g.fillStyle = fog; g.fillRect(0, top - 20, w, (h - top) * 0.35 + 20);
  }
  let pending = 0;
  const later = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; if (home.classList.contains('visible')) draw(); }); };
  window.addEventListener('resize', later);
  if (window.ResizeObserver) new ResizeObserver(later).observe(home);
  new MutationObserver(later).observe(home, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  logo.addEventListener('load', later);
  later();
})();
