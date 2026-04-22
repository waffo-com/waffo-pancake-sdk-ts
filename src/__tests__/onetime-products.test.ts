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

describe("onetimeProducts.create", () => {
  it("should create a product with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000", name: "E-Book" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.onetimeProducts.create({
      storeId: "STO_0000000000000000000000",
      name: "E-Book",
      prices: { USD: { amount: "29.00", taxCategory: "digital_goods" } },
    });

    expect(result.product.id).toBe("PROD_0000000000000000000000");
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-product/create-product");
    const body = JSON.parse(options.body as string);
    expect(body.storeId).toBe("STO_0000000000000000000000");
    expect(body.name).toBe("E-Book");
    expect(body.prices).toEqual({ USD: { amount: "29.00", taxCategory: "digital_goods" } });
  });

  it("should reject invalid storeId format", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.onetimeProducts.create({
        storeId: "bad",
        name: "E-Book",
        prices: { USD: { amount: "29.00", taxCategory: "digital_goods" } },
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("onetimeProducts.update", () => {
  it("should update a product with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000", name: "E-Book v2" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.onetimeProducts.update({
      id: "PROD_0000000000000000000000",
      name: "E-Book v2",
    });

    expect(result.product.name).toBe("E-Book v2");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-product/update-product");
  });

  it("should validate prices when provided", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.onetimeProducts.update({
      id: "PROD_0000000000000000000000",
      prices: { USD: { amount: "39.00", taxCategory: "digital_goods" } },
    });

    expect(result.product.id).toBe("PROD_0000000000000000000000");
  });

  it("should reject empty name when provided", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.onetimeProducts.update({
        id: "PROD_0000000000000000000000",
        name: "",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });

  it("should reject invalid prices when provided", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.onetimeProducts.update({
        id: "PROD_0000000000000000000000",
        prices: { USD: { amount: "not-a-number", taxCategory: "digital_goods" } },
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("onetimeProducts.publish", () => {
  it("should publish a product with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.onetimeProducts.publish({ id: "PROD_0000000000000000000000" });

    expect(result.product.id).toBe("PROD_0000000000000000000000");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-product/publish-product");
  });
});

describe("onetimeProducts.updateStatus", () => {
  it("should update status with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { product: { id: "PROD_0000000000000000000000", status: "inactive" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.onetimeProducts.updateStatus({
      id: "PROD_0000000000000000000000",
      status: "inactive",
    });

    expect(result.product.status).toBe("inactive");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/onetime-product/update-status");
  });

  it("should reject invalid status value", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.onetimeProducts.updateStatus({
        id: "PROD_0000000000000000000000",
        status: "deleted" as "active",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});
