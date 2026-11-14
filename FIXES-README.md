# PMAV backend source fixes

This archive contains the complete `src/` tree from the supplied `src.zip`, with targeted TypeScript and API integration fixes.

## Apply
1. Back up your existing backend `src/` directory.
2. Replace it with the `src/` directory in this archive.
3. Keep your existing `prisma/`, `package.json`, lockfile, `tsconfig.json`, and deployment settings.
4. Regenerate Prisma Client using your project scripts (or `npx prisma generate`).
5. Run `npm run build` locally before pushing to Render.

## Main changes
- Corrected relative imports for analytics, crawler, indexer, Google integration, OAuth, and AI search modules.
- Fixed the crawler's undefined `progressPercent` shorthand.
- Exported `QueryResult` from the query executor and made the parser return its declared `ParsedQuery` type.
- Reworked AI query execution to use the actual `GoogleAnalyticsMetric` Prisma model instead of reading non-existent columns from `AnalyticsMetric`.
- Corrected Google Analytics Data API and Search Console request payload shapes.
- Reworked YouTube Analytics metric persistence to write only fields present in `YouTubeChannelMetric` in the supplied Prisma schema.
- Fixed Nodemailer namespace typing and safe Socket.IO event payload spreading.
- Added the missing `googleapis` import in the AdSense service.

## Important limitations
- The upload did not include `package.json`, the lockfile, or `tsconfig.json`, so a full `npm run build` could not be run against the actual dependency versions.
- AdSense still contains a placeholder publisher account ID and a TODO for persistence; that integration needs real account discovery and storage work before it can sync production data.
- Search Console currently fetches rows but does not persist them (the original source had a TODO).
- The supplied Prisma schema is SQLite-based. Ensure Render uses a persistent disk for SQLite, or migrate to PostgreSQL if your deployment requires managed database durability/concurrency.

## Credential security
Do not deploy or commit the uploaded `.env`. It contained credentials/secrets. Rotate the Google OAuth client secrets and replace JWT/encryption secrets before deploying; update Render environment variables with the new values.
