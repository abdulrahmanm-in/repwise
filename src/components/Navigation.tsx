// src/components/Navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Dumbbell, TrendingUp, Settings } from "lucide-react";
import clsx from "clsx";

export default function Navigation() {
  const pathname = usePathname();

  const links = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Workouts", href: "/workouts", icon: Dumbbell },
    { label: "Progress", href: "/progress", icon: TrendingUp },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-t border-zinc-800">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {links.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive
                  ? "text-white font-semibold"
                  : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon className="w-5 h-5 stroke-[2]" />
              <span className="text-[10px] tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
