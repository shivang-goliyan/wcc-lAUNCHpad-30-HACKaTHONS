// The text agents' model access (caller, clinic simulator, extractor, text chat).
// Two providers: Anthropic (default when ANTHROPIC_API_KEY is set), or any
// OpenAI-compatible endpoint (OpenRouter, OpenAI, Gemini, Groq...) with LLM_PROVIDER=openai.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

const OPENAI_COMPAT = process.env.LLM_PROVIDER === 'openai';
const COMPAT_BASE = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
// several keys for the same provider: calls start on a rotating key and move to the
// next one when a key is rate-limited (free tiers are per key or per account)
const COMPAT_KEYS = [
  process.env.LLM_API_KEY,
  ...(process.env.LLM_API_KEYS || '').split(','),
  ...(COMPAT_BASE.includes('openrouter.ai') ? [process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_API_KEY_2] : []),
]
  .map((k) => k?.trim())
  .filter((k, i, all): k is string => !!k && all.indexOf(k) === i);
let nextKey = 0;
const COMPAT_KEY = COMPAT_KEYS[0] ?? '';
// OpenRouter only: other models to try when the first one is busy
const FALLBACK_MODELS = (process.env.LLM_FALLBACK_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);

// compat providers name models differently, so there is no default there: set LLM_MODEL
/** Nami's own conversation can run on a faster model than the call agents (CHAT_MODEL). */
export const CHAT_MODEL = process.env.CHAT_MODEL || '';
export const LLM_MODEL = process.env.LLM_MODEL || (OPENAI_COMPAT ? '' : 'claude-opus-5-5');

export function llmAvailable() {
  if (process.env.KILL_SWITCH_LLM === 'true') return false;
  return OPENAI_COMPAT ? !!COMPAT_KEY && !!LLM_MODEL : !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}

export type Effort = 'low' | 'medium' | 'high';

/** Schema-constrained JSON output, validated with zod whatever the provider. */
export async function structured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  user: string;
  effort?: Effort;
  maxTokens?: number;
}): Promise<z.infer<T>> {
  if (OPENAI_COMPAT) return structuredCompat(opts);
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

/* ---------------- OpenAI-compatible ---------------- */

export type CompatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: CompatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export type CompatToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type CompatTool = { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } };

const HEDGE_MS = Number(process.env.LLM_HEDGE_MS || 4000);

/** One model, walking the keys past rate limits and dead keys. Resolves only with an OK response. */
async function askModel(model: string, body: object, routed: object, until: number): Promise<Response> {
  const start = nextKey++ % Math.max(1, COMPAT_KEYS.length);
  const keys = [...COMPAT_KEYS.slice(start), ...COMPAT_KEYS.slice(0, start)];
  let last = 'no keys';
  for (let k = 0; k < keys.length; k++) {
    const left = until - Date.now();
    if (left < 2_000) break;
    let r: Response;
    try {
      r = await fetch(`${COMPAT_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys[k]}` },
        body: JSON.stringify({ model, temperature: 0.3, ...routed, ...body }),
        signal: AbortSignal.timeout(Math.min(25_000, left)),
      });
    } catch {
      throw new Error(`${model} did not answer`);
    }
    if (r.ok) return r;
    last = `${r.status}: ${(await r.text()).slice(0, 200)}`;
    // rate-limited, out of credit, or a disabled key: same model, next key
    if ([401, 402, 403, 429].includes(r.status)) continue;
    // overloaded upstream: one short retry on another key, then give up on this model
    if (r.status >= 500 && k === 0) {
      await new Promise((res) => setTimeout(res, 400));
      continue;
    }
    break;
  }
  throw new Error(`LLM provider said ${last}`);
}

export async function compatChat(body: { messages: CompatMessage[]; tools?: CompatTool[]; response_format?: unknown; max_tokens?: number }, opts: { model?: string } = {}) {
  const head = opts.model || LLM_MODEL;
  const openrouter = COMPAT_BASE.includes('openrouter.ai');
  const routed = openrouter && FALLBACK_MODELS.length ? { models: [head, ...FALLBACK_MODELS] } : {};
  // OpenRouter falls back by itself. Elsewhere we hedge: if the main model is slow or failing,
  // the next one is asked too and the first good answer wins, so an overloaded model costs seconds, not the turn.
  const models = openrouter ? [head] : [head, ...[LLM_MODEL, ...FALLBACK_MODELS].filter((m, i, all) => m !== head && all.indexOf(m) === i)];
  const until = Date.now() + 40_000;
  const r: Response | null = await new Promise((resolve) => {
    let pending = 0;
    let done = false;
    let next = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const launch = () => {
      if (done || next >= models.length) return;
      const m = models[next++];
      pending++;
      clearTimeout(timer);
      if (next < models.length) timer = setTimeout(launch, HEDGE_MS);
      askModel(m, body, routed, until).then(
        (res) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(res);
        },
        () => {
          pending--;
          if (done) return;
          if (next < models.length) launch();
          else if (pending === 0) resolve(null);
        },
      );
    };
    launch();
  });
  if (!r) throw new Error('LLM provider did not answer');
  if (!r.ok) throw new Error(`LLM provider said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = (await r.json()) as {
    choices?: { message: { content: string | null; tool_calls?: CompatToolCall[] }; finish_reason: string }[];
  };
  const c = data.choices?.[0];
  if (!c) throw new Error('LLM provider returned no choices');
  return c;
}

async function structuredCompat<T extends z.ZodType>(opts: { schema: T; system: string; user: string; maxTokens?: number }): Promise<z.infer<T>> {
  const js = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  delete js.$schema;
  const messages: CompatMessage[] = [
    { role: 'system', content: `${opts.system}\n\nReply with a single JSON object that matches this JSON Schema, nothing else:\n${JSON.stringify(js)}` },
    { role: 'user', content: opts.user },
  ];
  // one retry with the validation error, then give up (callers fall back to the scripted path)
  for (let attempt = 0; attempt < 2; attempt++) {
    const c = await compatChat({
      messages,
      response_format: { type: 'json_schema', json_schema: { name: 'output', schema: js, strict: false } },
      max_tokens: opts.maxTokens ?? 4000,
    });
    if (c.finish_reason === 'length') throw new Error('LLM output truncated');
    const text = (c.message.content ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    try {
      return opts.schema.parse(JSON.parse(text));
    } catch (e) {
      messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That did not match the schema (${String(e).slice(0, 300)}). Reply with corrected JSON only.` });
    }
  }
  throw new Error('LLM output did not match the schema');
}

export const usingCompat = () => OPENAI_COMPAT;

/** The model's first move for one user message: a tool call, or text. Nothing is executed. */
export async function firstDecision(
  system: string,
  tools: { name: string; description: string; parameters: Record<string, unknown> }[],
  userText: string,
): Promise<{ call: { name: string; input: Record<string, unknown> } | null; text: string }> {
  if (OPENAI_COMPAT) {
    const c = await compatChat({
      messages: [{ role: 'system', content: system }, { role: 'user', content: userText }],
      tools: tools.map((t) => ({ type: 'function' as const, function: t })),
      max_tokens: 1500,
    }, { model: CHAT_MODEL });
    const tc = c.message.tool_calls?.[0];
    let input: Record<string, unknown> = {};
    try {
      input = tc ? JSON.parse(tc.function.arguments || '{}') : {};
    } catch {}
    return { call: tc ? { name: tc.function.name, input } : null, text: c.message.content ?? '' };
  }
  const res = await anthropic().beta.messages.create({
    model: LLM_MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system,
    tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool['input_schema'] })),
    messages: [{ role: 'user', content: userText }],
  });
  const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
  const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join(' ');
  return { call: call ? { name: call.name, input: (call.input ?? {}) as Record<string, unknown> } : null, text };
}
