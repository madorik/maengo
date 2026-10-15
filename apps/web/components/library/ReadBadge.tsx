"use client";

import { IconCheck } from "@/components/icons";
import { useToday } from "@/components/providers/TodayProvider";

/**
 * 보관함 카드의 읽음 표시. 서버가 그린 값에 이 화면에서 방금 읽거나 들은 것(TodayProvider)을 더한다.
 * 글을 읽고 돌아오면 보관함은 예전에 그린 화면을 다시 보여 주기 때문에 서버 값만으로는 '안 읽음'으로 남는다. 들은 것도 '읽음'으로 보인다
 */
export function ReadBadge({ clusterId, read }: { clusterId: number; read: boolean }) {
  const { consumed } = useToday();
  return read || consumed(clusterId) ? (
    <span className="inline-flex items-center gap-1 text-leaf">
      <IconCheck className="size-4 [stroke-width:3]" />
      읽음
    </span>
  ) : (
    <span className="text-faint">안 읽음</span>
  );
}
