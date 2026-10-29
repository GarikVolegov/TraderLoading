import { useEffect, useState, useCallback } from "react";
import {
  smartWatchManager,
  type SmartWatchHeartRateState,
  isWebBluetoothSupported,
} from "../lib/smartwatchBle";

export function useSmartWatchHeartRate() {
  const [state, setState] = useState<SmartWatchHeartRateState>(() =>
    smartWatchManager.getState()
  );

  useEffect(() => {
    return smartWatchManager.subscribe((next) => {
      setState(next);
    });
  }, []);

  const connectBleWatch = useCallback(async () => {
    return await smartWatchManager.connectBleDevice();
  }, []);

  const disconnectWatch = useCallback(() => {
    smartWatchManager.disconnect();
  }, []);

  const startSimulation = useCallback((targetBpm?: number) => {
    smartWatchManager.startSimulation(targetBpm);
  }, []);

  const stopSimulation = useCallback(() => {
    smartWatchManager.stopSimulation();
    smartWatchManager.disconnect();
  }, []);

  const setSimulationTargetBpm = useCallback((targetBpm: number) => {
    smartWatchManager.setSimulationTargetBpm(targetBpm);
  }, []);

  return {
    ...state,
    isWebBluetoothSupported: isWebBluetoothSupported(),
    isLive: state.status === "connected" || state.status === "simulated",
    isBleConnected: state.status === "connected",
    connectBleWatch,
    disconnectWatch,
    startSimulation,
    stopSimulation,
    setSimulationTargetBpm,
  };
}
