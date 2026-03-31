"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";
import { AppContext } from "./context";

interface Profile {
  first_name: string;
  last_name: string;
  organization_id: string;
}

interface Organization {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

const navLinks = [
  {
    href: "/app",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    href: "/app/prospects",
    label: "Prospects",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228A2.25 2.25 0 013 16.878V15.12a9.001 9.001 0 0112-8.456M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0112.75 0v.109zM12 9.75a3 3 0 10-6 0 3 3 0 006 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: "/app/devis",
    label: "Devis",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: "/app/tarifs",
    label: "Tarifs",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const isLoginPage = pathname === "/app/login";

  useEffect(() => {
    if (isLoginPage) {
      setAuthChecked(true);
      return;
    }

    async function checkAuthAndLoadData() {
      if (!supabaseBrowser) {
        setAuthChecked(true);
        return;
      }

      // Check session
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        window.location.href = "/app/login";
        return;
      }

      const authHeader = { Authorization: `Bearer ${session.access_token}` };

      // Fetch profile + companies in parallel via API (bypasses RLS)
      const [profileRes, companiesRes] = await Promise.all([
        fetch("/api/profile", { headers: authHeader }).catch(() => null),
        fetch("/api/companies", { headers: authHeader }).catch(() => null),
      ]);

      // Handle profile
      if (profileRes && profileRes.ok) {
        const profileJson = await profileRes.json();
        if (profileJson.profile) {
          setProfile(profileJson.profile);
          if (profileJson.organization) {
            setOrganization(profileJson.organization);
          }
        }
      }

      // Handle companies
      if (companiesRes && companiesRes.ok) {
        const compJson = await companiesRes.json();
        const companiesData = compJson.companies ?? [];
        if (companiesData.length > 0) {
          setCompanies(companiesData);
        }
      }

      setAuthChecked(true);
    }

    checkAuthAndLoadData();
  }, [isLoginPage]);

  async function handleLogout() {
    if (supabaseBrowser) {
      await supabaseBrowser.auth.signOut();
    }
    window.location.href = "/app/login";
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#1B2A4A] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-6 h-16 flex items-center border-b border-white/10">
          <img
            src="/netvapeur-logo.webp"
            alt={organization?.name ?? "NetVapeur"}
            className="h-7 object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User & logout */}
        <div className="px-4 py-4 border-t border-white/10">
          {profile && (
            <div className="text-white/60 text-xs mb-3 px-2 truncate">
              {profile.first_name} {profile.last_name}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#F5F7FA]">
        {/* Mobile header */}
        <header className="lg:hidden h-14 bg-white border-b border-gray-200 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          </button>
          <img
            src="/netvapeur-logo.webp"
            alt="NetVapeur"
            className="ml-3 h-6 object-contain"
          />
        </header>

        <main className="flex-1 p-6 lg:p-8">
            <AppContext.Provider
              value={{
                organizationId: profile?.organization_id ?? null,
                companies,
              }}
            >
              {children}
            </AppContext.Provider>
          </main>
      </div>
    </div>
  );
}
