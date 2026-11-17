# Plan 14 — UI building blocks for designers: how things open, richer fields, screens that continue by themselves, branding

Status: **v1 shipped** — [../changes/0011-ui-building-blocks.md](../changes/0011-ui-building-blocks.md). Sections 3 and 6
keep the ideas that were not built yet.

## 1. What was asked

1. Hide a form behind a **customisable button** and choose **how it opens**: full screen, a dialog with its own
   characteristics…
2. **Special inputs**: a QR / barcode scanner, and others.
3. Forms that **submit by themselves** when a criterion holds: paying with a QR code is a "fancy form" that goes on as
   soon as a valid code is read.
4. First, think of other **cheap, high-leverage** things for the people who design the app, and of **colours and
   branding**.

## 2. Principles

- **No new concept when an option of an existing one does.** In the client app a "form" is a journey screen (a
  `client.screen` step of the journey's workflow — [11](11-client-experience-builder.md)); a "button that opens a form"
  is a widget that starts a journey. So: how a journey opens is an option of the **journey** (and of the button that
  starts it); the scanner is a **field type**; submitting by itself is an option of the **screen**; branding is the
  app's **theme**. Everything new therefore works in the studio, the live app, the embedded app, the map and the API's
  validation at once.
- **The API re-checks everything the browser does**: conditional fields, format rules, what a scanned code says.
  A rule the browser applies and the API does not is a bypass.
- **Cheap first**: each item below was judged by cost (S ≈ hours, M ≈ a day or two, L ≈ more) and by how many
  designs it unlocks. Two small libraries only (jsQR ~45 KB to read QR codes when the browser cannot,
  qrcode-generator ~20 KB to draw them); fonts are stacks the devices already have (no download, no tracking).

## 3. The catalogue

✅ shipped in 0011 · ◻ later

### How things open

| | Idea | Cost | Why |
| --- | --- | --- | --- |
| ✅ | **Presentation per journey**: page (default), **dialog** (size S/M/L), **sheet** (from the right or the bottom), **full screen**; *dismissible* or not | S | the same journey is a checkout, a quick action or a takeover, without new screens |
| ✅ | **Per button**: every link (button, quick action, callout, list row, FAB) may open the journey another way | S | "Pay" from the FAB full screen, from the quick actions as a sheet |
| ✅ | **Floating action button** widget (label/icon, position, brand or accent colour); stays above the phone tab bar | S | the one action that must always be at hand |
| ✅ | **Button widget**: icon, styles (primary, secondary, outline, accent, text), size, full width, alignment | S | most "hide a form behind a button" designs |
| ✅ | **Deep links**: `/portal/start/<journey>?<input>=…&presentation=dialog` — from an e-mail, a printed QR code, a push; survives sign-in; only declared inputs reach the workflow | S | campaigns, QR posters, support links |
| ✅ | **Continue later in place**: a journey closed half-way reopens the way it opens (sheet, dialog…) from *Waiting for you* / *Applications* | S | overlays would otherwise lose the thread |
| ◻ | Bottom-sheet snap points, swipe to close | S | native feel on phones |
| ◻ | Journeys opened **on an event**: after sign-in ("complete your profile"), on a page visit, once per client (promo, interstitial) | M | onboarding nudges without code |
| ◻ | Page and screen transitions (slide for steps, fade for overlays), reduced-motion aware | S | polish |

### Fields of a screen

| | Idea | Cost | Why |
| --- | --- | --- | --- |
| ✅ | **Scanner** (`scan`): camera (back camera on phones), a photo, or the code typed; QR, barcodes or both; reads **EMV** (Pix and most pay-by-QR schemes), **EPC/SEPA**, links, JSON | M | payments, loyalty cards, invoices, IDs with barcodes |
| ✅ | **What the code says** as `<key>Details` (payee, amount, currency, account, reference…), read again by the API and kept on the case | S | next steps use it without parsing |
| ✅ | **Signature** (`signature`): drawn, kept as a PNG through the upload intake (scan, sanitisation) | S | acknowledgements, delivery receipts (not a qualified e-signature: Documenso for contracts) |
| ✅ | **One-time code** (`otp`): a box per digit, paste, phones offer the SMS code (`autocomplete=one-time-code`); length, secret | S | confirmations, PINs |
| ✅ | **Slider** (`slider`): min, max, step; shown as money, a number or a percentage | S | loan amounts and terms, budgets |
| ✅ | **Calculated value** (`display`): JSONata over the answers, formatted (monthly payment, total, fee); never sent | S | calculators without a round trip |
| ✅ | **Conditional fields** (`visibleIf`): shown — and required — only when a rule over the answers holds; the API ignores hidden answers | S | one screen instead of three |
| ✅ | **Format rules**: a `pattern` (with its message) and checks (`iban`, `luhn`, `email`) | S | fewer round trips, same rule in the API |
| ✅ | **Half-width** fields (two per row on wide screens) | S | denser, familiar layouts |
| ✅ | **Photo capture** on file fields (`capture: environment/user`): phones open the camera | S | documents, selfies |
| ✅ | Money fields in the **app's currency** | S | regional apps |
| ◻ | Address autocomplete (through a connector), phone number with country and E.164 | M | onboarding quality |
| ◻ | Repeatable groups (a list of items: dependants, assets), searchable select, multi-select chips, toggle, rating / NPS, date ranges | M | the next most asked |
| ◻ | Document camera with edge detection; selfie liveness and NFC passports (vendors; native for NFC) | L | KYC quality |
| ◻ | Async field checks through a function (IBAN → bank name, postcode → address) | M | real-time validation against systems |

### Behaviour

| | Idea | Cost | Why |
| --- | --- | --- | --- |
| ✅ | **Continue by itself** (`autoSubmit`): when every visible field is valid, or when a rule holds too; an optional **countdown** the client can **stop** | S | scan-and-go payments, one-field screens, confirmations |
| ◻ | Drafts saved while typing (resume on another device) | M | long applications |
| ◻ | A timer on a screen ("this quote is valid for 10:00"), expiring to an event | S | quotes, reservations |
| ◻ | An automatic review screen ("check your answers") from the previous screens | M | less YAML for long journeys |

### Display

| | Idea | Cost | Why |
| --- | --- | --- | --- |
| ✅ | **QR code** widget: a text or link, an **EMV** payment request (receive money) or a **SEPA** (EPC) transfer; copy the code | S | "get paid", references, links to other channels |
| ◻ | Tabs and carousels, a timeline widget, a countdown widget, receipts as PDF | M | richer pages |

### Colours and branding

| | Idea | Cost | Why |
| --- | --- | --- | --- |
| ✅ | **Accent colour** (FAB, accent buttons), light and dark variants computed | S | two-colour brands |
| ✅ | **Font**: system, humanist, geometric, serif, rounded, monospace — stacks the devices have | S | personality at no performance or privacy cost |
| ✅ | **Button shape**: rounded, pill, square | S | the most recognisable brand trait after colour |
| ✅ | **Light / dark**: as the device, always light, always dark | S | brands that are dark by nature |
| ✅ | **Background tint** | S | softer, branded canvases |
| ✅ | **Presets** (Classic bank, Neo bank, Private banking, Fresh, Midnight): colour, font, shapes in one click; each passes the readability check | S | a good start in seconds |
| ✅ | **Colours from the logo**: the logo (address or file) read in the browser, dominant colours suggested as primary / accent | S | "make it ours" without a designer |
| ✅ | **Readability** (WCAG AA): labels on the primary and accent colours, links in the primary colour, text on the tint | S | accessible by default; warns before clients complain |
| ✅ | **Colour pickers** in the studio (swatch + hex) | S | no hex codes to remember |
| ✅ | **Region**: the app's currency and locale (amounts, numbers, dates) | S | non-GBP institutions (the dealer portal is USD) |
| ◻ | Self-hosted web fonts (upload), per-segment themes (private clients see another theme), icon style | M | premium tiers |
| ◻ | Installable app: favicon, manifest, app icon and splash from the logo (PWA) | M | "download our app" without stores |
| ◻ | E-mails and documents in the app's brand (templates inherit the theme) | M | consistency |
| ◻ | Translations of the app's texts (i18n) per locale | L | multi-language institutions |
| ◻ | Custom CSS as an escape hatch | S to build, costly to support | deliberately not done: it breaks with every release |

## 4. What shipped, in detail

### How journeys open

`journeys.<key>.presentation = { mode: page | dialog | sheet | fullscreen, size?: sm | md | lg, side?: right | bottom,
dismissible?: boolean }` (studio: *Journeys → How it opens*). Links (`button`, `fab`, `quick-actions`, callouts, list
rows) have `presentation` too ('' = the journey's). The live runtime (`client-app/live.tsx`) shows journeys that do not
open as a page in `JourneyOverlay.tsx` (Radix dialog; the theme is applied inside the portal); opening a page,
finishing, or going elsewhere closes it. Embedded without chrome (the frame grows with its content) journeys always
open as pages. `openCase(caseId, journey)` reopens a journey the way it opens.

Deep link: `/portal/start/:journey` (and `/embed/app/start/:journey`) — the query is the input (the API keeps the
journey's declared `inputs`), `presentation` may be given; the home page shows under an overlay.

### Screen fields and rules (`client.screen`)

| Field option | Meaning |
| --- | --- |
| `type: scan` | `scanCodes: qr \| barcode \| any`, `parse: raw \| auto \| emv \| epc \| url \| json`. The answer is the text read (≤ 4,000 characters); with a parser, `input.<key>Details` = `{ format, valid, problem, payee, city, country, currency, amount, account, bic, reference, mcc, … }`, and an invalid code is refused unless `parse: auto` |
| `type: signature` | a PNG through the upload intake; the answer is like a file field's |
| `type: otp` | `length` (default 6), `secret`; the answer is the digits |
| `type: slider` | `min`, `max`, `step`, `format: number \| money \| percent`; starts at `min` |
| `type: display` | `expression` (JSONata over the answers), `format`; not an answer |
| `visibleIf` | JSONata over the answers (and `<key>Details`): hidden fields are neither shown, required nor kept |
| `pattern`, `patternMessage`, `check: iban \| luhn \| email` | format rules of text answers |
| `width: half` | two fields per row on wide screens |
| `capture: environment \| user` | file fields open the back / front camera on phones |

`autoSubmit: { button, when: complete | expression, expression?, delay? }` — the screen presses `button` by itself when
every visible field is valid (and, with `expression`, when the rule holds too), after `delay` seconds (0–60) shown as a
countdown with *Stop*. It fires once per set of answers; the API validates as for any press.

Publishing refuses: a `display` field without expression, a broken `visibleIf` / `expression` / rule (JSONata), a
broken `pattern`, an `autoSubmit` on a button the screen does not have or a rule that is empty.

Shared code: `packages/fintivio/src/utilities/payment-codes.ts` (`parsePaymentCode`, `buildEmvPayload`,
`buildEpcPayload`, `crc16`, `isIban`, `isLuhn`, `VALUE_CHECKS`) — the same reader in the browser and the API.

### Widgets

`button` (icon, style incl. *accent* and *text only*, size, width, alignment), `fab`, `qr-code` (`kind: text | emv |
epc`; name, account, scheme, city, country, amount, currency, reference; size).

### Theme and region

`theme.accent`, `theme.background`, `theme.font`, `theme.buttonShape`, `theme.colorScheme` (plus `primary`, `radius`,
`header`, `logoUrl`); `currency` (ISO 4217) and `locale` at the top of the definition. The studio's *Settings →
Appearance* has the presets, colours from the logo and the readability check; *Settings → Region* the currency and
locale. The runtime sets CSS variables (`--highlight` for the accent, `--canvas` for the tint), `data-buttons` for the
shape, the font on the app's root, and the `dark` class when the app forces a scheme.

### The banking template: *Pay with a QR code*

`pay_qr` (`templates/banking/pay-qr.yaml`): scan (EMV) → the amount only when the code has none, a note and a
category (half width) → **continues by itself after 2 s** when the code carries its amount → checks (current account,
currency, balance) → confirm → debit, transaction (`channel: qr`), notification. Opens as a **bottom sheet** from the
quick actions and **full screen** from the **Pay** floating button (accent colour). The accounts page shows the
client's own code (*Get paid*, an EMV request). The banking app is in GBP / en-GB; the dealer portal in USD / en-US.

## 5. Security and privacy

- Scanned text is untrusted: capped, parsed again by the API, rendered as text (never HTML); links are not opened.
- The camera starts on the client's tap, stops when the scanner closes; frames never leave the device — only the
  decoded text is sent.
- Conditional fields are evaluated by the API too: hiding a required field in the browser does not skip it.
- Auto-submit is a press of a button like any other: validated by the API, with a visible countdown the client can
  stop.
- Signatures are files through the intake (malware scan, sanitisation); they are not qualified electronic
  signatures.
- Deep links start only journeys the client may start (eligibility), with declared inputs only.
- Colours from the logo are computed in the browser; nothing is uploaded.

## 6. Next steps

In order of value for the cost: journeys opened on an event (after sign-in, once per client); repeatable groups and
searchable selects; address autocomplete through a connector; drafts; the installable app (PWA) from the theme;
e-mails in the app's brand; per-segment themes; translations.
