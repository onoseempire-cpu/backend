import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

// Ensure logs directory exists
const logDir = path.dirname(env.LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${ts}] ${level}: ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), consoleFormat),
    }),
    new winston.transports.File({
      filename: env.LOG_FILE,
      format: json(),
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: env.LOG_FILE.replace('.log', '-errors.log'),
      level: 'error',
      format: json(),
    }),
  ],
});

export default logger;
