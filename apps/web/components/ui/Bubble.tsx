// 캐릭터 말풍선. tail은 꼬리가 붙는 쪽.
export function Bubble({
  children,
  tail = "left",
  tone = "white",
  className = "",
}: {
  children: React.ReactNode;
  tail?: "left" | "bottom" | "none";
  tone?: "white" | "sky";
  className?: string;
}) {
  const color = tone === "sky" ? "border-sky bg-sky-tint" : "border-line bg-white";
  return (
    <div className={`relative rounded-2xl border-2 px-4 py-3 ${color} ${className}`}>
      {children}
      {tail === "left" && (
        <span aria-hidden="true" className={`absolute -left-[9px] top-6 size-4 rotate-45 border-b-2 border-l-2 ${color}`} />
      )}
      {tail === "bottom" && (
        <span aria-hidden="true" className={`absolute -bottom-[9px] left-1/2 size-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 ${color}`} />
      )}
    </div>
  );
}
