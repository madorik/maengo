import { db, check } from './lib/db';

// 실제 로그인(애플·구글)을 붙이기 전까지 웹 데모 세션이 쓸 Supabase 유저를 만든다.
// 이메일 가입은 꺼 두었지만 관리자 API로는 만들 수 있다. 예약 도메인(example.com)이라 메일은 나가지 않는다.
// 개발 초기라 요약 비용을 아끼려고 관심 토픽은 LLM 에이전트 하나만 둔다.
const EMAIL = 'demo@example.com';
const TOPICS = ['llm-agent'];

async function findUser(): Promise<string | null> {
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === EMAIL);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  let id = await findUser();
  if (!id) {
    const { data, error } = await db.auth.admin.createUser({ email: EMAIL, email_confirm: true, user_metadata: { full_name: '맹고 데모' } });
    if (error) throw error;
    id = data.user.id;
    console.log('데모 유저를 만들었어요');
  } else {
    console.log('데모 유저가 이미 있어요');
  }
  check(await db.from('profiles').update({ onboarded_at: new Date().toISOString(), display_name: '맹고 데모' }).eq('id', id), 'profiles');
  check(await db.from('user_topics').delete().eq('user_id', id).not('topic_id', 'in', `(${TOPICS.join(',')})`), 'user_topics delete');
  check(
    await db.from('user_topics').upsert(TOPICS.map((topic_id) => ({ user_id: id, topic_id, weight: 1, source: 'onboarding' })), { onConflict: 'user_id,topic_id' }),
    'user_topics',
  );
  const { data: p } = await db.from('profiles').select('plan,trial_ends_at').eq('id', id).single();
  console.log(`DEMO_USER_ID=${id}`);
  console.log(`plan=${p?.plan} trial_ends_at=${p?.trial_ends_at}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
