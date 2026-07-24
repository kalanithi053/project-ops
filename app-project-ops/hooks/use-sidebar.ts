"use client";

import * as React from "react";

/**
 * Local UI state for the sidebar (desktop collapsed/expanded toggle and
 * mobile sheet open/close). Deliberately not global app state — no
 * other part of the app needs to read or react to it.
 */
export function useSidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return {
    collapsed,
    toggleCollapsed: () => setCollapsed((prev) => !prev),
    mobileOpen,
    setMobileOpen,
  };
}
