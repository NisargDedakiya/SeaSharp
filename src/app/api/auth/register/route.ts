import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { User } from "@/models";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["EXPORTER", "IMPORTER"]),
  companyName: z.string().optional(),
  country: z.string().optional(),
});

export const POST = withApiHandler(
  async (request: Request) => {
    const body = await request.json();
    const { name, email, password, role, companyName, country } = registerSchema.parse(body);

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new AppError(409, "An account with that email already exists.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      companyName,
      country,
    });

    return NextResponse.json(
      { id: user._id.toString(), email: user.email, role: user.role },
      { status: 201 }
    );
  },
  { rateLimit: { limit: 10, windowMs: 10 * 60_000 } }
);
