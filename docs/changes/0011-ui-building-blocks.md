# 0011 — UI building blocks: how journeys open, richer screens, screens that continue by themselves, branding

Design, the full catalogue of ideas and what is left: [../plans/14-ui-building-blocks.md](../plans/14-ui-building-blocks.md).

## For designers (studio and workflow editor)

- **How a journey opens**: as a page, a **dialog** (small / medium / large), a **sheet** (right or bottom) or **full
  screen**, dismissible or not (*Journeys → How it opens*). Any button may choose another way for itself.
- **Widgets**: a richer **Button** (icon, accent and text styles, size, full width, alignment), a **Floating button**
  (always at hand above the page), a **QR code** (a link, an EMV payment request, a SEPA transfer).
- **Screen fields** (`client.screen`): **scanner** (QR / barcodes by camera, photo or typed; reads EMV, SEPA, links,
  JSON into `input.<key>Details`), **signature**, **one-time code**, **slider**, **calculated value**; fields **shown on
  a condition**, **format rules** (pattern, IBAN, Luhn, e-mail), **half-width** fields, **camera capture** on uploads.
- **Screens that continue by themselves** (`autoSubmit`): when complete, or when a rule holds too, after a countdown
  the client can stop.
- **Branding**: accent colour, background tint, font, button shape, light / dark, **presets**, **colours from the
  logo**, a **readability** check (WCAG AA), colour pickers; **region** (currency and locale).
- **Deep links** that start a journey: `/portal/start/<journey>?…&presentation=dialog`.
- The workflow editor shows a screen field's options only for the field types they apply to (a new `x-show-if`
  schema extension), so the longer list of options stays short on screen.

## In the banking template

**Pay with a QR code** (`pay_qr`): a **Pay** floating button (accent colour) opens it full screen, the *Pay with QR*
quick action as a bottom sheet. Scan a shop's EMV code (camera, photo or typed); codes with an amount continue by
themselves after a 2-second countdown; the workflow checks currency and balance, the client confirms, the account is
debited and the payment listed. The accounts page shows the client's own *Get paid* code. The app declares GBP /
en-GB; the dealer portal USD / en-US.

## Under the hood

| Where | What |
| --- | --- |
| `packages/lintelia/src/utilities/payment-codes.ts` | EMV / EPC / URL / JSON reader, EMV and EPC writers, CRC-16, IBAN and Luhn checks — shared by the app and the API |
| `packages/lintelia/src/schemas/client-app.schema.ts` | journey `presentation`, link `presentation`, theme (`accent`, `background`, `font`, `buttonShape`, `colorScheme`), `currency`, `locale`; widgets `button` (new props), `fab`, `qr-code`; hex colours validated |
| `apps/core/src/engine/components/client-app.ts` | new field types and options, `autoSubmit`, publication checks |
| `apps/core/src/client-apps/runtime.service.ts` | the API applies `visibleIf`, reads scanned codes (`<key>Details`), checks OTPs, sliders, patterns and value checks |
| `apps/core/src/experience-map/model.ts` | the map shows conditional fields, half-width fields and screens that continue by themselves |
| `apps/web/src/client-app` | `JourneyOverlay.tsx`, `ScreenForm.tsx` (conditional / calculated fields, auto-submit), `inputs/{ScanInput,SignatureInput,OtpInput}.tsx`, `widgets/actions.tsx` (button, FAB, QR code), `format.ts` (app currency and locale), theme props in `runtime.tsx`, `/start/:journey` in `pages.tsx` |
| `apps/web/src/app/modules/private/experience` | `ThemeTools.tsx` (presets, colours from the logo, readability), *Region* settings, journey presentation; colour pickers (`x-widget: color`) in the schema forms |
| dependencies | `jsqr` (read QR codes when the browser has no `BarcodeDetector`), `qrcode-generator` (draw QR codes) |

## Tests

| | |
| --- | --- |
| e2e API | `tests/client-app/ui-blocks.api.spec.ts` (APP-12): damaged codes refused, the amount asked only when the code has none, other currencies and too-high amounts stopped, the payment recorded with what the code said; one-time codes, sliders, IBAN, patterns, conditional and calculated fields checked by the API; mistakes refused at publication |
| e2e UI | `tests/client-app/pay-with-qr.ui.spec.ts` (APP-12): the FAB opens *Pay with QR* full screen, a photo of the code, the countdown, the payment; the quick action opens a sheet, a typed code without an amount, the countdown stopped, continuing later in the sheet, a deep link opening a dialog; **a phone's camera reads the code** (Chromium's fake camera films a generated QR code); a designer's screen in a dialog with a slider, a calculated value, a conditional field, format rules, a one-time code and a signature; the studio's presets, readability warnings, currency and journey presentation |
| e2e support | `support/payment-codes.ts`: EMV payloads built independently of the app, QR images, a Y4M video for the fake camera |
| unit | `apps/core/test/ui-building-blocks.test.ts`: payment codes (EMV round trip and checksum, damaged codes, EPC, links, JSON), IBAN and Luhn, `client.screen` validation of the new options |
| updated | `map.ui` (9 journeys; the scanner and auto-submit on the map), `client-app.test.ts` (the `pay_qr` workflow) |
| result | full suite **466 passed** (104 flows, all working); core unit tests 89 passing |

Watch the new journeys: `bun e2e --headed tests/client-app/pay-with-qr.ui.spec.ts`.

## Also

- `bun e2e --retries=1` (or `--workers`, `--reporter`) is a full run again: only options that select tests leave
  flow-status alone.
- Screen answers that name files by something other than a file id are refused (422) instead of failing (500).
- Closing a journey open over the page refreshes the page behind it (waiting requests, balances).
- `bun run demo:files` also writes payment QR codes (`pay-*.gif`, `payment-codes.txt`).
