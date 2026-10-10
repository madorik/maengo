// 봇임을 밝히는 UA. 봇을 막는 사이트는 우회하지 않고 출처에서 뺀다.
export const USER_AGENT = 'Mozilla/5.0 (compatible; MaengoBot/0.1; +https://github.com/madorik/maengo)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url: string, { timeoutMs = 20_000, attempts = 1, maxBytes = 3_000_000 } = {}): Promise<string> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > maxBytes) throw new Error(`너무 커요(${len} bytes)`);
      const text = await res.text();
      return text.length > maxBytes ? text.slice(0, maxBytes) : text;
    } catch (e) {
      last = e;
      if (i < attempts) await sleep(1500 * i);
    }
  }
  throw last;
}
