import type { Metadata } from "next";
import { MascotLab } from "./MascotLab";

export const metadata: Metadata = {
  title: "Nami mascot lab",
  description: "Developer gallery for the Nami SVG rig: every pose, state, mouth and lip-sync test.",
  robots: { index: false, follow: false },
};

export default function MascotLabPage() {
  return <MascotLab />;
}
