const DEFAULTS = {
  suspiciousWinrate: 55,
  highWinrate: 70,
  lowRatingAccuracyThreshold: 80,
  highRatingAccuracyThreshold: 90,
  lowRatingCutoff: 1500,
  minGamesForOverall: 50,
  minGamesForRecent: 20,
  minGamesForAccuracy: 8,
  highAccNotablePct: 35,
  highAccSeverePct: 60
};

const keys = Object.keys(DEFAULTS);

function load() {
  chrome.storage.sync.get(DEFAULTS, cfg => {
    keys.forEach(k => {
      const el = document.getElementById(k);
      if (el) el.value = cfg[k];
    });
  });
}

function save() {
  const out = {};
  keys.forEach(k => {
    const el = document.getElementById(k);
    out[k] = Number(el.value);
  });
  chrome.storage.sync.set(out, () => {
    const s = document.getElementById('status');
    s.textContent = 'Saved';
    setTimeout(() => (s.textContent = ''), 1200);
  });
}

document.getElementById('save').addEventListener('click', save);
load();
