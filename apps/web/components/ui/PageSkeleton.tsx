/** 화면을 옮길 때 서버 응답을 기다리는 동안 바로 보이는 뼈대. 누르는 즉시 화면이 바뀌어 느리게 느껴지지 않게 한다 */
export function PageSkeleton({ hero = true, cards = 3 }: { hero?: boolean; cards?: number }) {
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-5 lg:pt-8" aria-busy="true">
      <p role="status" className="sr-only">
        불러오는 중
      </p>
      {hero && <div className="h-32 rounded-2xl bg-mango-tint motion-safe:animate-pulse" />}
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="tile mt-4 p-5">
          <div className="h-4 w-24 rounded bg-snow motion-safe:animate-pulse" />
          <div className="mt-3 h-5 w-4/5 rounded bg-snow motion-safe:animate-pulse" />
          <div className="mt-3 h-4 w-full rounded bg-snow motion-safe:animate-pulse" />
          <div className="mt-2 h-4 w-2/3 rounded bg-snow motion-safe:animate-pulse" />
        </div>
      ))}
    </div>
  );
}
