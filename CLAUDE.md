# Planet Plastic

Scale modelling PWA for Android. Plain JS + Vite, Firebase Auth + Firestore, deployed on Vercel.

## Stack
- **Plain JavaScript** — no React, no TypeScript
- **Vite** — build tool only, used for env var injection (`VITE_ANTHROPIC_API_KEY` → `__ANTHROPIC_KEY__`)
- **Firebase Firestore** — loaded via CDN script injection, NOT npm
- **Google Auth** — via Firebase CDN, same constraint
- **Anthropic API** — called directly from the browser via `src/api.js`
- **Open-Meteo** — not yet used, available if needed

## Project structure
```
src/
  main.js              # Entry point: Firebase boot, auth state, tab routing, settings
  firebase.js          # CDN loader, PREVIEW_MODE detection, hardcoded Firebase config
  api.js               # callClaude() helper — uses __ANTHROPIC_KEY__ injected at build time
  utils.js             # esc(), fmt() text helpers
  data/
    inventory.js       # INVENTORY array — 211 Vallejo/Citadel/AK paints
    colors.js          # CODE_COLORS, NAME_COLORS, swatchColor()
  views/
    adviser.js         # Paint Adviser chat — uses INVENTORY in system prompt, web_search
    picker.js          # Kit Picker — mood/genre/scale chips, calls Claude, imports getStashKits()
    paints.js          # My Paints — searchable/filterable INVENTORY list with swatches
    collection.js      # Collection — Firestore sync, CSV import, status management
```

## Key conventions
- Firebase loaded via CDN (not npm) — do not change this
- `PREVIEW_MODE` in `firebase.js` detects sandboxed iframes and skips Firebase auth
- `__ANTHROPIC_KEY__` is injected at build time by Vite from `VITE_ANTHROPIC_API_KEY` env var in Vercel
- Firestore data model: `users/{uid}/kits/{kitId}` subcollection
- `getStashKits()` exported from `collection.js` — used by picker to suggest from stash only
- CSV import supports Scalemates export format (flexible header detection, tab/comma delimiter)

## callClaude()
- Lives in `src/api.js`
- Always extract JSON with regex before `JSON.parse` — embedded newlines in string values break parsing silently
- Use array schemas (`{"bullets": ["a", "b"]}`) rather than strings with `\n`

## Version number
- Hardcoded in **one place**: the `.header-wordmark` in `index.html` — `<span class="header-version">vX.X.X</span>`
- Bump with every push so the deploy can be confirmed live
- Current version: **v1.0.9**

## Deployment
- Vercel auto-deploys from `main` branch
- Always push to `main` for changes to go live
- Run `npx vite build` before committing to confirm zero errors
- Dev branch convention: `claude/planet-plastic-development-*`

## Firestore security rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Integrations

### Matt Varnish Bot
The Telegram bot at `loweyapp/matt-varnish-bot` integrates with this app to give the AI
assistant context about Alex's hobby supplies.

Currently connected endpoints:
- `GET /api/inventory` — full paint inventory, fetched on every conversation and cached 1 hour

**Whenever a new API endpoint is added here, consider whether Matt should have access to it.**

Common candidates:
- Kit inventory / stash
- Wishlist
- Build history or active builds
- Any per-user data Alex would want Matt to know about

If yes, update `api/webhook.js` in matt-varnish-bot to fetch and format the new data,
and add it to the conversation context the same way inventory is handled.

## Feature backlog

### Quick wins
- Smoother CSV import UX — link directly to Scalemates export page to reduce friction

### Core features
- **Add kit by Scalemates URL** — paste a Scalemates kit page URL, scrape name/scale/brand from that single page, add to collection in one step. Avoids full account sync complexity while solving the kit discovery gap. Single-page scraping is reliable enough; full account sync is not feasible (no public API, ToS risk).
- **Build projects** — link kits to a build log: stages, paint recipes, notes, photos
- **Shopping list** — paints needed for upcoming builds, cross-referenced against owned paints

### Needs design thought first
- **Two-way Scalemates sync** — not feasible without an official API. Scalemates has no public API; scraping the full account is fragile and likely ToS-violating. Planet Plastic should be the source of truth for build tracking; Scalemates is for discovery. Revisit only if Scalemates launches an API.
- Wish list / want-to-build list
- Paint inventory tracking (what you own vs what's in INVENTORY)
