import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellRing, Download, LogOut, Monitor, Search, Users, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader, levelStyles } from "@/components/AppHeader";
import { Summary } from "@/components/TriageSummary";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LEVELS, LEVEL_INFO, SYMPTOMS, STATUSES, VITAL_FIELDS, validateVitals, computeUrgency, emptyVitals, isOverdue, isValidMatricula,
  toFhir, useNow, waitMinutes, type Level, type Status, type TriageRecord, type Vitals,
} from "@/lib/triage";
import { applyTriage, staffLogout, updateStatus, useRecords, useStaffSession } from "@/lib/triage-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/panel")({
  head: () => ({
    meta: [
      { title: "Panel de guardia — Triaje Digital" },
      { name: "description", content: "Lista de espera por categoría de triaje, signos vitales y alertas de re-triaje." },
      { property: "og:title", content: "Panel de guardia — Triaje Digital" },
      { property: "og:description", content: "Lista de espera por categoría de triaje, signos vitales y alertas de re-triaje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Panel,
});

type Sort = "urgency" | "time" | "age";
const statusStyle: Record<Status, string> = {
  "En Espera": "bg-secondary text-secondary-foreground",
  "En Evaluación": "bg-accent text-accent-foreground",
  Atendido: "bg-muted text-muted-foreground",
};

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.3].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.18);
    });
    void ctx.resume();
    setTimeout(() => { void ctx.close(); }, 800);
  } catch { /* audio blocked */ }
}

function Panel() {
  const nav = useNavigate();
  const session = useStaffSession();
  useEffect(() => { if (session === null) nav({ to: "/login", replace: true }); }, [session, nav]);
  if (!session) return null;
  return <PanelInner onLogout={() => { void staffLogout().then(() => nav({ to: "/login", replace: true })); }} />;
}

function PanelInner({ onLogout }: { onLogout: () => void }) {
  const records = useRecords();
  const now = useNow();
  const [sort, setSort] = useState<Sort>("urgency");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const [sym, setSym] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sound, setSound] = useState(false);

  const overdue = records.filter((r) => isOverdue(r, now));
  const alerted = useRef(new Set<string>());
  useEffect(() => {
    const active = new Set(overdue.map((r) => `${r.id}:${r.triagedAt ?? r.createdAt}`));
    alerted.current.forEach((key) => { if (!active.has(key)) alerted.current.delete(key); });
    const fresh = overdue.filter((r) => !alerted.current.has(`${r.id}:${r.triagedAt ?? r.createdAt}`));
    if (fresh.length) {
      fresh.forEach((r) => alerted.current.add(`${r.id}:${r.triagedAt ?? r.createdAt}`));
      if (sound) beep();
      toast.warning(`Re-triaje: ${fresh.map((r) => r.ticket).join(", ")} superó el tiempo máximo de espera`);
    }
  }, [overdue, sound]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = records.filter((x) => (filter === "all" || x.status === filter)
      && (!t || x.name.toLowerCase().includes(t) || x.dni.toLowerCase().includes(t))
      && (sym === "all" || x.symptoms.includes(sym)));
    const cat = (x: TriageRecord) => LEVEL_INFO[x.level].cat;
    return [...r].sort((a, b) =>
      sort === "urgency" ? (a.status === "Atendido" ? 1 : 0) - (b.status === "Atendido" ? 1 : 0) || cat(a) - cat(b) || a.createdAt - b.createdAt
        : sort === "time" ? a.createdAt - b.createdAt
        : Number(b.age) - Number(a.age));
  }, [records, sort, filter, q, sym]);

  const count = (l: Level) => records.filter((r) => r.level === l && r.status !== "Atendido").length;
  const current = openId ? records.find((r) => r.id === openId) : undefined;

  return (
    <div className="min-h-screen">
      <AppHeader right={<div className="flex gap-1">
        <Button asChild variant="ghost" size="sm"><Link to="/sala" target="_blank"><Monitor />Sala de espera</Link></Button>
        <Button variant="ghost" size="sm" onClick={onLogout}><LogOut />Salir</Button>
      </div>} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="font-display text-3xl font-semibold">Panel de guardia</h1>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline"><Link to="/">Registrar paciente</Link></Button>
          <Button variant={sound ? "secondary" : "outline"} aria-pressed={sound} onClick={() => { if (!sound) beep(); setSound(!sound); }}>
            {sound ? <Volume2 /> : <VolumeX />}{sound ? "Silenciar alertas" : "Activar alertas sonoras"}
          </Button>
        </div>

        {overdue.length > 0 && (
          <div role="alert" className="mt-4 flex items-center gap-3 rounded-2xl bg-destructive p-4 text-destructive-foreground">
            <BellRing className="h-5 w-5 shrink-0 animate-pulse" />
            <p className="font-semibold">{overdue.length} paciente(s) superaron el tiempo máximo de su categoría: {overdue.map((r) => r.ticket).join(", ")}. Re-triar.</p>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {LEVELS.map((l) => (
            <div key={l} className={cn("rounded-2xl p-4", levelStyles[l])}>
              <p className="text-xs font-medium">Cat. {LEVEL_INFO[l].cat} · {l}</p>
              <p className="font-display text-3xl font-bold">{count(l)}</p>
              <p className="text-xs opacity-90">Máx. {LEVEL_INFO[l].wait}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar por nombre o DNI" className="bg-card pl-9" placeholder="Buscar por nombre o DNI" maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={sym} onValueChange={setSym}>
            <SelectTrigger aria-label="Filtrar por síntomas" className="w-52 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los síntomas</SelectItem>
              {SYMPTOMS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger aria-label="Ordenar pacientes" className="w-52 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="urgency">Ordenar: Categoría</SelectItem>
              <SelectItem value="time">Ordenar: Hora de llegada</SelectItem>
              <SelectItem value="age">Ordenar: Edad</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
            <SelectTrigger aria-label="Filtrar por estado" className="w-48 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {list.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-8 w-8" />Todavía no hay pacientes en espera.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border bg-card shadow-soft">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="p-3">Categoría</th><th className="p-3">Paciente</th><th className="p-3">Edad</th><th className="p-3">Motivo</th><th className="p-3">Signos</th><th className="p-3">Espera</th><th className="p-3">Estado</th></tr>
              </thead>
              <tbody className="divide-y">
                {list.map((r) => {
                  const late = isOverdue(r, now);
                  return (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className={cn("cursor-pointer hover:bg-muted/50", late && "bg-destructive/10")}>
                      <td className="p-3"><span className={cn("whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold", levelStyles[r.level])}>{LEVEL_INFO[r.level].cat} · {r.level} · {r.ticket}</span></td>
                      <td className="p-3 font-medium"><Button variant="link" className="h-auto justify-start whitespace-normal p-0 text-left" onClick={() => setOpenId(r.id)} aria-label={`Abrir ficha de ${r.name}`}>{r.name}</Button></td>
                      <td className="p-3">{r.age}</td>
                      <td className="max-w-[200px] truncate p-3">{r.motivo}</td>
                      <td className="p-3">
                        {r.alerts?.length ? <span className="inline-flex items-center gap-1 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" />{r.alerts.length} alerta(s)</span>
                          : r.vitals ? <span className="text-success">Tomados</span> : <span className="text-muted-foreground">Pendientes</span>}
                      </td>
                      <td className={cn("whitespace-nowrap p-3 font-semibold", late && "text-destructive")}>{late && <BellRing className="mr-1 inline h-4 w-4" />}{waitMinutes(r, now)} min</td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={r.status} onValueChange={(v) => { updateStatus(r, v as Status).catch((e: Error) => toast.error(e.message)); }}>
                          <SelectTrigger aria-label={`Estado de ${r.ticket}`} className={cn("h-8 w-36 border-0 text-xs font-semibold", statusStyle[r.status])}><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {current && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-3">
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", levelStyles[current.level])}>Cat. {LEVEL_INFO[current.level].cat} · {current.level} · {current.ticket}</span>
                  {current.name}
                </DialogTitle>
              </DialogHeader>
              <TriageForm key={current.id + (current.triagedAt ?? "")} r={current} />
              <Summary d={current} />
              <Button variant="outline" size="sm" onClick={() => {
                const blob = new Blob([JSON.stringify(toFhir(current), null, 2)], { type: "application/fhir+json" });
                const a = document.createElement("a"); const url = URL.createObjectURL(blob); a.href = url; a.download = `fhir-${current.ticket}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}><Download />Exportar HL7 FHIR</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TriageForm({ r }: { r: TriageRecord }) {
  const [v, setV] = useState<Vitals>(r.vitals ?? emptyVitals);
  const [mat, setMat] = useState(r.matricula ?? "");
  const [manual, setManual] = useState<Level | "auto">(r.override ? r.level : "auto");
  const [reason, setReason] = useState(r.override?.reason ?? "");
  const auto = computeUrgency(r, v);
  const final = manual === "auto" ? auto.level : manual;
  const overriding = manual !== "auto" && manual !== auto.level;
  const matOk = isValidMatricula(mat);
  const vitalErrors = validateVitals(v);
  const invalidVitals = Object.keys(vitalErrors).length > 0;

  const submit = async () => {
    try {
      await applyTriage(r, v, mat, overriding ? { level: manual as Level, reason } : undefined);
      toast.success(`Triaje registrado: Categoría ${LEVEL_INFO[final].cat} (${final})`);
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4 border-b pb-4">
      <h3 className="font-display text-lg font-semibold">Signos vitales y categorización</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {VITAL_FIELDS.map(({ key: k, label, unit, min, max, step }) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`v-${k}`} className="text-xs">{label} <span className="text-muted-foreground">({unit})</span></Label>
            <Input id={`v-${k}`} type="number" min={min} max={max} step={step} inputMode={step === 1 ? "numeric" : "decimal"} className="text-lg font-semibold" value={v[k]}
              aria-invalid={!!vitalErrors[k]} aria-describedby={vitalErrors[k] ? `v-${k}-error` : undefined}
              onChange={(e) => setV((p) => ({ ...p, [k]: e.target.value }))} />
            {vitalErrors[k] && <p id={`v-${k}-error`} role="alert" className="text-xs text-destructive">{vitalErrors[k]}</p>}
          </div>
        ))}
      </div>

      {!invalidVitals && auto.alerts.length > 0 && (
        <div role="alert" className="rounded-xl bg-destructive p-3 text-sm text-destructive-foreground">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />Alerta crítica — se sugiere Categoría {LEVEL_INFO[auto.level].cat}</p>
          <ul className="ml-6 list-disc">{auto.alerts.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">Sugerencia automática:</span>
        {invalidVitals ? <span className="text-sm text-destructive">Pendiente: revisar valores inválidos</span> : <span className={cn("rounded-full px-3 py-1 text-xs font-bold", levelStyles[auto.level])}>Cat. {LEVEL_INFO[auto.level].cat} · {auto.level} · {LEVEL_INFO[auto.level].wait}</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="final-level" className="text-xs">Categoría final</Label>
          <Select value={manual} onValueChange={(x) => setManual(x as Level | "auto")}>
            <SelectTrigger id="final-level"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Usar sugerencia automática</SelectItem>
              {LEVELS.map((l) => <SelectItem key={l} value={l}>Cat. {LEVEL_INFO[l].cat} · {l} — {LEVEL_INFO[l].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="mat" className="text-xs">Matrícula del profesional (MN / MP) *</Label>
          <Input id="mat" placeholder="MN 123456" maxLength={12} value={mat} onChange={(e) => setMat(e.target.value)} aria-invalid={!!mat && !matOk} />
          {mat && !matOk && <p className="text-xs text-destructive">Formato: MN o MP seguido del número</p>}
        </div>
      </div>
      {overriding && (
        <div className="space-y-1">
          <Label htmlFor="reason" className="text-xs">Justificación de la sobreescritura *</Label>
          <Textarea id="reason" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo clínico del cambio de categoría" />
        </div>
      )}
      {r.override && <p className="text-xs text-muted-foreground">Sobreescrito desde {r.override.from} por {r.matricula}: “{r.override.reason}”</p>}
      <Button className="w-full" disabled={!matOk || invalidVitals || (overriding && reason.trim().length < 5)} onClick={submit}>
        Confirmar Categoría {LEVEL_INFO[final].cat} ({final})
      </Button>
      {!!r.triageHistory?.length && <section className="space-y-2 border-t pt-3">
        <h4 className="font-semibold">Historial de triaje</h4>
        {r.triageHistory.map((revision, index) => <div key={`${revision.at}-${index}`} className="border-l-2 border-primary pl-3 text-sm">
          <p>{new Date(revision.at).toLocaleString("es-AR")} · {revision.matricula} · Cat. {LEVEL_INFO[revision.level].cat} ({revision.level})</p>
          {revision.reason && <p className="text-muted-foreground">{revision.reason}</p>}
          <p className="text-xs text-muted-foreground">{VITAL_FIELDS.filter((f) => revision.vitals[f.key]).map((f) => `${f.label}: ${revision.vitals[f.key]} ${f.unit}`).join(" · ") || "Sin mediciones registradas"}</p>
        </div>)}
      </section>}
      {r.consentAt && <p className="text-xs text-muted-foreground">Consentimiento registrado: {new Date(r.consentAt).toLocaleString("es-AR")}</p>}
    </div>
  );
}
