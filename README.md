# Chess.com Opponent Risk Score (Tweaked) v2

Inspired by:
https://www.reddit.com/r/Chesscom/comments/1hlei8m/i_made_a_chrome_extension_to_help_avoid_playing/

Built around the **first top comment's heuristic**.

## v2 upgrades
- Better opponent username detection on Chess.com pages
- Per-time-control preference (tries to score using current pool first: bullet/blitz/rapid/daily)
- Options page for tuning thresholds
- Cleaner risk explanation panel
- Works in **Chrome and Brave** (both Chromium extension format)

## Core scoring signals
1. **Account age + rating**
2. **Overall and recent winrate**
   - suspicious around 55%+
   - strong signal around 70%+
3. **High-accuracy ratio**
   - 80%+ if rating < 1500
   - 90%+ if rating >= 1500

## Install locally (Chrome or Brave)
1. Open extensions page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `chess-risk-tweaked`

## Configure thresholds
- Open extension details -> **Extension options**
- Adjust values and click **Save**

## Publish to Chrome Web Store
1. Zip the extension folder contents
2. Go to Chrome Web Store Developer Dashboard
3. Upload package, fill listing, and submit for review

## Publish to GitHub
```bash
cd chess-risk-tweaked
git init
git add .
git commit -m "feat: v2 chess risk extension"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## Notes
- Heuristic only; not proof of cheating.
- Depends on public Chess.com API data availability (especially accuracies).
