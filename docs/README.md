# Raynet (Nami) — docs index

Read these in this order. If two docs disagree, the earlier one wins, unless `DECISIONS.md` says otherwise.

1. `DECISIONS.md`: the decisions we've locked, how we deviate from the Codex source docs, and open questions
2. `PRD.md`: what we build, scope (P0/P1/P2), acceptance criteria, demo story and rubric mapping
3. `TRD.md`: architecture, stack, data model, state machines, APIs, adapters, security, tests
4. `AGENTS.md`: agent roster, prompts, tool schemas and the eval harness
5. `DESIGN.md`: website pages, design tokens, mascot asset list, animation contract and lip-sync
6. `BUILD-PLAN.md`: hour-by-hour plan, gates, P0 checklist, form answers and survey
7. `source/`: the original Codex specs (workflow and mascot). They are still authoritative on **care behaviour** wherever our docs are silent.
8. `../research/`: sourced problem data
9. `PROGRESS.md`: what has been built so far, what is simulated, and what is still needed

## Canonical names

Use exactly these names in code, the UI and the pitch.

| Thing | Name |
|---|---|
| Product | **Raynet** (was Nami Care until D21) |
| Mascot | **Nami** |
| User persona | **Meera Sharma** ("Meera ji"), Jaipur |
| Primary contact | **Arjun** (son) |
| Backup contact | **Priya** (daughter) |
| Clinic | **Dr. Mehta Clinic** |
| Engine | Workflow engine |
| Agents | Caller, Clinic simulator, Extractor, Verifier, Family alert, Story keeper |
| Case state names | As written in `TRD.md` §5 |
