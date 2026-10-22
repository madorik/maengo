/** 도는 고리(글자색). 재생을 눌렀는데 음성 정보를 아직 받는 중일 때 재생 아이콘 자리에 둔다 */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin ${className}`} />;
}
