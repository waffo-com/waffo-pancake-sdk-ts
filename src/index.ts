// Client
export { WaffoPancake } from "./client.js";

// Errors
export { WaffoPancakeError } from "./errors.js";

// Webhooks
export { verifyWebhook } from "./webhooks.js";

// Enums (runtime values)
export {
  BillingPeriod,
  EntityStatus,
  Environment,
  ErrorLayer,
  MediaType,
  OnetimeOrderStatus,
  PaymentStatus,
  ProductVersionStatus,
  RefundStatus,
  RefundTicketStatus,
  ScanAction,
  ScanPolicyCategory,
  ScanReasonCode,
  ScanSemanticMode,
  ScanSemanticStatus,
  StoreRole,
  SubscriptionOrderStatus,
  TaxCategory,
  WebhookEventType,
} from "./types.js";

// Types (interfaces & type aliases)
export type {
  // Config
  WaffoPancakeConfig,

  // Response envelope (handbook: { data, errors?, warnings? } — same shape for REST + GraphQL)
  Notice,
  Envelope,
  PostResult,
  /** @deprecated Use {@link Notice}. */
  ApiError,

  // Auth
  IssueSessionTokenParams,
  SessionToken,

  // Store
  CheckoutSettings,
  CheckoutThemeSettings,
  CreateStoreParams,
  DeleteStoreParams,
  MerchantWritableNotificationSettings,
  NotificationSettings,
  Store,
  UpdateStoreParams,

  // Webhook management
  StoreWebhook,
  WebhookChannel,
  CashierLanguage,
  PaymentMethod,
  AddWebhookParams,
  UpdateWebhookParams,
  RemoveWebhookParams,

  // Store Merchant
  AddMerchantParams,
  AddMerchantResult,
  RemoveMerchantParams,
  RemoveMerchantResult,
  UpdateRoleParams,
  UpdateRoleResult,

  // Product shared
  MediaItem,
  PriceInfo,
  Prices,

  // Onetime Product
  CreateOnetimeProductParams,
  OnetimeProductDetail,
  PublishOnetimeProductParams,
  UpdateOnetimeProductParams,
  UpdateOnetimeStatusParams,

  // Subscription Product
  CreateSubscriptionProductParams,
  PublishSubscriptionProductParams,
  SubscriptionProductDetail,
  UpdateSubscriptionProductParams,
  UpdateSubscriptionStatusParams,

  // Subscription Product Group
  CreateSubscriptionProductGroupParams,
  DeleteSubscriptionProductGroupParams,
  GroupRules,
  PublishSubscriptionProductGroupParams,
  SubscriptionProductGroup,
  UpdateSubscriptionProductGroupParams,

  // Customer self-service
  CancelOnetimeOrderParams,
  CancelOnetimeOrderResult,
  CreateRefundTicketParams,
  ReactivateSubscriptionParams,
  ReactivateSubscriptionResult,
  RefundTicket,
  RefundTicketVersionData,
  RequestedAmount,
  ResubmitRefundTicketParams,

  // Checkout convenience
  AnonymousCheckoutParams,
  AuthenticatedCheckoutParams,
  AuthenticatedCheckoutResult,

  // Order
  BillingDetail,
  CancelSubscriptionParams,
  CancelSubscriptionResult,
  CheckoutSessionResult,
  CreateCheckoutSessionParams,

  // GraphQL
  GraphQLParams,
  GraphQLResponse,

  // Webhook
  VerifyWebhookOptions,
  WebhookEvent,
  WebhookEventData,
  WebhookPublicKeys,

  // Content Safety
  ScanPromptParams,
  ScanResult,
} from "./types.js";
