# Program Maker Analytical Viewer - Backend

A comprehensive backend API server for the Program Maker Analytical Viewer Windows desktop application.

## Technology Stack

- **Node.js** with TypeScript
- **Express.js** - REST API framework
- **PostgreSQL** - Database (with SQLite for local development)
- **Prisma ORM** - Database client
- **Redis** - Caching and session storage
- **BullMQ** - Background job processing
- **Socket.IO** - Real-time WebSocket communication
- **JWT** - Authentication
- **OAuth 2.0** - Third-party account integration

## Features

### Authentication System
- User registration with email verification
- Secure password hashing (bcrypt)
- JWT access tokens (15 minutes)
- Refresh tokens (7 days)
- Session management
- Password reset flow

### Account Integration Engine
Connect your external accounts through OAuth 2.0:

- **YouTube Data API v3** - Channel info, video listing
- **YouTube Analytics API** - Metrics (views, watch time, revenue, subscribers)
- **YouTube Reporting API** - Detailed monetization reports
- **Google AdSense API** - AdSense earnings and reporting
- **Google Analytics 4 Data API** - Website analytics
- **Google Search Console API** - SEO data, search queries

### Analytics Processing
- Daily, weekly, and monthly summaries
- Historical comparisons
- Growth calculations
- Trend analysis

### AI Indexer Engine
- Automatic data discovery
- Record normalization
- Duplicate removal
- Index maintenance

### Data Crawler Engine
- Scheduled synchronization
- Incremental updates
- Change detection
- Rate limit handling

### AI-Powered Search
Natural language queries:
- "How many subscribers did I gain this month?"
- "Which video generated the most revenue?"
- "Compare YouTube performance this week and last week"
- "What is my total watch time?"

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/refresh` - Refresh tokens
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/password-reset/request` - Request password reset
- `POST /api/v1/auth/password-reset/confirm` - Confirm password reset
- `GET /api/v1/auth/verify-email` - Verify email

### Integrations
- `GET /api/v1/integrations` - List connected accounts
- `GET /api/v1/integrations/status` - Get provider status
- `GET /api/v1/integrations/:provider/connect` - Get OAuth URL
- `GET /api/v1/integrations/:provider/callback` - OAuth callback
- `DELETE /api/v1/integrations/:accountId` - Disconnect account

### Analytics
- `GET /api/v1/analytics/overview?period=30d` - Dashboard overview
- `GET /api/v1/analytics/youtube?period=30d` - YouTube channel analytics
- `GET /api/v1/analytics/youtube/videos` - YouTube video performance
- `GET /api/v1/analytics/google-analytics?period=30d` - GA4 property analytics

### Indexer
- `POST /api/v1/indexer/start` - Start manual indexing
- `GET /api/v1/indexer/status` - Get indexing status
- `GET /api/v1/indexer/history` - Get indexing history

### Crawler
- `POST /api/v1/crawler/start` - Start crawler
- `POST /api/v1/crawler/pause` - Pause crawler
- `POST /api/v1/crawler/resume` - Resume crawler
- `POST /api/v1/crawler/stop` - Stop crawler
- `GET /api/v1/crawler/status` - Get crawler status

### AI Search
- `POST /api/v1/ai/search` - Natural language search
- `GET /api/v1/ai/search/history` - Search history

### Reports
- `GET /api/v1/reports` - List reports
- `POST /api/v1/reports/export` - Export report

### Notifications
- `GET /api/v1/notifications` - List notifications
- `GET /api/v1/notifications/unread` - Get unread notifications
- `PATCH /api/v1/notifications/:id/read` - Mark as read

## Setup Instructions

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Prisma CLI

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd pmav-backend

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### Environment Configuration

Edit `.env` with your OAuth credentials:

```bash
# JWT Secrets
JWT_ACCESS_SECRET=<your-access-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>
ENCRYPTION_KEY=<32-char-hex-string>

# Google OAuth Credentials
YOUTUBE_DATA_CLIENT_ID=...
YOUTUBE_DATA_CLIENT_SECRET=...
YOUTUBE_ANALYTICS_CLIENT_ID=...
YOUTUBE_ANALYTICS_CLIENT_SECRET=...
GOOGLE_ADSENSE_CLIENT_ID=...
GOOGLE_ADSENSE_CLIENT_SECRET=...
GOOGLE_ANALYTICS_CLIENT_ID=...
GOOGLE_ANALYTICS_CLIENT_SECRET=...
GOOGLE_SEARCH_CONSOLE_CLIENT_ID=...
GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET=...

# Redirect URIs
YOUTUBE_DATA_REDIRECT_URI=http://localhost:5000/api/v1/integrations/youtube-data/callback
# ... similar for other providers
```

### Database Setup (SQLite for development)

```bash
# Generate Prisma client
npx prisma generate

# Push database schema (creates SQLite file)
npx prisma db push

# Optional: Open Prisma Studio
npx prisma studio
```

### Development

```bash
# Start development server
npm run dev

# Server will run at http://localhost:5000
# API base: http://localhost:5000/api/v1
```

### Production

```bash
# Build TypeScript
npm run build

# Start server
npm start
```

## OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - YouTube Data API v3
   - YouTube Analytics API
   - YouTube Reporting API
   - Google Analytics Data API
   - Google AdSense Management API
   - Search Console API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:5000/api/v1/integrations/youtube-data/callback`
     - `http://localhost:5000/api/v1/integrations/youtube-analytics/callback`
     - `http://localhost:5000/api/v1/integrations/adsense/callback`
     - `http://localhost:5000/api/v1/integrations/google-analytics/callback`
     - `http://localhost:5000/api/v1/integrations/search-console/callback`
5. Copy client ID and secret to `.env`

## WebSocket Events

The backend uses Socket.IO for real-time updates:

- `account.connected` - New account connected
- `account.disconnected` - Account disconnected
- `analytics.updated` - Analytics data refreshed
- `indexing.started` - Indexing job started
- `indexing.progress` - Indexing progress update
- `indexing.completed` - Indexing completed
- `crawler.started` - Crawler started
- `crawler.progress` - Crawler progress update
- `crawler.completed` - Crawler completed
- `crawler.failed` - Crawler failed

## Security Notes

- OAuth tokens are encrypted with AES-256-GCM
- Passwords are hashed with bcrypt (12 rounds)
- JWT tokens have short expiration (15 minutes for access, 7 days for refresh)
- Rate limiting is enabled on all endpoints
- CORS is configured for Electron app origins
- Audit logs are written for sensitive operations

## Windows Deployment

### Local Backend Service
The backend can run as a local service alongside the Electron desktop app:
- Uses local SQLite database
- No external dependencies
- Configured via `.env` file

### Remote Hosted Service
For multi-device sync:
- PostgreSQL database
- Environment variable configuration
- CORS configured for your domain

## API Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "lastSync": "2024-01-15T10:00:00.000Z",
    "reportingDelay": "Up to 48 hours"
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

## License

MIT License