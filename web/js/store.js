// Local persistence. Everything lives in this phone's browser storage.
const KEY = 'hunder-app-v1';

function blank() {
  return { favorites: [], quiz: { best: 0, played: 0, correct: 0 }, match: null };
}

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const d = JSON.parse(raw);
    return { ...blank(), ...d, quiz: { ...blank().quiz, ...(d.quiz || {}) } };
  } catch {
    return blank();
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

export const store = {
  get favorites() { return data.favorites; },
  isFav(id) { return data.favorites.includes(id); },
  toggleFav(id) {
    if (this.isFav(id)) data.favorites = data.favorites.filter((x) => x !== id);
    else data.favorites.unshift(id);
    save();
    return this.isFav(id);
  },
  get quiz() { return data.quiz; },
  quizResult(ok, streak) {
    data.quiz.played++;
    if (ok) data.quiz.correct++;
    data.quiz.best = Math.max(data.quiz.best, streak);
    save();
  },
  get match() { return data.match; },
  set match(v) { data.match = v; save(); },
};
