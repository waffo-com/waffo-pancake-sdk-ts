import type { HttpClient } from "../http-client.js";
import type {
  CreateOnetimeProductParams,
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
   *   storeId: "sto_xxx",
   *   name: "E-Book",
   *   prices: { USD: { amount: 2900, taxCategory: "digital_goods" } },
   * });
   */
  async create(params: CreateOnetimeProductParams): Promise<{ product: OnetimeProductDetail }> {
    return this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/create-product", params);
  }

  /**
   * Update a one-time product. Creates a new version; skips if unchanged.
   *
   * @param params - Product update parameters (all content fields required)
   * @returns Updated product detail
   *
   * @example
   * const { product } = await client.onetimeProducts.update({
   *   id: "otp_xxx",
   *   name: "E-Book v2",
   *   prices: { USD: { amount: 3900, taxCategory: "digital_goods" } },
   * });
   */
  async update(params: UpdateOnetimeProductParams): Promise<{ product: OnetimeProductDetail }> {
    return this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/update-product", params);
  }

  /**
   * Publish a one-time product's test version to production.
   *
   * @param params - Product to publish
   * @returns Published product detail
   *
   * @example
   * const { product } = await client.onetimeProducts.publish({ id: "otp_xxx" });
   */
  async publish(params: PublishOnetimeProductParams): Promise<{ product: OnetimeProductDetail }> {
    return this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/publish-product", params);
  }

  /**
   * Update a one-time product's status (active/inactive).
   *
   * @param params - Status update parameters
   * @returns Updated product detail
   *
   * @example
   * const { product } = await client.onetimeProducts.updateStatus({
   *   id: "otp_xxx",
   *   status: ProductVersionStatus.Inactive,
   * });
   */
  async updateStatus(params: UpdateOnetimeStatusParams): Promise<{ product: OnetimeProductDetail }> {
    return this.http.post<{ product: OnetimeProductDetail }>("/v1/actions/onetime-product/update-status", params);
  }
}
