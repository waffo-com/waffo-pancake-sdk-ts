import type { HttpClient } from "../http-client.js";
import type {
  CreateSubscriptionProductParams,
  PublishSubscriptionProductParams,
  SubscriptionProductDetail,
  UpdateSubscriptionProductParams,
  UpdateSubscriptionStatusParams,
} from "../types.js";

/** Subscription product management resource. */
export class SubscriptionProductsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a subscription product with billing period and multi-currency pricing.
   *
   * @param params - Product creation parameters
   * @returns Created product detail
   *
   * @example
   * const { product } = await client.subscriptionProducts.create({
   *   storeId: "store_xxx",
   *   name: "Pro Plan",
   *   billingPeriod: "monthly",
   *   prices: { USD: { amount: 999, taxIncluded: false, taxCategory: "saas" } },
   * });
   */
  async create(params: CreateSubscriptionProductParams): Promise<{ product: SubscriptionProductDetail }> {
    return this.http.post("/v1/actions/subscription-product/create-product", params);
  }

  /**
   * Update a subscription product. Creates a new version; skips if unchanged.
   *
   * @param params - Product update parameters (all content fields required)
   * @returns Updated product detail
   *
   * @example
   * const { product } = await client.subscriptionProducts.update({
   *   id: "prod_xxx",
   *   name: "Pro Plan v2",
   *   billingPeriod: "monthly",
   *   prices: { USD: { amount: 1499, taxIncluded: false, taxCategory: "saas" } },
   * });
   */
  async update(params: UpdateSubscriptionProductParams): Promise<{ product: SubscriptionProductDetail }> {
    return this.http.post("/v1/actions/subscription-product/update-product", params);
  }

  /**
   * Publish a subscription product's test version to production.
   *
   * @param params - Product to publish
   * @returns Published product detail
   *
   * @example
   * const { product } = await client.subscriptionProducts.publish({ id: "prod_xxx" });
   */
  async publish(params: PublishSubscriptionProductParams): Promise<{ product: SubscriptionProductDetail }> {
    return this.http.post("/v1/actions/subscription-product/publish-product", params);
  }

  /**
   * Update a subscription product's status (active/inactive).
   *
   * @param params - Status update parameters
   * @returns Updated product detail
   *
   * @example
   * const { product } = await client.subscriptionProducts.updateStatus({
   *   id: "prod_xxx",
   *   status: ProductVersionStatus.Active,
   * });
   */
  async updateStatus(params: UpdateSubscriptionStatusParams): Promise<{ product: SubscriptionProductDetail }> {
    return this.http.post("/v1/actions/subscription-product/update-status", params);
  }
}
