import { dFloat, dVec2, dVec3 } from "@/scripts/atom/uniforms/derivedAtoms";
import { useAtomUniforms } from "@/scripts/atom/uniforms/useAtomUniforms";
import { atom } from "jotai";
import { useMemo } from "react";
import { Vector2, Vector3 } from "three";
import { uniform } from "three/tsl";

export const CONSTS = {
  segments: 256,
  lineHeightRatio: 1.4,
};

export const useDemoStates = () => {
  const atoms = useMemo(() => {
    return {
      textWidths: atom<Float32Array | null>(null),
      leftXs: atom<Float32Array | null>(null),
      fontSize: atom(16),
      japanese: atom(false),
      md: atom(false),

      blob: {
        size: atom(new Vector3(0, 0, 0)),
        freq: atom(new Vector2(2 ** -1.5, 1)),
        speed: atom(0.5),
        scaleExp: atom(0.2),
      },

      rows: {
        minWidth: atom(0),
        insetX: atom(40),
        insetY: atom(0),
      },
    };
  }, []);

  const derivedAtoms = useMemo(() => {
    const numRows = atom((get) => {
      const sizeY = get(atoms.blob.size).y;
      const scale = get(atoms.blob.scaleExp);
      const fontSize = get(atoms.fontSize);
      const lineHeightPx = fontSize * CONSTS.lineHeightRatio;
      return Math.ceil((sizeY * Math.pow(2, scale)) / lineHeightPx) + 2;
    });
    return {
      rows: {
        num: numRows,
        lineHeight: atom((get) => get(atoms.fontSize) * CONSTS.lineHeightRatio),
        startY: atom((get) => {
          const nRows = get(numRows);
          const fontSize = get(atoms.fontSize);
          return (nRows - 1) * 0.5 * fontSize * CONSTS.lineHeightRatio;
        }),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewportSize = useMemo(() => uniform(new Vector2()), []);
  const random = useMemo(() => uniform(Math.random() * 1000), []);

  const uniforms = {
    viewportSize,
    random,
    blob: useAtomUniforms({
      size: dVec3((get, v) => v.copy(get(atoms.blob.size))),
      freq: dVec2((get, v) => v.copy(get(atoms.blob.freq))),
      speed: dFloat((get) => get(atoms.blob.speed)),
      scaleExp: dFloat((get) => get(atoms.blob.scaleExp)),
    }),
    rows: useAtomUniforms({
      lineHeight: dFloat((get) => get(derivedAtoms.rows.lineHeight)),
      startY: dFloat((get) => get(derivedAtoms.rows.startY)),
      insetX: dFloat((get) => get(atoms.rows.insetX)),
      insetY: dFloat((get) => get(atoms.rows.insetY)),
      minWidth: dFloat((get) => get(atoms.rows.minWidth)),
    }),
  };

  return {
    atoms: {
      ...atoms,
      rows: { ...atoms.rows, ...derivedAtoms.rows },
    },
    uniforms,
  };
};

export type DemoAtoms = ReturnType<typeof useDemoStates>["atoms"];
export type DemoUniforms = ReturnType<typeof useDemoStates>["uniforms"];
