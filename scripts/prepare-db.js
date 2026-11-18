const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load environment variables from .env if present
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch (_) {}

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('[DB Setup] schema.prisma not found at', schemaPath);
  process.exit(0);
}

let schema = fs.readFileSync(schemaPath, 'utf8');

// Also remove any invalid "version" line in generator if present
schema = schema.replace(/\s*version\s*=\s*"[^"]*"/g, '');

function sanitizeDatabaseUrl(raw) {
  if (!raw) return 'file:./pmav-database.db';
  let url = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (!url) return 'file:./pmav-database.db';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return url;
  }
  if (url.startsWith('sqlite:')) {
    return 'file:' + url.slice(7);
  }
  if (url.startsWith('file:')) {
    return url;
  }
  console.warn(`[DB Setup] Notice: '${raw}' is not a valid URL. Defaulting to file:./pmav-database.db`);
  return 'file:./pmav-database.db';
}

const dbUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
process.env.DATABASE_URL = dbUrl;

const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
const targetProvider = isPostgres ? 'postgresql' : 'sqlite';

console.log(`[DB Setup] Database type detected: ${isPostgres ? 'PostgreSQL' : 'SQLite'} (${dbUrl.slice(0, 15)}...)`);

const providerMatch = schema.match(/datasource\s+db\s+\{[^}]*provider\s*=\s*"(sqlite|postgresql)"/s);
const currentProvider = providerMatch ? providerMatch[1] : null;

if (currentProvider && currentProvider !== targetProvider) {
  console.log(`[DB Setup] Switching datasource provider from "${currentProvider}" to "${targetProvider}"...`);
  schema = schema.replace(
    /(datasource\s+db\s+\{[^}]*provider\s*=\s*")(sqlite|postgresql)(")/s,
    `$1${targetProvider}$3`
  );
  fs.writeFileSync(schemaPath, schema, 'utf8');
} else {
  fs.writeFileSync(schemaPath, schema, 'utf8');
}

// Generate client for the active database provider
try {
  console.log('[DB Setup] Running prisma generate...');
  execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  // If running in production with postgres, ensure tables exist
  if (isPostgres && process.env.NODE_ENV === 'production') {
    try {
      console.log('[DB Setup] Auto-syncing PostgreSQL tables with prisma db push...');
      execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    } catch (pushErr) {
      console.warn('[DB Setup] db push notice (proceeding):', pushErr.message);
    }
  }
} catch (err) {
  console.error('[DB Setup] Prisma generation error:', err.message);
}
