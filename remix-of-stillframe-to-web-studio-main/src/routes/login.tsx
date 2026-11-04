import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { staffLogin } from "@/lib/triage-store";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Acceso del personal — Triaje Digital" },
      { name: "description", content: "Ingreso exclusivo para personal de enfermería y médicos." },
      { property: "og:title", content: "Acceso del personal — Triaje Digital" },
      { property: "og:description", content: "Ingreso exclusivo para personal de enfermería y médicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await staffLogin(u, p);
    setBusy(false);
    if (ok) nav({ to: "/panel", replace: true });
    else setErr(true);
  };
  return (
    <div className="min-h-screen">
      <AppHeader right={<span />} />
      <main className="mx-auto max-w-sm px-4 py-16">
        <form onSubmit={submit} className="animate-step space-y-5 rounded-2xl border bg-card p-8 shadow-soft">
          <div className="text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 font-display text-2xl font-semibold">Acceso del personal</h1>
          </div>
          <div className="space-y-2"><Label htmlFor="u">Email</Label><Input id="u" type="email" autoComplete="username" maxLength={255} value={u} onChange={(e) => setU(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="p">Contraseña</Label><Input id="p" type="password" autoComplete="current-password" maxLength={100} value={p} onChange={(e) => setP(e.target.value)} /></div>
          {err && <p className="text-sm text-destructive">Email o contraseña incorrectos</p>}
          <Button type="submit" className="w-full" disabled={busy}>Ingresar</Button>
          <p className="rounded-xl bg-secondary p-3 text-xs text-secondary-foreground">Las cuentas del personal las crea el administrador. Si no tenés acceso, pedíselo al responsable del servicio.</p>
        </form>
      </main>
    </div>
  );
}
