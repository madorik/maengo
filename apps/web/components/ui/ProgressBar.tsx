// 듀오링고식 두꺼운 진행 막대. 채운 부분 위에 밝은 줄 하나.
const TONES = { mango: "bg-mango", leaf: "bg-leaf-bright", sky: "bg-sky" } as const;

export function ProgressBar({
  value,
  tone = "mango",
  label,
  className = "h-4",
  track = "bg-line",
}: {
  value: number;
  tone?: keyof typeof TONES;
  label: string;
  className?: string;
  track?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`overflow-hidden rounded-full ${track} ${className}`}
    >
      <div className={`relative h-full rounded-full transition-[width] duration-500 ease-out ${TONES[tone]}`} style={{ width: `${pct}%` }}>
        {pct > 4 && <span className="absolute inset-x-2 top-[22%] h-[22%] min-h-[3px] rounded-full bg-white/40" />}
      </div>
    </div>
  );
}
