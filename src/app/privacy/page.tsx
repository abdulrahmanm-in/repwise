// src/app/privacy/page.tsx
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy | Repwise",
  description: "Repwise privacy policy and data storage handling.",
};

export default function PrivacyPolicyPage() {
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
          <ShieldCheck className="w-5 h-5 text-white" />
          <h1>Privacy Policy</h1>
        </div>
      </div>

      <p className="text-xs text-zinc-500 font-mono">Last updated: September 2026</p>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">1. Overview</h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          Repwise operates as a local-first Progressive Web App (PWA). Your personal workout logs, routines, and body metrics are stored directly on your device using IndexedDB. We do not operate external proprietary databases that collect, sell, or profile your personal workout data.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">2. Google Drive Data Access</h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          When you optionally connect your Google Account, Repwise requests access strictly to the restricted Google Drive AppData folder (<code className="text-zinc-200">drive.appdata</code> scope).
        </p>
        <ul className="text-xs list-disc list-inside space-y-1 text-zinc-400 pl-1">
          <li>Repwise only reads and writes its own encrypted or JSON-formatted backup file inside your private application data folder.</li>
          <li>Repwise cannot access, view, modify, or delete any files in your personal Google Drive or Google Workspace files.</li>
          <li>Authentication tokens are kept in your browser local storage and are never transmitted to any third-party analytics or external server.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">3. Local Data Retention & Control</h2>
        <p className="text-xs leading-relaxed text-zinc-400">
          You retain full ownership of all data. You can delete your logs at any time by clearing your browser data, disconnecting your Google Account from the Settings tab, or removing Repwise from Google Drive settings under &quot;Manage Apps&quot;.
        </p>
      </section>
    </div>
  );
}