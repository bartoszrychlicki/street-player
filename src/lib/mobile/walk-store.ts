import { randomUUID } from "node:crypto";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MobileWalkPoint, processMobileWalk, summarizeDistanceMeters } from "@/lib/mobile/walk-processing";

export type MobileWalkUpload = {
  clientWalkId?: string;
  startedAt?: string;
  endedAt?: string;
  points: MobileWalkPoint[];
  tentativeCapturedSquareIds?: string[];
  device?: {
    platform?: string;
    appVersion?: string;
    buildNumber?: string;
    model?: string;
    systemVersion?: string;
  };
};

const POINT_CHUNK_SIZE = 500;

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeWalkId(value: unknown) {
  if (typeof value !== "string") return randomUUID();
  const clean = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
  return clean || randomUUID();
}

function chunkPoints(points: MobileWalkPoint[]) {
  const chunks: MobileWalkPoint[][] = [];
  for (let index = 0; index < points.length; index += POINT_CHUNK_SIZE) {
    chunks.push(points.slice(index, index + POINT_CHUNK_SIZE));
  }
  return chunks;
}

export async function listMobileWalks(uid: string) {
  const db = getAdminDb();
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("walks")
    .orderBy("endedAt", "desc")
    .limit(50)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), points: undefined }));
}

export async function getMobileWalk(uid: string, walkId: string) {
  const db = getAdminDb();
  const walkRef = db.collection("users").doc(uid).collection("walks").doc(walkId);
  const walkDoc = await walkRef.get();

  if (!walkDoc.exists) return null;

  const chunksSnapshot = await walkRef.collection("point_chunks").orderBy(FieldPath.documentId()).get();
  const points = chunksSnapshot.docs.flatMap(doc => {
    const value = doc.data().points;
    return Array.isArray(value) ? value : [];
  });

  return {
    id: walkDoc.id,
    ...walkDoc.data(),
    points,
  };
}

export async function saveMobileWalk(uid: string, email: string | undefined, upload: MobileWalkUpload) {
  if (!Array.isArray(upload.points)) {
    throw new Error("points must be an array");
  }

  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  const userData = userDoc.data() ?? {};
  const existingCapturedSquareIds = asStringArray(userData.capturedSquares);
  const walkId = normalizeWalkId(upload.clientWalkId);
  const walkRef = userRef.collection("walks").doc(walkId);
  const existingWalk = await walkRef.get();

  if (existingWalk.exists) {
    return {
      idempotent: true,
      walk: { id: existingWalk.id, ...existingWalk.data(), points: undefined },
    };
  }

  const processed = await processMobileWalk({
    points: upload.points,
    existingCapturedSquareIds,
  });

  const confirmedCapturedSet = new Set(existingCapturedSquareIds);
  processed.newCapturedIds.forEach(id => confirmedCapturedSet.add(id));

  const tentativeCount = asStringArray(upload.tentativeCapturedSquareIds).length;
  const now = Timestamp.now();
  const chunks = chunkPoints(upload.points);
  const summary = {
    clientWalkId: walkId,
    source: "ios",
    status: "confirmed",
    startedAt: upload.startedAt ?? processed.routeGeojson.properties.startedAt,
    endedAt: upload.endedAt ?? processed.routeGeojson.properties.endedAt,
    durationSeconds: processed.durationSeconds,
    distanceMeters: processed.distanceMeters || summarizeDistanceMeters(upload.points),
    pointCount: upload.points.length,
    routeStorage: {
      chunkSize: POINT_CHUNK_SIZE,
      chunkCount: chunks.length,
    },
    tentativeCapturedCount: tentativeCount,
    newCapturedCount: processed.newCapturedIds.length,
    totalCaptured: processed.totalCaptured,
    correction: processed.newCapturedIds.length - tentativeCount,
    capturedSquareIds: processed.newCapturedIds,
    device: upload.device ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const batch = db.batch();
  batch.set(userRef, {
    email: email ?? userData.email ?? null,
    capturedSquares: Array.from(confirmedCapturedSet),
    updatedAt: now,
    createdAt: userData.createdAt ?? new Date().toISOString(),
  }, { merge: true });
  batch.set(walkRef, summary);

  chunks.forEach((points, index) => {
    const chunkId = String(index).padStart(4, "0");
    batch.set(walkRef.collection("point_chunks").doc(chunkId), {
      index,
      points,
      createdAt: now,
    });
  });

  await batch.commit();

  return {
    idempotent: false,
    walk: { id: walkId, ...summary, points: undefined },
    newCapturedIds: processed.newCapturedIds,
    totalCaptured: processed.totalCaptured,
  };
}
