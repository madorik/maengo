"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { withBase } from "@/lib/base-path";
import {
  appendLibraryPage,
  libraryFilterKey,
  libraryPageSearch,
  librarySignature,
  mergeLibraryGroups,
  type LibraryFilters,
  type LibraryGroup,
  type LibraryPageData,
  type LoadedPages,
} from "@/lib/library-pages";
import { DayGroups } from "./LibraryCards";

// 앱(iOS·안드로이드)의 보관함: 쪽 넘기기 대신 목록 끝에 가까워지면 다음 쪽을 받아 이어 붙인다(웹 브라우저는 LibraryView의 쪽 넘기기).
// 1쪽은 서버가 그린 것(props)을 그대로 쓰고, 2쪽부터 /api/library로 받아 같은 날짜 묶음은 합친다(lib/library-pages.ts).
// 거르기(카테고리·읽음·검색어)가 바뀌면 LibraryView가 key로 새로 그려 1쪽부터 다시 시작한다.
//
// 뒤로 가기: 글을 열면 이 화면은 내려가고, 돌아오면 서버가 그린 1쪽만 가지고 새로 그려진다.
// 그래서 받아 둔 쪽과 스크롤 위치를 모듈 변수(saved)에 두고, 같은 기록(bfcacheId가 같음: 뒤로·앞으로 가기)으로 돌아왔을 때만 되살린다.
// 탭·메뉴로 새로 들어오면 bfcacheId가 달라 1쪽 맨 위부터다. 새로고침하면 모듈 변수가 비어 처음부터다.

interface Saved extends LoadedPages {
  sig: string;
  scrollY: number;
}

const saved = new Map<string, Saved>();
/** 기억해 두는 목록 수(오래된 것부터 버린다) */
const SAVED_MAX = 6;
/** 화면 아래로 이만큼 남았을 때 다음 쪽을 받는다(소식 카드 대여섯 장) */
const PRELOAD = "0px 0px 1200px 0px";
const LOAD_ERROR = "소식을 불러오지 못했어요";

function remember(key: string, value: Saved) {
  saved.delete(key);
  saved.set(key, value);
  while (saved.size > SAVED_MAX) saved.delete(saved.keys().next().value!);
}

type Props = LibraryFilters & {
  /** 서버가 그린 1쪽 */
  groups: LibraryGroup[];
  page: number;
  pageCount: number;
  /** 거른 소식 수(되살릴 때 1쪽이 그대로인지 본다) */
  filteredTotal: number;
};

export function InfiniteLibrary({ groups, page, pageCount, filteredTotal, category, read, query }: Props) {
  const router = useRouter();
  const { bfcacheId } = router;
  const cacheKey = `${bfcacheId}|${libraryFilterKey({ category, read, query })}`;
  const sig = librarySignature({ filteredTotal, pageCount, groups });
  // 첫 화면(하이드레이션)에서는 saved가 늘 비어 있어 서버 HTML과 같게 그린다. 되살리는 건 화면을 옮겨 다시 그릴 때뿐이다
  const [restored] = useState(() => {
    const s = saved.get(cacheKey);
    return s && s.sig === sig ? s : null;
  });
  const [loaded, setLoaded] = useState<LoadedPages>(() =>
    restored ? { page: restored.page, pageCount: restored.pageCount, pages: restored.pages } : { page, pageCount, pages: [] },
  );
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const keyRef = useRef(cacheKey);

  // 받은 쪽을 기억해 둔다(스크롤 위치는 지금 값으로 두고, 아래 스크롤 리스너가 고쳐 간다)
  useEffect(() => {
    keyRef.current = cacheKey;
    remember(cacheKey, { ...loaded, sig, scrollY: window.scrollY });
  }, [cacheKey, sig, loaded]);

  // 되살렸으면 그리기 전에 그 자리로 스크롤한다. 뒤로 가기에서 브라우저가 먼저 맞춘 자리는 그때 떠 있던 글 화면 길이에 잘려 있을 수 있다.
  // 같은 기록 안에서 거르기를 눌러 새로 들어온 경우(주소 이동)는 Next가 이 뒤에 맨 위로 올린다
  useLayoutEffect(() => {
    if (restored?.scrollY) window.scrollTo(0, restored.scrollY);
  }, [restored]);

  // 스크롤 위치를 기억한다. 화면을 떠나는 중(목록이 이미 빠짐)에 생긴 스크롤(새 화면 맨 위로)은 남기지 않는다
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!rootRef.current?.isConnected) return;
        const s = saved.get(keyRef.current);
        if (s) s.scrollY = window.scrollY;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 화면을 떠나면 받던 쪽은 버린다(돌아오면 다시 받는다)
  useEffect(() => () => request.current?.abort(), []);

  /** 로그인이 풀려 더 받지 않는다(화면을 새로 그려 서버가 로그인으로 보낼 때까지 다시 부르지 않게) */
  const signedOut = useRef(false);
  const load = useCallback(
    async (next: number) => {
      if (busy.current || signedOut.current) return;
      busy.current = true;
      const ctrl = new AbortController();
      request.current = ctrl;
      setStatus("loading");
      try {
        const res = await fetch(withBase(`/api/library?${libraryPageSearch(next, { category, read, query })}`), { cache: "no-store", signal: ctrl.signal });
        // 로그인이 풀렸으면 다시 받아도 소용없다: 화면을 새로 그리면 서버가 로그인으로 보낸다
        if (res.status === 401) {
          signedOut.current = true;
          setStatus("idle");
          router.refresh();
          return;
        }
        if (!res.ok) throw new Error(`library ${res.status}`);
        const data = (await res.json()) as LibraryPageData;
        if (ctrl.signal.aborted) return;
        setLoaded((s) => appendLibraryPage(s, next, data));
        setStatus("idle");
      } catch {
        if (!ctrl.signal.aborted) setStatus("error");
      } finally {
        if (request.current === ctrl) request.current = null;
        busy.current = false;
      }
    },
    [category, read, query, router],
  );

  const hasMore = loaded.page < loaded.pageCount;
  const nextPage = loaded.page + 1;

  // 목록 끝 표식이 화면 아래 PRELOAD 안에 들어오면 다음 쪽을 받는다. 한 쪽을 붙인 뒤에도 아직 들어와 있으면
  // (짧은 쪽·큰 화면) 새로 거는 관찰자가 바로 알려 줘서 이어 받는다. 오류가 나면 '다시 시도'를 누를 때까지 멈춘다
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || status !== "idle") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void load(nextPage);
    }, { rootMargin: PRELOAD });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, status, nextPage, load]);

  const merged = useMemo(() => (loaded.pages.length ? mergeLibraryGroups(groups, ...loaded.pages) : groups), [groups, loaded.pages]);

  return (
    <div ref={rootRef}>
      <DayGroups groups={merged} />
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
      {status === "loading" && (
        <div role="status" className="mt-6 flex justify-center">
          <span aria-hidden="true" className="size-6 rounded-full border-2 border-line border-t-sub motion-safe:animate-spin" />
          <span className="sr-only">불러오는 중</span>
        </div>
      )}
      {status === "error" && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <p role="alert" className="min-w-0 text-[14px] font-bold text-cherry">
            {LOAD_ERROR}
          </p>
          <button type="button" onClick={() => void load(nextPage)} className="btn btn-ghost min-h-11 shrink-0 px-3 text-[14px]">
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
