// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

export interface WaffoPancakeConfig {
  /** Merchant ID in `MER_{base62}` format (sent as X-Merchant-Id header) */
  merchantId: string;
  /** RSA private key in PEM format for request signing */
  privateKey: string;
  /** Base URL override (default: https://api.waffo.ai) */
  baseUrl?: string;
  /** Custom fetch implementation (default: global fetch) */
  fetch?: typeof fetch;
  /**
   * Custom RSA public key(s) for webhook signature verification.
   *
   * - `string` — single key used for both test and prod environments
   * - `{ test?, prod? }` — per-environment keys
   *
   * Resolution order per environment: config key → env var → built-in key.
   * @see {@link VerifyWebhookOptions} for per-call overrides
   */
  webhookPublicKey?: WebhookPublicKeys;
}

// ---------------------------------------------------------------------------
// Internal HTTP options
// ---------------------------------------------------------------------------

/**
 * Options for {@link HttpClient.post}.
 * Not exported publicly — used by resource classes.
 */
export interface PostOptions {
  /**
   * Time window in seconds for idempotency key rotation.
   * When set, a floored timestamp is mixed into the key so identical params
   * produce a new key after the window elapses (e.g. 60 = per-minute dedup).
   */
  idempotencyWindow?: number;
}

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

/**
 * Single error object within the `errors` array.
 *
 * @example
 * { message: "Store slug already exists", layer: "store" }
 */
export interface ApiError {
  /** Error message */
  message: string;
  /** Layer where the error originated */
  layer: `${ErrorLayer}`;
}

/** Successful API response envelope. */
export interface ApiSuccessResponse<T> {
  data: T;
}

/**
 * Error API response envelope.
 *
 * `errors` are ordered by call stack: `[0]` is the deepest layer, `[n]` is the outermost.
 */
export interface ApiErrorResponse {
  data: null;
  errors: ApiError[];
}

/** Union type of success and error API responses. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Enums (runtime-accessible values)
// ---------------------------------------------------------------------------

/**
 * Environment type.
 * @see waffo-pancake-order-service/app/lib/types.ts
 */
export enum Environment {
  Test = "test",
  Prod = "prod",
}

/**
 * Tax category for products.
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 */
export enum TaxCategory {
  DigitalGoods = "digital_goods",
  SaaS = "saas",
  Software = "software",
  Ebook = "ebook",
  OnlineCourse = "online_course",
  Consulting = "consulting",
  ProfessionalService = "professional_service",
}

/**
 * Subscription billing period.
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 */
export enum BillingPeriod {
  Weekly = "weekly",
  Monthly = "monthly",
  Quarterly = "quarterly",
  Yearly = "yearly",
}

/**
 * Product version status.
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 */
export enum ProductVersionStatus {
  Active = "active",
  Inactive = "inactive",
}

/**
 * Store entity status.
 * @see waffo-pancake-store-service/app/lib/resources/store.ts
 */
export enum EntityStatus {
  Active = "active",
  Inactive = "inactive",
  Suspended = "suspended",
}

/**
 * Store member role.
 * @see waffo-pancake-store-service/app/lib/resources/store.ts
 */
export enum StoreRole {
  Owner = "owner",
  Admin = "admin",
  Member = "member",
}

/**
 * One-time order status.
 * @see waffo-pancake-order-service/app/lib/resources/onetime-order.ts
 */
export enum OnetimeOrderStatus {
  Pending = "pending",
  Completed = "completed",
  Canceled = "canceled",
}

/**
 * Subscription order status.
 *
 * State machine:
 * - pending -> active, canceled, closed (PSP CLOSE from never-activated)
 * - active -> canceling, past_due, canceled, expired
 * - canceling -> active, canceled
 * - past_due -> active, canceled
 * - closed -> terminal (never-activated subscription closed by PSP)
 * - canceled -> terminal
 * - expired -> terminal
 *
 * @see waffo-pancake-order-service/app/lib/resources/subscription-order.ts
 */
export enum SubscriptionOrderStatus {
  Pending = "pending",
  Active = "active",
  Canceling = "canceling",
  PastDue = "past_due",
  Closed = "closed",
  Canceled = "canceled",
  Expired = "expired",
}

/**
 * Payment status.
 * @see waffo-pancake-order-service/app/lib/resources/payment.ts
 */
export enum PaymentStatus {
  Pending = "pending",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

/**
 * Refund ticket status.
 * @see waffo-pancake-order-service/app/lib/resources/refund-ticket.ts
 */
export enum RefundTicketStatus {
  Pending = "pending",
  UnderReview = "under_review",
  Approved = "approved",
  Rejected = "rejected",
  Returned = "returned",
  Processing = "processing",
  Succeeded = "succeeded",
  Failed = "failed",
  Cancelled = "cancelled",
}

/**
 * Refund status.
 * @see waffo-pancake-order-service/app/lib/resources/refund.ts
 */
export enum RefundStatus {
  Succeeded = "succeeded",
  Failed = "failed",
}

/**
 * Media asset type.
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 */
export enum MediaType {
  Image = "image",
  Video = "video",
}

/** Error layer identifier in the call stack. */
export enum ErrorLayer {
  Gateway = "gateway",
  User = "user",
  Store = "store",
  Product = "product",
  Order = "order",
  Ticket = "ticket",
  GraphQL = "graphql",
  Resource = "resource",
  /** SDK-specific layer for email delivery errors (not part of the service-side error layers). */
  Email = "email",
  /** SDK-side input validation (caught before network request). */
  Sdk = "sdk",
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Parameters for issuing a buyer session token.
 *
 * Provide either `storeId` or `productId` (at least one required).
 * When `productId` is given without `storeId`, the server derives the store from the product.
 *
 * @see waffo-pancake-user-service/app/lib/utils/jwt.ts IssueSessionTokenRequest
 */
export interface IssueSessionTokenParams {
  /** Buyer identity (email or any merchant-provided identifier string) */
  buyerIdentity: string;
  /** Store ID (optional when `productId` is provided) */
  storeId?: string;
  /** Product ID — used to derive the store when `storeId` is omitted */
  productId?: string;
}

/**
 * Issued session token response.
 *
 * @example
 * { token: "eyJhbGciOi...", expiresAt: "2026-03-10T09:00:00.000Z" }
 */
export interface SessionToken {
  /** JWT token string */
  token: string;
  /** Expiration time (ISO 8601 UTC) */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Store — from waffo-pancake-store-service
// ---------------------------------------------------------------------------

/**
 * Webhook configuration for test and production environments.
 * @see waffo-pancake-store-service/app/lib/types.ts
 */
export interface WebhookSettings {
  /** Test environment webhook URL */
  testWebhookUrl: string | null;
  /** Production environment webhook URL */
  prodWebhookUrl: string | null;
  /** Event types subscribed in test environment */
  testEvents: string[];
  /** Event types subscribed in production environment */
  prodEvents: string[];
}

/**
 * Notification settings (all default to true).
 * @see waffo-pancake-store-service/app/lib/types.ts
 */
export interface NotificationSettings {
  emailOrderConfirmation: boolean;
  emailSubscriptionConfirmation: boolean;
  emailSubscriptionCycled: boolean;
  emailSubscriptionCanceled: boolean;
  emailSubscriptionRevoked: boolean;
  emailSubscriptionPastDue: boolean;
  notifyNewOrders: boolean;
  notifyNewSubscriptions: boolean;
}

/**
 * Single-theme checkout page styling.
 * @see waffo-pancake-store-service/app/lib/types.ts
 */
export interface CheckoutThemeSettings {
  checkoutLogo: string | null;
  checkoutColorPrimary: string;
  checkoutColorBackground: string;
  checkoutColorCard: string;
  checkoutColorText: string;
  checkoutBorderRadius: string;
}

/**
 * Checkout page configuration (light and dark themes).
 * @see waffo-pancake-store-service/app/lib/types.ts
 */
export interface CheckoutSettings {
  defaultDarkMode: boolean;
  light: CheckoutThemeSettings;
  dark: CheckoutThemeSettings;
}

/**
 * Store entity.
 * @see waffo-pancake-store-service/app/lib/resources/store.ts
 */
export interface Store {
  id: string;
  name: string;
  status: EntityStatus;
  logo: string | null;
  supportEmail: string | null;
  website: string | null;
  slug: string | null;
  prodEnabled: boolean;
  webhookSettings: WebhookSettings | null;
  notificationSettings: NotificationSettings | null;
  checkoutSettings: CheckoutSettings | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Parameters for creating a store. */
export interface CreateStoreParams {
  /** Store name (slug is auto-generated) */
  name: string;
}

/** Parameters for updating a store. */
export interface UpdateStoreParams {
  /** Store ID */
  id: string;
  /** Store display name */
  name?: string;
  /** Store status */
  status?: EntityStatus;
  /** Store logo URL (set to `null` to remove) */
  logo?: string | null;
  /** Support email address (set to `null` to remove) */
  supportEmail?: string | null;
  /** Store website URL (set to `null` to remove) */
  website?: string | null;
  /** Webhook configuration for test and production environments (set to `null` to remove) */
  webhookSettings?: WebhookSettings | null;
  /** Notification preferences (set to `null` to remove) */
  notificationSettings?: NotificationSettings | null;
  /** Checkout page theme configuration (set to `null` to remove) */
  checkoutSettings?: CheckoutSettings | null;
}

/** Parameters for deleting (soft-delete) a store. */
export interface DeleteStoreParams {
  /** Store ID */
  id: string;
}

// ---------------------------------------------------------------------------
// Store Merchant (coming soon — endpoints return 501)
// ---------------------------------------------------------------------------

/** Parameters for adding a merchant to a store. */
export interface AddMerchantParams {
  storeId: string;
  email: string;
  role: "admin" | "member";
}

/** Result of adding a merchant to a store. */
export interface AddMerchantResult {
  storeId: string;
  merchantId: string;
  email: string;
  role: string;
  status: string;
  addedAt: string;
}

/** Parameters for removing a merchant from a store. */
export interface RemoveMerchantParams {
  storeId: string;
  merchantId: string;
}

/** Result of removing a merchant from a store. */
export interface RemoveMerchantResult {
  message: string;
  removedAt: string;
}

/** Parameters for updating a merchant's role. */
export interface UpdateRoleParams {
  storeId: string;
  merchantId: string;
  role: "admin" | "member";
}

/** Result of updating a merchant's role. */
export interface UpdateRoleResult {
  storeId: string;
  merchantId: string;
  role: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Product — shared types from waffo-pancake-product-service
// ---------------------------------------------------------------------------

/**
 * Price for a single currency.
 *
 * Amounts are represented as display strings (e.g., "9.99" for USD, "1000" for JPY).
 * The server handles conversion to/from smallest currency units internally.
 *
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 *
 * @example
 * // USD $9.99
 * { amount: "9.99", taxCategory: "saas" }
 *
 * @example
 * // JPY ¥1000
 * { amount: "1000", taxCategory: "software" }
 */
export interface PriceInfo {
  /** Price amount as display string (e.g., "9.99" for USD, "1000" for JPY) */
  amount: string;
  /** Tax category */
  taxCategory: TaxCategory;
}

/**
 * Multi-currency prices (keyed by ISO 4217 currency code).
 *
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 *
 * @example
 * {
 *   "USD": { amount: "9.99", taxCategory: "saas" },
 *   "EUR": { amount: "8.99", taxCategory: "saas" }
 * }
 */
export type Prices = Record<string, PriceInfo>;

/**
 * Media asset (image or video).
 * @see waffo-pancake-product-service/app/lib/resources/types.ts
 */
export interface MediaItem {
  /** Media type */
  type: `${MediaType}`;
  /** Asset URL */
  url: string;
  /** Alt text */
  alt?: string;
  /** Thumbnail URL */
  thumbnail?: string;
}

// ---------------------------------------------------------------------------
// Onetime Product — from waffo-pancake-product-service
// ---------------------------------------------------------------------------

/**
 * One-time product detail (public API shape).
 * @see waffo-pancake-product-service/app/lib/resources/onetime-product.ts OnetimeProductDetail
 */
export interface OnetimeProductDetail {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  prices: Prices;
  media: MediaItem[];
  successUrl: string | null;
  metadata: Record<string, unknown>;
  status: ProductVersionStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parameters for creating a one-time product.
 * @see waffo-pancake-product-service/app/lib/resources/onetime-product.ts CreateOnetimeProductRequestBody
 */
export interface CreateOnetimeProductParams {
  storeId: string;
  name: string;
  prices: Prices;
  description?: string;
  media?: MediaItem[];
  successUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating a one-time product (creates a new version; skips if unchanged).
 * @see waffo-pancake-product-service/app/lib/resources/onetime-product.ts UpdateOnetimeProductContentRequestBody
 */
export interface UpdateOnetimeProductParams {
  id: string;
  name: string;
  prices: Prices;
  description?: string;
  media?: MediaItem[];
  successUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Parameters for publishing a one-time product's test version to production. */
export interface PublishOnetimeProductParams {
  /** Product ID */
  id: string;
}

/**
 * Parameters for updating a one-time product's status.
 * @see waffo-pancake-product-service/app/lib/resources/onetime-product.ts UpdateOnetimeStatusRequestBody
 */
export interface UpdateOnetimeStatusParams {
  id: string;
  status: ProductVersionStatus;
}

// ---------------------------------------------------------------------------
// Subscription Product — from waffo-pancake-product-service
// ---------------------------------------------------------------------------

/**
 * Subscription product detail (public API shape).
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product.ts SubscriptionProductDetail
 */
export interface SubscriptionProductDetail {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  billingPeriod: BillingPeriod;
  prices: Prices;
  media: MediaItem[];
  successUrl: string | null;
  metadata: Record<string, unknown>;
  status: ProductVersionStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parameters for creating a subscription product.
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product.ts CreateSubscriptionProductRequestBody
 */
export interface CreateSubscriptionProductParams {
  storeId: string;
  name: string;
  billingPeriod: BillingPeriod;
  prices: Prices;
  description?: string;
  media?: MediaItem[];
  successUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parameters for updating a subscription product (creates a new version; skips if unchanged).
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product.ts UpdateSubscriptionProductContentRequestBody
 */
export interface UpdateSubscriptionProductParams {
  id: string;
  name: string;
  billingPeriod: BillingPeriod;
  prices: Prices;
  description?: string;
  media?: MediaItem[];
  successUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Parameters for publishing a subscription product's test version to production. */
export interface PublishSubscriptionProductParams {
  /** Product ID */
  id: string;
}

/**
 * Parameters for updating a subscription product's status.
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product.ts UpdateSubscriptionStatusRequestBody
 */
export interface UpdateSubscriptionStatusParams {
  id: string;
  status: ProductVersionStatus;
}

// ---------------------------------------------------------------------------
// Subscription Product Group — from waffo-pancake-product-service
// ---------------------------------------------------------------------------

/**
 * Group rules for subscription product groups.
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product-group.ts
 */
export interface GroupRules {
  /** Whether trial period is shared across products in the group */
  sharedTrial: boolean;
}

/**
 * Subscription product group entity.
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product-group.ts
 */
export interface SubscriptionProductGroup {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  rules: GroupRules;
  productIds: string[];
  environment: Environment;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parameters for creating a subscription product group.
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product-group.ts CreateGroupRequestBody
 */
export interface CreateSubscriptionProductGroupParams {
  storeId: string;
  name: string;
  description?: string;
  rules?: GroupRules;
  productIds?: string[];
}

/**
 * Parameters for updating a subscription product group (`productIds` is a full replacement).
 * @see waffo-pancake-product-service/app/lib/resources/subscription-product-group.ts UpdateGroupRequestBody
 */
export interface UpdateSubscriptionProductGroupParams {
  id: string;
  name?: string;
  description?: string;
  rules?: GroupRules;
  productIds?: string[];
}

/** Parameters for hard-deleting a subscription product group. */
export interface DeleteSubscriptionProductGroupParams {
  /** Group ID */
  id: string;
}

/** Parameters for publishing a test-environment group to production (upsert). */
export interface PublishSubscriptionProductGroupParams {
  /** Group ID */
  id: string;
}

// ---------------------------------------------------------------------------
// Order — from waffo-pancake-order-service
// ---------------------------------------------------------------------------

/** Parameters for canceling a subscription order. */
export interface CancelSubscriptionParams {
  /** Order ID */
  orderId: string;
}

/**
 * Result of canceling a subscription order.
 * @see waffo-pancake-order-service cancel-order route.ts
 */
export interface CancelSubscriptionResult {
  orderId: string;
  /** Status after cancellation (`"canceled"` or `"canceling"`) */
  status: `${SubscriptionOrderStatus}`;
}

/**
 * Buyer billing details for checkout.
 * @see waffo-pancake-order-service/app/lib/types.ts
 */
export interface BillingDetail {
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Whether this is a business purchase */
  isBusiness: boolean;
  /** Postal / ZIP code (required for US, at least one of postcode/state for CA) */
  postcode?: string;
  /** State / province code (at least one of state/postcode for CA) */
  state?: string;
  /** Business name (recommended for invoicing, does not affect tax calculation) */
  businessName?: string;
  /** Tax ID / VAT number (EU businesses: triggers reverse charge 0% when provided) */
  taxId?: string;
}

/**
 * Parameters for creating a checkout session.
 * @see waffo-pancake-order-service/app/lib/types.ts CreateCheckoutSessionRequest
 */
export interface CreateCheckoutSessionParams {
  /** Product ID */
  productId: string;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Optional price snapshot override (reads from DB if omitted) */
  priceSnapshot?: PriceInfo;
  /** Trial toggle override (subscription only) */
  withTrial?: boolean;
  /** Pre-filled buyer email */
  buyerEmail?: string;
  /** Pre-filled billing details */
  billingDetail?: BillingDetail;
  /** Redirect URL after successful payment */
  successUrl?: string;
  /** Session expiration in seconds (default: 45 minutes) */
  expiresInSeconds?: number;
  /** Dark mode override (true=dark, false=light, omit=use store default) */
  darkMode?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/** Result of creating a checkout session. */
export interface CheckoutSessionResult {
  /** Session ID */
  sessionId: string;
  /** URL to redirect the customer to */
  checkoutUrl: string;
  /** Session expiration time (ISO 8601 UTC) */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Buyer self-service
// ---------------------------------------------------------------------------

/** Parameters for canceling a one-time order (buyer-side). */
export interface CancelOnetimeOrderParams {
  /** Order ID */
  orderId: string;
}

/** Result of canceling a one-time order. */
export interface CancelOnetimeOrderResult {
  /** Order ID */
  orderId: string;
  /** Resulting status (`"canceled"`) */
  status: string;
}

/** Parameters for reactivating a subscription (buyer-side). */
export interface ReactivateSubscriptionParams {
  /** Subscription order ID */
  orderId: string;
}

/** Result of reactivating a subscription. */
export interface ReactivateSubscriptionResult {
  /** Order ID */
  orderId: string;
  /** Resulting status (`"active"`) */
  status: string;
}

/** Requested refund amount. */
export interface RequestedAmount {
  /** Refund amount in display format (e.g., `"29.00"`) */
  amount: string;
  /** Currency code (ISO 4217) */
  currency: string;
}

/** Parameters for creating a refund ticket (buyer-side). */
export interface CreateRefundTicketParams {
  /** Payment ID to refund */
  paymentId: string;
  /** Reason for the refund request */
  reason: string;
  /** Requested refund amount */
  requestedAmount: RequestedAmount;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/** Parameters for resubmitting a rejected refund ticket (buyer-side). */
export interface ResubmitRefundTicketParams {
  /** Existing ticket ID */
  ticketId: string;
  /** Payment ID */
  paymentId: string;
  /** Updated reason */
  reason: string;
  /** Updated requested amount */
  requestedAmount: RequestedAmount;
}

/** Refund ticket entity returned from create/resubmit operations. */
export interface RefundTicket {
  /** Ticket ID */
  id: string;
  /** Ticket type (e.g., `"refund"`) */
  type: string;
  /** Ticket status (e.g., `"pending"`, `"approved"`, `"rejected"`) */
  status: string;
  /** Associated payment ID */
  subjectId: string;
  /** Submitter identifier (email or merchant ID) */
  submitterId: string;
  /** Submitter type (e.g., `"customer"`, `"merchant"`) */
  submitterType: string;
  /** Current version ID */
  currentVersionId: string | null;
  /** Reviewer ID (null if not yet reviewed) */
  reviewerId: string | null;
  /** Review timestamp (ISO 8601, null if not yet reviewed) */
  reviewedAt: string | null;
  /** Reviewer's note */
  reviewNote: string | null;
  /** Rejection reason (null if approved or pending) */
  rejectReason: string | null;
  /** Execution timestamp (ISO 8601, null if not yet executed) */
  executedAt: string | null;
  /** Custom metadata */
  metadata: Record<string, unknown>;
  /** Current version number */
  versionNumber: number | null;
  /** Current version data (includes reason, amount, etc.) */
  versionData: Record<string, unknown> | null;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last update timestamp (ISO 8601) */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Checkout — convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Parameters for anonymous checkout.
 *
 * The buyer enters the checkout page without a session token and fills in
 * billing details manually. No identity is provided upfront.
 *
 * @example
 * const result = await client.checkout.anonymous.create({
 *   productId: "PROD_xxx",
 *   currency: "USD",
 * });
 * // Redirect to result.checkoutUrl
 */
export interface AnonymousCheckoutParams {
  /** Product ID */
  productId: string;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Optional price snapshot override (reads from DB if omitted) */
  priceSnapshot?: PriceInfo;
  /** Trial toggle override (subscription only) */
  withTrial?: boolean;
  /** Redirect URL after successful payment */
  successUrl?: string;
  /** Session expiration in seconds (default: 45 minutes) */
  expiresInSeconds?: number;
  /** Dark mode override (true=dark, false=light, omit=use store default) */
  darkMode?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Parameters for authenticated checkout.
 *
 * The merchant provides a buyer identity; the SDK issues a session token
 * and appends it to the checkout URL as a URL fragment.
 *
 * @example
 * const result = await client.checkout.authenticated.create({
 *   productId: "PROD_xxx",
 *   currency: "USD",
 *   buyerIdentity: "customer@example.com",
 * });
 * // Redirect to result.checkoutUrl (includes #token=...)
 */
export interface AuthenticatedCheckoutParams {
  /** Product ID */
  productId: string;
  /** Currency code (ISO 4217) */
  currency: string;
  /** Buyer identity (email or merchant-provided identifier) */
  buyerIdentity: string;
  /** Pre-filled buyer email (defaults to `buyerIdentity` when omitted) */
  buyerEmail?: string;
  /** Pre-filled billing details */
  billingDetail?: BillingDetail;
  /** Optional price snapshot override (reads from DB if omitted) */
  priceSnapshot?: PriceInfo;
  /** Trial toggle override (subscription only) */
  withTrial?: boolean;
  /** Redirect URL after successful payment */
  successUrl?: string;
  /** Session expiration in seconds (default: 45 minutes) */
  expiresInSeconds?: number;
  /** Dark mode override (true=dark, false=light, omit=use store default) */
  darkMode?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Result of an authenticated checkout creation.
 *
 * Extends the base session result with the issued token details.
 */
export interface AuthenticatedCheckoutResult {
  /** Session ID */
  sessionId: string;
  /** Checkout URL with session token appended as URL fragment (`#token=...`) */
  checkoutUrl: string;
  /** Session expiration time (ISO 8601 UTC) */
  expiresAt: string;
  /** Issued JWT token */
  token: string;
  /** Token expiration time (ISO 8601 UTC) */
  tokenExpiresAt: string;
}

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

/** Parameters for a GraphQL query. */
export interface GraphQLParams {
  /** GraphQL query string */
  query: string;
  /** Query variables */
  variables?: Record<string, unknown>;
}

/** GraphQL response envelope. */
export interface GraphQLResponse<T = Record<string, unknown>> {
  data: T | null;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Webhook event types.
 * @see docs/api-reference/webhooks.mdx
 */
export enum WebhookEventType {
  /** One-time order first payment succeeded */
  OrderCompleted = "order.completed",
  /** Subscription first payment succeeded (newly activated) */
  SubscriptionActivated = "subscription.activated",
  /** Subscription renewal payment succeeded */
  SubscriptionPaymentSucceeded = "subscription.payment_succeeded",
  /** Buyer initiated cancellation (expires at end of current period) */
  SubscriptionCanceling = "subscription.canceling",
  /** Buyer withdrew cancellation (subscription restored) */
  SubscriptionUncanceled = "subscription.uncanceled",
  /** Subscription product changed (upgrade/downgrade) */
  SubscriptionUpdated = "subscription.updated",
  /** Subscription fully terminated */
  SubscriptionCanceled = "subscription.canceled",
  /** Renewal payment failed (past due) */
  SubscriptionPastDue = "subscription.past_due",
  /** Refund succeeded */
  RefundSucceeded = "refund.succeeded",
  /** Refund failed */
  RefundFailed = "refund.failed",
}

/**
 * Common data fields in a webhook event payload.
 * @see docs/api-reference/webhooks.mdx
 */
export interface WebhookEventData {
  orderId: string;
  buyerEmail: string;
  currency: string;
  /** Amount as display string (e.g., "9.99" for USD, "1000" for JPY) */
  amount: string;
  /** Tax amount as display string (e.g., "0.91" for USD) */
  taxAmount: string;
  productName: string;
}

/**
 * Webhook event payload.
 *
 * @see docs/api-reference/webhooks.mdx
 *
 * @example
 * {
 *   id: "550e8400-...",
 *   timestamp: "2026-03-10T08:30:00.000Z",
 *   eventType: "order.completed",
 *   eventId: "PAY_5xK9mRtYvWnPqLsJ3hBfDe",
 *   storeId: "STO_2aUyqjCzEIiEcYMKj7TZtw",
 *   mode: "prod",
 *   data: { orderId: "...", buyerEmail: "...", currency: "USD", amount: "29.00", taxAmount: "2.90", productName: "Pro Plan" }
 * }
 */
export interface WebhookEvent<T = WebhookEventData> {
  /** Delivery record unique ID (UUID), usable for idempotent deduplication */
  id: string;
  /** Event timestamp (ISO 8601 UTC) */
  timestamp: string;
  /** Event type */
  eventType: `${WebhookEventType}` | (string & {});
  /** Business event ID (e.g. payment ID, order ID) */
  eventId: string;
  /** Store ID the event belongs to */
  storeId: string;
  /** Environment identifier */
  mode: `${Environment}`;
  /** Event data */
  data: T;
}

/**
 * Webhook public key configuration.
 *
 * - `string` — single key used for both test and prod environments
 * - `{ test?, prod? }` — per-environment keys
 */
export type WebhookPublicKeys = string | { test?: string; prod?: string };

/** Options for {@link verifyWebhook}. */
export interface VerifyWebhookOptions {
  /**
   * Specify which environment's public key to use for verification.
   * When omitted, both keys are tried automatically (prod first).
   * Ignored when `publicKey` is provided.
   */
  environment?: `${Environment}`;
  /**
   * Timestamp tolerance window in milliseconds for replay protection.
   * Set to 0 to skip timestamp checking.
   * @default 300000 (5 minutes)
   */
  toleranceMs?: number;
  /**
   * Per-call public key override (highest priority).
   * When provided, skips all other key resolution (config, env vars, built-in).
   */
  publicKey?: string;
  /**
   * Config-level public key(s) for the resolution chain.
   * When using `client.webhooks.verify()`, this is set automatically from `WaffoPancakeConfig.webhookPublicKey`.
   * When using the standalone `verifyWebhook()`, you can pass this directly for config-level key injection.
   *
   * Resolution order per environment:
   * 1. `publicKey` (per-call override)
   * 2. `publicKeys[env]` or `publicKeys` (config)
   * 3. `WAFFO_WEBHOOK_{TEST|PROD}_PUBLIC_KEY` (env var)
   * 4. `WAFFO_WEBHOOK_PUBLIC_KEY` (env var)
   * 5. Built-in hardcoded key
   */
  publicKeys?: WebhookPublicKeys;
}
