export interface Config {
  nodeEnv: string;
  port: number;
  database: {
    url: string;
  };
  redis: {
    url: string;
    password?: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  oauth: {
    youtube: {
      clientId: string;
      clientSecret: string;
      analyticsClientId: string;
      analyticsClientSecret: string;
      reportsClientId: string;
      reportsClientSecret: string;
      callbackUrl: string;
    };
    google: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  };
  frontend: {
    url: string;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  socketIo: {
    corsOrigin: string;
  };
}

const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || '',
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  oauth: {
    youtube: {
      clientId: process.env.YOUTUBE_CLIENT_ID || '',
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
      analyticsClientId: process.env.YOUTUBE_ANALYTICS_CLIENT_ID || '',
      analyticsClientSecret: process.env.YOUTUBE_ANALYTICS_CLIENT_SECRET || '',
      reportsClientId: process.env.YOUTUBE_REPORTS_CLIENT_ID || '',
      reportsClientSecret: process.env.YOUTUBE_REPORTS_CLIENT_SECRET || '',
      callbackUrl: process.env.YOUTUBE_CALLBACK_URL || '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_ANALYTICS_CALLBACK_URL || '',
    },
  },
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  socketIo: {
    corsOrigin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:3000',
  },
};

// Validate required config
const requiredConfig = [
  'jwt.accessSecret',
  'jwt.refreshSecret',
  'database.url',
];

const validate = (path: string): string => {
  const parts = path.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return path;
    }
  }
  return '';
};

for (const key of requiredConfig) {
  const missing = validate(key);
  if (missing) {
    console.warn(`Warning: Missing required config: ${missing}`);
  }
}

export default config;