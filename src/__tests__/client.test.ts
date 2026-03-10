import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { WaffoPancake } from "../client.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
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
});
