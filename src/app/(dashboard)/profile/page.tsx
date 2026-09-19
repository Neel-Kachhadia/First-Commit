import type { Metadata } from "next";
import ProfilePage from "@/routes/profile";

export const metadata: Metadata = {
  title: "Your Account — KavachPay",
  description: "View your signed-in account and manage the local demo principal.",
};

export default function Page() {
  return <ProfilePage />;
}
