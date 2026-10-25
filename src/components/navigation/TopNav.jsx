import React from "react";
import { NavLink, Link } from "react-router-dom";
import { Home, ClipboardList, LineChart, Settings as SettingsIcon, Activity } from "lucide-react";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/assessments", label: "Assessments", icon: ClipboardList },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function TopNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-5 lg:h-14 lg:px-4">
        <Link to="/" className="inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Kinetix</span>
        </Link>
        <nav className="flex items-center gap-0.5" aria-label="Primary">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3.5 lg:h-9 lg:px-2.5 lg:text-sm ${
                  isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}