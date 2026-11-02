// Pas Très Pentu Ski Cup — page d'accueil (V3) : musique au premier toucher, bande du tire-fesses.
(() => {
  'use strict';
  const home = document.getElementById('screen-home');

  // Musique d'attente : les navigateurs bloquent le son avant le premier toucher de l'écran.
  const firstTouch = () => {
    if (window.Sons && home.classList.contains('visible')) { Sons.unlock(); Sons.music(true); }
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(ev, firstTouch, { capture: true, passive: true });

  // ---------- Bande du tire-fesses (écrans larges seulement) ----------
  // Le skieur reste en place, accroché à sa perche ; le paysage défile vers le bas.
  const c = document.getElementById('tirefesses');
  if (!c) return;
  const g = c.getContext('2d');
  let w = 0, h = 0, dpr = 1, last = performance.now(), scroll = 0;
  const SPEED = 38; // pixels par seconde

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = c.clientWidth; h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  }
  const hash = (n) => { const s = Math.sin(n * 91.7 + 13.3) * 43758.5453; return s - Math.floor(s); };

  function tree(x, y, s) {
    g.fillStyle = 'rgba(60,90,140,0.18)';
    g.beginPath(); g.ellipse(x + 4 * s, y + 2 * s, 12 * s, 4 * s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6b4a2b'; g.fillRect(x - 2 * s, y - 5 * s, 4 * s, 6 * s);
    const layers = [[0, 15, 12], [-10, 12, 11], [-19, 9, 10]];
    for (const [dy, hw, hh] of layers) {
      g.fillStyle = '#1f5b3a';
      g.beginPath(); g.moveTo(x, y - 5 * s + dy * s - hh * s); g.lineTo(x + hw * s, y - 5 * s + dy * s); g.lineTo(x - hw * s, y - 5 * s + dy * s); g.closePath(); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(x, y - 5 * s + dy * s - hh * s); g.lineTo(x + hw * 0.35 * s, y - 5 * s + dy * s - hh * 0.55 * s); g.lineTo(x - hw * 0.35 * s, y - 5 * s + dy * s - hh * 0.55 * s); g.closePath(); g.fill();
    }
  }

  function draw(now) {
    requestAnimationFrame(draw);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!document.body.classList.contains('accueil') || getComputedStyle(c).display === 'none') return;
    if (c.clientWidth !== w || c.clientHeight !== h) size();
    scroll += SPEED * dt;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // neige et piste de la remontée
    g.fillStyle = '#e4edf7'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f6f9fd'; g.fillRect(w * 0.2, 0, w * 0.6, h);
    // traces de la remontée (deux sillons sous les skis)
    const upX = w * 0.42, downX = w * 0.68;
    g.strokeStyle = 'rgba(140,165,200,0.45)'; g.lineWidth = 1.4;
    for (const dx of [-5, 5]) { g.beginPath(); g.moveTo(upX + dx, 0); g.lineTo(upX + dx, h); g.stroke(); }
    // sapins des bords, qui défilent vers le bas
    const gap = 46;
    for (let k = Math.floor(-scroll / gap) - 1; k * gap + scroll < h + 40; k++) {
      const y = k * gap + scroll;
      tree(w * 0.1 + hash(k) * 8, y, 0.8 + hash(k + 3) * 0.2);
      tree(w * 0.92 - hash(k + 7) * 8, y + 20, 0.8 + hash(k + 5) * 0.2);
    }
    // pylônes de la remontée, tous les 260 px
    const pyl = 260;
    for (let k = Math.floor(-scroll / pyl) - 1; k * pyl + scroll < h + 60; k++) {
      const y = k * pyl + scroll + 40;
      g.fillStyle = 'rgba(60,90,140,0.2)'; g.beginPath(); g.ellipse((upX + downX) / 2 + 6, y + 4, 26, 5, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#5d6b7d'; g.lineWidth = 4;
      g.beginPath(); g.moveTo((upX + downX) / 2, y); g.lineTo((upX + downX) / 2, y - 30); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(upX - 4, y - 30); g.lineTo(downX + 4, y - 30); g.stroke();
    }
    // câbles
    g.strokeStyle = '#3b4655'; g.lineWidth = 1.5;
    for (const x of [upX, downX]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    // perches vides qui redescendent (elles défilent deux fois plus vite)
    const per = 120;
    const down = scroll * 2;
    for (let k = Math.floor(-down / per) - 1; k * per + down < h + 40; k++) {
      const y = k * per + down;
      g.strokeStyle = '#7d8896'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(downX, y); g.lineTo(downX, y + 26); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(downX - 7, y + 26); g.lineTo(downX + 7, y + 26); g.stroke();
    }
    // perches qui montent avec le skieur (immobiles à l'écran), et le skieur
    const sy = h * 0.6;
    for (let k = -6; k <= 6; k++) {
      const y = sy + k * per;
      if (y < -40 || y > h + 40) continue;
      g.strokeStyle = '#7d8896'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(upX, y - 34); g.lineTo(upX, y - 8); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(upX - 7, y - 8); g.lineTo(upX + 7, y - 8); g.stroke();
    }
    if (window.PTPSC && PTPSC.drawSkier) {
      const t = now / 1000;
      PTPSC.drawSkier(g, upX, sy + 22, 54, { theta: Math.sin(t * 1.3) * 0.03, crouch: 0.15, t });
      // la perche passe devant, entre les jambes
      g.strokeStyle = '#7d8896'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(upX - 7, sy - 8); g.lineTo(upX + 7, sy - 8); g.stroke();
    }
    // brume légère en haut et en bas pour fondre la bande dans le décor
    const fade = g.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(201,216,234,1)'); fade.addColorStop(0.08, 'rgba(201,216,234,0)');
    fade.addColorStop(0.92, 'rgba(201,216,234,0)'); fade.addColorStop(1, 'rgba(201,216,234,1)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);
  }
  requestAnimationFrame(draw);
})();
