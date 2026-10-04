import { createLogger } from "@sidekik/contracts";
import { buildApp } from "./app.js";
import { createElevenLabsClient } from "./elevenlabs.js";
import { readEnv } from "./env.js";

const env = readEnv();
const logger = createLogger("voice");

const app = buildApp({
  logger,
  internalToken: env.SK_INTERNAL_TOKEN,
  agents: {
    interviewer: env.EL_INTERVIEWER_AGENT_ID,
    interviewerDebrief: env.EL_INTERVIEWER_DEBRIEF_AGENT_ID,
    tutor: env.EL_TUTOR_AGENT_ID,
  },
  elevenlabs: createElevenLabsClient({
    apiKey: env.ELEVENLABS_API_KEY,
    baseUrl: env.EL_API_URL,
    timeoutMs: env.EL_TIMEOUT_MS,
  }),
  version: process.env["RAILWAY_GIT_COMMIT_SHA"]?.slice(0, 7) ?? "dev",
});

if (!env.EL_INTERVIEWER_DEBRIEF_AGENT_ID) {
  logger.warn("EL_INTERVIEWER_DEBRIEF_AGENT_ID is not set; the debrief will run on the capture prompt");
}

await app.listen({ host: "::", port: env.PORT });
