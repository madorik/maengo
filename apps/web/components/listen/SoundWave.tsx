/**
 * 듣는 중 음성 파동(2026-11-10 사용자: 오늘 소식에서 듣는 동안 브리핑 듣기 막대에). 막대 다섯 개가 엇갈려 오르내린다.
 * 색은 글자색(currentColor)을 따른다. 움직임 줄이기를 켠 기기에서는 멈춘 막대로 보인다(globals.css .wave-bar)
 */
const BARS = [0.55, 0.9, 0.7, 1, 0.6];

export function SoundWave({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-5 items-center gap-[3px] ${className}`}>
      {BARS.map((h, i) => (
        <span key={i} className="wave-bar block w-[3px] rounded-full bg-current" style={{ height: `${h * 100}%`, animationDelay: `${i * 0.13}s` }} />
      ))}
    </span>
  );
}
