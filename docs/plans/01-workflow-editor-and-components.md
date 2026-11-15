# 01 — Workflow editor and one component catalogue

## The bug you saw (root cause, confirmed in the code)

There are two workflow engines with two different vocabularies, and the editor only knows the old one.

| | Legacy node engine (`services/restate/*.ts`) | Case engine (`engine/`, batch 0003) |
| --- | --- | --- |
| Step types | `start`, `end`, `conditional`, `form`, `email`, `database`, `decisionTable`, `iterator`, `mapper`, `workflow`, `review`, `proofOfLife`, `identityValidation`, `documentExtractor`, `wizard`, `scheduler`, `fetchUser` | `start`, `end`, `conditional`, `calculate`, `review`, `client.request`, `email`, `wait`, `case.update`, `case.decision` |
| Config shapes | e.g. review: `items`, `assignToRoles`; conditional: `conditions[]` | review: `assignTo.role`, `outcomes[]`, `authority`, `sla`, `escalateTo`; conditional: `expression` (JSONata) |
| Known by the editor | yes (`WorkflowEditor.tsx` `nodeDefinitions`) | **no** |

- `WorkflowEditor.tsx` builds React Flow's `nodeTypes` from a hard-coded map of the legacy nodes. A step whose type is not
  in the map (`case.update`, `case.decision`, `calculate`, `client.request`, `wait`) falls back to React Flow's built-in
  `default` node, which renders `data.label`. Our node data has no `label`, so the box is empty. In the investigation
  template the step right after *Start* is `risk` (`case.update`): exactly the empty box you saw; the three closing
  decisions (`case.decision`) are empty for the same reason.
- Steps whose type exists in both engines render, but with the wrong fields: the `review` node reads `items` and
  `assignToRoles`, so the template's reviews show "Click the settings icon…"; `conditional` reads `conditions`, not
  `expression`. Saving from the editor would write legacy fields the case engine ignores (a review would lose its
  outcomes, authority and SLA).
- Layout: nodes are placed at `y = index × 100` with 300 px-wide cards, so they overlap; positions are not persisted.
- The `start` node's event is renamed `started` in the editor while templates use `finished` (harmless today because
  the engine takes the first event, but it is another silent divergence).

## Target: one component catalogue

One description of every step type, used by the editor (palette, node rendering, configuration form, validation),
the engine (publish-time validation, execution) and connectors (which contribute their own components, see
[03](03-integrations-architecture.md)).

```ts
interface ComponentDefinition {
  type: string;                 // 'review', 'case.decision', 'didit.kyc.verify@1'
  version: number;              // published workflow versions pin it
  title: string; description: string; icon: string;   // lucide name or URL (connectors)
  category: 'flow' | 'data' | 'people' | 'case' | 'communication' | 'connector';
  source: { kind: 'builtin' } | { kind: 'connector'; connectorId: string; installationId?: string };
  configSchema: JSONSchema;     // JSON Schema 2020-12; `x-expression: true` marks fields that accept `=JSONata`
  uiSchema?: UiSchema;          // order, widgets (role picker, form picker, expression editor, duration, outcomes editor)
  inputSchema?: JSONSchema;     // what it reads from the case context (documentation + mapping helpers)
  outputSchema?: JSONSchema;    // what it adds to `steps.<id>` (drives autocomplete in later steps)
  events: { static?: string[]; fromConfig?: string };   // e.g. review: fromConfig 'outcomes[].key' + defaults
  summary?: string;             // one-line node summary template, e.g. "Queue {{assignTo.role}} · SLA {{sla}}"
  kind: 'automatic' | 'human' | 'client' | 'timer' | 'container';
  docsUrl?: string;
}
```

- **Served by the API**: `GET /workflow-components` returns built-ins plus the components of the institution's
  connections the caller may use (`integrations:use`), grouped for the palette.
- **Built-ins are declared next to their executor** in `apps/core/src/engine/components/<type>.ts` (definition +
  executor), replacing the `switch` in `case-runner.ts`; `STEP_TYPES` becomes the registry.
- **Validation** at publish time validates each step's config against its `configSchema` (ajv) after static checks
  (graph, roles, connections); expressions are compiled (JSONata parse) so syntax errors surface at publish.
- **Shared package**: the JSON schemas and types live in `packages/fintivio` so the web app can also validate while
  editing.

## Editor changes

1. **Generic node** (`ComponentNode`): icon, title, step name, summary line from `summary`, event handles from
   `events` (static + derived from config, so adding a custom review outcome adds a handle), badges for
   `human`/`client`/`timer`, warnings from validation. Used for every type without a custom renderer.
2. **Generic configuration dialog** rendered from `configSchema` + `uiSchema` (react-jsonschema-form with a shadcn theme,
   or a small in-house renderer; both are standard). Custom widgets: role picker (from `/roles`), form picker,
   workflow picker, connection picker, duration (ISO-8601), outcomes editor (key, label, requires reason, second
   approval), expression field with JSONata syntax highlighting, autocomplete from earlier steps' `outputSchema`, and
   a "try it" evaluation against sample data (`POST /workflows/expressions/evaluate`, no side effects).
3. **Custom renderers** stay possible for rich components (decision table, form designer link).
4. **Unknown type fallback**: a visible "Unknown component `x` — not available to this workspace" node instead of an
   empty box (e.g. a connector that was uninstalled).
5. **Layout**: automatic layout with `elkjs` (layered, left→right) when positions are missing; positions saved in the
   YAML under `ui: { x, y }` per step (ignored by the engine). Container components (see 06: `foreach`) render as
   React Flow sub-flows (group nodes).
6. **Validation in the editor**: a *Validate* button and live badges using `GET /workflows/:id/validation`; publish
   errors point at steps.
7. **Palette** from the catalogue: Flow (condition, wait, end), Data (calculate, map), People (review, task, form
   request), Client (client request, confirmation), Case (update, decision), Communication (e-mail, SMS), Connectors
   (one group per connection).
8. **Templates and round trip**: the YAML ⇄ graph conversion (`packages/fintivio/src/utilities/workflow.ts`) keeps
   unknown fields verbatim (today zod schemas and mappers can drop them) and keeps event names.

## Retiring the legacy engine

The legacy engine is still wired to log-pattern triggers and still journals session tokens
([0003](../changes/0003-case-engine-and-journeys.md)). Inventory and decision per node:

| Legacy node | Decision |
| --- | --- |
| `start`, `end`, `conditional`, `review`, `email` | exist in the case engine; migrate configs |
| `mapper`, `iterator`, `workflow` | become `data.map`, `foreach`, `workflow.call` (06) |
| `form` | becomes `form.request` (06) |
| `decisionTable` | keep as a built-in component (`decision.table`, DMN-like hit policies), re-implemented as a pure evaluator; the existing dialog is reused |
| `scheduler` | becomes a trigger (`schedule`) and the `wait` component |
| `database` | replaced by data-source connectors (03) — the old node wrote to tenant tables (feature already disabled) |
| `identityValidation`, `proofOfLife` | replaced by the Didit connector (05) |
| `documentExtractor` (OpenAI) | future connector; removed from the core |
| `wizard`, `fetchUser` | `wizard` folds into `form.request` multi-page forms; `fetchUser` into `client.lookup` |

Then: log-pattern triggers become platform events (`EventsService`), `workflow.trigger/resume` and the legacy Restate
services are removed, the last tokens leave the journal, and the `sys_key_values`/`sys_workflow_executions` execution
state is dropped (no production data to migrate).

## Quick fix (M0, before the catalogue)

Register renderers for the case-engine types with their real config fields (review, conditional with `expression`,
calculate, client request, wait, case update, case decision) and the unknown-type fallback, plus auto-layout. It is a
few small components and unblocks reviewing the templates visually; the catalogue (M1) replaces them.

## Tests

- Unit (`packages/fintivio`): every template round-trips YAML → graph → YAML unchanged (order-insensitive).
- Unit (core): every built-in definition's `configSchema` accepts the templates and rejects known-bad configs.
- e2e UI (new flow **DES-06 Edit a workflow visually**): open each template in the editor; every step shows its title and
  summary (e.g. the MLRO step shows "Queue compliance_officer · High authority"); change the triage SLA in the dialog,
  add an outcome and connect it, save, validate, publish v2; a case started afterwards uses v2 and the new outcome.
