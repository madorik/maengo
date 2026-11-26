import { Crown } from "@/components/icons";
import type { ProfileView } from "@/lib/types";

/**
 * 설정 맨 위 계정 정보(2026-11-26 메뉴를 아래로 내림). 모바일 위쪽 프로필 사진(계정 메뉴)이 없어져서 그 안의 사진·이름·로그인 수단을 여기로 옮겼다.
 * 글은 AccountMenu와 같다: 이름(없으면 데모 계정·맹고 사용자), 로그인 수단 + 이메일. Premium이면 사진 위에 왕관
 */
export function ProfileHead({ profile }: { profile: Pick<ProfileView, "displayName" | "email" | "avatarUrl" | "provider" | "demo" | "plan"> }) {
  const name = profile.displayName ?? (profile.demo ? "데모 계정" : "맹고 사용자");
  const initial = (profile.displayName ?? profile.email ?? "맹").trim().charAt(0).toUpperCase();
  const account = profile.demo ? "공용 데모 계정(로컬 개발용)" : `${profile.provider === "apple" ? "Apple" : "Google"} 계정${profile.email ? ` · ${profile.email}` : ""}`;
  const premium = profile.plan === "plus";
  return (
    <div className="flex items-center gap-3.5">
      <span className="relative inline-flex shrink-0">
        {profile.avatarUrl ? (
          // 구글 프로필 사진. 리퍼러를 보내면 가끔 막혀서 보내지 않는다
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className={`size-14 rounded-full border-2 object-cover ${premium ? "border-mango" : "border-line"}`} />
        ) : (
          <span aria-hidden="true" className="keep-light flex size-14 items-center justify-center rounded-full bg-mango text-[22px] font-black text-ink">
            {initial}
          </span>
        )}
        {premium && <Crown className="absolute -top-3.5 left-1/2 size-6 -translate-x-1/2 -rotate-[10deg] drop-shadow-[0_1px_0_rgb(255_255_255)]" />}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[18px] font-extrabold tracking-[-0.03em]">{name}</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-sub">{account}</p>
      </div>
    </div>
  );
}
