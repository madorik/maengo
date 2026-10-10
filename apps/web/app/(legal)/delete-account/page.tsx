import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/LegalPage";
import { OPERATOR_NAME, supportEmail } from "@/lib/site";

export const metadata: Metadata = { title: "계정 삭제 안내", alternates: { canonical: "/delete-account" } };

// 구글 플레이 '계정 삭제 요청 URL'과 애플 심사에 거는 공개 페이지. 실제 삭제는 설정 > 계정의 deleteAccount(app/actions.ts).
export default function DeleteAccountPage() {
  const email = supportEmail();
  if (!email) notFound();
  return (
    <LegalPage title="계정 삭제 안내" path="/delete-account">
      <p>맹고(운영자 {OPERATOR_NAME}) 계정과 그 기록을 지우는 방법입니다. 지우면 되돌릴 수 없습니다.</p>

      <h2>앱이나 웹에서 바로 지우기</h2>
      <ol>
        <li>맹고 앱이나 웹(maengo.vercel.app)에 로그인합니다.</li>
        <li>설정으로 들어갑니다.</li>
        <li>맨 아래 &lsquo;계정&rsquo;에서 &lsquo;계정 삭제&rsquo;를 누릅니다.</li>
        <li>안내를 읽고 &lsquo;계정 삭제하기&rsquo;를 한 번 더 누르면 바로 지워지고 로그아웃됩니다.</li>
      </ol>

      <h2>로그인할 수 없을 때</h2>
      <p>
        가입한 이메일 주소로 <a href={`mailto:${email}?subject=${encodeURIComponent("맹고 계정 삭제 요청")}`}>{email}</a>에 &lsquo;계정 삭제 요청&rsquo;을 보내 주세요. 가입한 계정이 맞는지 확인한 뒤 10일
        안에 지우고 알려 드립니다.
      </p>

      <h2>지워지는 정보</h2>
      <ul>
        <li>계정 정보: 이메일 주소, 이름, 프로필 사진 주소, 로그인 식별값</li>
        <li>관심사(&lsquo;기타&rsquo;에 직접 적은 관심사 포함)</li>
        <li>받은 맹고 목록, 읽음·들음 기록, 좋아요·싫어요</li>
        <li>알림 시각, 듣기 설정, 플랜과 Premium 기간</li>
      </ul>

      <h2>남는 정보</h2>
      <ul>
        <li>운영 비용 관리를 위한 음성 생성 기록은 회원과의 연결을 끊은 통계로만 남습니다.</li>
        <li>&lsquo;기타&rsquo;에 적은 문구는 같은 말을 쓰는 다른 회원이 없으면 함께 지웁니다. 이미 소식 분류에 쓰인 문구는 회원과 연결되지 않은 주제 이름으로만 남습니다.</li>
        <li>데이터베이스 백업과 호스팅 접속 기록에 남은 정보는 각 보관 기간이 지나면 지워집니다.</li>
      </ul>

      <h2>Google·Apple 로그인 연결</h2>
      <p>
        맹고 계정을 지워도 Google·Apple 계정은 그대로입니다. 로그인 연결까지 끊으려면 Google 계정 설정의 &lsquo;서드 파티 앱 및 서비스&rsquo;나 Apple ID 설정의 &lsquo;Apple로 로그인&rsquo;에서 맹고를
        지워 주세요.
      </p>
      <p>
        개인정보를 어떻게 다루는지는 <Link href="/privacy">개인정보 처리방침</Link>에 있습니다.
      </p>
    </LegalPage>
  );
}
