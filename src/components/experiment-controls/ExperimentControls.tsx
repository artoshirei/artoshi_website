import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import "./ExperimentControls.css";
import {
  RANGE_THUMB_WIDTH_PX,
  clampControlValue,
  formatControlValue,
  getControlInputWidth,
  getStepPrecision,
  snapControlValue,
  toControlId,
} from "./controlUtils";

export function ExperimentControlPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`experiment-controls-panel ${className}`.trim()}>
      {children}
    </div>
  );
}

export function ExperimentControlRail({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <aside className="experiment-controls-rail h-full">
      <div className="experiment-controls-inner">{children}</div>
    </aside>
  );
}

export function ExperimentControlSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`experiment-controls-section ${className}`.trim()}>
      <h2 className="experiment-controls-section-label">{title}</h2>
      {children}
    </section>
  );
}

export function ExperimentControlLinkList({
  links,
}: {
  links: Array<{
    href: string;
    label: string;
  }>;
}) {
  return (
    <div className="experiment-controls-links" role="list">
      {links.map((link) => (
        <a
          key={link.href}
          className="experiment-controls-link"
          href={link.href}
          target="_blank"
          rel="noreferrer"
          role="listitem"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

export function ExperimentRangeField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: string;
  onChange: (next: number) => void;
}) {
  const precision = getStepPrecision(step);
  const normalizedValue = snapControlValue(
    clampControlValue(value, min, max),
    min,
    step,
  );
  const [draft, setDraft] = useState(
    display ?? formatControlValue(normalizedValue, precision),
  );
  const [trackWidth, setTrackWidth] = useState(0);
  const rangeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(display ?? formatControlValue(normalizedValue, precision));
  }, [display, normalizedValue, precision]);

  useEffect(() => {
    const node = rangeRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateWidth = () => {
      setTrackWidth(node.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const ratio = (normalizedValue - min) / (max - min);
  const progressPosition =
    trackWidth > 0
      ? `${RANGE_THUMB_WIDTH_PX / 2 + ratio * (trackWidth - RANGE_THUMB_WIDTH_PX)}px`
      : `${ratio * 100}%`;
  const inputId = toControlId(label);

  const commitDraft = (nextDraft: string) => {
    const trimmed = nextDraft.trim();
    const parsed = Number(trimmed);

    if (!trimmed || Number.isNaN(parsed)) {
      setDraft(display ?? formatControlValue(normalizedValue, precision));
      return;
    }

    const nextValue = snapControlValue(
      clampControlValue(parsed, min, max),
      min,
      step,
    );
    onChange(nextValue);
    setDraft(formatControlValue(nextValue, precision));
  };

  return (
    <label className="experiment-controls-field">
      <span className="experiment-controls-label">{label}</span>
      <div className="experiment-controls-row">
        <input
          id={`${inputId}-range`}
          ref={rangeRef}
          aria-label={label}
          className="experiment-controls-range"
          type="range"
          min={min}
          max={max}
          step={step}
          value={normalizedValue}
          style={
            {
              "--experiment-control-progress-position": progressPosition,
            } as CSSProperties
          }
          onChange={(event) => {
            const nextValue = Number(event.currentTarget.value);
            onChange(nextValue);
            setDraft(formatControlValue(nextValue, precision));
          }}
        />
        <input
          id={`${inputId}-value`}
          aria-label={label}
          className="experiment-controls-value"
          type="text"
          inputMode="decimal"
          spellCheck={false}
          value={draft}
          style={{ width: getControlInputWidth(min, max, step) }}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={(event) => commitDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitDraft(event.currentTarget.value);
              event.currentTarget.blur();
            }

            if (event.key === "Escape") {
              setDraft(display ?? formatControlValue(normalizedValue, precision));
              event.currentTarget.blur();
            }
          }}
        />
      </div>
    </label>
  );
}
