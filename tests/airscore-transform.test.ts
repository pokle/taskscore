import { describe, it, expect } from 'vitest';
import {
    transformWaypoint,
    transformTask,
    extractTaskMeta,
    parsePilots,
    transformAirScoreResponse,
} from '../workers/airscore/src/transform';
import type { AirScoreWaypoint, AirScoreApiResponse } from '../workers/airscore/src/types';

describe('AirScore Transform', () => {
    describe('transformWaypoint', () => {
        it('should transform a regular waypoint', () => {
            const wp: AirScoreWaypoint = {
                tawPk: '12744',
                tasPk: '2030',
                rwpPk: '32229',
                tawNumber: '3',
                tawTime: '0',
                tawType: 'waypoint',
                tawHow: 'entry',
                tawShape: 'circle',
                tawAngle: null,
                tawRadius: '1500',
                ssrLatDecimal: '-36.2530330256284',
                ssrLongDecimal: '147.948058127915',
                ssrNumber: '3',
                ssrCumulativeDist: '7888.74651484108',
                regPk: '700',
                rwpName: 'KANGCK',
                rwpLatDecimal: '-36.2641',
                rwpLongDecimal: '147.938467',
                rwpAltitude: '375',
                rwpDescription: 'KANGCK',
            };

            const result = transformWaypoint(wp);

            expect(result.type).toBeUndefined();
            expect(result.radius).toBe(1500);
            expect(result.waypoint.name).toBe('KANGCK');
            expect(result.waypoint.lat).toBeCloseTo(-36.2641, 4);
            expect(result.waypoint.lon).toBeCloseTo(147.938467, 4);
            expect(result.waypoint.altSmoothed).toBe(375);
        });

        it('should transform a speed section start (SSS)', () => {
            const wp: AirScoreWaypoint = {
                tawPk: '12743',
                tasPk: '2030',
                rwpPk: '32219',
                tawNumber: '2',
                tawTime: '0',
                tawType: 'speed',
                tawHow: 'exit',
                tawShape: 'circle',
                tawAngle: null,
                tawRadius: '3000',
                ssrLatDecimal: '-36.2114055333463',
                ssrLongDecimal: '147.965868232007',
                ssrNumber: '2',
                ssrCumulativeDist: '3000',
                regPk: '700',
                rwpName: 'ELLIOT',
                rwpLatDecimal: '-36.185833',
                rwpLongDecimal: '147.976667',
                rwpAltitude: '935',
                rwpDescription: 'ELLIOT',
            };

            const result = transformWaypoint(wp);

            expect(result.type).toBe('SSS');
            expect(result.radius).toBe(3000);
        });

        it('should transform an end speed section (ESS)', () => {
            const wp: AirScoreWaypoint = {
                tawPk: '12749',
                tasPk: '2030',
                rwpPk: '32230',
                tawNumber: '8',
                tawTime: '0',
                tawType: 'endspeed',
                tawHow: 'entry',
                tawShape: 'circle',
                tawAngle: null,
                tawRadius: '1000',
                ssrLatDecimal: '-36.2158940514196',
                ssrLongDecimal: '148.098668493916',
                ssrNumber: '8',
                ssrCumulativeDist: '80470.7461900853',
                regPk: '700',
                rwpName: 'KHANCO',
                rwpLatDecimal: '-36.216217',
                rwpLongDecimal: '148.109783',
                rwpAltitude: '289',
                rwpDescription: 'KHANCO',
            };

            const result = transformWaypoint(wp);

            expect(result.type).toBe('ESS');
            expect(result.radius).toBe(1000);
        });

        it('should handle goal waypoint (no special type)', () => {
            const wp: AirScoreWaypoint = {
                tawPk: '12750',
                tasPk: '2030',
                rwpPk: '32230',
                tawNumber: '9',
                tawTime: '0',
                tawType: 'goal',
                tawHow: 'entry',
                tawShape: 'circle',
                tawAngle: null,
                tawRadius: '1000',
                ssrLatDecimal: '-36.2158940599855',
                ssrLongDecimal: '148.098668788719',
                ssrNumber: '9',
                ssrCumulativeDist: '80470.7461900853',
                regPk: '700',
                rwpName: 'KHANCO',
                rwpLatDecimal: '-36.216217',
                rwpLongDecimal: '148.109783',
                rwpAltitude: '289',
                rwpDescription: 'KHANCO',
            };

            const result = transformWaypoint(wp);

            // 'goal' maps to undefined, not ESS (ESS is specifically 'endspeed')
            expect(result.type).toBeUndefined();
        });
    });

    describe('parsePilots', () => {
        it('should parse pilot data from AirScore format', () => {
            const data: (string | number | null)[][] = [
                [
                    '<b>1</b>',
                    '199463',
                    '<a href="tracklog_map.html?trackid=43826&comPk=466&tasPk=2030">Rory Duncan</a>',
                    'AUS',
                    'Airborne REV 13.5',
                    'C',
                    '15:00:00',
                    '16:52:18',
                    '1:52:18',
                    '',
                    80.47,
                    0,
                    0,
                    140.6,
                    859.4,
                    '',
                    1000,
                ],
            ];

            const pilots = parsePilots(data);

            expect(pilots).toHaveLength(1);
            expect(pilots[0].rank).toBe(1);
            expect(pilots[0].pilotId).toBe('199463');
            expect(pilots[0].name).toBe('Rory Duncan');
            expect(pilots[0].trackId).toBe('43826');
            expect(pilots[0].country).toBe('AUS');
            expect(pilots[0].glider).toBe('Airborne REV 13.5');
            expect(pilots[0].startTime).toBe('15:00:00');
            expect(pilots[0].finishTime).toBe('16:52:18');
            expect(pilots[0].flightTime).toBe('1:52:18');
            expect(pilots[0].distance).toBe(80.47);
            expect(pilots[0].speedPoints).toBe(140.6);
            expect(pilots[0].distancePoints).toBe(859.4);
            expect(pilots[0].total).toBe(1000);
        });

        it('should handle pilot without finish time', () => {
            const data: (string | number | null)[][] = [
                [
                    '<b>2</b>',
                    '199472',
                    '<a href="tracklog_map.html?trackid=43840&comPk=466&tasPk=2030">Jon Durand</a>',
                    'AUS',
                    'Moyes RX 5 Pro 2025',
                    'C',
                    '',
                    '',
                    '',
                    '',
                    68.06,
                    0,
                    0,
                    0,
                    782.4,
                    '',
                    782,
                ],
            ];

            const pilots = parsePilots(data);

            expect(pilots[0].rank).toBe(2);
            expect(pilots[0].name).toBe('Jon Durand');
            expect(pilots[0].startTime).toBeNull();
            expect(pilots[0].finishTime).toBeNull();
            expect(pilots[0].distance).toBe(68.06);
        });
    });

    describe('extractTaskMeta', () => {
        it('should extract task metadata', () => {
            const task = {
                comp_name: 'Corryong Cup 2026 Open',
                comp_class: 'HG',
                task_name: 'T3',
                date: '2026-01-07',
                task_type: 'SPEEDRUN-INTERVAL',
                class: '',
                start: '14:00:00',
                end: '23:00:00',
                stopped: false,
                wp_dist: 106.14,
                task_dist: 80.47,
                quality: '1.000',
                dist_quality: '1.000',
                time_quality: '1.000',
                launch_quality: '1.000',
                stop_quality: '1.000',
                comment: 'xcontest face',
                offset: 39600,
                hbess: 'off',
                waypoints: [],
                safety: 1.025,
                conditions: 6.962962962962963,
            };

            const meta = extractTaskMeta(task);

            expect(meta.compName).toBe('Corryong Cup 2026 Open');
            expect(meta.taskName).toBe('T3');
            expect(meta.date).toBe('2026-01-07');
            expect(meta.taskType).toBe('SPEEDRUN-INTERVAL');
            expect(meta.start).toBe('14:00:00');
            expect(meta.end).toBe('23:00:00');
            expect(meta.wpDist).toBe(106.14);
            expect(meta.taskDist).toBe(80.47);
            expect(meta.quality).toBe(1);
        });
    });

    describe('transformTask', () => {
        it('should transform task with exit SSS direction', () => {
            const airscoreTask = {
                comp_name: 'Test Comp',
                comp_class: 'HG',
                task_name: 'T1',
                date: '2026-01-01',
                task_type: 'SPEEDRUN',
                class: '',
                start: '12:00:00',
                end: '18:00:00',
                stopped: false,
                wp_dist: 50,
                task_dist: 45,
                quality: '1.000',
                dist_quality: '1.000',
                time_quality: '1.000',
                launch_quality: '1.000',
                stop_quality: '1.000',
                comment: '',
                offset: 0,
                hbess: 'off',
                safety: 1,
                conditions: 5,
                waypoints: [
                    {
                        tawPk: '1',
                        tasPk: '100',
                        rwpPk: '1000',
                        tawNumber: '1',
                        tawTime: '0',
                        tawType: 'start' as const,
                        tawHow: 'exit' as const,
                        tawShape: 'circle' as const,
                        tawAngle: null,
                        tawRadius: '400',
                        ssrLatDecimal: '-36.0',
                        ssrLongDecimal: '148.0',
                        ssrNumber: '1',
                        ssrCumulativeDist: '0',
                        regPk: '1',
                        rwpName: 'START',
                        rwpLatDecimal: '-36.0',
                        rwpLongDecimal: '148.0',
                        rwpAltitude: '500',
                        rwpDescription: 'Start point',
                    },
                    {
                        tawPk: '2',
                        tasPk: '100',
                        rwpPk: '1001',
                        tawNumber: '2',
                        tawTime: '0',
                        tawType: 'speed' as const,
                        tawHow: 'exit' as const,
                        tawShape: 'circle' as const,
                        tawAngle: null,
                        tawRadius: '3000',
                        ssrLatDecimal: '-36.1',
                        ssrLongDecimal: '148.1',
                        ssrNumber: '2',
                        ssrCumulativeDist: '5000',
                        regPk: '1',
                        rwpName: 'SSS',
                        rwpLatDecimal: '-36.1',
                        rwpLongDecimal: '148.1',
                        rwpAltitude: '600',
                        rwpDescription: 'Speed section start',
                    },
                ],
            };

            const result = transformTask(airscoreTask);

            expect(result.taskType).toBe('CLASSIC');
            expect(result.version).toBe(1);
            expect(result.earthModel).toBe('WGS84');
            expect(result.turnpoints).toHaveLength(2);
            expect(result.sss?.type).toBe('RACE');
            expect(result.sss?.direction).toBe('EXIT');
            expect(result.goal?.type).toBe('CYLINDER');
        });
    });
});
