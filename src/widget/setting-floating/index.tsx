import { DeepPartial } from "klinecharts";
import { createSignal, createEffect, onCleanup, onMount, JSX, Show } from "solid-js";
import lodashSet from 'lodash/set'
import { selectedOverlay, setChartModified } from '../../store/chartStore'
import { useChartState } from "../../store/chartStateStore";
import { setPopupOverlay, setShowOverlaySetting } from "../../store/overlaySettingStore";
import { Color } from "../../component";
import { Icon } from "../icons";
import { OverlayProperties, ProOverlay } from "../../types";

function overlayProperties(overlay: ProOverlay): DeepPartial<OverlayProperties> {
  const gp = overlay.getProperties;
  if (typeof gp === "function") {
    try {
      return gp.call(overlay, overlay.id) ?? {};
    } catch {
      return {};
    }
  }
  return {};
}

const { popOverlay, modifyOverlay, modifyOverlayProperties } = useChartState()

export type FloatingAction = {
  key: string;
  title?: string;
  icon?: string;
  visible?: boolean | ((overlay?: ProOverlay) => boolean);
  // optional inline editor type: 'color' | 'number' | 'select' | undefined
  editor?: {
    type: "color" | "number" | "select" | 'dropdown';
    value?: string | number | CanvasGradient;
    options?: string[]; // for select
    min?: number;
    max?: number;
    step?: number;
  };
  // when clicked (or when editor value changed) -> receives overlay id and optional new value
  onClick?: (overlayId: string, value?: any) => void;
};

export type FloatingProps = {
  locale?: string;
  // absolute coords relative to chart container
  x?: number;
  y?: number;
  // user-provided actions override default
  actions?: FloatingAction[];
  onClose?: () => void;
  class?: string;
};

const [localPos, setLocalPos] = createSignal({ x: 0, y: 0 });

export default function Floating(props: FloatingProps) {
  const [visibleEditorKey, setVisibleEditorKey] = createSignal<string | null>(null);
  setLocalPos({
    x: localPos().x ?? props.x ?? 0,
    y: localPos().y ?? props.y ?? 0
  })

  // dragging state
  const [dragging, setDragging] = createSignal(false);
  let dragStart = { mx: 0, my: 0, sx: 0, sy: 0 };

  // add a token to force recompute of actions when we perform changes
  const [actionsVersion, setActionsVersion] = createSignal(0)

  const defaultActions = (overlay: ProOverlay): FloatingAction[] => {
    const props = overlayProperties(overlay);
    console.info('default actions called');
    return [
      { key: "group", title: "Group", icon: "templates", onClick: (id) => console.debug("group", id) },
      {
        key: "border",
        title: "Line tool color",
        icon: "edit",
        // try to read sensible defaults from overlay.styles if present
        editor: { type: "color", value: props.lineColor ?? props.borderColor ?? "#ffffff" },
        onClick: (id, v) => {
          console.debug("set border color", id, v)
          modifyOverlayProperties(overlay.id, { lineColor: v})
        }
      },
      {
        key: "background",
        title: "Line tool background",
        icon: "fill",
        // try to read sensible defaults from overlay.styles if present
        editor: { type: "color", value: props.backgroundColor ?? "#000000" },
        onClick: (id, v) => {
          console.debug("set background", id, v)
          modifyOverlayProperties(overlay.id, { backgroundColor: v})
        }
      },
      {
        key: "text",
        title: "Line tool text color",
        icon: "text",
        editor: { type: "color", value: props.textColor ?? "#ffffff" },
        onClick: (id, v) => console.debug("set text color", id, v)
      },
      {
        key: "size",
        title: "Line tool width (px)",
        icon: "line",
        editor: { type: "number", value: props.textFontSize ?? 2, min: 1, max: 50, step: 1 },
        onClick: (id, v) => console.debug("set size", id, v)
      },
      {
        key: "line",
        title: "Line tool style",
        icon: (() => {
          const style = props.lineStyle ?? "solid"
          ///@ts-expect-error
          return style === 'dashed' ? "lineDashed" : style === 'dotted' ? "lineDotted" : "line"
        })(),
        editor: { type: "select", options: ["solid", "dashed"], value: overlay.styles?.line?.style ?? "solid" },
        onClick: (id, v) => console.debug("set line", id, v)
      },
      {
        key: "settings", title: "Settings", icon: "settings", onClick: (id) => {
          setPopupOverlay(overlay)
          setShowOverlaySetting(true)
        }
      },
      // { key: "alert", title: "Alert", icon: Icon.alert, onClick: (id) => console.debug("alert", id) },
      {
        key: "lock",
        title: overlay && overlay.lock ? "Unlock" : "Lock",
        icon: overlay && overlay.lock ? "locked" : "unlocked",
        // visible: overlay.lock !== undefined ? !overlay.lock : true,
        onClick: (id) => modifyOverlay(id, { lock: !overlay.lock })
      },
      { key: "delete", title: "Delete", icon: "trash", onClick: (id) => popOverlay(id) },
      { key: "more", title: "More", icon: "more", onClick: (id) => console.debug("more", id) }
    ]
  };

  const actions = () => {
    // read token so actions recompute when we bump it
    actionsVersion()
    const overlay = selectedOverlay();
    console.info('actions called, overlay:', overlay);
    return props.actions ?? (overlay ? defaultActions(overlay) : []);
  }

  let containerEl: HTMLElement | undefined;

  const onDocumentClick = (e: MouseEvent) => {
    const target = e.target as Node;
    if (!containerEl) return;
    if (!containerEl.contains(target)) {
      props.onClose?.();
    }
  };
  const onDocMouseMove = (e: MouseEvent) => {
    if (!dragging()) return;
    const nxRaw = dragStart.sx + (e.clientX - dragStart.mx);
    const nyRaw = dragStart.sy + (e.clientY - dragStart.my);
    const maxX = Math.max(0, (window.innerWidth - (containerEl?.offsetWidth ?? 220)));
    const maxY = Math.max(0, (window.innerHeight - (containerEl?.offsetHeight ?? 48)));
    const nx = Math.min(Math.max(0, nxRaw), maxX);
    const ny = Math.min(Math.max(0, nyRaw), maxY);

    setLocalPos({ x: nx, y: ny });
  };
  const onDocMouseUp = () => {
    if (dragging()) setDragging(false);
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
  };

  onMount(() => {
    document.addEventListener("mousedown", onDocumentClick);

    if ((typeof props.x !== 'number' || typeof props.y !== 'number')) {
      const defaultX = Math.max(500, window.innerWidth/2);
      const defaultY = 40;
      setLocalPos({ x: defaultX, y: defaultY });
    }
  });
  onCleanup(() => {
    document.removeEventListener("mousedown", onDocumentClick);
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
  });

  createEffect(() => {
    if (typeof props.x === "number" && typeof props.y === "number") {
      setLocalPos({ x: props.x, y: props.y });
    }
  });

  const persistFallbackStyle = (key: string, value: any) => {
    try {
      const chartStateObj = localStorage.getItem(`chartstatedata`);
      let chartObj: any;
      if (chartStateObj) {
        chartObj = JSON.parse(chartStateObj);
        chartObj.styleObj = chartObj.styleObj ?? {};
      } else {
        chartObj = { styleObj: {} };
      }

      const storageKey = `overlay.${key}`;
      lodashSet(chartObj.styleObj, storageKey, value);
      localStorage.setItem(`chartstatedata`, JSON.stringify(chartObj));
      setChartModified(true);
    } catch (err) {
      console.warn('persistFallbackStyle error', err);
    }
  };

  const runAction = (act: FloatingAction, value?: any) => {
    const id = selectedOverlay()?.id;

    if (act.onClick) {
      if (id) act.onClick(id, value);
      else act.onClick('unknown', value);
      setActionsVersion(actionsVersion() + 1)
      return;
    }
    window.dispatchEvent(new CustomEvent('cr-overlay-setting', {
      detail: { overlayId: id, key: act.key, value }
    }));
    persistFallbackStyle(act.key, value);
    setActionsVersion(actionsVersion() + 1)
  };

  const onMouseDownStartDrag = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.cr-action-btn') || target.closest('.cr-editor') || target.tagName === 'INPUT' || target.tagName === 'SELECT') {
      return;
    }
    e.preventDefault();
    dragStart = { mx: e.clientX, my: e.clientY, sx: localPos().x, sy: localPos().y };
    setDragging(true);
    document.addEventListener('mousemove', onDocMouseMove);
    document.addEventListener('mouseup', onDocMouseUp);
  };

  return (
    <div
      ref={el => (containerEl = el!)}
      class={`cr-setting-floating ${props.class ?? ""} ${dragging() ? 'dragging' : ''}`}
      style={{
        position: "fixed",
        left: `${localPos().x}px`,
        top: `${localPos().y}px`,
        ///@ts-ignore
        touchAction: 'none',
        cursor: dragging() ? 'grabbing' : 'grab'
      }}

      onPointerDown={(e) => { e.stopPropagation(); }}
      onMouseDown={(e) => onMouseDownStartDrag(e as unknown as MouseEvent)}
    >
      <div class="cr-floating-inner">
        <div class="drag-handle">
          <Icon name="drag" />
        </div>
        {actions().map(act => {
          const isVisible = typeof act.visible === "function" ? act.visible(selectedOverlay() ?? undefined) : (act.visible ?? true);
          if (!isVisible) return null;
          return (
            <div class="cr-action" title={act.title ?? act.key}>
              {/* <div class="cr-action" key={act.key} title={act.title ?? act.key}> */}
              <div
                class="cr-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (act.editor) {
                    setVisibleEditorKey(visibleEditorKey() === act.key ? null : act.key);
                  } else {
                    runAction(act);
                  }
                }}
              >
                <div class="cr-action-icon" style={{ height: act.editor?.type === 'color' ? '16px' : undefined, width: act.editor?.type === 'color' ? '16px' : undefined}}><Icon name={act.icon} /></div>
                <Show when={act.editor?.type === "color"}>
                  <div class="cr-action-label" style={{ 'background-color': act.editor?.value as string }}></div>
                </Show>
              </div>

              {act.editor && visibleEditorKey() === act.key && (
                <div class="cr-editor" onClick={(e) => e.stopPropagation()}>
                  {act.editor.type === "color" && (
                    <Color
                      style={{ width: '120px' }}
                      value={act.editor.value as string}
                      reactiveChange={false}
                      onChange={(el) => {
                        runAction(act, el)
                      }}
                    />
                  )}
                  {act.editor.type === "number" && (
                    <input
                      type="number"
                      min={act.editor.min}
                      max={act.editor.max}
                      step={act.editor.step}
                      value={String(act.editor.value ?? "")}
                      onInput={(e) => runAction(act, Number((e.currentTarget as HTMLInputElement).value))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  {act.editor.type === "select" && (
                    <select
                      value={(act.editor.value as string) ?? ""}
                      onChange={(e) => runAction(act, (e.currentTarget as HTMLSelectElement).value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(act.editor.options ?? []).map(opt => <option value={opt}>{opt}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}