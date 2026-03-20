import { HttpClient } from "./http-client.js";
import { AuthResource } from "./resources/auth.js";
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
 *   merchantId: process.env.WAFFO_MERCHANT_ID!,
 *   privateKey: process.env.WAFFO_PRIVATE_KEY!,
 * });
 *
 * // Create a store
 * const { store } = await client.stores.create({ name: "My Store" });
 *
 * // Create a product
 * const { product } = await client.onetimeProducts.create({
 *   storeId: store.id,
 *   name: "E-Book",
 *   prices: { USD: { amount: 2900, taxCategory: "digital_goods" } },
 * });
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
}
