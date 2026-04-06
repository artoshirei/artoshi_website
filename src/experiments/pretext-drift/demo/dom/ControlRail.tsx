import { useAtom } from "jotai";
import type { ReactNode } from "react";
import { Vector2 } from "three";
import { useDemoContext } from "../hooks/useDemoContext";

function fmt(value: number, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

function RailField({
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
  return (
    <label className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="pretext-rail-label">{label}</span>
        <span className="pretext-rail-value">{display ?? fmt(value)}</span>
      </div>
      <input
        className="pretext-rail-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function RailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pretext-rail-block pt-4 first:pt-0">
      <p className="pretext-rail-section mb-1">{title}</p>
      <div>{children}</div>
    </section>
  );
}

export function ControlRail() {
  const { atoms } = useDemoContext();

  const [fontSize, setFontSize] = useAtom(atoms.fontSize);
  const [minWidth, setMinWidth] = useAtom(atoms.rows.minWidth);
  const [insetX, setInsetX] = useAtom(atoms.rows.insetX);
  const [insetY, setInsetY] = useAtom(atoms.rows.insetY);
  const [speed, setSpeed] = useAtom(atoms.blob.speed);
  const [scaleExp, setScaleExp] = useAtom(atoms.blob.scaleExp);
  const [freq, setFreq] = useAtom(atoms.blob.freq);

  const freqX = Math.log2(freq.x);
  const freqY = Math.log2(freq.y);

  return (
    <aside className="pretext-rail h-full">
      <div className="pretext-rail-inner">
        <RailSection title="Type">
          <RailField
            label="Size"
            value={fontSize}
            min={16}
            max={32}
            step={2}
            onChange={setFontSize}
          />
        </RailSection>

        <RailSection title="Rows">
          <RailField
            label="Min Width"
            value={minWidth}
            min={0}
            max={250}
            step={50}
            onChange={setMinWidth}
          />
          <RailField
            label="Inset X"
            value={insetX}
            min={0}
            max={50}
            step={5}
            onChange={setInsetX}
          />
          <RailField
            label="Inset Y"
            value={insetY}
            min={0}
            max={50}
            step={5}
            onChange={setInsetY}
          />
        </RailSection>

        <RailSection title="Blob">
          <RailField
            label="Warp X"
            value={freqX}
            min={-2}
            max={2}
            step={0.5}
            onChange={(next) => setFreq(new Vector2(2 ** next, freq.y))}
          />
          <RailField
            label="Warp Y"
            value={freqY}
            min={-2}
            max={2}
            step={0.5}
            onChange={(next) => setFreq(new Vector2(freq.x, 2 ** next))}
          />
          <RailField
            label="Motion"
            value={speed}
            min={0}
            max={1.5}
            step={0.1}
            onChange={setSpeed}
          />
          <RailField
            label="Distortion"
            value={scaleExp}
            min={0.2}
            max={1}
            step={0.1}
            onChange={setScaleExp}
          />
        </RailSection>
      </div>
    </aside>
  );
}
