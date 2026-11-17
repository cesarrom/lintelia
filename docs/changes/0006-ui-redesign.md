# 0006 — UI redesign

The web app was redesigned end to end: a design system (tokens, type, elevation, motion), a new shell, redesigned
key screens and a set of custom SVG brand assets. Reference: [../design/README.md](../design/README.md).

## What changed

- **Foundations**: Geist / Geist Mono self-hosted (`@fontsource-variable/geist`, `…/geist-mono`); HSL tokens with
  alpha support (`bg-primary/10`), semantic success/warning/info colours with soft tints, a `canvas` backdrop, a fixed
  `brand` scale; layered shadows; dark theme rebuilt on the same tokens. Favicon and page metadata.
- **Primitives** (shadcn): buttons, inputs, selects, tabs, cards, tables, badges, dialogs, menus, popovers, alerts,
  checkboxes, switches, command menu, toasts restyled.
- **Shell**: inset layout; sidebar with institution monogram, grouped navigation, account block, persisted collapse;
  top bar with breadcrumb, ⌘K "Jump to…" command menu and theme toggle; skeleton loaders instead of "Loading…".
- **Screens**: dashboard on real data (greeting, stat cards, your work / queue, case pipeline, recent cases,
  shortcuts; it showed hard-coded sample numbers before); cases, tasks (counts, urgency), clients; case page (header
  card, metadata strip, calculation panels, decisions, timeline with event icons); task page (outcome choice cards,
  sticky decision panel); profile (permissions grouped by area); integrations and platform connectors (connector
  marks); institutions (monograms); settings, forms, logs headers; split-screen sign-on / invitation / reset-password /
  join pages in the institution's colours; client portal (header, welcome hero, application cards with progress,
  progress stepper, request cards, privacy); embedded form (steps, code entry, confirmation); public landing page
  (it was a placeholder about document management with a missing image); 404 and error page.
- **Institution branding**: `brandStyle()` (`src/lib/brand.ts`) turns a tenant's primary colour into theme variables
  for the client-facing pages.
- **Brand assets** (SVG in code): logo and wordmark, monograms and avatars, eight spot illustrations, sign-on artwork,
  portal welcome art, landing product shot, connector marks.
- **Screenshots**: `bun run --cwd apps/e2e screens` (`apps/e2e/scripts/screens.ts`) captures about 30 screens as the
  seeded personas, light or dark.

## Kept on purpose

Every accessible name, label and `data-testid` the e2e suite uses; text the suite reads (status labels, empty-state
sentences, decision lines); the `Main` navigation's exact link list. The constraints are listed in the design doc.

## Verified

- `E2E_VISUAL=0 bun run --cwd apps/e2e test --project=ui`: 36 passed.
- Full suite after the redesign: 404 passed headless (2.9 min) and 404 passed in the watched visual mode (8.8 min,
  recorded from the screen).
- `bunx tsc --noEmit -p apps/web`: 203 errors, all pre-existing in legacy screens (205 before; the old landing page
  had two).

## Not done

- Legacy screens not in the navigation (reviews, database tables, onboarding wizard, the old logs dashboard) only
  inherit the new primitives.
- Team and staff tables keep their layout (the first-sign-in test reads their rows and cells by text).
- No visual regression snapshots; the screenshot script is for review, not assertions.
