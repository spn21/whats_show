"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, X } from "lucide-react";
import { ZkAssetRaffleLogo } from "@/components/layout";
import { cn } from "@/utils/utils";

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: "/create", label: "Create" },
  { href: "/claim", label: "Claim" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-slate-200 bg-[#f8f6f2]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between text-slate-900">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="w-10 h-10 rounded-xl inline-flex items-center justify-center border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.06)]">
            <ZkAssetRaffleLogo className="w-7 h-7" />
          </span>
          <span className="text-lg font-semibold tracking-tight">zkAssetRaffle</span>
        </Link>

        {/* Right cluster: nav + wallet + menu */}
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-1 mr-2 rounded-xl border border-slate-200 bg-white px-2 py-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="relative">
                <span
                  className={cn(
                    "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-slate-900 text-white shadow-[0_1px_0_rgba(15,23,42,0.06)]"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
          <div className="hidden sm:flex">
            <RainbowConnectButton />
          </div>
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-[#f8f6f2]">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1 text-slate-900">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                <span
                  className={cn(
                    "block px-3 py-2 rounded-lg text-sm font-medium",
                    isActive(item.href)
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            ))}
            <div className="mt-3">
              <RainbowConnectButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
