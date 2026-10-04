import { Spectrum } from 'spectrum-ts';
import { imessage } from '@spectrum-ts/imessage';
import { Agent, type AgentMessage, type AgentSpace } from './agent';
import { makeBrain } from './brain';
import { demoContext } from './demoContext';

// Flakey on iMessage: the same Squad Bot brain as the ShamePool app (its /api/ai/chat route),
// reachable from a phone number. Docs: https://photon.codes/docs/spectrum-ts
const projectId = process.env.PROJECT_ID;
const projectSecret = process.env.PROJECT_SECRET;
if (!projectId || !projectSecret) {
  console.error('Missing PROJECT_ID / PROJECT_SECRET. Copy .env.example to .env and fill them from the Photon dashboard.');
  process.exit(1);
}

const baseUrl = process.env.SHAMEPOOL_URL ?? 'https://shamepool.vercel.app';
const agent = new Agent({ brain: makeBrain(baseUrl), context: () => demoContext() });

const providers: unknown[] = [imessage.config()];
if (process.env.SPECTRUM_TERMINAL) {
  const { terminal } = await import('@spectrum-ts/terminal'); // chat from the command line, no phone needed
  providers.push(terminal);
}

const app = await Spectrum({ projectId, projectSecret, providers: providers as never });
console.log(`Flakey is listening. Brain: ${baseUrl}`);

for await (const [space, message] of app.messages) {
  // do not await: one slow answer must not block the next conversation
  agent.handle(space as unknown as AgentSpace, message as unknown as AgentMessage)
    .catch((e) => console.error('handler failed:', e instanceof Error ? e.message : e));
}
