import { beforeEach, describe, expect, it } from 'bun:test';
import { Agent, type AgentMessage, type AgentSpace } from './agent';
import type { Brain, BrainReply, Turn } from './brain';
import { makeBrain } from './brain';
import { demoContext } from './demoContext';

function space(id = 's1', members = 2) {
  const sent: string[] = [];
  const s: AgentSpace & { sent: string[]; typing: number } = {
    id, sent, typing: 0,
    getMembers: async () => Array.from({ length: members }, (_, i) => ({ id: `m${i}` })),
    responding: async (fn) => { s.typing++; return fn(); },
    send: async (t: string) => { sent.push(t); },
  };
  return s;
}
const msg = (text: string, over: Partial<AgentMessage> = {}): AgentMessage => ({
  direction: 'inbound', content: { type: 'text', text }, sender: { id: 'u1' }, read: async () => {}, ...over,
});

let calls: { message: string; history: Turn[]; context: Record<string, unknown> }[];
let reply: BrainReply | null;
const brain: Brain = async (message, history, context) => { calls.push({ message, history, context }); return reply; };
const make = (now = () => 1_000_000) => new Agent({ brain, context: () => demoContext(new Date('2026-10-07')), now });

beforeEach(() => { calls = []; reply = { text: 'Kevin, obviously.', action: null }; });

describe('direct chats', () => {
  it('answers with the shared brain and shows the typing indicator', async () => {
    const a = make(); const s = space();
    await a.handle(s, msg("who's flaking?"));
    expect(s.sent).toEqual(['Kevin, obviously.']);
    expect(s.typing).toBe(1);
    expect(calls[0]!.message).toBe("who's flaking?");
    expect((calls[0]!.context.squad as { name: string }).name).toBe('MHacks Crew');
  });
  it('keeps the last 6 turns as history, per conversation, and /reset clears it', async () => {
    const a = make(); const s = space('A'); const other = space('B');
    for (let i = 0; i < 5; i++) await a.handle(s, msg(`q${i}`, { sender: { id: `u${i}` } }));
    expect(calls[4]!.history).toHaveLength(6);
    await a.handle(other, msg('hi there friend', { sender: { id: 'other' } }));
    expect(calls[5]!.history).toHaveLength(0);
    await a.handle(s, msg('reset', { sender: { id: 'r' } }));
    expect(s.sent.at(-1)).toContain('Fresh start');
    await a.handle(s, msg('again?', { sender: { id: 'r2' } }));
    expect(calls.at(-1)!.history).toHaveLength(0);
  });
  it('replies to greetings and help without calling the brain', async () => {
    const a = make(); const s = space();
    await a.handle(s, msg('hey', { sender: { id: 'g1' } }));
    await a.handle(s, msg('help', { sender: { id: 'g2' } }));
    expect(calls).toHaveLength(0);
    expect(s.sent[0]).toContain('Flakey');
  });
  it('falls back politely when the brain is down', async () => {
    reply = null;
    const a = make(); const s = space();
    await a.handle(s, msg('who is winning?'));
    expect(s.sent).toEqual(['My brain froze for a second. Try me again.']);
  });
  it('never executes money-related actions over iMessage', async () => {
    reply = { text: 'Change Gym to 12 dollars a miss? Confirm below.', action: { goalTitle: 'Gym', dollars: 12 } };
    const a = make(); const s = space();
    await a.handle(s, msg('make my gym penalty twelve bucks'));
    expect(s.sent[0]).toContain('ShamePool app');
    expect(s.sent[0]).not.toContain('Confirm below');
  });
  it('explains that it only reads text', async () => {
    const a = make(); const s = space();
    await a.handle(s, { ...msg(''), content: { type: 'attachment' } });
    expect(s.sent[0]).toContain('only read text');
    expect(calls).toHaveLength(0);
  });
});

describe('group chats and safety', () => {
  it('stays quiet in a group unless someone calls it, then strips its name', async () => {
    const a = make(); const s = space('G', 5);
    await a.handle(s, msg('lunch at noon?'));
    expect(s.sent).toHaveLength(0);
    await a.handle(s, msg('Flakey, who is flaking the most?', { sender: { id: 'u2' } }));
    expect(s.sent).toEqual(['Kevin, obviously.']);
    expect(calls[0]!.message).toBe('who is flaking the most?');
  });
  it('ignores our own messages and non-text content', async () => {
    const a = make(); const s = space();
    await a.handle(s, msg('echo', { direction: 'outbound' }));
    await a.handle(s, { ...msg(''), content: { type: 'reaction' } });
    expect(s.sent).toHaveLength(0);
    expect(calls).toHaveLength(0);
  });
  it('rate limits one sender and warns only once', async () => {
    let t = 1_000_000;
    const a = make(() => t); const s = space();
    for (let i = 0; i < 12; i++) { t += 100; await a.handle(s, msg(`question ${i}`)); }
    expect(calls).toHaveLength(8);
    expect(s.sent.filter((x) => x.includes('one small snowflake'))).toHaveLength(1);
    t += 61_000;
    await a.handle(s, msg('later'));
    expect(calls).toHaveLength(9);
  });
  it('caps very long messages', async () => {
    const a = make(); const s = space();
    await a.handle(s, msg('x'.repeat(2000)));
    expect(calls[0]!.message.length).toBe(400);
  });
});

describe('makeBrain auth', () => {
  it('sends the shared agent key so the web app accepts the server-side call', async () => {
    let headers: Record<string, string> = {};
    const f = (async (_u: string, init: RequestInit) => { headers = init.headers as Record<string, string>; return new Response(JSON.stringify({ text: 'hi', action: null })); }) as unknown as typeof fetch;
    await makeBrain('https://x.test', 1000, f, 'secret-key')('q', [], {});
    expect(headers['x-agent-key']).toBe('secret-key');
    await makeBrain('https://x.test', 1000, f, '')('q', [], {}); // empty = no key
    expect(headers['x-agent-key']).toBeUndefined();
  });
});

describe('makeBrain', () => {
  const ok = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it('posts the message, history and context to the web app route', async () => {
    let seen: { url: string; body: Record<string, unknown> } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ text: 'hi', action: null })); }) as unknown as typeof fetch;
    const r = await makeBrain('https://x.test/', 1000, f)('q', [{ from: 'me', text: 'a' }], { a: 1 });
    expect(r).toEqual({ text: 'hi', action: null });
    expect(seen!.url).toBe('https://x.test/api/ai/chat');
    expect(seen!.body).toEqual({ message: 'q', history: [{ from: 'me', text: 'a' }], context: { a: 1 } });
  });
  it('returns null on HTTP errors, bad bodies and network failures', async () => {
    expect(await makeBrain('https://x.test', 1000, ok({ error: 'x' }, 502))('q', [], {})).toBeNull();
    expect(await makeBrain('https://x.test', 1000, ok({ nope: 1 }))('q', [], {})).toBeNull();
    const boom = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await makeBrain('https://x.test', 1000, boom)('q', [], {})).toBeNull();
  });
});
