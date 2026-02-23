// Spidey Sense Chess - Background Service Worker
// Handles Chess.com API calls and risk calculation

// Risk calculation algorithm based on Reddit comment
class RiskCalculator {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  async calculateRisk(username) {
    const cacheKey = username.toLowerCase();
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const result = await this.performRiskAnalysis(username);
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      return result;
    } catch (error) {
      console.error('Risk calculation error:', error);
      return {
        error: error.message,
        riskScore: 0,
        factors: {}
      };
    }
  }

  async performRiskAnalysis(username) {
    // Get profile data
    const profile = await this.fetchChesscomAPI(`/pub/player/${username}`);
    
    // Get player stats for each format
    const stats = await this.fetchChesscomAPI(`/pub/player/${username}/stats`);
    
    // Get recent games (last month + previous if before 15th)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const gamesCurrentMonth = await this.fetchChesscomAPI(
      `/pub/player/${username}/games/${currentYear}/${currentMonth.toString().padStart(2, '0')}`
    );
    
    let gamesPreviousMonth = null;
    if (currentDate.getDate() < 15) {
      const prevDate = new Date(currentYear, currentMonth - 2, 1);
      const prevMonth = prevDate.getMonth() + 1;
      const prevYear = prevDate.getFullYear();
      
      gamesPreviousMonth = await this.fetchChesscomAPI(
        `/pub/player/${username}/games/${prevYear}/${prevMonth.toString().padStart(2, '0')}`
      );
    }

    // Calculate risk factors
    const accountAge = this.calculateAccountAge(profile.joined);
    const winRates = this.calculateWinRates(stats);
    const recentWinRate = this.calculateRecentWinRate(gamesCurrentMonth, gamesPreviousMonth);
    const accuracyData = await this.calculateAccuracyData(gamesCurrentMonth, gamesPreviousMonth, username);
    
    // Calculate final risk score
    const riskScore = this.calculateFinalRisk({
      accountAge,
      winRates,
      recentWinRate,
      accuracyData,
      stats
    });

    return {
      riskScore,
      factors: {
        accountAge,
        winRates,
        recentWinRate,
        accuracyData,
        playerRating: this.getHighestRating(stats)
      },
      username,
      timestamp: Date.now()
    };
  }

  async fetchChesscomAPI(endpoint) {
    const response = await fetch(`https://api.chess.com${endpoint}`);
    if (!response.ok) {
      throw new Error(`Chess.com API error: ${response.status}`);
    }
    return await response.json();
  }

  calculateAccountAge(joinedTimestamp) {
    const joined = new Date(joinedTimestamp * 1000);
    const now = new Date();
    const ageInDays = Math.floor((now - joined) / (1000 * 60 * 60 * 24));
    
    return {
      days: ageInDays,
      isNew: ageInDays < 90,
      riskFactor: ageInDays < 90 ? 1.5 : 1.0
    };
  }

  calculateWinRates(stats) {
    const formats = ['chess_rapid', 'chess_blitz', 'chess_bullet'];
    const winRates = {};
    
    for (const format of formats) {
      if (stats[format] && stats[format].last) {
        const { win = 0, loss = 0, draw = 0 } = stats[format].last;
        const total = win + loss + draw;
        
        if (total > 0) {
          const winRate = (win / total) * 100;
          winRates[format] = {
            winRate: Math.round(winRate * 100) / 100,
            totalGames: total,
            wins: win,
            losses: loss,
            draws: draw,
            suspicious: winRate > 55,
            highlySuspicious: winRate > 70
          };
        }
      }
    }
    
    return winRates;
  }

  calculateRecentWinRate(currentMonth, previousMonth) {
    const games = [];
    
    if (currentMonth && currentMonth.games) {
      games.push(...currentMonth.games);
    }
    
    if (previousMonth && previousMonth.games) {
      games.push(...previousMonth.games);
    }

    // Filter to last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentGames = games.filter(game => 
      game.end_time * 1000 > thirtyDaysAgo
    );

    if (recentGames.length === 0) {
      return { winRate: 0, totalGames: 0, insufficient: true };
    }

    let wins = 0;
    const username = recentGames[0].white?.username || recentGames[0].black?.username;
    
    for (const game of recentGames) {
      if (game.white?.result === 'win' && game.white?.username?.toLowerCase() === username?.toLowerCase()) {
        wins++;
      } else if (game.black?.result === 'win' && game.black?.username?.toLowerCase() === username?.toLowerCase()) {
        wins++;
      }
    }

    const winRate = (wins / recentGames.length) * 100;
    
    return {
      winRate: Math.round(winRate * 100) / 100,
      totalGames: recentGames.length,
      wins,
      suspicious: winRate > 55 && recentGames.length >= 20,
      highlySuspicious: winRate > 70 && recentGames.length >= 20
    };
  }

  async calculateAccuracyData(currentMonth, previousMonth, username) {
    // This would require game analysis API which may not be available
    // For now, return placeholder that indicates we need game analysis
    return {
      highAccuracyPercentage: 0,
      totalAnalyzedGames: 0,
      unavailable: true,
      note: "Accuracy analysis requires individual game data"
    };
  }

  getHighestRating(stats) {
    const formats = ['chess_rapid', 'chess_blitz', 'chess_bullet'];
    let highest = 0;
    
    for (const format of formats) {
      if (stats[format] && stats[format].last && stats[format].last.rating) {
        highest = Math.max(highest, stats[format].last.rating);
      }
    }
    
    return highest;
  }

  calculateFinalRisk({ accountAge, winRates, recentWinRate, accuracyData, stats }) {
    let riskScore = 0;
    const rating = this.getHighestRating(stats);
    
    // Account age factor (fresh account + high rating = suspicious)
    if (accountAge.isNew && rating > 1200) {
      riskScore += 25;
    }
    
    // Win rate analysis
    let maxWinRateRisk = 0;
    for (const [format, data] of Object.entries(winRates)) {
      if (data.totalGames >= 20) { // Minimum sample size
        if (data.highlySuspicious) {
          maxWinRateRisk = Math.max(maxWinRateRisk, 40);
        } else if (data.suspicious) {
          maxWinRateRisk = Math.max(maxWinRateRisk, 25);
        }
      }
    }
    riskScore += maxWinRateRisk;
    
    // Recent win rate
    if (!recentWinRate.insufficient && recentWinRate.totalGames >= 15) {
      if (recentWinRate.highlySuspicious) {
        riskScore += 30;
      } else if (recentWinRate.suspicious) {
        riskScore += 20;
      }
    }
    
    // Account age multiplier
    riskScore *= accountAge.riskFactor;
    
    // Cap at 100
    return Math.min(Math.round(riskScore), 100);
  }
}

// Global risk calculator instance
const riskCalculator = new RiskCalculator();

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'OPPONENT_DETECTED') {
    console.log('🕷️ Background: Opponent detected:', request.opponent);
    // Could trigger automatic popup here if desired
    
  } else if (request.type === 'CALCULATE_RISK') {
    // Handle async risk calculation
    riskCalculator.calculateRisk(request.username)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

console.log('🕷️ Spidey Sense Chess background script loaded');