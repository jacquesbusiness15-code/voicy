import { useNetworkStore } from '../stores/networkStore';

export function assertOnline(): void {
  const { isConnected, isInternetReachable } = useNetworkStore.getState();
  if (!isConnected || isInternetReachable === false) {
    throw new Error('No internet connection. Please check your network and try again.');
  }
}
