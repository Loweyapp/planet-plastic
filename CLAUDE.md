# Planet Plastic

Scale modelling PWA for Android. Plain JS + Vite, Firebase Auth + Firestore (CDN, not npm), Anthropic API called direct from browser, deployed on Vercel from `main` branch (auto-deploy).

## Owner
Alex Lowe. Single-user app.

## Stack
- **Plain JS + Vite** — no TypeScript, no React
- **Firebase** — loaded via CDN script injection in `index.html`. Do NOT switch to npm firebase.
- **Google Auth** — via Firebase CDN, same constraint
- **Anthropic API** — called direct from browser via `src/api.js` (`callClaude()`)
- **Upstash Redis** — used by the Telegram bot (`matt-varnish-bot`), not directly by this app
- **Vercel** — serverless API routes in `api/`, auto-deploys from `main`

## Project structure
```
index.html              # All HTML, CSS, and <script type="module" src="/src/main.js">
src/
  main.js               # Boot, auth, nav, settings, shared chat input
  firebase.js           # CDN loader, PREVIEW_MODE detection, hardcoded config
  api.js                # callClaude() — direct Anthropic API calls from browser
  utils.js              # esc(), fmt() helpers
  views/
    adviser.js          # Paint adviser chat (Anthropic API, direct)
    matt.js             # Matt Varnish general modelling companion
    picker.js           # Kit picker (mood/genre/scale chips)
    paints.js           # Paint inventory browser
    collection.js       # Kit stash (Firestore CRUD, CSV import, Scalemates URL import)
  data/
    inventory.js        # Full paint inventory (static, hand-maintained)
    colors.js           # Color swatch helpers
api/
  matt.js               # Proxy: browser → matt-varnish-bot /api/chat (keeps secret server-side)
  matt-link.js          # Proxy: browser → matt-varnish-bot /api/link (Telegram account linking)
  scrape-kit.js         # Scrapes Scalemates kit page for name/scale/brand
  box-art.js            # Fetches box art image for kit detail sheet
  inventory.js          # Serves inventory data
```

## Navigation
4 tabs (bottom nav): **Chat, Picker, Paints, Collection**

The Chat tab has an **Adviser | Matt** segmented toggle at the top:
- **Adviser mode** — paint-focused AI (`adviser.js`), DOM: `#pane-adviser` / `#chat-area`
- **Matt mode** — general modelling companion (`matt.js`), DOM: `#pane-matt` / `#matt-chat`

Both modes share a single fixed input bar (`#chat-input-bar`, `#chat-input`, `#chat-send-btn`). Routing is handled in `main.js` via `dispatchChatSend()` → `activeChatMode`.

## Key conventions
- All HTML and CSS is in `index.html` — no separate CSS files
- Views are `<div class="view" id="view-{tab}">`, shown/hidden via `.active` class
- `switchTab(tab)` in `main.js` handles nav switching and shows/hides `#chat-input-bar`
- `switchChatMode(mode)` in `main.js` handles Adviser/Matt toggle
- Firebase loaded via CDN — do not change this
- `PREVIEW_MODE` in `firebase.js` detects sandboxed iframes and skips Firebase auth
- `__ANTHROPIC_KEY__` injected at build time by Vite from `VITE_ANTHROPIC_API_KEY` env var in Vercel
- **Version number** hardcoded in `index.html` header — bump with every push
- Current version: **v1.2.21**
- Run `npx vite build` before committing to confirm zero errors

## Firestore data model
- `users/{uid}/kits/{kitId}` — kit collection (status: stash | wip | done | wish)
- `users/{uid}` document — user settings, inc. `telegramChatId` for Matt linking

## callClaude()
- Lives in `src/api.js`
- Always extract JSON with regex before `JSON.parse` — embedded newlines in string values break parsing silently
- Use array schemas (`{"bullets": ["a", "b"]}`) not strings with `\n`

## Matt Varnish — Telegram integration
Matt exists in two places:

1. **This app** (`src/views/matt.js`) — builds a dynamic system prompt including paint inventory + live kit stash from Firestore, calls `/api/matt` proxy
2. **Telegram bot** (`loweyapp/matt-varnish-bot`) — separate Vercel repo, Node.js, stores history in Upstash Redis under key `mv:{chatId}`

Both share the same Redis conversation history. When linked, the app calls `/api/matt` → proxies to `matt-varnish-bot.vercel.app/api/chat` with `Authorization: Bearer {CHAT_API_SECRET}`.

**CRITICAL**: Matt's personality/system prompt exists in TWO places — `buildSystemPrompt()` in `src/views/matt.js` AND the Telegram bot's `api/webhook.js`. Any change to Matt's personality, tone, rules, or response format must be made in BOTH places.

### Linking flow
1. User sends `/link` to Matt Varnish Bot on Telegram → bot generates 6-digit code (5-min TTL in Redis)
2. User enters code in Settings → Matt Varnish section
3. App calls `POST /api/matt-link` → proxies to bot's `api/link.js` → returns `{ chatId }`
4. `chatId` stored in Firestore (`users/{uid}.telegramChatId`) and in memory (`_chatId` in `matt.js`)

### Required env vars on Vercel
| Variable | Project | Value |
|---|---|---|
| `CHAT_API_SECRET` | planet-plastic + matt-varnish-bot | Same random string on both |
| `MATT_BOT_URL` | planet-plastic only | `https://matt-varnish-bot.vercel.app` |

## Tabs disappearing — history and fix
Previously a persistent bug. Fixed in v1.2.15:
- Nav is `position: fixed; bottom: 0; z-index: 999` **outside** `#app-screen` in the DOM
- `#loading-screen` and `#auth-screen` are `position: fixed` overlays — never hide the nav
- Service worker is **unregistered** on every load (was causing stale cache issues)
- Do NOT re-register a service worker

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

## Feature backlog

### Next to build
- **Projects** — a project is a first-class object (not tied to a single kit). Has name, description, multiple linked kits, reference URLs, notes. Mobile-first capture. Lives in its own Firestore subcollection `users/{uid}/projects`.
- **Build diaries** — chronological log per project: text + optional photo entries, timestamped, append-only. Sub-feature of Projects.

### Later
- **Desktop layout** — wider view optimised for Alex's laptop desk mount in the modelling area. Large images, video-friendly. Build after Projects is solid.

## Design context
Alex uses the app in two modes:
- **Mobile at the workbench** — quick reference (paints, stash), fast capture, ask Matt a quick question
- **Laptop on desk mount while modelling** — larger view, images, build references, video alongside the build

App stays lean and mobile-first. Desktop layout is a future enhancement.
