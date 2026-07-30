# Black Out!

Black Out! is a mobile-first, pass-and-play party board game built as an installable static web app. Players share one device, roll a virtual die, move across a 60-space interactive board, resolve tile actions and minigames, and keep game-score totals for drinks and shots. Alcohol-free mode converts the scoring copy to points and penalties.

## Features

- React, TypeScript, Vite, and Vitest.
- 60 structured movement tiles, plus Start and Finish.
- Local setup for 2 to 10 players with unique counter colours.
- Turn state machine for roll, movement, tile resolution, finishing, and results.
- Dice animation, board camera following, current-player finder, and reduced-motion support.
- Tile action engine for assignments, choices, group effects, recovery, shields, random results, movement, spinner outcomes, and minigames.
- Minigames for finger picking, spinner, categories, dice duel, reaction tap, memory chain, number guess, trivia, exact timer, sequence tap, hold button, sorting sprint, bluff breaker, token toss, and name-three.
- LocalStorage save and resume with versioned validation.
- Background music playlist from the supplied MP3 files, loaded on demand.
- PWA manifest, service worker, favicon, app icons, and GitHub Pages workflow.
- Result summary copy and PNG export.

## Stack

- Node 24+
- pnpm 11.9.0
- React 18
- TypeScript strict mode
- Vite
- Vitest
- React Testing Library
- Lucide React icons

Lucide is the only UI dependency. It keeps buttons and tile labels icon-based without pulling in a large component framework.

## Local Development

```bash
pnpm install
pnpm run dev
pnpm run test
pnpm run build
pnpm run preview
```

The development server prints a local URL after `pnpm run dev`.

## Verification Commands

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Assets

- Logo: `public/assets/branding/blackout-logo.png`
- Board concept reference: `public/assets/board/original-board-concept.jpg`
- Favicon: `public/assets/icons/favicon.png`
- PWA icons: `public/assets/icons/icon-192.png`, `public/assets/icons/icon-512.png`
- Music: `public/assets/audio/track-01.mp3` through `public/assets/audio/track-31.mp3`

To replace the logo, overwrite `public/assets/branding/blackout-logo.png`, then regenerate the icon files from it. To replace music, keep the `track-XX.mp3` naming pattern or update `src/data/audioTracks.ts`.

The original concept image is preserved as reference artwork. The playable board is generated from tile data rather than placing counters over that image.

## Editing Game Content

- Board spaces live in `src/data/tiles.ts`.
- Category, vote, trivia, and sorting prompt data lives in `src/data/prompts.ts`.
- Core rules live in `src/engine/gameEngine.ts`.
- Save/load behavior lives in `src/services/storage.ts`.

Each tile is structured with an id, title, short label, category, icon, visual variant, action type, and action configuration. Alcohol-free copy is generated from the tile copy and can be customized in the tile data if needed.

## GitHub Pages

Deployment is configured in `.github/workflows/deploy.yml`.

1. Push to `main`.
2. In the repository settings, open Pages.
3. Set the source to GitHub Actions.
4. Run or wait for the `Deploy to GitHub Pages` workflow.

Vite uses a relative base path (`./`) so assets work under repository subpaths such as `https://crixppp.github.io/BlackOut/`.

## Responsible Use

Black Out! is intended for adults of legal drinking age. Participation is voluntary, any challenge can be skipped without penalty, and players may use water or non-alcoholic drinks. The app tracks assigned game scores only. It does not measure alcohol intake or calculate BAC.

## Browser Support

Target browsers are current Safari on iOS and macOS, Chrome on Android and desktop, and Edge. Wake Lock, vibration, media playback, clipboard, install prompts, and PNG export are feature-detected and fail gracefully when unsupported.

## Known Limitations

- The game is local pass-and-play only.
- Mobile browsers may limit simultaneous touch points, so Finger Picker includes a fallback selector.
- Audio playback requires a user gesture because browsers block autoplay.
- The supplied music files are user-provided assets; confirm publishing rights before public distribution.
- GitHub Pages must be enabled in repository settings after the workflow is committed.

## Licence

No licence has been selected yet. Add a `LICENSE` file before broader public reuse.
