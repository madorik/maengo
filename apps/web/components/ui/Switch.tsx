"use client";

/** 켜고 끄는 스위치(듣기 설정·알림 설정) */
export function Switch({
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-3 text-left disabled:cursor-wait disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold">{label}</span>
        {note && <span className="mt-0.5 block truncate text-[13px] font-semibold text-sub">{note}</span>}
      </span>
      <span className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${checked ? "justify-end bg-sky" : "justify-start bg-line"}`}>
        <span className="size-6 rounded-full bg-white shadow-[0_2px_0_rgb(0_0_0/0.15)]" />
      </span>
    </button>
  );
}
