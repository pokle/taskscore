/**
 * Sink (descent) extraction utilities
 *
 * Extracts sink/descent segments from glide events that have poor glide ratios.
 * A sink is defined as a glide with a glide ratio worse than the configured threshold.
 */

import { type FlightEvent } from '@taskscore/analysis';

/**
 * Combined sink/descent data
 */
export interface SinkData {
  id: string;
  startTime: Date;
  endTime: Date;
  startAltitude: number;
  endAltitude: number;
  altitudeLost: number;
  distance: number;
  duration: number;
  averageSpeed: number;
  avgSinkRate: number;
  glideRatio: number;
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
 * Maximum glide ratio threshold to be classified as a sink
 * Glides with worse ratios than this are considered sinks (descending flights)
 */
const MAX_GLIDE_RATIO_FOR_SINK = 5;

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
 * Calculates average sink rate from altitude loss and duration
 */
function calculateSinkRate(altitudeLost: number, duration: number): number {
  return duration > 0 ? altitudeLost / duration : 0;
}

/**
 * Extracts poor-glide (sink) segments from glide events
 * Only includes glides with glide ratio exceeding MAX_GLIDE_RATIO_FOR_SINK
 * Sinks are sorted by altitude lost (steepest descents first)
 *
 * @param events - All flight events
 * @returns Array of sink data sorted by altitude lost descending
 */
export function extractSinks(events: FlightEvent[]): SinkData[] {
  const sinks: SinkData[] = [];

  for (const event of events) {
    if (event.type === 'glide_start' && event.segment && event.details) {
      const details = event.details as GlideEventDetails;
      const glideRatio = details.glideRatio || 0;

      // Skip good glides - only extract poor glides (sinks)
      if (glideRatio <= MAX_GLIDE_RATIO_FOR_SINK) {
        const endEvent = findGlideEnd(event, events);

        if (endEvent) {
          const altitudeLost = event.altitude - endEvent.altitude;
          const duration = details.duration || 0;
          const avgSinkRate = calculateSinkRate(altitudeLost, duration);

          sinks.push({
            id: event.id,
            startTime: event.time,
            endTime: endEvent.time,
            startAltitude: event.altitude,
            endAltitude: endEvent.altitude,
            altitudeLost: altitudeLost,
            distance: details.distance || 0,
            duration: duration,
            averageSpeed: details.averageSpeed || 0,
            avgSinkRate: avgSinkRate,
            glideRatio: glideRatio,
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
  }

  // Sort by altitude lost (steepest descents first) - worst sinks first
  sinks.sort((a, b) => b.altitudeLost - a.altitudeLost);
  return sinks;
}
