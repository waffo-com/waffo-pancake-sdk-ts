import { unwrapAction } from "./internal.js";
import { WaffoPancakeError } from "../errors.js";
import { CouponDiscountType, CouponDuration } from "../types.js";
import {
  validateCurrencyCode,
  validateDiscountCode,
  validateEnum,
  validateMaxLength,
  validatePositiveAmountString,
  validatePositiveInteger,
  validateRequired,
  validateShortId,
} from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  CouponDetail,
  CreateCouponParams,
  CreatedCouponDetail,
  DeactivateCouponParams,
  Notice,
  RequestOptions,
  UpdateCouponParams,
} from "../types.js";

/** Coupon (discount code) management resource. Server-side only: requests are signed with the merchant private key. */
export class CouponsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a coupon with its own code, optionally with up to 20 promotion codes in the same request.
   *
   * Buyers enter the coupon's `code` (random when omitted) or one of its promotion codes; `couponId` applies the
   * coupon without a code. A coupon only limits redemptions by `redeemBy` and `maxRedemptions`; put buyer
   * restrictions (first purchase, emails, per-buyer and daily limits, minimum amount) on promotion codes. The
   * returned `status` is always `active` and `coupon.promotionCodes` lists the codes created with it. When the
   * payment provider rejects the coupon or does not confirm it, the request fails with 502 and every code is
   * released, so it can be created again with the same codes. A code already used by an active code of the store
   * fails with 409 and the message names it. If the request itself fails on your side (timeout, network), retry with the same
   * idempotency key: a creation that succeeded is returned instead of a 409 for the codes it already took.
   *
   * @param params - Coupon creation parameters
   * @returns Created coupon with its promotion codes
   *
   * @example
   * const { coupon } = await client.coupons.create(
   *   {
   *     storeId: "STO_xxx",
   *     name: "Black Friday 20% off",
   *     discount: { type: CouponDiscountType.Percentage, percentOff: 20 },
   *     duration: CouponDuration.Repeating,
   *     durationInPeriods: 3,
   *     code: "BF2026",
   *     maxRedemptions: 1000,
   *     promotionCodes: [{ code: "BF-VIP" }, { restrictions: { firstTimeOnly: true, dailyRedemptionLimit: 1 } }],
   *   },
   *   { idempotencyKey: "coupon-bf2026" },
   * );
   * // coupon.code => "BF2026"
   * // coupon.promotionCodes.map((p) => p.code) => ["BF-VIP", "X7K2M9PQ4R"]
   *
   * @example
   * // No code given: a random one is generated; the coupon can also be applied with `couponId`
   * const { coupon } = await client.coupons.create({
   *   storeId: "STO_xxx",
   *   name: "Partner discount",
   *   discount: { type: CouponDiscountType.FixedAmount, amountOff: { USD: "5.00" } },
   * });
   * // coupon.code => "K7Q2M9X4PA", coupon.promotionCodes => []
   */
  async create(params: CreateCouponParams, options?: RequestOptions): Promise<{ coupon: CreatedCouponDetail; warnings?: Notice[] }> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    validateMaxLength("name", params.name.trim(), 64);
    // The coupon's code and its promotion codes share the store's code namespace, so they cannot repeat in a request
    const seen = new Set<string>();
    if (params.code !== undefined) {
      validateDiscountCode("code", params.code);
      seen.add(params.code.trim().toUpperCase());
    }
    if (params.promotionCodes !== undefined) {
      if (!Array.isArray(params.promotionCodes) || params.promotionCodes.length > 20) {
        throw new WaffoPancakeError(400, [{ message: "Invalid promotionCodes: expected an array of at most 20 entries", layer: "sdk" }]);
      }
      params.promotionCodes.forEach((promotionCode, index) => {
        if (promotionCode?.code === undefined) return;
        validateDiscountCode(`promotionCodes[${index}].code`, promotionCode.code);
        const normalized = promotionCode.code.trim().toUpperCase();
        if (seen.has(normalized)) {
          throw new WaffoPancakeError(400, [{ message: `Duplicate promotionCodes code: "${normalized}"`, layer: "sdk" }]);
        }
        seen.add(normalized);
      });
    }
    validateRequired("discount", params.discount);
    validateEnum("discount.type", params.discount.type, Object.values(CouponDiscountType));
    if (params.discount.type === CouponDiscountType.Percentage) {
      validateRequired("discount.percentOff", params.discount.percentOff);
      const percentOff = params.discount.percentOff;
      if (!(percentOff > 0 && percentOff <= 100)) {
        throw new WaffoPancakeError(400, [
          { message: `Invalid discount.percentOff: expected a value above 0 and up to 100, got ${percentOff}`, layer: "sdk" },
        ]);
      }
    } else {
      const entries = Object.entries(params.discount.amountOff ?? {});
      if (entries.length === 0) validateRequired("discount.amountOff", undefined);
      for (const [currency, amount] of entries) {
        validateCurrencyCode(`discount.amountOff.${currency} (key)`, currency);
        validatePositiveAmountString(`discount.amountOff.${currency}`, amount);
      }
    }
    if (params.duration !== undefined) validateEnum("duration", params.duration, Object.values(CouponDuration));
    if (params.duration === CouponDuration.Repeating) {
      validateRequired("durationInPeriods", params.durationInPeriods);
      validatePositiveInteger("durationInPeriods", params.durationInPeriods as number);
    } else if (params.durationInPeriods !== undefined && params.durationInPeriods !== null) {
      throw new WaffoPancakeError(400, [{ message: "durationInPeriods is only allowed when duration is repeating", layer: "sdk" }]);
    }
    for (const productId of params.productIds ?? []) validateShortId("productIds[]", productId, "PROD");
    return unwrapAction(await this.http.post<{ coupon: CreatedCouponDetail }>("/v1/actions/coupon/create-coupon", params, options));
  }

  /**
   * Rename a coupon. The name is the only field that can change; create a new coupon to change the discount.
   *
   * @param params - Coupon ID and new name
   * @returns Updated coupon
   *
   * @example
   * const { coupon } = await client.coupons.update({ id: "CPN_xxx", name: "Black Friday (extended)" });
   */
  async update(params: UpdateCouponParams, options?: RequestOptions): Promise<{ coupon: CouponDetail; warnings?: Notice[] }> {
    validateShortId("id", params.id, "CPN");
    validateRequired("name", params.name);
    validateMaxLength("name", params.name.trim(), 64);
    return unwrapAction(await this.http.post<{ coupon: CouponDetail }>("/v1/actions/coupon/update-coupon", params, options));
  }

  /**
   * Deactivate a coupon permanently. All its promotion codes are deactivated and their codes released.
   * Discounts already attached to subscriptions continue until the subscription's next plan change.
   * Calling it again returns the coupon unchanged.
   *
   * @param params - Coupon ID
   * @returns Deactivated coupon
   *
   * @example
   * const { coupon } = await client.coupons.deactivate({ id: "CPN_xxx" });
   * // coupon.status === CouponStatus.Inactive
   */
  async deactivate(params: DeactivateCouponParams, options?: RequestOptions): Promise<{ coupon: CouponDetail; warnings?: Notice[] }> {
    validateShortId("id", params.id, "CPN");
    return unwrapAction(await this.http.post<{ coupon: CouponDetail }>("/v1/actions/coupon/deactivate-coupon", params, options));
  }
}
