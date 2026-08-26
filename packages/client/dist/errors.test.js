/**
 * Error mapping — unit tests. No network. Runs everywhere.
 */
import { describe, expect, it } from "vitest";
import { fromPostgrest, fromAuth, ClientApiError } from "./errors";
import { API_ERROR_CODES } from "@virundhu/shared";
const pg = (code, message) => ({
    message,
    details: "",
    hint: "",
    code,
    name: "PostgrestError",
});
describe("fromPostgrest", () => {
    it("maps unique_violation → CONFLICT", () => {
        const e = fromPostgrest(pg("23505", "duplicate key"));
        expect(e).toBeInstanceOf(ClientApiError);
        expect(e.code).toBe(API_ERROR_CODES.CONFLICT);
        expect(e.status).toBe(409);
    });
    it("maps RLS deny → FORBIDDEN", () => {
        const e = fromPostgrest(pg("42501", "row violates row-level security"));
        expect(e.code).toBe(API_ERROR_CODES.FORBIDDEN);
        expect(e.status).toBe(403);
    });
    it("maps PGRST116 (no rows) → NOT_FOUND", () => {
        const e = fromPostgrest(pg("PGRST116", "0 rows"));
        expect(e.code).toBe(API_ERROR_CODES.NOT_FOUND);
        expect(e.status).toBe(404);
    });
    it("maps P0001 'invalid transition' → INVALID_STATUS_TRANSITION", () => {
        const e = fromPostgrest(pg("P0001", "illegal transition ACCEPTED -> COMPLETED"));
        expect(e.code).toBe(API_ERROR_CODES.INVALID_STATUS_TRANSITION);
    });
    it("maps P0001 'product not available' → PRODUCT_UNAVAILABLE", () => {
        const e = fromPostgrest(pg("P0001", "product abc is not available"));
        expect(e.code).toBe(API_ERROR_CODES.PRODUCT_UNAVAILABLE);
    });
    it("maps unknown SQLSTATE → INTERNAL_ERROR", () => {
        const e = fromPostgrest(pg("XX999", "boom"));
        expect(e.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
        expect(e.status).toBe(500);
    });
});
describe("fromAuth", () => {
    const auth = (message) => ({ message, name: "AuthError", status: 400 });
    it("maps invalid credentials", () => {
        const e = fromAuth(auth("Invalid login credentials"));
        expect(e.code).toBe(API_ERROR_CODES.INVALID_CREDENTIALS);
        expect(e.status).toBe(401);
    });
    it("maps already-registered email", () => {
        const e = fromAuth(auth("A user with this email has already been registered"));
        expect(e.code).toBe(API_ERROR_CODES.EMAIL_TAKEN);
    });
    it("maps email-not-confirmed", () => {
        const e = fromAuth(auth("Email not confirmed"));
        expect(e.code).toBe(API_ERROR_CODES.EMAIL_NOT_VERIFIED);
    });
    it("falls back to UNAUTHORIZED", () => {
        const e = fromAuth(auth("something else"));
        expect(e.code).toBe(API_ERROR_CODES.UNAUTHORIZED);
    });
});
