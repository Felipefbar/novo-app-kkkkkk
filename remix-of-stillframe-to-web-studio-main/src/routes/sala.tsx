import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";
import { levelStyles } from "@/components/AppHeader";
import { LEVEL_INFO, useNow } from "@/lib/triage";
import { useWaitingQueue } from "@/lib/triage-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sala")({
  head: () => ({
    meta: [
      { title: "Sala de espera — Triaje Digital" },
      { name: "description", content: "Pantalla de sala de espera con turnos anonimizados por categoría." },
      { property: "og:title", content: "Sala de espera — Triaje Digital" },
      { property: "og:description", content: "Pantalla de sala de espera con turnos anonimizados por categoría." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Sala,
});

function Sala() {
  const records = useWaitingQueue();
  const now = useNow(30000);
  const active = records.filter((r) => r.status !== "Atendido")
    .sort((a, b) => (a.status === "En Evaluación" ? 0 : 1) - (b.status === "En Evaluación" ? 0 : 1) || LEVEL_INFO[a.level].cat - LEVEL_INFO[b.level].cat || a.createdAt - b.createdAt);
  return (
    <main className="min-h-screen bg-background p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-3 font-display text-2xl font-bold sm:text-3xl"><HeartPulse className="h-8 w-8 shrink-0 text-primary" />Guardia — Sala de espera</h1>
        <p className="font-display text-3xl font-semibold tabular-nums">{new Date(now).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
      </header>
      {active.length === 0 ? (
        <p className="mt-20 text-center text-2xl text-muted-foreground">No hay pacientes en espera.</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {active.map((r) => (
            <li key={r.id} className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft sm:grid-cols-[6rem_minmax(0,1fr)_auto]">
              <span className={cn("grid h-16 w-24 shrink-0 place-items-center rounded-xl font-display text-2xl font-bold", levelStyles[r.level])}>{r.ticket}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-lg font-semibold sm:text-xl">{r.initials} — DNI ***{r.dniTail}</p>
                <p className="text-muted-foreground">Cat. {LEVEL_INFO[r.level].cat} · {r.level} · espera {Math.max(0, Math.floor((now - r.createdAt) / 60000))} min</p>
              </div>
              {r.status === "En Evaluación" && <span className="col-span-2 justify-self-start rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground sm:col-span-1">Pase al consultorio</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-center text-xs text-muted-foreground">Por privacidad (Ley 25.326) solo se muestran iniciales y DNI parcial. La atención es por gravedad, no por orden de llegada.</p>
    </main>
  );
}
