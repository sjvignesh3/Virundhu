/**
 * ID generation.
 *
 * Uses `crypto.randomUUID()` when available (all modern browsers + Node 19+).
 * Falls back to a Math.random-based v4-shaped string for older runtimes so we
 * never crash during SSR on an unusual host. Not cryptographically strong in
 * the fallback path — acceptable because these ids are used only as opaque
 * primary keys in local storage, never as security tokens.
 */
export function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return fallbackUuid();
}

function fallbackUuid(): string {
  const bytes = new Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  // Set version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Current ISO timestamp — extracted so tests can stub it later. */
export function now(): string {
  return new Date().toISOString();
}
