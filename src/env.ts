import { BaseServiceEnvSchema, loadEnv } from "@sidekik/contracts";
import { z } from "zod";

// `KEY=` in a .env file arrives as "", which should count as "not set".
const optionalString = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.url().optional());

export const EnvSchema = BaseServiceEnvSchema.extend({
  ELEVENLABS_API_KEY: z.string().min(1),
  EL_INTERVIEWER_AGENT_ID: z.string().min(1),
  /** Separate agent with the debrief prompt. ElevenLabs tokens can't carry prompt overrides. */
  EL_INTERVIEWER_DEBRIEF_AGENT_ID: optionalString,
  EL_TUTOR_AGENT_ID: z.string().min(1),
  EL_API_URL: z.url().default("https://api.elevenlabs.io"),
  /** Gateway budget for /internal/token is 500 ms (ARCHITECTURE §4.3). */
  EL_TIMEOUT_MS: z.coerce.number().int().positive().default(400),
  // Used by later tickets (webhook tools, post-call webhook, redaction via gateway).
  SK_TOOL_SECRET: optionalString,
  EL_WEBHOOK_SECRET: optionalString,
  GATEWAY_INTERNAL_URL: optionalUrl,
});
export type Env = z.infer<typeof EnvSchema>;

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  return loadEnv(EnvSchema, source);
}
