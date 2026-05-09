import { createSign, generateKeyPairSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";
import { verifyWebhook } from "../webhooks.js";

describe("verifyWebhook", () => {
  describe("header validation", () => {
    it("should throw on missing signature header", () => {
      expect(() => verifyWebhook("{}", null)).toThrow("Missing X-Waffo-Signature header");
    });

    it("should throw on undefined signature header", () => {
      expect(() => verifyWebhook("{}", undefined)).toThrow("Missing X-Waffo-Signature header");
    });

    it("should throw on empty string signature header", () => {
      expect(() => verifyWebhook("{}", "")).toThrow("Missing X-Waffo-Signature header");
    });

    it("should throw on malformed header without t", () => {
      expect(() => verifyWebhook("{}", "v1=abc123")).toThrow("Malformed X-Waffo-Signature header");
    });

    it("should throw on malformed header without v1", () => {
      expect(() => verifyWebhook("{}", "t=123456")).toThrow("Malformed X-Waffo-Signature header");
    });

    it("should throw on completely invalid header", () => {
      expect(() => verifyWebhook("{}", "garbage")).toThrow("Malformed X-Waffo-Signature header");
    });
  });

  describe("replay protection", () => {
    it("should throw on stale timestamp", () => {
      const staleTs = (Date.now() - 10 * 60 * 1000).toString(); // 10 min ago
      const header = `t=${staleTs},v1=dummysig`;

      expect(() => verifyWebhook("{}", header)).toThrow("tolerance window");
    });

    it("should throw on invalid timestamp", () => {
      const header = "t=not-a-number,v1=dummysig";

      expect(() => verifyWebhook("{}", header)).toThrow("Invalid timestamp");
    });

    it("should skip replay check when toleranceMs is 0", () => {
      const staleTs = "1000000000"; // very old
      const header = `t=${staleTs},v1=dummysig`;

      // Will fail on signature verification, not timestamp
      expect(() => verifyWebhook("{}", header, { toleranceMs: 0 })).toThrow("Invalid webhook signature");
    });
  });

  describe("signature verification", () => {
    it("should reject invalid signature with auto-detect", () => {
      const ts = Date.now().toString();
      const header = `t=${ts},v1=invalidsignaturedata`;

      expect(() => verifyWebhook("{}", header)).toThrow("Invalid webhook signature");
    });

    it("should reject invalid signature with explicit test environment", () => {
      const ts = Date.now().toString();
      const header = `t=${ts},v1=invalidsignaturedata`;

      expect(() => verifyWebhook("{}", header, { environment: "test" })).toThrow("Invalid webhook signature (test key)");
    });

    it("should reject invalid signature with explicit prod environment", () => {
      const ts = Date.now().toString();
      const header = `t=${ts},v1=invalidsignaturedata`;

      expect(() => verifyWebhook("{}", header, { environment: "prod" })).toThrow("Invalid webhook signature (prod key)");
    });
  });

  describe("end-to-end with known keys", () => {
    // Generate a test key pair to validate the full verification flow
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    function signPayload(ts: string, payload: string): string {
      const signer = createSign("RSA-SHA256");
      signer.update(`${ts}.${payload}`);
      return signer.sign(privateKey, "base64");
    }

    it("should reject signature from unknown key pair", () => {
      const event = {
        id: "evt_123",
        timestamp: "2026-03-10T08:30:00.000Z",
        eventType: "order.completed",
        eventId: "PAY_456",
        storeId: "store_789",
        mode: "prod",
        data: {
          orderId: "order_abc",
          buyerEmail: "test@example.com",
          currency: "USD",
          amount: "29.00",
          taxAmount: "2.90",
          productName: "Pro Plan",
        },
      };

      const payload = JSON.stringify(event);
      const ts = Date.now().toString();
      const v1 = signPayload(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      // Should fail because our test key pair is not the embedded one
      expect(() => verifyWebhook(payload, header)).toThrow("Invalid webhook signature");
    });

    it("should verify signature with custom publicKey option", () => {
      const event = {
        id: "evt_custom_1",
        timestamp: "2026-03-10T08:30:00.000Z",
        eventType: "order.completed",
        eventId: "PAY_789",
        storeId: "store_abc",
        mode: "prod",
        data: { orderId: "order_xyz", buyerEmail: "a@b.com", currency: "USD", amount: "1.00", taxAmount: "0.10", productName: "Test" },
      };

      const payload = JSON.stringify(event);
      const ts = Date.now().toString();
      const v1 = signPayload(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, { publicKey: publicKey as string });
      expect(result.id).toBe("evt_custom_1");
      expect(result.eventType).toBe("order.completed");
    });

    it("should reject invalid signature with custom publicKey", () => {
      const payload = JSON.stringify({ id: "evt_bad" });
      const ts = Date.now().toString();
      const header = `t=${ts},v1=invalidsig`;

      expect(() => verifyWebhook(payload, header, { publicKey: publicKey as string })).toThrow("Invalid webhook signature (custom key)");
    });

    it("should verify with raw base64 public key (no PEM headers)", () => {
      const event = { id: "evt_raw_b64", eventType: "order.completed", data: {} };
      const payload = JSON.stringify(event);
      const ts = Date.now().toString();
      const v1 = signPayload(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      // Strip PEM headers to get raw base64
      const rawBase64 = (publicKey as string)
        .replace(/-----BEGIN PUBLIC KEY-----/g, "")
        .replace(/-----END PUBLIC KEY-----/g, "")
        .replace(/\s+/g, "");

      const result = verifyWebhook(payload, header, { publicKey: rawBase64 });
      expect(result.id).toBe("evt_raw_b64");
    });

    it("should verify with literal \\n in public key", () => {
      const event = { id: "evt_literal_nl", eventType: "order.completed", data: {} };
      const payload = JSON.stringify(event);
      const ts = Date.now().toString();
      const v1 = signPayload(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      // Replace real newlines with literal \n
      const literalNewlines = (publicKey as string).trim().replace(/\n/g, "\\n");

      const result = verifyWebhook(payload, header, { publicKey: literalNewlines });
      expect(result.id).toBe("evt_literal_nl");
    });

    it("should ignore environment option when publicKey is provided", () => {
      const event = { id: "evt_env_override", eventType: "order.completed", data: {} };
      const payload = JSON.stringify(event);
      const ts = Date.now().toString();
      const v1 = signPayload(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      // environment: "prod" should be ignored, custom key used instead
      const result = verifyWebhook(payload, header, { publicKey: publicKey as string, environment: "prod" });
      expect(result.id).toBe("evt_env_override");
    });
  });

  describe("publicKeys config (multi-level fallback)", () => {
    // Two separate key pairs for test/prod simulation
    const testKeyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const prodKeyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    function signWith(privateKey: string, ts: string, payload: string): string {
      const signer = createSign("RSA-SHA256");
      signer.update(`${ts}.${payload}`);
      return signer.sign(privateKey, "base64");
    }

    it("should use publicKeys string for any environment", () => {
      const payload = JSON.stringify({ id: "evt_shared" });
      const ts = Date.now().toString();
      const v1 = signWith(testKeyPair.privateKey, ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, {
        publicKeys: testKeyPair.publicKey as string,
        environment: "test",
      });
      expect(result.id).toBe("evt_shared");
    });

    it("should use publicKeys.test when environment is test", () => {
      const payload = JSON.stringify({ id: "evt_pk_test" });
      const ts = Date.now().toString();
      const v1 = signWith(testKeyPair.privateKey, ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, {
        publicKeys: {
          test: testKeyPair.publicKey as string,
          prod: prodKeyPair.publicKey as string,
        },
        environment: "test",
      });
      expect(result.id).toBe("evt_pk_test");
    });

    it("should use publicKeys.prod when environment is prod", () => {
      const payload = JSON.stringify({ id: "evt_pk_prod" });
      const ts = Date.now().toString();
      const v1 = signWith(prodKeyPair.privateKey, ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, {
        publicKeys: {
          test: testKeyPair.publicKey as string,
          prod: prodKeyPair.publicKey as string,
        },
        environment: "prod",
      });
      expect(result.id).toBe("evt_pk_prod");
    });

    it("should auto-detect with per-env publicKeys (prod first, then test)", () => {
      // Signed with test key — auto-detect should try prod (fail) then test (pass)
      const payload = JSON.stringify({ id: "evt_pk_auto" });
      const ts = Date.now().toString();
      const v1 = signWith(testKeyPair.privateKey, ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, {
        publicKeys: {
          test: testKeyPair.publicKey as string,
          prod: prodKeyPair.publicKey as string,
        },
      });
      expect(result.id).toBe("evt_pk_auto");
    });

    it("should prefer publicKey over publicKeys", () => {
      const payload = JSON.stringify({ id: "evt_pk_priority" });
      const ts = Date.now().toString();
      // Signed with test key
      const v1 = signWith(testKeyPair.privateKey, ts, payload);
      const header = `t=${ts},v1=${v1}`;

      // publicKey (per-call) = test key, publicKeys.prod = prod key
      // publicKey should win
      const result = verifyWebhook(payload, header, {
        publicKey: testKeyPair.publicKey as string,
        publicKeys: { prod: prodKeyPair.publicKey as string },
        environment: "prod",
      });
      expect(result.id).toBe("evt_pk_priority");
    });
  });

  describe("environment variable fallback", () => {
    const envKeyPair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    function signWith(ts: string, payload: string): string {
      const signer = createSign("RSA-SHA256");
      signer.update(`${ts}.${payload}`);
      return signer.sign(envKeyPair.privateKey, "base64");
    }

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("should use WAFFO_WEBHOOK_TEST_PUBLIC_KEY env var for test environment", () => {
      vi.stubEnv("WAFFO_WEBHOOK_TEST_PUBLIC_KEY", envKeyPair.publicKey as string);

      const payload = JSON.stringify({ id: "evt_env_test" });
      const ts = Date.now().toString();
      const v1 = signWith(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, { environment: "test" });
      expect(result.id).toBe("evt_env_test");
    });

    it("should use WAFFO_WEBHOOK_PROD_PUBLIC_KEY env var for prod environment", () => {
      vi.stubEnv("WAFFO_WEBHOOK_PROD_PUBLIC_KEY", envKeyPair.publicKey as string);

      const payload = JSON.stringify({ id: "evt_env_prod" });
      const ts = Date.now().toString();
      const v1 = signWith(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, { environment: "prod" });
      expect(result.id).toBe("evt_env_prod");
    });

    it("should use WAFFO_WEBHOOK_PUBLIC_KEY as shared fallback", () => {
      vi.stubEnv("WAFFO_WEBHOOK_PUBLIC_KEY", envKeyPair.publicKey as string);

      const payload = JSON.stringify({ id: "evt_env_shared" });
      const ts = Date.now().toString();
      const v1 = signWith(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      const result = verifyWebhook(payload, header, { environment: "test" });
      expect(result.id).toBe("evt_env_shared");
    });

    it("should prefer config key over env var", () => {
      // Set env var to a different key (will fail)
      vi.stubEnv("WAFFO_WEBHOOK_TEST_PUBLIC_KEY", "MIIBIjAN..invalid..");

      const payload = JSON.stringify({ id: "evt_config_over_env" });
      const ts = Date.now().toString();
      const v1 = signWith(ts, payload);
      const header = `t=${ts},v1=${v1}`;

      // Config key should win over env var
      const result = verifyWebhook(payload, header, {
        publicKeys: { test: envKeyPair.publicKey as string },
        environment: "test",
      });
      expect(result.id).toBe("evt_config_over_env");
    });
  });
});

// ===========================================================================
// Webhook management resource (add / update / remove)
// ===========================================================================

const { privateKey: TEST_RESOURCE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function createMockFetch(handler: (url: string, options: RequestInit) => object) {
  return vi.fn(async (url: string, options: RequestInit) => ({
    status: 200,
    json: () => Promise.resolve(handler(url, options)),
  }));
}

function createClient(mockFetch: ReturnType<typeof vi.fn>) {
  return new WaffoPancake({
    merchantId: "MER_0000000000000000000000",
    privateKey: TEST_RESOURCE_KEY as string,
    baseUrl: "https://api.test.com",
    fetch: mockFetch as unknown as typeof fetch,
  });
}

describe("webhooks.add", () => {
  it("should call /v1/actions/store/add-webhook with full body", async () => {
    const mockFetch = createMockFetch(() => ({
      data: {
        webhook: {
          id: "11111111-2222-3333-4444-555555555555",
          storeId: "STO_0000000000000000000000",
          channel: "http",
          url: "https://example.com/wh",
          events: ["order.completed"],
          testMode: false,
          secret: null,
          createdAt: "2026-05-07T00:00:00Z",
          updatedAt: "2026-05-07T00:00:00Z",
        },
      },
    }));
    const client = createClient(mockFetch);

    const { webhook } = await client.webhooks.add({
      storeId: "STO_0000000000000000000000",
      channel: "http",
      url: "https://example.com/wh",
      events: ["order.completed"],
      testMode: false,
    });

    expect(webhook.channel).toBe("http");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store/add-webhook");
    const body = JSON.parse(options.body as string);
    expect(body.storeId).toBe("STO_0000000000000000000000");
    expect(body.events).toEqual(["order.completed"]);
  });

  it("should reject invalid storeId", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.webhooks.add({
        storeId: "bad-id",
        channel: "http",
        url: "https://example.com/wh",
        events: [],
        testMode: false,
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("webhooks.update", () => {
  it("should call /v1/actions/store/update-webhook with id", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { webhook: { id: "11111111-2222-3333-4444-555555555555", events: ["refund.succeeded"] } },
    }));
    const client = createClient(mockFetch);

    await client.webhooks.update({
      id: "11111111-2222-3333-4444-555555555555",
      events: ["refund.succeeded"],
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store/update-webhook");
  });
});

describe("webhooks.remove", () => {
  it("should call /v1/actions/store/remove-webhook and return removed snapshot", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { webhook: { id: "11111111-2222-3333-4444-555555555555", url: "https://example.com/wh" } },
    }));
    const client = createClient(mockFetch);

    const { webhook } = await client.webhooks.remove({ id: "11111111-2222-3333-4444-555555555555" });

    expect(webhook.url).toBe("https://example.com/wh");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store/remove-webhook");
  });
});
