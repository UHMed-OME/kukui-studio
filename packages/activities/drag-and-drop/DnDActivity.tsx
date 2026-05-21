import { useId, useMemo, type CSSProperties, type ReactNode } from "react";
import type { DragAndDropConfig } from "@kukui/schemas";
import { resolveScoring } from "@kukui/core/scoring";
import { SafeHtml } from "@kukui/core";
import { Chip } from "./Chip.js";
import { Zone } from "./Zone.js";
import type { State } from "./state.js";
import { isCorrect } from "./state.js";

/**
 * Fallback prompt when an author hasn't supplied one. Picked to match
 * the actual activity flow: drag the labels, hit Check. The phrasing
 * leans on a verb ("Drag") and an end-condition ("then Check") so the
 * learner has a clear pair of actions without scanning the toolbar.
 */
const DEFAULT_PROMPT =
  "Drag each label to its matching drop zone, then tap Check to score your answers.";

/**
 * Pure presentational layer. Reads `state` and `config`, renders board +
 * tray + actions. Dispatches selection / placement through callbacks
 * provided by the parent — no business logic lives here.
 *
 * The DnDActivity is wrapped by either DragLayer (mounts a DndContext +
 * DragOverlay) or TapLayer (bare div). It exposes the same DOM shape
 * for both modes so layout doesn't shift when the mode flips.
 */

type ActivityCallbacks = {
  onSelectChip: (id: string) => void;
  onTapZone: (zoneId: string) => void;
  onLiftFromZone: (chipId: string) => void;
  onCheck: () => void;
  onTryAgain: () => void;
  onShowSolution: () => void;
};

export type DnDActivityProps = {
  config: DragAndDropConfig;
  state: State;
  mode: "drag" | "tap";
  headingId: string;
  HeadingTag: "h1" | "h2" | "h3";
  callbacks: ActivityCallbacks;
  /** Optional aria-live announcer slot. */
  announcerSlot?: ReactNode;
};

export function DnDActivity({
  config,
  state,
  mode,
  headingId,
  HeadingTag,
  callbacks,
  announcerSlot,
}: DnDActivityProps) {
  const layoutId = useId();
  const promptId = useId();
  const trayDomId = `${layoutId}-tray`;

  const draggablesById = useMemo(
    () => Object.fromEntries(config.draggables.map((d) => [d.id, d])),
    [config.draggables],
  );

  const zoneOccupants = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const z of config.dropZones) map.set(z.id, []);
    for (const [chipId, zid] of Object.entries(state.placement)) {
      if (zid) map.get(zid)?.push(chipId);
    }
    return map;
  }, [config.dropZones, state.placement]);

  const trayItems = config.draggables.filter((d) => state.placement[d.id] === null);

  const submitted = state.stage !== "answering";
  const allPlaced = Object.values(state.placement).every((z) => z !== null);
  const totalCorrect = useMemo(
    () => Object.entries(state.placement).filter(([id, zid]) => isCorrect(id, zid, config)).length,
    [state.placement, config],
  );
  const scoring = useMemo(() => resolveScoring(config, { mode: "points" }), [config]);

  const ui = config.ui ?? {};
  const checkLabel = ui.checkAnswerButton ?? "Check";
  const tryAgainLabel = ui.tryAgainButton ?? "Try again";
  const solutionLabel = ui.showSolutionButton ?? "Show solution";

  const aspect = config.behaviour?.aspectRatio ?? "16/10";
  const aspectCssMap: Record<string, string> = {
    "16/10": "16 / 10",
    "4/3": "4 / 3",
    "1/1": "1 / 1",
  };
  const boardStyle: CSSProperties = {
    aspectRatio: aspectCssMap[aspect],
    ...(config.background?.src
      ? { backgroundImage: `url(${config.background.src})` }
      : {}),
  };

  return (
    <div
      className={[
        "kukui-dnd",
        `kukui-dnd--mode-${mode}`,
        state.stage === "showing-solution" ? "kukui-dnd--showing-solution" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <article
        className="kukui-dnd__card"
        aria-labelledby={headingId}
        aria-describedby={promptId}
      >
        <HeadingTag id={headingId} className="kukui-dnd__title">
          {config.title}
        </HeadingTag>
        <div id={promptId}>
          <SafeHtml
            html={config.prompt && config.prompt.trim().length > 0 ? config.prompt : DEFAULT_PROMPT}
            className="kukui-dnd__prompt"
          />
        </div>
        {announcerSlot}
        <div className="kukui-dnd__layout">
          <div
            className={[
              "kukui-dnd__board",
              config.background?.src ? "" : "kukui-dnd__board--no-image",
            ]
              .filter(Boolean)
              .join(" ")}
            style={boardStyle}
            role={config.background?.src ? "img" : "group"}
            aria-label={config.background?.alt ?? ""}
          >
            {config.dropZones.map((zone) => {
              const occupants = zoneOccupants.get(zone.id) ?? [];
              const style: CSSProperties = {
                left: `${zone.rect.x * 100}%`,
                top: `${zone.rect.y * 100}%`,
                width: `${zone.rect.w * 100}%`,
                height: `${zone.rect.h * 100}%`,
              };
              return (
                <Zone
                  key={zone.id}
                  zoneId={zone.id}
                  label={zone.label}
                  showLabel={zone.showLabel}
                  style={style}
                  mode={mode}
                  awaitingPlacement={!!state.selectedChipId && state.stage === "answering"}
                  locked={submitted}
                  onTap={() => callbacks.onTapZone(zone.id)}
                  domId={`${layoutId}-zone-${zone.id}`}
                >
                  {occupants.map((chipId) => {
                    const d = draggablesById[chipId];
                    if (!d) return null;
                    return (
                      <Chip
                        key={chipId}
                        chip={d}
                        location="placed"
                        mode={mode}
                        selected={false}
                        locked={submitted}
                        correct={isCorrect(chipId, zone.id, config)}
                        onSelect={() => {
                          // Tap on a placed chip lifts it back to the tray and
                          // arms it for re-placement.
                          callbacks.onLiftFromZone(chipId);
                        }}
                      />
                    );
                  })}
                </Zone>
              );
            })}
          </div>
          <div
            id={trayDomId}
            className="kukui-dnd__tray"
            aria-label="Tray of unplaced labels"
          >
            {trayItems.map((d) => (
              <Chip
                key={d.id}
                chip={d}
                location="tray"
                mode={mode}
                selected={state.selectedChipId === d.id}
                locked={submitted}
                onSelect={() => callbacks.onSelectChip(d.id)}
                domId={`${layoutId}-chip-${d.id}`}
              />
            ))}
            {trayItems.length === 0 ? (
              <p className="kukui-dnd__tray-empty">All labels placed.</p>
            ) : null}
          </div>
        </div>

        <div
          className={["kukui-dnd__feedback", submitted ? "is-visible" : ""]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {state.stage === "submitted"
            ? `${totalCorrect} of ${config.draggables.length} correctly placed.`
            : state.stage === "showing-solution"
              ? "Solution shown."
              : ""}
        </div>

        {state.stage === "submitted" ? (
          <section className="kukui-dnd__summary" aria-label="Per-label summary">
            <ul className="kukui-dnd__summary-list">
              {config.draggables.map((d) => {
                const zid = state.placement[d.id] ?? null;
                const correct = isCorrect(d.id, zid, config);
                return (
                  <li key={d.id} className="kukui-dnd__summary-item">
                    <span className="kukui-dnd__summary-icon" aria-hidden="true">
                      {correct ? "✓" : "✗"}
                    </span>
                    <span className="kukui-dnd__summary-name">{d.label}</span>
                    {d.feedback ? (
                      <span className="kukui-dnd__summary-feedback">{d.feedback}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="kukui-dnd__actions">
          {state.stage === "answering" ? (
            <button
              type="button"
              className="kukui-dnd__primary"
              disabled={!allPlaced}
              onClick={callbacks.onCheck}
            >
              {checkLabel}
            </button>
          ) : null}
          {state.stage === "submitted" && scoring.enableSolutionsButton ? (
            <button
              type="button"
              className="kukui-dnd__secondary"
              onClick={callbacks.onShowSolution}
            >
              {solutionLabel}
            </button>
          ) : null}
          {submitted && scoring.enableRetry ? (
            <button
              type="button"
              className="kukui-dnd__secondary"
              onClick={callbacks.onTryAgain}
            >
              {tryAgainLabel}
            </button>
          ) : null}
        </div>
      </article>
    </div>
  );
}
