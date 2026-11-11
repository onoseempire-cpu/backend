# Program Maker Analytical Viewer — Backend

A production-grade Node.js/TypeScript backend powering the PMAV Windows desktop application.
Uses a local **SQLite database** (no server installation required — works on every PC independently).

---

## 📁 Project Location
`C:\Users\ADMIN1\Desktop\pmav-backend\`

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
The `.env` file is pre-created from `.env.example`.
Review and update secrets before deploying to production:
```bash
# Edit .env — especially these before going live:
JWT_ACCESS_SECRET=      # At least 64 random characters
JWT_REFRESH_SECRET=     # Different from above, at least 64 chars
ENCRYPTION_KEY=         # Exactly 32 characters
```

### 3. Create the Database
```bash
# This creates the SQLite file (pmav-database.db) automatically
npm run prisma:push
```

### 4. Start Development Server
```bash
npm run dev
```
Server starts at: **http://localhost:5000**

---

## 🌐 API Base URL
```
http://localhost:5000/api/v1
```

---

## 📡 All API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/logout` | Logout |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET  | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/password-reset/request` | Request password reset |
| POST | `/api/v1/auth/password-reset/confirm` | Confirm password reset |
| GET  | `/api/v1/auth/verify-email?token=...` | Verify email |

### Integrations (OAuth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/integrations` | List connected accounts |
| GET | `/api/v1/integrations/status` | Connection status per provider |
| GET | `/api/v1/integrations/youtube-data/connect` | Connect YouTube Data API |
| GET | `/api/v1/integrations/youtube-analytics/connect` | Connect YouTube Analytics |
| GET | `/api/v1/integrations/youtube-reporting/connect` | Connect YouTube Reporting |
| GET | `/api/v1/integrations/adsense/connect` | Connect Google AdSense |
| GET | `/api/v1/integrations/google-analytics/connect` | Connect Google Analytics 4 |
| GET | `/api/v1/integrations/search-console/connect` | Connect Search Console |
| DELETE | `/api/v1/integrations/:accountId` | Disconnect account |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/overview` | Combined overview (all platforms) |
| GET | `/api/v1/analytics/youtube` | YouTube channel analytics |
| GET | `/api/v1/analytics/youtube/videos` | Video performance list |
| GET | `/api/v1/analytics/google-analytics` | GA4 property analytics |

**Query parameters supported:**
- `?period=30d` — `today`, `7d`, `28d`, `30d`, `90d`, `365d`, `this_month`, `last_month`, `this_year`
- `?channelId=UC...` — Filter by specific YouTube channel
- `?propertyId=properties/...` — Filter by GA4 property

### Indexer (AI Data Indexer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/indexer/start` | Start indexing job |
| GET  | `/api/v1/indexer/status` | Get current job status |
| GET  | `/api/v1/indexer/history` | Indexing job history |

**POST body:**
```json
{
  "jobType": "manual",
  "sources": ["youtube-data", "youtube-analytics", "google-analytics"]
}
```

### Crawler (AI Sync Crawler)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/crawler/start` | Start crawler |
| POST | `/api/v1/crawler/pause` | Pause crawler |
| POST | `/api/v1/crawler/resume` | Resume crawler |
| POST | `/api/v1/crawler/stop` | Stop crawler |
| GET  | `/api/v1/crawler/status` | Get crawler status |

### AI Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai/search` | Natural language search |
| GET  | `/api/v1/ai/search/history` | Search history |

**POST body:**
```json
{ "query": "How many subscribers did I gain this month?" }
```

**Example questions the AI search understands:**
- "How many views did I get last 30 days?"
- "What's my total watch time this year?"
- "Which videos have the most views?"
- "Compare my sessions this week vs last week"
- "What is my estimated revenue this month?"
- "What are my top traffic sources?"
- "How many subscribers did I gain this month?"
- "What's my average CTR?"
- "Show me my top 10 videos"
- "What's my engagement rate?"

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/v1/reports` | List reports |
| GET  | `/api/v1/reports/:reportId` | Get report by ID |
| POST | `/api/v1/reports/export` | Export report (JSON or CSV) |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET   | `/api/v1/notifications` | All notifications |
| GET   | `/api/v1/notifications/unread` | Unread only |
| PATCH | `/api/v1/notifications/:id/read` | Mark as read |
| POST  | `/api/v1/notifications/read-all` | Mark all as read |

---

## 🔌 Socket.IO Real-Time Events

Connect your frontend:
```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000', {
  auth: { token: accessToken }
});
```

**Events received from server:**
| Event | Description |
|-------|-------------|
| `connected` | Socket authenticated and ready |
| `account.connected` | OAuth account connected |
| `account.disconnected` | OAuth account disconnected |
| `analytics.updated` | Fresh analytics data available |
| `indexing.started` | Indexing job started |
| `indexing.progress` | Progress update `{ jobId, progress, step }` |
| `indexing.completed` | Indexing finished |
| `indexing.failed` | Indexing failed |
| `crawler.started` | Crawler started |
| `crawler.progress` | Crawler progress `{ jobId, progress, step }` |
| `crawler.completed` | Crawler finished |
| `crawler.failed` | Crawler failed |
| `notification.new` | New notification for user |

---

## 🗄️ Database

**Type:** SQLite (file-based, zero server setup)
**Location:** `pmav-database.db` in project root
**ORM:** Prisma

```bash
# View database in browser GUI
npm run prisma:studio

# Reset database (delete and recreate all tables)
npx prisma migrate reset

# Apply schema changes
npm run prisma:push
```

---

## 🔐 OAuth Providers Configured

| Provider | Client ID | Purpose |
|----------|-----------|---------|
| YouTube Data API v3 | `121502338820-q91d774...` | Channel info, videos |
| YouTube Analytics API | `121502338820-0nreaim...` | Watch time, views, subs |
| YouTube Reporting API | `121502338820-vg00ci3...` | Revenue, impressions |
| Google AdSense + GA + Search Console | `609875757928-4828m9u...` | Shared OAuth app |

> ⚠️ All OAuth callback URLs are set to `http://localhost:5000/...`
> You **must** add these redirect URIs to each Google Cloud Console project.

---

## 🏗️ Project Structure

```
src/
├── config/          # Environment, database, OAuth clients
├── controllers/     # HTTP request handlers
├── routes/          # Express router definitions
├── middleware/      # Auth, rate limiting, error handling, validation
├── services/        # Auth, tokens, encryption, notifications, email
├── integrations/
│   └── google/      # YouTube Data, Analytics, Reporting, AdSense, GA, Search Console
├── analytics/       # Analytics engines + growth/trend/comparison processors
├── ai/
│   └── search/      # NLP query parser, executor, response formatter
├── indexer/         # AI Indexer service + scheduler + normalizers
├── crawler/         # AI Crawler service + scheduler + connectors
├── sockets/         # Socket.IO server
├── utils/           # Logger, encryption, dates, pagination, API responses
└── types/           # Shared TypeScript interfaces
```

---

## 🖥️ Frontend Connection (React / Electron)

```typescript
// API base URL
const API_BASE = 'http://localhost:5000/api/v1';

// All requests need Authorization header
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}

// All responses follow:
// Success: { success: true, data: T, meta?: { page, limit, total, lastSync } }
// Error:   { success: false, error: { code: string, message: string } }
```

---

## 🔧 Production Deployment (Windows)

1. Build TypeScript:
   ```bash
   npm run build
   ```
2. Set `NODE_ENV=production` in `.env`
3. Use strong random secrets for JWT and encryption keys
4. Set up the OAuth redirect URIs in Google Cloud Console to point to your hosted URL
5. Run with:
   ```bash
   node dist/server.js
   ```

For Electron bundling, configure the API URL via environment variable so it can be switched between local and remote backend.

---

## ⚠️ Important Notes

1. **YouTube quota**: The YouTube Data API has a 10,000 unit/day quota. Syncing too many videos frequently may hit this limit.
2. **Revenue data**: Only available for monetized YouTube channels. The API will gracefully skip it if unavailable.
3. **Analytics delay**: Google reports data with a 24–48 hour delay. The API notes this in every response.
4. **OAuth consent screen**: Your Google Cloud projects must have the OAuth consent screen configured and the test users added during development.
