// Pas Très Pentu Ski Cup — V5 : ovation de l'arrivée, fabriquée par le jeu (aucun fichier son).
// Remplace les cloches de vache et la foule de la V2, jugées peu réalistes.
// Le son est calculé une seule fois, échantillon par échantillon, dans un « worker » (en arrière-plan,
// pour ne pas faire saccader le jeu), puis rejoué à chaque arrivée. Il mélange :
//  - des applaudissements nourris : quelque 260 spectateurs qui tapent chacun à leur rythme, puis s'arrêtent peu à peu ;
//  - des cris de joie : une soixantaine de voix d'hommes, de femmes et d'enfants (« ouais ! », « allez ! », « bravo ! »,
//    « ahhh ! »), très serrées au début (la clameur), puis quelques cris isolés ;
//  - trois ou quatre sifflets « à deux doigts » ;
//  - un peu d'écho de plein air, pour fondre le tout.
// buildOvation(sr) renvoie { L, R } : deux Float32Array à la fréquence d'échantillonnage sr.
// (part = 'claps', 'voix' ou 'sifflets' : seulement cette partie, pour les essais)
window.PTPSC_buildOvation = function buildOvation(sr, part) {
  'use strict';
  const DUR = 8;
  const N = Math.floor(DUR * sr);
  const L = new Float32Array(N), R = new Float32Array(N);

  // hasard reproductible (la même ovation sur tous les appareils)
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const rr = (a, b) => a + rnd() * (b - a);
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / 1.5; };

  // filtre passe-bande (gain 1 au centre), coefficients d'un biquad
  function bandpass(f, q) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    return { b0: al / a0, b2: -al / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - al) / a0 };
  }

  // ---------- Applaudissements ----------
  // Une banque de « claps » : bruit très court, coloré par le creux des mains (résonance entre 700 et 2 600 Hz).
  const KLEN = Math.floor(0.03 * sr);
  const kernels = [];
  for (let k = 0; k < 24; k++) {
    const far = k >= 16; // claps lointains, plus sourds
    const c = bandpass(rr(700, far ? 1500 : 2600), rr(1.2, 3.5));
    const tau = rr(0.003, 0.009) * sr, att = Math.max(1, Math.floor(0.0006 * sr));
    const out = new Float32Array(KLEN);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, lp = 0, peak = 1e-9;
    for (let i = 0; i < KLEN; i++) {
      const env = i < att ? i / att : Math.exp(-(i - att) / tau);
      const x = (rnd() * 2 - 1) * env;
      const y = c.b0 * x + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      // un peu du bruit brut pour le « claquement », moins pour les claps lointains
      let v = y * 0.9 + x * (far ? 0.03 : 0.12);
      if (far) { lp += (v - lp) * 0.35; v = lp; }
      out[i] = v;
      peak = Math.max(peak, Math.abs(v));
    }
    for (let i = 0; i < KLEN; i++) out[i] /= peak;
    kernels.push(out);
  }
  const CLAPPERS = part && part !== 'claps' ? 0 : 260;
  for (let c = 0; c < CLAPPERS; c++) {
    const far = rnd() < 0.45;
    const kern = kernels[far ? 16 + Math.floor(rnd() * 8) : Math.floor(rnd() * 16)];
    const pan = rr(-0.9, 0.9), gl = Math.sqrt(0.5 * (1 - pan)), gr = Math.sqrt(0.5 * (1 + pan));
    const amp = (far ? 0.25 : 0.55) * Math.exp(gauss() * 0.35);
    const rate = rr(3.4, 5.6); // claps par seconde
    let t = 0.04 + Math.pow(rnd(), 2.2) * 0.9; // la plupart démarrent tout de suite
    const stop = 3 + Math.pow(rnd(), 0.7) * 4.6; // puis ils s'arrêtent les uns après les autres
    while (t < stop) {
      // les derniers claps de chacun sont un peu plus faibles
      const fade = Math.min(1, (stop - t) / 1.2);
      const a = amp * (0.7 + rnd() * 0.5) * (0.35 + 0.65 * fade);
      const i0 = Math.floor(t * sr);
      for (let i = 0; i < KLEN && i0 + i < N; i++) { const v = kern[i] * a; L[i0 + i] += v * gl; R[i0 + i] += v * gr; }
      t += (1 / rate) * (1 + gauss() * 0.06);
    }
  }

  // ---------- Cris de joie ----------
  // Formants des voyelles (Hz) : la voix est une suite d'impulsions de la glotte, filtrée par la bouche.
  const V = { a: [760, 1300, 2600], e: [420, 2050, 2700], è: [560, 1800, 2550], o: [480, 900, 2600], ou: [330, 820, 2300], i: [310, 2250, 3000] };
  const WORDS = [['ou', 'è'], ['ou', 'è'], ['a', 'e'], ['a', 'o'], ['a', 'a'], ['o', 'ou'], ['ou', 'i'], ['è', 'è']];
  function voice(t0, dur, f0, vt, vowels, amp, pan, dist) {
    const n = Math.floor(dur * sr), i0 = Math.floor(t0 * sr);
    if (i0 >= N) return;
    const v1 = V[vowels[0]].map((f) => f * vt), v2 = V[vowels[1]].map((f) => f * vt);
    const bw = [90, 120, 170], gains = [1, 0.8, 0.45];
    const st = [0, 1, 2].map(() => ({ x1: 0, x2: 0, y1: 0, y2: 0, c: null }));
    const tr = rr(0.15, 0.35); // moment où l'on passe de la 1re à la 2e voyelle
    const gl = Math.sqrt(0.5 * (1 - pan)), gr = Math.sqrt(0.5 * (1 + pan));
    const vibF = rr(4.5, 6.5), vibA = rr(0.01, 0.025);
    let ph = rnd(), jit = 0, lp = 0, breathLp = 0;
    const lpk = Math.min(1, 2 * Math.PI * (dist ? 1800 : 5200) / sr);
    for (let i = 0; i < n && i0 + i < N; i++) {
      const q = i / n;
      if ((i & 63) === 0) {
        const m = Math.min(1, Math.max(0, (q - tr) / 0.12));
        for (let k = 0; k < 3; k++) {
          const f = v1[k] + (v2[k] - v1[k]) * m;
          st[k].c = bandpass(f, f / bw[k]);
        }
        jit += (gauss() * 0.004 - jit * 0.1);
      }
      // hauteur : monte vite, tient, puis retombe en fin de cri
      const contour = q < 0.2 ? 0.86 + 0.24 * (q / 0.2) : q < 0.65 ? 1.1 - 0.06 * ((q - 0.2) / 0.45) : 1.04 - 0.24 * ((q - 0.65) / 0.35);
      const f = f0 * contour * (1 + vibA * Math.sin(2 * Math.PI * vibF * i / sr) + jit);
      ph += f / sr;
      if (ph >= 1) ph -= 1;
      // impulsion de la glotte (dérivée de l'onde de Rosenberg) + un peu de souffle
      const src = ph < 0.4 ? Math.sin(Math.PI * ph / 0.4) : ph < 0.56 ? -2.2 * Math.sin(Math.PI * (ph - 0.4) / 0.32) : 0;
      breathLp += ((rnd() * 2 - 1) - breathLp) * 0.5;
      const x = src * 0.8 + breathLp * 0.35;
      let y = 0;
      for (let k = 0; k < 3; k++) {
        const s = st[k], c = s.c;
        const o = c.b0 * x + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2;
        s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = o;
        y += o * gains[k];
      }
      lp += (y - lp) * lpk;
      const env = Math.min(1, q / 0.06) * (q > 0.7 ? Math.max(0, 1 - (q - 0.7) / 0.3) : 1);
      const v = lp * env * amp;
      L[i0 + i] += v * gl; R[i0 + i] += v * gr;
    }
  }
  const speaker = () => {
    const r = rnd();
    // homme, femme ou enfant : hauteur de voix en criant et taille de la bouche
    if (r < 0.45) return { f0: rr(170, 240), vt: rr(0.95, 1.05) };
    if (r < 0.85) return { f0: rr(280, 380), vt: rr(1.1, 1.2) };
    return { f0: rr(360, 470), vt: rr(1.22, 1.32) };
  };
  const VOIX = !part || part === 'voix';
  // la clameur : beaucoup de voix ensemble, juste après le passage de la ligne
  for (let i = 0; i < (VOIX ? 46 : 0); i++) {
    const s = speaker(), dist = rnd() < 0.5;
    voice(0.08 + Math.pow(rnd(), 1.6) * 1.6, rr(0.7, 1.7), s.f0, s.vt, WORDS[Math.floor(rnd() * WORDS.length)],
      (dist ? 0.12 : 0.22) * Math.exp(gauss() * 0.3), rr(-0.85, 0.85), dist);
  }
  // relances : « allez ! », « bravo ! », « ouais ! » isolés
  for (let i = 0; i < (VOIX ? 16 : 0); i++) {
    const s = speaker();
    voice(rr(1.6, 5.8), rr(0.45, 0.9), s.f0, s.vt, WORDS[Math.floor(rnd() * WORDS.length)], 0.16 * Math.exp(gauss() * 0.3), rr(-0.8, 0.8), rnd() < 0.4);
  }

  // ---------- Sifflets à deux doigts ----------
  function whistle(t0, pan, amp) {
    const f0 = rr(2200, 2900), dur = rr(0.9, 1.5), n = Math.floor(dur * sr), i0 = Math.floor(t0 * sr);
    const gl = Math.sqrt(0.5 * (1 - pan)), gr = Math.sqrt(0.5 * (1 + pan));
    let ph = 0, nz = 0;
    for (let i = 0; i < n && i0 + i < N; i++) {
      const q = i / n;
      // « fiu… fiuuu » : une note courte qui monte, une petite pause, puis une longue qui monte et redescend
      let f, env;
      if (q < 0.25) { f = f0 * (0.85 + 0.25 * (q / 0.25)); env = Math.sin(Math.PI * q / 0.25); }
      else if (q < 0.33) { f = f0; env = 0; }
      else { const r = (q - 0.33) / 0.67; f = f0 * (0.9 + 0.3 * Math.sin(Math.PI * Math.min(1, r * 1.4)) - 0.15 * r); env = Math.min(1, r / 0.08) * (1 - Math.pow(r, 3)); }
      ph += f / sr;
      nz += ((rnd() * 2 - 1) - nz) * 0.3;
      const v = (Math.sin(2 * Math.PI * ph) + nz * 0.08) * env * amp;
      L[i0 + i] += v * gl; R[i0 + i] += v * gr;
    }
  }
  if (!part || part === 'sifflets') whistle(0.5, -0.5, 0.075);
  if (!part || part === 'sifflets') { whistle(1.4, 0.6, 0.06); whistle(2.9, -0.2, 0.05); whistle(4.3, 0.4, 0.045); }

  // ---------- Écho de plein air (petite réverbération) ----------
  function reverb(buf, off) {
    const combs = [1116, 1188, 1277, 1356].map((d) => ({ b: new Float32Array(Math.floor((d + off) * sr / 44100)), i: 0, f: 0 }));
    const aps = [556, 441].map((d) => ({ b: new Float32Array(Math.floor((d + off) * sr / 44100)), i: 0 }));
    const out = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      const x = buf[n] * 0.1;
      let y = 0;
      for (const c of combs) {
        const o = c.b[c.i];
        c.f = o * 0.65 + c.f * 0.35; // amorti : les aigus s'éteignent plus vite
        c.b[c.i] = x + c.f * 0.72;
        if (++c.i >= c.b.length) c.i = 0;
        y += o;
      }
      for (const a of aps) {
        const o = a.b[a.i];
        a.b[a.i] = y + o * 0.5;
        if (++a.i >= a.b.length) a.i = 0;
        y = o - y * 0.5;
      }
      out[n] = y;
    }
    return out;
  }
  const wl = reverb(L, 0), wr = reverb(R, 23);
  let peak = 1e-9;
  for (let n = 0; n < N; n++) {
    // passe-haut doux (on retire le grave inutile) + écho
    L[n] += wl[n] * 0.9; R[n] += wr[n] * 0.9;
  }
  let hl = 0, hr = 0, pl = 0, pr = 0;
  const hk = 2 * Math.PI * 120 / sr, lk = Math.min(1, 2 * Math.PI * 7000 / sr);
  let ll = 0, lr = 0;
  for (let n = 0; n < N; n++) {
    hl += (L[n] - hl) * hk; hr += (R[n] - hr) * hk;
    pl = L[n] - hl; pr = R[n] - hr;
    // passe-bas doux : comme dans une vraie prise de son, il reste peu d'extrême aigu
    ll += (pl - ll) * lk; lr += (pr - lr) * lk; pl = ll; pr = lr;
    // fin en fondu sur la dernière seconde
    const tail = n > N - sr ? (N - n) / sr : 1;
    L[n] = pl * tail; R[n] = pr * tail;
    peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
  }
  if (!part) for (let n = 0; n < N; n++) { L[n] *= 0.9 / peak; R[n] *= 0.9 / peak; }
  return { L, R };
};
