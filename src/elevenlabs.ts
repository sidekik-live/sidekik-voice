// Minimal ElevenLabs Agents API client. Only what voice needs; never used from the browser.

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

export interface ConversationToken {
  token: string;
  conversationId?: string;
}

export interface ElevenLabsClient {
  /** WebRTC conversation token for one agent. Overrides and dynamic variables are set by the page at startSession. */
  conversationToken(agentId: string): Promise<ConversationToken>;
}

export interface ElevenLabsClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export function createElevenLabsClient(opts: ElevenLabsClientOptions): ElevenLabsClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return {
    async conversationToken(agentId) {
      const url = new URL("/v1/convai/conversation/token", opts.baseUrl);
      url.searchParams.set("agent_id", agentId);
      let res: Response;
      try {
        res = await fetchImpl(url, {
          headers: { "xi-api-key": opts.apiKey },
          signal: AbortSignal.timeout(opts.timeoutMs),
        });
      } catch (err) {
        throw new ElevenLabsError(`token request failed: ${(err as Error).name}`);
      }
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 200);
        throw new ElevenLabsError(`token request returned ${res.status}: ${detail}`, res.status);
      }
      const body = (await res.json()) as { token?: unknown; conversation_id?: unknown };
      if (typeof body.token !== "string" || !body.token) {
        throw new ElevenLabsError("token response had no token");
      }
      return typeof body.conversation_id === "string"
        ? { token: body.token, conversationId: body.conversation_id }
        : { token: body.token };
    },
  };
}
