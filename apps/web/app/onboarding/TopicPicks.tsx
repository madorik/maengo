"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck } from "@/components/icons";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

type Option = { id: string; name: string };

/**
 * 온보딩에서 고르는 칸들(관심 분야 + 뉴스 헤드라인 + 내 키워드, 2026-11-08 '기타'에서 이름 바꿈). 관심 분야와 뉴스를 합쳐 플랜 한도(limit, plans 표 topic_limit)까지 고르고,
 * 다 고르면 나머지 칸은 막는다(서버도 넘치면 받지 않는다, completeOnboarding). 기타(직접 적기, Premium만)는 이 한도에 세지 않는다.
 * 체크박스는 브라우저가 들고(uncontrolled), 고른 수는 폼의 체크 상태에서 센다: 뒤로 가기로 돌아와 브라우저가 체크를 되살려도 수가 맞게
 * (처음 붙을 때·pageshow·바뀔 때마다 다시 센다). 폼이 초기화되면(액션을 마친 뒤 React가 reset) 기본 체크로 돌아간 상태를 다시 센다.
 * preselected는 처음부터 골라 둔 칸이다(바로 '시작하기'를 눌러도 되게). 내 키워드 입력칸은 내 키워드 칸이 체크되면 열린다(group/etc).
 * Free(새로 가입하면 Free)에게는 내 키워드 칸을 잠긴 칸(👑)으로 보인다(2026-11-08 사용자 결정). 누르면 칸 아래에 Premium 기능이라고만 알린다(온보딩을 떠나지 않게 요금 화면으로 보내지 않는다)
 */
export function TopicPicks({
  groups,
  news,
  limit,
  customAllowed,
  etcChecked,
  preselected = [],
}: {
  groups: Option[];
  news: Option[];
  limit: number;
  customAllowed: boolean;
  etcChecked: boolean;
  preselected?: readonly string[];
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(preselected));
  const [lockedTapped, setLockedTapped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  /** 폼에서 지금 체크된 관심 분야·뉴스를 다시 센다 */
  const sync = useCallback(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    setPicked(new Set(Array.from(form.querySelectorAll<HTMLInputElement>('input[name="topic"]:checked'), (i) => i.value)));
  }, []);
  // 브라우저가 되살린 체크를 세고(뒤로 가기·새로 고침), 폼 reset은 체크를 기본값(미리 골라 둔 칸)으로 되돌린 뒤에 다시 센다
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onReset = () => requestAnimationFrame(sync);
    const restored = requestAnimationFrame(sync);
    form.addEventListener("reset", onReset);
    window.addEventListener("pageshow", sync);
    return () => {
      cancelAnimationFrame(restored);
      form.removeEventListener("reset", onReset);
      window.removeEventListener("pageshow", sync);
    };
  }, [sync]);
  const capped = limit < groups.length + news.length;
  const full = capped && picked.size >= limit;
  const choice = (o: Option) => (
    <Choice key={o.id} id={o.id} name={o.name} defaultChecked={preselected.includes(o.id)} disabled={full && !picked.has(o.id)} onChange={sync} />
  );

  return (
    <>
      {/* 고른 수/한도는 첫 제목 줄 오른쪽(fieldset 안에 절대 위치로 두면 legend 아래로 밀려서 바깥에 둔다) */}
      <div ref={ref} className="relative min-w-0">
        {capped && (
          <span className="absolute right-0 top-0 font-round text-[15px] font-black leading-[1.5] tabular-nums text-sub">
            <span aria-hidden="true">
              {picked.size}/{limit}
            </span>
            <span aria-live="polite" className="sr-only">
              {`${limit}개 중 ${picked.size}개 고름`}
            </span>
          </span>
        )}
        {/* fieldset은 기본 최소 폭이 내용 길이라 긴 줄이 화면 밖으로 밀린다 */}
        <fieldset className="group/etc min-w-0">
          <legend className="text-[15px] font-black">관심 분야</legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {groups.map(choice)}
            {customAllowed ? (
              <Choice id="etc" name="내 키워드" inputName="etc" defaultChecked={etcChecked} />
            ) : (
              <LockedChoice id="etc" name="내 키워드" onClick={() => setLockedTapped(true)} />
            )}
          </div>
          <p aria-live="polite" className="mt-2 px-1 text-[13px] font-bold text-sub empty:hidden">
            {!customAllowed && lockedTapped ? "목록에 없는 키워드는 Premium에서 직접 적을 수 있어요." : ""}
          </p>
          {customAllowed && (
            <div className="mt-2 hidden group-has-[#pick-etc:checked]/etc:block">
              <label htmlFor="etc-text" className="sr-only">
                내 키워드
              </label>
              <input
                id="etc-text"
                name="etcText"
                maxLength={200}
                autoComplete="off"
                aria-describedby="etc-text-hint"
                placeholder="예: 드론, 게임, 부동산"
                className="tile min-h-12 w-full px-4 text-[16px] font-semibold placeholder:text-faint"
              />
              <p id="etc-text-hint" className="mt-1 px-1 text-[13px] font-semibold text-sub">
                쉼표로 나눠 3개까지 적을 수 있어요.
              </p>
            </div>
          )}
        </fieldset>
      </div>
      <fieldset className="mt-5 min-w-0">
        <legend className="text-[15px] font-black">뉴스 헤드라인</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{news.map(choice)}</div>
      </fieldset>
    </>
  );
}

/** Premium만 고르는 칸(Free의 내 키워드). 고르는 칸과 같은 모양에 체크 대신 왕관, 흐리게. 체크박스가 아니라 버튼이라 폼에 값이 가지 않는다 */
function LockedChoice({ id, name, onClick }: { id: string; name: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`${name}, Premium에서 쓸 수 있어요`} className="block min-w-0 text-left">
      <span className="tile flex min-h-12 items-center gap-2.5 bg-snow px-2.5 py-1.5">
        <span className="shrink-0 opacity-60">
          <TopicGroupIcon id={id} className="size-9 rounded-xl" iconClassName="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[16px] font-black text-sub">{name}</span>
        <PremiumBadge />
      </span>
    </button>
  );
}

/**
 * 고르는 칸 하나(아이콘 + 이름). 고르면 하늘색 칸이 되고 아이콘 모서리에 체크가 붙는다(label 안의 체크박스 상태를 group-has로 본다).
 * 두 칸 격자라 칸이 좁아서 체크를 오른쪽 끝에 따로 두지 않는다(반도체·로봇이 잘리지 않게). 한도가 차면 안 고른 칸은 흐려지고 눌리지 않는다
 */
function Choice({
  id,
  name,
  inputName = "topic",
  defaultChecked,
  disabled,
  onChange,
}: {
  id: string;
  name: string;
  inputName?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className={`group block min-w-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
      <input
        id={`pick-${id}`}
        type="checkbox"
        name={inputName}
        value={inputName === "topic" ? id : "on"}
        defaultChecked={defaultChecked}
        disabled={disabled}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="tile flex min-h-12 items-center gap-2.5 px-2.5 py-1.5 transition-[background-color,border-color,opacity] peer-[:not(:checked):not(:disabled)]:hover:bg-snow peer-checked:border-sky peer-checked:bg-sky-tint peer-disabled:opacity-45 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
        <span className="relative shrink-0">
          <TopicGroupIcon id={id} className="size-9 rounded-xl" iconClassName="size-5" />
          <i aria-hidden className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border-2 border-paper bg-sky text-white group-has-[:checked]:flex">
            <IconCheck className="size-3 [stroke-width:3.6]" />
          </i>
        </span>
        <span className="min-w-0 flex-1 truncate text-[16px] font-black">{name}</span>
      </span>
    </label>
  );
}
