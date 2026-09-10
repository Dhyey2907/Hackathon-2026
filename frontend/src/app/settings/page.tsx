import type { Metadata } from "next";
import SettingsForm from "@/components/settings/SettingsForm";

export const metadata: Metadata = { title: "Settings", description: "Manage BIS Sahayak preferences." };

export default function SettingsPage() {
  return <SettingsForm />;
}
