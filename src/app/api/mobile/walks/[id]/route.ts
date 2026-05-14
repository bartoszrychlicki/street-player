import { NextRequest, NextResponse } from "next/server";
import { isAuthError, requireMobileUser } from "@/lib/mobile/auth";
import { getMobileWalk } from "@/lib/mobile/walk-store";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = await requireMobileUser(req);
  if (isAuthError(authResult)) return authResult;

  const { id } = await context.params;
  const walk = await getMobileWalk(authResult.uid, id);

  if (!walk) {
    return NextResponse.json({ error: "Walk not found" }, { status: 404 });
  }

  return NextResponse.json({ walk });
}
