import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { serviceDb } from "@/db/client";

// Liveness/readiness probe for load balancers and orchestrators (e.g. a
// Kubernetes readinessProbe or Docker Compose healthcheck). Reports actual
// Postgres connectivity rather than just "the process is running".
export async function GET() {
  const startedAt = Date.now();

  try {
    await serviceDb.execute(sql`select 1`);

    return NextResponse.json({
      status: "ok",
      db: "connected",
      checkedInMs: Date.now() - startedAt,
      uptimeSeconds: process.uptime(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", db: "unreachable", uptimeSeconds: process.uptime() },
      { status: 503 }
    );
  }
}
