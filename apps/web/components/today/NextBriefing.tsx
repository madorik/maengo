import Link from "next/link";
import { SLOT_LABEL } from "@maengo/core/sections";
import { toClock12 } from "@maengo/core/kst";
import { clockText, kstMinuteOfDay, minuteText, type Upcoming } from "@/lib/briefing-clock";

// 오늘 소식이 아직 없을 때 남색 카드(MakeToday)에 들어가는 두 조각(2026-11-26 시안 '오늘 소식 오기 전').
// 남색 카드는 다크에서도 같은 남색이라 글자·선 색은 흰색 계열로 직접 적는다(토큰은 다크에서 뒤집힌다).

/** 'HH:MM' → '오전 7시 30분'(화면 읽기용) */
function clockWords(hhmm: string): string {
  const { pm, hour, minute } = toClock12(hhmm);
  return `${pm ? "오후" : "오전"} ${hour}시${minute ? ` ${minute}분` : ""}`;
}

/** 브리핑 이름: '출근길', 내일 오는 것은 '내일 출근길' */
export const briefingName = (b: Upcoming) => `${b.tomorrow ? "내일 " : ""}${SLOT_LABEL[b.slot]}`;

/** 시간표 글자: '내일 출근길 7:30' */
const slotText = (b: Upcoming) => `${briefingName(b)} ${clockText(b.at)}`;

/**
 * 하루 브리핑 시간표: 지금 → 다음 브리핑 → 그다음 브리핑. 점과 선만 그린 그림(위치는 시간에 비례하지 않는다).
 * 다음 브리핑까지는 흰 선, 그 뒤는 옅은 선. 지금은 흰 점, 다음 브리핑은 망고 노랑 점에 옅은 고리, 그다음은 속이 빈 점.
 * 점 둘레 4px 남색 띠는 선을 점 주변에서 끊어 보이게 한다
 */
export function Timetable({ nowMs, next, after }: { nowMs: number; next: Upcoming; after: Upcoming }) {
  const nowMin = kstMinuteOfDay(nowMs);
  const label = `지금 ${clockWords(minuteText(nowMin))}, ${briefingName(next)} 브리핑 ${clockWords(next.at)}, ${briefingName(after)} 브리핑 ${clockWords(after.at)}`;
  return (
    <div role="img" aria-label={label} className="relative mt-5 h-[58px]">
      <span aria-hidden="true" className="absolute inset-x-2 top-[11px] h-[3px] rounded-sm bg-white/18" />
      <span aria-hidden="true" className="absolute left-2 top-[11px] h-[3px] w-[40%] rounded-sm bg-white" />
      <span aria-hidden="true" className="absolute left-0 top-0 flex flex-col items-start">
        <span className="size-[25px] rounded-full bg-white shadow-[0_0_0_4px_#1F2340]" />
        <span className="mt-[7px] text-[12.5px] font-extrabold">{`지금 ${minuteText(nowMin)}`}</span>
      </span>
      <span aria-hidden="true" className="absolute left-[40%] top-0 flex -translate-x-1 flex-col items-center">
        <span className="flex size-[25px] items-center justify-center rounded-full bg-mango shadow-[0_0_0_4px_#1F2340,0_0_0_9px_rgba(255,194,61,0.25)]">
          <span className="size-[9px] rounded-full bg-[#1F2340]" />
        </span>
        <span className="mt-[7px] whitespace-nowrap text-[12.5px] font-extrabold text-mango">{slotText(next)}</span>
      </span>
      <span aria-hidden="true" className="absolute right-0 top-0 flex flex-col items-end">
        <span className="size-[25px] rounded-full bg-[#1F2340] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35),0_0_0_4px_#1F2340]" />
        <span className="mt-[7px] whitespace-nowrap text-[12.5px] font-semibold text-white/60">{slotText(after)}</span>
      </span>
    </div>
  );
}

/** 칩은 이만큼까지 보이고 나머지는 '외 n개' */
const CHIPS_MAX = 5;

/**
 * 구분선 아래 '오늘은 이 관심사에서 소식 n개를 골라요'(n은 플랜의 브리핑당 소식 수) + 내 관심사 칩 + '바꾸기'(관심사 화면).
 * 관심사가 많으면 몇 개만 보이고 '외 n개'. 관심사가 하나도 없으면 고르러 가는 링크만
 */
export function PickedInterests({ interests, count }: { interests: string[]; count: number }) {
  const shown = interests.slice(0, CHIPS_MAX);
  const rest = interests.length - shown.length;
  return (
    <>
      <p className="mt-[18px] border-t border-white/12 pt-4 text-[14px] font-bold">
        {interests.length > 0 ? `오늘은 이 관심사에서 소식 ${count}개를 골라요` : `관심사를 고르면 소식 ${count}개를 골라 드려요`}
      </p>
      <ul aria-label="내 관심사" className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {shown.map((name) => (
          <li key={name} className="inline-flex h-[34px] items-center rounded-full bg-white/12 px-[13px] text-[14px] font-bold text-white">
            {name}
          </li>
        ))}
        {rest > 0 && <li className="inline-flex h-[34px] items-center px-1 text-[13.5px] font-bold text-white/72">{`외 ${rest}개`}</li>}
        <li>
          <Link
            href="/keywords"
            aria-label={interests.length > 0 ? "관심사 바꾸기" : "관심사 고르기"}
            className="inline-flex h-[34px] items-center px-1.5 text-[13.5px] font-bold text-mango underline underline-offset-[3px]"
          >
            {interests.length > 0 ? "바꾸기" : "고르기"}
          </Link>
        </li>
      </ul>
    </>
  );
}
