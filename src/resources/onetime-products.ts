import { unwrapAction } from "./internal.js";
import { validateEnum, validatePrices, validateRequired, validateShortId } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type {
  CreateOnetimeProductParams,
  Notice,
  OnetimeProductDetail,
  PublishOnetimeProductParams,
  UpdateOnetimeProductParams,
  UpdateOnetimeStatusParams,
} from "../types.js";

/** One-time product management resource. */
export class OnetimeProductsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a one-time product with multi-currency pricing.
   *
   * @param params - Product creation parameters
   * @returns Created product detail
   *
   * @example
   * const { product } = await client.onetimeProducts.create({
   *   storeId: "STO_xxx",
   *   name: "E-Book",
   *   prices: { USD: { amount: "29.00", taxCategory: "digital_goods" } },
   * });
   */
  async create(params: CreateOnetimeProductParams): Promise<{ product: OnetimeProductDetail; warnings?: Notice[] }> {
    validateShortId("storeId", params.storeId, "STO");
    validateRequired("name", params.name);
    validatePrices("prices", params.prices);
    return unwrapAction(await this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/create-product", params));
  }

  /**
   * Update a one-time product. Creates a new version; skips if unchanged.
   *
   * @param params - Product update parameters (only `id` is required)
   * @returns Updated product detail
   *
   * @example
   * // Update only the name
   * const { product } = await client.onetimeProducts.update({
   *   id: "PROD_xxx",
   *   name: "E-Book v2",
   * });
   *
   * @example
   * // Update prices while preserving other fields
   * const { product } = await client.onetimeProducts.update({
   *   id: "PROD_xxx",
   *   prices: { USD: { amount: "39.00", taxCategory: "digital_goods" } },
   * });
   */
  async update(params: UpdateOnetimeProductParams): Promise<{ product: OnetimeProductDetail; warnings?: Notice[] }> {
    validateShortId("id", params.id, "PROD");
    if (params.name !== undefined) validateRequired("name", params.name);
    if (params.prices) validatePrices("prices", params.prices);
    return unwrapAction(await this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/update-product", params));
  }

  /**
   * Publish a one-time product's test version to production.
   *
   * @param params - Product to publish
   * @returns Published product detail
   *
   * @example
   * const { product } = await client.onetimeProducts.publish({ id: "PROD_xxx" });
   */
  async publish(params: PublishOnetimeProductParams): Promise<{ product: OnetimeProductDetail; warnings?: Notice[] }> {
    validateShortId("id", params.id, "PROD");
    return unwrapAction(await this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/publish-product", params));
  }

  /**
   * Update a one-time product's status (active/inactive).
   *
   * @param params - Status update parameters
   * @returns Updated product detail
   *
   * @example
   * const { product } = await client.onetimeProducts.updateStatus({
   *   id: "PROD_xxx",
   *   status: ProductVersionStatus.Inactive,
   * });
   */
  async updateStatus(params: UpdateOnetimeStatusParams): Promise<{ product: OnetimeProductDetail; warnings?: Notice[] }> {
    validateShortId("id", params.id, "PROD");
    validateEnum("status", params.status, ["active", "inactive"]);
    return unwrapAction(await this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/update-status", params));
  }
}
