import { NextRequest, NextResponse } from "next/server";
import { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth } from "@/lib/firebase-admin";

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  decodedToken: DecodedIdToken;
};

export async function requireMobileUser(req: NextRequest): Promise<AuthenticatedUser | NextResponse> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const idToken = authHeader.slice("Bearer ".length);
    const decodedToken = await getAdminAuth().verifyIdToken(idToken);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      decodedToken,
    };
  } catch (error) {
    console.error("Mobile auth failed:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export function isAuthError(value: AuthenticatedUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
