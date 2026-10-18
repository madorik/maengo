import Link from "next/link";
import { IconDoc, IconPlay } from "@/components/icons";
import { CategoryChip } from "@/components/ui/CategoryChip";
import type { LibraryEntry } from "@/lib/types";
import type { LibraryGroup } from "@/lib/library-pages";
import { PickTarget } from "./Playlist";
import { ReadBadge } from "./ReadBadge";

// 보관함 목록(날짜 묶음 + 카드). 웹은 서버가 한 쪽을 그리고(LibraryView), 앱은 이어 붙인 쪽을 브라우저가 그린다(InfiniteLibrary).
// 훅이 없어서 서버·클라이언트 어느 쪽에서나 쓸 수 있다.

export function DayGroups({ groups }: { groups: LibraryGroup[] }) {
  return groups.map((g) => (
    <section key={g.date} aria-labelledby={`day-${g.date}`} className="mt-7">
      <h2 id={`day-${g.date}`} className="px-1 text-[15px] font-black text-sub">
        {g.label}
      </h2>
      <ol className="mt-3 flex flex-col gap-3">
        {g.entries.map((e) => (
          <LibraryCard key={e.clusterId} entry={e} />
        ))}
      </ol>
    </section>
  ));
}

function LibraryCard({ entry: e }: { entry: LibraryEntry }) {
  const video = e.kind === "video";
  return (
    <li className="group tile relative p-4 transition-colors hover:bg-snow">
      <div className="flex items-center gap-2 text-[13px] font-extrabold">
        <CategoryChip category={e.category} />
        <span className="inline-flex items-center gap-1 text-sub">
          {video ? <IconPlay className="size-3.5" /> : <IconDoc className="size-3.5" />}
          {e.sourceLabel}
        </span>
        <span className="ml-auto shrink-0 group-has-[[data-pick]]:invisible">
          <ReadBadge clusterId={e.clusterId} read={e.read || e.listened} />
        </span>
      </div>
      <h3 className="mt-2 text-[17px] font-black leading-snug tracking-[-0.02em]">
        <Link href={`/article/${e.clusterId}`} className="no-underline after:absolute after:inset-0 after:rounded-2xl">
          {e.title}
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[14px] font-medium leading-relaxed text-sub">{e.short}</p>
      <p className="mt-2 truncate text-[13px]">
        <span className="font-extrabold">{e.author}</span>
        <span className="ml-2 font-semibold text-faint">{e.publishedLabel}</span>
      </p>
      <PickTarget id={e.clusterId} title={e.title} />
    </li>
  );
}
