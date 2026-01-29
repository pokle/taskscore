/**
 * AirScore API Transformation Logic
 *
 * Transforms AirScore API responses into our XCTask format
 */

import type {
    AirScoreApiResponse,
    AirScoreWaypoint,
    AirScoreTaskResult,
    XCTask,
    Turnpoint,
    TaskMeta,
    AirScorePilot,
} from './types';

/**
 * Map AirScore tawType to XCTask turnpoint types
 *
 * AirScore uses:
 * - 'start': First waypoint (may or may not be speed section start)
 * - 'speed': Speed section start (SSS)
 * - 'waypoint': Intermediate turnpoint
 * - 'endspeed': End of speed section (ESS)
 * - 'goal': Final goal
 */
function mapTawType(tawType: string): 'SSS' | 'ESS' | undefined {
    switch (tawType) {
        case 'speed':
            return 'SSS';
        case 'endspeed':
            return 'ESS';
        default:
            return undefined;
    }
}

/**
 * Transform a single AirScore waypoint to our Turnpoint format
 *
 * AirScore provides two sets of coordinates:
 * - ssrLatDecimal/ssrLongDecimal: Optimized SSR (Shortest Straight Route) point
 * - rwpLatDecimal/rwpLongDecimal: Original waypoint center
 *
 * We use the rwp (raw waypoint) coordinates as the cylinder center,
 * which matches how the task is displayed in scoring systems.
 */
export function transformWaypoint(wp: AirScoreWaypoint): Turnpoint {
    return {
        type: mapTawType(wp.tawType),
        radius: parseInt(wp.tawRadius, 10),
        waypoint: {
            name: wp.rwpName,
            description: wp.rwpDescription,
            lat: parseFloat(wp.rwpLatDecimal),
            lon: parseFloat(wp.rwpLongDecimal),
            altSmoothed: parseInt(wp.rwpAltitude, 10) || undefined,
        },
    };
}

/**
 * Transform AirScore task to XCTask format
 */
export function transformTask(airscoreTask: AirScoreApiResponse['task']): XCTask {
    const turnpoints = airscoreTask.waypoints.map(transformWaypoint);

    // Determine SSS direction from the start waypoint's tawHow
    const startWp = airscoreTask.waypoints.find(wp => wp.tawType === 'speed');
    const sssDirection = startWp?.tawHow === 'entry' ? 'ENTER' : 'EXIT';

    return {
        taskType: 'CLASSIC',
        version: 1,
        earthModel: 'WGS84',
        turnpoints,
        sss: {
            type: 'RACE',
            direction: sssDirection,
            timeGates: airscoreTask.start ? [airscoreTask.start] : undefined,
        },
        goal: {
            type: 'CYLINDER',
            deadline: airscoreTask.end || undefined,
        },
    };
}

/**
 * Extract task metadata from AirScore response
 */
export function extractTaskMeta(airscoreTask: AirScoreApiResponse['task']): TaskMeta {
    return {
        compName: airscoreTask.comp_name,
        taskName: airscoreTask.task_name,
        date: airscoreTask.date,
        taskType: airscoreTask.task_type,
        start: airscoreTask.start,
        end: airscoreTask.end,
        wpDist: airscoreTask.wp_dist,
        taskDist: airscoreTask.task_dist,
        quality: parseFloat(airscoreTask.quality),
    };
}

/**
 * Extract track ID from AirScore pilot name HTML
 *
 * AirScore returns pilot names as HTML links like:
 * <a href="tracklog_map.html?trackid=43826&comPk=466&tasPk=2030">Rory Duncan</a>
 */
function extractTrackId(nameHtml: string): { name: string; trackId: string | null } {
    const trackIdMatch = nameHtml.match(/trackid=(\d+)/);
    const nameMatch = nameHtml.match(/>([^<]+)</);

    return {
        name: nameMatch ? nameMatch[1] : nameHtml.replace(/<[^>]+>/g, ''),
        trackId: trackIdMatch ? trackIdMatch[1] : null,
    };
}

/**
 * Extract rank number from AirScore rank HTML
 *
 * AirScore returns rank as HTML like: <b>1</b>
 */
function extractRank(rankHtml: string | number): number {
    if (typeof rankHtml === 'number') return rankHtml;
    const match = rankHtml.match(/>(\d+)</);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse pilot results from AirScore data array
 *
 * Each row in the data array contains:
 * [0] rank (HTML with <b> tags)
 * [1] pilot_id
 * [2] name (HTML with link containing trackid)
 * [3] country
 * [4] glider
 * [5] class
 * [6] start_time (or empty string)
 * [7] finish_time (or empty string)
 * [8] flight_time (or empty string)
 * [9] penalty or empty
 * [10] distance (km)
 * [11] leading_points
 * [12] arrival_points
 * [13] speed_points
 * [14] distance_points
 * [15] penalty (string or empty)
 * [16] total
 */
export function parsePilots(data: (string | number | null)[][]): AirScorePilot[] {
    return data.map(row => {
        const { name, trackId } = extractTrackId(String(row[2] ?? ''));

        return {
            rank: extractRank(row[0] ?? 0),
            pilotId: String(row[1] ?? ''),
            name,
            country: String(row[3] ?? ''),
            glider: String(row[4] ?? ''),
            trackId,
            startTime: row[6] ? String(row[6]) : null,
            finishTime: row[7] ? String(row[7]) : null,
            flightTime: row[8] ? String(row[8]) : null,
            distance: typeof row[10] === 'number' ? row[10] : parseFloat(String(row[10])) || 0,
            leadingPoints: typeof row[11] === 'number' ? row[11] : parseFloat(String(row[11])) || 0,
            arrivalPoints: typeof row[12] === 'number' ? row[12] : parseFloat(String(row[12])) || 0,
            speedPoints: typeof row[13] === 'number' ? row[13] : parseFloat(String(row[13])) || 0,
            distancePoints: typeof row[14] === 'number' ? row[14] : parseFloat(String(row[14])) || 0,
            penalty: String(row[15] ?? ''),
            total: typeof row[16] === 'number' ? row[16] : parseFloat(String(row[16])) || 0,
        };
    });
}

/**
 * Transform complete AirScore API response to our format
 */
export function transformAirScoreResponse(response: AirScoreApiResponse): AirScoreTaskResult {
    return {
        task: transformTask(response.task),
        taskMeta: extractTaskMeta(response.task),
        pilots: parsePilots(response.data),
    };
}
