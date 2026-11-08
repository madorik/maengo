import type { Metadata } from "next";
import { KeywordSlots } from "@/components/settings/KeywordSlots";
import { LinkSlots } from "@/components/settings/LinkSlots";
import { Section } from "@/components/settings/Section";
import { TopicSettings } from "@/components/settings/TopicSettings";
import { userLinks } from "@/lib/server/links";
import { entitlements } from "@/lib/server/profile";
import { requireProfile } from "@/lib/server/session";
import { newsSections, topicGroups, userTopics } from "@/lib/server/topics";

export const metadata: Metadata = { title: "내 관심 키워드" };

/**
 * 내 관심 키워드(2026-11-08, 설정 > 관심사·내 관심 링크를 주 메뉴로 따로 뺌).
 * 위에서부터 관심 분야(목록에서 고르기), 내 키워드(직접 적기, 예전 '기타'), 내 관심 링크(블로그·사이트 주소).
 */
export default async function KeywordsPage() {
  const profile = await requireProfile();
  const [topics, links] = await Promise.all([userTopics(profile), userLinks(profile)]);
  const mine = topics.filter((t) => !t.link);
  const custom = mine.filter((t) => t.custom);
  const limit = entitlements(profile).customLimit;

  return (
    <div className="mx-auto max-w-[640px] px-5 py-8 lg:py-12">
      <h1 className="text-[28px] font-black tracking-[-0.03em]">내 관심 키워드</h1>

      <div className="mt-6">
        <Section id="topics" title="관심 분야">
          <TopicSettings groups={topicGroups(topics)} news={newsSections(topics)} custom={custom} />
        </Section>

        <Section
          id="keywords"
          title="내 키워드"
          action={
            limit > 0 ? (
              <span className="font-round text-[15px] font-extrabold text-sub tabular-nums" aria-label={`${limit}개 중 ${Math.min(custom.length, limit)}개`}>
                {Math.min(custom.length, limit)}/{limit}
              </span>
            ) : undefined
          }
        >
          <KeywordSlots keywords={custom} limit={limit} total={mine.length} />
        </Section>

        <Section id="links" title="내 관심 링크">
          {/* 블로그·사이트·유튜브 채널 주소 칸 3개(Premium). Free는 Premium 배지, 전에 넣어 둔 링크는 배지와 빼기만 */}
          <LinkSlots links={links} limit={entitlements(profile).linkLimit} />
        </Section>
      </div>
    </div>
  );
}
