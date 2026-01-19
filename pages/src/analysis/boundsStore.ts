/**
 * Bounds Store
 *
 * A simple pub/sub store for map bounds that lives outside React.
 * This allows map components to update bounds without triggering re-renders,
 * while still allowing other components (like EventPanel) to subscribe to changes.
 */

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

type BoundsListener = (bounds: MapBounds | null) => void;

let currentBounds: MapBounds | null = null;
const listeners = new Set<BoundsListener>();

/**
 * Get current bounds (synchronous read)
 */
export function getBounds(): MapBounds | null {
  return currentBounds;
}

/**
 * Set bounds and notify all listeners
 */
export function setBounds(bounds: MapBounds | null): void {
  currentBounds = bounds;
  listeners.forEach(listener => listener(bounds));
}

/**
 * Subscribe to bounds changes
 * Returns an unsubscribe function
 */
export function subscribeToBounds(listener: BoundsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
