export interface RawHttpResponse {
  readonly status: number;
  readonly bodyText: string;
}

export interface HttpJsonDriver {
  postJson(url: string, bodyJson: string): Promise<RawHttpResponse>;
}

export class FetchHttpJsonDriver implements HttpJsonDriver {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 5000) {
    this.timeoutMs = timeoutMs;
  }

  async postJson(url: string, bodyJson: string): Promise<RawHttpResponse> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bodyJson,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const bodyText = await response.text();
    return { status: response.status, bodyText };
  }
}
