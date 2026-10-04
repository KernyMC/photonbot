/** Client for the shared Squad Bot brain: the same /api/ai/chat route the ShamePool web app uses. */
export interface Turn { from: 'me' | 'bot'; text: string }
export interface BrainReply { text: string; action: { goalTitle: string; dollars: number } | null }
export type Brain = (message: string, history: Turn[], context: Record<string, unknown>) => Promise<BrainReply | null>;

export function makeBrain(baseUrl: string, timeoutMs = 14_000, fetchImpl: typeof fetch = fetch, agentKey: string | undefined = process.env.AGENT_API_KEY): Brain {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/ai/chat`;
  return async (message, history, context) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, {
        method: 'POST',
        // the web app only accepts its own pages and trusted servers that present this shared key
        headers: { 'Content-Type': 'application/json', ...(agentKey ? { 'x-agent-key': agentKey } : {}) },
        body: JSON.stringify({ message, history, context }),
        signal: ctrl.signal,
      });
      if (!r.ok) return null;
      const j = (await r.json()) as Partial<BrainReply>;
      return typeof j.text === 'string' && j.text ? { text: j.text, action: j.action ?? null } : null;
    } catch {
      return null; // offline, timeout or app down: the agent answers with a canned line instead
    } finally {
      clearTimeout(timer);
    }
  };
}
