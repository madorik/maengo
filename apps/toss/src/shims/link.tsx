import type { AnchorHTMLAttributes, ReactNode } from "react";

// next/link 대신(토스판은 페이지가 하나라 화면 이동이 없다). 바깥 주소는 main.tsx가 기기 브라우저로 연다
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string }; prefetch?: boolean; scroll?: boolean; replace?: boolean; children?: ReactNode };

export default function Link({ href, prefetch: _p, scroll: _s, replace: _r, ...rest }: Props) {
  return <a href={typeof href === "string" ? href : (href.pathname ?? "#")} {...rest} />;
}
