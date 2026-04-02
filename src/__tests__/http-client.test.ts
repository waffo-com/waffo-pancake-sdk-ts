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
    it("should send signed POST request and return data", async () => {
      const mockFetch = createMockFetch({ data: { store: { id: "store_1" } } });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        baseUrl: "https://api.test.com",
        fetch: mockFetch as unknown as typeof fetch,
      });

      const result = await client.post<{ store: { id: string } }>("/v1/actions/store/create-store", { name: "Test" });

      expect(result).toEqual({ store: { id: "store_1" } });
      expect(mockFetch).toHaveBeenCalledOnce();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.test.com/v1/actions/store/create-store");
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ name: "Test" }));
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
      expect(headers["X-Idempotency-Key"]).toBeDefined();
    });

    it("should generate deterministic idempotency key", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { foo: "bar" });
      await client.post("/v1/test", { foo: "bar" });

      const key1 = mockFetch.mock.calls[0][1].headers["X-Idempotency-Key"];
      const key2 = mockFetch.mock.calls[1][1].headers["X-Idempotency-Key"];
      expect(key1).toBe(key2);

      // Verify it matches expected hash
      const bodyStr = JSON.stringify({ foo: "bar" });
      const expected = createHash("sha256")
        .update(`${MERCHANT_ID}:/v1/test:${bodyStr}`)
        .digest("hex");
      expect(key1).toBe(expected);
    });

    it("should produce different idempotency keys for different bodies", async () => {
      const mockFetch = createMockFetch({ data: {} });
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await client.post("/v1/test", { a: 1 });
      await client.post("/v1/test", { a: 2 });

      const key1 = mockFetch.mock.calls[0][1].headers["X-Idempotency-Key"];
      const key2 = mockFetch.mock.calls[1][1].headers["X-Idempotency-Key"];
      expect(key1).not.toBe(key2);
    });

    it("should throw WaffoPancakeError on error response", async () => {
      const errors = [{ message: "Not found", layer: "store" }];
      const mockFetch = createMockFetch({ data: null, errors }, 404);
      const client = new HttpClient({
        merchantId: MERCHANT_ID,
        privateKey: TEST_PRIVATE_KEY,
        fetch: mockFetch as unknown as typeof fetch,
      });

      await expect(client.post("/v1/test", {})).rejects.toThrow(WaffoPancakeError);

      try {
        await client.post("/v1/test", {});
      } catch (e) {
        expect(e).toBeInstanceOf(WaffoPancakeError);
        expect((e as WaffoPancakeError).status).toBe(404);
        expect((e as WaffoPancakeError).errors).toEqual(errors);
      }
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
