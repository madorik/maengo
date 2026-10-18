"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck } from "@/components/icons";
import { TopicGroupIcon } from "@/components/TopicGroupIcon";

type Option = { id: string; name: string };

/**
 * 온보딩에서 고르는 칸들(관심 분야 + 뉴스 헤드라인 + 기타). 관심 분야와 뉴스를 합쳐 플랜 한도(limit, plans 표 topic_limit)까지 고르고,
 * 다 고르면 나머지 칸은 막는다(서버도 넘치면 받지 않는다, completeOnboarding). 기타(직접 적기, Premium만)는 이 한도에 세지 않는다.
 * 체크박스는 브라우저가 들고(uncontrolled), 고른 수는 폼의 체크 상태에서 센다: 뒤로 가기로 돌아와 브라우저가 체크를 되살려도 수가 맞게
 * (처음 붙을 때·pageshow·바뀔 때마다 다시 센다). 폼이 초기화되면(액션을 마친 뒤 React가 reset) 같이 0으로.
 * 기타 입력칸은 기타 칸이 체크되면 열린다(group/etc)
 */
export function TopicPicks({ groups, news, limit, customAllowed, etcChecked }: { groups: Option[]; news: Option[]; limit: number; customAllowed: boolean; etcChecked: boolean }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const ref = useRef<HTMLDivElement>(null);
  /** 폼에서 지금 체크된 관심 분야·뉴스를 다시 센다 */
  const sync = useCallback(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    setPicked(new Set(Array.from(form.querySelectorAll<HTMLInputElement>('input[name="topic"]:checked'), (i) => i.value)));
  }, []);
  // 브라우저가 되살린 체크를 세고(뒤로 가기·새로 고침), 폼 reset은 체크를 기본값(안 고름)으로 되돌리니 세던 수도 같이 비운다
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const onReset = () => setPicked(new Set());
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
  const choice = (o: Option) => <Choice key={o.id} id={o.id} name={o.name} disabled={full && !picked.has(o.id)} onChange={sync} />;

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
            {customAllowed && <Choice id="etc" name="기타" inputName="etc" defaultChecked={etcChecked} />}
          </div>
          {customAllowed && (
            <div className="mt-2 hidden group-has-[#pick-etc:checked]/etc:block">
              <label htmlFor="etc-text" className="sr-only">
                관심 있는 것
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
      <fieldset className="mt-6 min-w-0">
        <legend className="text-[15px] font-black">뉴스 헤드라인</legend>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{news.map(choice)}</div>
      </fieldset>
    </>
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
      <span className="tile flex min-h-14 items-center gap-2.5 px-2.5 py-2 transition-[background-color,border-color,opacity] peer-[:not(:checked):not(:disabled)]:hover:bg-snow peer-checked:border-sky peer-checked:bg-sky-tint peer-disabled:opacity-45 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky">
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
