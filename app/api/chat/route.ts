// Text mode: same prompt, same tools, the model drives the tool loop server-side.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { anthropic, compatChat, LLM_MODEL, llmAvailable, usingCompat, type CompatMessage } from '@/lib/agents/llm';
import { namiInstructions } from '@/lib/agents/namiPrompt';
import { executeTool, toolJsonSchemas } from '@/lib/agents/tools';
import { currentHousehold } from '@/lib/server/session';
import { handleError, json } from '@/lib/server/http';

const Body = z.object({ history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) })).max(20), message: z.string().min(1).max(1000) });

export async function POST(req: Request) {
  try {
    const hh = await currentHousehold();
    if (!hh) return json({ ok: false, error: 'no_household' }, 401);
    if (!llmAvailable()) return json({ ok: false, error: 'llm_not_configured' }, 503);
    const b = Body.parse(await req.json());
    const system = await namiInstructions(hh, 'text');
    if (usingCompat()) return json(await compatLoop(hh, system, b));
    const tools: Anthropic.Beta.BetaTool[] = toolJsonSchemas().map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters as Anthropic.Beta.BetaTool['input_schema'] }));
    const messages: Anthropic.Beta.BetaMessageParam[] = [...b.history.map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: b.message }];
    const toolLog: { name: string; ok: boolean; status: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await anthropic().beta.messages.create({
        model: LLM_MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system,
        tools,
        messages,
      });
      if (res.stop_reason === 'refusal') return json({ ok: true, text: SORRY, tools: toolLog });
      if (res.stop_reason !== 'tool_use') {
        const text = res.content.filter((c): c is Anthropic.Beta.BetaTextBlock => c.type === 'text').map((c) => c.text).join('\n').trim();
        return json({ ok: true, text, tools: toolLog });
      }
      messages.push({ role: 'assistant', content: res.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== 'tool_use') continue;
        const reply = await executeTool(hh, block.name, block.input, { source: 'text', lastUserTranscript: b.message });
        toolLog.push({ name: block.name, ok: reply.ok, status: reply.status });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(reply), is_error: !reply.ok });
      }
      messages.push({ role: 'user', content: results });
    }
    return json({ ok: true, text: 'I have done what I can for now, please check the screen.', tools: toolLog });
  } catch (e) {
    return handleError(e);
  }
}

const SORRY = 'Sorry, I cannot help with that. If this is an emergency, please call 112.';

/** The same loop for an OpenAI-compatible provider. */
async function compatLoop(hh: string, system: string, b: z.infer<typeof Body>) {
  const tools = toolJsonSchemas().map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: CompatMessage[] = [{ role: 'system', content: system }, ...b.history.map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: b.message }];
  const toolLog: { name: string; ok: boolean; status: string }[] = [];
  for (let i = 0; i < 5; i++) {
    const c = await compatChat({ messages, tools, max_tokens: 2000 });
    if (c.finish_reason === 'content_filter') return { ok: true, text: SORRY, tools: toolLog };
    const calls = c.message.tool_calls ?? [];
    if (!calls.length) return { ok: true, text: (c.message.content ?? '').trim(), tools: toolLog };
    messages.push({ role: 'assistant', content: c.message.content, tool_calls: calls });
    for (const call of calls) {
      let input: unknown = {};
      try {
        input = JSON.parse(call.function.arguments || '{}');
      } catch {}
      const reply = await executeTool(hh, call.function.name, input, { source: 'text', lastUserTranscript: b.message });
      toolLog.push({ name: call.function.name, ok: reply.ok, status: reply.status });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(reply) });
    }
  }
  return { ok: true, text: 'I have done what I can for now, please check the screen.', tools: toolLog };
}
