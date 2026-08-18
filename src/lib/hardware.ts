export type HardwareSnapshot = {
  cpuThreads: number;
  deviceMemoryGb: number | null;
  gpuAvailable: boolean;
};

export function readHardware(): HardwareSnapshot {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    cpuThreads: navigator.hardwareConcurrency || 0,
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    gpuAvailable: false,
  };
}
