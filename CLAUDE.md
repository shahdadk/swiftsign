# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Next dev server (port 3000).
- `npm run build` / `npm run start` — production build/start.
- `npm run lint` — ESLint (flat config via `eslint-config-next`). **No test suite exists** and there is no `typecheck` script; `tsc --noEmit` via the Next build is the only type check.
- `npx prisma generate` — regenerate the Prisma client into `src/generated/prisma/` (gitignored).
- `npx prisma migrate dev --name <slug>` — create/apply a migration. Config is `prisma.config.ts` (not the legacy `package.json#prisma` block); it loads `.env` via `dotenv/config`.
- `npx tsx prisma/seed.ts` — one-off seed (not wired into `package.json`; run manually).
- MCP package is a separate workspace: `cd mcp && npm install && npm run build` (own `node_modules`, own `tsconfig.json`, published to npm as `swiftsign-mcp`).
- **`.npmrc` pins `legacy-peer-deps=true`** — required for the React 19 / Next 16 / Prisma 7 preview combo. Plain `npm install` without it will fail peer resolution.

## Architecture

Three distinct surface areas on Next 16 App Router:

1. **Public REST API** — `src/app/api/v1/*`. Bearer-token auth (`Authorization: Bearer <apiKey>` → `User.apiKey`) via `authenticateApiKey` in `src/lib/auth.ts`. Entry point is `POST /api/v1/envelopes`.
2. **Signer flow** — `src/app/sign/[token]/*` (UI) + `src/app/api/sign/[token]/*` (mutations). No account; the recipient's `signingToken` is the only credential. Page PNGs are served via `/api/documents/[id]/pages/[page]?token=...`, which cross-checks the token against the document's envelope.
3. **Sender dashboard** — `src/app/dashboard/*`. Cookie session (`swiftsign_session`) gated by `src/middleware.ts` (the only middleware in the app; matcher is `/dashboard/:path*`).

### Signing pipeline (spans multiple files — read together)

- `POST /api/v1/envelopes` uploads PDFs to R2, renders every page to PNG via `renderPdfToImages`, optionally resolves anchor-based field positions via `findAnchorPosition`, then writes Envelope/Document/Recipient/Field rows in a transaction and emails the first routing-order signer with `sendSigningRequest`.
- `POST /api/sign/[token]` validates the recipient, writes field values + `RECIPIENT_SIGNED` audit, upserts a `SignatureAdoption` for reuse, then branches:
  - **All signers done** → `sealAndComplete` (`src/lib/seal-and-complete.ts`): downloads originals, `sealDocument` bakes values with `pdf-lib`, uploads to `sealed/{envId}/{name}`, `generateCertificate` produces the Certificate of Completion, status → `COMPLETED`, emails all parties.
  - **More signers pending** → `flattenForNextSigner` (`src/lib/flatten-between-signers.ts`): re-seals *only* completed fields, re-renders page PNGs, overwrites `imageKeys` so the next signer sees prior signatures already inline; then emails the next routing-order batch.

### Coordinate + indexing conventions (easy to get wrong)

- Field `x`, `y`, `width`, `height` are **percentages (0–100)** of page dimensions with **top-left origin** in the DB.
- `pdf-lib` uses **bottom-left origin** — `src/lib/seal.ts` flips Y as `pageHeight - absY - absHeight`. Any new PDF-writing code must do the same conversion.
- DB `Field.page` is **1-indexed**. `SealField.page` passed into `sealDocument` is **0-indexed** — callers subtract 1 (see `seal-and-complete.ts` and `flatten-between-signers.ts`).

### Auth

`src/lib/auth.ts` is a **custom** cookie + magic-link auth system that replaces NextAuth despite `next-auth` still being in `package.json` (`export const auth = getSession` is a compat shim for lingering imports — do not reintroduce real NextAuth flows without a wider refactor). Sessions live in the Prisma `Session` table, magic-link tokens in `VerificationToken`. API-key auth (for `/api/v1` and MCP) is an orthogonal path on `User.apiKey`.

### Storage (Cloudflare R2, S3-compatible)

All binary artifacts live in R2 via `@aws-sdk/client-s3`. **Never write to local disk at runtime.** Key conventions:

- `envelopes/{envId}/documents/{i}-{name}` — original PDFs.
- `envelopes/{envId}/pages/{docOrder}-{page}.png` — pre-rendered page images used by the signer UI.
- `sealed/{envId}/{name}` — final sealed PDFs.
- `certificates/{envId}/certificate.pdf` — Certificate of Completion.

### Server-side PDF rendering

`src/lib/pdf-renderer.ts` uses `pdfjs-dist/legacy/build/pdf.mjs` (ESM, loaded lazily) with a custom `NodeCanvasFactory` backed by `node-canvas`. `GlobalWorkerOptions.workerSrc` is set at runtime to the resolved path inside `node_modules` — don't externalize, bundle, or move the worker file. `next.config.ts` also raises `serverActions.bodySizeLimit` and `api.bodyParser.sizeLimit` to `50mb` so base64 PDF payloads fit; don't lower these without changing the upload shape.

### Prisma (v7 preview)

- Generated client is at `src/generated/prisma/` (gitignored). After any `schema.prisma` change, run `npx prisma generate`.
- **Import from `@/generated/prisma/client`, not `@prisma/client`** — for both the `PrismaClient` and types (`Prisma.TransactionClient`, model types, enums like `AuditEvent`). The `@prisma/client` path is not set up.
- DB connection uses the adapter pattern: `PrismaPg` from `@prisma/adapter-pg` wrapping the Neon `DATABASE_URL` — see `src/lib/db.ts`.

### MCP server (`mcp/`)

Independent npm package (`swiftsign-mcp`) with its own `package.json`, `tsconfig.json`, and `node_modules`. **Not part of the Next.js build.** It's a thin MCP wrapper that calls the public `/api/v1/*` endpoints with a user's API key, so changes to the v1 API shape are breaking changes for MCP consumers.
