import { createHash, generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancakeError } from "../errors.js";
import { HttpClient } from "../http-client.js";

// Generate a real RSA key pair for testing
const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const MERCHANT_ID = "merchant_test_123";

function createMockFetch(responseBody: object, status = 200) {
  return vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(responseBody),
  });
}

describe("HttpClient", () => {
  describe("post", () => {
    it("returns the full envelope plus HTTP status", async () => {
      const mockFetch = createMockFetch({ data: { store: { id: "store_1" } } });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        baseUrl: "https://api.test.com",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.post<{ store: { id: string } }>("/v1/actions/store/create-store", { name: "Test" });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ store: { id: "store_1" } });
      expect(result.errors).toBeUndefined();
      expect(result.warnings).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.test.com/v1/actions/store/create-store");
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ name: "Test" }));
    });

    it("surfaces warnings from the envelope without dropping them", async () => {
      const warnings = [{ message: "deprecated field used", layer: "store", aiHint: "Switch to bar" }];
      const mockFetch = createMockFetch({ data: { store: { id: "s1" } }, warnings });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.post("/v1/test", {});

      expect(result.warnings).toEqual(warnings);
    });

    it("should include required headers", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { foo: "bar" });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Merchant-Id"]).toBe(MERCHANT_ID);
      expect(headers["X-Timestamp"]).toBeDefined();
      expect(headers["X-Signature"]).toBeDefined();
      // No idempotency key is derived any more — absent unless the caller passes one
      expect(headers["X-Idempotency-Key"]).toBeUndefined();
    });

    it("sends X-Idempotency-Key only when the caller supplies one, verbatim", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { foo: "bar" });
      await client.post("/v1/test", { foo: "bar" }, { idempotencyKey: "MER_key-provided-by-caller_1" });

      expect(mockFetch.mock.calls[0][1].headers["X-Idempotency-Key"]).toBeUndefined();
      // Passed through unchanged — the SDK neither hashes nor rewrites it
      expect(mockFetch.mock.calls[1][1].headers["X-Idempotency-Key"]).toBe("MER_key-provided-by-caller_1");
    });

    it("does not derive a key from merchantId, path or body", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { a: 1 });
      await client.post("/v1/test", { a: 1 });
      await client.post("/v1/test", { a: 2 });

      // Two identical requests used to share a derived key and hit the gateway's
      // 24h cache; now neither carries one and both execute.
      for (const call of mockFetch.mock.calls) {
        expect(call[1].headers["X-Idempotency-Key"]).toBeUndefined();
      }
      const bodyStr = JSON.stringify({ a: 1 });
      const legacyKey = createHash("sha256").update(`${MERCHANT_ID}:/v1/test:${bodyStr}`).digest("hex");
      expect(JSON.stringify(mockFetch.mock.calls[0][1].headers)).not.toContain(legacyKey);
    });

    it("leaves an empty idempotencyKey off the request", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { foo: "bar" }, { idempotencyKey: "" });

      expect(mockFetch.mock.calls[0][1].headers["X-Idempotency-Key"]).toBeUndefined();
    });

    it("does NOT throw on errors[] — caller inspects the envelope", async () => {
      const errors = [{ message: "Not found", layer: "store" }];
      const mockFetch = createMockFetch({ data: null, errors }, 404);
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.post("/v1/test", {});

      expect(result.status).toBe(404);
      expect(result.data).toBeNull();
      expect(result.errors).toEqual(errors);
    });

    it("throws WaffoPancakeError only when the response body is not JSON", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 502,
        json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
      });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(client.post("/v1/test", {})).rejects.toThrow(WaffoPancakeError);
    });

    it("should strip trailing slashes from baseUrl", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        baseUrl: "https://api.test.com///",
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", {});

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe("https://api.test.com/v1/test");
    });

    it("should pass MER_{base62} format merchantId in X-Merchant-Id header", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const base62MerchantId = "MER_1mEbVHMBjMiSuPq6SNSkfm";
      const client = new HttpClient({
        merchantId: base62MerchantId,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { foo: "bar" });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers["X-Merchant-Id"]).toBe(base62MerchantId);
    });

    it("should use default baseUrl when not provided", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", {});

      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe("https://api.waffo.ai/v1/test");
    });
  });
});
