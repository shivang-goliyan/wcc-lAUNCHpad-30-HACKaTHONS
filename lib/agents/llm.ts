// Thin wrapper over the Anthropic SDK for the text agents (caller, clinic simulator, extractor, text chat).
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';

export const LLM_MODEL = process.env.LLM_MODEL || 'claude-opus-5-5';

export function llmAvailable() {
  return process.env.KILL_SWITCH_LLM !== 'true' && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

export type Effort = 'low' | 'medium' | 'high';

/** Schema-constrained JSON output. Server-side refusal fallback is enabled. */
export async function structured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  user: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const res = await anthropic().beta.messages.parse({
    model: LLM_MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    output_config: { effort: opts.effort ?? 'low', format: betaZodOutputFormat(opts.schema) },
  });
  if (res.stop_reason === 'refusal') throw new Error('LLM refused the request');
  if (res.stop_reason === 'max_tokens') throw new Error('LLM output truncated');
  if (res.parsed_output == null) throw new Error('LLM output did not match the schema');
  return res.parsed_output as z.infer<T>;
}
