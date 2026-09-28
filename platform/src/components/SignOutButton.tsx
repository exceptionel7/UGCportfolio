"use client";
import { signOut } from "next-auth/react";

export function SignOutButton({ className = "btn btn-ghost" }: { className?: string }) {
  return (
    <button className={className} onClick={() => signOut({ callbackUrl: "/" })}>
      Log out
    </button>
  );
}
