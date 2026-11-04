import { useEffect, useState } from "react";

export const RED_FLAGS = [
  "Dolor de pecho opresivo",
  "Dificultad severa para respirar",
  "Pérdida de conocimiento o confusión",
  "Parálisis o debilidad repentina",
  "Sangrado abundante no controlado",
];
export const ONSET = ["< 1 hora", "1-12 horas", "1-3 días", "> 3 días"];
export const SYMPTOMS = ["Fiebre", "Náuseas/Vómitos", "Mareos", "Tos", "Cefalea", "Dificultad respiratoria", "Diarrea", "Dolor abdominal", "Dolor de garganta"];
export const CONDITIONS = ["Hipertensión", "Diabetes", "Asma/EPOC", "Alergias conocidas", "Cardiopatía", "Embarazo"];
export const VACCINATION = ["Sí", "No", "No lo sé"];
export const RELIGION = ["Catolicismo", "Protestantismo / Evangélico", "Adventista del Séptimo Día", "Testigo de Jehová", "Judaísmo", "Islam", "Ninguna / Ateísmo", "Otra", "Prefiero no decirlo"];
export const SEX = ["Masculino", "Femenino", "Prefiero no decirlo"];
export type Medication = { name: string; dose: string; frequency: string };
export const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "No lo sé"];
export const STATUSES = ["En Espera", "En Evaluación", "Atendido"] as const;
export type Status = (typeof STATUSES)[number];
export const LEVELS = ["Rojo", "Naranja", "Amarillo", "Verde", "Azul"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_INFO: Record<Level, { cat: number; label: string; maxWait: number; wait: string }> = {
  Rojo: { cat: 1, label: "Riesgo vital / Emergencia", maxWait: 0, wait: "Inmediata" },
  Naranja: { cat: 2, label: "Urgencia", maxWait: 30, wait: "15–30 min" },
  Amarillo: { cat: 3, label: "Prioritario", maxWait: 60, wait: "≤ 60 min" },
  Verde: { cat: 4, label: "Urgencia menor", maxWait: 180, wait: "120–180 min" },
  Azul: { cat: 5, label: "No urgente (posible CAPS)", maxWait: 240, wait: "≤ 240 min" },
};

/** SNOMED CT codes for structured findings (FHIR-ready). */
export const SNOMED: Record<string, string> = {
  Fiebre: "386661006", "Náuseas/Vómitos": "422587007", Mareos: "404640003", Tos: "49727002", Cefalea: "25064002",
  "Dificultad respiratoria": "267036007", Diarrea: "62315008", "Dolor abdominal": "21522001", "Dolor de garganta": "162397003",
  Hipertensión: "38341003", Diabetes: "73211009", "Asma/EPOC": "195967001", Cardiopatía: "56265001", Embarazo: "77386006",
};

export type Vitals = { sys: string; dia: string; hr: string; spo2: string; rr: string; temp: string; gcs: string };
export const emptyVitals: Vitals = { sys: "", dia: "", hr: "", spo2: "", rr: "", temp: "", gcs: "" };

export const VITAL_FIELDS: { key: keyof Vitals; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "sys", label: "TA sistólica", unit: "mmHg", min: 20, max: 300, step: 1 },
  { key: "dia", label: "TA diastólica", unit: "mmHg", min: 10, max: 200, step: 1 },
  { key: "hr", label: "Frec. cardíaca", unit: "lpm", min: 10, max: 300, step: 1 },
  { key: "spo2", label: "SatO₂", unit: "%", min: 0, max: 100, step: 1 },
  { key: "rr", label: "Frec. respiratoria", unit: "rpm", min: 0, max: 100, step: 1 },
  { key: "temp", label: "Temperatura", unit: "°C", min: 20, max: 45, step: 0.1 },
  { key: "gcs", label: "Glasgow", unit: "3–15", min: 3, max: 15, step: 1 },
];

export function validateVitals(v: Vitals): Partial<Record<keyof Vitals, string>> {
  const errors: Partial<Record<keyof Vitals, string>> = {};
  for (const f of VITAL_FIELDS) {
    if (!v[f.key].trim()) continue; // Missing measurements are not normal measurements.
    const value = Number(v[f.key]);
    if (!Number.isFinite(value) || value < f.min || value > f.max || (f.step === 1 && !Number.isInteger(value))) {
      errors[f.key] = `Valor válido: ${f.min}–${f.max}${f.step === 1 ? ", entero" : ""}`;
    }
  }
  return errors;
}

export type TriageData = {
  motivo: string;
  onset: string;
  symptoms: string[];
  otherSymptoms: string;
  pain: number;
  contact: string;
  conditions: string[];
  otherConditions: string;
  meds: Medication[];
  vaccination: string;
  surgeries: string;
  allergies: string;
  name: string;
  age: string;
  sex: string;
  dni: string;
  phone: string;
  email: string;
  religion: string;
  address: string;
  coverage: string;
  memberNumber: string;
  blood: string;
  consent: boolean;
  redFlags?: string[];
};

export type TriageRecord = TriageData & {
  id: string;
  ticket: string;
  createdAt: number;
  level: Level;
  autoLevel?: Level;
  score: number;
  status: Status;
  vitals?: Vitals;
  alerts?: string[];
  override?: { reason: string; from: Level };
  matricula?: string;
  triagedAt?: number;
  consentAt?: number;
  triageHistory?: { at: number; vitals: Vitals; matricula: string; level: Level; autoLevel: Level; reason?: string; alerts: string[] }[];
};

export const emptyData: TriageData = {
  motivo: "", onset: "", symptoms: [], otherSymptoms: "", pain: 0, contact: "",
  conditions: [], otherConditions: "", meds: [], vaccination: "", surgeries: "", allergies: "",
  name: "", age: "", sex: "", dni: "", phone: "", email: "", religion: "", address: "", coverage: "", memberNumber: "", blood: "",
  consent: false, redFlags: [],
};

export function painLabel(p: number) {
  if (p === 0) return "Sin dolor";
  if (p <= 3) return "Leve";
  if (p <= 6) return "Moderado";
  if (p <= 9) return "Severo";
  return "Insoportable";
}

const n = (s: string | undefined) => (s && s.trim() !== "" && !isNaN(Number(s)) ? Number(s) : null);

/** Critical / abnormal vital sign checks. Returns category floor (1 or 2) per alert. */
export function vitalAlerts(v?: Vitals): { msg: string; cat: 1 | 2 }[] {
  if (!v) return [];
  const a: { msg: string; cat: 1 | 2 }[] = [];
  const spo2 = n(v.spo2), gcs = n(v.gcs), hr = n(v.hr), rr = n(v.rr), sys = n(v.sys), t = n(v.temp);
  if (spo2 !== null) { if (spo2 < 90) a.push({ msg: `SatO₂ ${spo2}% (< 90%)`, cat: 1 }); else if (spo2 < 94) a.push({ msg: `SatO₂ ${spo2}% (< 94%)`, cat: 2 }); }
  if (gcs !== null) { if (gcs <= 8) a.push({ msg: `Glasgow ${gcs} (≤ 8)`, cat: 1 }); else if (gcs < 14) a.push({ msg: `Glasgow ${gcs} (< 14)`, cat: 2 }); }
  if (hr !== null) { if (hr < 40 || hr > 150) a.push({ msg: `FC ${hr} lpm (extrema)`, cat: 1 }); else if (hr < 50 || hr > 120) a.push({ msg: `FC ${hr} lpm`, cat: 2 }); }
  if (rr !== null) { if (rr < 8 || rr > 35) a.push({ msg: `FR ${rr} rpm (extrema)`, cat: 1 }); else if (rr > 25) a.push({ msg: `FR ${rr} rpm`, cat: 2 }); }
  if (sys !== null) { if (sys < 80) a.push({ msg: `TAS ${sys} mmHg (shock)`, cat: 1 }); else if (sys < 90 || sys >= 200) a.push({ msg: `TAS ${sys} mmHg`, cat: 2 }); }
  if (t !== null) { if (t >= 41 || t < 32) a.push({ msg: `T° ${t} °C (extrema)`, cat: 1 }); else if (t >= 39.5 || t < 35) a.push({ msg: `T° ${t} °C`, cat: 2 }); }
  return a;
}

/** Score 0-100 from complaint; vitals alerts force Category 1 or 2. */
export function computeUrgency(d: TriageData, vitals?: Vitals): { level: Level; score: number; alerts: string[] } {
  let score = d.pain * 6;
  if (d.onset === "< 1 hora") score += 12;
  else if (d.onset === "1-12 horas") score += 6;
  if (d.symptoms.includes("Fiebre")) score += 8;
  if (d.symptoms.includes("Mareos")) score += 5;
  if (d.symptoms.includes("Dificultad respiratoria")) score += 15;
  score += Math.min(d.symptoms.length, 4) * 2;
  const age = Number(d.age);
  if (age >= 65 || (age > 0 && age < 2)) score += 12;
  if (d.conditions.some((c) => ["Cardiopatía", "Diabetes", "Asma/EPOC", "Embarazo"].includes(c))) score += 6;
  score = Math.min(100, score);
  let cat = d.pain >= 9 || score >= 75 ? 2 : score >= 45 ? 3 : score >= 15 ? 4 : 5;
  const redFlags = (d.redFlags ?? []).filter((flag) => RED_FLAGS.includes(flag));
  if (redFlags.length) cat = 1;
  const va = vitalAlerts(vitals);
  for (const x of va) cat = Math.min(cat, x.cat);
  const level = LEVELS[cat - 1] ?? "Azul";
  return { level, score, alerts: [...redFlags, ...va.map((x) => x.msg)] };
}

export function waitMinutes(r: TriageRecord, now = Date.now()) { return Math.floor((now - r.createdAt) / 60000); }
export function isOverdue(r: TriageRecord, now = Date.now()) {
  if (r.status !== "En Espera") return false;
  const max = LEVEL_INFO[r.level]?.maxWait ?? 240;
  return now - (r.triagedAt ?? r.createdAt) > max * 60000;
}

/** Argentine DNI PDF417: tramite@APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISION */
export function parseDniPdf417(raw: string, today = new Date()) {
  const p = raw.trim().split("@");
  if (p.length < 7) return null;
  const [, last, first, sex, dni, , birth] = p;
  if (!dni || !/^\d{7,8}$/.test(dni) || !first?.trim() || !last?.trim()) return null;
  const m = (birth ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  let age = "";
  if (m) {
    const b = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (b.getFullYear() !== Number(m[3]) || b.getMonth() !== Number(m[2]) - 1 || b.getDate() !== Number(m[1]) || b > today) return null;
    let a = today.getFullYear() - b.getFullYear();
    if (today < new Date(today.getFullYear(), b.getMonth(), b.getDate())) a--;
    age = String(a);
  }
  const cap = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return { name: cap(`${first} ${last}`), dni, sex: sex === "M" ? "Masculino" : sex === "F" ? "Femenino" : "Prefiero no decirlo", age };
}

/** Matrícula Nacional (MN) or Provincial (MP) — format check, SISA-linkable. */
export function isValidMatricula(m: string) { return /^(MN|MP)[\s-]?\d{3,7}$/i.test(m.trim()); }

export function anonymize(r: Pick<TriageRecord, "name" | "dni">) {
  const ini = r.name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase()).join(".");
  return `${ini}. — DNI ***${r.dni.replace(/\D/g, "").slice(-3)}`;
}

/** HL7 FHIR R4 Bundle: Patient + Encounter + Observations (vitals with LOINC, findings with SNOMED CT). */
export function toFhir(r: TriageRecord) {
  const pid = `patient-${r.id}`, eid = `encounter-${r.id}`;
  const loinc: [keyof Vitals, string, string, string][] = [
    ["sys", "8480-6", "Presión sistólica", "mm[Hg]"], ["dia", "8462-4", "Presión diastólica", "mm[Hg]"], ["hr", "8867-4", "Frecuencia cardíaca", "/min"],
    ["spo2", "59408-5", "SatO2", "%"], ["rr", "9279-1", "Frecuencia respiratoria", "/min"], ["temp", "8310-5", "Temperatura", "Cel"], ["gcs", "9269-2", "Glasgow", "{score}"],
  ];
  const obs = [
    ...loinc.filter(([k]) => n(r.vitals?.[k]) !== null).map(([k, code, display, unit]) => ({
      resourceType: "Observation", status: "final", subject: { reference: `Patient/${pid}` }, encounter: { reference: `Encounter/${eid}` },
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
      code: { coding: [{ system: "http://loinc.org", code, display }] }, valueQuantity: { value: n(r.vitals?.[k]), unit },
    })),
    ...r.symptoms.map((s) => ({
      resourceType: "Observation", status: "final", subject: { reference: `Patient/${pid}` }, encounter: { reference: `Encounter/${eid}` },
      code: { coding: [{ system: "http://snomed.info/sct", code: SNOMED[s] ?? "404684003", display: s }] }, valueBoolean: true,
    })),
  ];
  return {
    resourceType: "Bundle", type: "collection",
    timestamp: new Date().toISOString(),
    entry: [
      { resource: { resourceType: "Patient", id: pid, identifier: [{ system: "http://www.renaper.gob.ar/dni", value: r.dni }], name: [{ text: r.name }], gender: r.sex === "Masculino" ? "male" : r.sex === "Femenino" ? "female" : "unknown", telecom: [{ system: "phone", value: r.phone }, { system: "email", value: r.email }] } },
      { resource: { resourceType: "Encounter", id: eid, status: r.status === "Atendido" ? "finished" : r.status === "En Evaluación" ? "in-progress" : "arrived", class: { code: "EMER", display: "emergency" }, subject: { reference: `Patient/${pid}` }, period: { start: new Date(r.createdAt).toISOString() }, priority: { coding: [{ code: String(LEVEL_INFO[r.level].cat), display: `Categoría ${LEVEL_INFO[r.level].cat} — ${r.level}` }] }, reasonCode: [{ text: r.motivo }], participant: r.matricula ? [{ individual: { identifier: { system: "https://sisa.msal.gov.ar/matricula", value: r.matricula } } }] : [] } },
      ...obs.map((resource) => ({ resource })),
    ],
  };
}

/** Validates consent and computes the automatic level for a new registration (ticket/id assigned by the database). */
export function prepareRegistration(d: TriageData) {
  if (!d.consent) throw new Error("Se requiere consentimiento informado para registrar los datos");
  const { level, score, alerts } = computeUrgency(d);
  return { ...d, level, autoLevel: level, score, alerts, status: "En Espera" as Status };
}

/** Nurse triage with vitals; manual override requires a justification. Appends to history. */
export function buildTriage(r: TriageRecord, vitals: Vitals, matricula: string, manual?: { level: Level; reason: string }, triagedAt = Date.now()): TriageRecord {
  if (!isValidMatricula(matricula)) throw new Error("Matrícula inválida");
  if (Object.keys(validateVitals(vitals)).length) throw new Error("Revisá los signos vitales marcados");
  if (manual && manual.reason.trim().length < 5) throw new Error("Justificación requerida");
  const auto = computeUrgency(r, vitals);
  const level = manual?.level ?? auto.level;
  const professional = matricula.trim().toUpperCase();
  const revision = { at: triagedAt, vitals: { ...vitals }, matricula: professional, level, autoLevel: auto.level, ...(manual ? { reason: manual.reason.trim() } : {}), alerts: auto.alerts };
  const { override: _prev, ...base } = r;
  return { ...base, vitals, matricula: professional, autoLevel: auto.level, score: auto.score, alerts: auto.alerts, level,
    ...(manual && manual.level !== auto.level ? { override: { reason: manual.reason.trim(), from: auto.level } } : {}),
    triagedAt, triageHistory: [...(r.triageHistory ?? []), revision] };
}

export function useNow(ms = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
