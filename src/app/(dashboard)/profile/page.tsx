import type { Metadata } from "next";
import ProfilePage from "@/routes/profile";

export const metadata: Metadata = {
  title: "Principal Profile & Identity — KavachPay",
  description:
    "Manage principal identity and authentication settings with strict separation from autonomous agent financial authorities.",
};

export default function Page() {
  return <ProfilePage />;
}
