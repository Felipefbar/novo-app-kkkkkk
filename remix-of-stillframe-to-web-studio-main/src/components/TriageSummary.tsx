import { painLabel, type TriageData } from "@/lib/triage";
import { cn } from "@/lib/utils";

export function Summary({ d }: { d: TriageData }) {
  const meds = Array.isArray(d.meds) ? d.meds : [];
  const groups: [string, [string, string][]][] = [
    ["Datos personales", [
      ["Paciente", `${d.name}, ${d.age} años, ${d.sex}`], ["Documento", d.dni], ["Teléfono", d.phone || "—"], ["Email", d.email || "—"], ["Residencia", d.address],
      ["Cobertura", [d.coverage, d.memberNumber && `N.º ${d.memberNumber}`].filter(Boolean).join(" — ") || "—"],
      ["Religión", d.religion || "—"], ["Vacunación al día", d.vaccination], ["Grupo sanguíneo", d.blood],
    ]],
    ["Motivo y síntomas", [
      ["Motivo", d.motivo], ["Inicio", d.onset],
      ["Síntomas", [...d.symptoms, d.otherSymptoms].filter(Boolean).join(", ") || "—"],
      ["Signos de alarma", d.redFlags?.join(", ") || "—"],
      ["Dolor", `${d.pain}/10 (${painLabel(d.pain)})`], ["Contacto con síntomas", d.contact],
    ]],
    ["Antecedentes", [
      ["Enfermedades", [...d.conditions, d.otherConditions].filter(Boolean).join(", ") || "—"],
      ["Cirugías", d.surgeries || "—"], ["Alergias", d.allergies || "—"],
    ]],
  ];
  return (
    <div className="space-y-4">
      {groups.map(([title, rows]) => (
        <section key={title}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
          <dl className="divide-y rounded-xl border">
            {rows.map(([k, v]) => (
              <div key={k} className="grid gap-1 p-3 sm:grid-cols-3">
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className={cn("break-words text-sm font-medium sm:col-span-2", (k === "Alergias" || k === "Signos de alarma") && v !== "—" && "text-destructive")}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Medicación habitual</h3>
        {meds.length === 0 ? <p className="rounded-xl border p-3 text-sm text-muted-foreground">Sin medicación declarada</p> : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-3">Medicamento</th><th className="p-3">Dosis</th><th className="p-3">Frecuencia</th></tr></thead>
              <tbody className="divide-y">{meds.map((m, i) => <tr key={i}><td className="p-3 font-medium">{m.name}</td><td className="p-3">{m.dose || "—"}</td><td className="p-3">{m.frequency || "—"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
