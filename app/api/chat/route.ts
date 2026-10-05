// Text mode: same prompt, same tools, the model drives the tool loop server-side.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { anthropic, LLM_MODEL, llmAvailable, usingCompat } from '@/lib/agents/llm';
import { namiReply, replyLanguage, SORRY } from '@/lib/agents/namiTurn';
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
    const system =
      (await namiInstructions(hh, 'text')) +
      replyLanguage(b.message) +
      '\n\nHer screen already introduces you as an AI. Do not introduce yourself again unless she asks who or what you are.';
    if (usingCompat()) return json(await namiReply(hh, system, b.history, b.message, 'text'));
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


/** The same loop for an OpenAI-compatible provider. */
