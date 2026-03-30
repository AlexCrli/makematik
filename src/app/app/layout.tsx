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
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
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

      const user = session.user;

      // Fetch profile
      const { data: profileData } = await supabaseBrowser
        .from("profiles")
        .select("first_name, last_name, organization_id")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);

        // Fetch organization
        const { data: orgData } = await supabaseBrowser
          .from("organizations")
          .select("id, name")
          .eq("id", profileData.organization_id)
          .single();

        if (orgData) setOrganization(orgData);

        // Fetch companies
        const { data: companiesData } = await supabaseBrowser
          .from("companies")
          .select("id, name")
          .eq("organization_id", profileData.organization_id);

        if (companiesData && companiesData.length > 0) {
          setCompanies(companiesData);
          setSelectedCompany(companiesData[0].id);
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

  const selectedCompanyName =
    companies.find((c) => c.id === selectedCompany)?.name ?? "—";

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
          <span className="text-lg font-bold text-white tracking-tight">
            Make<span className="text-[#818cf8]">matik</span>
          </span>
        </div>

        {/* Company selector */}
        <div className="px-4 py-4 border-b border-white/10">
          <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1.5 px-2">
            Société
          </label>
          {companies.length > 0 ? (
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:border-[#818cf8]/50 transition-colors appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
              }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-2 text-white/30 text-sm">
              {organization?.name ?? "Chargement..."}
            </div>
          )}
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
          <span className="ml-3 text-sm font-semibold text-gray-900">
            Make<span className="text-[#6366f1]">matik</span>
          </span>
        </header>

        <main className="flex-1 p-6 lg:p-8">
            <AppContext.Provider
              value={{
                organizationId: profile?.organization_id ?? null,
                selectedCompanyId: selectedCompany || null,
                setSelectedCompanyId: setSelectedCompany,
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
