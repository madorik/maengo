-- 문의하기 양식(2026-10-26, 맹고-문서/문의하기.md). 메일 링크(mailto) 대신 /contact 양식으로 받아 여기에 남기고,
-- 서버가 Resend로 운영자 메일(watalabs.help@gmail.com)에 보낸다. 답장 주소는 회원이 적은 메일이라 운영자는 Gmail에서 답장만 누르면 된다.
-- 회원 문의는 계정을 지우면 같이 지운다. 로그인하지 않고 보낸 문의는 3년(전자상거래법 시행령 6조, 소비자 불만·분쟁 처리 기록) 뒤 지운다(lib/server/inquiry.ts).
-- 서버(service role)만 읽고 쓴다(정책 없음).
create table public.inquiries (
  id           bigserial primary key,
  user_id      uuid references public.profiles on delete cascade,  -- 로그인하지 않고 보냈으면 null
  category     text not null check (category in ('billing', 'bug', 'idea', 'other')),
  body         text not null check (char_length(body) between 1 and 2000),
  reply_to     text not null,
  meta         jsonb not null default '{}',  -- 회원 번호 앞자리·플랜·최근 결제·앱 버전·기기(문제를 찾는 데 쓴다)
  ip_hash      text,                          -- 접속 IP를 바꾼 값(로그인하지 않은 문의를 시간당 몇 건으로 막는 데만 쓴다)
  mail_status  text not null default 'pending' check (mail_status in ('pending', 'sent', 'failed', 'skipped')),
  mail_error   text,
  -- 처리 상태: open(답장 기다림) → replied(관리자 > 운영 탭에서 답장을 보냄) | closed(답장 없이 닫음: 스팸·중복·Gmail로 답함)
  status       text not null default 'open' check (status in ('open', 'replied', 'closed')),
  replied_at   timestamptz,
  -- AI 답장 초안(Gemini, 문의가 들어오면 바로 만든다). 관리자 > 문의 탭 답장 칸에 미리 채워진다. ai_check는 운영자만 보는 확인할 점,
  -- ai_facts는 초안 전에 확인한 회원 기록(결제 다시 읽기·플랜·지갑·결제별 환불 판정·알림, [{text, extra}])
  ai_draft     text,
  ai_check     text,
  ai_facts     jsonb,
  ai_draft_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index inquiries_user_at on public.inquiries (user_id, created_at desc) where user_id is not null;
create index inquiries_ip_at on public.inquiries (ip_hash, created_at desc) where user_id is null;
create index inquiries_mail_failed on public.inquiries (created_at desc) where mail_status in ('failed', 'skipped');
create index inquiries_open on public.inquiries (created_at) where status = 'open';
create index inquiries_created on public.inquiries (created_at desc);
alter table public.inquiries enable row level security;

-- 운영자 답장(관리자 > 운영 탭). 회원이 적은 답장 주소로 Resend가 보내고, 회원이 다시 답장하면 운영자 메일(SUPPORT_EMAIL)로 간다.
-- 한 문의에 여러 번 답할 수 있다. 문의를 지우면 같이 지운다
create table public.inquiry_replies (
  id           bigserial primary key,
  inquiry_id   bigint not null references public.inquiries on delete cascade,
  body         text not null check (char_length(body) between 1 and 5000),
  mail_status  text not null check (mail_status in ('sent', 'failed')),
  mail_error   text,
  created_at   timestamptz not null default now()
);
create index inquiry_replies_inquiry on public.inquiry_replies (inquiry_id, id);
alter table public.inquiry_replies enable row level security;
