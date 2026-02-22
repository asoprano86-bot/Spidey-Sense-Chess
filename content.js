// Spidey Sense Chess - Content Script
// Detects opponents on Chess.com game pages

let currentOpponent = null;
let gameDetected = false;

// Function to extract opponent username from the page
function detectOpponent() {
  // Multiple selectors to catch different Chess.com layouts
  const selectors = [
    // Live game selectors
    '.board-layout-player-top .user-tagline-username',
    '.board-layout-player-bottom .user-tagline-username', 
    '.player-top .user-tagline-username',
    '.player-bottom .user-tagline-username',
    
    // General game page selectors
    '.game-layout-player-info .user-tagline-username',
    '.player-info .user-tagline-username',
    
    // Fallback selectors
    'a[href*="/member/"]',
    '.username'
  ];

  const foundUsernames = new Set();

  // Try each selector
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length >= 3 && text.length <= 20) {
        // Filter out obvious false positives
        const blocked = ['game', 'play', 'chess', 'live', 'move', 'time', 'white', 'black', 'player', 'user'];
        if (!blocked.includes(text.toLowerCase())) {
          foundUsernames.add(text.toLowerCase());
        }
      }
      
      // Also check href for member links
      const href = el.getAttribute('href');
      if (href && href.includes('/member/')) {
        const match = href.match(/\/member\/([a-z0-9_-]+)/i);
        if (match && match[1] && match[1].length >= 3) {
          foundUsernames.add(match[1].toLowerCase());
        }
      }
    });
  }

  // Get self username from page (user menu, profile links, etc)
  let selfUsername = null;
  const selfSelectors = [
    '.nav-link-main-design[href*="/member/"]',
    '.user-username-component',
    'a[data-cy="web-nav-profile-link"]'
  ];

  for (const selector of selfSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      const href = el.getAttribute('href');
      if (href && href.includes('/member/')) {
        const match = href.match(/\/member\/([a-z0-9_-]+)/i);
        if (match && match[1]) {
          selfUsername = match[1].toLowerCase();
          break;
        }
      }
    }
  }

  // Filter out self username and return opponent
  const opponents = Array.from(foundUsernames).filter(name => 
    name !== selfUsername
  );

  return opponents.length > 0 ? opponents[0] : null;
}

// Function to check if we're on a game page
function isGamePage() {
  const url = window.location.href;
  return (
    url.includes('/game/live/') || 
    url.includes('/game/') || 
    url.includes('/play/')
  ) && document.querySelector('.board');
}

// Main detection function
function checkForGame() {
  if (!isGamePage()) {
    return;
  }

  const opponent = detectOpponent();
  
  if (opponent && opponent !== currentOpponent) {
    currentOpponent = opponent;
    gameDetected = true;
    
    console.log('🕷️ Spidey Sense: Detected opponent:', opponent);
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'OPPONENT_DETECTED',
      opponent: opponent,
      url: window.location.href
    });
  }
}

// Initialize and set up observers
function init() {
  // Initial check
  checkForGame();
  
  // Set up mutation observer to detect dynamic changes
  const observer = new MutationObserver(() => {
    checkForGame();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check periodically
  setInterval(checkForGame, 3000);
}

// Wait for page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_OPPONENT') {
    sendResponse({
      opponent: currentOpponent,
      detected: gameDetected,
      url: window.location.href
    });
  }
});