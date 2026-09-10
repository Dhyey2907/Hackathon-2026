import type { Metadata } from "next";
import Onboarding from "@/components/auth/Onboarding";

export const metadata: Metadata = { title: "Welcome to BIS Sahayak" };

export default function OnboardingPage() {
  return <Onboarding />;
}