# Program Maker Analytical Viewer - Backend Development

## Technology Stack
- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Web Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Caching/Jobs**: Redis with BullMQ
- **Real-time**: Socket.IO
- **Auth**: JWT + OAuth 2.0
- **Security**: Helmet, CORS, Rate Limiting, Zod validation

## Project Structure
```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── routes/           # API route definitions
├── middleware/       # Express middleware
├── services/         # Business logic services
├── integrations/     # External API integrations
├── analytics/        # Analytics processing
├── ai/               # AI search and indexing
├── indexer/          # Indexing engine
├── crawler/          # Data crawler
├── workers/          # Background job workers
├── jobs/             # Job definitions
├── database/         # Database setup
├── sockets/          # Socket.IO handlers
├── utils/            # Utility functions
├── types/            # TypeScript types
└── index.ts          # Application entry point
```

## API Base URL
- Development: `http://localhost:5000/api/v1`
- Production: Configurable via environment

## OAuth 2.0 Client Credentials

### YouTube Integrations
- **YouTube Data API v3**: Client ID: `121502338820-q91d774cgi208u8r1bsde3sivvna0p93.apps.googleusercontent.com`
- **YouTube Analytics API**: Client ID: `121502338820-0nreaimcsmnnlos5emn3h74uk6mevmbs.apps.googleusercontent.com`
- **YouTube Reports**: Client ID: `121502338820-vg00ci3n5em10ibkd43fsmqfkdscnu0n.apps.googleusercontent.com`

### Google Integrations
- **Google AdSense**: Client ID: `609875757928-4828m9uhibj2ruhioote5925ttp9hp7v.apps.googleusercontent.com`
- **Google Search Console**: Configured via Maven dependency
- **Google Analytics**: Uses Analytics Data API

## Security Notes
- All OAuth secrets stored in `.env` file
- Access tokens encrypted in database
- User data isolation enforced at all layers
- No production secrets in source code