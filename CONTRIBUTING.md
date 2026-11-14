# Contributing to ASCII Studio

Bug reports, ideas and pull requests are welcome.

- **Bugs and ideas:** [open an issue](https://github.com/olliefrost/ascii-studio/issues). For bugs, include your OS, browser (or desktop app), and the image or settings that cause it if you can.
- **Pull requests:**
  1. Fork the repo and create a branch from `main`.
  2. Run `npm install`, then `npm run dev` to work on it.
  3. Before opening the PR, make sure `npm test` and `npm run build` pass (CI runs both).
  4. Keep each PR to one change, and describe what it does and why. Add a screenshot or GIF for visual changes.
- **New effects:** effects live in `src/engine/effects.ts` and must be periodic in `phase` (see [How it works](README.md#how-it-works)) so GIFs still loop seamlessly. Add a test for it in `src/engine/engine.test.ts`.
