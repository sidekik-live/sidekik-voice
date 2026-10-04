import {
  internalAuth,
  VoiceTokenRequestSchema,
  VoiceTokenResponseSchema,
  type Logger,
} from "@sidekik/contracts";
import Fastify from "fastify";
import { resolveAgent, type AgentIds } from "./agents.js";
import { ElevenLabsError, type ElevenLabsClient } from "./elevenlabs.js";

export interface AppDeps {
  logger: Logger;
  internalToken: string;
  agents: AgentIds;
  elevenlabs: ElevenLabsClient;
  version?: string;
}

export function buildApp(deps: AppDeps) {
  const app = Fastify({ loggerInstance: deps.logger });

  app.get("/healthz", async () => ({
    ok: true,
    version: deps.version ?? "dev",
    deps: {
      elevenlabs: "configured",
      debrief_agent: deps.agents.interviewerDebrief ? "configured" : "missing (falls back to interviewer)",
    },
  }));

  // DESIGN §4: gateway → voice, 500 ms budget. Returns a WebRTC conversation token for the
  // agent that serves this phase. Dynamic variables are passed back by the gateway to the page,
  // which hands them to startSession; ElevenLabs tokens don't carry them.
  app.post("/internal/token", { preHandler: internalAuth(deps.internalToken) }, async (req, reply) => {
    const parsed = VoiceTokenRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", issues: parsed.error.issues });
    }
    const { agent, phase, session_id } = parsed.data;
    const log = req.log.child({ session_id, agent, phase });
    const { agentId, usedFallback } = resolveAgent(agent, phase, deps.agents);
    if (usedFallback) log.warn("EL_INTERVIEWER_DEBRIEF_AGENT_ID not set; debrief uses the capture interviewer");

    const started = performance.now();
    try {
      const { token } = await deps.elevenlabs.conversationToken(agentId);
      log.info({ latency_ms: Math.round(performance.now() - started), agent_id: agentId }, "conversation token minted");
      return VoiceTokenResponseSchema.parse({ conversation_token: token, agent_id: agentId });
    } catch (err) {
      const status = err instanceof ElevenLabsError ? err.status : undefined;
      log.error(
        { latency_ms: Math.round(performance.now() - started), el_status: status, err: (err as Error).message },
        "conversation token failed",
      );
      return reply.code(502).send({ error: "elevenlabs_unavailable" });
    }
  });

  return app;
}
