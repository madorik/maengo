const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', middot: '·', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** RSS 설명의 HTML을 한 줄 글로 */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** DB(jsonb·text)가 받지 않는 글자를 지운다: NUL, 짝 없는 서로게이트(이모지가 반으로 잘린 것) */
export function wellFormed(s: string): string {
  return s.replace(/\u0000/g, '').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '');
}

/** n자로 자른다. 이모지(서로게이트 쌍) 가운데서 자르지 않는다 */
export function clip(s: string, n: number): string {
  const clean = wellFormed(s);
  if (clean.length <= n) return clean;
  const cut = /[\ud800-\udbff]/.test(clean[n - 1] ?? '') ? n - 1 : n;
  return `${clean.slice(0, cut)}…`;
}
