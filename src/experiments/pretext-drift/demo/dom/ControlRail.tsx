import { useAtom } from "jotai";
import { Vector2 } from "three";
import {
  ExperimentControlLinkList,
  ExperimentControlRail,
  ExperimentControlSection,
  ExperimentRangeField,
} from "../../../../components/experiment-controls/ExperimentControls";
import { useDemoContext } from "../hooks/useDemoContext";

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
  const sources = [
    {
      href: "https://github.com/chenglou/pretext",
      label: "Pretext",
    },
    {
      href: "https://y11i-3d.github.io/study-007/",
      label: "Study-007",
    },
  ];

  return (
    <ExperimentControlRail>
      <ExperimentRangeField
        label="Size"
        value={fontSize}
        min={16}
        max={32}
        step={2}
        onChange={setFontSize}
      />
      <ExperimentRangeField
        label="Min Width"
        value={minWidth}
        min={0}
        max={250}
        step={50}
        onChange={setMinWidth}
      />
      <ExperimentRangeField
        label="Inset X"
        value={insetX}
        min={0}
        max={50}
        step={5}
        onChange={setInsetX}
      />
      <ExperimentRangeField
        label="Inset Y"
        value={insetY}
        min={0}
        max={50}
        step={5}
        onChange={setInsetY}
      />
      <ExperimentRangeField
        label="Warp X"
        value={freqX}
        min={-2}
        max={2}
        step={0.5}
        onChange={(next) => setFreq(new Vector2(2 ** next, freq.y))}
      />
      <ExperimentRangeField
        label="Warp Y"
        value={freqY}
        min={-2}
        max={2}
        step={0.5}
        onChange={(next) => setFreq(new Vector2(freq.x, 2 ** next))}
      />
      <ExperimentRangeField
        label="Motion"
        value={speed}
        min={0}
        max={1.5}
        step={0.1}
        onChange={setSpeed}
      />
      <ExperimentRangeField
        label="Distortion"
        value={scaleExp}
        min={0}
        max={1}
        step={0.1}
        onChange={setScaleExp}
      />
      <ExperimentControlSection title="Sources">
        <ExperimentControlLinkList links={sources} />
      </ExperimentControlSection>
    </ExperimentControlRail>
  );
}
