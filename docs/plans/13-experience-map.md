# Plan 13 — The experience map: everything an institution built, on one canvas

Status: **v1 shipped (experiment)** — [../changes/0009-experience-map.md](../changes/0009-experience-map.md).

## 1. The problem

An institution's product is spread over several builders: the **studio** (the client app's pages, journeys, data,
sign-up), the **workflow editor** (journeys' screens and everything behind them), the **form builder**, connections,
functions and the events that start automations. Each editor is good at its own thing; none answers *"what did we
build, and how does it hang together?"* — which screen a button leads to, which workflow a journey runs, what the
client sees next after they press *Submit*, what happens in between (AI, a review, a payment), who is involved, where
it ends, what else a workflow starts. Designers and product people navigate by remembering ids.

## 2. What other products do (inspiration)

| Product | Idea we took |
| --- | --- |
| **Figma** (prototype mode) | screens as **frames** on an infinite canvas; **noodles** from a layer (a button) to the frame it opens; frame names stay readable when zoomed out; "flow starting points"; clicking a hotspot in presentation follows the link. |
| **FlutterFlow** (storyboard), **Adalo** (app map), **Draftbit** | the whole app as a map of screens with navigation arrows; double-click a screen to edit it. |
| **Overflow**, **Whimsical**, **FigJam** user flows | user flows as **rows**: screen → decision → screen, with the branches labelled. |
| **Webflow** (navigator / symbols), **Framer** | a **shared layout** (component/symbol) is drawn once, not repeated in every page. |
| **n8n**, **Zapier** canvas, **Camunda Modeler** | what runs behind a step as a node with its inputs/outputs; triggers as the leftmost node of an automation. |
| **Retool**, **Bubble** (workflow tab per element) | from any element, jump to the logic behind it — and back. |
| **Miro / tldraw** | free arrangement (drag), minimap, fit, search to jump. |

## 3. The design

One canvas (React Flow), four regions, laid out automatically (ELK, layered left-to-right), then freely arrangeable:

1. **The app** — the **layout** frame (the shell every page shares: brand header, the menu, sign-up, theme), once, with
   one arrow per menu entry; then each **page as a frame**, drawn by the real client-app runtime (the same widgets the
   client gets) with a sample client. Long pages are cut with a note. *Split of layout and content*: the menu's arrows
   leave the layout frame only, so they are not repeated for every page.
2. **Journeys** — one row per journey: the journey card (icon, who may start it, the stages the client sees) → the
   **touchpoints** its workflow shows the client, in order: **screens** (fields, bindings such as “prefilled
   {{me.dealerName}}”, buttons), **requests** (uploads, answers), **vendor pages** (Documenso signing, Didit
   verification), forms. Between two touchpoints, a **“behind the scenes” node** lists what happens: people (a
   review, with *may ask the client for more*), systems (AI, LoanPro), functions, sub-workflows, signals,
   notifications, and how many automatic steps. Branches are labelled with the decision (*Credit decision: Approve
   with conditions*). Rows end in **outcome pills** (*Funded*, *Declined*, *Withdrawn by dealer*). The workflow that
   runs the journey sits under the journey card.
3. **Automations** — workflows started by **events** (the event as the first node: *LoanPro · payment posted*,
   *a client signs up*, a webhook), **functions** and sub-workflows (arrows *Uses / Runs / Starts* from their
   callers), **forms** (embedded on the institution's site → the workflow they start).
4. Optional: **notifications** that open a page, and the page a journey returns to when done (dashed).

Arrows are coloured by meaning (legend): menu, opens a page, starts a journey, journey flow, runs a workflow, uses a
function, event, form, notification. Anchors sit **next to what they belong to**: a widget of a page (measured in the
rendered frame), a menu entry, a screen's button, a request's outcome.

### Interactions

| Gesture | Result |
| --- | --- |
| Click a button, a quick action, a list row, a menu entry **inside a frame** | follows the arrow: the canvas flies to the target and selects it (prototype-style); **Back** returns |
| Hover a widget with links | its arrows light up, the rest fades |
| Click a node | the **inspector**: what it is, *leads to* / *reached from* (each entry follows), and its editor |
| Double-click a frame, or **Edit** on its label | its editor: a page or the layout → the studio on that page / the settings; a journey → the studio's journeys tab; a screen or a behind-the-scenes step → the workflow editor centred on that step with its configuration open; a form → the form editor |
| In an editor opened from the map | a **Back to the map** pill returns to the same view |
| **Persona** | the sample client's segment (taken from the app's rules, e.g. *dealer*, *borrower*): widgets, menu entries and pages that this client would not see are faded |
| **Layers** | menu, links, journey screens, automations, notifications on/off |
| Search | jump to any page, journey, touchpoint, workflow, form |
| Drag (by a frame's label) | moves it; kept per browser; **Tidy up** lays everything out again |

### Problems shown where they are

Pages nothing leads to (*nothing leads here*), journeys no button starts and that are hidden from the launcher, a
journey whose workflow is missing, draft workflows, invalid YAML, and the count of app validation problems.

## 4. Architecture

- `GET /experience-map` (`experience:read` or `workflows:read`): the app's draft, every workflow as a **map view**
  (`apps/core/src/experience-map/model.ts`, pure and unit-tested: touchpoints = steps whose component kind is `client`;
  the flow = a walk from the start and from each touchpoint's events to the next touchpoints or ends, collecting the
  steps in between and the last branch taken; calls, people, systems, signals, notifications), forms and connections.
  Drafts, not published versions: the map is a building tool.
- Web: `apps/web/src/app/modules/private/map` — `graph.ts` (nodes, edges, widget links, layout with ELK),
  `nodes.tsx` (frames and cards), `edges.tsx`, `Inspector.tsx`, `MapPage.tsx`. Page frames use the client-app
  runtime (`AppPageView`) with a map runtime whose `openPage` / `startJourney` follow arrows instead of navigating.
- Deep links understood by the editors: studio `?page=`, `?journey=`, `?tab=settings`; workflow editor `?step=`;
  forms `?edit=`; `?from=map` shows the way back.

## 5. Next (if the experiment sticks)

1. **Edit in place**: open the studio's widget inspector or a step's configuration in a side panel without leaving the
   canvas; drag from a widget's anchor to a frame to create a link (Figma's noodle), to a workflow to create a
   journey.
2. **Sign-up and sign-in** as frames (registration fields, consents) leading to the home page.
3. **Live overlay**: counts of cases per touchpoint and stage (where clients are now, where they drop), SLA breaches.
4. **Comments and review** on frames (design review with compliance).
5. Positions stored with the app (shared by the team) instead of the browser; sections/frames grouping.
6. Phone frames (a 390 px viewport: the runtime's responsive classes follow the window today).
