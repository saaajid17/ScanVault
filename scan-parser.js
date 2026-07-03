/**
 * scan-parser.js
 * Pure functions: raw decoded string -> { type, data }.
 * No DOM, no camera code — kept separate so it's testable in plain Node.
 * Loaded as a plain <script> in index.html (defines globals) and via
 * require() in test-scan-parser.js (module.exports guard at the bottom).
 */

function detectPayloadType(raw) {
  if (typeof raw !== 'string') return 'text';
  const value = raw.trim();
  if (value.length === 0) return 'text';

  if (/^https?:\/\//i.test(value)) return 'url';
  if (/^WIFI:/i.test(value)) return 'wifi';
  if (/^BEGIN:VCARD/i.test(value)) return 'contact';
  if (/^MECARD:/i.test(value)) return 'contact';
  if (/^tel:/i.test(value)) return 'tel';
  if (/^mailto:/i.test(value)) return 'email';
  if (/^sms(to)?:/i.test(value)) return 'sms';
  if (/^\d{6,14}$/.test(value)) return 'barcode';
  return 'text';
}

function parseWifiString(value) {
  const ssid = value.match(/S:([^;]*)/i)?.[1] || '';
  const password = value.match(/P:([^;]*)/i)?.[1] || '';
  const security = (value.match(/T:([^;]*)/i)?.[1] || 'nopass').toUpperCase();
  const hidden = /H:true/i.test(value);
  return { ssid, password, security, hidden };
}

function parseVCard(value) {
  const name =
    value.match(/FN:(.*)/i)?.[1]?.trim() ||
    value.match(/^N:(.*)/im)?.[1]?.trim() ||
    '';
  const phone = value.match(/TEL[^:]*:(.*)/i)?.[1]?.trim() || '';
  const email = value.match(/EMAIL[^:]*:(.*)/i)?.[1]?.trim() || '';
  const rawAddress = value.match(/ADR[^:]*:(.*)/i)?.[1]?.trim() || '';
  const address = rawAddress.split(';').filter(Boolean).join(', ');
  return { name, phone, email, address };
}

function parseMecard(value) {
  // MECARD:N:Last,First;TEL:...;EMAIL:...;ADR:...;;
  const rawName = value.match(/N:([^;]*)/i)?.[1] || '';
  const name = rawName.includes(',')
    ? rawName.split(',').reverse().join(' ').trim()
    : rawName.trim();
  const phone = value.match(/TEL:([^;]*)/i)?.[1]?.trim() || '';
  const email = value.match(/EMAIL:([^;]*)/i)?.[1]?.trim() || '';
  const address = value.match(/ADR:([^;]*)/i)?.[1]?.trim() || '';
  return { name, phone, email, address };
}

function parseContact(value) {
  if (/^BEGIN:VCARD/i.test(value)) return parseVCard(value);
  if (/^MECARD:/i.test(value)) return parseMecard(value);
  return { name: '', phone: '', email: '', address: '' };
}

function parseTel(value) {
  return value.replace(/^tel:/i, '').trim();
}

function parseEmail(value) {
  const withoutScheme = value.replace(/^mailto:/i, '');
  const [address, query] = withoutScheme.split('?');
  return { address: address.trim(), query: query || '' };
}

function parseSms(value) {
  const withoutScheme = value.replace(/^sms(to)?:/i, '');
  const [number, ...bodyParts] = withoutScheme.split(':');
  return { number: number.trim(), body: bodyParts.join(':').trim() };
}

/**
 * Single entry point the UI calls: raw decoded string -> a normalized
 * { type, raw, data } shape ready to render.
 */
function parseScanPayload(raw) {
  const type = detectPayloadType(raw);
  const value = typeof raw === 'string' ? raw.trim() : '';

  switch (type) {
    case 'wifi':
      return { type, raw: value, data: parseWifiString(value) };
    case 'contact':
      return { type, raw: value, data: parseContact(value) };
    case 'tel':
      return { type, raw: value, data: parseTel(value) };
    case 'email':
      return { type, raw: value, data: parseEmail(value) };
    case 'sms':
      return { type, raw: value, data: parseSms(value) };
    case 'url':
    case 'barcode':
    case 'text':
    default:
      return { type, raw: value, data: value };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectPayloadType,
    parseWifiString,
    parseVCard,
    parseMecard,
    parseContact,
    parseTel,
    parseEmail,
    parseSms,
    parseScanPayload,
  };
}
