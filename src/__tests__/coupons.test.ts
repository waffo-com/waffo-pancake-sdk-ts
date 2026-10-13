import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";

const { privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const STORE_ID = "STO_0000000000000000000000";
const COUPON_ID = "CPN_0000000000000000000000";
const PROMOTION_CODE_ID = "PMC_0000000000000000000000";

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

describe("coupons.create", () => {
  it("posts to create-coupon and forwards the idempotency key", async () => {
    const mockFetch = createMockFetch(() => ({ data: { coupon: { id: COUPON_ID, code: "BF2026", status: "active" } } }));
    const client = createClient(mockFetch);

    const { coupon } = await client.coupons.create(
      {
        storeId: STORE_ID,
        name: "Black Friday",
        code: "bf2026",
        discount: { type: "percentage", percentOff: 20 },
        duration: "repeating",
        durationInPeriods: 3,
      },
      { idempotencyKey: "coupon-bf2026" },
    );

    expect(coupon.id).toBe(COUPON_ID);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/coupon/create-coupon");
    expect(JSON.parse(options.body as string)).toMatchObject({ code: "bf2026", discount: { type: "percentage", percentOff: 20 } });
    expect((options.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("coupon-bf2026");
  });

  it.each([
    ["invalid code", { code: "a_b" }],
    ["repeating without durationInPeriods", { duration: "repeating" }],
    ["fixed amount without currencies", { discount: { type: "fixed_amount", amountOff: {} } }],
    ["invalid amount", { discount: { type: "fixed_amount", amountOff: { USD: "abc" } } }],
    ["invalid product ID", { productIds: ["STO_0000000000000000000000"] }],
  ])("rejects %s before sending", async (_label, override) => {
    const mockFetch = createMockFetch(() => ({}));
    const client = createClient(mockFetch);
    await expect(
      client.coupons.create({
        storeId: STORE_ID,
        name: "Black Friday",
        code: "BF2026",
        discount: { type: "percentage", percentOff: 20 },
        ...override,
      } as never),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("coupons.update / deactivate", () => {
  it("posts to update-coupon and deactivate-coupon", async () => {
    const mockFetch = createMockFetch(() => ({ data: { coupon: { id: COUPON_ID } } }));
    const client = createClient(mockFetch);

    await client.coupons.update({ id: COUPON_ID, name: "Renamed" });
    await client.coupons.deactivate({ id: COUPON_ID });

    expect(mockFetch.mock.calls[0][0]).toBe("https://api.test.com/v1/actions/coupon/update-coupon");
    expect(mockFetch.mock.calls[1][0]).toBe("https://api.test.com/v1/actions/coupon/deactivate-coupon");
  });

  it("rejects a non-coupon ID", async () => {
    const client = createClient(createMockFetch(() => ({})));
    await expect(client.coupons.deactivate({ id: PROMOTION_CODE_ID })).rejects.toThrow(WaffoPancakeError);
  });
});

describe("promotionCodes", () => {
  it("create posts to create-promotion-code; code is optional", async () => {
    const mockFetch = createMockFetch(() => ({ data: { promotionCode: { id: PROMOTION_CODE_ID, code: "X7K2M9PQ4R" } } }));
    const client = createClient(mockFetch);

    const { promotionCode } = await client.promotionCodes.create({ couponId: COUPON_ID, restrictions: { maxRedemptions: 1 } });

    expect(promotionCode.id).toBe(PROMOTION_CODE_ID);
    expect(mockFetch.mock.calls[0][0]).toBe("https://api.test.com/v1/actions/promotion-code/create-promotion-code");
  });

  it("generate returns batchId and codes", async () => {
    const mockFetch = createMockFetch(() => ({ data: { batchId: "batch-1", promotionCodes: [{ id: PROMOTION_CODE_ID }] } }));
    const client = createClient(mockFetch);

    const result = await client.promotionCodes.generate({ couponId: COUPON_ID, count: 1, prefix: "KOL-" }, { idempotencyKey: "kol-1" });

    expect(result.batchId).toBe("batch-1");
    expect(result.promotionCodes).toHaveLength(1);
    expect(mockFetch.mock.calls[0][0]).toBe("https://api.test.com/v1/actions/promotion-code/generate-promotion-codes");
  });

  it.each([0, 501, 1.5])("generate rejects count %s", async (count) => {
    const mockFetch = createMockFetch(() => ({}));
    const client = createClient(mockFetch);
    await expect(client.promotionCodes.generate({ couponId: COUPON_ID, count })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deactivate posts to deactivate-promotion-code and validates the PMC prefix", async () => {
    const mockFetch = createMockFetch(() => ({ data: { promotionCode: { id: PROMOTION_CODE_ID, status: "inactive" } } }));
    const client = createClient(mockFetch);

    await client.promotionCodes.deactivate({ id: PROMOTION_CODE_ID });
    expect(mockFetch.mock.calls[0][0]).toBe("https://api.test.com/v1/actions/promotion-code/deactivate-promotion-code");
    await expect(client.promotionCodes.deactivate({ id: COUPON_ID })).rejects.toThrow(WaffoPancakeError);
  });
});
