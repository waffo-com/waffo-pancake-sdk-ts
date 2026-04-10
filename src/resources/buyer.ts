import { validateAmountString, validateCurrencyCode, validateRequired, validateShortId } from "../validation.js";

import type { BuyerHttpClient } from "../buyer-http-client.js";
import type {
  CancelOnetimeOrderParams,
  CancelOnetimeOrderResult,
  CancelSubscriptionParams,
  CancelSubscriptionResult,
  CreateRefundTicketParams,
  GraphQLParams,
  GraphQLResponse,
  ReactivateSubscriptionParams,
  ReactivateSubscriptionResult,
  RefundTicket,
  ResubmitRefundTicketParams,
} from "../types.js";

/**
 * Buyer session — lets authenticated buyers manage their own orders and subscriptions.
 *
 * Created via `client.buyer(token)` using a session token issued by
 * `client.auth.issueSessionToken()`. All requests use Bearer token authentication.
 *
 * @example
 * const { token } = await client.auth.issueSessionToken({
 *   storeId: "STO_xxx",
 *   buyerIdentity: "customer@example.com",
 * });
 * const buyer = client.buyer(token);
 * await buyer.cancelSubscription({ orderId: "ORD_xxx" });
 */
export class BuyerSession {
  /** GraphQL query access scoped to the buyer's data. */
  readonly graphql: BuyerGraphQL;

  constructor(private readonly http: BuyerHttpClient) {
    this.graphql = new BuyerGraphQL(http);
  }

  /**
   * Cancel a subscription order.
   *
   * @param params - Order to cancel
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await buyer.cancelSubscription({ orderId: "ORD_xxx" });
   * // status: "canceled" (was pending) or "canceling" (was active)
   */
  async cancelSubscription(params: CancelSubscriptionParams): Promise<CancelSubscriptionResult> {
    validateShortId("orderId", params.orderId, "ORD");
    return this.http.post<CancelSubscriptionResult>("/v1/actions/subscription-order/cancel-order", params);
  }

  /**
   * Cancel a one-time order (only while payment is still pending).
   *
   * @param params - Order to cancel
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await buyer.cancelOnetimeOrder({ orderId: "ORD_xxx" });
   */
  async cancelOnetimeOrder(params: CancelOnetimeOrderParams): Promise<CancelOnetimeOrderResult> {
    validateShortId("orderId", params.orderId, "ORD");
    return this.http.post<CancelOnetimeOrderResult>("/v1/actions/onetime-order/cancel-order", params);
  }

  /**
   * Reactivate a subscription that is in `canceling` status.
   *
   * @param params - Order to reactivate
   * @returns Order ID and resulting status
   *
   * @example
   * const { orderId, status } = await buyer.reactivateSubscription({ orderId: "ORD_xxx" });
   * // status: "active"
   */
  async reactivateSubscription(params: ReactivateSubscriptionParams): Promise<ReactivateSubscriptionResult> {
    validateShortId("orderId", params.orderId, "ORD");
    return this.http.post<ReactivateSubscriptionResult>("/v1/actions/subscription-order/reactivate-order", params);
  }

  /**
   * Submit a refund request for a payment.
   *
   * @param params - Refund ticket details
   * @returns Created refund ticket
   *
   * @example
   * const { ticket } = await buyer.createRefundTicket({
   *   paymentId: "PAY_xxx",
   *   reason: "Product not as described",
   *   requestedAmount: { amount: "29.00", currency: "USD" },
   * });
   */
  async createRefundTicket(params: CreateRefundTicketParams): Promise<{ ticket: RefundTicket }> {
    validateShortId("paymentId", params.paymentId, "PAY");
    validateRequired("reason", params.reason);
    validateAmountString("requestedAmount.amount", params.requestedAmount.amount);
    validateCurrencyCode("requestedAmount.currency", params.requestedAmount.currency);
    return this.http.post<{ ticket: RefundTicket }>("/v1/actions/refund-ticket/create-ticket", params);
  }

  /**
   * Resubmit a previously rejected refund ticket with updated details.
   *
   * @param params - Updated ticket details
   * @returns Updated refund ticket
   *
   * @example
   * const { ticket } = await buyer.resubmitRefundTicket({
   *   ticketId: "TKT_xxx",
   *   paymentId: "PAY_xxx",
   *   reason: "Updated reason with more detail",
   *   requestedAmount: { amount: "29.00", currency: "USD" },
   * });
   */
  async resubmitRefundTicket(params: ResubmitRefundTicketParams): Promise<{ ticket: RefundTicket }> {
    validateShortId("ticketId", params.ticketId, "TKT");
    validateShortId("paymentId", params.paymentId, "PAY");
    validateRequired("reason", params.reason);
    validateAmountString("requestedAmount.amount", params.requestedAmount.amount);
    validateCurrencyCode("requestedAmount.currency", params.requestedAmount.currency);
    return this.http.post<{ ticket: RefundTicket }>("/v1/actions/refund-ticket/resubmit-ticket", params);
  }
}

/**
 * GraphQL access scoped to the buyer's session token.
 */
class BuyerGraphQL {
  constructor(private readonly http: BuyerHttpClient) {}

  /**
   * Execute a GraphQL query scoped to the buyer's data.
   *
   * @param params - GraphQL query and variables
   * @returns GraphQL response
   *
   * @example
   * const result = await buyer.graphql.query({
   *   query: `query { orders { id status } }`,
   * });
   */
  async query<T = Record<string, unknown>>(params: GraphQLParams): Promise<GraphQLResponse<T>> {
    validateRequired("query", params.query);
    return this.http.post<GraphQLResponse<T>>("/v1/graphql", params);
  }
}
