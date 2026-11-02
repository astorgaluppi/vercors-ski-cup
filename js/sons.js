// Pas Très Pentu Ski Cup — bruitages (V2)
// Tous les sons sont fabriqués par le jeu avec Web Audio : aucun fichier à télécharger (0 Ko).
// La glisse suit la vitesse et devient plus forte dans les virages et en chasse-neige ; cloches et foule sont jouées en fond.
window.Sons = (() => {
  'use strict';

  const KEY = 'ptpsc-son-coupe';
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) { /* stockage indisponible */ }

  let ac = null, master = null, noise = null;
  let glide = null, crowd = null;
  let bellTimer = 0, cheer = null, reverseTimer = 0;
  let clapBuses = [];
  const listeners = [];

  function supported() { return !!(window.AudioContext || window.webkitAudioContext); }

  // À appeler depuis un appui (bouton « Jouer ») : obligatoire sur iPhone.
  function unlock() {
    if (!supported()) return;
    // Un contexte audio fermé par le système ne repart jamais : on en refait un neuf
    if (ac && ac.state === 'closed') ac = null;
    if (!ac) {
      clapBuses = [];
      try {
        // Respecte le mode silencieux de l'iPhone quand le navigateur le permet
        if (navigator.audioSession) navigator.audioSession.type = 'ambient';
      } catch (e) { /* ignoré */ }
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp); comp.connect(ac.destination);
      noise = makeNoise(2);
      buildLoops();
    }
    wake();
    // petit son vide pour débloquer la sortie audio d'iOS
    const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource();
    s.buffer = b; s.connect(master); s.start(0);
  }

  // Relance le son s'il a été mis en pause par le navigateur. Sur iPhone, l'état peut être
  // « suspended » mais aussi « interrupted » (clavier, appel, autre appli, écran verrouillé…).
  function wake() {
    if (!ac || ac.state === 'running' || ac.state === 'closed') return;
    const p = ac.resume();
    if (p && p.catch) p.catch(() => {});
  }
  // Chaque appui ou touche est une occasion de relancer le son
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) {
    document.addEventListener(ev, wake, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('pageshow', wake);

  function makeNoise(seconds) {
    const n = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noiseSource() {
    const s = ac.createBufferSource();
    s.buffer = noise; s.loop = true;
    s.loopStart = Math.random(); // décalage pour que deux bruits ne soient pas identiques
    return s;
  }

  function panner(p) {
    if (ac.createStereoPanner) { const n = ac.createStereoPanner(); n.pan.value = p; return n; }
    return ac.createGain();
  }

  function buildLoops() {
    // Glisse : souffle filtré
    {
      const src = noiseSource();
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.7;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master);
      src.start();
      glide = { lp, g };
    }
    // Foule : murmure fait de bruits filtrés aux fréquences de la voix, qui ondulent lentement
    {
      const g = ac.createGain(); g.gain.value = 0;
      for (const [f, q, pan] of [[480, 4, -0.5], [900, 5, 0.4], [1500, 6, -0.2], [2500, 7, 0.6], [700, 4, 0.1]]) {
        const src = noiseSource();
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
        const amp = ac.createGain(); amp.gain.value = 0.5;
        const lfo = ac.createOscillator(); lfo.frequency.value = 0.6 + Math.random() * 1.8;
        const la = ac.createGain(); la.gain.value = 0.45;
        lfo.connect(la); la.connect(amp.gain);
        const p = panner(pan);
        src.connect(bp); bp.connect(amp); amp.connect(p); p.connect(g);
        src.start(); lfo.start();
      }
      g.connect(master);
      crowd = { g };
    }
  }

  // Change un réglage en douceur. On n'envoie un nouvel ordre que si la valeur change vraiment :
  // des milliers d'ordres par minute peuvent bloquer le son sur certains téléphones.
  const ramp = (param, value, tc = 0.08) => {
    const last = param.__target;
    if (last !== undefined && Math.abs(value - last) <= Math.max(1e-4, Math.abs(last) * 0.03) && param.__tc === tc) return;
    param.__target = value; param.__tc = tc;
    param.setTargetAtTime(value, ac.currentTime, tc);
  };

  // ---------- Sons ponctuels ----------
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function beep(high) {
    if (!ac) return;
    const t = ac.currentTime;
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = high ? 1320 : 660;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
    const g = ac.createGain();
    env(g, t, 0.01, 0.18, high ? 0.55 : 0.2);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.8);
  }

  // Bip de recul d'un engin : son carré aigu, 0,5 s
  function reverseBeep(vol) {
    const t = ac.currentTime + 0.01;
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 1050;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.55);
  }

  // Cloche de vache (sonnaille) : quelques partiels métalliques non harmoniques
  function cowbell(when, pitch, pan, vol) {
    const t = when;
    const out = ac.createGain(); out.gain.value = vol;
    const p = panner(pan);
    out.connect(p); p.connect(master);
    const parts = [[1, 1, 1.1], [1.49, 0.6, 0.9], [2.43, 0.45, 0.6], [3.96, 0.25, 0.35], [5.2, 0.12, 0.25]];
    for (const [r, a, d] of parts) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.value = pitch * r * (1 + (Math.random() - 0.5) * 0.01);
      const g = ac.createGain();
      env(g, t, 0.004, a, d);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + d + 0.05);
    }
    // petit choc du battant
    const s = ac.createBufferSource(); s.buffer = noise;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = pitch * 3; bp.Q.value = 3;
    const g = ac.createGain(); env(g, t, 0.002, 0.3, 0.05);
    s.connect(bp); bp.connect(g); g.connect(out);
    s.start(t, Math.random()); s.stop(t + 0.08);
  }

  function bellBurst(loud) {
    const pitch = 380 + Math.random() * 520;
    const pan = (Math.random() * 2 - 1) * 0.9;
    const vol = (0.025 + Math.random() * 0.03) * loud;
    const n = 1 + Math.floor(Math.random() * 3);
    let t = ac.currentTime + 0.02;
    for (let i = 0; i < n; i++) { cowbell(t, pitch, pan, vol * (1 - i * 0.2)); t += 0.18 + Math.random() * 0.25; }
  }

  // Applaudissement : un petit claquement de bruit envoyé vers l'un de 6 « coins » du public déjà
  // préparés (filtre + position), pour ne créer que deux éléments audio par claquement.
  function clap(when, pan, vol) {
    if (!clapBuses.length) {
      for (let i = 0; i < 6; i++) {
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100 + i * 220; bp.Q.value = 1.2;
        const p = panner(-0.9 + i * 0.36);
        bp.connect(p); p.connect(master);
        clapBuses.push(bp);
      }
    }
    const s = ac.createBufferSource(); s.buffer = noise;
    const g = ac.createGain(); env(g, when, 0.002, vol, 0.07);
    s.connect(g); g.connect(clapBuses[Math.min(5, Math.max(0, Math.round((pan + 0.9) / 0.36)))]);
    s.start(when, Math.random()); s.stop(when + 0.1);
  }

  function whistle(when) {
    const o = ac.createOscillator(); o.type = 'sine';
    const f = 1700 + Math.random() * 700;
    o.frequency.setValueAtTime(f, when);
    o.frequency.linearRampToValueAtTime(f * 1.35, when + 0.25);
    o.frequency.linearRampToValueAtTime(f * 1.05, when + 0.5);
    const g = ac.createGain(); env(g, when, 0.03, 0.035, 0.5);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + 0.6);
  }

  // Voix de foule : quelques voix sur une voyelle, avec une courbe de hauteur
  function crowdVoice(when, vowel, dur, vol, glideDown) {
    const formants = vowel === 'o' ? [[450, 8, 1], [800, 9, 0.5], [2830, 12, 0.08]] : [[700, 7, 1], [1150, 9, 0.6], [2700, 12, 0.12]];
    const out = ac.createGain(); env(out, when, dur * 0.18, vol, dur * 0.82);
    const filters = formants.map(([f, q, a]) => {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ac.createGain(); g.gain.value = a * 3;
      bp.connect(g); g.connect(out);
      return bp;
    });
    out.connect(master);
    for (let i = 0; i < 9; i++) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      const f0 = (i % 3 === 0 ? 210 : 130) * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f0 * (glideDown ? 1.15 : 0.95), when);
      o.frequency.linearRampToValueAtTime(f0 * (glideDown ? 0.8 : 1.2), when + dur);
      const p = panner((Math.random() * 2 - 1) * 0.8);
      o.connect(p);
      for (const f of filters) p.connect(f);
      o.start(when + Math.random() * 0.08); o.stop(when + dur + 0.1);
    }
  }

  // ---------- Événements du jeu ----------
  const on = {
    countdown(n) { beep(n === 0); },
    start() {
      if (!ac) return;
      ramp(crowd.g.gain, 0, 0.3); // pas de murmure de foule pendant la descente
    },
    fall(reason) {
      if (!ac) return;
      const t = ac.currentTime;
      // choc dans la neige
      const s = ac.createBufferSource(); s.buffer = noise;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(150, t + 0.5);
      const g = ac.createGain(); env(g, t, 0.005, 0.9, 0.55);
      s.connect(lp); lp.connect(g); g.connect(master);
      s.start(t); s.stop(t + 0.7);
      const o = ac.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.3);
      const og = ac.createGain(); env(og, t, 0.005, 0.5, 0.3);
      o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.4);
      if (reason === 'engin') {
        // « bong » métallique contre le chasse-neige
        cowbell(t, 180, 0, 0.25);
      }
      // « Oh ! » de la foule
      crowdVoice(t + 0.12, 'o', 1.1, 0.16, true);
      ramp(glide.g.gain, 0, 0.05);
      ramp(crowd.g.gain, 0, 1.5);
    },
    finish() {
      if (!ac) return;
      const t = ac.currentTime;
      // ovation : gros brouhaha, applaudissements nourris et cloches à toute volée
      ramp(crowd.g.gain, 0.5, 0.15);
      setTimeout(() => { if (ac && crowd) ramp(crowd.g.gain, 0, 1.5); }, 6000);
      crowdVoice(t + 0.05, 'a', 2.2, 0.3, false);
      crowdVoice(t + 1.8, 'a', 2.0, 0.22, false);
      crowdVoice(t + 3.6, 'a', 2.0, 0.16, false);
      cheer = { t0: t, until: t + 7 };
      bellTimer = 0;
      for (let i = 0; i < 7; i++) whistle(t + 0.2 + Math.random() * 4);
    },
    timeout() {
      if (!ac) return;
      ramp(crowd.g.gain, 0, 1);
      ramp(glide.g.gain, 0, 0.3);
      crowdVoice(ac.currentTime + 0.05, 'o', 1.2, 0.1, true);
    },
    stop() {
      if (!ac) return;
      ramp(crowd.g.gain, 0, 0.4); ramp(glide.g.gain, 0, 0.1);
      cheer = null;
    }
  };

  // Appelée à chaque image : vitesse (m/s), force du virage 0..1, chasse-neige, progression 0..1
  function update(dt, st) {
    if (!ac || ac.state !== 'running') return;
    const moving = st.moving && st.v > 0.3;
    const v = st.v;
    const sp = Math.min(1, v / 25);
    // Glisse : reste un souffle doux de poudreuse même à pleine vitesse (volume et aigus limités).
    // Virages et chasse-neige : même souffle, un peu plus fort (les skis raclent la neige)
    const carve = moving ? Math.min(1, st.turn * Math.min(1, v / 10) + (st.brake ? 0.8 : 0) + (st.skid ? 1 : 0)) : 0;
    ramp(glide.g.gain, moving ? 0.05 + sp * sp * 0.13 + (st.heavy ? 0.04 : 0) + carve * (0.13 + sp * 0.12) : 0, 0.08);
    ramp(glide.lp.frequency, (st.heavy ? 260 : 380) + sp * 1000 + carve * 500, 0.08);

    // bip bip de recul des chasse-neige à l'écran
    if (st.reverse > 0) {
      reverseTimer -= dt;
      if (reverseTimer <= 0) { reverseBeep(0.03 + st.reverse * 0.06); reverseTimer = 1.0; }
    } else reverseTimer = 0;

    // ovation à l'arrivée : applaudissements et cloches, qui diminuent doucement
    if (cheer) {
      const now = ac.currentTime;
      if (now > cheer.until) cheer = null;
      else {
        const fade = 1 - Math.max(0, (now - cheer.t0 - 3) / (cheer.until - cheer.t0 - 3));
        let n = 220 * fade * dt; // applaudissements par image
        while (n > 0) {
          if (n >= 1 || Math.random() < n) clap(now + Math.random() * dt, (Math.random() * 2 - 1) * 0.9, (0.06 + Math.random() * 0.08) * (0.4 + 0.6 * fade));
          n -= 1;
        }
        bellTimer -= dt;
        if (bellTimer <= 0) { bellBurst(4 * (0.3 + 0.7 * fade)); bellTimer = (0.08 + Math.random() * 0.15) / Math.max(0.3, fade); }
      }
    }
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ignoré */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.05);
    listeners.forEach((f) => f(muted));
  }

  return {
    unlock, update, on, supported,
    isMuted: () => muted,
    setMuted,
    toggle() { setMuted(!muted); },
    onChange(f) { listeners.push(f); f(muted); }
  };
})();
