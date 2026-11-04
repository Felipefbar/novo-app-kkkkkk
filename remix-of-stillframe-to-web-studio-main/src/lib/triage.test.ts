import { describe, it, expect } from "vitest";
import { computeUrgency, emptyData, emptyVitals, parseDniPdf417, isValidMatricula, anonymize, isOverdue, LEVEL_INFO, RED_FLAGS, validateVitals, prepareRegistration, buildTriage, type TriageRecord } from "./triage";

describe("computeUrgency (5 niveles)", () => {
  it("pain 10 is at least Naranja", () => expect(computeUrgency({ ...emptyData, pain: 10 }).level).toBe("Naranja"));
  it("no complaint is Azul", () => expect(computeUrgency({ ...emptyData, age: "30", onset: "> 3 días" }).level).toBe("Azul"));
  it("SatO2 < 90 forces Rojo", () => expect(computeUrgency({ ...emptyData, age: "30" }, { ...emptyVitals, spo2: "85" }).level).toBe("Rojo"));
  it("Glasgow 8 forces Rojo", () => expect(computeUrgency({ ...emptyData }, { ...emptyVitals, gcs: "8" }).level).toBe("Rojo"));
  it("HR 130 forces Naranja", () => expect(computeUrgency({ ...emptyData }, { ...emptyVitals, hr: "130" }).level).toBe("Naranja"));
});

describe("DNI PDF417", () => {
  it("parses Argentine DNI barcode", () => {
    const r = parseDniPdf417("00123456789@PEREZ@JUAN CARLOS@M@30123456@A@15/03/1980@01/01/2015", new Date(2026, 9, 29));
    expect(r).toEqual({ name: "Juan Carlos Perez", dni: "30123456", sex: "Masculino", age: "46" });
  });
  it("rejects garbage", () => expect(parseDniPdf417("hola")).toBeNull());
});

describe("matrícula / privacidad / re-triaje", () => {
  it("accepts MN and MP", () => { expect(isValidMatricula("MN 123456")).toBe(true); expect(isValidMatricula("MP-4521")).toBe(true); expect(isValidMatricula("123")).toBe(false); });
  it("anonymizes", () => expect(anonymize({ name: "Juan Perez", dni: "30.123.456" })).toBe("J.P. — DNI ***456"));
  it("Amarillo overdue after 60 min", () => {
    const r = { level: "Amarillo", status: "En Espera", createdAt: 0 } as TriageRecord;
    expect(isOverdue(r, 60 * 60000)).toBe(false);
    expect(isOverdue(r, 61 * 60000)).toBe(true);
  });
});

describe("critical findings and category times", () => {
  it.each(RED_FLAGS)("escalates %s to immediate assessment", (flag) => {
    const result = computeUrgency({ ...emptyData, redFlags: [flag] });
    expect(result.level).toBe("Rojo");
    expect(result.alerts).toContain(flag);
  });
  it.each([ ["Rojo", 0], ["Naranja", 30], ["Amarillo", 60], ["Verde", 180], ["Azul", 240] ] as const)("%s has maximum %i minutes", (level, minutes) => {
    expect(LEVEL_INFO[level].maxWait).toBe(minutes);
    const r = { level, status: "En Espera", createdAt: 0 } as TriageRecord;
    expect(isOverdue(r, minutes * 60000)).toBe(false);
    expect(isOverdue(r, minutes * 60000 + 1)).toBe(true);
  });
  it("does not alert patients already being evaluated", () => {
    expect(isOverdue({ level: "Rojo", status: "En Evaluación", createdAt: 0 } as TriageRecord, 60000)).toBe(false);
  });
  it("times re-triage from the latest assessment while preserving arrival", () => {
    const r = { level: "Amarillo", status: "En Espera", createdAt: 0, triagedAt: 120 * 60000 } as TriageRecord;
    expect(isOverdue(r, 150 * 60000)).toBe(false);
    expect(isOverdue(r, 181 * 60000)).toBe(true);
  });
});

describe("measurement and record integrity in simulation", () => {
  it("rejects Glasgow outside 3–15 and fractional scores", () => {
    for (const gcs of ["2", "16", "8.5"]) expect(validateVitals({ ...emptyVitals, gcs }).gcs).toBeDefined();
    expect(validateVitals({ ...emptyVitals, gcs: "15" }).gcs).toBeUndefined();
  });
  it("rejects saturation above 100 percent and malformed measurements", () => {
    expect(validateVitals({ ...emptyVitals, spo2: "101" }).spo2).toBeDefined();
    expect(validateVitals({ ...emptyVitals, temp: "38..5" }).temp).toBeDefined();
    expect(validateVitals({ ...emptyVitals, temp: "38.5" })).toEqual({});
  });
  const base = (): TriageRecord => ({ ...prepareRegistration({ ...emptyData, consent: true }), id: "1", ticket: "V-001", createdAt: 1000, consentAt: 1000 });
  it("requires explicit consent", () => {
    expect(() => prepareRegistration(emptyData)).toThrow("consentimiento");
    expect(prepareRegistration({ ...emptyData, consent: true }).status).toBe("En Espera");
  });
  it("rejects invalid measurements before saving triage", () => {
    expect(() => buildTriage(base(), { ...emptyVitals, spo2: "101" }, "MN 123456")).toThrow("signos vitales");
  });
  it("requires a justification for overriding the automatic level", () => {
    expect(() => buildTriage(base(), emptyVitals, "MN 123456", { level: "Rojo", reason: "" })).toThrow("Justificación");
  });
  it("retains prior vitals and justified overrides in assessment history", () => {
    const first = buildTriage(base(), { ...emptyVitals, spo2: "85" }, "MN 123456");
    const saved = buildTriage(first, { ...emptyVitals, spo2: "98" }, "MP 12345", { level: "Amarillo", reason: "Reevaluación clínica" });
    expect(saved.triageHistory).toHaveLength(2);
    expect(saved.triageHistory?.[0]?.vitals.spo2).toBe("85");
    expect(saved.triageHistory?.[0]?.level).toBe("Rojo");
    expect(saved.triageHistory?.[1]?.reason).toBe("Reevaluación clínica");
    expect(saved.level).toBe("Amarillo");
    expect(saved.createdAt).toBe(1000);
  });
  it("rejects impossible DNI birth dates", () => {
    expect(parseDniPdf417("001@PEREZ@JUAN@M@30123456@A@31/02/1980")).toBeNull();
  });
});
