import { redirect } from "next/navigation";

// 랜딩은 Day 13. 지금은 로그인 여부에 따라 proxy가 /login으로, 여기서 /today로 보낸다.
export default function Home() {
  redirect("/today");
}
