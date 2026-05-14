import * as turf from "@turf/turf";
import { loadAllGridFeatures, GridFeature } from "@/lib/mobile/grid";

export type MobileWalkPoint = {
  lat: number;
  lon: number;
  timestamp: number | string;
  accuracy?: number;
};

export type ProcessWalkInput = {
  points: MobileWalkPoint[];
  existingCapturedSquareIds: string[];
};

export type ProcessWalkResult = {
  newCapturedIds: string[];
  totalCaptured: number;
  distanceMeters: number;
  durationSeconds: number;
  routeGeojson: {
    type: "Feature";
    geometry: {
      type: "LineString";
      coordinates: number[][];
    };
    properties: {
      startedAt: string;
      endedAt: string;
    };
  };
};

const MIN_POINT_COUNT = 12;
const ROUTE_BUFFER_KILOMETERS = 0.003;

function toMillis(value: number | string) {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizePoint(point: MobileWalkPoint) {
  return {
    lat: Number(point.lat),
    lon: Number(point.lon),
    timestamp: toMillis(point.timestamp),
    accuracy: point.accuracy === undefined ? undefined : Number(point.accuracy),
  };
}

function getFeatureId(feature: GridFeature) {
  return typeof feature.id === "string" ? feature.id : String(feature.id ?? "");
}

function isUsablePoint(point: ReturnType<typeof normalizePoint>) {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Number.isFinite(point.timestamp) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lon >= -180 &&
    point.lon <= 180
  );
}

function featureBBox(feature: GridFeature) {
  if (!feature.geometry) return null;
  const bbox = turf.bbox(feature as never);
  if (bbox.some(value => !Number.isFinite(value))) return null;
  return bbox;
}

function intersectsBBox(a: number[], b: number[]) {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function summarizeDistanceMeters(points: MobileWalkPoint[]) {
  const normalized = points.map(normalizePoint).filter(isUsablePoint);
  let distanceKm = 0;

  for (let i = 1; i < normalized.length; i++) {
    const previous = normalized[i - 1];
    const current = normalized[i];
    distanceKm += turf.distance([previous.lon, previous.lat], [current.lon, current.lat], {
      units: "kilometers",
    });
  }

  return Math.round(distanceKm * 1000);
}

export async function processMobileWalk(input: ProcessWalkInput): Promise<ProcessWalkResult> {
  const points = input.points.map(normalizePoint).filter(isUsablePoint);

  if (points.length < MIN_POINT_COUNT) {
    throw new Error(`Walk must include at least ${MIN_POINT_COUNT} valid GPS points`);
  }

  points.sort((a, b) => a.timestamp - b.timestamp);

  const coordinates = points.map(point => [point.lon, point.lat]);
  const startedAt = new Date(points[0].timestamp).toISOString();
  const endedAt = new Date(points[points.length - 1].timestamp).toISOString();
  const durationSeconds = Math.max(0, Math.round((points[points.length - 1].timestamp - points[0].timestamp) / 1000));
  const routeGeojson = turf.lineString(coordinates, { startedAt, endedAt }) as ProcessWalkResult["routeGeojson"];
  const bufferedPath = turf.buffer(routeGeojson, ROUTE_BUFFER_KILOMETERS, { units: "kilometers" });

  if (!bufferedPath) {
    throw new Error("Could not buffer walk route");
  }

  const pathBBox = turf.bbox(bufferedPath);
  const capturedSet = new Set(input.existingCapturedSquareIds.map(String));
  const newCapturedIds: string[] = [];
  const gridFeatures = await loadAllGridFeatures();

  for (const cell of gridFeatures) {
    const cellId = getFeatureId(cell);
    if (!cellId || capturedSet.has(cellId)) continue;

    const cellBBox = featureBBox(cell);
    if (!cellBBox || !intersectsBBox(pathBBox, cellBBox)) continue;

    if (turf.booleanIntersects(cell as never, bufferedPath as never)) {
      capturedSet.add(cellId);
      newCapturedIds.push(cellId);
    }
  }

  return {
    newCapturedIds,
    totalCaptured: capturedSet.size,
    distanceMeters: summarizeDistanceMeters(points),
    durationSeconds,
    routeGeojson,
  };
}
