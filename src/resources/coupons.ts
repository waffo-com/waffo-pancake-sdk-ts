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
import type { CouponDetail, CreateCouponParams, DeactivateCouponParams, Notice, RequestOptions, UpdateCouponParams } from "../types.js";

/** Coupon (discount code) management resource. Server-side only: requests are signed with the merchant private key. */
export class CouponsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a coupon. The given `code` becomes the coupon's default promotion code.
   *
   * The returned `status` is `active` once the payment provider confirms, or `pending` when the
   * confirmation is still in progress (it resolves automatically). Retry with the same idempotency key:
   * without it, a retry is rejected with 409 because the first request already took the code.
   *
   * @param params - Coupon creation parameters
   * @returns Created coupon
   *
   * @example
   * const { coupon } = await client.coupons.create(
   *   {
   *     storeId: "STO_xxx",
   *     name: "Black Friday 20% off",
   *     code: "BF2026",
   *     discount: { type: CouponDiscountType.Percentage, percentOff: 20 },
   *     duration: CouponDuration.Repeating,
   *     durationInPeriods: 3,
   *   },
   *   { idempotencyKey: "coupon-bf2026" },
   * );
   */
  async create(params: CreateCouponParams, options?: RequestOptions): Promise<{ coupon: CouponDetail; warnings?: Notice[] }> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    validateMaxLength("name", params.name.trim(), 64);
    validateDiscountCode("code", params.code);
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
    return unwrapAction(await this.http.post<{ coupon: CouponDetail }>("/v1/actions/coupon/create-coupon", params, options));
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
