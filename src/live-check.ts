// Manual check: asks the real shared brain (production ShamePool) a few questions with the demo squad context.
import { makeBrain } from './brain';
import { demoContext } from './demoContext';
const brain = makeBrain(process.env.SHAMEPOOL_URL ?? 'https://shamepool.vercel.app');
for (const q of ["who's flaking the most?", 'how close are we to pizza?', 'quien va ganando?', 'make my gym penalty twelve bucks']) {
  const t0 = Date.now();
  const r = await brain(q, [], demoContext());
  console.log(`[${Date.now() - t0}ms] ${q}\n   -> ${r ? r.text + (r.action ? '  (ACTION ' + JSON.stringify(r.action) + ')' : '') : 'NO REPLY'}`);
}
