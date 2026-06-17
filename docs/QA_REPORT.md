# QA report — Sensor Troubleshooting Hub

Date: 2026-06-17 · Branch: `qa/hardening`

## How this was tested
1. **Static gate** — `npm run build` (TypeScript `tsc -b` + Vite production build). PASS, 0 errors.
2. **Automated unit tests** — Vitest added (`npm test`). 26 tests across the deterministic core logic. PASS.
3. **Adversarial code audit** — four parallel reviews (auth, chat/RAG/tickets, viewer, mobile/a11y). Findings triaged below; real bugs fixed, false positives recorded.
4. **Manual test-case matrix** — flows that need a live signed-in browser (auth, RAG, etc.) are listed for you to confirm in production; logic behind them was code-reviewed.

---

## 1. Automated unit tests (26 — all pass)

`src/lib/__tests__/markdown.test.ts` (14)
- paragraphs, bold/italic, h2/h3, ordered & unordered lists, blockquote, hr, doc-note
- HTML escaping / XSS guard (`<script>` is neutralised)
- query highlighting wraps terms, doesn't corrupt tags, ignores ≤1-char terms
- `normalizeAnswerSteps`: splits inline `1. … 2. …`, splits after `[2].`, does NOT split decimals (`pH 4.0`), no-op on empty

`src/lib/__tests__/consolidated.test.ts` (12)
- `parseSections` empty + extraction; `renderSections` round-trip
- `replaceSection`, `appendSection` (separator + empty-section fill)
- `coverageOf`: zero / partial / complete
- `chunkSections`: short stays one chunk, long splits, no empty chunks

Run: `npm test`.

---

## 2. Audit findings & resolutions

| # | Area | Severity | Finding | Resolution |
|---|------|----------|---------|------------|
| 1 | Chat | MAJOR | Concurrent fast sends could swap answers under the wrong questions | **Fixed** — `sendingRef` guard + send button disabled while a turn is loading |
| 2 | Viewer | MAJOR | Find-in-page couldn't reach text inside focus-collapsed sections | **Fixed** — typing in find-in-page exits focus collapse (`userSearched`) so all sections render |
| 3 | Viewer | MAJOR | Toggling "General guidance" yanked the reader back to match #1 | **Fixed** — only auto-scroll when the query itself changes (`prevHighlight` ref) |
| 4 | Auth | MAJOR | `PASSWORD_RECOVERY` event could fire before the listener attached → reset link dead-ends | **Fixed** — `RecoveryGate` also checks `type=recovery` in the URL hash on mount |
| 5 | Feedback | MAJOR | `supabase.insert` returns `{error}` (doesn't throw); failures were shown as "noted" | **Fixed** — check returned `error` and log it |
| 6 | Viewer | MINOR | One-time deep-link scroll didn't reset on client-side nav to another citation | **Fixed** — reset `didInitialScroll` on `id`/`section` change |
| 7 | Chat | MINOR | Feedback widget kept stale "Thanks" state after a turn was re-answered (narrow-to-sensor) | **Fixed** — `key` on `AnswerFeedback` so it remounts per answer |
| 8 | Viewer | MINOR | Toolbar could overflow at XL text size / active search on ~360px | **Fixed** — toolbar row `flex-wrap`; match-nav buttons get `tap` |
| 9 | Mobile | MINOR | Modals used `vh` (iOS toolbar can hide the footer/submit) | **Fixed** — `max-h-[100dvh] sm:max-h-[..dvh]` on Upload & AddSensor modals |
| 10 | Mobile | MINOR | Modal close `×` and a few controls below 44px tap target | **Fixed** — `tap` + sizing on modal close, find-nav, "Incomplete only" |
| 11 | A11y | MINOR | Chat drawer didn't move focus into the dialog on open | **Fixed** — focus the close button on open (not the input, to avoid popping the mobile keyboard) |
| 12 | A11y | MINOR | Mobile menu stayed open behind the upload modal; desktop nav unlabeled | **Fixed** — close menu on Upload; `aria-label` on both navs |
| 13 | Admin | TRIVIAL | Dead `icon="⚙️"` prop on `PageHeader` | **Fixed** — removed |
| F1 | Chat/Viewer | — | "deep-link sends a human label not a section key" | **False positive** — `type_label`/`section` IS the work-type key (set in SQL `…section as type_label`); deep-links are correct |
| F2 | Auth | — | "`nav('/')` after sign-in races and bounces to /login" | **False positive** — `Protected` returns a Loading state while auth loads; it only redirects when `loading===false && !userId` |
| F3 | RLS | — | "ticket/feedback insert fails RLS" | **Not a defect** — BEFORE-INSERT trigger sets `user_id` before `WITH CHECK`; the whole app is auth-gated, so `auth.uid()` is always present |

### Deliberately not changed (documented, low value / higher risk)
- **OTP code email** depends on the Supabase "Magic Link" template containing `{{ .Token }}` — config, covered in [AUTH-SETUP.md](AUTH-SETUP.md), not a code change.
- **Full focus-trap** in the drawer/modals (Tab can still reach background) — would add complexity; focus-into-dialog + Esc + scroll-lock cover the common cases.
- **`applyHighlight` matching inside an HTML entity name** — extremely low likelihood (terms are alphanumeric, ≥2 chars); left as-is to avoid reworking the renderer.
- **Text-scale `xlarge` header crowding** — desktop nav is hidden on mobile and icons are fixed-px; acceptable.

---

## 3. Manual test-case matrix (verify in production)

These need a live signed-in session; the logic was code-reviewed and the build/typecheck passes.

| ID | Flow | Steps | Expected |
|----|------|-------|----------|
| A1 | Password sign-in | Enter work email + password → Sign in | Lands in app |
| A2 | One-time code | "Email me a code" → enter 6-digit code | Signed in (needs `{{ .Token }}` template) |
| A3 | Forgot password | Forgot → email link → set new password | RecoveryGate appears; password updates |
| A4 | Google | Continue with Google → choose account | Signed in; new user = viewer |
| C1 | Ask (RAG) | Ask "How do I clean the pH probe?" | Synthesized **Answer** + Sources |
| C2 | Sources | Click a source | Opens doc with answer-in-focus on the matched section |
| C3 | Feedback | Solved / Didn't help (+reason) | Recorded; "Didn't help" offers follow-up + ticket |
| C4 | Continue | "Ask a follow-up" | Input focuses; `continued=true` recorded |
| C5 | Ticket | "Log a ticket" → submit | Row in `support_tickets` |
| C6 | Rapid send | Send two questions quickly | Second is ignored until the first answers (no swap) |
| V1 | Find-in-page | Open doc, search a term in a collapsed section | Focus collapses off; term highlighted/navigable |
| V2 | General guidance | Toggle it mid-read | View does NOT jump to match #1 |
| M1 | Mobile | Each page on a phone | No horizontal scroll; chat header visible, input+send fit |
| M2 | A11y controls | Header ♿ → text size / high contrast | Applies + persists across reloads |
| AD1 | Admin | Users tab on mobile | Table scrolls horizontally inside its card |

---

## 4. Known external dependencies (not bugs)
- Supabase **Site URL / Redirect allow-list** must include the app URL (for OTP/reset/Google).
- Magic Link email template needs `{{ .Token }}` for the 6-digit code path.
- CustomerHub ticket push — parked, pending its API.
