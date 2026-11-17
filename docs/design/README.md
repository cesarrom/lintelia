# Fintivio design system

The web app (`apps/web`) follows one visual language across the back office, the platform console, the client
portal, the embedded forms and the public pages. This page is the reference; the code is the source of truth.

To see every screen at once: `bun run --cwd apps/e2e screens [--dark] [--full] [--only dashboard,cases]` writes
screenshots of about 30 screens (seeded personas of Demo Bank and the platform staff) to `.data/screens/<time>/`.
Seed some work first so lists are not empty, e.g. `bun run demo:case "Personal loan pre-approval" fullName="Ada
Lovelace" email=ada@customers.example amount=8000 annualIncome=92000`.

## Principles

- **Calm by default, loud when it matters.** Neutral surfaces, one brand accent; colour is reserved for status,
  risk and the next action.
- **Show the work.** Numbers on the dashboard are real; empty states explain what will appear and why.
- **Institutions own the client experience.** Sign-on, portal and embedded forms take the institution's brand colour;
  the back office stays Fintivio.
- **Nothing decorative gets in the way.** Illustrations are `aria-hidden`, contain no interactive words, and never
  repeat names that pages show (tests rely on that too: see "Constraints" below).

## Foundations

| | Choice | Where |
| --- | --- | --- |
| Typeface | **Geist** (UI, 400–600) and **Geist Mono** (references, codes, keys), self-hosted via `@fontsource-variable` | `src/globals.css` |
| Type scale | page title 26 px/600, tracking −0.02em; section 15 px/600; body 14 px; meta 12–13 px; table head 12 px/500 | `PageHeader`, `SectionHeader` |
| Numbers | tabular figures (`.tabular`) in tables and stats | |
| Colour | HSL tokens: `background`, `foreground` (ink, cool near-black), `canvas` (app backdrop), `primary` (indigo-violet 248° 75% 58%), `muted`, `accent`, `border`, semantic `success` / `warning` / `destructive` / `info` each with a `-soft` tint; `brand-50…950` fixed scale for artwork | `src/globals.css`, `tailwind.config.ts` |
| Dark theme | same tokens, deep blue-black surfaces, lighter primary (248° 92% 72%) | `.dark` in `globals.css` |
| Radius | 10 px base: inputs and buttons `lg`, cards `xl`, panels `2xl`, hero surfaces 24–28 px | |
| Elevation | `shadow-xs` (controls), `shadow-card` (cards), `shadow-raised` (hover, active nav), `shadow-overlay` (dialogs, menus, toasts), `shadow-glow` (primary calls to action on public pages) | `tailwind.config.ts` |
| Motion | 150 ms colour/shadow transitions; `animate-fade-up` for auth forms; no endless animations (the e2e visual mode renders without a GPU) | |
| Institution colour | `brandProps(hex)` (spread on the root element: variables + `data-brand`) maps a tenant's `pallette.primary` (or the client app's theme colour) to `--primary`, `--ring`, `--brand-soft`, `--brand-strong` with readable text, in a light and a dark set (`globals.css` picks one; dark brand colours are lifted in the dark theme) | `src/lib/brand.ts` |

## Layout

- **Back office** (`private/layout.tsx`): sidebar on the canvas colour (institution monogram, grouped navigation,
  account block, collapse), content in an inset rounded panel with a top bar: breadcrumb, "Jump to…" command menu
  (⌘K / Ctrl K: every page you may open, theme switch), theme toggle. Page content max 1280 px.
- **Client portal** (`portal/PortalLayout.tsx`): white header with the institution's monogram and name, pill
  navigation (Requests shows a count), account chip; institution-coloured welcome hero; footer with what the
  platform guarantees.
- **Client app** (`src/client-app`, when the institution published one; docs/changes/0007): the app's own shell in
  the institution's colours (or the app's theme: primary colour, corner radius, light or brand menu) — sidebar with
  the app's menu and the signed-in client on computers, a top bar with the notifications bell, a tab bar (first four
  menu entries + "More" sheet) on phones; widgets are cards on the canvas (hero in the brand colour with a white
  illustration, account cards in product colours, payment cards drawn as cards, charts in brand shades). Journeys: a
  centred column with the stages, one screen at a time, 44 px inputs, the primary action last (right-most, or on top on
  phones). The studio (`private/experience`) shows the same app in a device frame.
- **Auth pages** (`components/auth/AuthShell.tsx`): form column + brand panel (artwork, promise, three facts).
- **Public home** (`public/landing/page.tsx`), **404 / error page** (`public/NotFoundPage.tsx`).

## Components

- **Primitives** (`components/ui`, shadcn/Radix): buttons with inner highlight and soft focus ring; 36 px inputs
  with a brand focus ring; segmented tabs; rounded menus/dialogs with the overlay shadow; tables with a tinted header
  row.
- **App components** (`components/app`): `PageHeader` (title, description, actions; the navigation icon of the page
  is added automatically), `PageContainer`, `SectionHeader`, `TableCard`, `StatusBadge` (tone pill + dot; tones in
  `STATUS_TONE`), `KeyValues` (field tiles), `EmptyState` (illustration + title + text + action), `StatCard`,
  `Timeline` (event icons, relative times, tamper-evidence note), `formatRelative`, loaders (`PageLoader`,
  `DetailLoader`, `FullScreenLoader`, `Spinner`).
- **Workflow editor**: categories have colours (`CATEGORY_STYLES` in `workflows/components/catalog/catalog.ts`) used
  by the palette tiles and by the nodes' icon and accent bar; dotted canvas, styled minimap and controls.

## Brand assets (all custom SVG, in code)

| Asset | File | Used on |
| --- | --- | --- |
| Logo mark and wordmark — an "F" drawn as a workflow (stem, two branches, a completed node) | `components/brand/Logo.tsx`, `public/favicon.svg` | sidebar (platform), auth, landing, portal footer, favicon |
| Monograms (institutions, in their colour) and avatars (people, stable gradient per e-mail) | `components/brand/Monogram.tsx` | sidebar, portal, lists, case and task headers |
| Spot illustrations: tasks, cases, clients, documents, workflows, shield, search, connect | `components/brand/illustrations.tsx` | empty states, dashboard, privacy, landing, 404 |
| Scenes: sign-on artwork (identity checklist, routing, decision), portal welcome art, landing product shot | `components/brand/scenes.tsx` | auth pages, portal home, landing |
| Connector marks (identity scan, signature, radar, database, envelope; plug fallback) | `components/brand/ConnectorLogo.tsx` | Integrations, Platform → Connectors |
| Client app hero art: documents, wallet (cards and a coin), shield — white on the brand colour | `client-app/art.tsx` | the hero widget |

Connector marks are Fintivio's drawings of what a connector does, not vendors' trademarks.

## Writing

Sentence case everywhere; verbs on buttons ("Claim", "Confirm decision", "Request a copy of my data"); say what
happens next ("We will e-mail you when anything changes"); only claim what the platform does (the landing and footers
list features that exist in this repository).

## Constraints from the e2e suite

The Playwright suite finds things the way people do — by role, label and text — so a redesign must keep:

- accessible names of controls (button and link text, labels, `aria-label`s) and `data-testid`s;
- the `Main` navigation containing only the navigation links (tests compare the full list);
- unique texts where tests look them up by substring, e.g. an institution's name appears once on its sign-on page,
  the portal has one heading matching "My applications", no other "Thank you" in the portal, one "High authority"
  per workflow node, one button per case-task row, outcome buttons named by their label only;
- decisions rendered as "… (first approval) by <e-mail>".

Run `bun e2e --headless --project=ui` (about two minutes) after visual changes.
