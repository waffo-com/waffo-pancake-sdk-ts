import { generateKeyPairSync } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { WaffoPancake } from "../client.js";
import { WaffoPancakeError } from "../errors.js";
import { CouponDiscountType, CouponDuration } from "../types.js";

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
  it("posts to create-coupon with promotion codes and forwards the idempotency key", async () => {
    const mockFetch = createMockFetch(() => ({
      data: { coupon: { id: COUPON_ID, status: "active", promotionCodes: [{ id: PROMOTION_CODE_ID, code: "BF2026" }] } },
    }));
    const client = createClient(mockFetch);

    const { coupon } = await client.coupons.create(
      {
        storeId: STORE_ID,
        name: "Black Friday",
        discount: { type: CouponDiscountType.Percentage, percentOff: 20 },
        duration: CouponDuration.Repeating,
        durationInPeriods: 3,
        promotionCodes: [{ code: "bf2026" }, { restrictions: { maxRedemptions: 100 } }],
      },
      { idempotencyKey: "coupon-bf2026" },
    );

    expect(coupon.id).toBe(COUPON_ID);
    expect(coupon.promotionCodes[0].code).toBe("BF2026");
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.test.com/v1/actions/coupon/create-coupon");
    const body = JSON.parse(options.body as string);
    expect(body).toMatchObject({
      discount: { type: "percentage", percentOff: 20 },
      promotionCodes: [{ code: "bf2026" }, { restrictions: { maxRedemptions: 100 } }],
    });
    expect(body).not.toHaveProperty("code");
    expect((options.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("coupon-bf2026");
  });

  it.each([
    ["invalid promotion code", { promotionCodes: [{ code: "a_b" }] }],
    ["duplicate promotion codes (case-insensitive)", { promotionCodes: [{ code: "vip-01" }, { code: "VIP-01" }] }],
    ["more than 20 promotion codes", { promotionCodes: Array.from({ length: 21 }, () => ({})) }],
    ["promotionCodes that is not an array", { promotionCodes: { code: "BF2026" } }],
    ["repeating without durationInPeriods", { duration: "repeating" }],
    ["fixed amount without currencies", { discount: { type: "fixed_amount", amountOff: {} } }],
    ["invalid amount", { discount: { type: "fixed_amount", amountOff: { USD: "abc" } } }],
    ["zero amount", { discount: { type: "fixed_amount", amountOff: { USD: "0" } } }],
    ["zero amount with decimals", { discount: { type: "fixed_amount", amountOff: { USD: "0.00" } } }],
    ["unknown duration", { duration: "weekly" }],
    ["unknown discount type", { discount: { type: "free_shipping" } }],
    ["name over 64 characters", { name: "优".repeat(65) }],
    ["invalid product ID", { productIds: ["STO_0000000000000000000000"] }],
    ["percentOff above 100", { discount: { type: "percentage", percentOff: 101 } }],
    ["durationInPeriods without repeating", { duration: "once", durationInPeriods: 3 }],
  ])("rejects %s before sending", async (_label, override) => {
    const mockFetch = createMockFetch(() => ({}));
    const client = createClient(mockFetch);
    await expect(
      client.coupons.create({
        storeId: STORE_ID,
        name: "Black Friday",
        discount: { type: CouponDiscountType.Percentage, percentOff: 20 },
        ...override,
      } as never),
    ).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("accepts a positive fixed amount and a 64-character multibyte name", async () => {
    const mockFetch = createMockFetch(() => ({ data: { coupon: { id: COUPON_ID } } }));
    const client = createClient(mockFetch);

    await client.coupons.create({
      storeId: STORE_ID,
      name: "优".repeat(64),
      discount: { type: CouponDiscountType.FixedAmount, amountOff: { USD: "0.01", JPY: "500" } },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("accepts 20 promotion codes, codes omitted or given", async () => {
    const mockFetch = createMockFetch(() => ({ data: { coupon: { id: COUPON_ID, promotionCodes: [] } } }));
    const client = createClient(mockFetch);

    await client.coupons.create({
      storeId: STORE_ID,
      name: "Bulk",
      discount: { type: CouponDiscountType.Percentage, percentOff: 10 },
      promotionCodes: [{ code: "VIP-01" }, ...Array.from({ length: 19 }, () => ({}))],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
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

  it.each([
    ["prefix with invalid characters", { prefix: "KOL_" }],
    ["length below 8", { length: 7 }],
  ])("generate rejects %s", async (_label, override) => {
    const mockFetch = createMockFetch(() => ({}));
    const client = createClient(mockFetch);
    await expect(client.promotionCodes.generate({ couponId: COUPON_ID, count: 1, ...override })).rejects.toThrow(WaffoPancakeError);
    expect(mockFetch).not.toHaveBeenCalled();
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
