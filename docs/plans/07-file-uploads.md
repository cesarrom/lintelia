# 07 — File uploads (client requests, forms, documents)

Today: client requests accept text only; `files.controller.ts` stores through the API into local disk
(`LocalStorageProvider`); no scanning, no signed URLs, no size/type policy.

## Industry-standard design

Files never pass through the API process; the API authorises, the object store receives, an asynchronous pipeline
validates and scans, and only then is the file usable. Downloads are short-lived signed URLs.

```
portal ──1 POST /uploads (purpose, case/task/item, name, size, type, sha256)──▶ API: authorise + policy
       ◀─2 { uploadId, target: presigned POST/PUT (or tus URL), expiresAt }─
portal ──3 PUT bytes──▶ object store: quarantine/<tenant>/<uploadId>
store ──4 object-created event──▶ API (or the portal calls POST /uploads/:id/complete)
API ──5 Restate "file intake" workflow: size/hash check → type sniffing → malware scan → (optional) sanitise →
        copy to clean/<tenant>/<fileId> → delete quarantine → file status `available` (or `rejected`) → notify task
portal/back office ──6 GET /files/:id/download ──▶ API authorises ──▶ 302 to a signed URL (≤ 60 s, attachment)
```

### Rules

- **Upload intents** (`uploads` table, tenant RLS): purpose (`client_request_item`, `form_field`, `case_document`,
  `connector_document`), owner (client/member/connector), case/task/item, declared name/size/type/sha256, status
  (`pending` → `uploaded` → `scanning` → `available` | `rejected` | `expired`), expiry 15 min.
- **Policy per purpose and per request item**: allowed types (by magic bytes, not extension: PDF, JPEG, PNG, HEIC,
  optionally DOCX), max size (e.g. 20 MB per file, 10 files per item), enforced three times: at intent, in the
  presigned POST policy (`content-length-range`, exact content type), and after upload (real size, sniffed type with
  `file-type`).
- **Malware scanning** mandatory before availability; infected → `rejected`, audit, the uploader sees "this file was
  refused"; a reviewer never gets it. Scanner behind a port: ClamAV daemon (self-hosted), or the cloud's native
  scanning (10). Optional **CDR** (content disarm & reconstruction) for PDFs/Office for institutions that require it.
- **Images**: strip EXIF/GPS, re-encode, generate thumbnails for review screens.
- **Large files / mobile**: resumable uploads with the **tus** protocol (`@tus/server` 2.x with an S3/Azure/GCS store)
  or S3 multipart with presigned parts; the portal uses **Uppy** (camera capture on phones, progress, retry).
- **Storage layout**: separate quarantine and clean buckets/containers; keys `tenant/<tenantId>/files/<fileId>`;
  server-side encryption with a KMS key (optionally per tenant for BYOK); versioning off for quarantine, on for clean
  with object lock where regulation requires immutability of evidence.
- **Downloads**: authorised per request (case scope, party ownership), signed URL ≤ 60 s with
  `response-content-disposition=attachment` and the sniffed content type, served from a **separate domain** (e.g.
  `files.fintivio-usercontent.com`) so a malicious file can never run in the app's origin; inline preview only for
  PDF/images through a sandboxed viewer.
- **Audit**: uploaded, scanned, rejected, downloaded (who, when), deleted.
- **Retention and data rights**: files follow the case retention; erasure deletes clean objects (and versions) unless
  under legal hold; exports include files.
- **Client requests**: `requestItems` of type `file` render an uploader; the response stores file ids; the reviewer's
  task shows thumbnails/preview and the scan status; the case "Documents" tab lists every file with its source
  (client, member, connector).

## Decisions: limits, types, sanitisation

### Limits and types (defaults; a workflow step may narrow them, never widen them)

| Purpose | Allowed types (by content, not extension) | Max size per file | Max files | Notes |
| --- | --- | --- | --- | --- |
| Client request items, form file fields (proof of address, payslips, statements) | PDF, JPEG, PNG, HEIC/HEIF | 20 MB | 10 per item | HEIC converted to JPEG; multi-page scans as PDF |
| Identity documents uploaded by hand (when not captured by Didit) | JPEG, PNG, HEIC, PDF | 15 MB | 4 | front/back; special-category retention |
| Case documents uploaded by members | PDF, JPEG, PNG, DOCX, XLSX, CSV, TXT | 50 MB | — | Office files converted (below) |
| Connector documents (signed PDFs, verification evidence) | PDF, JPEG, PNG | 50 MB | — | from trusted connectors, still scanned |
| Anything else | refused | | | archives (ZIP/RAR), executables, scripts, HTML/SVG and macro-enabled Office files (`.docm`, `.xlsm`) are never accepted |

Upload intents expire after 15 minutes; quarantine objects are deleted after 24 hours; a client may hold at most 100
pending intents (abuse control).

### Sanitisation (content disarm and reconstruction) — required

Every accepted file goes through **scan → sanitise → rescan** before it is `available`:

| Type | Sanitisation | Result stored |
| --- | --- | --- |
| PDF | rebuild the document (drop JavaScript, embedded files, launch actions, forms' scripts, XFA); if rebuilding fails, **rasterise** each page into a new PDF | sanitised PDF (the original kept in a restricted "original" area only when the institution's policy needs it, e.g. signed PDFs from Documenso whose signatures must stay verifiable) |
| JPEG/PNG/HEIC | decode and re-encode, strip metadata (EXIF/GPS), cap dimensions | re-encoded image + thumbnail |
| DOCX/XLSX | remove macros, external links, embedded objects; or convert to PDF (policy per tenant) | sanitised file or PDF |
| CSV/TXT | normalise encoding, neutralise formula injection (cells starting with `=`, `+`, `-`, `@`) when exported | cleaned text |

- Port `ContentSanitizer` (`sanitize(location, type) → { location, report }`); the report (what was removed) is kept
  with the file and shown to reviewers ("2 scripts removed").
- **Locally**: `fake-services/sanitizer` (HTTP, `:9502`) with the same contract: re-encodes images for real (`sharp` or
  the browser-free `jimp`), "sanitises" PDFs by copying them and reporting findings when the file contains markers
  (`/JavaScript`, `/EmbeddedFile`, `/Launch`), and can be told through `/__control` to fail, time out or report
  removals — enough to test every branch of the intake workflow. The scanner fake flags EICAR (above).
- **Production options** (decide with the cloud provider): commercial CDR APIs/appliances (OPSWAT MetaDefender, Glasswall,
  Votiro — some available on AWS/Azure marketplaces), or self-hosted open-source building blocks (qpdf/pikepdf to rebuild
  PDFs, Ghostscript/pdftoppm to rasterise, LibreOffice headless to convert Office files, libvips for images) in an
  isolated, network-less container with CPU/memory/time limits (gVisor/Firecracker sandboxing recommended: parsers of
  untrusted files are the attack surface).
- Order and failure policy: a scanner **or** sanitiser error keeps the file in quarantine (`rejected: processing_failed`,
  retry once); files are never made available unsanitised.

## Ports and adapters

`ObjectStore` (`createUploadTarget`, `createDownloadUrl`, `copy`, `delete`, `head`), `MalwareScanner`
(`scan(location) → clean | infected | error`), `ObjectEvents` (storage notifications → API).

| Environment | ObjectStore | Scanner | Events |
| --- | --- | --- | --- |
| Local (now) | **s3rver** (S3-compatible, npm, `fake-services/object-store`) with the S3 adapter — same code path as AWS; or the local disk adapter issuing API-signed URLs when s3rver's presign support is insufficient | `fake-services/scanner` (EICAR) + `fake-services/sanitizer` | the portal calls `/complete` (no bucket notifications locally) |
| AWS | S3 (presigned POST), SSE-KMS | GuardDuty Malware Protection for S3 (tags objects; EventBridge result) or ClamAV on ECS | S3 → EventBridge → API |
| Azure | Blob Storage (user-delegation SAS) | Microsoft Defender for Storage malware scanning (result via Event Grid / blob index tags) | Event Grid |
| GCP | Cloud Storage (V4 signed URLs / signed POST policy) | no native scanner: ClamAV on Cloud Run triggered by Pub/Sub | Pub/Sub notifications |
| Self-hosted / other clouds | MinIO, Cloudflare R2, Wasabi (S3 adapter) | ClamAV | bucket notifications or `/complete` |

## e2e

- New **UPL-01**: a reviewer asks for a proof of address as a file; the client uploads a PDF from the portal; the
  reviewer previews it and approves (SCN-06 becomes runnable).
- New **UPL-02**: an EICAR file is rejected, the client is told, nothing reaches the reviewer; audit shows the rejection.
- New **UPL-04**: a PDF with embedded JavaScript is accepted sanitised; the reviewer sees the sanitisation report;
  a sanitiser failure keeps the file out of the case and asks the client to upload again.
- New **UPL-03**: wrong type (an `.exe` renamed to `.pdf`) and oversized files are refused at intent and after upload.
- Download links expire and do not work for another client (isolation).
