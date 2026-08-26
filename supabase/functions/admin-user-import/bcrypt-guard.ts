/**
 * Bcrypt hash shape guard used by admin-user-import to reject accidental
 * plaintext / SHA-256 / MD5 password values before they are stored.
 *
 * Bcrypt format:  $2[aby]$<cost>$<22-char salt><31-char hash>
 * Total length is always 60 characters, cost factor is two digits.
 */
export const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function isValidBcryptHash(input: unknown): input is string {
  return typeof input === "string" && BCRYPT_RE.test(input);
}
