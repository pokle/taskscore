/**
 * AirScore API Types
 *
 * Type definitions for the AirScore API response from xc.highcloud.net
 */

/**
 * Waypoint from AirScore's task definition
 */
export interface AirScoreWaypoint {
    tawPk: string;
    tasPk: string;
    rwpPk: string;
    tawNumber: string;
    tawTime: string;
    tawType: 'start' | 'speed' | 'waypoint' | 'endspeed' | 'goal';
    tawHow: 'entry' | 'exit';
    tawShape: 'circle' | 'line';
    tawAngle: string | null;
    tawRadius: string;
    ssrLatDecimal: string;
    ssrLongDecimal: string;
    ssrNumber: string;
    ssrCumulativeDist: string;
    regPk: string;
    rwpName: string;
    rwpLatDecimal: string;
    rwpLongDecimal: string;
    rwpAltitude: string;
    rwpDescription: string;
}

/**
 * Task information from AirScore
 */
export interface AirScoreTask {
    comp_name: string;
    comp_class: string;
    task_name: string;
    date: string;
    task_type: string;
    class: string;
    start: string;
    end: string;
    stopped: boolean;
    wp_dist: number;
    task_dist: number;
    quality: string;
    dist_quality: string;
    time_quality: string;
    launch_quality: string;
    stop_quality: string;
    comment: string;
    offset: number;
    hbess: string;
    waypoints: AirScoreWaypoint[];
    safety: number;
    conditions: number;
}

/**
 * Formula configuration from AirScore
 */
export interface AirScoreFormula {
    formula: string;
    goal_penalty: string;
    nominal_goal: string;
    minimum_distance: string;
    nominal_distance: string;
    nominal_time: string;
    arrival_scoring: string;
    departure: string;
    stop_glide_bonus: string;
    start_weight: string;
    arrival_weight: string;
    speed_weight: string;
    scale_to_validity: string;
    error_margin: number;
    arrival: string;
    height_bonus: string;
}

/**
 * Metrics from AirScore
 */
export interface AirScoreMetrics {
    'day quality': string;
    dist_quality: string;
    time_quality: string;
    launch_quality: string;
    pilot_safety: number;
    pilot_quality: number;
}

/**
 * Raw API response from AirScore
 * The 'data' field is a 2D array where each row is a pilot's result
 */
export interface AirScoreApiResponse {
    task: AirScoreTask;
    formula: AirScoreFormula;
    metrics: AirScoreMetrics;
    data: (string | number | null)[][];
}

// ===== Output Types (Our format) =====

/**
 * Turnpoint in our XCTask format
 */
export interface Turnpoint {
    type?: 'TAKEOFF' | 'SSS' | 'ESS';
    radius: number;
    waypoint: {
        name: string;
        description?: string;
        lat: number;
        lon: number;
        altSmoothed?: number;
    };
}

/**
 * SSS (speed section start) configuration
 */
export interface SSSConfig {
    type: 'RACE' | 'ELAPSED-TIME';
    direction: 'ENTER' | 'EXIT';
    timeGates?: string[];
}

/**
 * Goal configuration
 */
export interface GoalConfig {
    type: 'CYLINDER' | 'LINE';
    deadline?: string;
}

/**
 * XCTask format compatible with our analysis tool
 */
export interface XCTask {
    taskType: string;
    version: number;
    earthModel?: 'WGS84' | 'FAI_SPHERE';
    turnpoints: Turnpoint[];
    takeoff?: {
        timeOpen?: string;
        timeClose?: string;
    };
    sss?: SSSConfig;
    goal?: GoalConfig;
}

/**
 * Task metadata from AirScore
 */
export interface TaskMeta {
    compName: string;
    taskName: string;
    date: string;
    taskType: string;
    start: string;
    end: string;
    wpDist: number;
    taskDist: number;
    quality: number;
}

/**
 * Parsed pilot result
 */
export interface AirScorePilot {
    rank: number;
    pilotId: string;
    name: string;
    country: string;
    glider: string;
    trackId: string | null;
    startTime: string | null;
    finishTime: string | null;
    flightTime: string | null;
    distance: number;
    leadingPoints: number;
    arrivalPoints: number;
    speedPoints: number;
    distancePoints: number;
    penalty: string;
    total: number;
}

/**
 * Final response from our worker
 */
export interface AirScoreTaskResult {
    task: XCTask;
    taskMeta: TaskMeta;
    pilots: AirScorePilot[];
}
