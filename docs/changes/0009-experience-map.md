# 0009 — The experience map (experiment)

A Figma-like canvas where an institution sees — and navigates — everything it built for its clients:
*Build → Map* (`/app/map`). Design and inspiration: [../plans/13-experience-map.md](../plans/13-experience-map.md).

- **The app**: the shared **layout** (menu, header, sign-up, theme) drawn once, its menu entries pointing to the
  **pages**, each page a frame rendered by the real client-app runtime with a sample client; arrows from the widgets
  that lead somewhere (quick actions, buttons, callouts, list rows, card actions) to pages and journeys.
- **Journeys**, one row each: the journey → the **screens, requests and vendor pages** its workflow shows the client,
  in order, with **“behind the scenes”** nodes between them (reviews — and whether they may ask the client for more —,
  AI and other systems, functions, signals, notifications), labelled branches and **outcomes**; the workflow under
  the journey.
- **Automations**: events (LoanPro, webhooks, sign-ups, the institution's API) → workflows → functions and
  sub-workflows; forms → the workflows they start; optional notification arrows to pages.
- **Navigate like a prototype**: click a button inside a frame to fly to where it leads (and *Back*); hover a widget
  to light its arrows; the inspector lists what a node leads to and what reaches it; search; layers; a **persona**
  (the segments the app's rules use) fades what that client would not see; drag frames, *Tidy up*, minimap.
- **Into the editors and back**: double-click (or *Edit*) opens the studio on the page / journey / settings, the
  workflow editor centred on the step with its configuration open, or the form editor; a *Back to the map* pill
  returns to the same view.
- Problems where they are: pages nothing leads to, journeys nothing starts, missing or draft workflows, invalid YAML,
  app validation problems.

## API

`GET /experience-map` (`experience:read` or `workflows:read`): the app's draft definition and validation problems,
every workflow's map view (touchpoints, flow between them with the steps in between and branches, ends, people,
systems, calls, forms, notifications, signals, stages, triggers), forms and connections. The workflow view is built by
`apps/core/src/experience-map/model.ts` (pure).

## Tests

| | |
| --- | --- |
| e2e | `tests/client-app/map.ui.spec.ts` (APP-11): the API; frames, arrows, following links, personas, layers, each editor and back |
| unit | `apps/core/test/experience-map.test.ts`: touchpoints, flow and branches of the dealer deal, calls/people/systems/signals, a banking journey, broken YAML |
| result | full suite **458 passed** (103 flows, no retry needed); core unit tests 82 passing |

## Limits of the experiment

Positions are kept per browser; editing happens in the editors (the map navigates); frames are drawn at a desktop
width; sign-up screens are not frames yet. Next steps: plan 13 §5.
