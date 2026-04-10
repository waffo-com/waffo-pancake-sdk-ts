import { createSign, createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { normalizePublicKey } from "../signing.js";

// Generate SPKI key pair
const { publicKey: VALID_PEM, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Generate PKCS#1 public key
const { publicKey: VALID_PKCS1_PEM } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

/**
 * Extract raw base64 from a PEM string (strip headers, footers, newlines).
 */
function extractBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN (?:RSA )?PUBLIC KEY-----/g, "")
    .replace(/-----END (?:RSA )?PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
}

/**
 * Verify that a normalized public key can verify a signature.
 */
function assertVerifiesCorrectly(normalizedKey: string): void {
  const data = "test-data";
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  const signature = signer.sign(privateKey, "base64");

  const verifier = createVerify("RSA-SHA256");
  verifier.update(data);
  expect(verifier.verify(normalizedKey, signature, "base64")).toBe(true);
}

describe("normalizePublicKey", () => {
  // ── Well-formed input ──────────────────────────────────────────────

  it("should pass through a well-formed SPKI PEM unchanged", () => {
    const result = normalizePublicKey(VALID_PEM as string);
    expect(result).toBe((VALID_PEM as string).trim());
    assertVerifiesCorrectly(result);
  });

  it("should accept a well-formed PKCS#1 PEM", () => {
    const result = normalizePublicKey(VALID_PKCS1_PEM as string);
    expect(result).toContain("-----BEGIN RSA PUBLIC KEY-----");
    // Cannot verify with SPKI key pair's private key — just check it parses
    expect(result).toBeTruthy();
  });

  // ── Literal \n from environment variables ──────────────────────────

  it("should convert literal \\n to real newlines", () => {
    const withLiteralNewlines = (VALID_PEM as string).trim().replace(/\n/g, "\\n");
    const result = normalizePublicKey(withLiteralNewlines);
    expect(result).not.toContain("\\n");
    assertVerifiesCorrectly(result);
  });

  // ── Windows-style \r\n line endings ────────────────────────────────

  it("should handle Windows-style \\r\\n line endings", () => {
    const withCrlf = (VALID_PEM as string).trim().replace(/\n/g, "\r\n");
    const result = normalizePublicKey(withCrlf);
    expect(result).not.toContain("\r");
    assertVerifiesCorrectly(result);
  });

  // ── Leading/trailing whitespace ────────────────────────────────────

  it("should trim leading and trailing whitespace", () => {
    const padded = `\n\n  ${VALID_PEM}  \n\n`;
    const result = normalizePublicKey(padded);
    assertVerifiesCorrectly(result);
  });

  // ── Single-line base64 with headers ────────────────────────────────

  it("should re-wrap single-line base64 with headers", () => {
    const base64 = extractBase64(VALID_PEM as string);
    const singleLine = `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
    const result = normalizePublicKey(singleLine);
    // Each content line should be at most 64 chars
    const lines = result.split("\n").slice(1, -1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(64);
    }
    assertVerifiesCorrectly(result);
  });

  // ── Raw base64 without PEM headers ─────────────────────────────────

  it("should wrap raw base64 with SPKI headers", () => {
    const base64 = extractBase64(VALID_PEM as string);
    const result = normalizePublicKey(base64);
    expect(result).toContain("-----BEGIN PUBLIC KEY-----");
    expect(result).toContain("-----END PUBLIC KEY-----");
    assertVerifiesCorrectly(result);
  });

  it("should handle raw base64 on a single line", () => {
    const base64 = extractBase64(VALID_PEM as string);
    const result = normalizePublicKey(base64);
    assertVerifiesCorrectly(result);
  });

  // ── Mixed issues ───────────────────────────────────────────────────

  it("should handle literal \\n + extra whitespace combined", () => {
    const mangled =
      "  -----BEGIN PUBLIC KEY-----\\n" +
      extractBase64(VALID_PEM as string)
        .match(/.{1,64}/g)!
        .join("\\n") +
      "\\n-----END PUBLIC KEY-----  ";
    const result = normalizePublicKey(mangled);
    assertVerifiesCorrectly(result);
  });

  // ── Error cases ────────────────────────────────────────────────────

  it("should throw on empty string", () => {
    expect(() => normalizePublicKey("")).toThrow("Public key is empty");
  });

  it("should throw on whitespace-only string", () => {
    expect(() => normalizePublicKey("   \n\n  ")).toThrow("Public key is empty");
  });

  it("should throw on PEM headers with no content", () => {
    expect(() => normalizePublicKey("-----BEGIN PUBLIC KEY-----\n-----END PUBLIC KEY-----")).toThrow("no key data");
  });

  it("should throw on invalid base64 characters", () => {
    expect(() => normalizePublicKey("not-valid-base64!!!")).toThrow("not valid PEM or base64");
  });

  it("should throw on valid base64 that is not a real key", () => {
    expect(() => normalizePublicKey("dGhpcyBpcyBub3QgYSBrZXk=")).toThrow("could not be parsed");
  });
});
