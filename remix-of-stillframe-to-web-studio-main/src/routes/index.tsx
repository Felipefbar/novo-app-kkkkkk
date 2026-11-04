import { createFileRoute } from "@tanstack/react-router";
import { Children, cloneElement, isValidElement, useId, useState, type ReactNode, type ReactElement } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Plus, ScanLine, ShieldCheck, Ticket, Trash2 } from "lucide-react";
import { levelStyles } from "@/components/AppHeader";
import { Summary } from "@/components/TriageSummary";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  ONSET, SYMPTOMS, CONDITIONS, BLOOD, SEX, RELIGION, VACCINATION, RED_FLAGS, emptyData, painLabel, parseDniPdf417, LEVEL_INFO,
  type TriageData, type TriageRecord,
} from "@/lib/triage";
import { cn } from "@/lib/utils";
import { addRecord } from "@/lib/triage-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Triaje Digital — Ingreso de paciente" },
      { name: "description", content: "Completá tu triaje médico en pocos pasos y obtené tu turno de atención." },
      { property: "og:title", content: "Triaje Digital — Ingreso de paciente" },
      { property: "og:description", content: "Completá tu triaje médico en pocos pasos y obtené tu turno de atención." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TriagePage,
});

const STEPS = ["Datos personales", "Síntomas", "Antecedentes", "Resumen"];

const step2 = z.object({
  motivo: z.string().trim().min(3, "Describí brevemente el motivo").max(1000),
  onset: z.string().min(1, "Seleccioná el tiempo de aparición"),
  contact: z.string().min(1, "Respondé la pregunta de contacto"),
});
const step4 = z.object({
  name: z.string().trim().min(3, "Ingresá nombre y apellido").max(100),
  age: z.string().regex(/^\d{1,3}$/, "Edad inválida").refine((v) => Number(v) <= 120, "Edad inválida"),
  sex: z.string().min(1, "Seleccioná el sexo biológico"),
  dni: z.string().trim().regex(/^[0-9A-Za-z.\-]{6,15}$/, "Documento inválido"),
  phone: z.string().trim().regex(/^[0-9+\s()\-]{6,20}$/, "Teléfono inválido"),
  email: z.string().trim().email("Email inválido").max(255),
  religion: z.string(),
  address: z.string().trim().min(3, "Ingresá tu localidad").max(200),
  coverage: z.string().trim().max(100),
  memberNumber: z.string().trim().max(50),
  vaccination: z.string().min(1, "Indicá tu esquema de vacunación"),
  blood: z.string().min(1, "Seleccioná grupo sanguíneo"),
});

function TriagePage() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<TriageData>(emptyData);
  const [errors, setErrors] = useState<Partial<Record<keyof TriageData, string>>>({});
  const [result, setResult] = useState<TriageRecord | null>(null);
  const [scan, setScan] = useState("");
  const [sending, setSending] = useState(false);
  const applyScan = () => {
    const r = parseDniPdf417(scan);
    if (!r) { toast.error("No se pudo leer el código del DNI. Ingresá los datos manualmente."); return; }
    setD((p) => ({ ...p, ...r })); setScan(""); toast.success("Datos del DNI cargados");
  };

  const set = <K extends keyof TriageData>(k: K, v: TriageData[K]) => setD((p) => ({ ...p, [k]: v }));
  const toggle = (k: "symptoms" | "conditions", v: string) =>
    set(k, d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v]);

  const validate = (schema: z.ZodTypeAny) => {
    const r = schema.safeParse(d);
    if (r.success) { setErrors({}); return true; }
    const e: Record<string, string> = {};
    r.error.issues.forEach((i) => { e[String(i.path[0])] ??= i.message; });
    setErrors(e as Partial<Record<keyof TriageData, string>>);
    toast.error("Revisá los campos marcados");
    return false;
  };

  const next = () => {
    if (step === 0 && !validate(step4)) return;
    if (step === 1 && !validate(step2)) return;
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => { setStep(0); setD(emptyData); setResult(null); };
  const setMed = (i: number, k: "name" | "dose" | "frequency", v: string) =>
    set("meds", d.meds.map((m, j) => (j === i ? { ...m, [k]: v } : m)));

  if (result) return <Confirmation r={result} onNew={reset} />;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs font-medium text-muted-foreground">
            <span>Paso {step + 1} de {STEPS.length}</span><span>{STEPS[step]}</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-2" />
        </div>

        <div key={step} className="animate-step rounded-2xl border bg-card p-5 shadow-soft sm:p-8">
          {step === 0 && (
            <Section title="Datos personales y administrativos">
              <div className="rounded-xl border border-dashed bg-secondary/50 p-4">
                <Label htmlFor="scan" className="flex items-center gap-2 text-sm font-semibold"><ScanLine className="h-4 w-4" />Escanear DNI (código PDF417)</Label>
                <p className="mb-2 mt-1 text-xs text-muted-foreground">Usá el lector de códigos sobre el dorso del DNI, o completá los datos a mano.</p>
                <div className="flex gap-2">
                  <Input id="scan" placeholder="00123456789@PEREZ@JUAN@M@30123456@A@01/01/1980@..." value={scan} maxLength={300}
                    onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyScan(); } }} />
                  <Button type="button" variant="outline" onClick={applyScan}>Cargar</Button>
                </div>
              </div>
              <Field label="Nombre y apellido *" error={errors.name}><Input maxLength={100} value={d.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Edad *" error={errors.age}><Input inputMode="numeric" maxLength={3} value={d.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, ""))} /></Field>
                <Field label="Sexo biológico *" error={errors.sex}>
                  <Select value={d.sex} onValueChange={(v) => set("sex", v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{SEX.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="DNI / Documento *" error={errors.dni}><Input maxLength={15} value={d.dni} onChange={(e) => set("dni", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Teléfono de contacto *" error={errors.phone}><Input type="tel" inputMode="tel" maxLength={20} value={d.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                <Field label="Correo electrónico *" error={errors.email}><Input type="email" maxLength={255} placeholder="Para envío de comprobantes" value={d.email} onChange={(e) => set("email", e.target.value)} /></Field>
              </div>
              <Field label="Lugar de residencia *" error={errors.address}><Input maxLength={200} placeholder="Localidad / dirección" value={d.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Cobertura / Obra social / Prepaga"><Input maxLength={100} value={d.coverage} onChange={(e) => set("coverage", e.target.value)} /></Field>
                <Field label="N.º de afiliado"><Input maxLength={50} value={d.memberNumber} onChange={(e) => set("memberNumber", e.target.value)} /></Field>
              </div>
              <Field label="Religión">
                <Select value={d.religion} onValueChange={(v) => set("religion", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{RELIGION.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="¿Esquema de vacunación al día? *" error={errors.vaccination}>
                <RadioGroup value={d.vaccination} onValueChange={(v) => set("vaccination", v)} className="flex flex-wrap gap-4">
                  {VACCINATION.map((o) => <label key={o} className="flex items-center gap-2"><RadioGroupItem value={o} />{o}</label>)}
                </RadioGroup>
              </Field>
              <Field label="Grupo sanguíneo y factor Rh *" error={errors.blood}>
                <Select value={d.blood} onValueChange={(v) => set("blood", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{BLOOD.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Section>
          )}

          {step === 1 && (
            <Section title="Motivo de consulta y síntomas">
              <fieldset className="space-y-3 border-l-4 border-destructive bg-destructive/5 p-4">
                <legend className="font-semibold text-destructive">Signos de alarma actuales</legend>
                {RED_FLAGS.map((flag) => (
                  <label key={flag} className="flex items-start gap-3 text-sm">
                    <Checkbox checked={d.redFlags?.includes(flag) ?? false} onCheckedChange={(checked) => set("redFlags", checked === true ? [...(d.redFlags ?? []), flag] : (d.redFlags ?? []).filter((f) => f !== flag))} />
                    <span>{flag}</span>
                  </label>
                ))}
                {!!d.redFlags?.length && <p role="alert" className="font-semibold text-destructive">Avisá al personal de guardia de inmediato. No esperes a completar el formulario.</p>}
              </fieldset>
              <Field label="Motivo de consulta principal *" error={errors.motivo}>
                <Textarea rows={4} maxLength={1000} placeholder="Ej: dolor de cabeza intenso desde esta mañana" value={d.motivo} onChange={(e) => set("motivo", e.target.value)} />
              </Field>
              <Field label="¿Hace cuánto empezaron los síntomas? *" error={errors.onset}>
                <Select value={d.onset} onValueChange={(v) => set("onset", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{ONSET.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Síntomas agregados">
                <Chips options={SYMPTOMS} value={d.symptoms} onToggle={(v) => toggle("symptoms", v)} />
                <Input className="mt-2" placeholder="Otros síntomas" maxLength={200} value={d.otherSymptoms} onChange={(e) => set("otherSymptoms", e.target.value)} />
              </Field>
              <Field label={`Grado de dolor: ${d.pain} — ${painLabel(d.pain)}`}>
                <Slider min={0} max={10} step={1} value={[d.pain]} onValueChange={([v]) => set("pain", v ?? 0)} className="py-3" />
                <div className="flex justify-between text-xs text-muted-foreground"><span>0 Sin dolor</span><span>5 Moderado</span><span>10 Insoportable</span></div>
              </Field>
              <Field label="¿Alguien con quien tuviste contacto cercano presenta síntomas parecidos? *" error={errors.contact}>
                <RadioGroup value={d.contact} onValueChange={(v) => set("contact", v)} className="flex flex-wrap gap-4">
                  {["Sí", "No", "No lo sé"].map((o) => (
                    <label key={o} className="flex items-center gap-2"><RadioGroupItem value={o} />{o}</label>
                  ))}
                </RadioGroup>
              </Field>
            </Section>
          )}

          {step === 2 && (
            <Section title="Antecedentes médicos y fármacos">
              <Field label="Enfermedades previas o actuales">
                <Chips options={CONDITIONS} value={d.conditions} onToggle={(v) => toggle("conditions", v)} />
                <Input className="mt-2" placeholder="Otras enfermedades" maxLength={200} value={d.otherConditions} onChange={(e) => set("otherConditions", e.target.value)} />
              </Field>
              <Field label="Medicamentos de uso habitual">
                <div className="space-y-3">
                  {d.meds.map((m, i) => (
                    <div key={i} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <Input aria-label="Nombre del medicamento" placeholder="Nombre del medicamento" maxLength={100} value={m.name} onChange={(e) => setMed(i, "name", e.target.value)} />
                      <Input aria-label="Dosis" placeholder="Dosis (ej. 500 mg)" maxLength={50} value={m.dose} onChange={(e) => setMed(i, "dose", e.target.value)} />
                      <Input aria-label="Frecuencia" placeholder="Frecuencia (ej. cada 8 h)" maxLength={50} value={m.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Quitar" onClick={() => set("meds", d.meds.filter((_, j) => j !== i))}><Trash2 /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => set("meds", [...d.meds, { name: "", dose: "", frequency: "" }])}><Plus />Agregar medicamento</Button>
                </div>
              </Field>
              <Field label="Cirugías previas (opcional)">
                <Input maxLength={200} value={d.surgeries} onChange={(e) => set("surgeries", e.target.value)} />
              </Field>
              <Field label={<span className="flex items-center gap-2">Alergias específicas <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />Importante</span></span>}>
                <Input maxLength={200} placeholder="Ej: penicilina, ibuprofeno" value={d.allergies} onChange={(e) => set("allergies", e.target.value)} className="border-destructive/40" />
              </Field>
            </Section>
          )}

          {step === 3 && (
            <Section title="Revisá tus datos" sub="Si algo no es correcto, volvé al paso correspondiente.">
              <Summary d={d} />
              <label className="flex items-start gap-3 rounded-xl border bg-secondary/50 p-4 text-sm">
                <Checkbox checked={d.consent} onCheckedChange={(v) => set("consent", v === true)} className="mt-0.5" />
                <span><span className="flex items-center gap-1 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Consentimiento informado *</span>
                  Autorizo el tratamiento de mis datos personales y de salud (datos sensibles) para mi atención médica, conforme a la Ley 25.326 de Protección de Datos Personales y la Ley 26.529 de Derechos del Paciente. Sé que puedo acceder, rectificar o suprimir mis datos.</span>
              </label>
            </Section>
          )}

          <div className="mt-8 flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}><ArrowLeft />Atrás</Button>
            {step < 3 ? (
              <Button onClick={next}>Continuar<ArrowRight /></Button>
            ) : (
              <Button disabled={!d.consent || sending} onClick={async () => {
                setSending(true);
                try { setResult(await addRecord({ ...d, meds: d.meds.filter((m) => m.name.trim()) })); }
                catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar el registro"); }
                finally { setSending(false); }
              }}>Enviar triaje<CheckCircle2 /></Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">{title}</h1>
        {sub && <p className="mt-1 text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, error, children }: { label: ReactNode; error?: string | undefined; children: ReactNode }) {
  const id = useId();
  type FieldProps = { id?: string; "aria-labelledby"?: string; "aria-describedby"?: string; "aria-invalid"?: boolean; children?: ReactNode };
  const attributes = { id, "aria-labelledby": `${id}-label`, ...(error ? { "aria-describedby": `${id}-error` } : {}), "aria-invalid": !!error };
  const content = Children.map(children, (child) => {
    if (!isValidElement(child) || child.type === Chips) return child;
    const element = child as ReactElement<FieldProps>;
    if (child.type === Select) {
      return cloneElement(element, {}, Children.map(element.props.children, (nested) =>
        isValidElement(nested) && nested.type === SelectTrigger ? cloneElement(nested as ReactElement<FieldProps>, attributes) : nested));
    }
    return cloneElement(element, attributes);
  });
  return (
    <div className="space-y-2">
      <Label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {content}
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function Chips({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button type="button" key={o} variant={value.includes(o) ? "default" : "outline"} aria-pressed={value.includes(o)} onClick={() => onToggle(o)}
          className="h-auto min-h-10 whitespace-normal text-left">
          {o}
        </Button>
      ))}
    </div>
  );
}

function Confirmation({ r, onNew }: { r: TriageRecord; onNew: () => void }) {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="animate-step overflow-hidden rounded-2xl border bg-card text-center shadow-soft">
          <div className="space-y-4 p-8">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="font-display text-xl font-semibold">Registro enviado con éxito.</p>
            {r.level === "Rojo" ? <p role="alert" className="font-semibold text-destructive">Riesgo vital: avisá al personal de guardia ahora. Atención inmediata.</p> : <p className="text-muted-foreground">Por favor aguarde a ser llamado por el personal médico.</p>}
            <div className="rounded-xl bg-secondary p-5">
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Ticket className="h-4 w-4" />Tu número de turno</p>
              <p className="font-display text-5xl font-bold text-primary">{r.ticket}</p>
              <p className={cn("mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold", levelStyles[r.level])}>Categoría {LEVEL_INFO[r.level].cat} preliminar · espera máx. {LEVEL_INFO[r.level].wait}</p>
              <p className="mt-2 text-xs text-muted-foreground">Enfermería confirmará tu categoría al tomar tus signos vitales.</p>
            </div>
            <Button className="w-full" onClick={onNew}>Finalizar</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
