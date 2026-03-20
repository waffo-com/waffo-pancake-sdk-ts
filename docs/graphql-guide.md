# GraphQL Guide

The Waffo Pancake GraphQL API is **query-only** — Mutations are not supported and return a 403 error. All queries go through `client.graphql.query<T>()`.

## Introspection

Introspection is **enabled by default**. Use it during development to explore the full schema, discover available types, fields, and filter conditions.

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
const storeType = await client.graphql.query({
  query: `{
    __type(name: "Store") {
      fields {
        name
        type { name kind ofType { name } }
      }
    }
  }`,
});
console.log(storeType.data?.__type.fields);
```

### Interactive Schema Browsers

You can also connect [GraphiQL](https://github.com/graphql/graphiql) or [Apollo Sandbox](https://studio.apollographql.com/sandbox) to `https://waffo-pancake-auth-service.vercel.app/v1/graphql` for interactive schema browsing with auto-complete.

---

## Practical Examples

### 1. Query a Single Entity

```typescript
// Fetch store by ID
interface StoreQuery {
  store: {
    id: string;
    name: string;
    slug: string;
    status: string;
    supportEmail: string | null;
    createdAt: string;
  } | null;
}
const { data } = await client.graphql.query<StoreQuery>({
  query: `query ($id: ID!) {
    store(id: $id) {
      id name slug status supportEmail createdAt
    }
  }`,
  variables: { id: "sto_xxx" },
});

// Fetch a one-time product by ID
interface ProductQuery {
  onetimeProduct: {
    id: string;
    name: string;
    status: string;
    prices: Record<string, { amount: number; taxCategory: string }>;
  } | null;
}
const product = await client.graphql.query<ProductQuery>({
  query: `query ($id: ID!) {
    onetimeProduct(id: $id) {
      id name status prices
    }
  }`,
  variables: { id: "prod_xxx" },
});
```

### 2. List Query with Filters and Pagination

Pagination uses `limit` (default 20) and `offset` (default 0). Typed filter objects are available for precise querying.

```typescript
// Paginated store list
interface StoresQuery {
  stores: Array<{ id: string; name: string; status: string; createdAt: string }>;
  storeCount: number;
}
const stores = await client.graphql.query<StoresQuery>({
  query: `query ($limit: Int, $offset: Int) {
    stores(limit: $limit, offset: $offset) {
      id name status createdAt
    }
    storeCount
  }`,
  variables: { limit: 10, offset: 0 },
});

// Filter orders by status and date
interface OrdersQuery {
  orders: Array<{
    id: string;
    status: string;
    currency: string;
    totalAmount: number;
    createdAt: string;
  }>;
  orderCount: number;
}
const orders = await client.graphql.query<OrdersQuery>({
  query: `query ($filter: OrderFilter, $limit: Int, $offset: Int) {
    orders(filter: $filter, limit: $limit, offset: $offset) {
      id status currency totalAmount createdAt
    }
    orderCount(filter: $filter)
  }`,
  variables: {
    filter: {
      status: { eq: "completed" },
      createdAt: { gte: "2025-01-01T00:00:00Z" },
    },
    limit: 20,
    offset: 0,
  },
});
```

### 3. Nested Relationship Queries

GraphQL supports nested queries for related entities. DataLoader is used internally for automatic batching — no N+1 issues.

```typescript
// Store → Products in a single request
interface StoreWithProductsQuery {
  store: {
    id: string;
    name: string;
    onetimeProducts: Array<{
      id: string;
      name: string;
      status: string;
      prices: Record<string, { amount: number }>;
    }>;
    subscriptionProducts: Array<{
      id: string;
      name: string;
      billingPeriod: string;
      status: string;
    }>;
  } | null;
}
const storeDetail = await client.graphql.query<StoreWithProductsQuery>({
  query: `query ($storeId: ID!) {
    store(id: $storeId) {
      id name
      onetimeProducts { id name status prices }
      subscriptionProducts { id name billingPeriod status }
    }
  }`,
  variables: { storeId: "sto_xxx" },
});

// Order → Payments → Refunds
interface OrderDetailQuery {
  order: {
    id: string;
    status: string;
    payments: Array<{
      id: string;
      status: string;
      amount: number;
      currency: string;
      refunds: Array<{ id: string; status: string; amount: number }>;
    }>;
  } | null;
}
const orderDetail = await client.graphql.query<OrderDetailQuery>({
  query: `query ($orderId: ID!) {
    order(id: $orderId) {
      id status
      payments {
        id status amount currency
        refunds { id status amount }
      }
    }
  }`,
  variables: { orderId: "ord_xxx" },
});
```

### 4. Counts and Aggregation

Use `*Count` queries to get totals. Combine with filters for dashboard-style statistics.

```typescript
interface DashboardQuery {
  storeCount: number;
  orderCount: number;
  activeSubscriptionCount: number;
}
const dashboard = await client.graphql.query<DashboardQuery>({
  query: `query ($orderFilter: OrderFilter, $subFilter: OrderFilter) {
    storeCount
    orderCount(filter: $orderFilter)
    activeSubscriptionCount: orderCount(filter: $subFilter)
  }`,
  variables: {
    orderFilter: {
      status: { eq: "completed" },
      createdAt: { gte: "2025-01-01T00:00:00Z" },
    },
    subFilter: { status: { eq: "active" } },
  },
});
console.log(`Stores: ${dashboard.data?.storeCount}`);
console.log(`Completed orders: ${dashboard.data?.orderCount}`);
console.log(`Active subscriptions: ${dashboard.data?.activeSubscriptionCount}`);
```

### 5. Batch Multiple Entity Types

Query different entity types in a single request to reduce network round trips.

```typescript
interface OverviewQuery {
  store: { id: string; name: string; status: string } | null;
  onetimeProducts: Array<{ id: string; name: string; status: string }>;
  subscriptionProducts: Array<{ id: string; name: string; billingPeriod: string }>;
  orders: Array<{ id: string; status: string; totalAmount: number; currency: string }>;
}
const overview = await client.graphql.query<OverviewQuery>({
  query: `query ($storeId: ID!) {
    store(id: $storeId) { id name status }
    onetimeProducts(limit: 5) { id name status }
    subscriptionProducts(limit: 5) { id name billingPeriod }
    orders(limit: 10, offset: 0) { id status totalAmount currency }
  }`,
  variables: { storeId: "sto_xxx" },
});
```

---

## Filter Types

| Filter Type | Operations | Example Fields |
|-------------|------------|----------------|
| `StringFilter` | `eq`, `ne`, `contains`, `startsWith`, `endsWith`, `in` | `status`, `name`, `email`, `currency` |
| `DateTimeFilter` | `eq`, `ne`, `gt`, `gte`, `lt`, `lte` | `createdAt`, `updatedAt`, `expiresAt` |
| `IntFilter` | `eq`, `ne`, `gt`, `gte`, `lt`, `lte` | `amount`, `totalAmount` |
| `BooleanFilter` | `eq` | `prodEnabled`, `testMode` |

> To see which filter fields are available for a specific entity, use introspection:
> `__type(name: "OrderFilter") { fields { name type { name } } }`
