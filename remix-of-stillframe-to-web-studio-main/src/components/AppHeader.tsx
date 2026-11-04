import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { HeartPulse, Lock } from "lucide-react";

export function AppHeader({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-hero text-primary-foreground">
            <HeartPulse className="h-5 w-5" />
          </span>
          Triaje Digital
        </Link>
        {right ?? (
          <Link to="/login" aria-label="Acceso personal" className="rounded-lg p-2 text-muted-foreground/50 hover:bg-muted hover:text-muted-foreground">
            <Lock className="h-4 w-4" />
          </Link>
        )}
      </div>
    </header>
  );
}

export const levelStyles = {
  Rojo: "bg-destructive text-destructive-foreground",
  Naranja: "bg-orange text-orange-foreground",
  Amarillo: "bg-warning text-warning-foreground",
  Verde: "bg-success text-success-foreground",
  Azul: "bg-info text-info-foreground",
} as const;
