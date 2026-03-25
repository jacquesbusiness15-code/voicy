import { create } from 'zustand';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  setStatus: (connected: boolean, reachable: boolean | null) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  setStatus: (connected, reachable) =>
    set({ isConnected: connected, isInternetReachable: reachable }),
}));
