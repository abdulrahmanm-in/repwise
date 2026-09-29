// src/app/terms/page.tsx
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Terms and Conditions | Repwise",
  description: "Terms and conditions for using the Repwise workout tracker.",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-zinc-300 space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2 text-white font-bold text-lg">
          <FileText className="w-5 h-5 text-white" />
          <h1>Terms and Conditions</h1>
        </div>
      </div>

      <p className="text-xs text-zinc-500 font-mono">Last updated: September 2026</p>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">1. Agreement to Terms</h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          By accessing and using Repwise, you agree to these Terms and Conditions. Repwise is provided as a fitness logging tool for individual informational and tracking purposes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">2. Fitness & Health Disclaimer</h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          Repwise is not a certified medical or clinical diagnostic tool. Exercise routines, weight progression, and estimated one-rep maximums (1RM) are mathematical estimations. Always consult with a qualified physician or health professional before starting any intensive weight training routine.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">3. Service Availability & Backups</h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          Repwise works offline-first. While automated sync tools connect with Google Drive AppData, users are encouraged to maintain regular JSON backups using the export feature in Settings. The app is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis.
        </p>
      </section>
    </div>
  );
}