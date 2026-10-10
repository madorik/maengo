-- 말투는 아나운서 하나만 쓴다(2026-10-10). 사용자는 목소리(여성·남성)만 고른다. 소식마다 음성은 여·남 2개까지라 TTS 비용이 묶인다.
-- 선생님·대담은 나중에 다시 열 수 있게 check 제약은 그대로 둔다(packages/core/src/audio/personas.ts의 PERSONA).
update public.profiles set persona = 'announcer' where persona <> 'announcer';
alter table public.profiles alter column persona set default 'announcer';
