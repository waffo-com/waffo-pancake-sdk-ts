import { createSign, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

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

      expect(() => verifyWebhook("{}", header, { environment: "test" })).toThrow(
        "Invalid webhook signature (test key)",
      );
    });

    it("should reject invalid signature with explicit prod environment", () => {
      const ts = Date.now().toString();
      const header = `t=${ts},v1=invalidsignaturedata`;

      expect(() => verifyWebhook("{}", header, { environment: "prod" })).toThrow(
        "Invalid webhook signature (prod key)",
      );
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
        eventId: "pay_456",
        storeId: "store_789",
        mode: "prod",
        data: { orderId: "order_abc", buyerEmail: "test@example.com", currency: "USD", amount: 2900, taxAmount: 290, productName: "Pro Plan" },
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
        eventId: "pay_789",
        storeId: "store_abc",
        mode: "prod",
        data: { orderId: "order_xyz", buyerEmail: "a@b.com", currency: "USD", amount: 100, taxAmount: 10, productName: "Test" },
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

      expect(() => verifyWebhook(payload, header, { publicKey: publicKey as string })).toThrow(
        "Invalid webhook signature (custom key)",
      );
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
});
