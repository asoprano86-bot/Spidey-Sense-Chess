// Spidey Sense Chess - Popup Script

class SpideySensePopup {
  constructor() {
    this.currentOpponent = null;
    this.init();
  }

  async init() {
    // Show loading initially
    this.showLoading();
    
    // Try to get opponent from current tab
    await this.detectOpponent();
    
    // Set up event listeners
    document.getElementById('retry-btn')?.addEventListener('click', () => {
      this.retry();
    });
  }

  async detectOpponent() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('chess.com')) {
        this.showNoGame('Not on Chess.com');
        return;
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_OPPONENT' });
      
      if (response?.opponent) {
        this.currentOpponent = response.opponent;
        await this.analyzeOpponent();
      } else {
        this.showNoGame();
      }
      
    } catch (error) {
      console.error('Detection error:', error);
      this.showError('Unable to detect opponent. Make sure you\'re on a Chess.com game page.');
    }
  }

  async analyzeOpponent() {
    if (!this.currentOpponent) return;
    
    this.showResults();
    this.updateOpponentInfo(this.currentOpponent);
    
    try {
      // Request risk analysis from background script
      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'CALCULATE_RISK', username: this.currentOpponent },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          }
        );
      });

      if (result.error) {
        throw new Error(result.error);
      }

      this.displayRiskAnalysis(result);
      
    } catch (error) {
      console.error('Analysis error:', error);
      this.showError(`Analysis failed: ${error.message}`);
    }
  }

  displayRiskAnalysis(analysis) {
    const { riskScore, factors } = analysis;
    
    // Update risk score display
    this.updateRiskScore(riskScore);
    
    // Update rating if available
    if (factors.playerRating) {
      document.getElementById('rating').textContent = `Rating: ${factors.playerRating}`;
    }
    
    // Update factor displays
    this.updateAccountAgeFactor(factors.accountAge);
    this.updateWinRateFactors(factors.winRates);
    this.updateRecentPerformance(factors.recentWinRate);
    
    // Update recommendation
    this.updateRecommendation(riskScore, factors);
  }

  updateRiskScore(score) {
    const scoreElement = document.getElementById('risk-score');
    const textElement = document.getElementById('risk-text');
    const circleElement = document.getElementById('risk-circle');
    
    scoreElement.textContent = score;
    
    // Update risk text and styling based on score
    if (score < 35) {
      textElement.textContent = '🟢 Low Risk - Likely Clean';
      textElement.className = 'risk-text low';
      circleElement.style.background = 'conic-gradient(from 0deg, #4caf50 0%, #4caf50 100%)';
    } else if (score < 70) {
      textElement.textContent = '🟡 Medium Risk - Monitor Closely';
      textElement.className = 'risk-text medium';
      circleElement.style.background = 'conic-gradient(from 0deg, #4caf50 0%, #ff9800 50%, #ff9800 100%)';
    } else {
      textElement.textContent = '🔴 High Risk - Very Suspicious';
      textElement.className = 'risk-text high';
      circleElement.style.background = 'conic-gradient(from 0deg, #4caf50 0%, #ff9800 33%, #f44336 66%, #f44336 100%)';
    }
  }

  updateAccountAgeFactor(accountAge) {
    const valueElement = document.getElementById('age-value');
    const statusElement = document.getElementById('age-status');
    
    if (accountAge) {
      const { days, isNew } = accountAge;
      valueElement.textContent = `${days} days old`;
      
      if (isNew) {
        statusElement.textContent = '⚠️';
        statusElement.title = 'New account - potentially suspicious';
      } else {
        statusElement.textContent = '✅';
        statusElement.title = 'Established account';
      }
    } else {
      valueElement.textContent = 'Unknown';
      statusElement.textContent = '❓';
    }
  }

  updateWinRateFactors(winRates) {
    const valueElement = document.getElementById('winrate-value');
    const statusElement = document.getElementById('winrate-status');
    
    if (!winRates || Object.keys(winRates).length === 0) {
      valueElement.textContent = 'No data available';
      statusElement.textContent = '❓';
      return;
    }

    // Find the most suspicious win rate
    let maxWinRate = 0;
    let mostSuspicious = null;
    let format = '';
    
    for (const [fmt, data] of Object.entries(winRates)) {
      if (data.totalGames >= 10 && data.winRate > maxWinRate) {
        maxWinRate = data.winRate;
        mostSuspicious = data;
        format = fmt.replace('chess_', '');
      }
    }

    if (mostSuspicious) {
      valueElement.textContent = `${maxWinRate}% (${format}, ${mostSuspicious.totalGames} games)`;
      
      if (mostSuspicious.highlySuspicious) {
        statusElement.textContent = '🚨';
        statusElement.title = 'Extremely high win rate';
      } else if (mostSuspicious.suspicious) {
        statusElement.textContent = '⚠️';
        statusElement.title = 'Suspicious win rate';
      } else {
        statusElement.textContent = '✅';
        statusElement.title = 'Normal win rate';
      }
    } else {
      valueElement.textContent = 'Insufficient data';
      statusElement.textContent = '❓';
    }
  }

  updateRecentPerformance(recentWinRate) {
    const valueElement = document.getElementById('recent-value');
    const statusElement = document.getElementById('recent-status');
    
    if (!recentWinRate || recentWinRate.insufficient) {
      valueElement.textContent = 'Insufficient recent games';
      statusElement.textContent = '❓';
      return;
    }

    const { winRate, totalGames } = recentWinRate;
    valueElement.textContent = `${winRate}% (${totalGames} games, last 30 days)`;
    
    if (recentWinRate.highlySuspicious) {
      statusElement.textContent = '🚨';
      statusElement.title = 'Extremely high recent performance';
    } else if (recentWinRate.suspicious) {
      statusElement.textContent = '⚠️';
      statusElement.title = 'Suspicious recent performance';
    } else {
      statusElement.textContent = '✅';
      statusElement.title = 'Normal recent performance';
    }
  }

  updateRecommendation(riskScore, factors) {
    const recElement = document.getElementById('recommendation');
    const iconElement = document.getElementById('rec-icon');
    const textElement = document.getElementById('rec-text');
    
    if (riskScore < 35) {
      recElement.className = 'recommendation low';
      iconElement.textContent = '😊';
      textElement.innerHTML = '<strong>Play with confidence!</strong><br>This opponent shows normal gameplay patterns.';
    } else if (riskScore < 70) {
      recElement.className = 'recommendation medium';
      iconElement.textContent = '🤔';
      textElement.innerHTML = '<strong>Proceed with caution.</strong><br>Some patterns suggest potential concern. Monitor gameplay closely.';
    } else {
      recElement.className = 'recommendation high';
      iconElement.textContent = '🕷️';
      textElement.innerHTML = '<strong>Your Spidey Sense is tingling!</strong><br>High risk of suspicious play. Consider avoiding this matchup.';
    }
  }

  updateOpponentInfo(username) {
    document.getElementById('opponent-name').textContent = username;
  }

  showLoading() {
    this.hideAll();
    document.getElementById('loading').classList.remove('hidden');
  }

  showNoGame(message = null) {
    this.hideAll();
    const noGameElement = document.getElementById('no-game');
    noGameElement.classList.remove('hidden');
    
    if (message) {
      noGameElement.querySelector('p').textContent = message;
    }
  }

  showResults() {
    this.hideAll();
    document.getElementById('results').classList.remove('hidden');
  }

  showError(message) {
    this.hideAll();
    const errorElement = document.getElementById('error');
    errorElement.classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
  }

  hideAll() {
    const elements = ['loading', 'no-game', 'results', 'error'];
    elements.forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
  }

  async retry() {
    await this.init();
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SpideySensePopup();
});

// Handle popup being opened
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'POPUP_OPENED') {
    // Refresh analysis if popup is reopened
    location.reload();
  }
});