import type { StripeRequestOptions, StripeResponse } from "./types.js";

const BASE_URL = "https://api.stripe.com/v1";

/**
 * Minimal Stripe wrapper template used by updater output.
 */
export class StripeClient {
  constructor(private readonly apiKey: string) {}

  /**
   * Executes a Stripe endpoint call.
   */
  async call<T = unknown>(method: string, options: StripeRequestOptions = {}): Promise<StripeResponse<T>> {
    const path = method.replace(/\./g, "/");
    const url = `${BASE_URL}/${path}`;
    const response = await fetch(url, {
      method: options.httpMethod ?? "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Stripe API request failed: ${response.status} ${response.statusText}`);
    }

    return { data: (await response.json()) as T, status: response.status };
  }
}
