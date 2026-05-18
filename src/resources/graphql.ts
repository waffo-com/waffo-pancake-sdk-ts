import { validateRequired } from "../validation.js";

import type { HttpClient } from "../http-client.js";
import type { GraphQLParams, GraphQLResponse } from "../types.js";

/** GraphQL query resource (Query only, no Mutations). */
export class GraphQLResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Execute a GraphQL query (Query only, no Mutations).
   *
   * @param params - GraphQL query and optional variables
   * @returns GraphQL response with data and optional errors
   *
   * @example
   * const result = await client.graphql.query<{ stores: Array<{ id: string; name: string }> }>({
   *   query: `query { stores { id name status } }`,
   * });
   * console.log(result.data?.stores);
   *
   * @example
   * const result = await client.graphql.query({
   *   query: `query ($id: ID!) { onetimeProduct(id: $id) { id name prices } }`,
   *   variables: { id: "PROD_xxx" },
   * });
   */
  async query<T = Record<string, unknown>>(params: GraphQLParams): Promise<GraphQLResponse<T>> {
    validateRequired("query", params.query);
    const result = await this.http.post<T>("/v1/graphql", params, { noIdempotency: true });
    return { data: result.data, errors: result.errors, warnings: result.warnings };
  }
}
