/**
 * Deno tests for the bcrypt-guard used by admin-user-import.
 * Run: deno test --import-map=supabase/import_map.json \
 *      supabase/functions/admin-user-import/bcrypt-guard.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidBcryptHash } from "./bcrypt-guard.ts";

Deno.test("accepts $2b$10$ hashes (bcryptjs default)", () => {
  // Real bcryptjs output for "password" @ cost 10.
  const h = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  assertEquals(isValidBcryptHash(h), true);
});

Deno.test("accepts $2a$ hashes (legacy PHP crypt_blowfish)", () => {
  const h = "$2a$12$K9jT4nQm.KfXV0iyKZ4qMuJk5tCz1VwAaAmQ2rJx5jTr7yCk3q1p6";
  assertEquals(isValidBcryptHash(h), true);
});

Deno.test("accepts $2y$ hashes (BSD/OpenBSD variant)", () => {
  const h = "$2y$10$abcdefghijklmnopqrstuu5xVzTZH1YbPRfhK6VbnAj9uvj3OaMWq";
  assertEquals(isValidBcryptHash(h), true);
});

Deno.test("rejects unknown prefix $2z$", () => {
  const h = "$2z$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  assertEquals(isValidBcryptHash(h), false);
});

Deno.test("rejects single-digit cost factor", () => {
  const h = "$2b$5$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  assertEquals(isValidBcryptHash(h), false);
});

Deno.test("rejects wrong body length (truncated)", () => {
  const h = "$2b$10$too-short";
  assertEquals(isValidBcryptHash(h), false);
});

Deno.test("rejects plaintext password", () => {
  assertEquals(isValidBcryptHash("SuperSecret123!"), false);
});

Deno.test("rejects SHA-256 hex digest", () => {
  const h = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
  assertEquals(isValidBcryptHash(h), false);
});

Deno.test("rejects non-string values", () => {
  assertEquals(isValidBcryptHash(null), false);
  assertEquals(isValidBcryptHash(undefined), false);
  assertEquals(isValidBcryptHash(123), false);
  assertEquals(isValidBcryptHash({}), false);
});

Deno.test("rejects hash with invalid character in body", () => {
  // '!' is not part of the bcrypt alphabet (./A-Za-z0-9).
  const h = "$2b$10$!9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
  assertEquals(isValidBcryptHash(h), false);
});
