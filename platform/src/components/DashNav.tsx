"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashNav({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {links.map((l) => {
        const active = pathname === l.href || (l.href !== "/dashboard" && pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-2 rounded-xl text-sm transition ${active ? "text-white bg-white/5" : "text-zinc-400 hover:text-white"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
