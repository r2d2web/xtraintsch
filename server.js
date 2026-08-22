// ═══════════════════════════════════════════════════════════════════════════
//  Ledger — Parent Portal
//  Read-only companion app: parents sign in to view their ward's fee status
//  and payment history. No write/edit capability exists anywhere in this app.
//
//  Data sources:
//   1. data/parents.json     — plaintext login list, mapping parents to a
//                               student ID from the main Ledger app.
//   2. data/backup.lbak       — a passphrase-protected backup exported from
//                               the main Ledger app ("Backup All Data").
//                               This portal decrypts it in memory to read
//                               student fee/payment records. It never writes
//                               to this file.
//   3. data/portal-config.json — local server config (port, backup file
//                               name/passphrase, fallback school name).
// ═══════════════════════════════════════════════════════════════════════════

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const DATA_DIR   = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

const CONFIG_FILE  = path.join(DATA_DIR, 'portal-config.json');
const PARENTS_FILE = path.join(DATA_DIR, 'parents.json');

// ─── CONFIG ───────────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    console.error(`Could not read ${CONFIG_FILE}. Create it from portal-config.example.json.`);
    process.exit(1);
  }
}
const CONFIG = loadConfig();
const PORT   = CONFIG.port || 3003;
const BACKUP_FILE = path.join(DATA_DIR, CONFIG.backupFile || 'backup.lbak');

// ─── PARENTS (plaintext credentials, as requested) ────────────────────────────
// Each entry: { "username": "...", "password": "...", "parentName": "...",
//               "studentIds": ["STU-xxxx", ...] }
// SECURITY NOTE: these passwords are stored in plaintext by design for this
// project. See README.md for the trade-offs and an easy upgrade path
// (the main Ledger app already shows the salted-hash pattern to copy).
function loadParents() {
  try {
    return JSON.parse(fs.readFileSync(PARENTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// ─── BACKUP (.lbak) DECRYPTION ────────────────────────────────────────────────
// Mirrors the version-2 backup format written by the main Ledger app's
// POST /api/backup endpoint: magic 'LBAK' + version byte + 16-byte salt +
// 12-byte IV + 16-byte GCM auth tag + ciphertext, key derived from a
// passphrase with scrypt.
const ALGO            = 'aes-256-gcm';
const SCRYPT_KEYLEN    = 32;
const SCRYPT_OPTS      = { N: 16384, r: 8, p: 1 };

function deriveKeyFromPassphrase(passphrase, salt) {
  return crypto.scryptSync(passphrase, salt, SCRYPT_KEYLEN, SCRYPT_OPTS);
}

let _backupCache = { mtimeMs: 0, payload: null };

function loadBackupData() {
  let stat;
  try {
    stat = fs.statSync(BACKUP_FILE);
  } catch {
    throw new Error(
      `No backup file found at data/${path.basename(BACKUP_FILE)}. ` +
      `Export a backup from the main Ledger app ("Settings → Backup All Data") ` +
      `and place it there.`
    );
  }

  // Re-decrypt only if the file has changed since we last read it, so a
  // freshly dropped-in backup is picked up automatically without a restart.
  if (_backupCache.payload && _backupCache.mtimeMs === stat.mtimeMs) {
    return _backupCache.payload;
  }

  const blob = fs.readFileSync(BACKUP_FILE);
  if (blob.length < 5 || blob.slice(0, 4).toString() !== 'LBAK') {
    throw new Error('The backup file is not a valid Ledger .lbak file.');
  }
  const version = blob[4];
  if (version !== 2) {
    throw new Error('This portal only supports passphrase-protected (v2) .lbak backups.');
  }
  if (blob.length < 5 + 16 + 12 + 16) {
    throw new Error('The backup file is corrupted or incomplete.');
  }

  const salt = blob.slice(5, 21);
  const iv   = blob.slice(21, 33);
  const tag  = blob.slice(33, 49);
  const ct   = blob.slice(49);
  const key  = deriveKeyFromPassphrase(CONFIG.backupPassphrase || '', salt);

  let payload;
  try {
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    payload = JSON.parse(plain.toString('utf8'));
  } catch {
    throw new Error(
      'Could not decrypt the backup file — check that backupPassphrase in ' +
      'portal-config.json matches the passphrase used when the backup was created.'
    );
  }

  _backupCache = { mtimeMs: stat.mtimeMs, payload };
  return payload;
}

function findStudent(studentId) {
  const data = loadBackupData();
  const students = data.students || [];
  return students.find(s => s.id === studentId) || null;
}

function getSchoolName() {
  try {
    const data = loadBackupData();
    return (data.config && data.config.schoolName) || CONFIG.schoolNameFallback || 'School';
  } catch {
    return CONFIG.schoolNameFallback || 'School';
  }
}

// ─── SESSIONS (in-memory; a browser tab logging out clears it server-side) ────
const SESSION_COOKIE   = 'psid';
const SESSION_LIFETIME = 12 * 60 * 60 * 1000; // 12 hours
const sessions = new Map(); // sid -> { username, parentName, wards, expiresAt }

function createSession(parent) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, {
    username:   parent.username,
    parentName: parent.parentName || '',
    wards:      (parent.studentIds || []).map(id => ({ studentId: id })),
    expiresAt:  Date.now() + SESSION_LIFETIME,
  });
  return sid;
}

function getSession(sid) {
  if (!sid) return null;
  const sess = sessions.get(sid);
  if (!sess) return null;
  if (Date.now() > sess.expiresAt) { sessions.delete(sid); return null; }
  return sess;
}

// ─── BASIC LOGIN RATE LIMITING (plaintext passwords raise the stakes) ─────────
const FAILED_LOGIN_LIMIT  = 6;
const FAILED_LOGIN_WINDOW = 10 * 60 * 1000; // 10 minutes
const failedAttempts = new Map(); // key (ip+username) -> { count, firstAt }

function isLockedOut(key) {
  const rec = failedAttempts.get(key);
  if (!rec) return false;
  if (Date.now() - rec.firstAt > FAILED_LOGIN_WINDOW) { failedAttempts.delete(key); return false; }
  return rec.count >= FAILED_LOGIN_LIMIT;
}
function recordFailedAttempt(key) {
  const rec = failedAttempts.get(key);
  if (!rec || Date.now() - rec.firstAt > FAILED_LOGIN_WINDOW) {
    failedAttempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    rec.count++;
  }
}
function clearFailedAttempts(key) { failedAttempts.delete(key); }

// ─── HTTP HELPERS ─────────────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  header.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function jsonRes(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_LIFETIME / 1000}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function serveStatic(req, res, pathname) {
  const filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  const resolved = path.normalize(filePath);
  if (!resolved.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(resolved, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(resolved);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
async function router(req, res) {
  const parsed   = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;
  const method   = req.method;
  const cookies  = parseCookies(req);
  const session  = getSession(cookies[SESSION_COOKIE]);
  const ip       = req.socket.remoteAddress || 'unknown';

  // ── Public: school name (shown on the login screen before signing in) ──────
  if (pathname === '/api/school-name' && method === 'GET') {
    return jsonRes(res, { schoolName: getSchoolName() });
  }

  // ── Login ───────────────────────────────────────────────────────────────────
  if (pathname === '/api/login' && method === 'POST') {
    const body = await parseBody(req);
    const username = (body.username || '').trim();
    const password = body.password || '';
    const key = `${ip}:${username.toLowerCase()}`;

    if (isLockedOut(key)) {
      return jsonRes(res, { error: 'Too many failed attempts. Please try again in a few minutes.' }, 429);
    }
    if (!username || !password) {
      return jsonRes(res, { error: 'Please enter your username and password.' }, 400);
    }

    const parents = loadParents();
    const match = parents.find(p => p.username === username && p.password === password);

    if (!match) {
      recordFailedAttempt(key);
      return jsonRes(res, { error: 'Invalid username or password.' }, 401);
    }
    clearFailedAttempts(key);

    const sid = createSession(match);
    setSessionCookie(res, sid);

    const wards = resolveWardNames(match.studentIds || []);
    return jsonRes(res, { success: true, parentName: match.parentName || '', wards });
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/logout' && method === 'POST') {
    if (cookies[SESSION_COOKIE]) sessions.delete(cookies[SESSION_COOKIE]);
    clearSessionCookie(res);
    return jsonRes(res, { success: true });
  }

  // ── Everything below requires a valid session ──────────────────────────────
  if (pathname === '/api/me' && method === 'GET') {
    if (!session) return jsonRes(res, { success: false }, 401);
    return jsonRes(res, {
      success: true,
      parentName: session.parentName,
      wards: resolveWardNames(session.wards.map(w => w.studentId)),
    });
  }

  if (pathname === '/api/my-student' && method === 'GET') {
    if (!session) return jsonRes(res, { error: 'Please sign in.' }, 401);

    const studentId = parsed.searchParams.get('id');
    const allowed = session.wards.some(w => w.studentId === studentId);
    if (!studentId || !allowed) {
      return jsonRes(res, { error: 'You do not have access to that student record.' }, 403);
    }

    let student;
    try {
      student = findStudent(studentId);
    } catch (err) {
      return jsonRes(res, { error: err.message }, 500);
    }
    if (!student) {
      return jsonRes(res, { error: 'This student record was not found in the current backup.' }, 404);
    }
    return jsonRes(res, { success: true, student });
  }

  // ── Static files (login page, profile page, css, js) ───────────────────────
  if (method === 'GET') return serveStatic(req, res, pathname);

  jsonRes(res, { error: 'Not found' }, 404);
}

function resolveWardNames(studentIds) {
  let data;
  try { data = loadBackupData(); } catch { data = { students: [] }; }
  const students = data.students || [];
  return studentIds.map(id => {
    const s = students.find(st => st.id === id);
    return { studentId: id, name: s ? s.name : id };
  });
}

// ─── SERVER ───────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  router(req, res).catch(err => {
    console.error(err);
    jsonRes(res, { error: 'Server error.' }, 500);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('┌────────────────────────────────────────────────');
  console.log('│     Ledger — Parent Portal');
  console.log('├────────────────────────────────────────────────');
  console.log(`│   Open: http://localhost:${PORT}`);
  console.log('│');
  console.log('└────────────────────────────────────────────────');
  console.log('');
  try {
    loadBackupData();
    console.log(`Backup loaded OK from data/${path.basename(BACKUP_FILE)}.`);
  } catch (err) {
    console.warn(`WARNING: ${err.message}`);
  }
});
