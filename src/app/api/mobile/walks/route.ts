import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireMobileUser } from "@/lib/mobile/auth";
import { listMobileWalks, saveMobileWalk } from "@/lib/mobile/walk-store";

export async function GET(req: NextRequest) {
  const authResult = await requireMobileUser(req);
  if (isAuthError(authResult)) return authResult;

  const walks = await listMobileWalks(authResult.uid);
  return NextResponse.json({ walks });
}

export async function POST(req: NextRequest) {
  const authResult = await requireMobileUser(req);
  if (isAuthError(authResult)) return authResult;

  try {
    const upload = await req.json();
    const result = await saveMobileWalk(authResult.uid, authResult.email, upload);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Mobile walk upload failed:", error);
    const message = error instanceof Error ? error.message : "Invalid walk upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
