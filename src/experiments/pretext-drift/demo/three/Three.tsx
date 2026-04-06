import { Canvas } from "@react-three/fiber";
import { Color } from "three";
import { WebGPURenderer } from "three/webgpu";
import { ExperimentControlPanel } from "../../../../components/experiment-controls/ExperimentControls";
import { ControlRail } from "../dom/ControlRail";
import { TextOverlay } from "../dom/TextOverlay";
import { DemoProvider } from "../DemoProvider";
import { ThreeCamera } from "./ThreeCamera";
import { ThreeDemo } from "./ThreeDemo";
import { ThreeSetup } from "./ThreeSetup";

type WebGPURendererParameters = ConstructorParameters<typeof WebGPURenderer>[0];

export const Three = () => {
  return (
    <DemoProvider>
      <div className="grid h-full w-full flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative min-w-0 overflow-hidden">
          <div className="absolute inset-0">
            <Canvas
              className="h-full w-full touch-none"
              style={{ display: "block", width: "100%", height: "100%" }}
              gl={async (props) => {
                const renderer = new WebGPURenderer(
                  props as WebGPURendererParameters,
                );
                await renderer.init();
                renderer.setClearColor(new Color(0x000000), 1);
                return renderer;
              }}
              dpr={[1, 2]}
            >
              <color attach="background" args={["#000000"]} />
              <ThreeSetup />
              <ThreeCamera />
              <ThreeDemo />
            </Canvas>
          </div>
          <TextOverlay />
        </div>
        <ExperimentControlPanel className="in-[html.hide-controls]:hidden in-[html.hide-ui]:hidden">
          <ControlRail />
        </ExperimentControlPanel>
      </div>
    </DemoProvider>
  );
};
