# CLAUDE.md

## Project overview

Band Manager — a client-side React app for coordinating rehearsal availability and studio booking across 5 band members. Uses localStorage for persistence and fetches studio availability from the Pirate Studios API.

## Tech stack

- React 19 with Vite 8
- No backend — client-side only, localStorage for data
- Deployed to GitHub Pages via `.github/workflows/deploy.yml`

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
- `npm run preview` — preview production build

## Project structure

- `src/App.jsx` — root component, routing (Home/Availability/Rehearsals), user selection, band member data
- `src/AvailabilityView.jsx` — main feature: calendar grid with per-hour availability and Pirate Studios slot data
- `index.html` — entry point
- `public/` — static assets

## Key concepts

- **Member availability**: per-member day-level status (available/maybe/unavailable) with optional per-hour slot overrides. Stored in localStorage as `cdband-memberAvailability`.
- **Studio availability**: fetched from Pirate Studios API, filtered by preferred studios and minimum bookable hours.
- **Range selection**: availability is set by clicking a start hour then an end hour; hovering previews the range.

## Git workflow

- Direct pushes to `main` are blocked (403). All changes go through PRs.
- Feature branches must start with `claude/` and end with the session ID suffix.
- No test suite — verify changes with `npm run build` and `npm run lint`.
