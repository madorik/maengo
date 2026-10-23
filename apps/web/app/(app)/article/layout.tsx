import { ArticleSwipe } from "@/components/article/ArticleSwipe";

// 글 상세끼리 좌우로 밀어 이전·다음 글로 넘긴다(앱에서만). 글이 바뀌어도 이 레이아웃은 남아서 밀려나던 움직임을 새 글이 이어받는다
export default function ArticleLayout({ children }: { children: React.ReactNode }) {
  return <ArticleSwipe>{children}</ArticleSwipe>;
}
