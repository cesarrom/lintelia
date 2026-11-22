# ai connector

Language-model steps on any OpenAI-compatible API (docs/plans/12). Locally it talks to `fake-services/llm`, which
answers deterministically (extraction: "Label: value" lines of the document matched to the requested fields).

- `connector:ai/document.extract` (sync) — config: the document type, extra instructions, the fields (name,
  description, type: string / number / date / boolean); input `file` (a file id of the case, or a list of uploaded
  files: the first is used). The connector reads the file through the core (`files:read`, only files of the step's
  case or its parents, audited), extracts the PDF text layer (`src/pdf-text.ts`) and asks the model for a JSON object
  (`response_format: json_schema`, strict). Result: each field at the top level and in `fields`, `missing` (names the
  model could not find), `model`. Events: `extracted`, `incomplete` (some fields missing), `failed`. A `document`
  record with the values is attached to the case.
- `connector:ai/text.generate` (sync) — instructions (system prompt) + `text` (+ optional `file`) → `text`.
  Events `done`, `failed`.

Settings: base address, API key (secret), model, "send the document itself" (for scanned documents, when the model
accepts files/images). Nothing is stored by the connector besides the key.

Guardrails: temperature 0, "null when absent, never guess", results shown to people before decisions; the workflow
compares extracted values with declared ones (e.g. stated vs. pay-stub income) and routes differences to a review.
