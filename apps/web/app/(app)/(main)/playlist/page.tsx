import type { Metadata } from "next";
import { PlaylistView } from "@/components/playlist/PlaylistView";
import { getPlaylist } from "@/lib/server/feed";
import { entitlements } from "@/lib/server/profile";
import { requireProfile } from "@/lib/server/session";

export const metadata: Metadata = { title: "플레이리스트" };

// 플레이리스트(Premium): 보관함 '골라 듣기'에서 담은 소식을 순서대로 이어 듣고, 순서 바꾸기·빼기·비우기를 한다
export default async function PlaylistPage() {
  const profile = await requireProfile();
  const audio = entitlements(profile).audio;
  const entries = audio ? await getPlaylist(profile) : [];
  return <PlaylistView entries={entries} locked={!audio} />;
}
