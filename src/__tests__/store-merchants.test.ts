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

describe("storeMerchants.add", () => {
  it("should add a merchant with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { merchantId: "MER_1111111111111111111111", storeId: "STO_0000000000000000000000", role: "admin" },
    }));
    const client = createClient(mockFetch);

    const result = await client.storeMerchants.add({
      storeId: "STO_0000000000000000000000",
      email: "member@example.com",
      role: "admin",
    });

    expect(result.role).toBe("admin");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store-merchant/add-merchant");
    const body = JSON.parse(options.body as string);
    expect(body.email).toBe("member@example.com");
    expect(body.role).toBe("admin");
  });

  it("should reject invalid role", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.storeMerchants.add({
        storeId: "STO_0000000000000000000000",
        email: "member@example.com",
        role: "owner" as "admin",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("storeMerchants.remove", () => {
  it("should remove a merchant with correct path", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { removed: true },
    }));
    const client = createClient(mockFetch);

    const result = await client.storeMerchants.remove({
      storeId: "STO_0000000000000000000000",
      merchantId: "MER_1111111111111111111111",
    });

    expect(result.removed).toBe(true);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store-merchant/remove-merchant");
  });

  it("should reject invalid merchantId format", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.storeMerchants.remove({
        storeId: "STO_0000000000000000000000",
        merchantId: "bad-id",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});

describe("storeMerchants.updateRole", () => {
  it("should update role with correct path and params", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { merchantId: "MER_1111111111111111111111", role: "member" },
    }));
    const client = createClient(mockFetch);

    const result = await client.storeMerchants.updateRole({
      storeId: "STO_0000000000000000000000",
      merchantId: "MER_1111111111111111111111",
      role: "member",
    });

    expect(result.role).toBe("member");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/store-merchant/update-role");
  });

  it("should reject invalid role value", async () => {
    const client = createClient(createMockFetch(() => ({})));

    await expect(
      client.storeMerchants.updateRole({
        storeId: "STO_0000000000000000000000",
        merchantId: "MER_1111111111111111111111",
        role: "superadmin" as "admin",
      }),
    ).rejects.toThrow(WaffoPancakeError);
  });
});
