import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AppSessionData } from "@/lib/session";
import { getSessionOptions } from "@/lib/session";
import { getAppHomeUrl } from "@/lib/spotify-config";

export async function POST() {
  const session = await getIronSession<AppSessionData>(
    await cookies(),
    getSessionOptions(),
  );
  session.destroy();
  return NextResponse.redirect(getAppHomeUrl());
}

export async function GET() {
  return POST();
}
