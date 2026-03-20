import { createSign, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { WaffoPancake } from "../client.js";

const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("WaffoPancake", () => {
  it("should initialize all resource namespaces", () => {
    const client = new WaffoPancake({
      merchantId: "merchant_test",
      privateKey: TEST_PRIVATE_KEY,
    });

    expect(client.auth).toBeDefined();
    expect(client.stores).toBeDefined();
    expect(client.storeMerchants).toBeDefined();
    expect(client.onetimeProducts).toBeDefined();
    expect(client.subscriptionProducts).toBeDefined();
    expect(client.subscriptionProductGroups).toBeDefined();
    expect(client.orders).toBeDefined();
    expect(client.checkout).toBeDefined();
    expect(client.graphql).toBeDefined();
    expect(client.webhooks).toBeDefined();
  });

  it("should accept custom baseUrl", () => {
    const client = new WaffoPancake({
      merchantId: "merchant_test",
      privateKey: TEST_PRIVATE_KEY,
      baseUrl: "https://custom.api.com",
    });

    expect(client).toBeDefined();
  });

  it("should accept custom fetch implementation", () => {
    const customFetch = async () => new Response();
    const client = new WaffoPancake({
      merchantId: "merchant_test",
      privateKey: TEST_PRIVATE_KEY,
      fetch: customFetch as typeof fetch,
    });

    expect(client).toBeDefined();
  });

  it("should accept webhookPublicKey config", () => {
    const client = new WaffoPancake({
      merchantId: "merchant_test",
      privateKey: TEST_PRIVATE_KEY,
      webhookPublicKey: TEST_PUBLIC_KEY as string,
    });

    expect(client.webhooks).toBeDefined();
  });

  it("should verify webhook with configured public key via client.webhooks.verify", () => {
    const client = new WaffoPancake({
      merchantId: "merchant_test",
      privateKey: TEST_PRIVATE_KEY,
      webhookPublicKey: TEST_PUBLIC_KEY as string,
    });

    const event = { id: "evt_client", eventType: "order.completed", data: {} };
    const payload = JSON.stringify(event);
    const ts = Date.now().toString();
    const signer = createSign("RSA-SHA256");
    signer.update(`${ts}.${payload}`);
    const v1 = signer.sign(TEST_PRIVATE_KEY, "base64");
    const header = `t=${ts},v1=${v1}`;

    const result = client.webhooks.verify(payload, header);
    expect(result.id).toBe("evt_client");
  });
});
