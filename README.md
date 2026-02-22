# 🕷️ Spidey Sense Chess

> Your Spider-Man themed opponent analysis extension for Chess.com

A Chrome/Brave extension that analyzes your Chess.com opponents and displays a risk score based on suspicious gameplay patterns. Built with the algorithm from the Reddit chess community.

![Spidey Sense Chess](icons/icon128.png)

## 🎯 Features

- **🕷️ Spider Sense Detection**: Automatically detects opponents when you start a game
- **🎯 Risk Analysis**: Calculates 0-100 risk score based on proven cheating indicators
- **🕸️ Spider-Man Themed UI**: Cool red/blue design with web patterns and Spider-Man styling  
- **⚡ Real-time Scanning**: Analysis starts immediately when opponent is detected
- **📊 Detailed Breakdown**: See exactly what factors contribute to the risk score
- **🛡️ Smart Recommendations**: Clear guidance on whether to play or avoid the matchup

## 🧮 Risk Calculation Algorithm

Based on the top-rated Reddit comment algorithm:

### 📅 Account Age Analysis
- **Fresh accounts** with high ratings are flagged as suspicious
- **New accounts** (<90 days) get a 1.5x risk multiplier

### 📊 Win Rate Detection  
- **Overall win rates** >55% are suspicious, >70% are highly suspicious
- **Recent performance** (last 30 days) weighted more heavily
- **Sample size matters** - needs sufficient games to be meaningful

### ⚡ Recent Performance
- Analyzes last 30 days of gameplay
- Flags consistent high win rates with adequate sample sizes
- Accounts for both wins and total games played

### 🎯 Risk Score Ranges
- **🟢 0-34**: Low Risk - Likely clean player
- **🟡 35-69**: Medium Risk - Monitor closely  
- **🔴 70-100**: High Risk - Very suspicious patterns

## 🚀 Installation

### From Chrome Web Store (Coming Soon)
1. Visit Chrome Web Store
2. Search "Spidey Sense Chess"  
3. Click "Add to Chrome/Brave"

### Manual Installation (Current)
1. Download the latest release
2. Extract the ZIP file
3. Open `chrome://extensions/` (Chrome) or `brave://extensions/` (Brave)
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

## 🎮 How to Use

1. **Navigate to Chess.com** and start a live game
2. **Extension auto-detects** your opponent  
3. **Click the Spidey icon** in your browser toolbar
4. **View the risk analysis** and recommendation
5. **Decide whether to play** based on your Spidey Sense!

## 🕸️ Screenshots

*Coming soon - upload screenshots of the extension in action*

## 🛡️ Privacy & Security  

- **No data collection** - all analysis happens locally
- **Only public Chess.com API** data is used
- **No tracking or analytics**
- **Open source** - audit the code yourself

## 🔧 Technical Details

- **Manifest V3** - Future-proof extension format
- **Chrome/Brave Compatible** - Works on all Chromium browsers  
- **Chess.com API Integration** - Uses official public APIs
- **Modern JavaScript** - Clean, maintainable codebase

## ⚠️ Disclaimer

**This extension provides risk indicators, not proof of cheating.**

- A high risk score suggests unusual patterns worth attention
- Players deserve the benefit of the doubt
- Use this tool responsibly and in good faith
- Report suspected cheaters through official Chess.com channels

## 🕷️ With Great Power...

Remember: With great power comes great responsibility. Use your Spidey Sense wisely!

---

## 🐛 Bug Reports & Feature Requests

Found an issue or have an idea? Open an issue on GitHub!

## 📜 License

MIT License - Feel free to fork, modify, and distribute!

**Spider-Man** is a trademark of Marvel Characters, Inc. This extension is fan-made and not affiliated with Marvel or Chess.com.

---

*Your friendly neighborhood chess extension* 🕷️🏰