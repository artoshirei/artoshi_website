import { useThree } from "@react-three/fiber";
import { useStore } from "jotai";
import { Vector3 } from "three";
import { useDemoContext } from "../../hooks/useDemoContext";

const FILL = 0.667;

function fallbackCanvasSize() {
  if (typeof window === "undefined") return { w: 1024, h: 640 };
  /* Before the canvas has laid out, R3F `size` can be 0×0 — blob would collapse to nothing. */
  return {
    w: Math.max(window.innerWidth, 320),
    h: Math.max(Math.round(window.innerHeight * 0.65), 240),
  };
}

export const useDemoSize = () => {
  const store = useStore();

  const { size } = useThree();
  const { atoms, uniforms } = useDemoContext();

  const { w: fw, h: fh } = fallbackCanvasSize();
  const rw = size.width > 1 ? size.width : fw;
  const rh = size.height > 1 ? size.height : fh;

  uniforms.viewportSize.value.set(rw, rh);

  const x = rw * FILL;
  const y = rh * FILL;
  const z = x / y;

  store.set(atoms.blob.size, new Vector3(x, y, z));
  store.set(atoms.md, rw < 768);
};
