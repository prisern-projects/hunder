import { BREEDS, GROUPS, TRAITS, SIZES, byId } from './breeds.js';
import { store } from './store.js';
import { thumb, gallery, randomPhoto, shuffle, clearImageCache } from './images.js';
import { initUpdates, hasUpdate, updateVersion, applyUpdate, checkForUpdates, appVersion } from './updates.js';

const $app = document.getElementById('app');
const $sheet = document.getElementById('sheet');
const $viewer = document.getElementById('viewer');
const $toast = document.getElementById('toast');
const $banner = document.getElementById('update-banner');

// List filters survive navigating to a breed and back.
const ui = { q: '', size: '', group: '', sort: 'name', scroll: 0 };

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const range = ([a, b], unit) => (a === b ? `${a} ${unit}` : `${a}–${b} ${unit}`);
const sizeName = (id) => SIZES.find((s) => s[0] === id)[1];
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a');
const sorted = (list) => list.slice().sort((a, b) => a.name.localeCompare(b.name, 'nb'));

function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.remove('show'), 2400);
}

function openSheet(html) {
  $sheet.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet-panel">${html}</div>`;
  $sheet.classList.add('open');
}
function closeSheet() { $sheet.classList.remove('open'); $sheet.innerHTML = ''; }

function go(r) { if (location.hash !== '#' + r) location.hash = r; else render(); }
function route() { return (location.hash || '#/').slice(1) || '/'; }

const ICONS = {
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5v.01"/>',
  match: '<path d="M10.5 4a6.5 6.5 0 1 0 4 11.6L20 21"/><path d="M8 10.5l2 2 3.5-4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

function tabbar(active) {
  const tabs = [['/', 'list', 'Raser'], ['/quiz', 'quiz', 'Quiz'], ['/match', 'match', 'Finn din'], ['/favoritter', 'heart', 'Favoritter']];
  return `<nav class="tabbar">${tabs.map(([r, i, t]) => `<a href="#${r}" class="${active === r ? 'on' : ''}"><span class="ico">${icon(i)}</span>${t}</a>`).join('')}</nav>`;
}

function header(title, sub = '', right = '') {
  return `<header class="top"><div class="row between"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</div></header>`;
}
const gearBtn = () => `<button class="icon-btn" data-act="settings" aria-label="Innstillinger">${icon('gear')}</button>`;

// ---------------------------------------------------------------- photos
// Cards get a placeholder first; the photo is fetched when the card scrolls into view.
const io = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); loadPhoto(e.target); } }), { rootMargin: '300px' })
  : null;

function photo(b, cls = '') {
  return `<div class="photo ${cls}" data-photo="${b.id}"><span class="ph">${esc(b.name.charAt(0))}</span></div>`;
}

async function loadPhoto(el) {
  const b = byId[el.dataset.photo];
  const url = b && await thumb(b);
  if (!url) { el.classList.add('none'); return; }
  const img = new Image();
  img.alt = b.name;
  img.onload = () => { el.appendChild(img); el.classList.add('loaded'); };
  img.onerror = () => el.classList.add('none');
  img.src = url;
}

function hydratePhotos() {
  $app.querySelectorAll('[data-photo]').forEach((el) => (io ? io.observe(el) : loadPhoto(el)));
}

function card(b) {
  return `<a class="bcard" href="#/rase/${b.id}">
    ${photo(b)}
    ${store.isFav(b.id) ? '<span class="fav-dot">♥</span>' : ''}
    <div class="bcard-body"><div class="bname">${esc(b.name)}</div><div class="bmeta">${sizeName(b.size)} · ${esc(b.origin)}</div></div>
  </a>`;
}

// ---------------------------------------------------------------- list
function filtered() {
  const q = norm(ui.q.trim());
  let list = BREEDS.filter((b) => {
    if (ui.size && b.size !== ui.size) return false;
    if (ui.group !== '' && String(b.group) !== ui.group) return false;
    if (!q) return true;
    return norm(b.name).includes(q) || norm(b.origin).includes(q) || norm(b.wiki).includes(q)
      || b.temperament.some((t) => norm(t).includes(q));
  });
  const avgW = (b) => b.weight[0] + b.weight[1];
  // When searching, breeds whose name starts with (a word starting with) the query come first.
  const rank = (b) => { const n = norm(b.name); return n.startsWith(q) ? 0 : n.split(/[\s(-]+/).some((w) => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : 3; };
  if (q && ui.sort === 'name') list = sorted(list).sort((a, b) => rank(a) - rank(b));
  else if (ui.sort === 'name') list = sorted(list);
  else if (ui.sort === 'small') list.sort((a, b) => avgW(a) - avgW(b));
  else if (ui.sort === 'big') list.sort((a, b) => avgW(b) - avgW(a));
  else if (ui.sort === 'energy') list.sort((a, b) => b.traits.energy - a.traits.energy || a.name.localeCompare(b.name, 'nb'));
  else if (ui.sort === 'calm') list.sort((a, b) => a.traits.energy - b.traits.energy || a.name.localeCompare(b.name, 'nb'));
  else if (ui.sort === 'life') list.sort((a, b) => (b.life[0] + b.life[1]) - (a.life[0] + a.life[1]));
  return list;
}

function dailyBreed() {
  const d = new Date();
  const n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  return BREEDS[(n * 7919) % BREEDS.length];
}

function renderList() {
  const daily = dailyBreed();
  $app.innerHTML = `
    ${header('Hunder', `${BREEDS.length} raser med bilder og fakta`, gearBtn())}
    <main class="page">
      <div class="search">${icon('search')}<input id="q" type="search" placeholder="Søk etter rase, land eller egenskap" value="${esc(ui.q)}" autocomplete="off"></div>
      <div class="chips" id="sizes">
        <button class="chip ${ui.size === '' ? 'on' : ''}" data-size="">Alle</button>
        ${SIZES.map(([id, name]) => `<button class="chip ${ui.size === id ? 'on' : ''}" data-size="${id}">${name}</button>`).join('')}
      </div>
      <div class="row gap">
        <select id="group" class="grow" aria-label="Gruppe">
          <option value="">Alle grupper</option>
          ${Object.entries(GROUPS).sort((a, b) => (a[0] === '0') - (b[0] === '0') || a[0] - b[0]).map(([k, v]) => `<option value="${k}" ${ui.group === k ? 'selected' : ''}>${k === '0' ? v : `${k}. ${v}`}</option>`).join('')}
        </select>
        <select id="sort" aria-label="Sortering">
          ${[['name', 'A–Å'], ['small', 'Minst først'], ['big', 'Størst først'], ['calm', 'Roligst'], ['energy', 'Mest energi'], ['life', 'Lengst levealder']].map(([k, v]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
      <div id="daily"></div>
      <div class="count muted small" id="count"></div>
      <div class="grid" id="grid"></div>
    </main>
    ${tabbar('/')}`;

  const $grid = document.getElementById('grid');
  const $count = document.getElementById('count');
  const $daily = document.getElementById('daily');
  const draw = () => {
    const list = filtered();
    const filtering = ui.q || ui.size || ui.group !== '';
    $daily.innerHTML = filtering ? '' : `
      <a class="daily card" href="#/rase/${daily.id}">
        ${photo(daily, 'wide')}
        <div class="daily-body"><div class="eyebrow">Dagens rase</div><h2>${esc(daily.name)}</h2><p class="muted small clamp">${esc(daily.text)}</p></div>
      </a>`;
    $count.textContent = filtering ? `${list.length} ${list.length === 1 ? 'rase' : 'raser'}` : 'Alle raser';
    $grid.innerHTML = list.length ? list.map(card).join('') : `<div class="card empty"><p>Ingen raser passer søket.</p><button class="btn secondary" data-act="clear-filters">Nullstill filter</button></div>`;
    hydratePhotos();
  };
  draw();

  const $q = document.getElementById('q');
  $q.addEventListener('input', () => { ui.q = $q.value; draw(); });
  $q.addEventListener('keydown', (e) => { if (e.key === 'Enter') $q.blur(); });
  document.getElementById('sizes').addEventListener('click', (e) => {
    const c = e.target.closest('[data-size]');
    if (!c) return;
    ui.size = c.dataset.size;
    document.querySelectorAll('#sizes .chip').forEach((x) => x.classList.toggle('on', x === c));
    draw();
  });
  document.getElementById('group').addEventListener('change', (e) => { ui.group = e.target.value; draw(); });
  document.getElementById('sort').addEventListener('change', (e) => { ui.sort = e.target.value; draw(); });

  requestAnimationFrame(() => window.scrollTo(0, ui.scroll));
}

// ---------------------------------------------------------------- breed page
function meter(value) {
  return `<div class="meter">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= value ? 'on' : ''}"></span>`).join('')}</div>`;
}

function goodFor(b) {
  const t = b.traits;
  const yes = [];
  const no = [];
  if (t.energy >= 4) yes.push('Aktive eiere som liker lange turer, løping eller hundesport');
  if (t.energy <= 2) yes.push('Deg som vil ha en rolig hund som trives med korte turer');
  if (t.kids >= 4) yes.push('Barnefamilier');
  if (t.training >= 4) yes.push('Førstegangseiere og deg som vil trene lydighet eller triks');
  if (t.shedding <= 2) yes.push('Deg som ikke vil ha mye hundehår i huset');
  if (b.size === 'mini' || b.size === 'liten') yes.push('Leilighet og byliv');
  if (t.energy >= 4) no.push('Mye alenetid eller lite mosjon');
  if (t.grooming >= 4) no.push('Deg som ikke vil bruke tid på pelsstell');
  if (t.training <= 2) no.push('Helt ferske hundeeiere – den kan være sta');
  if (t.barking >= 4) no.push('Lytt boligmiljø – den kan bjeffe en del');
  if (t.shedding >= 5) no.push('Allergikere – den røyter mye');
  if (t.kids <= 2) no.push('Familier med små barn');
  if (b.size === 'kjempe') no.push('Liten bolig eller lite bil');
  return { yes, no };
}

function similar(b) {
  const dist = (x) => Object.keys(b.traits).reduce((s, k) => s + Math.abs(b.traits[k] - x.traits[k]), 0)
    + (x.group === b.group ? 0 : 3) + Math.abs(SIZES.findIndex((s) => s[0] === x.size) - SIZES.findIndex((s) => s[0] === b.size)) * 2;
  return BREEDS.filter((x) => x.id !== b.id).sort((x, y) => dist(x) - dist(y)).slice(0, 6);
}

function renderBreed(id) {
  const b = byId[id];
  if (!b) return go('/');
  const fav = store.isFav(b.id);
  const g = goodFor(b);
  $app.innerHTML = `
    <header class="top"><div class="row between">
      <a class="back" href="#/" data-act="back">‹ Tilbake</a>
      <button class="icon-btn fav ${fav ? 'on' : ''}" data-act="fav" data-id="${b.id}" aria-label="Favoritt">${icon('heart')}</button>
    </div></header>
    <main class="page">
      <div class="gallery" id="gallery"><div class="slide loading"><span class="ph big">${esc(b.name.charAt(0))}</span></div></div>
      <div class="dots" id="dots"></div>
      <section>
        <div class="eyebrow">${b.group ? `FCI gruppe ${b.group} · ` : ''}${esc(GROUPS[b.group])}</div>
        <h1 class="title">${esc(b.name)}</h1>
        ${b.banned ? '<div class="warn">⚠︎ Forbudt å holde i Norge (hundeloven)</div>' : ''}
        <div class="tags">${b.temperament.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </section>
      <div class="facts">
        <div class="fact"><span>Opprinnelse</span><b>${esc(b.origin)}</b></div>
        <div class="fact"><span>Størrelse</span><b>${sizeName(b.size)}</b></div>
        <div class="fact"><span>Vekt</span><b>${range(b.weight, 'kg')}</b></div>
        <div class="fact"><span>Høyde</span><b>${range(b.height, 'cm')}</b></div>
        <div class="fact"><span>Levealder</span><b>${range(b.life, 'år')}</b></div>
        <div class="fact"><span>Gruppe</span><b>${b.group ? `FCI ${b.group}` : 'Ikke FCI'}</b></div>
      </div>
      <section class="card"><h3>Om rasen</h3><p class="lead">${esc(b.text)}</p></section>
      <section class="card">
        <h3>Egenskaper</h3>
        ${TRAITS.map(([k, label, lo, hi]) => `
          <div class="trait"><div class="row between"><span>${label}</span><span class="muted small">${b.traits[k] <= 2 ? lo : b.traits[k] >= 4 ? hi : 'Middels'}</span></div>${meter(b.traits[k])}</div>`).join('')}
      </section>
      ${g.yes.length || g.no.length ? `<section class="card">
        ${g.yes.length ? `<h3>Passer godt for</h3><ul class="list yes">${g.yes.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
        ${g.no.length ? `<h3>Passer mindre godt for</h3><ul class="list no">${g.no.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
      </section>` : ''}
      <section>
        <h3>Lignende raser</h3>
        <div class="hscroll">${similar(b).map(card).join('')}</div>
      </section>
      <a class="btn secondary big" href="https://no.wikipedia.org/w/index.php?search=${encodeURIComponent(b.name.replace(/ \(.*\)$/, ''))}" target="_blank" rel="noopener">Les mer på Wikipedia ↗</a>
      <p class="note">Bilder: Wikipedia og dog.ceo. Fakta er typiske verdier og varierer mellom individer.</p>
    </main>`;
  window.scrollTo(0, 0);
  hydratePhotos();
  loadGallery(b);
}

async function loadGallery(b) {
  const urls = await gallery(b);
  const $g = document.getElementById('gallery');
  if (!$g || route() !== '/rase/' + b.id) return;
  if (!urls.length) {
    $g.innerHTML = `<div class="slide empty"><span class="ph big">${esc(b.name.charAt(0))}</span><p class="muted small">Ingen bilder – sjekk internettforbindelsen.</p></div>`;
    return;
  }
  $g.innerHTML = urls.map((u, i) => `<div class="slide"><img src="${esc(u)}" alt="${esc(b.name)}" ${i > 1 ? 'loading="lazy"' : ''} data-act="view" data-i="${i}" onerror="this.parentElement.remove()"></div>`).join('');
  $g.dataset.urls = JSON.stringify(urls);
  const $dots = document.getElementById('dots');
  $dots.innerHTML = urls.length > 1 ? `<span class="muted small" id="pos">1 / ${urls.length}</span>` : '';
  $g.addEventListener('scroll', () => {
    const i = Math.round($g.scrollLeft / $g.clientWidth);
    const pos = document.getElementById('pos');
    if (pos) pos.textContent = `${i + 1} / ${$g.querySelectorAll('.slide').length}`;
  }, { passive: true });
}

// ---------------------------------------------------------------- full-screen photo viewer
function openViewer(urls, start) {
  $viewer.innerHTML = `
    <div class="viewer-track" id="vtrack">${urls.map((u) => `<div class="vslide"><img src="${esc(u)}" alt=""></div>`).join('')}</div>
    <button class="viewer-close" data-act="close-viewer" aria-label="Lukk">✕</button>`;
  $viewer.classList.add('open');
  const t = document.getElementById('vtrack');
  requestAnimationFrame(() => { t.scrollLeft = start * t.clientWidth; });
}
function closeViewer() { $viewer.classList.remove('open'); $viewer.innerHTML = ''; }

// ---------------------------------------------------------------- favourites
function renderFavs() {
  const list = store.favorites.map((id) => byId[id]).filter(Boolean);
  $app.innerHTML = `
    ${header('Favoritter', list.length ? `${list.length} ${list.length === 1 ? 'rase' : 'raser'}` : '', gearBtn())}
    <main class="page">
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>`
        : `<div class="card empty"><div class="big-emoji">♡</div><p>Ingen favoritter ennå.</p><p class="muted small">Trykk på hjertet på en rase for å lagre den her.</p><a class="btn primary" href="#/">Se alle raser</a></div>`}
    </main>
    ${tabbar('/favoritter')}`;
  hydratePhotos();
}

// ---------------------------------------------------------------- quiz: guess the breed
const quiz = { q: null, streak: 0, answered: false, loading: false };
const QUIZ_POOL = BREEDS.filter((b) => b.dog);

async function newQuestion() {
  quiz.loading = true;
  quiz.answered = false;
  renderQuiz();
  const answer = QUIZ_POOL[Math.floor(Math.random() * QUIZ_POOL.length)];
  // Wrong options: prefer breeds of similar size so it isn't too easy.
  const others = shuffle(QUIZ_POOL.filter((b) => b.id !== answer.id && b.size === answer.size)).slice(0, 2);
  const rest = shuffle(QUIZ_POOL.filter((b) => b.id !== answer.id && !others.includes(b))).slice(0, 3 - others.length);
  const url = await randomPhoto(answer);
  quiz.q = { answer, url, options: shuffle([answer, ...others, ...rest]) };
  quiz.loading = false;
  if (route() === '/quiz') renderQuiz();
}

function renderQuiz() {
  const s = store.quiz;
  const q = quiz.q;
  let body;
  if (!q && !quiz.loading) {
    body = `<div class="card hero">
      <div class="eyebrow">Gjett rasen</div><h2>Hvor godt kjenner du hunder?</h2>
      <p class="muted">Du får se et bilde av en hund – velg riktig rase blant fire alternativer. Hvor mange klarer du på rad?</p>
      <button class="btn primary big" data-act="quiz-start">Start quiz</button>
    </div>
    ${s.played ? `<div class="stats"><div><b>${s.best}</b><span>Beste rekke</span></div><div><b>${s.played}</b><span>Spilt</span></div><div><b>${Math.round((s.correct / s.played) * 100)}%</b><span>Riktig</span></div></div>` : ''}`;
  } else if (quiz.loading || !q) {
    body = `<div class="quiz-photo loading"><span class="spinner"></span></div>`;
  } else if (!q.url) {
    body = `<div class="card empty"><p>Fikk ikke hentet bilde. Sjekk internettforbindelsen.</p><button class="btn primary" data-act="quiz-next">Prøv igjen</button></div>`;
  } else {
    body = `
      <div class="row between"><span class="streak">🔥 ${quiz.streak} på rad</span><span class="muted small">Rekord: ${s.best}</span></div>
      <div class="quiz-photo"><img src="${esc(q.url)}" alt="Hvilken rase?"></div>
      <div class="options">
        ${q.options.map((o) => {
          let cls = '';
          if (quiz.answered) cls = o.id === q.answer.id ? 'right' : o.id === quiz.answered ? 'wrong' : 'dim';
          return `<button class="option ${cls}" data-act="quiz-answer" data-id="${o.id}" ${quiz.answered ? 'disabled' : ''}>${esc(o.name)}</button>`;
        }).join('')}
      </div>
      ${quiz.answered ? `<div class="row gap"><a class="btn secondary grow" href="#/rase/${q.answer.id}">Om ${esc(q.answer.name)}</a><button class="btn primary grow" data-act="quiz-next">Neste ›</button></div>` : ''}`;
  }
  $app.innerHTML = `${header('Quiz', 'Gjett rasen fra bildet', gearBtn())}<main class="page">${body}</main>${tabbar('/quiz')}`;
}

function answerQuiz(id) {
  if (quiz.answered || !quiz.q) return;
  quiz.answered = id;
  const ok = id === quiz.q.answer.id;
  quiz.streak = ok ? quiz.streak + 1 : 0;
  store.quizResult(ok, quiz.streak);
  if (navigator.vibrate) navigator.vibrate(ok ? 30 : [60, 60, 60]);
  renderQuiz();
}

// ---------------------------------------------------------------- match: find your breed
const QUESTIONS = [
  { k: 'energy', q: 'Hvor aktiv er du?', opts: [[1, 'Rolige turer rundt kvartalet'], [3, 'Daglige turer på en time eller så'], [5, 'Løping, fjellturer og hundesport']] },
  { k: 'size', q: 'Hvilken størrelse ønsker du?', opts: [['small', 'Liten (under 10 kg)'], ['medium', 'Middels (10–25 kg)'], ['large', 'Stor (over 25 kg)'], ['any', 'Spiller ingen rolle']] },
  { k: 'kids', q: 'Er det barn i husstanden?', opts: [[5, 'Ja, små barn'], [3, 'Større barn / besøk av barn'], [1, 'Nei']] },
  { k: 'grooming', q: 'Hvor mye pelsstell orker du?', opts: [[1, 'Minst mulig'], [3, 'Litt børsting i uka er greit'], [5, 'Jeg liker å stelle pels']] },
  { k: 'shedding', q: 'Hvor viktig er det at hunden røyter lite?', opts: [[1, 'Svært viktig (allergi)'], [3, 'Litt hår er greit'], [5, 'Spiller ingen rolle']] },
  { k: 'training', q: 'Har du hatt hund før?', opts: [[5, 'Nei, dette blir min første'], [3, 'Ja, litt erfaring'], [1, 'Ja, mye erfaring']] },
  { k: 'barking', q: 'Hvor bor du?', opts: [[1, 'Leilighet med naboer tett på'], [3, 'Rekkehus eller lignende'], [5, 'Enebolig eller på landet']] },
];

const match = { started: false, step: 0, answers: {} };

function scoreBreeds(a) {
  const wild = ['dingo', 'dhole', 'afrikansk-villhund'];
  return BREEDS.filter((b) => !b.banned && !wild.includes(b.id))
    .map((b) => {
      const t = b.traits;
      let pen = 0;
      pen += Math.abs(t.energy - a.energy) * 3;
      if (a.kids >= 3) pen += Math.max(0, a.kids - t.kids) * 3;
      pen += Math.max(0, t.grooming - a.grooming) * 2;
      if (a.shedding <= 3) pen += Math.max(0, t.shedding - a.shedding) * (a.shedding === 1 ? 4 : 2);
      pen += Math.max(0, a.training - t.training) * 2;
      if (a.barking <= 3) pen += Math.max(0, t.barking - a.barking) * 1.5;
      const w = (b.weight[0] + b.weight[1]) / 2;
      if (a.size === 'small' && w > 10) pen += w > 25 ? 12 : 5;
      if (a.size === 'medium' && (w < 10 || w > 25)) pen += w > 45 ? 10 : 4;
      if (a.size === 'large' && w < 25) pen += w < 10 ? 12 : 5;
      if (a.barking === 1 && w > 45) pen += 4;
      const pct = Math.max(1, Math.round(100 - pen * 2.2));
      return { b, pct };
    })
    .sort((x, y) => y.pct - x.pct);
}

function renderMatch() {
  let body;
  const last = store.match;
  if (!match.started) {
    body = `<div class="card hero">
      <div class="eyebrow">Finn din rase</div><h2>Hvilken hund passer for deg?</h2>
      <p class="muted">Svar på ${QUESTIONS.length} korte spørsmål om livet ditt, så foreslår vi rasene som passer best.</p>
      <button class="btn primary big" data-act="match-start">Start</button>
      ${last ? '<button class="btn ghost" data-act="match-last">Se forrige resultat</button>' : ''}
    </div>`;
  } else if (match.step < QUESTIONS.length) {
    const Q = QUESTIONS[match.step];
    body = `<div class="progress"><span style="width:${(match.step / QUESTIONS.length) * 100}%"></span></div>
      <div class="muted small">Spørsmål ${match.step + 1} av ${QUESTIONS.length}</div>
      <h2>${Q.q}</h2>
      <div class="options">${Q.opts.map(([v, t]) => `<button class="option ${match.answers[Q.k] === v ? 'right' : ''}" data-act="match-answer" data-v="${v}">${t}</button>`).join('')}</div>
      ${match.step > 0 ? '<button class="btn ghost" data-act="match-prev">‹ Forrige</button>' : ''}`;
  } else {
    const res = scoreBreeds(match.answers).slice(0, 12);
    body = `<div class="eyebrow">Dine beste treff</div>
      <div class="results">${res.map(({ b, pct }, i) => `
        <a class="result card" href="#/rase/${b.id}">
          ${photo(b, 'sq')}
          <div class="grow"><div class="bname">${i + 1}. ${esc(b.name)}</div><div class="bmeta">${sizeName(b.size)} · ${esc(b.temperament.slice(0, 2).join(', ').toLowerCase())}</div>
          <div class="bar"><span style="width:${pct}%"></span></div></div>
          <b class="pct">${pct}%</b>
        </a>`).join('')}</div>
      <button class="btn secondary big" data-act="match-start">Ta testen på nytt</button>
      <p class="note">Bare en pekepinn – snakk med oppdrettere og raseklubber før du bestemmer deg.</p>`;
  }
  $app.innerHTML = `${header('Finn din', 'Rasevelger', gearBtn())}<main class="page">${body}</main>${tabbar('/match')}`;
  hydratePhotos();
}

// ---------------------------------------------------------------- settings
function openSettings() {
  openSheet(`
    <h2>Innstillinger</h2>
    <div class="set-row"><div><b>Versjon</b><div class="muted small">${esc(appVersion())}</div></div>
      <button class="btn secondary sm" data-act="check-updates">Se etter oppdateringer</button></div>
    ${hasUpdate() ? `<button class="btn primary big" data-act="apply-update">Oppdater til ${esc(updateVersion())}</button>` : ''}
    <div class="set-row"><div><b>Bildebuffer</b><div class="muted small">Hent nye bilder for alle raser</div></div>
      <button class="btn secondary sm" data-act="clear-cache">Tøm</button></div>
    <p class="muted small">Bildene hentes fra Wikipedia og dog.ceo (The Dog API) og krever internett. Rasefakta er lagret i appen og virker uten nett.</p>
    <button class="btn ghost big" data-act="close-sheet">Lukk</button>`);
}

function showBanner(version) {
  $banner.innerHTML = `<span>Ny versjon ${esc(version)} er klar</span><button class="btn sm primary" data-act="apply-update">Oppdater nå</button><button class="x" data-act="hide-banner" aria-label="Skjul">✕</button>`;
  $banner.classList.add('show');
}

// ---------------------------------------------------------------- events
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  switch (act) {
    case 'back':
      if (history.length > 1) { e.preventDefault(); history.back(); }
      break;
    case 'fav': {
      const on = store.toggleFav(el.dataset.id);
      el.classList.toggle('on', on);
      toast(on ? 'Lagt til i favoritter' : 'Fjernet fra favoritter');
      break;
    }
    case 'view': {
      const urls = JSON.parse(document.getElementById('gallery').dataset.urls || '[]');
      const shown = [...document.querySelectorAll('#gallery img')].map((i) => i.getAttribute('src'));
      openViewer(shown.length ? shown : urls, shown.indexOf(el.getAttribute('src')));
      break;
    }
    case 'close-viewer': closeViewer(); break;
    case 'settings': openSettings(); break;
    case 'close-sheet': closeSheet(); break;
    case 'clear-filters': ui.q = ''; ui.size = ''; ui.group = ''; renderList(); break;
    case 'clear-cache': clearImageCache(); closeSheet(); toast('Bildebufferen er tømt'); render(); break;
    case 'check-updates': {
      el.disabled = true;
      el.textContent = 'Sjekker…';
      const r = await checkForUpdates();
      const msg = { available: `Ny versjon ${updateVersion()} er klar`, latest: 'Du har nyeste versjon', offline: 'Fikk ikke kontakt – prøv igjen', unsupported: 'Oppdatering virker bare i appen' }[r];
      toast(msg);
      if (r === 'available') openSettings();
      else { el.disabled = false; el.textContent = 'Se etter oppdateringer'; }
      break;
    }
    case 'apply-update': applyUpdate(); break;
    case 'hide-banner': $banner.classList.remove('show'); break;
    case 'quiz-start': quiz.streak = 0; newQuestion(); break;
    case 'quiz-next': newQuestion(); break;
    case 'quiz-answer': answerQuiz(el.dataset.id); break;
    case 'match-start': match.started = true; match.step = 0; match.answers = {}; renderMatch(); window.scrollTo(0, 0); break;
    case 'match-last': match.started = true; match.answers = { ...store.match }; match.step = QUESTIONS.length; renderMatch(); break;
    case 'match-prev': match.step = Math.max(0, match.step - 1); renderMatch(); break;
    case 'match-answer': {
      const Q = QUESTIONS[match.step];
      const v = el.dataset.v;
      match.answers[Q.k] = isNaN(Number(v)) ? v : Number(v);
      match.step++;
      if (match.step >= QUESTIONS.length) store.match = { ...match.answers };
      renderMatch();
      window.scrollTo(0, 0);
      break;
    }
    default: break;
  }
});

// Android back button: close overlays first.
window.onNativeBack = () => {
  if ($viewer.classList.contains('open')) { closeViewer(); return true; }
  if ($sheet.classList.contains('open')) { closeSheet(); return true; }
  return false;
};

window.addEventListener('scroll', () => { if (route() === '/') ui.scroll = window.scrollY; }, { passive: true });

// ---------------------------------------------------------------- router
function render() {
  closeSheet();
  closeViewer();
  const r = route();
  if (r.startsWith('/rase/')) return renderBreed(decodeURIComponent(r.slice(6)));
  if (r === '/favoritter') return renderFavs();
  if (r === '/quiz') return renderQuiz();
  if (r === '/match') return renderMatch();
  return renderList();
}

window.addEventListener('hashchange', render);
initUpdates(showBanner);
render();
