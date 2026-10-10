import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 로그인 세션용 Supabase 클라이언트(anon 키 + 세션 쿠키). 요청마다 새로 만든다.
// 데이터 읽기·쓰기는 아직 service role(lib/server/db.ts) + user_id 조건이고, 이 클라이언트는 로그인·세션 확인에만 쓴다.
export async function supabaseAuth() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) jar.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 못 쓴다. 토큰 갱신은 proxy.ts가 한다
        }
      },
    },
  });
}
