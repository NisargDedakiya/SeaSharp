import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withApiHandler, AppError } from "@/lib/api-handler";
import { User } from "@/models";
import { runSupplierCheck } from "@/lib/supplierradar";
import { recalculateAndSaveSts } from "@/lib/sts-server";

export const POST = withApiHandler(async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AppError(401, "Sign in required.");
  }

  const user = await User.findById(session.user.id).orFail();
  const check = runSupplierCheck({
    companyName: user.companyName,
    country: user.country,
    phone: user.phone,
  });

  user.kycStatus = check.cleared ? "VERIFIED" : "PENDING";
  user.kycSubmittedAt = new Date();
  user.kycVerifiedAt = check.cleared ? new Date() : null;
  await user.save();

  if (user.role === "EXPORTER") {
    await recalculateAndSaveSts(user._id.toString());
  }

  return NextResponse.json({ kycStatus: user.kycStatus, flags: check.flags });
});
