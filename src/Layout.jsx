import React from "react";
import AppShell from "./components/ui/AppShell";

export default function Layout({ children, currentPageName }) {
  return (
    <AppShell currentPageName={currentPageName}>
      {children}
    </AppShell>
  );
}