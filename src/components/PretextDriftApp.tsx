import { useState } from "react";
import { Three } from "../experiments/pretext-drift/demo/three/Three";

export function PretextDriftApp() {
  /* Lazy init avoids a `null` frame where nothing mounts (empty black main). */
  const [hasWebGPU] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return "gpu" in navigator;
  });

  if (!hasWebGPU) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-sm text-sm text-[#888]">
          This experiment needs WebGPU. Try a current version of Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative flex w-full flex-1 flex-col bg-black"
      style={{
        height: "clamp(28rem, 70dvh, 56rem)",
        minHeight: "min(70dvh, 56rem)",
        width: "100%",
      }}
    >
      <Three />
    </div>
  );
}
