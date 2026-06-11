# DigitalPaani Sensor Troubleshooting Hub — Product Requirements Document

| Field | Value |
| --- | --- |
| **Product** | DigitalPaani Sensor Troubleshooting Hub |
| **Owner** | Mihir Sethi (mihir.sethi@digitalpaani.com) |
| **Status** | v1.0 — describes the product as currently live |
| **Last updated** | 2026-06-11 |
| **Live URL** | https://mihirsethidp.github.io/InternalTool/ |

---

## 1. Product Definition

An internal, operator-centric tool for diagnosing and resolving sensor issues at wastewater treatment plants. Users describe a problem in their own words — through an assistant or a search bar — and receive verified troubleshooting steps, manuals, datasheets, and maintenance procedures drawn from a curated, admin-approved documentation library.

The product is **not** a general document store. Every capability exists to answer one question quickly: *"This sensor is misbehaving on site — what do I do?"*

### 1.1 Problem statement

1. Sensor documentation is fragmented and unverified; operators escalate to senior engineers for problems that are answered in a manual nobody can find.
2. Documentation arrives from vendors in inconsistent shapes — or not at all — and there is no quality gate between "someone uploaded a file" and "the team relies on it."
3. Operators search in natural language ("reading is drifting," "shows zero despite flow") while documents use vendor terminology; literal search fails them.
4. The field workforce works in many Indian languages; an English-only interface limits adoption.

### 1.2 Product principles

- **Troubleshooting first.** The assistant and problem-oriented entry points take visual and navigational priority over browsing.
- **Verified content only.** Nothing reaches the searchable library without an admin's explicit approval.
- **One reference per sensor.** Each sensor model has a single consolidated reference assembled from approved submissions, so there is exactly one place to look.
- **Graceful degradation.** When the library has no answer, the tool says so honestly and routes the user outward (web search) or forward (documentation procurement playbook) — never a dead end.

---

## 2. Users & Roles

### 2.1 Personas

| Persona | Primary need | Typical role |
| --- | --- | --- |
| **Plant operator / field engineer** | Diagnose a misbehaving sensor on site, in their preferred language, fast | Viewer |
| **Monitoring team** | Check expected behaviour, ranges, and error meanings while watching remote data | Viewer |
| **Domain engineer** | Contribute vendor documents and field knowledge to the library | Uploader (maker) |
| **Admin / senior engineer** | Guard library quality: review, correct, merge, and structure content | Admin (checker) |

### 2.2 Role capability matrix

| Capability | Viewer | Uploader | Admin |
| --- | --- | --- | --- |
| Search, browse, open documents | ✔ | ✔ | ✔ |
| Use the assistant | ✔ | ✔ | ✔ |
| Switch interface language | ✔ | ✔ | ✔ |
| Edit own profile (display name) | ✔ | ✔ | ✔ |
| Submit documents for review | — | ✔ | ✔ |
| Track own submissions and reviewer feedback | — | ✔ | ✔ |
| Add a sensor (make / model) to the catalog | — | ✔ | ✔ |
| Review, edit, approve, reject submissions | — | — | ✔ |
| Edit consolidated references directly | — | — | ✔ |
| Manage users (assign roles) | — | — | ✔ |
| Manage document types | — | — | ✔ |
| Change another user's role | — | — | ✔ |
| Change own role | — | — | — (blocked for all) |

- Sign-in is passwordless (email magic link). A first sign-in creates a profile with the Viewer role.
- Admins may approve their own submissions (single-admin teams must not deadlock). Every decision records who made it.

---

## 3. Scope

### 3.1 In scope (current)

1. Sensor-related documentation for the catalogued makes and models.
2. A two-sensor pilot with complete documentation: **UPC UPCS-MAG-110** (electromagnetic flow meter) and **Advance Analytik OCEMS** (multi-parameter water quality). The catalog accepts unlimited additional sensors.
3. A maker-checker workflow as the only path for content to enter the library.
4. Keyword search with synonym expansion and typo tolerance; an assistant interface over the same library.
5. Interface localisation in 8 languages: English, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada.
6. A documentation-completeness model per sensor with a step-by-step procurement playbook for filling gaps.

### 3.2 Out of scope (current)

- Plant / equipment management and plant-specific document types (handover packets, P&IDs, I/O lists, warranty certificates).
- AI-synthesised answers (assistant currently retrieves and cites; it does not compose prose answers).
- Translation of document *content* (interface only; content translation is planned, not live).
- In-app web search results (zero-result states link out to a prepared Google search instead).
- Document versioning, audit logs, and per-document access control.
- External (client) access of any kind.

---

## 4. Functional Requirements

### 4.1 Home (entry experience)

- **FR-H1** The landing page must present troubleshooting as the primary action: an assistant call-to-action visually dominant over the search field.
- **FR-H2** The assistant CTA must include tappable, operator-phrased problem prompts (e.g. "Flow meter shows zero despite flow") that open the assistant with that question already asked.
- **FR-H3** A secondary free-text search field must search the full documentation library as the user types.
- **FR-H4** Pilot sensors (catalog entries flagged as pilots) must be displayed as quick-entry tiles that open the sensor's documentation page.
- **FR-H5** The most recently updated sensor references must be listed and openable.
- **FR-H6** A zero-result search must offer two recoveries: ask the assistant the same question, or open a pre-built web search in a new tab.

### 4.2 Search behaviour

- **FR-S1** Search must match word prefixes ("Hydro" matches Hydrogen, Hydrostatic).
- **FR-S2** Search must expand domain synonyms (e.g. "leak" also matches leakage / spillage / seepage; "H2S" also matches hydrogen sulfide / rotten egg). The synonym dictionary is admin-maintainable data, not code.
- **FR-S3** When a query returns nothing, the system must retry with fuzzy (typo-tolerant) matching and visibly mark such results as approximate.
- **FR-S4** Each search result represents one sensor's consolidated reference exactly once — never multiple rows per sensor — and shows: sensor make + model, the matching section (e.g. Troubleshooting Steps), and a text snippet centred on the match with the query terms highlighted.
- **FR-S5** Highlighting must mark only words that actually satisfy the match (prefix-consistent), never unrelated words.
- **FR-S6** Opening a result must land the user inside the document with the searched phrase highlighted and scrolled into view.

### 4.3 Assistant

- **FR-A1** The assistant must be reachable from every page via a persistently visible, labelled launcher.
- **FR-A2** The assistant accepts natural-language questions; common stopwords must not prevent matching ("how do I clean the probe" must work).
- **FR-A3** Responses present up to 5 cited references, each showing the sensor, the matching section, and a highlighted snippet; selecting one opens the document with highlights.
- **FR-A4** An empty assistant shows suggested operator-phrased prompts.
- **FR-A5** A no-match response must say so plainly and offer a prepared web search.
- **FR-A6** Any surface in the product may open the assistant pre-seeded with a question.
- **FR-A7** The conversation is clearable; it does not persist across sessions.

### 4.4 Sensor catalog

- **FR-C1** The catalog lists sensor models grouped by category, with combined search plus independent Category / Make / Model filters; Model choices narrow to the selected Make.
- **FR-C2** Uploaders and admins may add a sensor via a single form: make (selecting an existing make or creating a new one by typing it), category, model number, optional description and vendor URL.
- **FR-C3** Selected sensors may be flagged as pilots; pilots surface on the home page.
- **FR-C4** Each sensor page presents its documentation (see 4.6) and its documentation-completeness status (see 4.7).

### 4.5 Content lifecycle (maker-checker)

**Submission (maker):**
- **FR-M1** Upload is available from a global header action to uploaders and admins only, accepting PDF, Word, Excel, and image files.
- **FR-M2** The submission form requires a document type and the sensor (make → model) it belongs to; title pre-fills from the filename and remains editable; recently used types and makes are offered as one-tap chips.
- **FR-M3** Document types are: Sensor Manual, Installation Guide, Troubleshooting Steps, Technical Data Sheet, Calibration Procedure, Cleaning & Maintenance, Spares & Consumables List, PPM Schedule, Wiring & Communication, Safety & Handling. Admins can add more.
- **FR-M4** If the sensor doesn't exist yet, the maker can create it inline without leaving the upload flow.
- **FR-M5** On submission the document's text is extracted and stored for the checker to review and edit; the submission enters a Pending state.
- **FR-M6** Makers see all their submissions with status (Pending / Approved / Rejected), filterable, including the reviewer's note on decided items.

**Review (checker):**
- **FR-R1** Admins see a review queue filtered by status, with a visible count of pending items from anywhere in the admin area.
- **FR-R2** The review screen shows the original file and the extracted text side by side; the checker may edit the text before deciding.
- **FR-R3** The system must flag likely duplicates: passages of the submission that materially overlap existing content for the same sensor, with a similarity percentage and the overlapping section identified.
- **FR-R4** Approval requires choosing the target section and a merge mode — **Replace** the section or **Append** to it (appends are marked with source and date) — plus an optional note to the maker.
- **FR-R5** Approval merges the (possibly edited) text into the sensor's consolidated reference and makes it searchable immediately.
- **FR-R6** Rejection requires nothing but permits a note; the uploaded file is permanently deleted, and the submission record retains the decision and note.
- **FR-R7** Both decisions notify the maker (see 4.8); new submissions notify all admins.

### 4.6 Document consumption

- **FR-D1** A sensor's documentation page defaults to a **Documents** view: the original approved files grouped under their category headings, each opening the actual file.
- **FR-D2** A **Consolidated** view is available on demand: the merged reference, organised into the section taxonomy, rendered as a formatted document (headings, lists, emphasis, provenance callouts for appended content).
- **FR-D3** Arriving from search or the assistant opens the Consolidated view directly so the highlight lands on the matched text.
- **FR-D4** The Consolidated view provides: section navigation that tracks the reader's position, an in-document highlight box, a match counter with previous / next controls that jump between occurrences, and access to the original files.
- **FR-D5** Admins can edit any section of the consolidated reference in a rich-text editor (formatting: headings, bold/italic, lists, quotes, links, undo/redo); saving updates search immediately.
- **FR-D6** All stored files are private; access is via expiring links only.

### 4.7 Documentation completeness

- **FR-DC1** Each sensor displays a checklist of eight core categories (Troubleshooting, Manual, Installation, Datasheet, Calibration, Cleaning, Spares, PPM), each marked covered or missing, with an overall score (e.g. 5/8).
- **FR-DC2** A category counts as covered if it has at least one approved original document or consolidated content.
- **FR-DC3** Incomplete sensors link to a **procurement playbook**: a six-step ordered guide for sourcing missing documentation (OEM website → vendor/distributor email with a ready template → internal procurement records → on-site capture of nameplate/manuals → compilation from public sources → verification and approval). Each step states the action and a practical tip.

### 4.8 Notifications

- **FR-N1** Every user has an in-app notification bell with an unread count, updating in real time without a page refresh.
- **FR-N2** Events: new submission (to all admins), submission approved (to the maker), submission rejected with reason (to the maker).
- **FR-N3** Opening a notification marks it read and navigates to the relevant place (admins → the submission's review screen; makers → their submissions list). A mark-all-read action exists.
- **FR-N4** Notifications are private to their recipient.

### 4.9 Localisation

- **FR-L1** The interface is available in English, Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, and Kannada.
- **FR-L2** Language is user-selectable from the account menu and persists across sessions on that device.
- **FR-L3** Localised surfaces: navigation, home, the assistant, and the document viewer chrome. Admin and upload workflows are intentionally English-only.
- **FR-L4** Document content renders in its stored language regardless of interface language. (Content translation is a planned, not current, capability.)

### 4.10 Administration

- **FR-AD1** A single admin area contains, as tabs: the Review queue (with pending badge), the index of consolidated references, user management, and document-type management.
- **FR-AD2** User management lists everyone who has signed in and allows role changes between Viewer / Uploader / Admin.
- **FR-AD3** Document-type management allows adding new types (label + key); new types appear in the upload form immediately.
- **FR-AD4** No user — including admins — can change their own role through the product.

### 4.11 Account

- **FR-P1** Users can set a display name; email and role are visible but read-only.
- **FR-P2** The account menu shows identity (name, email, role), and houses profile editing, language selection, and sign-out.

---

## 5. Non-Functional Requirements

### 5.1 Security & access
- **NFR-1** All data access is authenticated; row-level authorisation enforces the role matrix in §2.2 at the data layer, not just the interface.
- **NFR-2** Files are never publicly addressable; retrieval links expire within minutes.
- **NFR-3** Rejected files are deleted from storage, not merely hidden.

### 5.2 Performance
- **NFR-4** Search results return within 500 ms at the current corpus scale; the interface searches as the user types.
- **NFR-5** Opening a document from search lands on the highlighted match without perceptible delay after content render.

### 5.3 Reliability & integrity
- **NFR-6** Repeating the same search yields the same results in the same order.
- **NFR-7** An approval is atomic from the user's perspective: after the confirmation, the content is in the reference and findable; a failure leaves the submission pending.
- **NFR-8** Search indexing is derived data: any edit to a consolidated reference re-derives it; the reference text is the single source of truth.

### 5.4 Usability
- **NFR-9** Visual system follows the DigitalPaani brand (primary #193458), with one consistent component per pattern: one filter toolbar, one segmented status control, one card style, one icon family (no emoji in product chrome).
- **NFR-10** The assistant launcher remains visible on every page without obscuring content.
- **NFR-11** All states are honest: empty, loading, no-match, approximate-match, and not-translated states are explicit, never blank.

---

## 6. Content Taxonomy

### 6.1 Section taxonomy (consolidated references)

Ordered by operator priority: **Troubleshooting Steps · Sensor Manual · Installation Guide · Technical Data Sheet · Calibration Procedure · Cleaning & Maintenance · Spares & Consumables · PPM Schedule · Wiring & Communication · Safety & Handling · Other**

### 6.2 Document type → section mapping

Every document type maps to exactly one section; the maker's type choice pre-selects the checker's target section (the checker may override at approval).

### 6.3 Synonym dictionary (search)

Curated equivalence groups across four domains: fault vocabulary (drift/offset/wrong-reading; noise/unstable/erratic; leak family; fouling family; poisoning family), maintenance verbs (clean, calibrate, repair, install, troubleshoot, verify), hardware nouns (sensor/probe/transmitter; cable/wiring/terminal; power/supply), and parameter aliases (pH, ORP/redox, DO/dissolved oxygen, EC/conductivity, TDS, H2S/hydrogen sulfide). Multi-word phrases are first-class synonyms.

---

## 7. Key Flows (acceptance narrative)

1. **Operator with a fault:** opens the tool → taps a problem prompt or types the issue in the assistant → receives cited references → opens one → reads the matched troubleshooting passage highlighted in context → done without escalation.
2. **Maker contributing:** taps Upload → drops a vendor PDF → picks type and sensor (creating the sensor inline if needed) → submits → tracks status under Uploads → receives a notification with the decision and any note.
3. **Checker reviewing:** sees the pending badge → opens the submission → reads duplicate warnings → edits extracted text → approves into Calibration Procedure as Replace → maker is notified; content is immediately searchable.
4. **Incomplete sensor:** any user opens a sensor showing 3/8 documentation → follows the playbook link → executes the procurement steps → resulting files enter via flow 2.

---

## 8. Success Metrics

| Metric | Definition | Target |
| --- | --- | --- |
| Time-to-answer | Median time from query to opening the matched passage | < 30 s |
| Assistant adoption | Share of sessions using the assistant | > 50% |
| Zero-result rate | Queries returning nothing (after synonym + fuzzy) | < 15%, trending down |
| Review latency | Median pending → decision time | < 48 h |
| Pilot completeness | Documentation score of both pilot sensors | 8/8 maintained |
| Non-English usage | Sessions in a non-English interface language | tracked; growth expected |

---

## 9. Open Questions

1. Should viewers be allowed to *suggest* corrections to consolidated content (a lightweight feedback loop) without uploader rights?
2. When content translation ships, is machine translation acceptable for safety-relevant sections, or do those require human verification?
3. Should the documentation-completeness score gate anything (e.g. a sensor cannot be marked "pilot" below 8/8), or remain informational?
4. At what catalog size does the two-level Make → Model navigation need a search-first redesign?

---

*This PRD describes the product as it exists today. Planned-but-dormant capabilities (AI-synthesised answers, document content translation, in-app web results) are intentionally excluded from requirements and listed only as out of scope.*
