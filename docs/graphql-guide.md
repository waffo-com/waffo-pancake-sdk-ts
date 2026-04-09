# GraphQL Guide

The Waffo Pancake GraphQL API is **query-only** — Mutations are not supported and return a 403 error. All queries go through `client.graphql.query<T>()`.

## Introspection

Introspection is **enabled by default**. Use it during development to explore the full schema, discover available types, fields, and filter conditions.

> **Recommended**: Always use introspection to stay in sync with the server — this guide covers common queries, but the schema is the source of truth.
>
> **Important**: The SDK's TypeScript types (e.g. `Prices`, `MediaItem`) reflect the **REST API** shape. The GraphQL schema may represent the same data differently — for example, `prices` is a `Record<string, PriceInfo>` in REST but `[CurrencyPrice!]!` (array of `{currency, priceInfo}`) in GraphQL. Always use introspection or the examples below for GraphQL field names, not the SDK type definitions.

### Discover All Query Fields

```typescript
const schema = await client.graphql.query({
  query: `{
    __schema {
      queryType {
        fields {
          name
          description
          args { name type { name kind ofType { name } } }
        }
      }
    }
  }`,
});
console.log(schema.data?.__schema.queryType.fields);
```

### Inspect a Specific Type

```typescript
const orderType = await client.graphql.query({
  query: `{
    __type(name: "OnetimeOrder") {
      fields {
        name
        type { name kind ofType { name } }
      }
    }
  }`,
});
console.log(orderType.data?.__type.fields);
```

### Interactive Schema Browsers

You can also connect [GraphiQL](https://github.com/graphql/graphiql) or [Apollo Sandbox](https://studio.apollographql.com/sandbox) to `https://api.waffo.ai/v1/graphql` for interactive schema browsing with auto-complete.

---

## Practical Examples

### 1. Store Queries

```typescript
interface StoresQuery {
  stores: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    supportEmail: string | null;
    createdAt: string;
  }>;
}
const { data } = await client.graphql.query<StoresQuery>({
  query: `query { stores { id name slug status supportEmail createdAt } }`,
});

// Single store by ID
const store = await client.graphql.query({
  query: `query ($id: ID!) {
    store(id: $id) { id name slug status }
  }`,
  variables: { id: "STO_xxx" },
});
```

### 2. Product Queries

```typescript
// One-time products with prices
interface ProductsQuery {
  onetimeProducts: Array<{
    id: string;
    name: string;
    status: string;
    prices: Array<{ currency: string; priceInfo: { amount: string; taxCategory: string } }>;
    hasProdVersion: boolean;
  }>;
}
const products = await client.graphql.query<ProductsQuery>({
  query: `query ($storeId: String!) {
    onetimeProducts(storeId: $storeId, filter: { status: { eq: "active" } }) {
      id name status
      prices { currency priceInfo { amount taxCategory } }
      hasProdVersion
    }
  }`,
  variables: { storeId: "STO_xxx" },
});

// Subscription products
const subProducts = await client.graphql.query({
  query: `query ($storeId: String!) {
    subscriptionProducts(storeId: $storeId) {
      id name billingPeriod status
      prices { currency priceInfo { amount taxCategory } }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### 3. Order Queries

```typescript
// One-time orders with price snapshot
interface OnetimeOrdersQuery {
  onetimeOrders: Array<{
    id: string;
    buyerEmail: string;
    currency: string;
    status: string;
    priceSnapshot: {
      currency: string;
      subtotal: string;
      taxAmount: string;
      total: string;
      taxCategory: string;
    };
    onetimeProduct: { name: string };
    createdAt: string;
  }>;
}
const orders = await client.graphql.query<OnetimeOrdersQuery>({
  query: `query ($storeId: String!) {
    onetimeOrders(storeId: $storeId) {
      id buyerEmail currency status
      priceSnapshot { currency subtotal taxAmount total taxCategory }
      onetimeProduct { name }
      createdAt
    }
  }`,
  variables: { storeId: "STO_xxx" },
});

// Subscription orders
const subOrders = await client.graphql.query({
  query: `query ($storeId: String!) {
    subscriptionOrders(storeId: $storeId) {
      id buyerEmail status billingPeriod
      priceSnapshot {
        currency
        regularPhase { subtotal taxAmount total taxCategory }
        specialPhase { subtotal taxAmount total taxCategory }
        specialPhaseDays
      }
      currentPeriodEnd canceledAt
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### 4. Order Details (with Payment History)

```typescript
// One-time order with payments and refunds
const orderDetail = await client.graphql.query({
  query: `query ($id: ID!) {
    onetimeOrder(id: $id) {
      id buyerEmail currency status testMode
      priceSnapshot { currency subtotal taxAmount total taxCategory }
      billingDetail { country isBusiness postcode state businessName taxId }
      onetimeProduct { id name }
      productVersion { id versionNumber name }
      payments {
        id status refundStatus
        snapshotAmountDetails { currency subtotal taxAmount total taxCategory phase }
        cardInfo { brand last4 expMonth expYear }
        failureReason createdAt
        refunds { id status requestedAmountDetails { currency amount } createdAt }
      }
      createdAt updatedAt
    }
  }`,
  variables: { id: "ORD_xxx" },
});

// Subscription order with renewal status
const subDetail = await client.graphql.query({
  query: `query ($id: ID!) {
    subscriptionOrder(id: $id) {
      id buyerEmail status billingPeriod
      priceSnapshot {
        currency specialPhaseDays
        specialPhase { subtotal taxAmount total taxCategory }
        regularPhase { subtotal taxAmount total taxCategory }
      }
      billingDetail { country isBusiness }
      currentPeriodStart currentPeriodEnd canceledAt
      subscriptionProduct { id name }
      productVersion { id versionNumber name }
      payments {
        id status refundStatus
        snapshotAmountDetails { currency subtotal taxAmount total taxCategory phase }
        createdAt
      }
      createdAt
    }
  }`,
  variables: { id: "ORD_xxx" },
});
```

### 5. Payment and Refund Queries

```typescript
// Payments with filters
const payments = await client.graphql.query({
  query: `query {
    payments(filter: { status: { eq: "succeeded" } }) {
      id
      onetimeOrder { id }
      subscriptionOrder { id }
      snapshotAmountDetails { currency subtotal taxAmount total taxCategory phase }
      cardInfo { brand last4 }
      status createdAt
    }
  }`,
});

// Refund tickets
const tickets = await client.graphql.query({
  query: `query {
    refundTickets(limit: 20, filter: { status: { eq: "pending" } }) {
      id status reason
      requestedAmountDetails { currency amount }
      payment {
        id status
        snapshotAmountDetails { currency subtotal taxAmount total taxCategory phase }
        onetimeOrder { id buyerEmail store { name } }
        subscriptionOrder { id buyerEmail store { name } }
      }
      createdAt updatedAt
    }
    refundTicketsCount(filter: { status: { eq: "pending" } })
  }`,
});
```

### 6. Merchant Info and Store Associations

```typescript
const merchant = await client.graphql.query({
  query: `query ($id: ID!) {
    merchant(id: $id) {
      id email name status
      storeMerchants {
        role
        store { id name slug status }
      }
      apiKeys { id nickname environment recentlyUsed createdAt }
    }
  }`,
  variables: { id: "MER_xxx" },
});
```

### 7. Product Versions

```typescript
// One-time product version history
const versions = await client.graphql.query({
  query: `query ($productId: String!) {
    onetimeProductVersions(productId: $productId) {
      id versionNumber name description
      prices { currency priceInfo { amount taxCategory } }
      media { type url alt thumbnail }
      metadata isTestVersion isProdVersion createdAt
    }
  }`,
  variables: { productId: "PROD_xxx" },
});

// Subscription product versions
const subVersions = await client.graphql.query({
  query: `query ($productId: String!) {
    subscriptionProductVersions(productId: $productId) {
      id versionNumber name description billingPeriod
      prices { currency priceInfo { amount taxCategory } }
      metadata isTestVersion isProdVersion createdAt
    }
  }`,
  variables: { productId: "PROD_xxx" },
});
```

### 8. Subscription Product Groups

```typescript
const groups = await client.graphql.query({
  query: `query ($storeId: String!) {
    subscriptionProductGroups(storeId: $storeId) {
      id name description
      rules { sharedTrial }
      environment
      products {
        id name billingPeriod
        prices { currency priceInfo { amount taxCategory } }
      }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### 9. Exchange Rate Query

```typescript
const rate = await client.graphql.query({
  query: `query {
    rate(fromCurrency: USD, toCurrency: EUR) {
      fromCurrency toCurrency standardRate rateRefId expiryTime
    }
  }`,
});
```

> `CurrencyCode` is an enum type supporting 40+ ISO 4217 currency codes (e.g. `USD`, `EUR`, `GBP`, `JPY`, `CNY`). Use introspection to get the full list.

### 10. Webhook and Email Delivery Logs

```typescript
// Webhook delivery logs (auto-filtered by environment)
const webhookLogs = await client.graphql.query({
  query: `query ($storeId: String!) {
    webhookDeliveries(storeId: $storeId, limit: 20, filter: { status: { eq: "failed" } }) {
      id storeId eventType eventId
      payload webhookUrl status httpStatus responseBody
      attemptCount lastAttemptedAt createdAt
    }
    webhookDeliveriesCount(storeId: $storeId, filter: { status: { eq: "failed" } })
  }`,
  variables: { storeId: "STO_xxx" },
});

// Email delivery logs
const emailLogs = await client.graphql.query({
  query: `query ($storeId: String!) {
    emailDeliveries(storeId: $storeId, limit: 20, filter: { status: { eq: "failed" } }) {
      id storeId eventType eventId
      recipientType toAddress subject testMode
      status attemptCount lastAttemptedAt errorMessage createdAt
    }
    emailDeliveriesCount(storeId: $storeId, filter: { status: { eq: "failed" } })
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### 11. Dashboard Overview (Combined Query)

Combine multiple queries in a single request to reduce network round trips.

```typescript
interface DashboardQuery {
  store: { name: string; slug: string; status: string } | null;
  onetimeOrdersCount: number;
  subscriptionOrdersCount: number;
  onetimeOrders: Array<{
    id: string;
    buyerEmail: string;
    priceSnapshot: { currency: string; total: string };
    createdAt: string;
  }>;
  refundTickets: Array<{
    id: string;
    requestedAmountDetails: { currency: string; amount: string };
    reason: string;
    createdAt: string;
  }>;
  onetimeProductsCount: number;
  subscriptionProductsCount: number;
}
const dashboard = await client.graphql.query<DashboardQuery>({
  query: `query Dashboard($storeId: String!) {
    store(id: $storeId) { name slug status }
    onetimeOrdersCount(storeId: $storeId)
    subscriptionOrdersCount(storeId: $storeId)
    onetimeOrders(storeId: $storeId, limit: 5, filter: { status: { eq: "pending" } }) {
      id buyerEmail priceSnapshot { currency total } createdAt
    }
    refundTickets(limit: 5, filter: { status: { eq: "pending" } }) {
      id requestedAmountDetails { currency amount } reason createdAt
    }
    onetimeProductsCount(storeId: $storeId)
    subscriptionProductsCount(storeId: $storeId)
  }`,
  variables: { storeId: "STO_xxx" },
});
```

---

## Count Queries

All list queries have corresponding `*Count` queries that return the total matching a filter — useful for pagination.

```typescript
const counts = await client.graphql.query({
  query: `query ($storeId: String!) {
    storesCount
    storeMerchantsCount
    apiKeysCount
    onetimeProductsCount(storeId: $storeId, filter: { status: { eq: "active" } })
    subscriptionProductsCount(storeId: $storeId)
    subscriptionProductGroupsCount(storeId: $storeId)
    onetimeOrdersCount(storeId: $storeId)
    subscriptionOrdersCount(storeId: $storeId)
    paymentsCount
    refundsCount
    refundTicketsCount
    webhookDeliveriesCount(storeId: $storeId)
    emailDeliveriesCount(storeId: $storeId)
  }`,
  variables: { storeId: "STO_xxx" },
});
```

> Count queries accept the same `filter` parameter as their corresponding list queries.

---

## Filter Types

| Filter Type | Operations | Example Fields |
|-------------|------------|----------------|
| `StringFilter` | `eq`, `ne`, `contains`, `startsWith`, `endsWith`, `in` | `status`, `name`, `email`, `currency` |
| `DateTimeFilter` | `eq`, `ne`, `gt`, `gte`, `lt`, `lte` | `createdAt`, `updatedAt`, `expiresAt` |
| `IntFilter` | `eq`, `ne`, `gt`, `gte`, `lt`, `lte` | `amount`, `totalAmount` |
| `BooleanFilter` | `eq` | `prodEnabled`, `testMode` |

> To see which filter fields are available for a specific entity, use introspection:
> `__type(name: "OnetimeOrderFilter") { fields { name type { name } } }`

---

## Analytics Queries

Analytics queries provide aggregated statistics, trends, and insights. All analytics queries accept `storeId` (or `storeSlug`) and an `AnalyticsFilterInput` parameter.

### AnalyticsFilterInput

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filter.timeRange.startDate` | `String` | Yes | Start time (ISO 8601) |
| `filter.timeRange.endDate` | `String` | Yes | End time (ISO 8601) |
| `filter.currency` | `String` | No | Currency filter (ISO 4217) |
| `filter.status` | `String` | No | Status filter |

### TimePeriodGranularity

`DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`, `ALL_TIME`

### orderStatistics — Order Aggregation

```typescript
const orderStats = await client.graphql.query({
  query: `query ($storeId: String!) {
    orderStatistics(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      totalCount
      countsByStatus { status count }
      countsByPeriod(granularity: MONTH) { period count }
      revenueByCurrency { currency totalAmount paymentCount }
      revenueByPeriod(granularity: MONTH, currency: "usd") { period currency totalAmount paymentCount }
      buyerMetrics { totalBuyers newBuyers returningBuyers }
      revenueByCountry(currency: "usd") { country totalAmount paymentCount }
      ordersByCountry { country count }
      b2bVsB2cBreakdown(currency: "usd") { isBusiness label totalAmount orderCount }
      revenueByState(country: "US", currency: "usd") { state totalAmount paymentCount }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### paymentStatistics — Payment Success Rates & Refunds

```typescript
const paymentStats = await client.graphql.query({
  query: `query ($storeId: String!) {
    paymentStatistics(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      successRate { totalAttempts succeeded failed pending successRate }
      failedReasons { reason count percentage }
      refunds { totalCount succeededCount pendingCount failedCount amountByCurrency { currency totalAmount paymentCount } refundRate }
      methodDistribution { methodType count totalAmount percentage }
      cardBrandDistribution { brand count totalAmount percentage }
      taxSummary { currency totalTax totalPreTax totalAmount paymentCount }
      preTaxRevenueByCurrency { currency totalAmount paymentCount }
      settlementRevenueByCurrency { currency totalAmount paymentCount }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### productStatistics — Product Rankings & Revenue

```typescript
const productStats = await client.graphql.query({
  query: `query ($storeId: String!) {
    productStatistics(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      onetimeCountsByStatus { status count }
      subscriptionCountsByStatus { status count }
      onetimeTotalCount
      subscriptionTotalCount
      topByOrderCount(limit: 10) { productId productType productName orderCount totalRevenue currency }
      topByRevenue(limit: 10, currency: "usd") { productId productType productName orderCount totalRevenue currency }
      revenueContribution(currency: "usd") { productId productType productName revenue contributionPercentage cumulativePercentage }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### trendAnalysis — Growth Trends

```typescript
const trends = await client.graphql.query({
  query: `query ($storeId: String!) {
    trendAnalysis(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      orderGrowth(granularity: MONTH) { period currentValue previousValue growthRate }
      revenueGrowth(granularity: MONTH, currency: "usd") { period currentValue previousValue growthRate }
      cumulativeRevenue(granularity: MONTH, currency: "usd") { period periodValue cumulativeValue }
      orderMovingAverage(windowDays: 7) { date dailyValue movingAverage }
      revenueMovingAverage(windowDays: 7, currency: "usd") { date dailyValue movingAverage }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### distributionAnalysis — Amount Distribution & AOV

```typescript
const distribution = await client.graphql.query({
  query: `query ($storeId: String!) {
    distributionAnalysis(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      orderAmountPercentiles(currency: "usd") { p10 p25 p50 p75 p90 p95 p99 min max avg stddev count }
      aovTrend(granularity: MONTH, currency: "usd") { period averageOrderValue orderCount totalRevenue }
      orderAmountBuckets(currency: "usd", bucketCount: 10) { rangeMin rangeMax count percentage }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### customerAnalysis — Retention, LTV & Repeat Purchases

```typescript
const customers = await client.graphql.query({
  query: `query ($storeId: String!) {
    customerAnalysis(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      cohortRetention(granularity: MONTH) {
        cohortPeriod cohortSize
        retention { periodOffset activeCustomers retentionRate }
      }
      ltvDistribution(currency: "usd") {
        averageLtv medianLtv
        buckets { rangeMin rangeMax count percentage }
      }
      purchaseFrequency { purchaseCount customerCount percentage }
      repeatPurchaseRate(granularity: MONTH) { period totalBuyers repeatBuyers repeatRate }
      topCustomers(limit: 10, currency: "usd") { buyerEmail totalSpent orderCount firstPurchaseDate lastPurchaseDate }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### taxAnalysis — Tax Breakdown

```typescript
const tax = await client.graphql.query({
  query: `query ($storeId: String!) {
    taxAnalysis(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      byCategory(currency: "usd") { taxCategory totalTax totalAmount paymentCount }
      byRateGroup(currency: "usd") { taxRate totalTax totalAmount paymentCount }
      byCountry(currency: "usd") { country totalTax totalAmount paymentCount }
      b2bVsB2c(currency: "usd") { isBusiness label totalTax totalAmount orderCount }
      effectiveTaxRateTrend(granularity: MONTH, currency: "usd") { period avgTaxRate paymentCount }
      taxAmountByPeriod(granularity: MONTH, currency: "usd") { period totalTax paymentCount }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### subscriptionAnalysis — Churn, Trial Conversion & Billing

```typescript
const subscriptions = await client.graphql.query({
  query: `query ($storeId: String!) {
    subscriptionAnalysis(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      billingPeriodDistribution(currency: "usd") { billingPeriod count totalAmount percentage }
      activeCount
      cancellationStats { totalSubscriptions canceledCount cancellationRate avgLifetimeDays medianLifetimeDays }
      cancellationTrend(granularity: MONTH) { period canceledCount }
      trialConversion { totalTrials convertedCount activeTrials conversionRate }
      trialConversionByProduct { productId productName totalTrials convertedCount conversionRate }
      churnRate(granularity: MONTH) { period startActive churned churnRate }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```

### refundTicketAnalysis — Refund Reasons & Review Efficiency

```typescript
const refundAnalysis = await client.graphql.query({
  query: `query ($storeId: String!) {
    refundTicketAnalysis(
      storeId: $storeId,
      filter: { timeRange: { startDate: "2025-01-01T00:00:00Z", endDate: "2026-01-01T00:00:00Z" } }
    ) {
      reasonDistribution(currency: "usd") { reason count totalAmount percentage }
      statusDistribution { status count percentage }
      reviewEfficiency { avgHours medianHours p90Hours totalReviewed }
      ticketTrend(granularity: MONTH) { period totalCreated resolvedCount approvedCount rejectedCount }
      approvalRate { approved rejected rate }
      processingSuccessRate { succeeded failed rate }
    }
  }`,
  variables: { storeId: "STO_xxx" },
});
```
