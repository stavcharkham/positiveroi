"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--elevated)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          },
        }}
      />
    </ThemeProvider>
  );
}
