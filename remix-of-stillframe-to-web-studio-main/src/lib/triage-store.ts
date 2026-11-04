import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { LEVELS, buildTriage, prepareRegistration, type Level, type Status, type TriageData, type TriageRecord, type Vitals } from "./triage";

function fromRow(row: { id: string; ticket: string; level: string; status: string; record: Json; created_at: string }): TriageRecord {
  const r = row.record as unknown as TriageRecord;
  return {
    ...r,
    id: row.id,
    ticket: row.ticket,
    level: (LEVELS as readonly string[]).includes(row.level) ? (row.level as Level) : "Amarillo",
    status: row.status as Status,
    createdAt: r.createdAt ?? new Date(row.created_at).getTime(),
  };
}

/** Public kiosk registration; the database assigns id and ticket. */
export async function addRecord(d: TriageData): Promise<TriageRecord> {
  const rec = prepareRegistration(d);

  // Enrich record with SNOMED codes before saving for better interoperability
  const enrichedRecord = {
    ...rec,
    symptoms_coded: rec.symptoms.map(s => ({
      term: s,
      code: (require('./triage').SNOMED)[s] || "404684003" // Default: Finding unspecified
    }))
  };

  const { data, error } = await supabase.rpc("register_patient", { _record: enrichedRecord as unknown as Json });
  if (error) throw new Error("No se pudo guardar el registro");
  return data as unknown as TriageRecord;
}

async function saveRecord(r: TriageRecord) {
  const { error } = await supabase.from("triage_records").update({ record: r as unknown as Json, level: r.level, status: r.status }).eq("id", r.id);
  if (error) throw new Error("No se pudo guardar el cambio");
}

export async function updateStatus(r: TriageRecord, status: Status) {
  await saveRecord({ ...r, status });
}

export async function applyTriage(r: TriageRecord, vitals: Vitals, matricula: string, manual?: { level: Level; reason: string }) {
  await saveRecord(buildTriage(r, vitals, matricula, manual));
}

/** Staff-only list, kept live across devices. */
export function useRecords() {
  const [records, setRecords] = useState<TriageRecord[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("triage_records").select("id, ticket, level, status, record, created_at").order("created_at");
      if (alive && data) setRecords(data.map(fromRow));
    };
    void load();
    const channel = supabase
      .channel(`triage-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "triage_records" }, () => { void load(); })
      .subscribe();
    const t = setInterval(load, 30000);
    return () => { alive = false; clearInterval(t); void supabase.removeChannel(channel); };
  }, []);
  return records;
}

export type QueueItem = { id: string; ticket: string; initials: string; dniTail: string; level: Level; status: Status; createdAt: number };

/** Anonymized public queue for the waiting-room screen. */
export function useWaitingQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("waiting_room_queue");
      if (alive && data) setItems(data.map((q) => ({
        id: q.id, ticket: q.ticket, initials: q.initials ?? "", dniTail: q.dni_tail ?? "",
        level: (LEVELS as readonly string[]).includes(q.level) ? (q.level as Level) : "Amarillo",
        status: q.status as Status, createdAt: new Date(q.created_at).getTime(),
      })));
    };
    void load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return items;
}

/** Signed-in staff session (null = signed out, undefined = still checking). */
export function useStaffSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function staffLogin(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return !error;
}
export async function staffLogout() { await supabase.auth.signOut(); }
