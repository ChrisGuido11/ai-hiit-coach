/// <reference types="vite/client" />

// Wake Lock API types
interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: "screen";
  release(): Promise<void>;
  onrelease: ((this: WakeLockSentinel, ev: Event) => void) | null;
}

interface WakeLock {
  request(type: "screen"): Promise<WakeLockSentinel>;
}

interface Navigator {
  wakeLock: WakeLock;
}
