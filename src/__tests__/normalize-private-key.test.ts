import { createHash, createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { normalizePrivateKey, signRequest } from "../signing.js";

// Generate a test key pair (PKCS#8)
const { publicKey, privateKey: VALID_PEM } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Generate a PKCS#1 key pair
const { privateKey: VALID_PKCS1_PEM } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
});

/**
 * Extract raw base64 from a PEM string (strip headers, footers, newlines).
 */
function extractBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
}

/**
 * Verify that a normalized key can produce a valid signature.
 */
function assertSignsCorrectly(normalizedKey: string): void {
  const sig = signRequest("POST", "/test", "1710000000", "{}", normalizedKey);
  expect(sig).toMatch(/^[A-Za-z0-9+/]+=*$/);
}

describe("normalizePrivateKey", () => {
  // ── Well-formed input ──────────────────────────────────────────────

  it("should pass through a well-formed PKCS#8 PEM unchanged", () => {
    const result = normalizePrivateKey(VALID_PEM);
    expect(result).toBe(VALID_PEM.trim());
    assertSignsCorrectly(result);
  });

  it("should accept a well-formed PKCS#1 PEM", () => {
    const result = normalizePrivateKey(VALID_PKCS1_PEM);
    expect(result).toContain("-----BEGIN RSA PRIVATE KEY-----");
    assertSignsCorrectly(result);
  });

  // ── Literal \n from environment variables ──────────────────────────

  it("should convert literal \\n to real newlines", () => {
    const withLiteralNewlines = VALID_PEM.trim().replace(/\n/g, "\\n");
    const result = normalizePrivateKey(withLiteralNewlines);
    expect(result).not.toContain("\\n");
    assertSignsCorrectly(result);
  });

  // ── Windows-style \r\n line endings ────────────────────────────────

  it("should handle Windows-style \\r\\n line endings", () => {
    const withCrlf = VALID_PEM.trim().replace(/\n/g, "\r\n");
    const result = normalizePrivateKey(withCrlf);
    expect(result).not.toContain("\r");
    assertSignsCorrectly(result);
  });

  // ── Leading/trailing whitespace ────────────────────────────────────

  it("should trim leading and trailing whitespace", () => {
    const padded = `\n\n  ${VALID_PEM}  \n\n`;
    const result = normalizePrivateKey(padded);
    assertSignsCorrectly(result);
  });

  // ── Single-line base64 with headers ────────────────────────────────

  it("should re-wrap single-line base64 with headers", () => {
    const base64 = extractBase64(VALID_PEM);
    const singleLine = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
    const result = normalizePrivateKey(singleLine);
    // Each content line should be at most 64 chars
    const lines = result.split("\n").slice(1, -1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(64);
    }
    assertSignsCorrectly(result);
  });

  // ── Raw base64 without PEM headers ─────────────────────────────────

  it("should wrap raw base64 with PKCS#8 headers", () => {
    const base64 = extractBase64(VALID_PEM);
    const result = normalizePrivateKey(base64);
    expect(result).toContain("-----BEGIN PRIVATE KEY-----");
    expect(result).toContain("-----END PRIVATE KEY-----");
    assertSignsCorrectly(result);
  });

  it("should handle raw base64 on a single line", () => {
    const base64 = extractBase64(VALID_PEM);
    const result = normalizePrivateKey(base64);
    assertSignsCorrectly(result);
  });

  // ── Mixed issues ───────────────────────────────────────────────────

  it("should handle literal \\n + Windows \\r\\n + extra whitespace combined", () => {
    // Simulate a key copied from a dashboard with mixed issues
    const mangled =
      "  -----BEGIN PRIVATE KEY-----\\n" +
      extractBase64(VALID_PEM)
        .match(/.{1,64}/g)!
        .join("\\n") +
      "\\n-----END PRIVATE KEY-----  ";
    const result = normalizePrivateKey(mangled);
    assertSignsCorrectly(result);
  });

  // ── Normalized key produces valid signatures ───────────────────────

  it("should produce a key that generates verifiable signatures", () => {
    const withLiteralNewlines = VALID_PEM.trim().replace(/\n/g, "\\n");
    const normalized = normalizePrivateKey(withLiteralNewlines);

    const method = "POST";
    const path = "/v1/actions/store/create-store";
    const timestamp = "1710000000";
    const body = JSON.stringify({ name: "Test" });

    const signature = signRequest(method, path, timestamp, body, normalized);

    // Verify with public key
    const bodyHash = createHash("sha256").update(body).digest("base64");
    const canonical = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
    const verifier = createVerify("sha256");
    verifier.update(canonical);
    expect(verifier.verify(publicKey, signature, "base64")).toBe(true);
  });

  // ── Error cases ────────────────────────────────────────────────────

  it("should throw on empty string", () => {
    expect(() => normalizePrivateKey("")).toThrow("Private key is empty");
  });

  it("should throw on whitespace-only string", () => {
    expect(() => normalizePrivateKey("   \n\n  ")).toThrow("Private key is empty");
  });

  it("should throw on PEM headers with no content", () => {
    expect(() => normalizePrivateKey("-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----")).toThrow("no key data");
  });

  it("should throw on invalid base64 characters", () => {
    expect(() => normalizePrivateKey("not-valid-base64!!!")).toThrow("not valid PEM or base64");
  });

  it("should throw on valid base64 that is not a real key", () => {
    expect(() => normalizePrivateKey("dGhpcyBpcyBub3QgYSBrZXk=")).toThrow("could not be parsed");
  });
});
