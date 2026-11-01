// Pas Très Pentu Ski Cup — prénom du joueur, code famille et classement partagé (V2).
// Les scores sont dans Supabase : une ligne par joueur, mise à jour seulement quand il bat son record.
window.Famille = (() => {
  'use strict';

  const CONF = window.PTPSC_CONFIG || {};
  const URL = (CONF.supabaseUrl || '').replace(/\/+$/, '');
  const KEY = CONF.supabaseKey || '';
  const enabled = !!(URL && KEY);

  const LS = { name: 'ptpsc-prenom', code: 'ptpsc-code', pending: 'ptpsc-en-attente', board: 'ptpsc-classement' };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignoré */ } }
  };

  let board = [];        // classement : [{ prenom, meilleur_ms, date_record, descentes, inter1_ms, inter2_ms }]
  let boardOk = false;   // classement chargé depuis le serveur
  let lastRun = null;    // dernière descente terminée (pour l'écran des résultats)
  try { board = JSON.parse(store.get(LS.board) || '[]') || []; } catch (e) { board = []; }

  const $ = (id) => document.getElementById(id);

  // ---------- Prénom ----------
  function cleanName(s) {
    s = (s || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    return s ? s.charAt(0).toLocaleUpperCase('fr') + s.slice(1) : '';
  }
  const playerName = () => cleanName(store.get(LS.name));
  const familyCode = () => (store.get(LS.code) || '').trim();

  // ---------- Serveur ----------
  async function rpc(fn, body) {
    const headers = { 'Content-Type': 'application/json', apikey: KEY };
    if (!KEY.startsWith('sb_')) headers.Authorization = 'Bearer ' + KEY;
    const ctl = window.AbortController ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
    try {
      const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        const err = new Error((data && data.message) || ('Erreur ' + r.status));
        err.badCode = /code famille/i.test(err.message);
        err.server = true;
        throw err;
      }
      return data;
    } finally { clearTimeout(timer); }
  }

  async function loadBoard() {
    if (!enabled || !familyCode()) return board;
    const rows = await rpc('classement', { code: familyCode() });
    board = Array.isArray(rows) ? rows : [];
    boardOk = true;
    store.set(LS.board, JSON.stringify(board));
    return board;
  }

  // Descentes pas encore envoyées (pas de réseau) : on les garde et on réessaie plus tard
  function pending() { try { return JSON.parse(store.get(LS.pending) || '[]') || []; } catch (e) { return []; } }
  function setPending(a) { store.set(LS.pending, a.length ? JSON.stringify(a.slice(-50)) : null); }

  async function send(run) {
    return rpc('enregistrer_descente', { code: run.code, nom: run.nom, temps_ms: run.temps_ms, i1_ms: run.i1_ms, i2_ms: run.i2_ms });
  }

  async function flush() {
    const list = pending();
    if (!list.length) return;
    const left = [];
    for (const run of list) {
      try { await send(run); } catch (e) { if (!e.server) left.push(run); }
    }
    setPending(left);
  }

  // ---------- Appelé par le jeu à la fin de chaque descente ----------
  function onRunEnd(r) {
    if (!enabled || !playerName() || !familyCode()) { lastRun = null; return; }
    const ms = (t) => (typeof t === 'number' && isFinite(t) ? Math.round(t * 1000) : null);
    const run = {
      code: familyCode(), nom: playerName(),
      temps_ms: r.finished ? ms(r.time) : null,
      i1_ms: r.finished ? ms(r.splits && r.splits[0]) : null,
      i2_ms: r.finished ? ms(r.splits && r.splits[1]) : null
    };
    const before = board.find((b) => b.prenom === run.nom);
    const famBefore = reference();
    const entry = { run, beforeMs: before ? before.meilleur_ms : null, famBeforeMs: famBefore ? famBefore.ms : null, done: false, error: null };
    if (r.finished) lastRun = entry;
    entry.promise = (async () => {
      try {
        await flush();
        await send(run);
        await loadBoard();
      } catch (e) {
        if (e.badCode) { entry.error = 'code'; store.set(LS.code, null); }
        else if (e.server) entry.error = 'serveur';
        else { entry.error = 'reseau'; setPending(pending().concat([run])); }
      }
      entry.done = true;
      if (lastRun === entry && $('screen-results').classList.contains('visible')) fillResults();
    })();
  }

  // ---------- Record de la famille (référence des écarts) ----------
  function reference() {
    const best = board.filter((b) => b.meilleur_ms).sort((a, b) => a.meilleur_ms - b.meilleur_ms)[0];
    if (!best) return null;
    return { prenom: best.prenom, ms: best.meilleur_ms, i1: best.inter1_ms, i2: best.inter2_ms };
  }

  // ---------- Affichage ----------
  function fmtMs(ms) {
    if (!ms) return '--';
    const t = ms / 1000, m = Math.floor(t / 60), tenth = Math.floor((t - m * 60) * 10 + 1e-6) / 10;
    return `${m}:${tenth.toFixed(1).padStart(4, '0')}`;
  }
  function fmtGap(sec) {
    const v = Math.round(Math.abs(sec) * 10) / 10;
    return (sec < 0 ? '−' : '+') + v.toFixed(1).replace('.', ',') + ' s';
  }
  function fmtDate(d) {
    if (!d) return '';
    const x = new Date(d);
    return isNaN(x) ? '' : x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function boardRows(highlight, limit) {
    const ranked = board.filter((b) => b.meilleur_ms).sort((a, b) => a.meilleur_ms - b.meilleur_ms);
    const rows = ranked.slice(0, limit || ranked.length).map((b, i) =>
      `<li class="${b.prenom === highlight ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(b.prenom)}</span>` +
      `<span class="tm">${fmtMs(b.meilleur_ms)}</span></li>`);
    const me = ranked.findIndex((b) => b.prenom === highlight);
    if (limit && me >= limit) {
      const b = ranked[me];
      rows.push(`<li class="me"><span class="rk">${me + 1}</span><span class="nm">${esc(b.prenom)}</span><span class="tm">${fmtMs(b.meilleur_ms)}</span></li>`);
    }
    return { html: rows.join(''), rank: me >= 0 ? me + 1 : null, total: ranked.length };
  }

  function updateHome() {
    if (!enabled) return;
    const ref = reference();
    $('home-record').textContent = ref ? `Record : ${ref.prenom} ${fmtMs(ref.ms)}` : '';
    $('home-code-row').style.display = familyCode() ? 'none' : '';
    $('home-change-code').style.display = familyCode() ? '' : 'none';
  }

  function fillBoard() {
    const list = $('board-list');
    const ranked = board.filter((b) => b.meilleur_ms).sort((a, b) => a.meilleur_ms - b.meilleur_ms);
    const others = board.filter((b) => !b.meilleur_ms);
    if (!ranked.length && !others.length) {
      list.innerHTML = '';
      $('board-msg').textContent = boardOk ? 'Personne n\'a encore fini la descente. À toi de jouer !' : 'Classement indisponible pour le moment.';
      return;
    }
    $('board-msg').textContent = boardOk ? '' : 'Pas de réseau : dernier classement connu.';
    const me = playerName();
    list.innerHTML = ranked.map((b, i) =>
      `<li class="${b.prenom === me ? 'me' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(b.prenom)}` +
      `<small>${fmtDate(b.date_record)} · ${b.descentes} descente${b.descentes > 1 ? 's' : ''}</small></span>` +
      `<span class="tm">${fmtMs(b.meilleur_ms)}</span></li>`).join('') +
      others.map((b) =>
        `<li class="${b.prenom === me ? 'me' : ''}"><span class="rk">–</span><span class="nm">${esc(b.prenom)}` +
        `<small>${b.descentes} descente${b.descentes > 1 ? 's' : ''}, pas encore à l'arrivée</small></span><span class="tm">--</span></li>`).join('');
  }

  function fillResults() {
    const box = $('res-family');
    if (!enabled || !lastRun) { box.style.display = 'none'; return; }
    box.style.display = '';
    const e = lastRun, t = e.run.temps_ms;
    const msg = $('res-msg'), list = $('res-board');
    // écart avec le record de la famille d'avant la descente
    const gapEl = $('res-gap');
    if (e.famBeforeMs) {
      const g = (t - e.famBeforeMs) / 1000;
      gapEl.textContent = fmtGap(g);
      gapEl.className = 'gap ' + (g < 0 ? 'good' : 'bad');
    } else { gapEl.textContent = ''; gapEl.className = 'gap'; }
    if (!e.done) { msg.textContent = 'Enregistrement du temps…'; list.innerHTML = ''; return; }
    if (e.error === 'code') { msg.textContent = 'Code famille incorrect : le temps n\'est pas enregistré. Retourne à l\'accueil pour le corriger.'; list.innerHTML = ''; return; }
    if (e.error === 'reseau') { msg.textContent = 'Pas de réseau : le temps sera envoyé à la prochaine descente.'; list.innerHTML = ''; return; }
    if (e.error) { msg.textContent = 'Le serveur des scores ne répond pas, le temps n\'est pas enregistré.'; list.innerHTML = ''; return; }
    const r = boardRows(e.run.nom, 5);
    const famRecord = !e.famBeforeMs || t < e.famBeforeMs;
    const perso = !e.beforeMs || t < e.beforeMs;
    let txt;
    if (famRecord) txt = '🏆 Nouveau record de la famille !';
    else if (perso) txt = `Nouveau record perso ! ${r.rank}${r.rank === 1 ? 'er' : 'e'} sur ${r.total}`;
    else txt = `Ton record : ${fmtMs(e.beforeMs)} · ${r.rank}${r.rank === 1 ? 'er' : 'e'} sur ${r.total}`;
    msg.textContent = txt;
    list.innerHTML = r.html;
  }

  // ---------- Écran d'accueil ----------
  function canPlay() {
    if (!enabled) return true;
    const inName = $('in-prenom'), inCode = $('in-code');
    const name = cleanName(inName.value);
    if (!name) { warn(inName, 'Écris ton prénom pour jouer'); return false; }
    store.set(LS.name, name); inName.value = name;
    if (!familyCode()) {
      const code = inCode.value.trim();
      if (!code) { warn(inCode, 'Tape le code famille'); return false; }
      store.set(LS.code, code);
      loadBoard().then(updateHome).catch(() => {});
    }
    $('home-warn').textContent = '';
    return true;
  }

  function warn(input, text) {
    $('home-warn').textContent = text;
    input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
    input.addEventListener('input', () => input.classList.remove('shake'), { once: true });
    input.focus();
  }

  function init() {
    if (!enabled) {
      for (const id of ['home-player', 'home-record', 'home-board-btn', 'res-family', 'home-change-code']) { const el = $(id); if (el) el.style.display = 'none'; }
      return;
    }
    const inName = $('in-prenom');
    inName.value = playerName();
    updateHome();
    $('home-board-btn').addEventListener('click', openBoard);
    $('board-close').addEventListener('click', () => window.PTPSC.showScreen('home'));
    $('home-change-code').addEventListener('click', (ev) => {
      ev.preventDefault();
      store.set(LS.code, null); $('in-code').value = ''; updateHome(); $('in-code').focus();
    });
    flush().catch(() => {});
    if (familyCode()) loadBoard().then(updateHome).catch(() => {});
  }

  async function openBoard() {
    if (!canPlay()) return;
    window.PTPSC.showScreen('board');
    $('board-msg').textContent = 'Chargement…';
    $('board-list').innerHTML = '';
    try { await loadBoard(); boardOk = true; } catch (e) {
      boardOk = false;
      if (e.badCode) { store.set(LS.code, null); window.PTPSC.showScreen('home'); updateHome(); warn($('in-code'), 'Code famille incorrect'); return; }
    }
    fillBoard();
  }

  return {
    enabled, init, canPlay, onRunEnd, reference, fillResults, updateHome, fmtGap,
    player: playerName
  };
})();
