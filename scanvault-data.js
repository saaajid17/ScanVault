/**
 * scanvault-data.js
 * Pure functions: payload building (the encode direction, complementing
 * scan-parser.js's decode direction), batch-input parsing, schema
 * migration, and history CRUD operations that work on a plain data object
 * (no LocalStore/DOM calls in here — those live in index.html as thin
 * wrappers around these functions).
 */

const CURRENT_SCHEMA_VERSION = 2;

// ---------- Payload building (generator / encode direction) ----------

function escapeQrField(value) {
  return String(value || '').replace(/([\\;,:])/g, '\\$1');
}

function buildWifiString({ ssid, password, security }) {
  const sec = (security || 'WPA').toUpperCase();
  const escSsid = escapeQrField(ssid);
  if (sec === 'NOPASS') {
    return `WIFI:T:nopass;S:${escSsid};;`;
  }
  const escPass = escapeQrField(password);
  return `WIFI:T:${sec};S:${escSsid};P:${escPass};;`;
}

function buildMecard({ name, phone, email, address }) {
  let out = 'MECARD:';
  if (name) out += `N:${escapeQrField(name)};`;
  if (phone) out += `TEL:${escapeQrField(phone)};`;
  if (email) out += `EMAIL:${escapeQrField(email)};`;
  if (address) out += `ADR:${escapeQrField(address)};`;
  out += ';';
  return out;
}

function normalizeUrlInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// ---------- Batch input parsing ----------

function truncateForLabel(str, max = 28) {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function parseBatchLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const sepIndex = trimmed.indexOf('|');
  if (sepIndex === -1) {
    return { label: truncateForLabel(trimmed), value: trimmed };
  }
  const label = trimmed.slice(0, sepIndex).trim();
  const value = trimmed.slice(sepIndex + 1).trim();
  if (!value) return null;
  return { label: label || truncateForLabel(value), value };
}

function parseBatchInput(text) {
  return String(text || '')
    .split('\n')
    .map(parseBatchLine)
    .filter(Boolean);
}

// ---------- Schema / migration ----------

function getDefaultData() {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    scans: [],
    settings: { historyEnabled: true, isSupporter: false },
  };
}

function migrateData(oldVersion, data) {
  let migrated = data;

  if (oldVersion < 1) {
    // v0 -> v1: nothing existed before v1, this app started at v1.
  }

  if (oldVersion < 2) {
    // v1 -> v2: added settings.isSupporter (Session 5). Existing users
    // haven't purchased it — default false, never leave it undefined.
    if (migrated.settings && typeof migrated.settings.isSupporter !== 'boolean') {
      migrated.settings.isSupporter = false;
    }
  }

  migrated.schema_version = CURRENT_SCHEMA_VERSION;
  if (!Array.isArray(migrated.scans)) migrated.scans = [];
  if (!migrated.settings || typeof migrated.settings !== 'object') {
    migrated.settings = { historyEnabled: true, isSupporter: false };
  }
  return migrated;
}

// ---------- History CRUD (pure — operate on a data object, return a new one) ----------

function generateId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addScanRecord(data, parsed) {
  if (!data.settings.historyEnabled) return data;
  const record = {
    id: generateId(),
    type: parsed.type,
    raw: parsed.raw,
    data: parsed.data,
    scannedAt: Date.now(),
  };
  const scans = [record, ...data.scans].slice(0, 200); // cap so storage doesn't grow unbounded
  return { ...data, scans };
}

function removeScanRecord(data, id) {
  return { ...data, scans: data.scans.filter((s) => s.id !== id) };
}

function clearScanRecords(data) {
  return { ...data, scans: [] };
}

function findScanRecord(data, id) {
  return data.scans.find((s) => s.id === id) ?? null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CURRENT_SCHEMA_VERSION,
    buildWifiString,
    buildMecard,
    normalizeUrlInput,
    truncateForLabel,
    parseBatchLine,
    parseBatchInput,
    getDefaultData,
    migrateData,
    generateId,
    addScanRecord,
    removeScanRecord,
    clearScanRecords,
    findScanRecord,
  };
}
