import { unwrapAction } from "./internal.js";
import { validateAmountString, validateCurrencyCode, validateMaxLength, validateRequired, validateShortId } from "../validation.js";

import type { CustomerHttpClient } from "../customer-http-client.js";
import type {
  CancelOnetimeOrderParams,
  CancelOnetimeOrderResult,
  CancelSubscriptionParams,
  CancelSubscriptionResult,
  CheckoutSessionResult,
  CreateRefundTicketParams,
  CustomerPlanChangeParams,
  GraphQLParams,
  GraphQLResponse,
  Notice,
  ReactivateSubscriptionParams,
  ReactivateSubscriptionResult,
  RefundTicket,
  ResubmitRefundTicketParams,
} from "../types.js";

/**
 * Customer session — lets authenticated customers manage their own orders and subscriptions.
 *
 * Created via `client.customer(token)` using a session token issued by
 * `client.auth.issueSessionToken()`. All requests use Bearer token authentication.
 *
 * **These requests carry no idempotency key.** The API Key client derives one per
 * write and the gateway deduplicates on it; customer session actions are outside
 * that cache by design, so a write retried after a timeout can execute twice.
 * Guard retries on your side where a duplicate would matter.
 *
 * @example
 * const { token } = await client.auth.issueSessionToken({
 *   storeId: "STO_xxx",
 *   buyerIdentity: "customer@example.com",
 * });
 * const customer = client.customer(token);
 * await customer.cancelSubscription({ orderId: "ORD_xxx" });
 */
export class CustomerSession {
  /** GraphQL query access scoped to the customer's data. */
  readonly graphql: CustomerGraphQL;

  constructor(private readonly http: CustomerHttpClient) {
    this.graphql = new CustomerGraphQL(http);
  }

  /**
   * Cancel a subscription order.
   *
   * @param params - Order to cancel
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await customer.cancelSubscription({ orderId: "ORD_xxx" });
   * // status: "canceled" (was pending)
   * //      or "canceling" (was active — stops at the end of the current period)
   * //      or "canceling" (was past_due — stops immediately)
   */
  async cancelSubscription(params: CancelSubscriptionParams): Promise<CancelSubscriptionResult & { warnings?: Notice[] }> {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post<CancelSubscriptionResult>("/v1/actions/subscription-order/cancel-order", params));
  }

  /**
   * Cancel a one-time order (only while payment is still pending).
   *
   * @param params - Order to cancel
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await customer.cancelOnetimeOrder({ orderId: "ORD_xxx" });
   */
  async cancelOnetimeOrder(params: CancelOnetimeOrderParams): Promise<CancelOnetimeOrderResult & { warnings?: Notice[] }> {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post<CancelOnetimeOrderResult>("/v1/actions/onetime-order/cancel-order", params));
  }

  /**
   * Reactivate a subscription that is in `canceling` status.
   *
   * A subscription that had an unpaid charge at the moment cancellation was
   * requested is refused with 400 (`Subscription with an unpaid balance cannot
   * be reactivated`), which is worded differently from the 400 returned when
   * the order is not in `canceling` status. Cancelling a `past_due`
   * subscription always falls into the former category.
   *
   * @param params - Order to reactivate
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await customer.reactivateSubscription({ orderId: "ORD_xxx" });
   * // status: "active"
   */
  async reactivateSubscription(params: ReactivateSubscriptionParams): Promise<ReactivateSubscriptionResult & { warnings?: Notice[] }> {
    validateShortId("orderId", params.orderId, "ORD");
    return unwrapAction(await this.http.post<ReactivateSubscriptionResult>("/v1/actions/subscription-order/reactivate-order", params));
  }

  /**
   * Submit a refund request for a payment.
   *
   * @param params - Refund ticket details
   * @returns Created refund ticket
   *
   * @example
   * const { ticket } = await customer.createRefundTicket({
   *   paymentId: "PAY_xxx",
   *   reason: "Product not as described",
   *   requestedAmount: { amount: "29.00", currency: "USD" },
   *   refundTicketMerchantExternalId: "REF-2026-00891",
   * });
   */
  async createRefundTicket(params: CreateRefundTicketParams): Promise<{ ticket: RefundTicket; warnings?: Notice[] }> {
    validateShortId("paymentId", params.paymentId, "PAY");
    validateRequired("reason", params.reason);
    validateAmountString("requestedAmount.amount", params.requestedAmount.amount);
    validateCurrencyCode("requestedAmount.currency", params.requestedAmount.currency);
    validateMaxLength("refundTicketMerchantExternalId", params.refundTicketMerchantExternalId, 128);
    return unwrapAction(await this.http.post<{ ticket: RefundTicket }>("/v1/actions/refund-ticket/create-ticket", params));
  }

  /**
   * Resubmit a previously rejected refund ticket with updated details.
   *
   * @param params - Updated ticket details
   * @returns Updated refund ticket
   *
   * @example
   * const { ticket } = await customer.resubmitRefundTicket({
   *   ticketId: "TKT_xxx",
   *   paymentId: "PAY_xxx",
   *   reason: "Updated reason with more detail",
   *   requestedAmount: { amount: "29.00", currency: "USD" },
   * });
   */
  async resubmitRefundTicket(params: ResubmitRefundTicketParams): Promise<{ ticket: RefundTicket; warnings?: Notice[] }> {
    validateShortId("ticketId", params.ticketId, "TKT");
    validateShortId("paymentId", params.paymentId, "PAY");
    validateRequired("reason", params.reason);
    validateAmountString("requestedAmount.amount", params.requestedAmount.amount);
    validateCurrencyCode("requestedAmount.currency", params.requestedAmount.currency);
    return unwrapAction(await this.http.post<{ ticket: RefundTicket }>("/v1/actions/refund-ticket/resubmit-ticket", params));
  }

  /**
   * Create a plan-change session for one of the customer's own subscriptions —
   * the self-service half of a plan change. Returns a URL to send them to, where
   * they confirm the change.
   *
   * The platform applies three checks to a customer-issued link that it does not
   * apply to a merchant-issued one, each with its own 403:
   * - **Ownership** — the subscription must belong to this session's customer
   *   (its `buyerIdentity` and store must match the token), else
   *   `Subscription order does not belong to this credential`
   * - **Same group** — the target plan must sit in the same product group as the
   *   current plan, else `Target plan is not in the same product group as the current plan`
   * - **Switch on** — that group's `selfServicePlanChange` rule must be on, else
   *   `Self-service plan change is not enabled for this product group`.
   *   Open it with `client.subscriptionProductGroups.update()`
   *
   * A merchant issuing the link with the API Key
   * (`client.checkout.createPlanChangeSession()`) is subject to none of the three
   * and may switch a subscription to any plan, group or not.
   *
   * The API-Key-only fields are absent from the params by construction — the
   * platform would drop them here without saying so. Like every call on this
   * session it carries no idempotency key, so a retry after a timeout can issue a
   * second session rather than returning the first.
   *
   * @param params - Plan change parameters; `originOrderId` identifies the subscription
   * @returns Session ID, confirmation page URL, and expiration
   *
   * @example
   * const session = await customer.createPlanChangeSession({
   *   originOrderId: "ORD_xxx",
   *   productId: "PROD_target_plan",
   *   currency: "USD",
   * });
   * // Send the customer to session.checkoutUrl
   */
  async createPlanChangeSession(params: CustomerPlanChangeParams): Promise<CheckoutSessionResult & { warnings?: Notice[] }> {
    validateShortId("originOrderId", params.originOrderId, "ORD");
    validateShortId("productId", params.productId, "PROD");
    validateCurrencyCode("currency", params.currency);
    return unwrapAction(await this.http.post<CheckoutSessionResult>("/v1/actions/checkout/create-session", params));
  }
}

/**
 * GraphQL access scoped to the customer's session token.
 */
class CustomerGraphQL {
  constructor(private readonly http: CustomerHttpClient) {}

  /**
   * Execute a GraphQL query scoped to the customer's data.
   *
   * @param params - GraphQL query and variables
   * @returns GraphQL response
   *
   * @example
   * const result = await customer.graphql.query({
   *   query: `query { orders { id status } }`,
   * });
   */
  async query<T = Record<string, unknown>>(params: GraphQLParams): Promise<GraphQLResponse<T>> {
    validateRequired("query", params.query);
    const result = await this.http.post<T>("/v1/graphql", params);
    return { data: result.data, errors: result.errors, warnings: result.warnings };
  }
}
