import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongoose";

// Liveness/readiness probe for load balancers and orchestrators (e.g. a
// Kubernetes readinessProbe or Docker Compose healthcheck). Reports actual
// MongoDB connectivity rather than just "the process is running".
export async function GET() {
  const startedAt = Date.now();

  try {
    await dbConnect();
    const dbState = mongoose.connection.readyState; // 1 = connected

    if (dbState !== 1) {
      return NextResponse.json(
        { status: "error", db: "disconnected", uptimeSeconds: process.uptime() },
        { status: 503 }
      );
    }

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
