// Dog photos. Two free sources, no API key needed:
//  - dog.ceo  (the Dog API, many photos per breed)
//  - Wikipedia (the lead photo of the breed's article – used first and as fallback)
// Results are cached in localStorage so the list shows the same photo every time.

const CACHE_KEY = 'hunder-img-v1';
const MAX_GALLERY = 24;

let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  }, 300);
}

export function clearImageCache() {
  cache = {};
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const inflight = new Map();
function once(key, fn) {
  if (!inflight.has(key)) inflight.set(key, fn().finally(() => inflight.delete(key)));
  return inflight.get(key);
}

function wikiUrl(title) {
  return 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_'));
}

async function wiki(breed) {
  const c = cache['w:' + breed.id];
  if (c !== undefined) return c;
  return once('w:' + breed.id, async () => {
    try {
      const j = await getJSON(wikiUrl(breed.wiki));
      const res = { thumb: j.thumbnail?.source || null, full: j.originalimage?.source || j.thumbnail?.source || null };
      if (!res.thumb) return null;
      cache['w:' + breed.id] = res;
      persist();
      return res;
    } catch {
      return null;
    }
  });
}

/** A single photo URL for list cards. */
export async function thumb(breed) {
  const w = await wiki(breed);
  if (w) return w.thumb;
  if (!breed.dog) return null;
  const k = 't:' + breed.id;
  if (cache[k]) return cache[k];
  return once(k, async () => {
    try {
      const j = await getJSON(`https://dog.ceo/api/breed/${breed.dog}/images/random`);
      cache[k] = j.message;
      persist();
      return j.message;
    } catch {
      return null;
    }
  });
}

/** Several photos for the breed page gallery. */
export async function gallery(breed) {
  const out = [];
  const w = await wiki(breed);
  if (w) out.push(w.full);
  if (breed.dog) {
    const k = 'g:' + breed.id;
    let list = cache[k];
    if (!list) {
      try {
        const j = await getJSON(`https://dog.ceo/api/breed/${breed.dog}/images`);
        list = shuffle(j.message || []).slice(0, MAX_GALLERY);
        cache[k] = list;
        persist();
      } catch {
        list = [];
      }
    }
    out.push(...list);
  }
  return out;
}

/** A random photo for the quiz (always from dog.ceo so it's a fresh one). */
export async function randomPhoto(breed) {
  if (breed.dog) {
    try {
      const j = await getJSON(`https://dog.ceo/api/breed/${breed.dog}/images/random`);
      return j.message;
    } catch { /* fall through */ }
  }
  const w = await wiki(breed);
  return w ? w.full : null;
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
