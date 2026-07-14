import { unwrapAction } from "./internal.js";
import { validateAmountString, validateCurrencyCode, validateMaxLength, validateRequired, validateShortId } from "../validation.js";

import type { CustomerHttpClient } from "../customer-http-client.js";
import type {
  CancelOnetimeOrderParams,
  CancelOnetimeOrderResult,
  CancelSubscriptionParams,
  CancelSubscriptionResult,
  CreateRefundTicketParams,
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
   * // status: "canceled" (was pending) or "canceling" (was active)
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
