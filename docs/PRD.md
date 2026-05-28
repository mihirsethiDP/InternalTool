# DigitalPaani Internal Document Hub — Product Requirements Document

| Field | Value |
| --- | --- |
| **Product** | DigitalPaani Internal Document Hub |
| **Owner** | Mihir Sethi (`mihir.sethi@digitalpaani.com`) |
| **Status** | v0.1 — Active development |
| **Last updated** | 2026-05-15 |
| **Repository** | https://github.com/mihirsethiDP/InternalTool |
| **Live URL** | https://mihirsethidp.github.io/InternalTool/ |

---

## 1. Executive Summary

DigitalPaani installs and maintains instrumentation (level/pressure/DO/COD/BOD/TSS/TDS/VFD sensors, PLCs, etc.) at wastewater treatment plants. Across the project lifecycle — vendor procurement, installation, commissioning, handover, warranty, ongoing service — the company accumulates hundreds of documents per plant: vendor manuals, calibration certificates, P&IDs, I/O lists, handover packets, warranty certificates, design data sheets, and more. These are scattered across Google Drive folders with no consistent structure, no search-within-PDF, no role-based access, and no shared source of truth.

This product is a **centralised, search-first document hub** for the internal team. v0.1 ships with: full-text search across every PDF page, browse-by-filter, plant ↔ equipment ↔ sensor linking, role-gated upload with metadata, an editable taxonomy, and an architecture pre-wired for AI search.

---

## 2. Problem Statement

Today, document handling is broken in five concrete ways:

1. **Cluttered storage.** Drive folders accumulate without conventions; locating any specific document is a hunt.
2. **No in-document search.** Search-within-PDF (e.g. "find troubleshooting steps for ERR-01 in any Brotek manual") is impossible at scale.
3. **High onboarding cost.** New joiners cannot self-serve — they must shadow senior staff to learn "where things live."
4. **Tribal knowledge.** A handful of people know where the right document is. Their unavailability blocks the rest of the team.
5. **No structured taxonomy.** Documents aren't tagged by plant / sensor / type, so even browse-by-filter doesn't work.

The qualitative cost is delayed client responses, inconsistent training, and dependency on individuals. The quantitative cost is the engineering hours spent locating documents that already exist somewhere in Drive.

---

## 3. Goals & Non-Goals

### 3.1 Goals (v0.1)

| # | Goal | Acceptance signal |
| --- | --- | --- |
| G1 | A single URL where internal users find any document | All target document types listed in §4 are uploadable and findable |
| G2 | Full-text search **inside PDF contents** (not just titles) | Querying a phrase that only appears in page 7 of a manual returns that document, with the matching snippet and page number |
| G3 | Role-based access: read open to all `@digitalpaani.com`, write to allowlist | Viewer cannot upload; Uploader cannot manage users; Admin can do both |
| G4 | Document tagging by plant, equipment, sensor model | Every document captured in v0.1 carries enough metadata to be discoverable via either browse or search |
| G5 | First-class plant model: plant → equipment → sensor installed on equipment | The Plant detail page surfaces equipment groups, linked sensors, and plant-scope documents |
| G6 | Architecture future-proofed for AI search | Schema includes (commented) embedding column; search provider interface allows swapping in hybrid AI search without UI changes |
| G7 | Deployable as a static SPA on GitHub Pages with Supabase backend | Live build at the public URL with no manual server provisioning |

### 3.2 Non-Goals (v0.1)

- Generative AI synthesis of search results (deferred to v0.2; architecture prepared).
- Automated parsing of Design Data Sheets to populate plant sensors (deferred to v0.2).
- Crawling vendor websites (Siemens, etc.) to ingest manuals (legal/ToS risk; using vendor URL fields instead).
- External-user access (clients). v0.1 is internal-only.
- Full-text extraction from Word/Excel/images (deferred — only metadata is indexed for non-PDFs in v0.1).
- Mobile-first UI (responsive but desktop-optimised).
- Versioning of documents (each upload is a discrete record).
- Granular per-document ACLs (read access is uniform within the company).

---

## 4. Personas & Use Cases

### 4.1 Personas

| Persona | Primary documents | Frequency | Role |
| --- | --- | --- | --- |
| **Electrical Engineer** | Installation guides, troubleshooting steps, sensor manuals, calibration procedures | Daily | Viewer or Uploader |
| **Domain Team** | Sensor manuals, troubleshooting steps, technical data sheets | Weekly | Viewer or Uploader |
| **Monitoring Team** | Sensor manuals, troubleshooting steps, technical data sheets | Daily | Viewer |
| **Customer Service Manager** | Plant-specific documents (handover, I/O list, P&ID, warranty cert) | Daily | Viewer |
| **Project Lead / Admin** | All of the above + onboarding new joiners + managing taxonomy | Weekly | Admin |

### 4.2 Core user stories

| ID | As a … | I want to … | So that … |
| --- | --- | --- | --- |
| US-1 | Field engineer | search "ERR-01 Brotek UT 116" and get the exact troubleshooting page | I can resolve a site issue without calling a senior |
| US-2 | New joiner | browse all manuals for a sensor make/model the team uses | I can learn the catalog independently |
| US-3 | CSM | open a plant page and see its handover, I/O list, P&ID, warranty cert | I can answer a client question in one screen |
| US-4 | Project lead | upload a warranty certificate, tag it to the plant, have its contents searchable | the field team can self-serve in future |
| US-5 | Admin | grant upload rights to a specific user | trusted teammates contribute without bottlenecking on me |
| US-6 | Engineer | search "all level transmitters at STP Aurangabad" | I know what's installed before site visit |
| US-7 | Project lead | add a brand-new sensor model that wasn't in our master sheet | I can document it the moment we adopt it |

---

## 5. Domain Model

```
                        ┌──────────┐
                        │  Plants  │
                        └────┬─────┘
                             │ 1 ─── n
                  ┌──────────┼──────────────┐
                  ▼          ▼              ▼
           ┌───────────┐  ┌────────────┐  ┌───────────┐
           │ Equipment │  │ Documents  │  │   PLCs    │
           └─────┬─────┘  │ (plant_id) │  └───────────┘
                 │ 1      └─────┬──────┘
                 │ ─── n        │
                 │              │ many ↔
                 │              │ document_type
                 ▼              │      
        ┌──────────────────┐    │      
        │  PlantSensors    │    │     
        │ (plant_id,       │    │      
        │  equipment_id,   │    │      
        │  sensor_model_id)│    │      
        └────────┬─────────┘    │      
                 │              │
                 ▼              │
           ┌───────────────┐    │
           │ SensorModels  │◀───┘ (sensor_model_id)
           │  ┌─────────┐  │
           │  │  Makes  │  │
           │  └─────────┘  │
           │  ┌────────────┐
           │  │ Categories │
           │  └────────────┘
           └───────────────┘
                 ▲
                 │ has many
                 │
           ┌───────────────┐
           │ DocumentChunks│
           │ (page text +  │
           │  tsvector +   │
           │  embedding*)  │
           └───────────────┘
```

`*` = column exists in schema (commented in 001_init.sql) ready for v0.2 AI search; not used in v0.1.

### 5.1 Document type taxonomy & scope rules

Each document type carries a **scope** that drives required metadata on upload:

| Document type | Scope | Required fields beyond file + title |
| --- | --- | --- |
| Sensor Manual | `general` | Sensor model |
| Installation Guide | `general` | Sensor model |
| Troubleshooting Steps | `general` | Sensor model |
| Technical Data Sheet | `general` | Sensor model |
| Test Certificate | `plant_sensor` | Plant + Equipment + Sensor model |
| Calibration Certificate | `plant_sensor` | Plant + Equipment + Sensor model |
| Handover Document | `plant` | Plant |
| I/O List | `plant` | Plant |
| P&ID | `plant` | Plant |
| Onboarding Document | `plant` | Plant |
| Design Data Sheet | `plant` | Plant |
| Warranty Certificate | `plant_with_sensor_refs` | Plant (sensors referenced via PDF text → FTS) |

Admins can add new document types from the Admin panel; the scope defaults to `general` and can be edited in the DB.

---

## 6. Functional Requirements

### 6.1 Authentication & Roles

- **FR-AUTH-1** Sign-in is via Supabase magic link (email OTP).
- **FR-AUTH-2** A `profiles` row is auto-created on first sign-in. Default role: `viewer`.
- **FR-AUTH-3** Three roles: `viewer`, `uploader`, `admin`.
- **FR-AUTH-4** Role transitions are admin-only.
- **FR-AUTH-5** Sign-out clears the session and routes to `/login`.
- **FR-AUTH-6** Supabase URL/Redirect config must allow the deployed origin (`https://mihirsethidp.github.io/InternalTool/`).
- **FR-AUTH-7** *Future:* email-domain restriction to `@digitalpaani.com` via DB trigger or auth hook.

### 6.2 Search (the heart of the product)

- **FR-SEARCH-1** A single hero search input on `/` (the landing page) accepts free text and queries all indexed document chunks.
- **FR-SEARCH-2** Results show: document title, type, plant (if any), equipment (if any), sensor make + model (if any), matched page number, and a highlighted snippet from the matching chunk.
- **FR-SEARCH-3** Ranking uses Postgres `ts_rank` over a tsvector generated from each chunk's text. Document title / plant name / sensor model fallback matches with low rank.
- **FR-SEARCH-4** Clicking a result opens the document — either at the matched page (via `#page=N` on the signed URL) or the vendor URL if no file is stored.
- **FR-SEARCH-5** Example query chips reveal possible search idioms (Hick's law — keep visible set ≤ 5).
- **FR-SEARCH-6** Search is reactive (no Search button required; updates as user types).
- **FR-SEARCH-7** *Future (v0.2):* hybrid AI search — semantic similarity over embeddings + FTS via Reciprocal Rank Fusion + Claude synthesises an answer with citations. UI surface is identical.

### 6.3 Browse

- **FR-BROWSE-1** `/browse` lists **all documents** by default — no filter required.
- **FR-BROWSE-2** An always-visible search input filters by document text.
- **FR-BROWSE-3** Filters: Document type, Plant, Sensor category, Make, Model.
- **FR-BROWSE-4** Filters are fully **independent** — selecting one does not require any other.
- **FR-BROWSE-5** **Progressive disclosure:** Sensor category / Make / Model only appear when the chosen document type is sensor-relevant (sensor manual, install guide, troubleshooting, datasheet, test cert, calibration cert, warranty cert).
- **FR-BROWSE-6** **Cascade within a group:** Model dropdown only appears after a Make is picked; lists models of that make.

### 6.4 Plants

- **FR-PLANT-1** `/plants` lists all plants in card layout with name + location.
- **FR-PLANT-2** **Admin only:** an inline "+ New plant" button opens an inline form.
- **FR-PLANT-3** `/plants/:id` shows a plant hero (name, location, stats), an Equipment section, a Sensors section, and a Documents section.
- **FR-PLANT-4** **Equipment** is a first-class entity owned by a plant. Uploader/admin can add and remove equipment inline.
- **FR-PLANT-5** Sensors installed on the plant are shown as **cards grouped by equipment** (with an Equipment dropdown to filter to one group). Sensors not linked to any equipment appear under "Unassigned."
- **FR-PLANT-6** Linking a sensor to a plant requires: Make (selected first) → Model (cascading) → Equipment (optional).
- **FR-PLANT-7** The Documents section supports a Document-type filter dropdown.
- **FR-PLANT-8** A prominent "+ Upload document" button in the plant header opens the global Upload modal pre-filled with the current plant.

### 6.5 Sensor catalog

- **FR-SENSOR-1** `/sensors` lists all sensor models grouped by category in cards.
- **FR-SENSOR-2** Search input + filters: Category, Make, Model.
- **FR-SENSOR-3** Make/Model cascade: model list filters to selected make.
- **FR-SENSOR-4** **Uploader/admin** can click "+ New sensor" → opens AddSensorModal with Make (with datalist autocomplete), Category, Model number, optional Description, optional Vendor URL.
- **FR-SENSOR-5** Make is **find-or-create** — typing a new make creates it; typing an existing one (case-insensitive match) reuses it.
- **FR-SENSOR-6** `/sensors/:id` shows the model's specs, suitability, technical details, vendor URL, and all linked documents.
- **FR-SENSOR-7** Pagination at 24 per page on the catalog list.

### 6.6 Upload

- **FR-UPLOAD-1** A global "+ Upload" button in the header opens a modal. Available to **uploader** and **admin** only.
- **FR-UPLOAD-2** The modal accepts: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), images (.png/.jpg/.jpeg/.gif/.webp).
- **FR-UPLOAD-3** Drag-and-drop file picker with hover/active styling and a file-type emoji indicator after pick.
- **FR-UPLOAD-4** Title field **auto-fills** from the file name on file pick. User can edit; auto-fill stops once user edits.
- **FR-UPLOAD-5** Document-type dropdown plus "Recent types" chips (top 3 most-recently used in the last 30 uploads). Same pattern for "Recent plants" and "Recent makes."
- **FR-UPLOAD-6** Fields shown adapt to the chosen document type's scope (see §5.1):
  - `general` → Make + Model required, plant ignored
  - `plant` → Plant required
  - `plant_sensor` → Plant + Equipment + Sensor model required
  - `plant_with_sensor_refs` → Plant required (sensors via FTS)
- **FR-UPLOAD-7** Inline link "+ Can't find it? Add new sensor" opens AddSensorModal without leaving the upload flow; the new model is auto-selected on return.
- **FR-UPLOAD-8** On submit: file uploads to Supabase Storage, a `documents` row is inserted, and (PDFs only) text is extracted client-side via pdf.js, chunked, and inserted into `document_chunks` for search.
- **FR-UPLOAD-9** Progress bar visible; non-PDFs are still indexed by title chunk so they're findable by metadata.
- **FR-UPLOAD-10** A plant page's "+ Upload document" button pre-fills the plant. Same for sensor model detail.

### 6.7 Admin

- **FR-ADMIN-1** `/admin` is admin-only.
- **FR-ADMIN-2** **Users panel:** lists all users, allows changing role between viewer/uploader/admin.
- **FR-ADMIN-3** **Plants panel:** inline create.
- **FR-ADMIN-4** **Document types panel:** inline create with key (snake_case) + label + sort_order.
- **FR-ADMIN-5** *Future:* Makes panel (rename/merge/delete makes); audit log; deletion of documents.

---

## 7. Non-Functional Requirements

### 7.1 Security

- **NFR-SEC-1** All tables have Row-Level Security enabled.
- **NFR-SEC-2** Read policies require `auth.role() = 'authenticated'`.
- **NFR-SEC-3** Write policies require `current_role() IN ('uploader','admin')`. Profile updates require `current_role() = 'admin'`.
- **NFR-SEC-4** Storage bucket `documents` is private; access via Supabase-signed URLs with 10-minute TTL.
- **NFR-SEC-5** No secrets in the frontend — anon key is public-by-design; service_role key is never used client-side.
- **NFR-SEC-6** Supabase project URL and anon key are injected at build time via GitHub Actions secrets.
- **NFR-SEC-7** *Open item:* email-domain enforcement (`@digitalpaani.com`) — currently relies on social discipline; to be hardened via Supabase auth hook before broader rollout.

### 7.2 Performance

- **NFR-PERF-1** Search RPC must return ≤ 50 hits within 500 ms for catalogs up to 10,000 documents and 200,000 chunks (limited by Supabase tier).
- **NFR-PERF-2** Initial page render ≤ 2 s on a typical broadband connection (LCP target 1.8 s).
- **NFR-PERF-3** PDF text extraction at upload time happens in-browser; up to 100-page PDFs should complete within 10 s on modern laptops.

### 7.3 Reliability

- **NFR-REL-1** Single-region Supabase Postgres + Storage; daily backups (Supabase default on Pro tier).
- **NFR-REL-2** Deployments are atomic via GitHub Pages; rollback by re-running a prior workflow.
- **NFR-REL-3** RPC + DB migrations are versioned in `supabase/migrations/`; re-runnable safely (idempotent where reasonable).

### 7.4 Accessibility & UX

- **NFR-UX-1** WCAG AA contrast on brand colour (`#193458`) against white surfaces.
- **NFR-UX-2** Keyboard-accessible navigation through all primary actions.
- **NFR-UX-3** UX design follows: **Hick's law** (limit visible choices in suggestion chips), **Miller's law** (paginate at 24, recent chips capped at 3), **Aesthetic-Usability Effect** (consistent visual system across all pages), **Law of Proximity** (related fields grouped, generous whitespace between groups), **Law of Similarity** (consistent badges, buttons, cards, table styles).

---

## 8. Information Architecture

```
/                        Search (Home)
/login                   Magic-link sign-in (unauthenticated)
/browse                  All documents with filters + in-page search
/plants                  Plant directory; admin-only "+ New plant"
/plants/:id              Equipment + sensors + plant-scope documents
/sensors                 Sensor catalog grouped by category
/sensors/:id             Model detail + linked documents
/admin                   Admin-only: users, plants, document types
```

Routing is hash-based (`HashRouter`) for GitHub Pages compatibility.

---

## 9. Technical Architecture

### 9.1 Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS, hash routing, TanStack Query for data.
- **PDF handling:** `pdfjs-dist` (worker-backed, in-browser text extraction).
- **Backend:** Supabase (Postgres + Auth + Storage + RLS + RPC).
- **Hosting:** GitHub Pages (static); GitHub Actions builds and deploys on push to `main`.

### 9.2 Database (key tables)

| Table | Purpose |
| --- | --- |
| `profiles` | One row per user; carries `role`. |
| `sensor_categories` | 6 clean families (Flow, Level, Pressure, Water Quality, Maintenance & Safety, Other). |
| `sensor_makes` | Vendor names; deduped case-insensitively. |
| `sensor_models` | (make, category, model_no) tuples + descriptive fields. |
| `plcs` | PLC catalog (parallel to sensors). |
| `plants` | Operational sites. |
| `equipment` | Children of `plants` (air blowers, tanks, pumps, etc.). |
| `plant_sensors` | (plant, equipment, sensor_model) — sensors installed on equipment. |
| `document_types` | Configurable taxonomy with `scope`. |
| `documents` | One row per uploaded file; links to plant / equipment / sensor_model. |
| `document_chunks` | Page-level text chunks; carries `tsvector` (used today) and `embedding vector(1536)` *(reserved for v0.2)*. |

### 9.3 Search RPC

`public.search_documents(q, p_plant_id, p_sensor_model_id, p_plc_id, p_type_key, p_category_id, p_make_id, p_equipment_id, p_limit)` — performs ts_query ranking over `document_chunks.tsv` with metadata joins; returns hits with snippets via `ts_headline`. Title/plant/sensor fallback matches included.

When AI search is enabled, this RPC is superseded by `hybrid_search_documents` accepting an additional `embedding vector(1536)` parameter; the frontend swap point is `src/lib/search/index.ts` (`SearchMode` env var).

### 9.4 Migrations (chronological)

| File | Purpose |
| --- | --- |
| `001_init.sql` | Initial schema, RLS, FTS, search RPC, storage bucket, document-type seed. |
| `002_seed.sql` | Original catalog seed from master xlsx (retained for reversibility). |
| `003_simplify_catalog.sql` | Option B: wipe noisy models/PLCs; collapse 68 categories to 6; dedupe makes. |
| `004_equipment_and_scope.sql` | `equipment` table, `documents.equipment_id`, `plant_sensors.equipment_id`, `document_types.scope`, extended search RPC. |
| `005_demo_seed.sql` | 4 makes / 4 models / 1 demo plant + equipment + 17 dummy docs with searchable chunks. |

### 9.5 Deployment

- Build: GitHub Actions on push to `main`. Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Output: `dist/` artefact deployed to GitHub Pages (`/InternalTool/` base path).
- Local dev: `npm run dev` with `.env.local`.

---

## 10. UX Principles Applied

| Principle | Where it shows up |
| --- | --- |
| **Hick's law** (limit choices) | Search chips capped at 5; Recent chips capped at 3. |
| **Miller's law** (chunks of ~7) | Sensor catalog paginates at 24; recent chips at 3. |
| **Aesthetic-Usability Effect** | Shared design system (cards, badges, buttons, gradient headers). Search page is the hero. |
| **Law of Proximity** | Upload modal groups related fields ("Link this document" cluster). Plant detail groups sensors by equipment with whitespace between groups. |
| **Law of Similarity** | All page headers use one component; all primary buttons share gradient style; all badges share shape and palette. |
| **Progressive disclosure** | Browse only shows Make/Model when relevant; Make → Model cascade; "+ Add new sensor" inline link in upload. |

---

## 11. Out of Scope (v0.1)

- AI search synthesis (architecture ready, not enabled).
- DDS auto-parse to populate plant sensors.
- Vendor-website ingestion / web scraping (legal/ToS risk).
- Word/Excel/image text extraction at upload (only metadata indexed).
- Document versioning.
- Per-document or per-folder ACLs beyond role.
- External (client) access.
- Mobile-first redesign.
- Bulk import / bulk reassignment tools.
- In-app PDF viewer (delegating to browser PDF viewer with `#page=N`).
- Audit log of edits.

---

## 12. Roadmap

### v0.2 — Smart search (target ~2–4 weeks)

- Turn on `pgvector`; backfill `document_chunks.embedding` for existing rows.
- Implement `hybridAIProvider` — embed query, hybrid rank, Claude synthesis with citations.
- "AI answer" card above the results list on `/` and `/browse`.

### v0.3 — Workflow & ingestion

- DDS parser: when a Design Data Sheet is uploaded, extract the sensor/equipment list and offer to bulk-link.
- Word / Excel / image OCR text extraction at upload (`mammoth`, `xlsx`, Tesseract / Vision API).
- Admin → Makes panel: merge / rename / delete.

### v0.4 — Lifecycle & governance

- Document versioning (replace + retain history).
- Audit log (who uploaded / edited / deleted what, when).
- Soft-delete + admin restore.
- Email-domain enforcement at sign-in.
- Per-document expiry reminders (e.g. warranty cert nearing expiry).

### v1.0 — Beyond docs

- External access for select clients on selected plants (read-only, share-link based).
- Mobile-optimised view.
- Cross-plant analytics: "which sensors fail most often" derived from troubleshooting doc clusters.

---

## 13. Success Metrics

| Metric | Definition | v0.1 target |
| --- | --- | --- |
| **TTD** — Time to Document | Median seconds from search query to opening the right document | < 30 s |
| **Coverage** | % of "actively referenced" documents ingested into the hub vs. still in Drive | 80% within 4 weeks of internal rollout |
| **Self-serve rate** | % of internal document requests resolved without escalation | > 75% within 8 weeks |
| **Active uploaders** | Distinct users uploading per week | ≥ 5 |
| **Search recall** | For a curated set of 20 known phrases, % returning the expected document in the top 5 | ≥ 90% |
| **Drive abandonment** | New documents created in legacy Drive folder vs. uploaded to hub | < 10% by week 8 |

---

## 14. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Search relevance is poor for sensor jargon (FTS alone is keyword-bound) | Medium | High | v0.2 hybrid AI search adds semantic similarity. Today: rely on rich chunking + title fallback matches. |
| R2 | Adoption stalls — team keeps using Drive | High | High | Make upload modal frictionless (drag-drop, recent chips, auto-title). Communicate clear cutover dates. Track Drive abandonment metric. |
| R3 | Storage cost grows unpredictably as PDFs accumulate | Medium | Medium | Supabase Pro Storage is ~$0.021/GB/mo; even 100 GB ≈ $2.10/mo. Monitor monthly. |
| R4 | Email rate limit on magic links blocks first-time users | Medium | Low | Dashboard send-link bypass documented; eventually move to a paid SMTP provider for higher limits. |
| R5 | A non-admin gains upload role via social engineering | Low | Medium | Admin role changes are audited via Postgres logs; future audit-log feature. |
| R6 | A future schema change breaks the search RPC for older clients | Low | Medium | RPC is versioned in migrations; only one in-use at a time; clients refetch on deploy. |
| R7 | GitHub Pages static-site limits become a problem (no custom auth headers, hash routing) | Low | Medium | If hit, lift-and-shift to Vercel or Cloudflare Pages with zero frontend changes. |
| R8 | DDS auto-parse (v0.3) is technically harder than expected (formats vary per template) | Medium | Low | Acceptable to keep manual linking flow as fallback. |

---

## 15. Open Questions

- **OQ-1** Should warranty certificates be modelled as many-to-many with sensor models (structured) or kept text-search-only? *Current decision: text-only — revisit if filtering "warranty certs covering Brotek UT 116" by metadata becomes a real workflow.*
- **OQ-2** Should we allow non-admins to add new makes (via the find-or-create flow) or restrict make creation to admins? *Current: any uploader can implicitly create makes — pragmatic for v0.1, may tighten if clutter returns.*
- **OQ-3** How do we present the same document being relevant to multiple plants (e.g. one generic Brotek manual)? *Current: store once with `sensor_model_id`; surface on every plant that installs the sensor. Adequate.*
- **OQ-4** Should expired warranty certs auto-archive? *Out of scope for v0.1; v0.4 candidate.*

---

## 16. Glossary

| Term | Definition |
| --- | --- |
| **Hub** | This product — the centralised document store. |
| **Plant** | An operational wastewater treatment site (e.g. "STP Aurangabad"). |
| **Equipment** | A physical asset within a plant (e.g. aeration tank, filter feed pump). |
| **Sensor model** | A specific make + model combination in the catalog (e.g. Brotek UT 116). |
| **Make** | The manufacturer/vendor of a sensor or PLC (e.g. Siemens). |
| **Category** | Sensor family — Flow, Level, Pressure, Water Quality, Maintenance & Safety, Other. |
| **Document type** | The kind of document (manual, install guide, calibration cert, etc.) with an associated `scope`. |
| **Scope** | Determines which metadata fields are required on upload: `general`, `plant`, `plant_sensor`, `plant_with_sensor_refs`. |
| **Chunk** | A unit of indexed text — one row per (document, page) in `document_chunks`. |
| **FTS** | Postgres Full-Text Search via `tsvector` + `ts_rank`. |
| **RLS** | Row-Level Security — Postgres-native authorisation rules. |
| **Magic link** | Email-based passwordless sign-in flow. |
| **Hybrid search** | Combination of keyword (FTS) and semantic (vector cosine) ranking — planned for v0.2. |

---

## Appendix A — Visual / UX inventory of pages

| Page | Hero element | Key actions | Sections |
| --- | --- | --- | --- |
| **Search (`/`)** | Centred bold heading + large search input | Type, click chip | Recently uploaded grid |
| **Browse** | Gradient hero with result count stat | Search, filter | Filter card + results |
| **Plants** | Gradient hero with plant count | "+ New plant" (admin) | Plant cards |
| **Plant detail** | Gradient hero with stats | "+ Upload document" | Equipment, Sensors, Documents |
| **Sensors** | Gradient hero with stats | "+ New sensor" (uploader+) | Filter card, category groups |
| **Sensor detail** | Gradient hero | "+ Upload document" | Specs / Suitability / Technical / Vendor, Documents |
| **Admin** | Gradient hero | n/a | Users, Plants, Document types |
| **Login** | Logo + branded card | Sign in | Magic-link form |

---

*End of document — see the repo for source of truth and `supabase/migrations/` for the authoritative schema.*
