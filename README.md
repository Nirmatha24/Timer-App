# Ember Focus

A calm, task-aware focus timer built with plain HTML, CSS, and JavaScript. It has no build step and no runtime dependencies.

## Run locally

Opening `index.html` directly works for the timer. To test installability and offline caching, serve the folder over HTTP:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Included

- Focus, short-break, and long-break cycles
- Accurate pause/resume timing and automatic cycle progression
- Task estimates in Pomodoros, explicit active-task selection, editing, and completion
- Per-session history linked to the active task, including date, time, and duration
- Monthly calendar with focus intensity, completed tasks, and per-day session detail
- A calm blue planning view for shaping the day before starting work
- Full-screen distraction-free timer plus a large StandBy-style live clock
- Distinct start and end sounds for focus/break sessions, with volume control
- Daily focus minutes, sessions, completed tasks, and goal progress
- Configurable durations, goal, auto-start, and session sounds
- Local-first persistence with no account or server required
- Keyboard shortcuts: `Space` starts/pauses and `T` focuses task entry
- Responsive desktop/mobile layout, reduced-motion support, and accessible controls
- Web app manifest, icon, and service worker for an installable PWA

## Publish or wrap

The folder can be deployed as-is to any static host such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel. It can later be wrapped with Capacitor or Tauri; the app does not depend on browser-specific frameworks.
