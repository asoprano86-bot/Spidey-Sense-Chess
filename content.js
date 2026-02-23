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
    
    // Simple blocked terms to avoid false positives
    const blocked = ['game', 'play', 'chess', 'live', 'move', 'time', 'white', 'black', 'player', 'user', 'guest', 'anon'];
    if (blocked.includes(v)) return null;
    
    return v;
  }

  let SELF_OVERRIDE = null;
  let lastUser = null;

  function getSelfUsername() {
    if (SELF_OVERRIDE) return SELF_OVERRIDE;
    
    // Simple, safe self-detection
    try {
      const userMenu = document.querySelector('[data-cy="user-menu-username"]');
      if (userMenu) return normalizeName(userMenu.textContent);
      
      const homeUser = document.querySelector('[data-cy="home-username"]');  
      if (homeUser) return normalizeName(homeUser.textContent);
      
      return null;
    } catch (e) {
      return null;
    }
  }

  function findOpponentFromDOM() {
    try {
      const selfName = getSelfUsername();
      
      // Simple, safe opponent detection - only look in obvious places
      const candidates = [];
      
      // Look for usernames in player areas
      const playerSelectors = [
        '[data-cy="user-tagline-username"]'
      ];
      
      for (const selector of playerSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const username = normalizeName(el.textContent);
          if (username && username !== selfName) {
            candidates.push(username);
          }
        }
      }
      
      // Return first valid candidate that's not self
      return candidates.length > 0 ? candidates[0] : null;
    } catch (e) {
      return null;
    }
  }

  function upsertWidget() {
    let root = document.querySelector("#risk-score-widget");
    if (!root) {
      root = document.createElement("div");
      root.id = "risk-score-widget";
      document.body.appendChild(root);
    }

    if (root.innerHTML.trim() === "") {
      const logo = document.createElement('img');
      try { 
        logo.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="%23c41e3a"/><text x="8" y="12" text-anchor="middle" font-size="10" fill="white">🕷</text></svg>';
      } catch {}
      
      root.innerHTML = `
        <div class="risk-header">
          <div class="risk-logo"></div>
          🕷️ Spidey Sense Chess
          <div class="risk-buttons">
            <button id="risk-refresh" title="Refresh analysis">🔄</button>
            <button id="risk-manual" title="Manual entry">@</button>
            <button id="risk-me" title="Set your username">👤</button>
          </div>
        </div>
        <div class="risk-body">Ready to analyze opponent...</div>
      `;
    }
    return root;
  }

  function renderLoading(username) {
    upsertWidget().querySelector(".risk-body").innerHTML = `Analyzing <b>@${username}</b>…`;
  }

  function renderError(msg) {
    upsertWidget().querySelector(".risk-body").innerHTML = `<div class="error">${msg}</div>`;
  }

  function renderResult(username, data) {
    const root = upsertWidget();
    root.querySelector(".risk-body").innerHTML = `
      <div class="result">
        <div class="opponent">@${username}</div>
        <div class="risk-score risk-${data.risk.level}">${data.risk.score}</div>
        <div class="risk-details">${data.risk.summary}</div>
      </div>
    `;
  }

  async function runForUser(user, force = false) {
    if (!user) return;
    const u = user.toLowerCase();
    const self = getSelfUsername();
    
    if (self && u === self) {
      renderError(`Detected your own username (@${u}). Click @ to enter opponent manually.`);
      return;
    }
    
    if (!force && u === lastUser) return;
    lastUser = u;
    
    try {
      renderLoading(u);
      // For now, just show a placeholder result
      renderResult(u, {
        risk: {
          score: "?", 
          level: "unknown",
          summary: "Analysis coming soon..."
        }
      });
    } catch (e) {
      renderError(`Could not analyze @${u}.`);
    }
  }

  function tick() {
    try {
      const opponent = findOpponentFromDOM();
      if (opponent && opponent !== lastUser) {
        runForUser(opponent);
      } else if (!opponent && !lastUser) {
        renderError("No opponent detected. Click @ to enter manually.");
      }
    } catch (e) {
      // Silently fail to avoid breaking Chess.com
    }
  }

  function boot() {
    try {
      const root = upsertWidget();

      root.querySelector('#risk-refresh')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const user = findOpponentFromDOM() || lastUser;
        if (user) runForUser(user, true);
      });
      
      root.querySelector('#risk-manual')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const entered = prompt('Enter opponent Chess.com username:', '');
        if (entered) runForUser(entered.trim().replace(/^@/, ''), true);
      });
      
      root.querySelector('#risk-me')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const entered = prompt('Set YOUR Chess.com username (for better detection):', getSelfUsername() || '');
        if (entered) {
          SELF_OVERRIDE = normalizeName(entered);
        }
      });

      // Safe, non-interfering detection
      tick();
      setInterval(tick, 10000); // Slower interval to avoid interference
      
    } catch (e) {
      // Silently fail to avoid breaking Chess.com
    }
  }

  // Message listener for popup communication
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'GET_OPPONENT') {
        const opponent = findOpponentFromDOM() || lastUser;
        sendResponse({ opponent: opponent || null });
        return true;
      }
    });
  } catch (e) {
    // Silently fail if chrome.runtime not available
  }

  // Safe initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    setTimeout(boot, 1000); // Delay to let Chess.com load first
  }

})();