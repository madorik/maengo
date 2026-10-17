import { BlockedAddressError, safeGet } from './safe-http';

// 봇임을 밝히는 UA. 봇을 막는 사이트는 우회하지 않고 출처에서 뺀다.
export const USER_AGENT = 'Mozilla/5.0 (compatible; MaengoBot/0.1; +https://github.com/madorik/maengo)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 바깥 주소의 본문. 사설·내부 주소로는 가지 않는다(safe-http). 막힌 주소는 다시 해 보지 않는다 */
export async function fetchText(url: string, { timeoutMs = 20_000, attempts = 1, maxBytes = 3_000_000, httpsOnly = false } = {}): Promise<string> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      const { text } = await safeGet(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        timeoutMs,
        maxBytes,
        httpsOnly,
      });
      return text;
    } catch (e) {
      if (e instanceof BlockedAddressError) throw e;
      last = e;
      if (i < attempts) await sleep(1500 * i);
    }
  }
  throw last;
}
