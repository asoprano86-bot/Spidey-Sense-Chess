(() => {
  const API = "https://api.chess.com/pub/player/";
  const CACHE_MS = 5 * 60 * 1000;
  const cache = new Map();

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

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function daysBetween(a, b) {
    return Math.floor((a - b) / (1000 * 60 * 60 * 24));
  }

  function parseUsernameFromUrl() {
    const parts = location.pathname.split("/").filter(Boolean);
    const maybe = parts.find(p => /^[a-z0-9_-]{3,20}$/i.test(p));
    return maybe || null;
  }

  function normalizeName(t) {
    const v = (t || "").trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9_-]{3,20}$/i.test(v)) return null;
    
    // Filter out common false positives - expanded list
    const blocked = [
      'game', 'play', 'chess', 'live', 'move', 'time', 'white', 'black', 
      'player', 'user', 'guest', 'anon', 'online', 'offline', 'playing',
      'rated', 'unrated', 'casual', 'tournament', 'arena', 'swiss',
      'bullet', 'blitz', 'rapid', 'daily', 'classical', 'correspondence',
      'analysis', 'puzzle', 'lesson', 'study', 'board', 'pieces',
      'settings', 'profile', 'friends', 'messages', 'home', 'news'
    ];
    if (blocked.includes(v)) return null;
    
    return v;
  }

  let SELF_OVERRIDE = null;

  function getSelfFromStorage() {
    const stores = [window.localStorage, window.sessionStorage];
    const keyHints = ['user', 'username', 'profile', 'account', 'auth', 'login'];
    for (const s of stores) {
      if (!s) continue;
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i) || '';
        const v = s.getItem(k) || '';
        if (!v || (!keyHints.some(h => k.toLowerCase().includes(h)) && v.length > 5000)) continue;
        const n1 = normalizeName(v);
        if (n1) return n1;
        try {
          const obj = JSON.parse(v);
          const stack = [obj];
          while (stack.length) {
            const cur = stack.pop();
            if (!cur || typeof cur !== 'object') continue;
            for (const [kk, vv] of Object.entries(cur)) {
              if (typeof vv === 'string') {
                if (/(user(name)?|login|handle|screen.?name)/i.test(kk)) {
                  const n = normalizeName(vv);
                  if (n) return n;
                }
              } else if (vv && typeof vv === 'object') {
                stack.push(vv);
              }
            }
          }
        } catch {}
      }
    }
    return null;
  }

  function getSelfUsername() {
    if (SELF_OVERRIDE) return SELF_OVERRIDE;
    
    // Strategy 1: Direct self-identification selectors (most reliable)
    const directSelectors = [
      '[data-cy="user-menu-username"]',
      '[data-cy="home-username"]', 
      '.user-menu .user-tagline-username',
      'header .user-tagline-username'
    ];
    
    for (const sel of directSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const username = normalizeName(el.textContent);
        if (username) {
          console.log('🕷️ Self username found via', sel, ':', username);
          return username;
        }
      }
    }
    
    // Strategy 2: Profile links in navigation/header
    const profileLinkSelectors = [
      'header a[href*="/member/"]',
      'nav a[href*="/member/"]',
      '.user-menu a[href*="/member/"]'
    ];
    
    for (const sel of profileLinkSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const href = el.getAttribute('href') || '';
        const match = href.match(/\/member\/([a-z0-9_-]{3,20})/i);
        if (match) {
          const username = normalizeName(match[1]);
          if (username) {
            console.log('🕷️ Self username found via profile link', sel, ':', username);
            return username;
          }
        }
      }
    }
    
    // Strategy 3: Storage/URL fallback
    const stored = getSelfFromStorage();
    if (stored) {
      console.log('🕷️ Self username found in storage:', stored);
      return stored;
    }
    
    console.log('🕷️ Self username not found - using fallbacks');
    return null;
  }

  function readNamesFromContainer(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return [];
    const out = [];
    
    // 2026 Chess.com selectors - ultra-specific to avoid false positives
    const selectors = [
      // PRIMARY: Live game player usernames (most reliable)
      `${containerSelector} [data-cy="user-tagline-username"]:not(:empty)`,
      `${containerSelector} .user-tagline-username:not(:empty)`,
      `${containerSelector} .username.user-tagline-username:not(:empty)`,
      
      // SECONDARY: Player component usernames  
      `${containerSelector} .player-component .username:not(.game-username):not(.player-username)`,
      `${containerSelector} .player-info .username:not(.game-username)`,
      
      // TERTIARY: Member profile links (very specific)
      `${containerSelector} a[href^="https://www.chess.com/member/"]:not([href*="/game/"]):not([href*="/play/"])`,
      `${containerSelector} a[href^="/member/"]:not([href*="/game/"]):not([href*="/play/"])`,
      
      // FALLBACK: But only if they contain exactly one valid username
      `${containerSelector} .player-top .username:not(:empty)`,
      `${containerSelector} .player-bottom .username:not(:empty)`
    ];
    
    const debugCandidates = [];
    
    for (const sel of selectors) {
      container.querySelectorAll(sel).forEach(el => {
        const rawText = (el.textContent || "").trim();
        const txt = normalizeName(rawText);
        debugCandidates.push({selector: sel, rawText: rawText.substring(0, 20), normalized: txt});
        if (txt) out.push(txt);
        
        const href = el.getAttribute('href') || '';
        const m = href.match(/\/member\/([a-z0-9_-]{3,20})/i);
        if (m && normalizeName(m[1])) {
          debugCandidates.push({selector: sel, href: href, extracted: m[1]});
          out.push(m[1].toLowerCase());
        }
      });
    }
    
    // Store debug info for error messages
    if (window.chessRiskDebug) {
      window.chessRiskDebug.lastCandidates = debugCandidates;
    }
    
    return [...new Set(out)];
  }

  function chooseOpponentFromCandidates(candidates, selfName, lastOpponent) {
    const uniq = [...new Set((candidates || []).filter(Boolean))];
    if (!uniq.length) return null;
    if (selfName) {
      const nonSelf = uniq.filter(n => n !== selfName);
      if (nonSelf.length === 1) return nonSelf[0];
      if (nonSelf.length > 1 && lastOpponent && nonSelf.includes(lastOpponent)) return lastOpponent;
      if (nonSelf.length > 1) return nonSelf[0];
      return null;
    }
    if (uniq.length === 1) return uniq[0];
    if (lastOpponent && uniq.includes(lastOpponent)) return lastOpponent;
    // Ambiguous without self: avoid blind guess.
    return null;
  }

  function getProfileLinkNames() {
    const names = [];
    const sels = [
      'header a[href*="/member/"]',
      'nav a[href*="/member/"]',
      'a[aria-label*="Profile"][href*="/member/"]'
    ];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach(el => {
        const href = el.getAttribute('href') || '';
        const m = href.match(/\/member\/([a-z0-9_-]{3,20})/i);
        if (m) names.push(m[1].toLowerCase());
      });
    }
    return [...new Set(names)];
  }

  function extractPlayersFromScripts() {
    const found = [];
    const scriptTexts = [...document.querySelectorAll('script')].slice(0, 60).map(s => s.textContent || '');
    
    // Multiple patterns for different JSON structures
    const patterns = [
      // Original pattern
      /"(?:white|black|player(?:One|Two)?|opponent)"\s*:\s*\{[^}]*?"username"\s*:\s*"([a-z0-9_-]{3,20})"/ig,
      // Direct username references
      /"(?:white|black|player(?:One|Two)?|opponent)(?:Username|Name)?"\s*:\s*"([a-z0-9_-]{3,20})"/ig,
      // User object patterns
      /"user"\s*:\s*\{[^}]*?"username"\s*:\s*"([a-z0-9_-]{3,20})"/ig,
      // Player array patterns
      /"players"\s*:\s*\[[^]]*?"([a-z0-9_-]{3,20})"/ig,
      // Game state patterns  
      /"gameState"[^}]*?"(?:white|black)Player"[^}]*?"([a-z0-9_-]{3,20})"/ig
    ];
    
    for (const t of scriptTexts) {
      for (const rx of patterns) {
        rx.lastIndex = 0; // Reset regex state
        let m;
        while ((m = rx.exec(t))) {
          found.push(m[1].toLowerCase());
        }
      }
      
      // PGN tags fallback
      const w = t.match(/\[White\s+"([a-z0-9_-]{3,20})"\]/i);
      const b = t.match(/\[Black\s+"([a-z0-9_-]{3,20})"\]/i);
      if (w) found.push(w[1].toLowerCase());
      if (b) found.push(b[1].toLowerCase());
      
      // URL-based extraction from script content
      const urlMatches = t.matchAll(/\/member\/([a-z0-9_-]{3,20})/ig);
      for (const match of urlMatches) {
        found.push(match[1].toLowerCase());
      }
    }
    
    return [...new Set(found)];
  }

  function findOpponentUsernameFromDom(lastOpponent = null) {
    const selfName = getSelfUsername();
    
    // Strategy 1: Highly specific live game selectors
    const gameSpecificSelectors = [
      // Chess.com 2026 live game structure
      '.board-layout-player-top [data-cy="user-tagline-username"]',
      '.board-layout-player-bottom [data-cy="user-tagline-username"]',
      '.player-component:not(.player-component--self) [data-cy="user-tagline-username"]',
      '.game-layout-player-info [data-cy="user-tagline-username"]'
    ];
    
    for (const selector of gameSpecificSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const username = normalizeName(el.textContent);
        if (username && username !== selfName) {
          return username;
        }
      }
    }
    
    // Strategy 2: Member links in game area (very reliable)
    const memberLinkSelectors = [
      '.board-layout-player-top a[href*="/member/"]',
      '.board-layout-player-bottom a[href*="/member/"]',
      '.player-component a[href*="/member/"]:not([href*="/game/"])'
    ];
    
    for (const selector of memberLinkSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const href = el.getAttribute('href') || '';
        const match = href.match(/\/member\/([a-z0-9_-]{3,20})/i);
        if (match) {
          const username = normalizeName(match[1]);
          if (username && username !== selfName) {
            return username;
          }
        }
      }
    }
    
    // Strategy 3: Script parsing (last resort)
    const scriptedPlayers = extractPlayersFromScripts();
    const validPlayers = scriptedPlayers.filter(p => p !== selfName);
    if (validPlayers.length === 1) {
      return validPlayers[0];
    }
    
    // If we still have lastOpponent and it's in valid players, use it
    if (lastOpponent && validPlayers.includes(lastOpponent)) {
      return lastOpponent;
    }
    
    return null;
  }

  function inferGamePool() {
    const text = document.body.innerText.toLowerCase();
    if (/\b(1\+0|1 min|bullet|2\+1|2 min)\b/.test(text)) return "chess_bullet";
    if (/\b(3\+0|3\+2|5\+0|5\+3|blitz|5 min|3 min)\b/.test(text)) return "chess_blitz";
    if (/\b(10\+0|10\+5|15\+10|rapid|10 min|15 min)\b/.test(text)) return "chess_rapid";
    if (location.pathname.includes("/game/daily")) return "chess_daily";
    return null;
  }

  async function api(path) {
    const res = await fetch(`${API}${path}`, { credentials: "omit" });
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }

  async function getArchives(username) {
    const data = await api(`${username}/games/archives`);
    return data.archives || [];
  }

  function pickRecentArchives(urls) {
    return urls.slice(-2); // last two months
  }

  async function getGamesFromArchives(urls) {
    const out = [];
    for (const u of urls) {
      try {
        const r = await fetch(u, { credentials: "omit" });
        if (!r.ok) continue;
        const j = await r.json();
        out.push(...(j.games || []));
      } catch {}
    }
    return out;
  }

  function resultToWLD(result) {
    if (!result) return "other";
    if (result === "win") return "win";
    if (["agreed", "stalemate", "repetition", "timevsinsufficient", "insufficient", "50move", "draw"].includes(result)) return "draw";
    if (["checkmated", "timeout", "resigned", "abandoned", "lose"].includes(result)) return "loss";
    return "other";
  }

  function choosePrimaryRating(stats, preferredPool) {
    if (preferredPool && stats?.[preferredPool]?.last?.rating) {
      return { type: preferredPool, rating: stats[preferredPool].last.rating };
    }
    const pools = ["chess_rapid", "chess_blitz", "chess_bullet", "chess_daily"];
    let best = { type: null, rating: 1200 };
    for (const p of pools) {
      const r = stats?.[p]?.last?.rating;
      if (r && r > best.rating) best = { type: p, rating: r };
    }
    return best;
  }

  function calcOverall(stats, pool) {
    const record = stats?.[pool]?.record;
    if (!record) return { total: 0, winrate: 0 };
    const w = record.win || 0;
    const l = record.loss || 0;
    const d = record.draw || 0;
    const total = w + l + d;
    return { total, winrate: total ? (w / total) * 100 : 0, w, l, d };
  }

  function scoreRisk(metrics, cfg) {
    const {
      accountAgeDays,
      rating,
      overallWinrate,
      overallGames,
      recentWinrate,
      recentGames,
      highAccPct,
      highAccGames
    } = metrics;

    let score = 0;
    const reasons = [];

    if (accountAgeDays < 30 && rating >= 1600) { score += 22; reasons.push("very new account + high rating"); }
    else if (accountAgeDays < 90 && rating >= 1500) { score += 14; reasons.push("new account + elevated rating"); }
    else if (accountAgeDays < 180 && rating >= 1700) { score += 8; reasons.push("young account + high rating"); }

    if (overallGames >= cfg.minGamesForOverall) {
      if (overallWinrate >= cfg.highWinrate) { score += 28; reasons.push(`overall winrate > ${cfg.highWinrate}%`); }
      else if (overallWinrate >= cfg.suspiciousWinrate) { score += 12; reasons.push(`overall winrate > ${cfg.suspiciousWinrate}%`); }
    }

    if (recentGames >= cfg.minGamesForRecent) {
      if (recentWinrate >= cfg.highWinrate + 5) { score += 24; reasons.push("recent 30d winrate very high"); }
      else if (recentWinrate >= cfg.suspiciousWinrate + 5) { score += 10; reasons.push("recent 30d winrate elevated"); }
    }

    const accThreshold = rating < cfg.lowRatingCutoff ? cfg.lowRatingAccuracyThreshold : cfg.highRatingAccuracyThreshold;
    if (highAccGames >= cfg.minGamesForAccuracy) {
      if (highAccPct >= cfg.highAccSeverePct) { score += 22; reasons.push(`many games above ${accThreshold}% accuracy`); }
      else if (highAccPct >= cfg.highAccNotablePct) { score += 10; reasons.push(`notable share above ${accThreshold}% accuracy`); }
    }

    return { score: clamp(Math.round(score), 0, 100), reasons, accThreshold };
  }

  function upsertWidget() {
    let root = document.getElementById("risk-score-widget");
    if (!root) {
      root = document.createElement("div");
      root.id = "risk-score-widget";
      root.innerHTML = `
        <div class="risk-header">
          <span class="risk-title"><img id="risk-logo" alt="logo" /> Opponent Risk Radar</span>
          <div class="risk-actions">
            <button id="risk-refresh" title="Refresh">↻</button>
            <button id="risk-manual" title="Analyze username">@</button>
            <button id="risk-me" title="Set my username">Me</button>
          </div>
        </div>
        <div class="risk-body">Waiting for opponent…</div>`;
      document.body.appendChild(root);
      const logo = root.querySelector('#risk-logo');
      if (logo) {
        try { 
          logo.src = chrome?.runtime?.getURL?.('logo.svg') || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="%23c41e3a"/><text x="8" y="12" text-anchor="middle" font-size="10" fill="white">🕷</text></svg>';
        } catch {
          logo.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="%23c41e3a"/><text x="8" y="12" text-anchor="middle" font-size="10" fill="white">🕷</text></svg>';
        }
      }
    }
    return root;
  }

  function scoreColor(score) {
    if (score >= 70) return "#dc2626";
    if (score >= 40) return "#f59e0b";
    return "#16a34a";
  }

  function renderLoading(username) {
    upsertWidget().querySelector(".risk-body").innerHTML = `Analyzing <b>@${username}</b>…`;
  }

  function renderError(msg) {
    upsertWidget().querySelector(".risk-body").innerHTML = `<div class="error">${msg}</div>`;
  }

  function renderResult(username, d) {
    const root = upsertWidget();
    const color = scoreColor(d.risk.score);
    root.style.borderColor = color;

    const reasons = d.risk.reasons.length
      ? `<ul>${d.risk.reasons.map(r => `<li>${r}</li>`).join("")}</ul>`
      : `<div class="low">No strong red flags detected.</div>`;

    root.querySelector(".risk-body").innerHTML = `
      <div class="score" style="color:${color}">${d.risk.score}/100</div>
      <div><b>@${username}</b></div>
      <div>Pool: <b>${d.primary.type || "unknown"}</b> | Rating: <b>${d.primary.rating}</b></div>
      <div>Account age: <b>${d.accountAgeDays}d</b></div>
      <div>Overall winrate: <b>${d.overall.winrate.toFixed(1)}%</b> (${d.overall.total} games)</div>
      <div>Recent 30d winrate: <b>${d.recentWinrate.toFixed(1)}%</b> (${d.recent.total} games)</div>
      <div>High-accuracy ≥ ${d.risk.accThreshold}%: <b>${d.highAccPct.toFixed(1)}%</b> (${d.highAccGames} known)</div>
      <details><summary>Why this score</summary>${reasons}</details>
    `;
  }

  function getConfig() {
    return new Promise(resolve => {
      try {
        if (chrome?.storage?.sync?.get) {
          chrome.storage.sync.get(DEFAULTS, cfg => resolve({ ...DEFAULTS, ...(cfg || {}) }));
          return;
        }
      } catch {}
      resolve({ ...DEFAULTS });
    });
  }

  async function analyze(username) {
    const key = username.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_MS) return cached.data;

    const cfg = await getConfig();
    const profile = await api(`${key}`);
    const stats = await api(`${key}/stats`);
    const archives = await getArchives(key);
    const games = await getGamesFromArchives(pickRecentArchives(archives));

    const joined = profile.joined ? new Date(profile.joined * 1000) : new Date();
    const accountAgeDays = daysBetween(new Date(), joined);

    const preferredPool = inferGamePool();
    const primary = choosePrimaryRating(stats, preferredPool);
    const overall = calcOverall(stats, primary.type || preferredPool || "chess_rapid");

    const recent = { total: 0, win: 0, draw: 0, loss: 0 };
    const accValues = [];
    const nowSec = Date.now() / 1000;
    const since30 = nowSec - 30 * 24 * 60 * 60;

    for (const g of games) {
      const isWhite = g.white?.username?.toLowerCase() === key;
      const isBlack = g.black?.username?.toLowerCase() === key;
      if (!isWhite && !isBlack) continue;
      const side = isWhite ? g.white : g.black;

      if ((g.end_time || 0) >= since30) {
        recent.total += 1;
        const outcome = resultToWLD(side?.result);
        if (outcome === "win") recent.win += 1;
        else if (outcome === "draw") recent.draw += 1;
        else if (outcome === "loss") recent.loss += 1;
      }

      const acc = isWhite ? g.accuracies?.white : g.accuracies?.black;
      const accNum = typeof acc === "string" ? parseFloat(acc) : (typeof acc === "number" ? acc : NaN);
      if (!Number.isNaN(accNum)) accValues.push(accNum);
    }

    const recentWinrate = recent.total ? (recent.win / recent.total) * 100 : 0;
    const threshold = primary.rating < cfg.lowRatingCutoff ? cfg.lowRatingAccuracyThreshold : cfg.highRatingAccuracyThreshold;
    const highAccGames = accValues.length;
    const highAccCount = accValues.filter(a => a >= threshold).length;
    const highAccPct = highAccGames ? (highAccCount / highAccGames) * 100 : 0;

    const risk = scoreRisk({
      accountAgeDays,
      rating: primary.rating,
      overallWinrate: overall.winrate,
      overallGames: overall.total,
      recentWinrate,
      recentGames: recent.total,
      highAccPct,
      highAccGames
    }, cfg);

    const data = { accountAgeDays, primary, overall, recent, recentWinrate, highAccPct, highAccGames, risk };
    cache.set(key, { ts: Date.now(), data });
    return data;
  }

  let lastUser = null;

  async function runForUser(user, force = false) {
    const u = (user || "").toLowerCase();
    if (!u) return;
    const self = getSelfUsername();
    if (self && u === self) {
      renderError(`Detected your own username (@${u}). Click @ to enter opponent manually.`);
      return;
    }
    if (!force && u === lastUser) return;
    lastUser = u;
    try {
      renderLoading(u);
      const data = await analyze(u);
      renderResult(u, data);
    } catch {
      renderError(`Could not analyze @${u} yet.`);
    }
  }

  async function tick() {
    const selfName = getSelfUsername();
    
    // Debug: Log current page context
    console.log('🕷️ Spidey Sense: Scanning for opponent...', {
      url: location.href,
      pathname: location.pathname,
      selfName: selfName
    });
    
    const opponent = findOpponentUsernameFromDom(lastUser);
    
    if (!opponent) {
      // Detailed debugging
      const allUsernames = [];
      const debugSelectors = [
        '[data-cy="user-tagline-username"]',
        '.username',
        'a[href*="/member/"]'
      ];
      
      debugSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const text = el.textContent?.trim();
          const href = el.getAttribute('href');
          if (text) allUsernames.push(`${sel}:"${text}"`);
          if (href && href.includes('/member/')) {
            const match = href.match(/\/member\/([^/?]+)/);
            if (match) allUsernames.push(`${sel}:href="${match[1]}"`);
          }
        });
      });
      
      console.log('🕷️ Debug - All found usernames:', allUsernames);
      renderError(`Could not detect opponent. Self: ${selfName || 'unknown'}. Found usernames: ${allUsernames.slice(0, 5).join(', ')}${allUsernames.length > 5 ? '...' : ''}. Click @ to enter manually.`);
      return;
    }
    
    console.log('🕷️ Opponent detected:', opponent);
    lastUser = opponent;
    await runForUser(opponent);
  }

  function boot() {
    const root = upsertWidget();

    try {
      chrome?.storage?.sync?.get({ selfUsernameOverride: null }, cfg => {
        const n = normalizeName(cfg?.selfUsernameOverride || "");
        if (n) SELF_OVERRIDE = n;
      });
    } catch {}

    root.querySelector('#risk-refresh')?.addEventListener('click', () => {
      const user = (findOpponentUsernameFromDom(lastUser) || parseUsernameFromUrl() || lastUser || "").toLowerCase();
      runForUser(user, true);
    });
    root.querySelector('#risk-manual')?.addEventListener('click', () => {
      const guessed = (findOpponentUsernameFromDom(lastUser) || parseUsernameFromUrl() || lastUser || "").toLowerCase();
      const entered = prompt('Enter opponent Chess.com username to analyze:', guessed || '');
      if (entered) runForUser(entered.trim().replace(/^@/, ''), true);
    });
    root.querySelector('#risk-me')?.addEventListener('click', () => {
      const guessed = getSelfUsername() || '';
      const entered = prompt('Set YOUR Chess.com username (saved):', guessed);
      const n = normalizeName(entered || '');
      if (n) {
        SELF_OVERRIDE = n;
        try { chrome?.storage?.sync?.set?.({ selfUsernameOverride: n }); } catch {}
      }
    });

    tick();
    const obs = new MutationObserver(() => tick());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tick, 5000);
  }

  // Message listener for communication with popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_OPPONENT') {
      const opponent = findOpponentUsernameFromDom(lastUser) || parseUsernameFromUrl() || lastUser;
      sendResponse({ opponent: opponent || null });
      return true;
    }
  });

  boot();
})();
