export interface StripeRequestOptions {
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

export interface StripeResponse<T> {
  data: T;
  status: number;
}
