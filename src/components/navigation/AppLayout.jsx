import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "@/components/navigation/TopNav";
import { getPrefs } from "@/lib/localStore";

function applyPrefs() {
  const { reduceMotion, largerText } = getPrefs();
  document.documentElement.classList.toggle("reduce-motion", !!reduceMotion);
  document.documentElement.classList.toggle("text-larger", !!largerText);
}

export default function AppLayout() {
  useEffect(() => {
    applyPrefs();
    const handler = () => applyPrefs();
    window.addEventListener("kinetix:prefs-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("kinetix:prefs-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main>
        <Outlet />
      </main>
    </div>
  );
}