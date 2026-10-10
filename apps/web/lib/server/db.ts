import 'server-only';
import { createClient } from '@supabase/supabase-js';

// 서버 전용 Supabase 클라이언트(service role, RLS를 거치지 않음). 모든 조회에 user_id 조건을 직접 건다.
// 애플·구글 로그인이 붙으면 유저 세션 클라이언트(@supabase/ssr)로 바꿔 RLS가 지키게 한다.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 없어요(.env.local)');

export const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

export function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}
