import type { Brain, Turn } from './brain';

/** The minimal shape of Spectrum's Space/Message that the agent needs (keeps it testable without a phone). */
export interface AgentSpace {
  id: string;
  getMembers(): Promise<unknown[]>;
  responding<T>(fn: () => T | Promise<T>): Promise<T>;
  send(text: string): Promise<unknown>;
}
export interface AgentMessage {
  direction: 'inbound' | 'outbound';
  content: { type: string; text?: string };
  sender?: { id: string } | undefined;
  read(): Promise<void>;
}

export interface AgentDeps {
  brain: Brain;
  context: () => Record<string, unknown>;
  now?: () => number;
}

export const NAME = /\b(benny(?:\s+the\s+penny)?|flakey|squad\s?bot|shamepool)\b/gi;
const MAX_TEXT = 400;
const RATE_PER_MINUTE = 8;
const HISTORY = 6;

const HELP = 'I\'m Benny the Penny, the Squad Bot of ShamePool. Ask me who is flaking, who is winning, or how close the pool is. In group chats, say my name.';
const BRAIN_DOWN = 'My brain froze for a second. Try me again.';
const ONLY_TEXT = 'I only read text here. Photo check-ins live in the ShamePool app.';
const SLOW_DOWN = 'Easy there, I am one small penny. Give me a minute.';
const PENALTY_IN_APP = 'Penalty changes need a tap in the ShamePool app. Open it and ask me there.';

export class Agent {
  private histories = new Map<string, Turn[]>();
  private hits = new Map<string, number[]>();
  private warned = new Set<string>();

  constructor(private deps: AgentDeps) {}

  private now() { return this.deps.now?.() ?? Date.now(); }

  /** Direct chat = at most two members (the user and us). Unknown counts as direct. */
  private async isDirect(space: AgentSpace): Promise<boolean> {
    try { return (await space.getMembers()).length <= 2; } catch { return true; }
  }

  private limited(who: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(who) ?? []).filter((x) => t - x < 60_000);
    recent.push(t);
    this.hits.set(who, recent);
    return recent.length > RATE_PER_MINUTE;
  }

  async handle(space: AgentSpace, message: AgentMessage): Promise<void> {
    if (message.direction !== 'inbound') return;
    const type = message.content.type;

    if (type === 'attachment' || type === 'voice') {
      if (await this.isDirect(space)) await space.send(ONLY_TEXT);
      return;
    }
    if (type !== 'text' || !message.content.text) return;

    const raw = message.content.text.replace(/\s+/g, ' ').trim();
    if (!raw) return;
    const direct = await this.isDirect(space);
    const mentioned = new RegExp(NAME.source, 'i').test(raw);
    if (!direct && !mentioned) return; // in a group chat, stay quiet unless someone calls us

    const text = (mentioned ? raw.replace(NAME, ' ').replace(/\s+/g, ' ').replace(/^[\s,:;!?-]+/, '').trim() : raw).slice(0, MAX_TEXT);

    const who = message.sender?.id ?? space.id;
    if (this.limited(who)) {
      if (!this.warned.has(who)) { this.warned.add(who); await space.send(SLOW_DOWN); }
      return;
    }
    this.warned.delete(who);

    void message.read().catch(() => {});

    const lower = text.toLowerCase();
    if (!text || lower === 'help' || lower === 'hi' || lower === 'hello' || lower === 'hey') { await space.send(HELP); return; }
    if (lower === 'reset') { this.histories.delete(space.id); await space.send('Fresh start. I forgot everything. (Not the flakes.)'); return; }

    const history = this.histories.get(space.id) ?? [];
    const reply = await space.responding(() => this.deps.brain(text, history, this.deps.context()));

    let answer: string;
    if (!reply) answer = BRAIN_DOWN;
    else if (reply.action) answer = PENALTY_IN_APP; // iMessage has no confirm button, so money-related changes stay in the app
    else answer = reply.text;

    await space.send(answer);
    if (reply && !reply.action) {
      this.histories.set(space.id, [...history, { from: 'me' as const, text }, { from: 'bot' as const, text: answer }].slice(-HISTORY));
    }
  }
}
