import { redirect } from "next/navigation";

// The cockpit lands on the CRM. The old dashboard was retired in the repurpose.
export default function Home() {
  redirect("/crm");
}
