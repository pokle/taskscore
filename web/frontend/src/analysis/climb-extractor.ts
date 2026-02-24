/**
 * Climb (thermal) extraction utilities
 *
 * Extracts thermal/climb segments from flight events by pairing thermal_entry and thermal_exit events
 * and calculating performance metrics (altitude gain, climb rate).
 */

import { type FlightEvent } from '@taskscore/analysis';

/**
 * Combined climb/thermal data from entry and exit events
 */
export interface ClimbData {
  id: string;
  startTime: Date;
  endTime: Date;
  startAltitude: number;
  endAltitude: number;
  altitudeGain: number;
  duration: number;
  avgClimbRate: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  segment: { startIndex: number; endIndex: number };
  sourceEvent: FlightEvent;
}

/**
 * Type definition for climb event details
 */
interface ClimbEventDetails {
  avgClimbRate?: number;
  duration?: number;
  altitudeGain?: number;
}

/**
 * Finds the matching exit event for a thermal entry event
 */
function findClimbExit(
  entryEvent: FlightEvent,
  events: FlightEvent[]
): FlightEvent | undefined {
  return events.find(
    e =>
      e.type === 'thermal_exit' &&
      e.segment?.startIndex === entryEvent.segment?.startIndex &&
      e.segment?.endIndex === entryEvent.segment?.endIndex
  );
}

/**
 * Extracts and combines thermal entry/exit events into structured climb data
 * Climbs are sorted by altitude gain (strongest first)
 *
 * @param events - All flight events
 * @returns Array of climb data sorted by altitude gain descending
 */
export function extractClimbs(events: FlightEvent[]): ClimbData[] {
  const climbs: ClimbData[] = [];

  for (const event of events) {
    if (event.type === 'thermal_entry' && event.segment && event.details) {
      const details = event.details as ClimbEventDetails;
      const exitEvent = findClimbExit(event, events);

      if (exitEvent) {
        climbs.push({
          id: event.id,
          startTime: event.time,
          endTime: exitEvent.time,
          startAltitude: event.altitude,
          endAltitude: exitEvent.altitude,
          altitudeGain: details.altitudeGain || exitEvent.altitude - event.altitude,
          duration: details.duration || 0,
          avgClimbRate: details.avgClimbRate || 0,
          startLat: event.latitude,
          startLon: event.longitude,
          endLat: exitEvent.latitude,
          endLon: exitEvent.longitude,
          segment: event.segment,
          sourceEvent: event,
        });
      }
    }
  }

  // Sort by altitude gain (strongest first) - best thermals first
  climbs.sort((a, b) => b.altitudeGain - a.altitudeGain);
  return climbs;
}
