import { createLogger } from "@sidekik/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAgent } from "../src/agents.js";
import { buildApp } from "../src/app.js";
import { createElevenLabsClient, ElevenLabsError, type ElevenLabsClient } from "../src/elevenlabs.js";
import { readEnv } from "../src/env.js";

const INTERNAL = "internal-token-0123456789";
const agents = { interviewer: "agent_int", interviewerDebrief: "agent_deb", tutor: "agent_tut" };
const body = {
  agent: "interviewer",
  phase: "capture",
  session_id: "sess-1",
  dynamic_variables: { expert_name: "Sabine" },
  language: "de",
};

function makeApp(elevenlabs: ElevenLabsClient, agentIds = agents) {
  return buildApp({ logger: createLogger("voice", { level: "silent" }), internalToken: INTERNAL, agents: agentIds, elevenlabs });
}
const okClient = (): ElevenLabsClient & { calls: string[] } => {
  const calls: string[] = [];
  return { calls, conversationToken: async (agentId) => (calls.push(agentId), { token: `tok-for-${agentId}` }) };
};
const post = (app: ReturnType<typeof makeApp>, payload: unknown, token: string | null = INTERNAL) =>
  app.inject({
    method: "POST",
    url: "/internal/token",
    headers: token ? { "x-internal-token": token } : {},
    payload: payload as object,
  });

describe("POST /internal/token", () => {
  it("rejects calls without the internal token", async () => {
    const res = await post(makeApp(okClient()), body, null);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a body that doesn't match VoiceTokenRequest", async () => {
    const res = await post(makeApp(okClient()), { ...body, agent: "narrator" });
    expect(res.statusCode).toBe(400);
  });

  it("mints a token for the capture interviewer", async () => {
    const el = okClient();
    const res = await post(makeApp(el), body);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ conversation_token: "tok-for-agent_int", agent_id: "agent_int" });
    expect(el.calls).toEqual(["agent_int"]);
  });

  it("uses the debrief agent for the debrief phase and the tutor agent for tutoring", async () => {
    const el = okClient();
    const app = makeApp(el);
    expect((await post(app, { ...body, phase: "debrief" })).json().agent_id).toBe("agent_deb");
    expect((await post(app, { ...body, agent: "tutor", phase: "tutoring" })).json().agent_id).toBe("agent_tut");
  });

  it("returns 502 when ElevenLabs fails, without leaking its error", async () => {
    const el: ElevenLabsClient = {
      conversationToken: async () => {
        throw new ElevenLabsError("token request returned 401: invalid api key", 401);
      },
    };
    const res = await post(makeApp(el), body);
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: "elevenlabs_unavailable" });
  });
});

describe("resolveAgent", () => {
  it("falls back to the capture interviewer when no debrief agent is set", () => {
    expect(resolveAgent("interviewer", "debrief", { interviewer: "a", tutor: "t" })).toEqual({
      agentId: "a",
      usedFallback: true,
    });
  });
});

describe("createElevenLabsClient", () => {
  afterEach(() => vi.restoreAllMocks());

  it("calls GET /v1/convai/conversation/token with the API key and agent id", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ token: "webrtc-tok", conversation_id: "conv_1" }));
    const client = createElevenLabsClient({
      apiKey: "xi-key",
      baseUrl: "https://api.elevenlabs.io",
      timeoutMs: 400,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(await client.conversationToken("agent_int")).toEqual({ token: "webrtc-tok", conversationId: "conv_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_int");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("xi-key");
  });

  it("turns HTTP errors and missing tokens into ElevenLabsError", async () => {
    const failing = createElevenLabsClient({
      apiKey: "k",
      baseUrl: "https://api.elevenlabs.io",
      timeoutMs: 400,
      fetchImpl: (async () => new Response("nope", { status: 403 })) as unknown as typeof fetch,
    });
    await expect(failing.conversationToken("a")).rejects.toMatchObject({ name: "ElevenLabsError", status: 403 });

    const empty = createElevenLabsClient({
      apiKey: "k",
      baseUrl: "https://api.elevenlabs.io",
      timeoutMs: 400,
      fetchImpl: (async () => Response.json({})) as unknown as typeof fetch,
    });
    await expect(empty.conversationToken("a")).rejects.toThrow("no token");
  });
});

describe("readEnv", () => {
  const base = {
    PORT: "8085",
    REDIS_URL: "redis://localhost:6379",
    SUPABASE_URL: "https://x.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "srk",
    SK_INTERNAL_TOKEN: INTERNAL,
    ELEVENLABS_API_KEY: "xi",
    EL_INTERVIEWER_AGENT_ID: "agent_int",
    EL_TUTOR_AGENT_ID: "agent_tut",
  };

  it("treats empty optional values as unset", () => {
    const env = readEnv({ ...base, EL_INTERVIEWER_DEBRIEF_AGENT_ID: "", SK_TOOL_SECRET: "" });
    expect(env.EL_INTERVIEWER_DEBRIEF_AGENT_ID).toBeUndefined();
    expect(env.EL_TIMEOUT_MS).toBe(400);
  });

  it("fails at boot when the ElevenLabs key is missing", () => {
    expect(() => readEnv({ ...base, ELEVENLABS_API_KEY: "" })).toThrow(/ELEVENLABS_API_KEY/);
  });
});
