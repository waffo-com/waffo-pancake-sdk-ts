import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
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
    privateKey: TEST_PRIVATE_KEY,
    baseUrl: "https://api.test.com",
    fetch: mockFetch as unknown as typeof fetch,
  });
}

describe("subscriptionProducts.create", () => {
  it("should create a subscription product with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000", name: "Pro Plan", billingPeriod: "monthly" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProducts.create({
      storeId: "STO_0000000000000000000000",
      name: "Pro Plan",
      billingPeriod: "monthly",
      prices: { USD: { amount: "9.99", taxCategory: "saas" } },
    });

    expect(result.product.id).toBe("PROD_0000000000000000000000");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product/create-product");
    const body = JSON.parse(options.body as string);
    expect(body.billingPeriod).toBe("monthly");
    expect(body.prices).toEqual({ USD: { amount: "9.99", taxCategory: "saas" } });
  });

  it("should reject invalid billingPeriod", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.subscriptionProducts.create({
        storeId: "STO_0000000000000000000000",
        name: "Plan",
        billingPeriod: "biweekly" as "monthly",
        prices: { USD: { amount: "9.99", taxCategory: "saas" } },
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("subscriptionProducts.update", () => {
  it("should update a subscription product with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000", name: "Pro Plan v2" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProducts.update({
      id: "PROD_0000000000000000000000",
      name: "Pro Plan v2",
    });

    expect(result.product.name).toBe("Pro Plan v2");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product/update-product");
  });

  it("should validate billingPeriod when provided", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.subscriptionProducts.update({
        id: "PROD_0000000000000000000000",
        billingPeriod: "invalid" as "monthly",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should validate name when provided", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.subscriptionProducts.update({
        id: "PROD_0000000000000000000000",
        name: "",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should validate prices when provided", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.subscriptionProducts.update({
        id: "PROD_0000000000000000000000",
        prices: { USD: { amount: "bad", taxCategory: "saas" } },
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should accept update with only id (no optional fields)", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProducts.update({
      id: "PROD_0000000000000000000000",
    });

    expect(result.product.id).toBe("PROD_0000000000000000000000");
  });
});

describe("subscriptionProducts.publish", () => {
  it("should publish with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProducts.publish({ id: "PROD_0000000000000000000000" });

    expect(result.product.id).toBe("PROD_0000000000000000000000");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product/publish-product");
  });
});

describe("subscriptionProducts.updateStatus", () => {
  it("should update status with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000", status: "active" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProducts.updateStatus({
      id: "PROD_0000000000000000000000",
      status: "active",
    });

    expect(result.product.status).toBe("active");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product/update-status");
  });

  it("should reject invalid status", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.subscriptionProducts.updateStatus({
        id: "PROD_0000000000000000000000",
        status: "archived" as "active",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});
