/**
 * Internet connection state, for the "No internet connection" / "Back online" banner and the
 * players' recovery (user request 2026-11-03). expo-network: on Android "reachable" means the
 * active network has the INTERNET and VALIDATED capabilities (the system confirmed real access).
 */
import * as Network from 'expo-network';
import { create } from 'zustand';

interface NetworkStore {
  online: boolean;
  /** When the connection last came back after a loss (shows "Back online"); 0 = never. */
  backOnlineAt: number;
}

export const useNetworkStore = create<NetworkStore>(() => ({ online: true, backOnlineAt: 0 }));

// A loss must last this long before it counts (Wi-Fi roaming, a switch to mobile data).
const OFFLINE_DEBOUNCE_MS = 1500;

const listeners = new Set<(online: boolean) => void>();
let offlineTimer: ReturnType<typeof setTimeout> | null = null;

/** Called with every confirmed change (offline after the debounce, online at once). */
export function onConnectivityChange(fn: (online: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function publish(online: boolean): void {
  if (useNetworkStore.getState().online === online) return;
  useNetworkStore.setState(online ? { online, backOnlineAt: Date.now() } : { online });
  listeners.forEach((fn) => fn(online));
}

function apply(state: Network.NetworkState): void {
  // Unknown (undefined) counts as online: only a definite "no" shows the banner.
  const online = state.isConnected !== false && state.isInternetReachable !== false;
  if (online) {
    if (offlineTimer) clearTimeout(offlineTimer);
    offlineTimer = null;
    publish(true);
  } else if (!offlineTimer && useNetworkStore.getState().online) {
    offlineTimer = setTimeout(() => {
      offlineTimer = null;
      void Network.getNetworkStateAsync()
        .then((now) => {
          if (now.isConnected === false || now.isInternetReachable === false) publish(false);
        })
        .catch(() => {});
    }, OFFLINE_DEBOUNCE_MS);
  }
}

/** Re-reads the state (app back in the foreground: listeners don't run in the background). */
export function recheckNetwork(): void {
  Network.getNetworkStateAsync().then(apply).catch(() => {});
}

/** Starts watching; call once at app start. */
export function startNetworkWatch(): () => void {
  const sub = Network.addNetworkStateListener(apply);
  recheckNetwork();
  return () => {
    sub.remove();
    if (offlineTimer) clearTimeout(offlineTimer);
    offlineTimer = null;
  };
}
