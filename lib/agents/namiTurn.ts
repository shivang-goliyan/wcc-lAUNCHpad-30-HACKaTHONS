// One turn of Nami's conversation on an OpenAI-compatible model: the same agent, tools and
// fallbacks whether she is answering the app's text box or someone on the phone.
import { compatChat, CHAT_MODEL, type CompatMessage } from './llm';
import { executeTool, toolJsonSchemas } from './tools';

export const SORRY = 'Sorry, I cannot help with that. If this is an emergency, please call 112.';

// tool hints come back in the household's language; the reply should still follow what was just said
const HINGLISH = /\b(hai|hain|kar|karo|kya|mera|meri|mujhe|aaj|kal|haan|nahi|nahin|theek|dawai|ji|aap|bata|chahiye)\b/i;
export function replyLanguage(text: string) {
  if (/[ऀ-ॿ]/.test(text)) return '\n\nThe last message is in Hindi. Reply in simple Hindi written in Devanagari script, not in Roman letters.';
  if (HINGLISH.test(text)) return '\n\nThe last message is in Hinglish. Reply in Hinglish (Roman script).';
  return '\n\nThe last message is in English. Reply in simple English, even if tool hints are in Hindi.';
}

export type Turn = { role: 'user' | 'assistant'; text: string };

export async function namiReply(hh: string, system: string, history: Turn[], message: string, source: 'text' | 'voice' = 'text') {
  const tools = toolJsonSchemas().map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: CompatMessage[] = [{ role: 'system', content: system }, ...history.map((h) => ({ role: h.role, content: h.text })), { role: 'user', content: message }];
  const toolLog: { name: string; ok: boolean; status: string }[] = [];
  let lastHint = '';
  for (let i = 0; i < 5; i++) {
    const c = await compatChat({ messages, tools, max_tokens: 2000 }, { model: CHAT_MODEL });
    if (c.finish_reason === 'content_filter') return { ok: true, text: SORRY, tools: toolLog };
    const calls = c.message.tool_calls ?? [];
    // some models end a tool turn with no words; then say what the last tool said, never nothing
    if (!calls.length) return { ok: true, text: (c.message.content ?? '').trim() || lastHint || 'Done. Please check the screen.', tools: toolLog };
    messages.push({ role: 'assistant', content: c.message.content, tool_calls: calls });
    for (const call of calls) {
      let input: unknown = {};
      try {
        input = JSON.parse(call.function.arguments || '{}');
      } catch {}
      const reply = await executeTool(hh, call.function.name, input, { source, lastUserTranscript: message });
      toolLog.push({ name: call.function.name, ok: reply.ok, status: reply.status });
      if (reply.sayHint) lastHint = reply.sayHint;
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(reply) });
    }
  }
  return { ok: true, text: 'I have done what I can for now, please check the screen.', tools: toolLog };
}
