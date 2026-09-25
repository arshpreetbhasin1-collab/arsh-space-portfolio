import Anthropic from '@anthropic-ai/sdk';
import { GUIDE_SYSTEM_PROMPT } from './_prompt.js';

// Portfolio guide endpoint (Vercel Function, Web Request/Response). Streams plain text.
// Credentials come from the environment (ANTHROPIC_API_KEY on Vercel); without them the
// endpoint answers 503 and the browser falls back to its offline answer engine.

const MAX_TURNS = 16;
const MAX_CHARS = 1500;

type Turn = { role: 'user' | 'assistant'; content: string };

function parseTurns(body: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { messages?: unknown }).messages)) return null;
  const raw = (body as { messages: unknown[] }).messages.slice(-MAX_TURNS);
  const turns: Turn[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as Partial<Turn>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return null;
    turns.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return null;
  return turns;
}

function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE);
}

let client: Anthropic | null = null;

export async function handleChat(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!hasCredentials()) return new Response('Guide offline', { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const messages = parseTurns(body);
  if (!messages) return new Response('Invalid conversation', { status: 400 });

  const api = (client ??= new Anthropic());
  const params = {
    model: 'claude-opus-5',
    max_tokens: 2048,
    // Short, factual Q&A: low effort keeps answers fast and cheap without losing accuracy.
    output_config: { effort: 'low' },
    // If a request is declined by a safety classifier, retry server-side on the model
    // Anthropic recommends for that refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{ type: 'text', text: GUIDE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // `fallbacks: "default"` is newer than the SDK's typings.
        const run = api.beta.messages.stream(params as unknown as Parameters<typeof api.beta.messages.stream>[0]);
        for await (const event of run) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await run.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('\n\nI can’t help with that one. Ask me about Arshpreet’s projects, skills or how to contact him.'));
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('…'));
        }
      } catch (error) {
        let note = 'The guide hit a problem. Please try again in a moment.';
        if (error instanceof Anthropic.RateLimitError) note = 'The guide is busy right now. Please try again in a minute.';
        else if (error instanceof Anthropic.AuthenticationError) note = 'The guide is not configured correctly.';
        else if (error instanceof Anthropic.APIError) console.error('guide api error', error.status, error.message);
        else console.error('guide error', error);
        controller.enqueue(encoder.encode(note));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

export default { fetch: handleChat };
