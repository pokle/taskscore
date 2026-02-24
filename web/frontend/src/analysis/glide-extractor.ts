/**
 * Glide extraction utilities
 *
 * Extracts glide segments from flight events by pairing glide_start and glide_end events
 * and calculating performance metrics (distance, speed, glide ratio).
 */

import { type FlightEvent } from '@taskscore/analysis';

/**
 * Combined glide data from start and end events
 */
export interface GlideData {
  id: string;
  startTime: Date;
  endTime: Date;
  startAltitude: number;
  endAltitude: number;
  distance: number;
  duration: number;
  averageSpeed: number;
  glideRatio: number;
  altitudeLost: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  segment: { startIndex: number; endIndex: number };
  sourceEvent: FlightEvent;
}

/**
 * Type definition for glide event details
 */
interface GlideEventDetails {
  distance?: number;
  averageSpeed?: number;
  glideRatio?: number;
  duration?: number;
}

/**
 * Finds the matching end event for a glide start event
 */
function findGlideEnd(
  startEvent: FlightEvent,
  events: FlightEvent[]
): FlightEvent | undefined {
  return events.find(
    e =>
      e.type === 'glide_end' &&
      e.segment?.startIndex === startEvent.segment?.startIndex &&
      e.segment?.endIndex === startEvent.segment?.endIndex
  );
}

/**
 * Extracts and combines glide start/end events into structured glide data
 * Glides are sorted by distance (longest first)
 *
 * @param events - All flight events
 * @returns Array of glide data sorted by distance descending
 */
export function extractGlides(events: FlightEvent[]): GlideData[] {
  const glides: GlideData[] = [];

  for (const event of events) {
    if (event.type === 'glide_start' && event.segment && event.details) {
      const details = event.details as GlideEventDetails;
      const endEvent = findGlideEnd(event, events);

      if (endEvent) {
        glides.push({
          id: event.id,
          startTime: event.time,
          endTime: endEvent.time,
          startAltitude: event.altitude,
          endAltitude: endEvent.altitude,
          distance: details.distance || 0,
          duration: details.duration || 0,
          averageSpeed: details.averageSpeed || 0,
          glideRatio: details.glideRatio || 0,
          altitudeLost: event.altitude - endEvent.altitude,
          startLat: event.latitude,
          startLon: event.longitude,
          endLat: endEvent.latitude,
          endLon: endEvent.longitude,
          segment: event.segment,
          sourceEvent: event,
        });
      }
    }
  }

  // Sort by distance (longest first) - best glides first
  glides.sort((a, b) => b.distance - a.distance);
  return glides;
}
