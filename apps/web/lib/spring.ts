// 손으로 끄는 화면에 쓰는 스프링·관성 계산(애플 Designing Fluid Interfaces의 값과 식).
// 스프링은 언제든 지금 자리·속도에서 다시 시작할 수 있어서, 움직이는 화면을 다시 잡아도 튀지 않는다.

/**
 * from → to 로 스프링을 굴리고, 멈추는 함수를 돌려준다.
 * response = 목표에 닿는 빠르기(초, 지속 시간이 아니다), damping = 감쇠비(1이면 튕기지 않고 멈춘다).
 * velocity는 시작 속도(값/초)라서 손을 뗀 속도를 그대로 넘기면 끌던 움직임이 끊기지 않고 이어진다.
 */
export function animateSpring(opts: {
  from: number;
  to: number;
  velocity?: number;
  response?: number;
  damping?: number;
  onUpdate: (value: number, velocity: number) => void;
  onRest?: () => void;
}): () => void {
  const { from, to, response = 0.35, damping = 1, onUpdate, onRest } = opts;
  const stiffness = ((2 * Math.PI) / response) ** 2;
  const friction = (4 * Math.PI * damping) / response;
  const span = Math.max(Math.abs(to - from), 1);
  let x = from;
  let v = opts.velocity ?? 0;
  let last = performance.now();
  let raf = requestAnimationFrame(function step(now) {
    // 프레임이 늦게 와도 튀지 않게 작은 걸음으로 나눠 적분한다
    let dt = Math.min((now - last) / 1000, 0.064);
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      v += (-stiffness * (x - to) - friction * v) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - to) < span * 0.001 && Math.abs(v) < span * 0.01) {
      onUpdate(to, 0);
      onRest?.();
      return;
    }
    onUpdate(x, v);
    raf = requestAnimationFrame(step);
  });
  return () => cancelAnimationFrame(raf);
}

/** 손을 뗀 속도(px/초)로 앞으로 얼마나 더 갈지. 스크롤 감속과 같은 식이고, 0.99는 페이지 넘김용으로 조금 짧게 잡은 값 */
export function projectMomentum(velocity: number, decelerationRate = 0.99): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** 끝에서 더 끌면 갈수록 덜 따라오게(고무줄). dimension은 화면 너비처럼 기준 길이 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
