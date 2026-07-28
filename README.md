# Forkcast 🍴

Free food radar for San Francisco. A live map and carousel of upcoming SF events that mention food, pulled from [lu.ma](https://lu.ma/sf) and refreshed every 4 hours by GitHub Actions.

- `scripts/fetch-events.mjs` pulls the Luma SF discover feed, reads each event description, keeps events that mention food, and classifies the food type (🍕 🌮 🧋 ☕ …). Events with only a generic mention are labeled "Food".
- `data/events.json` is the generated snapshot the site reads.
- Static site: `index.html` + `styles.css` + `app.js` (Leaflet map, no build step).
- `.github/workflows/refresh.yml` refreshes data and deploys to GitHub Pages on push, on a 4-hour cron, and on manual dispatch.

Run locally:

```bash
node scripts/fetch-events.mjs
python3 -m http.server 3010
```
