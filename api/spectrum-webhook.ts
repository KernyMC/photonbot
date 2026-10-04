// Vercel Function: receives Photon Spectrum webhooks (signed HTTP POSTs) and answers with the same Squad Bot brain.
// Spectrum verifies the HMAC signature (SPECTRUM_WEBHOOK_SECRET) and runs our handler AFTER the HTTP response is sent,
// so we keep the function alive with waitUntil until the reply has gone out.
import { waitUntil } from '@vercel/functions';
import { Spectrum } from 'spectrum-ts';
import { imessage } from '@spectrum-ts/imessage';
import { Agent, type AgentMessage, type AgentSpace } from '../src/agent.js';
import { makeBrain } from '../src/brain.js';
import { demoContext } from '../src/demoContext.js';

const SAFETY_MS = 25_000; // release the function even if Spectrum never runs the handler (e.g. an event we ignore)

const agent = new Agent({
  brain: makeBrain(process.env.SHAMEPOOL_URL ?? 'https://shamepool.vercel.app'),
  context: () => demoContext(),
});

let appPromise: ReturnType<typeof createApp> | null = null;
function createApp() {
  return Spectrum({
    projectId: process.env.PROJECT_ID!,
    projectSecret: process.env.PROJECT_SECRET!,
    providers: [imessage.config()],
    webhookSecret: process.env.SPECTRUM_WEBHOOK_SECRET,
  });
}
const getApp = () => (appPromise ??= createApp());

// Deliveries are at-least-once: remember recent message ids on this warm instance and skip repeats.
const seen = new Map<string, number>();
function isDuplicate(id: string | undefined): boolean {
  if (!id) return false;
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 10 * 60_000) seen.delete(k);
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

export async function POST(req: Request): Promise<Response> {
  if (!process.env.PROJECT_ID || !process.env.PROJECT_SECRET) {
    return Response.json({ error: 'not_configured' }, { status: 500 });
  }
  const app = await getApp();

  let finish!: () => void;
  const done = new Promise<void>((resolve) => { finish = resolve; });
  waitUntil(Promise.race([done, new Promise<void>((resolve) => setTimeout(resolve, SAFETY_MS))]));

  const res = await app.webhook(req, async (space, message) => {
    try {
      if (isDuplicate(message.id)) return;
      await agent.handle(space as unknown as AgentSpace, message as unknown as AgentMessage);
    } catch (e) {
      console.error('handler failed:', e instanceof Error ? e.message : e);
    } finally {
      finish();
    }
  });
  if (res.status >= 400) finish(); // rejected (bad signature, missing headers): the handler will never run
  return res;
}

/** Health check: open the URL in a browser to see that the function is deployed. */
export function GET(): Response {
  return Response.json({ ok: true, agent: 'Flakey on iMessage', webhook: 'POST /api/spectrum-webhook' });
}
