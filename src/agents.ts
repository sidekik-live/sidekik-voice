import type { Phase } from "@sidekik/contracts";

export interface AgentIds {
  interviewer: string;
  /** The debrief prompt lives on its own agent; without it the debrief runs on the capture prompt. */
  interviewerDebrief?: string | undefined;
  tutor: string;
}

export interface ResolvedAgent {
  agentId: string;
  /** True when the debrief was requested but no debrief agent is configured. */
  usedFallback: boolean;
}

/** Which ElevenLabs agent serves this session phase (DESIGN §3: Interviewer capture/debrief, Tutor). */
export function resolveAgent(agent: "interviewer" | "tutor", phase: Phase, ids: AgentIds): ResolvedAgent {
  if (agent === "tutor") return { agentId: ids.tutor, usedFallback: false };
  if (phase === "debrief") {
    return ids.interviewerDebrief
      ? { agentId: ids.interviewerDebrief, usedFallback: false }
      : { agentId: ids.interviewer, usedFallback: true };
  }
  return { agentId: ids.interviewer, usedFallback: false };
}
