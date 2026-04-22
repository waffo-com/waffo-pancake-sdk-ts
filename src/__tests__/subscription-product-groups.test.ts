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

describe("subscriptionProductGroups.create", () => {
  it("should create a group with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { group: { id: "grp-uuid", name: "Pro Plans" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProductGroups.create({
      storeId: "STO_0000000000000000000000",
      name: "Pro Plans",
      rules: { sharedTrial: true },
      productIds: ["PROD_0000000000000000000000"],
    });

    expect(result.group.name).toBe("Pro Plans");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product-group/create-group");
    const body = JSON.parse(options.body as string);
    expect(body.storeId).toBe("STO_0000000000000000000000");
    expect(body.rules).toEqual({ sharedTrial: true });
  });

  it("should reject empty name", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.subscriptionProductGroups.create({
        storeId: "STO_0000000000000000000000",
        name: "",
        rules: { sharedTrial: true },
        productIds: [],
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("subscriptionProductGroups.update", () => {
  it("should update a group with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { group: { id: "grp-uuid", name: "Updated Plans" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProductGroups.update({
      id: "grp-uuid",
      productIds: ["PROD_0000000000000000000000"],
    });

    expect(result.group.name).toBe("Updated Plans");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product-group/update-group");
  });

  it("should reject missing id", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(client.subscriptionProductGroups.update({ id: "" })).rejects.toThrow(WaffoPancakeError);
  });
});

describe("subscriptionProductGroups.delete", () => {
  it("should delete a group with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { group: { id: "grp-uuid" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProductGroups.delete({ id: "grp-uuid" });

    expect(result.group.id).toBe("grp-uuid");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product-group/delete-group");
  });
});

describe("subscriptionProductGroups.publish", () => {
  it("should publish a group with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { group: { id: "grp-uuid" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.subscriptionProductGroups.publish({ id: "grp-uuid" });

    expect(result.group.id).toBe("grp-uuid");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/subscription-product-group/publish-group");
  });
});
