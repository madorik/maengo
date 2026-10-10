import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// service role 키라 RLS를 거치지 않는다. 파이프라인 밖(웹 브라우저)으로 절대 나가면 안 된다.
export const db = createClient(env.supabaseUrl, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 타입 없는 클라이언트라 임베드한 관계를 배열로 짐작한다. 행 모양은 호출하는 쪽이 T로 정한다
type Page = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** PostgREST는 한 번에 1,000행까지 준다. 끝날 때까지 range로 넘겨 받는다 */
export async function selectAll<T>(query: (from: number, to: number) => Page, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) return out;
  }
}

export function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => PromiseLike<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

export const toVector = (v: number[]) => `[${v.map((x) => x.toFixed(6)).join(',')}]`;

export function fromVector(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[];
  if (typeof v === 'string' && v.startsWith('[')) return JSON.parse(v) as number[];
  return null;
}
