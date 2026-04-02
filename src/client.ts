import { BuyerHttpClient } from "./buyer-http-client.js";
import { HttpClient } from "./http-client.js";
import { AuthResource } from "./resources/auth.js";
import { BuyerSession } from "./resources/buyer.js";
import { CheckoutResource } from "./resources/checkout.js";
import { GraphQLResource } from "./resources/graphql.js";
import { OnetimeProductsResource } from "./resources/onetime-products.js";
import { OrdersResource } from "./resources/orders.js";
import { StoreMerchantsResource } from "./resources/store-merchants.js";
import { StoresResource } from "./resources/stores.js";
import { SubscriptionProductGroupsResource } from "./resources/subscription-product-groups.js";
import { SubscriptionProductsResource } from "./resources/subscription-products.js";
import { WebhooksResource } from "./resources/webhooks.js";

import type { WaffoPancakeConfig } from "./types.js";

/**
 * Waffo Pancake TypeScript SDK client.
 *
 * Uses Merchant API Key (RSA-SHA256) authentication. All requests are
 * automatically signed — no manual header construction needed.
 *
 * @example
 * import { WaffoPancake } from "@waffo/pancake-ts";
 *
 * const client = new WaffoPancake({
 *   merchantId: "MER_2D5F8G3H1K4M6N9P0Q7R8S", // MER_{base62} format
 *   privateKey: process.env.WAFFO_PRIVATE_KEY!,
 * });
 *
 * // Create a store — IDs are returned in {prefix}_{base62} format
 * const { store } = await client.stores.create({ name: "My Store" });
 * // => store.id = "STO_..."
 *
 * // Create a product
 * const { product } = await client.onetimeProducts.create({
 *   storeId: store.id, // "STO_..."
 *   name: "E-Book",
 *   prices: { USD: { amount: "29.00", taxCategory: "digital_goods" } },
 * });
 * // => product.id = "PROD_..."
 *
 * // Create a checkout session
 * const session = await client.checkout.createSession({
 *   storeId: store.id,
 *   productId: product.id,
 *   productType: "onetime",
 *   currency: "USD",
 * });
 * // => redirect customer to session.checkoutUrl
 *
 * // Query data via GraphQL
 * const result = await client.graphql.query({
 *   query: `query { stores { id name status } }`,
 * });
 *
 * @example
 * // Per-environment webhook public keys
 * const client = new WaffoPancake({
 *   merchantId: "...",
 *   privateKey: "...",
 *   webhookPublicKey: {
 *     test: process.env.WAFFO_TEST_PUB_KEY!,
 *     prod: process.env.WAFFO_PROD_PUB_KEY!,
 *   },
 * });
 * const event = client.webhooks.verify(rawBody, signatureHeader);
 */
export class WaffoPancake {
  private readonly http: HttpClient;
  private readonly config: WaffoPancakeConfig;

  readonly auth: AuthResource;
  readonly stores: StoresResource;
  readonly storeMerchants: StoreMerchantsResource;
  readonly onetimeProducts: OnetimeProductsResource;
  readonly subscriptionProducts: SubscriptionProductsResource;
  readonly subscriptionProductGroups: SubscriptionProductGroupsResource;
  readonly orders: OrdersResource;
  readonly checkout: CheckoutResource;
  readonly graphql: GraphQLResource;
  readonly webhooks: WebhooksResource;

  constructor(config: WaffoPancakeConfig) {
    this.config = config;
    this.http = new HttpClient(config);

    this.auth = new AuthResource(this.http);
    this.stores = new StoresResource(this.http);
    this.storeMerchants = new StoreMerchantsResource(this.http);
    this.onetimeProducts = new OnetimeProductsResource(this.http);
    this.subscriptionProducts = new SubscriptionProductsResource(this.http);
    this.subscriptionProductGroups = new SubscriptionProductGroupsResource(this.http);
    this.orders = new OrdersResource(this.http);
    this.checkout = new CheckoutResource(this.http);
    this.graphql = new GraphQLResource(this.http);
    this.webhooks = new WebhooksResource(config.webhookPublicKey);
  }

  /**
   * Create a buyer session for self-service operations.
   *
   * The returned session uses Bearer token authentication and provides
   * methods for order cancellation, subscription management, refund tickets,
   * and scoped GraphQL queries.
   *
   * @param token - Session token from `client.auth.issueSessionToken()`
   * @returns A buyer session with self-service methods
   *
   * @example
   * const { token } = await client.auth.issueSessionToken({
   *   storeId: "STO_xxx",
   *   buyerIdentity: "customer@example.com",
   * });
   * const buyer = client.buyer(token);
   * await buyer.cancelSubscription({ orderId: "ORD_xxx" });
   */
  buyer(token: string): BuyerSession {
    const buyerHttp = new BuyerHttpClient(token, {
      baseUrl: this.config.baseUrl,
      fetch: this.config.fetch,
    });
    return new BuyerSession(buyerHttp);
  }
}
