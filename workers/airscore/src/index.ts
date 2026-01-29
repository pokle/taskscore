/**
 * AirScore Worker - Cloudflare Worker Entry Point
 *
 * Fetches task and track data from AirScore (xc.highcloud.net) and returns
 * it in a format compatible with the IGC Analysis tool.
 *
 * Endpoint: GET /airscore?comPk={compId}&tasPk={taskId}
 */

import { transformAirScoreResponse } from './transform';
import type { AirScoreApiResponse, AirScoreTaskResult } from './types';

export interface Env {
    AIRSCORE_CACHE: KVNamespace;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour
const AIRSCORE_API_BASE = 'https://xc.highcloud.net';

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        },
    });
}

/**
 * Create an error response
 */
function errorResponse(message: string, status = 400): Response {
    return jsonResponse({ error: message }, status);
}

/**
 * Fetch task result from AirScore API
 */
async function fetchFromAirScore(comPk: string, tasPk: string): Promise<AirScoreApiResponse> {
    const url = `${AIRSCORE_API_BASE}/get_task_result.php?comPk=${comPk}&tasPk=${tasPk}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'TaskScore/1.0',
            'Accept': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`AirScore API returned ${response.status}`);
    }

    const data = await response.json();

    // Basic validation of response structure
    if (!data.task || !data.task.waypoints || !Array.isArray(data.data)) {
        throw new Error('Invalid response from AirScore API');
    }

    return data as AirScoreApiResponse;
}

/**
 * Main request handler
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    // Only handle /airscore endpoint
    if (url.pathname !== '/airscore') {
        return errorResponse('Not found', 404);
    }

    // Extract and validate parameters
    const comPk = url.searchParams.get('comPk');
    const tasPk = url.searchParams.get('tasPk');

    if (!comPk || !tasPk) {
        return errorResponse('Missing required parameters: comPk and tasPk');
    }

    // Validate parameters are numeric
    if (!/^\d+$/.test(comPk) || !/^\d+$/.test(tasPk)) {
        return errorResponse('Parameters comPk and tasPk must be numeric');
    }

    const cacheKey = `airscore:${comPk}:${tasPk}`;

    try {
        // Check cache first
        const cached = await env.AIRSCORE_CACHE.get(cacheKey);
        if (cached) {
            const result = JSON.parse(cached) as AirScoreTaskResult;
            return jsonResponse(result);
        }

        // Fetch from AirScore
        const airscoreResponse = await fetchFromAirScore(comPk, tasPk);

        // Transform to our format
        const result = transformAirScoreResponse(airscoreResponse);

        // Cache the result
        await env.AIRSCORE_CACHE.put(cacheKey, JSON.stringify(result), {
            expirationTtl: CACHE_TTL_SECONDS,
        });

        return jsonResponse(result);
    } catch (error) {
        console.error('Error fetching from AirScore:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return errorResponse(`Failed to fetch task: ${message}`, 502);
    }
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        return handleRequest(request, env);
    },
};
