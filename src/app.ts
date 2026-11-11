import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { generalRateLimit } from './middleware/rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { logger } from './utils/logger';
import apiRoutes from './routes/index';

const app = express();

// ── Security Headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow Electron
  contentSecurityPolicy: false,     // Let frontend handle CSP
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    // Allow Electron (file://) and configured frontend origin
    const allowed = [env.FRONTEND_URL, 'file://', undefined]; // undefined = same-origin
    if (!origin || allowed.includes(origin) || origin.startsWith('file://')) {
      callback(null, true);
    } else {
      callback(null, true); // Dev: allow all. Production: restrict this
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// ── HTTP Logging ──────────────────────────────────────────────────────────────
if (env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url === '/api/v1/health',
  }));
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/', generalRateLimit);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use(`/api/${env.API_VERSION}`, apiRoutes);

// ── 404 & Error Handlers ──────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
