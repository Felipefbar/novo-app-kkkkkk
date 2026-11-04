<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application rules
- Patient records live in the shared cloud database (`triage_records`, full record in `record` jsonb) so a companion appointments app can use the same backend; staff use real accounts with the `staff` role, public sign-up stays off.
- Public screens never read the table: the kiosk writes through `register_patient` and the waiting room reads `waiting_room_queue` (anonymized); keep it that way to protect patient privacy.
- Cloud reads/writes live in `src/lib/triage-store.ts`; `src/lib/triage.ts` stays pure so rules remain testable.
- Keep triage rules, vital measurement constraints, and category times in `src/lib/triage.ts`; shared definitions prevent inconsistent registration and nurse views.
- Append triage revisions and consent timestamps rather than replacing prior assessment history; this provides demo traceability, not tamper-proof auditing.
