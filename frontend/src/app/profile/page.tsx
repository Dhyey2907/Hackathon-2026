import type { Metadata } from "next";
import ProfileForm from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Profile", description: "Manage your BIS Sahayak profile." };

export default function ProfilePage() {
  return <ProfileForm />;
}
