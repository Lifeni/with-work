import { onUnmounted } from "vue";

export type CardDragPayload = {
  kind: "staging" | "text-template" | "sort-template" | "rule";
  text: string;
  ruleId?: string;
};

const DRAG_THRESHOLD = 5;

type CardDragState = {
  startX: number;
  startY: number;
  payload: CardDragPayload;
  active: boolean;
  hit: HTMLElement | null;
  ghost: HTMLElement | null;
};

export function useCardDrag() {
  let cardDrag: CardDragState | null = null;

  function removeWindowListeners() {
    window.removeEventListener("pointermove", cardDragMove);
    window.removeEventListener("pointerup", cardDragUp);
    window.removeEventListener("pointercancel", cardDragAbort);
    window.removeEventListener("blur", cardDragAbort);
  }

  function finishDrag(clearHighlight = true) {
    if (!cardDrag) return;
    const drag = cardDrag;
    cardDrag = null;
    removeWindowListeners();
    document.body.style.userSelect = "";
    if (clearHighlight && drag.hit) drag.hit.style.outline = "";
    drag.ghost?.remove();
  }

  function cardDragMove(event: PointerEvent) {
    if (!cardDrag) return;
    const dx = event.clientX - cardDrag.startX;
    const dy = event.clientY - cardDrag.startY;
    if (!cardDrag.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!cardDrag.active) {
      cardDrag.active = true;
      document.body.style.userSelect = "none";
      const ghost = document.createElement("div");
      ghost.className = "ww-drag-ghost";
      const text = cardDrag.payload.text;
      ghost.textContent = text.length > 60 ? `${text.slice(0, 60)}…` : text;
      document.body.appendChild(ghost);
      cardDrag.ghost = ghost;
    }
    if (cardDrag.ghost) {
      cardDrag.ghost.style.left = `${event.clientX + 10}px`;
      cardDrag.ghost.style.top = `${event.clientY + 12}px`;
    }
    const hit = (document
      .elementFromPoint?.(event.clientX, event.clientY)
      ?.closest?.("[data-ww-editor]") ?? null) as HTMLElement | null;
    if (hit !== cardDrag.hit) {
      if (cardDrag.hit) cardDrag.hit.style.outline = "";
      cardDrag.hit = hit;
      if (hit) hit.style.outline = "2px solid var(--ring)";
    }
  }

  function cardDragUp(event: PointerEvent) {
    if (!cardDrag) return;
    const drag = cardDrag;
    finishDrag();
    if (drag.active && drag.hit) {
      drag.hit.dispatchEvent(
        new CustomEvent("ww-card-drop", {
          bubbles: true,
          detail: { ...drag.payload, clientX: event.clientX, clientY: event.clientY },
        }),
      );
    }
  }

  function cardDragAbort() {
    finishDrag();
  }

  function startCardDrag(event: PointerEvent, payload: CardDragPayload) {
    if (cardDrag) return;
    if (event.button !== 0 || (event.target as HTMLElement | null)?.closest?.("button")) return;
    cardDrag = {
      startX: event.clientX,
      startY: event.clientY,
      payload,
      active: false,
      hit: null,
      ghost: null,
    };
    window.addEventListener("pointermove", cardDragMove);
    window.addEventListener("pointerup", cardDragUp);
    window.addEventListener("pointercancel", cardDragAbort);
    window.addEventListener("blur", cardDragAbort);
  }

  onUnmounted(() => finishDrag());
  return { startCardDrag };
}
