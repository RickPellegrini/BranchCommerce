import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { FinancialDashboard } from "@/components/finance/financial-dashboard";
import { isAdminEmail } from "@/lib/auth/admin";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const primaryEmail = user?.emailAddresses.find(
    (emailAddress) => emailAddress.id === user.primaryEmailAddressId,
  )?.emailAddress;

  if (!isAdminEmail(primaryEmail)) {
    redirect("/unauthorized");
  }

  return <FinancialDashboard />;
}
