import { unwrapAction } from "./internal.js";
import { WaffoPancakeError } from "../errors.js";
import { validateCodePrefix, validateDiscountCode, validateShortId, validateRequired } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  CreatePromotionCodeParams,
  DeactivatePromotionCodeParams,
  GeneratePromotionCodesParams,
  Notice,
  PromotionCodeDetail,
  RequestOptions,
} from "../types.js";

/** Promotion code management resource. Server-side only: requests are signed with the merchant private key. */
export class PromotionCodesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a promotion code for a coupon. A random code is generated when `code` is omitted.
   *
   * @param params - Coupon ID, optional code and restrictions
   * @returns Created promotion code
   *
   * @example
   * const { promotionCode } = await client.promotionCodes.create({
   *   couponId: "CPN_xxx",
   *   code: "KOL-ALICE",
   *   restrictions: { maxRedemptions: 100, minimumAmount: { USD: "50.00" } },
   * });
   */
  async create(
    params: CreatePromotionCodeParams,
    options?: RequestOptions,
  ): Promise<{ promotionCode: PromotionCodeDetail; warnings?: Notice[] }> {
    validateShortId("couponId", params.couponId, "CPN");
    if (params.code !== undefined) validateDiscountCode("code", params.code);
    return unwrapAction(
      await this.http.post<{ promotionCode: PromotionCodeDetail }>("/v1/actions/promotion-code/create-promotion-code", params, options),
    );
  }

  /**
   * Generate 1–500 random promotion codes for a coupon in one call.
   *
   * Always retry with the same idempotency key: codes are random, so a retry without it generates another batch.
   *
   * @param params - Coupon ID, count, optional prefix / length / restrictions
   * @returns Batch ID and the generated promotion codes
   *
   * @example
   * const { batchId, promotionCodes } = await client.promotionCodes.generate(
   *   { couponId: "CPN_xxx", count: 100, prefix: "KOL-", restrictions: { maxRedemptions: 1 } },
   *   { idempotencyKey: "kol-batch-2026-11" },
   * );
   */
  async generate(
    params: GeneratePromotionCodesParams,
    options?: RequestOptions,
  ): Promise<{ batchId: string; promotionCodes: PromotionCodeDetail[]; warnings?: Notice[] }> {
    validateShortId("couponId", params.couponId, "CPN");
    validateRequired("count", params.count);
    if (!Number.isInteger(params.count) || params.count < 1 || params.count > 500) {
      throw new WaffoPancakeError(400, [
        { message: `Invalid count: expected integer between 1 and 500, got ${params.count}`, layer: "sdk" },
      ]);
    }
    if (params.prefix !== undefined) validateCodePrefix("prefix", params.prefix);
    if (params.length !== undefined && (!Number.isInteger(params.length) || params.length < 8 || params.length > 16)) {
      throw new WaffoPancakeError(400, [
        { message: `Invalid length: expected integer between 8 and 16, got ${params.length}`, layer: "sdk" },
      ]);
    }
    return unwrapAction(
      await this.http.post<{ batchId: string; promotionCodes: PromotionCodeDetail[] }>(
        "/v1/actions/promotion-code/generate-promotion-codes",
        params,
        options,
      ),
    );
  }

  /**
   * Deactivate a promotion code permanently. Its code is released and can be used by a new promotion code.
   * The coupon itself stays active; deactivate the coupon to stop all of its codes.
   *
   * @param params - Promotion code ID
   * @returns Deactivated promotion code
   *
   * @example
   * const { promotionCode } = await client.promotionCodes.deactivate({ id: "PMC_xxx" });
   * // promotionCode.status === PromotionCodeStatus.Inactive
   */
  async deactivate(
    params: DeactivatePromotionCodeParams,
    options?: RequestOptions,
  ): Promise<{ promotionCode: PromotionCodeDetail; warnings?: Notice[] }> {
    validateShortId("id", params.id, "PMC");
    return unwrapAction(
      await this.http.post<{ promotionCode: PromotionCodeDetail }>("/v1/actions/promotion-code/deactivate-promotion-code", params, options),
    );
  }
}
