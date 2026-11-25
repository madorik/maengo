"use client";

import Link from "next/link";
import { IconPause, IconPlay } from "@/components/icons";
import { EntryRow } from "@/components/library/LibraryCards";
import { PlaylistPicker } from "@/components/library/Playlist";
import { usePlayer } from "@/components/providers/PlayerProvider";
import { useCallName, useProfile } from "@/components/providers/ProfileProvider";
import { useToday } from "@/components/providers/TodayProvider";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import { Spinner } from "@/components/ui/Spinner";
import { PLAYLIST_MAX } from "@/lib/playlist";
import type { EmptyData, EmptyEvent, EmptyMissed, EmptyReplay } from "@/lib/today-empty";
import { callName } from "./BriefingInsight";
import { MakeToday } from "./MakeToday";

/**
 * 오늘 소식이 아직 없을 때 화면(2026-11-26 시안 '오늘 소식 오기 전', 사용자가 '너무 허전하다'고 해서 연노랑을 뺀 남색 카드판을 승인).
 * 위에서부터 ① 남색 카드(MakeToday: 다음 브리핑이 언제 오는지·하루 시간표·내 관심사·지금 받기, 다른 상태도 같은 틀)
 * ② 어제 못 본 소식(직전 브리핑을 받은 날 읽지도 듣지도 않은 소식 최대 3개, 보관함과 같은 줄) ③ 다시 듣기(직전 브리핑을 플레이어로)
 * ④ 이번 주 챙겨 볼 일정(Premium 주간 리포트의 앞으로의 일정 최대 2개). ②③④는 보여 줄 것이 없으면 칸째 숨긴다.
 * data는 서버가 읽어 끼운다(app/(app)/(main)/today/page.tsx, lib/server/today-empty.ts). 아직 읽는 중이면 null: 카드만 그린다.
 * 테마는 사용자가 고른 밝기를 따른다(남색 카드만 다크에서도 남색)
 */
export function EmptyToday({ data }: { data: EmptyData | null }) {
  const { data: today } = useToday();
  return (
    <>
      <MakeToday reason={today.emptyReason} notifyLabel={today.notifyLabel} plan={data?.plan ?? null} />
      {data?.missed && <MissedSection missed={data.missed} />}
      {data?.replay && <ReplaySection replay={data.replay} />}
      {data && data.events.length > 0 && <WeekSection events={data.events} />}
    </>
  );
}

/** 칸 머리: 제목 20px/800 + (있으면) 오른쪽 밑줄 링크. 링크는 누르기 쉽게 높이 44px */
function SectionHead({ id, title, href, link }: { id: string; title: string; href?: string; link?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-2 px-1.5">
      <h2 id={id} className="text-[20px] font-extrabold tracking-[-0.04em]">
        {title}
      </h2>
      {href && link && (
        <Link href={href} className="inline-flex min-h-11 shrink-0 items-center text-[14px] font-semibold text-sub underline underline-offset-[3px]">
          {link}
        </Link>
      )}
    </div>
  );
}

/** 어제 못 본 소식: 보관함과 같은 소식 줄(EntryRow). 링크는 보관함의 '안 읽음' 보기로 */
function MissedSection({ missed }: { missed: EmptyMissed }) {
  return (
    <section aria-labelledby="missed-title" className="mt-9">
      <SectionHead id="missed-title" title={`${missed.dayLabel} 못 본 소식`} href="/library?read=unread" link="보관함에서 보기" />
      <p className="px-1.5 text-[15px] font-medium leading-[1.55] text-ink/80">기다리는 동안 이것부터 보세요</p>
      {/* 소식 줄은 고르기(골라 듣기) 상태를 같이 쓰므로 고르기가 꺼진 채로 감싼다 */}
      <PlaylistPicker>
        <ul aria-label="못 본 소식" className="mt-1 px-1.5">
          {missed.entries.map((e) => (
            <EntryRow key={e.clusterId} entry={e} />
          ))}
        </ul>
      </PlaylistPicker>
    </section>
  );
}

/**
 * 다시 듣기: 직전 브리핑 하나를 플레이어로 이어 듣는다(보관함 '골라 듣기'와 같은 playPlaylist, Premium). 듣는 중이면 일시정지.
 * Premium이 아니면 재생 원에 Premium 배지를 달고 결제 페이지로 보낸다(오늘 머리의 재생 원과 같다). 듣기 시간은 적지 않는다
 */
function ReplaySection({ replay }: { replay: EmptyReplay }) {
  const profile = useProfile();
  const name = useCallName();
  const p = usePlayer();
  const ids = replay.ids.slice(0, PLAYLIST_MAX);
  // 지금 이 브리핑을 듣는 중인지(같은 소식을 같은 차례로 플레이어에 올려 둔 것)
  const mine = !!p.playlist && p.playlist.length === ids.length && p.playlist.every((id, i) => id === ids[i]);
  const playing = mine && p.status === "playing";
  const text = `소식 ${replay.ids.length}개${replay.headline ? `, ${callName(replay.headline, name)}` : ""}`;
  const face = "flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-paper";
  const body = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-[16px] font-extrabold tracking-[-0.03em]">{replay.title}</span>
      <span className="mt-[3px] line-clamp-2 block text-[13.5px] font-medium leading-[1.45] text-sub">{text}</span>
    </span>
  );
  const card = "flex w-full items-center gap-3.5 rounded-[20px] border border-line py-3.5 pl-4 pr-3.5 text-ink no-underline active:bg-snow";
  return (
    <section aria-labelledby="again-title" className="mt-7">
      <SectionHead id="again-title" title="다시 듣기" />
      <div className="mt-0.5 px-1.5">
        {!profile.audio ? (
          <Link href="/premium" aria-label={`${replay.title}, Premium에서 들을 수 있어요`} className={card}>
            {body}
            <span className={`${face} relative`}>
              <IconPlay className="ml-0.5 size-[18px]" />
              <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-paper shadow-[0_0_0_1px_var(--color-line)]">
                <PremiumBadge className="[&_svg]:size-4" />
              </span>
            </span>
          </Link>
        ) : (
          <button
            type="button"
            aria-busy={(!mine && p.starting) || undefined}
            aria-label={playing ? `${replay.title} 일시정지` : `${replay.title} 듣기`}
            onClick={() => {
              // 재생은 누른 손짓 안에서 건다(iOS 자동 재생 정책)
              if (playing) return p.pause();
              if (mine) return p.play();
              p.playPlaylist(ids);
            }}
            className={card}
          >
            {body}
            <span className={face}>{p.starting && !mine ? <Spinner className="size-5" /> : playing ? <IconPause className="size-5" /> : <IconPlay className="ml-0.5 size-[18px]" />}</span>
          </button>
        )}
      </div>
    </section>
  );
}

/** 이번 주 챙겨 볼 일정: 날짜 칸(날짜 + 요일) + 일정 + 닿은 관심사(망고 진한 글자). 오른쪽 링크는 주간 리포트 */
function WeekSection({ events }: { events: EmptyEvent[] }) {
  return (
    <section aria-labelledby="week-title" className="mt-8">
      <SectionHead id="week-title" title="이번 주 챙겨 볼 일정" href="/report" link="주간 리포트" />
      <ul aria-label="일정" className="px-1.5">
        {events.map((e) => (
          <li key={`${e.month}-${e.day}-${e.title}`} className="flex items-center gap-3.5 border-t border-line py-3 first:border-t-0">
            <span aria-hidden="true" className="flex h-[52px] w-12 shrink-0 flex-col items-center justify-center rounded-[14px] bg-snow">
              <span className="text-[19px] font-extrabold leading-[1.15] tabular-nums">{e.day}</span>
              <span className="text-[11px] font-semibold text-sub">{e.weekday}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="sr-only">{`${e.month}월 ${e.day}일 ${e.weekday}요일, `}</span>
              <span className="block text-[16px] font-bold leading-[1.4] tracking-[-0.02em]">{e.title}</span>
              {e.about.length > 0 && <span className="mt-[3px] block text-[12.5px] font-bold text-mango-deep">{e.about.join(", ")}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
