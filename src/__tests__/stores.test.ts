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

describe("stores.create", () => {
  it("should create a store with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { store: { id: "STO_0000000000000000000000", name: "My Store" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.stores.create({ name: "My Store" });

    expect(result.store.name).toBe("My Store");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store/create-store");
    const body = JSON.parse(options.body as string);
    expect(body.name).toBe("My Store");
  });

  it("should reject empty name", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(client.stores.create({ name: "" })).rejects.toThrow(WaffoPancakeError);
  });
});

describe("stores.update", () => {
  it("should update a store with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { store: { id: "STO_0000000000000000000000", name: "Updated Name" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.stores.update({
      id: "STO_0000000000000000000000",
      name: "Updated Name",
    });

    expect(result.store.name).toBe("Updated Name");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store/update-store");
  });

  it("should reject invalid store ID format", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(client.stores.update({ id: "bad-id", name: "Test" })).rejects.toThrow(WaffoPancakeError);
  });
});

describe("stores.delete", () => {
  it("should delete a store with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { store: { id: "STO_0000000000000000000000", deletedAt: "2026-04-01T00:00:00.000Z" } },
    }));
    const client = createClient(mockFetch);

    const result = await client.stores.delete({ id: "STO_0000000000000000000000" });

    expect(result.store.deletedAt).toBe("2026-04-01T00:00:00.000Z");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store/delete-store");
  });

  it("should reject invalid store ID format", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(client.stores.delete({ id: "PROD_0000000000000000000000" })).rejects.toThrow(WaffoPancakeError);
  });
});
