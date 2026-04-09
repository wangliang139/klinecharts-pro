import type { HisOrder } from "../types/types";

export type HisOrderHoverDetail = {
  visible: boolean;
  order: HisOrder | null;
  anchorX?: number | null;
  anchorY?: number | null;
  sourceContainer?: HTMLElement | null;
};

export function createHisOrderHoverController(
  hideDelay: number,
  apply: (detail: { visible: boolean; order: HisOrder | null; x: number | null; y: number | null }) => void,
) {
  let hideTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  const clear = () => {
    if (hideTimer != null) {
      globalThis.clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const onEvent = (evt: Event) => {
    const event = evt as CustomEvent<HisOrderHoverDetail>;
    const detail = event.detail;
    const visible = !!detail?.visible;
    if (visible) {
      clear();
      apply({
        visible: true,
        order: detail?.order ?? null,
        x: detail?.anchorX ?? null,
        y: detail?.anchorY ?? null,
      });
      return;
    }
    clear();
    hideTimer = globalThis.setTimeout(() => {
      hideTimer = null;
      apply({ visible: false, order: null, x: null, y: null });
    }, hideDelay);
  };

  return { onEvent, clear };
}

export function createResyncScheduler(sync: () => void, delays: readonly number[]) {
  const timers: Array<ReturnType<typeof globalThis.setTimeout>> = [];
  let batch = 0;

  const clear = () => {
    while (timers.length > 0) {
      const timer = timers.pop();
      if (timer != null) globalThis.clearTimeout(timer);
    }
  };

  const schedule = () => {
    batch += 1;
    const currentBatch = batch;
    clear();
    delays.forEach((delay) => {
      const timer = globalThis.setTimeout(() => {
        if (currentBatch !== batch) return;
        sync();
        const idx = timers.indexOf(timer);
        if (idx >= 0) timers.splice(idx, 1);
      }, delay);
      timers.push(timer);
    });
  };

  return { schedule, clear };
}
