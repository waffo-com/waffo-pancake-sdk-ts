import { createHash, createVerify, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signRequest } from "../signing.js";

// Generate a test key pair
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("signRequest", () => {
  const method = "POST";
  const path = "/v1/actions/store/create-store";
  const timestamp = "1710000000";
  const body = JSON.stringify({ name: "My Store" });

  it("should produce a valid RSA-SHA256 signature", () => {
    const signature = signRequest(method, path, timestamp, body, privateKey);

    // Verify signature manually
    const bodyHash = createHash("sha256").update(body).digest("base64");
    const canonicalRequest = `${method}\n${path}\n${timestamp}\n${bodyHash}`;

    const verifier = createVerify("sha256");
    verifier.update(canonicalRequest);
    expect(verifier.verify(publicKey, signature, "base64")).toBe(true);
  });

  it("should produce a base64-encoded string", () => {
    const signature = signRequest(method, path, timestamp, body, privateKey);

    expect(typeof signature).toBe("string");
    // Base64 pattern
    expect(signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("should produce different signatures for different bodies", () => {
    const sig1 = signRequest(method, path, timestamp, '{"a":1}', privateKey);
    const sig2 = signRequest(method, path, timestamp, '{"a":2}', privateKey);
    expect(sig1).not.toBe(sig2);
  });

  it("should produce different signatures for different timestamps", () => {
    const sig1 = signRequest(method, path, "1710000000", body, privateKey);
    const sig2 = signRequest(method, path, "1710000001", body, privateKey);
    expect(sig1).not.toBe(sig2);
  });

  it("should produce different signatures for different paths", () => {
    const sig1 = signRequest(method, "/v1/a", timestamp, body, privateKey);
    const sig2 = signRequest(method, "/v1/b", timestamp, body, privateKey);
    expect(sig1).not.toBe(sig2);
  });
});
