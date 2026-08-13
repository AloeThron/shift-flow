"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "shift-flow:content-expanded";

type ContentWidthContextValue = {
  expanded: boolean;
  toggleExpanded: () => void;
};

const ContentWidthContext = createContext<ContentWidthContextValue | null>(null);

/** provider สถานะขยายเต็มจอ — จำค่าใน localStorage */
export function ContentWidthProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") {
      setExpanded(true);
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <ContentWidthContext.Provider value={{ expanded, toggleExpanded }}>
      {children}
    </ContentWidthContext.Provider>
  );
}

/** อ่านสถานะขยายเต็มจอ */
export function useContentWidth(): ContentWidthContextValue {
  const ctx = useContext(ContentWidthContext);
  if (!ctx) {
    throw new Error("useContentWidth ต้องอยู่ใน ContentWidthProvider");
  }
  return ctx;
}
