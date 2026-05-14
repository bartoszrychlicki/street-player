import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { isAuthError, requireMobileUser } from "@/lib/mobile/auth";
import { DISTRICTS, GRID_VERSION, ROAD_TYPES, loadGridManifest } from "@/lib/mobile/grid";

export async function GET(req: NextRequest) {
  const authResult = await requireMobileUser(req);
  if (isAuthError(authResult)) return authResult;

  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(authResult.uid).get();
  const userData = userDoc.data() ?? {};
  const capturedSquares = Array.isArray(userData.capturedSquares)
    ? userData.capturedSquares.map(String)
    : [];
  const gridManifest = await loadGridManifest();

  return NextResponse.json({
    user: {
      uid: authResult.uid,
      email: authResult.email ?? userData.email ?? null,
      username: userData.username ?? null,
      capturedSquares,
      totalCaptured: capturedSquares.length,
    },
    grid: {
      version: GRID_VERSION,
      districts: gridManifest,
      totalFeatureCount: gridManifest.reduce((sum, district) => sum + district.featureCount, 0),
    },
    supportedDistricts: DISTRICTS.map(({ id, name }) => ({ id, name })),
    roadTypes: ROAD_TYPES,
    appConfig: {
      minimumPointCount: 12,
      routeBufferMeters: 3,
      gpsAccuracyCutoffMeters: 45,
      maximumLikelyWalkingSpeedMetersPerSecond: 12,
    },
  });
}
