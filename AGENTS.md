# Repository Guidelines

## Project Structure & Module Organization
- Next.js App Router with TypeScript lives under `src/app`; entry points are `layout.tsx` and `page.tsx`, with route handlers in `src/app/api/**`.
- Reusable UI is in `src/components` (modals, map view, welcome panel), and shared helpers in `src/lib` (Firebase clients, username generator, utils). Use the `@/` alias for imports from `src`.
- Map and grid assets live in `public/*.geojson`; `gpx-worker.js` and icons also sit in `public`. Temporary source data (e.g., shapefiles) goes in `temp/`.
- Data prep scripts at repo root: `convert-shapefile.js` (shapefile → GeoJSON) and `generate-grid.js` (build per-district grids from Overpass data).

## Build, Test, and Development Commands
- `npm run dev` — start the Next.js dev server on port 3000.
- `npm run build` — production build; fails on type or lint errors.
- `npm run start` — serve the production build locally.
- `npm run lint` — ESLint with Next core-web-vitals config.
- Data utilities: `node convert-shapefile.js` (expects `temp/Dzielnice.shp`) then `node generate-grid.js 10` (grid size in meters) to refresh GeoJSON assets.

## Coding Style & Naming Conventions
- TypeScript is strict; favor typed helpers in `src/lib` and keep components as server components unless they need client features (`use client`).
- Component files use kebab-case filenames (`auth-modal.tsx`), exported components are PascalCase; functions and variables are camelCase.
- Tailwind CSS v4 is configured in `src/app/globals.css`; prefer utility classes over custom CSS and keep tokens aligned with the defined `@theme` variables.
- Run `npm run lint` before pushing; prettier is not configured, so match existing 2-space formatting and spacing patterns.

## Testing Guidelines
- No automated tests are present yet; at minimum run `npm run lint` and exercise core flows locally (`npm run dev`, load the map, import/upload a GPX).
- When adding tests, colocate by feature under `src/` and mirror route or component names; prefer Playwright for end-to-end UI and lightweight unit tests for helpers in `src/lib`.

## Commit & Pull Request Guidelines
- Use conventional commits as in history (`feat: ...`, `fix: ...`, `chore: ...`), short and imperative.
- PRs should include: a concise summary, linked issue/Strava task if applicable, screenshots or GIFs for UI changes, and notes on regenerated data files (`public/*.geojson`) or new env vars.
- Describe how reviewers can validate (commands run, accounts needed) and call out any migrations to Firebase rules (`firestore.rules`) or data pipelines.

## Security & Configuration Tips
- Keep secrets in `.env.local`; never commit Firebase service accounts or Strava tokens. See `FIREBASE_SETUP.md` for required env keys and Firestore rules.
- If updating Firebase security rules, mirror the change in `firestore.rules` and document rollout steps in the PR.
