# Consolidation Plan: Characteristic Existence and Value Tests

Companion to `characteristics_refactor_plan.md` and `characteristics_bugs.md`.
Scope: `module/testing/`. Counts come from the current working tree.

## 1. Goal

State each characteristic rule once.
Read every characteristic in a test through one helper.
Make one edit cover a new characteristic or actor type.

## 2. Current state

### 2.1 Existence tests (`hasCharacteristic`)

| File                                      | Assertions | Fixture                      | Subject                                           |
| ----------------------------------------- | ---------- | ---------------------------- | ------------------------------------------------- |
| `testing-default-characteristics.mjs`     | 20         | bare `Actor.create`          | 7 actor types × {5e, 6e}                          |
| `testing-vehicles.mjs`                    | 18         | uploaded vehicle templates   | SIZE, STR, DEX, BODY, SPD, OCV, DCV, PD, ED, STUN |
| `testing-base.mjs`                        | 16         | uploaded base templates      | BASESIZE, BODY, DEF, PD, ED, STUN, SIZE, OCV, DCV |
| `testing-automaton.mjs`                   | 5          | uploaded automaton templates | STUN, driven by automaton powers                  |
| `testing-5e-calculated-active-effect.mjs` | 5          | uploaded PC                  | Guards, not assertions                            |

41 assertions. Four asserting files. Three fixture kinds. No shared table.

### 2.2 Value tests

`system.characteristics` appears 662 times across 14 test files.

| File                                      | Hits | Kind                                                               |
| ----------------------------------------- | ---- | ------------------------------------------------------------------ |
| `testing-full.mjs`                        | 176  | `<char>.max` and `<char>.realCost` in 176 hand-written `it` blocks |
| `testing-upload.mjs`                      | 115  | Post-upload values. 20 direct model mutations                      |
| `testing-5e-calculated-active-effect.mjs` | 109  | Figured values under ActiveEffects. 32 AE change keys              |
| `testing-adjustment-fade.mjs`             | 83   | STR value and max across a fade timeline                           |
| `testing-vehicles.mjs`                    | 52   | Value plus `realCost` per characteristic                           |
| `testing-combat-tracker.mjs`              | 42   | stun/end/rec during recovery. 11 update payload keys               |
| `testing-status-effects.mjs`              | 29   | stun/body writes that drive statuses                               |
| `testing-world-time.mjs`                  | 13   | rec/stun/end recovery over world time                              |
| `testing-combat-workflow.mjs`             | 11   | stun/ed/str before and after damage                                |
| `testing-active-effects.mjs`              | 9    | flight max, body/rec                                               |
| `testing-defense.mjs`                     | 8    | `ed.value` after defense changes                                   |
| `testing-base.mjs`                        | 7    | Values plus an exact-set count                                     |
| `testing-movement-end.mjs`                | 2    | `running.max` duplicates the defaults                              |
| `testing-default-characteristics.mjs`     | 6    | Local `getVal` helper reads                                        |

630 of those hits are dotted reads that bypass `getCharacteristic()`.
That set is bucket H in `characteristics_refactor_plan.md` §Phase 8.

### 2.3 Defects

1. **No shared assertion vocabulary.** Every file hand-writes
   `actor.system.characteristics.<x>.<field>`.
2. **Tests bypass the funnel.** 630 dotted reads skip `getCharacteristic()`.
   The funnel cannot change shape until these move.
3. **Duplicate coverage.** Default `running`/`swimming`/`leaping` values live in three
   files: `testing-default-characteristics.mjs:74-93`, `testing-movement-end.mjs:199,210`,
   and `testing-vehicles.mjs`.
4. **Copy-paste bulk.** `testing-full.mjs` repeats 176 near-identical three-line `it`
   blocks. `testing-vehicles.mjs` repeats 34 "should have the correct X" blocks.
   `testing-base.mjs` repeats two whole `describe` bodies.
5. **Mixed assertion styles.** Some files use `assert.*`, others use `expect(...).to.*`.
6. **Mixed label case.** `hasCharacteristic("RUNNING")` sits beside `getVal("running")`.
7. **Direct model mutation.** `testing-upload.mjs` writes
   `actor.system.characteristics.dex.value = 15` 20 times. That skips `_preUpdate`, so a
   test can pass on a state the app cannot produce.
8. **Having a characteristic and having its node are unlinked.** No test asserts that `hasCharacteristic(x) === true`
   implies `getCharacteristic(x)` returns a node. Bug 3 in `characteristics_bugs.md` says
   the two methods read different objects.
9. **No single source of truth.** Adding one actor type touches five files.

## 3. Target design

Three pieces: one helper module, one consolidated contract suite, one converted cost suite.
Behavior suites keep their tests and adopt the helper.

### 3.1 Helper — `module/testing/characteristic-assertions.mjs`

Not a Quench batch. Any test file imports it. Quench hands each batch its own `assert`, so
helpers bind to it once per batch.

```js
// Plain exports. No assert needed.
charNode(actor, label)                                  // actor.getCharacteristic(label); the only read path
charValue(actor, label)
charMax(actor, label)
charLabels(actor)                                       // usable labels for this actor type (permission set)

// Bound helpers.
const chars = createCharacteristicAssertions(assert);
chars.assertHasChar(actor, label, msg)
chars.assertLacksChar(actor, label, msg)
chars.assertCharField(actor, label, field, expected)
chars.assertCharFields(actor, label, { value, max, base, realCost })
chars.assertCharTable(actor, { str: { max: 11, realCost: 1 }, ... })
chars.assertHasCharacteristicMatrix(actor, { has: [], lacks: [] })
chars.assertExactCharSet(actor, [...labels])
await chars.setChar(actor, label, value, { field = "value", updateOptions })
await chars.setChars(actor, { stun: -5, end: 10 })
```

Rules the helper enforces:

- Accept any label case. Normalize once. Report the canonical label.
- Fail with `<actor.type> [<edition>] <LABEL>.<field>: expected X, got Y`.
- Read `system.characteristics` nowhere except `charNode`.
- `setChar` calls `actor.update()` or `actor.updateCharacteristics()`. It never assigns to
  the model.

### 3.2 Suite — `actor.characteristics` (static contract)

Rename `testing-default-characteristics.mjs` to `testing-characteristics.mjs`.
Keep the batch key `${game.system.id}.actor.characteristics`.
Caller examples in `CONTRIBUTING.md` and the refactor plan stay valid.

Describe layout:

| Describe                                      | Fixture                                           | Content                            |
| --------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Has characteristic by actor type              | bare `Actor.create` × 7 types × {5e, 6e}          | `assertHasCharacteristicMatrix`    |
| Default values by actor type                  | same actors                                       | `assertCharTable`                  |
| Has characteristic by template                | uploaded 5e base, 6e base, 6e vehicle, 5e vehicle | `assertHasCharacteristicMatrix`    |
| Values by template                            | same fixtures                                     | `assertCharTable`                  |
| Has characteristic driven by automaton powers | uploaded automaton variants                       | moved from `testing-automaton.mjs` |
| Unknown actor type coverage                   | none                                              | unchanged                          |

One data table drives the whole suite:

```js
const HAS_CHARACTERISTIC = {
    pc:    { has: [...], lacks: [...] },
    npc:   { has: [...], lacks: [...] },
    base2: { has: ["BODY", "BASESIZE"], lacks: ["RUNNING", "SWIMMING", "LEAPING"] },
    // ...
};

const DEFAULTS = {
    pc: { "6e": { running: 12, swimming: 4, leaping: 4 }, "5e": { running: 6, swimming: 2, leaping: 2 } },
    // ...
};
```

Build the table from `CONFIG.HERO.powers6e`/`powers5e` and `ignoreForActor` for shape.
Hand-check the exceptions: COM, DEF, GLIDING, and the six movement powers (bugs 3 and 4).

### 3.2.1 Where the label universe comes from

Status: **done.** No test file hand-maintains a label list, and the `// TODO: This could be created
from powers` comment that sat above the old movement tables is gone: those tables are derived now.

`module/config.mjs` has one generator and two builders. The generator reads the `type` mark and yields
each key once, so the mark is interpreted in one place. Each derived property is assigned directly
below the section that fills its input list:

| Derived property                     | Assigned at              | Right below                     |
| ------------------------------------ | ------------------------ | ------------------------------- |
| `characteristicPowers6e` and `...5e` | `module/config.mjs:2020` | `addCharacteristicsToPowerList` |
| `movementPowers6e` and `...5e`       | `module/config.mjs:3256` | `addMovementToPowerList`        |

Section-local assignment matters. A derivation at the end of the file sits after every section, so any
code that reads the property while a later section runs sees `undefined`. `addPower` fills
`HERO.powers6e` and `HERO.powers5e` incrementally, and `USABLEAS` lives in
`addModifiersToPowerList`, thousands of lines after the movement section. The lists are still complete
at their new positions: no section outside those two adds `type: ["characteristic"]` or
`type: ["movement"]`, which is a grep you can rerun.

| Property                    | Shape                        |  6e |  5e |
| --------------------------- | ---------------------------- | --: | --: |
| `characteristicPowers6e/5e` | Sorted uppercase label array |  29 |  31 |
| `movementPowers6e/5e`       | Lowercase key to power name  |   9 |  10 |

Movement display names come from `power.name`, which `addPower` fills from the XML `ALIAS` when a
description omits it. One exception list remains:

```js
const MOVEMENT_KEYS_WITHOUT_VALUE = freezeDeep(["FIXEDLOCATION", "FLOATINGLOCATION"]);
```

Hero Designer models both as options on Teleportation. This system stores them as powers, so they carry
`type: ["movement"]`, yet no actor owns a value for either. Build them as adders on TELEPORTATION and
the list can go away.

`HERO.movementPowers` is now `HERO.movementPowers6e` everywhere: both run-time uses in
`module/config.mjs`, `module/item/item.mjs:654`, `module/utility/movement.mjs:69`, the pinned-history
comment in `module/migration.mjs:593`, and the test file. `movementPowerTable` picks the table per
edition, `ownedMovementKeys` reads its keys, and `movementDisplayName` reads the 5e map, so the tables
are production truth, not test scaffolding.

The test file builds one universe per edition from these four properties:

```js
function universeFor(edition) {
  const movementTable = edition === "5e" ? CONFIG.HERO.movementPowers5e : CONFIG.HERO.movementPowers6e;
  const movement = Object.keys(movementTable).map((key) => key.toUpperCase());
  const labels = [...CONFIG.HERO[`characteristicPowers${edition}`], ...movement];

  return [...new Set(labels)].filter((label) => !CUSTOM_LABELS.includes(label)).sort();
}
```

Measured: the 6e universe holds 28 labels, the 5e universe 31. Only 5e adds `COM`, `DEF`, and
`GLIDING`. No label exists in 6e alone. Read these at run time, never at module load.

`HAS_CHARACTERISTIC` stays hand-written. Its rows feed `hasCharacteristic`, and `hasCharacteristic`
reads `ignoreForActor` out of that same config, so derived expectations always agree with the code
under test. Generate the rows from a live world once, then keep them by hand.

A config edit cannot pass quietly. A new characteristic-typed entry enters both universes, so all 14
type-and-edition tests must either place it in a row or assert its absence. That is louder than a
snapshot guard, and it needs no maintenance.

The token HUD now reads the same table. `initializeMovementActions`
(`module/token/heroSystemTokenHud.mjs:216`) sets each movement label to `movementDisplayName(key)`.
Two labels changed wording, and drift is now impossible:

| HUD key                    | Was                | Now                        |
| -------------------------- | ------------------ | -------------------------- |
| `FTL`                      | Faster Than Light  | Faster-Than-Light Travel   |
| `EXTRADIMENSIONALMOVEMENT` | Dimensional Travel | Extra-Dimensional Movement |

`none` and `displace` keep their own labels. They are Foundry movement state, not powers, so the
table has no entry for them. `initializeMovementActions` runs inside the `init` hook at
`module/herosystem6e.mjs:185`, after `CONFIG.HERO` fills at line 139, so the lookup has data.

Verified live: keys 9 and 10, both tables frozen, characteristic lists 29 and 31, and
`CONFIG.HERO.movementPowers` is `undefined`. USABLEAS validation still works, because it matches the
movement **key**, not the display name: alias `Usable as swimming` yields no warning, alias
`Usable as telekinesis` yields `Unable to determine USABLEAS movement type` with all nine keys listed.
Full run: `suites 692  tests 2989  passes 2944  pending 45  failures 0` in 104 s, `pageErrors 0`.

### 3.2.2 Where the actor scope comes from

Three tables used to sit in `testing-characteristics.mjs`. All three now come from config.

| Removed table           | Replacement                                        | Source                                            |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------- |
| `CUSTOM_LABELS`         | `CONFIG.HERO.customCharacteristicLabels`           | hand-written list in `config.mjs`                 |
| `CREATABLE_ACTOR_TYPES` | `CONFIG.HERO.creatableActorTypes`                  | hand-written list in `config.mjs`                 |
| `HAS_CHARACTERISTIC`    | `CONFIG.HERO.characteristicHasTypes6e` and `...5e` | derived from every description's `ignoreForActor` |

`staticIgnoreForActorFunction` exposes the actor types it ignores as `ignoreForTypes`. The derivation
subtracts that list from `creatableActorTypes`, per label, per edition. A description with a dynamic
`ignoreForActor` declares no scope, so its entry is `null`. STUN is the only such label: the automaton
powers "cannot be stunned" and "BODY damage removes the ability to act" decide it, and the flag lives on
the actor. `DYNAMIC_LABEL_OWNERSHIP` in the test file answers for `null` entries, and one guard test per
edition fails if a `null` entry has no rule. A second guard test fails if a declared scope names a type
no actor creates, which would otherwise read as "every type has it".

The suite now splits each contract by accessor, because movement modes leave characteristic storage:

- `listsFor(actorType, edition)` returns `{ characteristics, movement }`, each with `has` and `lacks`.
- The characteristics half asserts through `assertHasCharacteristicMatrix`.
- The movement half asserts through `assertHasMovementMatrix`, which calls the new
  `HeroSystem6eActor.hasMovementCharacteristic`: the characteristic node first, then an active item with
  the label as its XMLID.
- `MOVEMENT_MODES_WITHOUT_NODE` lists the seven labels with no uppercase node, so a bare actor, which
  owns no items, answers false for them. See bug 4.
- A template row can now add labels through `hasBecauseOfPowers`. The two vehicle rows name `FLIGHT`,
  and the 5e row names `FTL`, because those templates buy movement a bare vehicle does not have.

The ten custom-characteristic tests are no longer skipped. Each one creates a bare actor and asserts no
type has any custom label, which is true today because nothing builds them.

### 3.3 Suite — `characteristics.cost` (uploaded value and real cost)

New batch `${game.system.id}.characteristics.cost`.
Move the three pure-characteristic describes out of `testing-full.mjs`:
`Characteristics 5e simple`, `Characteristics 5e buyback`, `Characteristics 5e negative COM`.
They contain no powers, no items, and no DC logic. They answer only "what value and cost does
this characteristic have after upload".

Convert each to one `assertCharTable` call. Generate one `it` per characteristic inside the
scenario `describe`, so Quench report granularity stays the same.
That replaces 99 `it` blocks and 176 dotted reads with three tables.

Leave the other 21 `testing-full.mjs` describes in place. They test powers, items, and DCs.
Their characteristic reads are incidental. Convert those reads with the helper in Phase 5.

### 3.4 What stays put

Behavior suites keep their tests. They observe a characteristic; they do not define one.
They adopt the helper for reads and writes, and nothing else moves.

| Suite                                     | Why it stays                                           |
| ----------------------------------------- | ------------------------------------------------------ |
| `testing-adjustment-fade.mjs`             | Tests the fade timeline, not the STR contract          |
| `testing-status-effects.mjs`              | Tests status transitions driven by stun/body           |
| `testing-world-time.mjs`                  | Tests recovery over elapsed time                       |
| `testing-combat-tracker.mjs`              | Tests recovery during combat                           |
| `testing-combat-workflow.mjs`             | Tests damage application end to end                    |
| `testing-defense.mjs`                     | Tests ED after defense adjustments                     |
| `testing-active-effects.mjs`              | Tests AE application                                   |
| `testing-5e-calculated-active-effect.mjs` | Tests the figured-value state machine                  |
| `testing-upload.mjs`                      | Tests the upload pipeline                              |
| `testing-movement-end.mjs`                | Tests END cost. Drop its two duplicate default asserts |

## 4. Migration steps

Run each phase to green before the next one.

### Phase 1 — Add the helper — **DONE**

1. Created `module/testing/characteristic-assertions.mjs` (343 lines).
2. `assert` binds per batch through `createCharacteristicAssertions(assert)`. Quench hands
   each batch its own `assert`, so the helper takes it as a factory argument.
3. `charNode`, `charValue`, `charMax`, and `charLabels` are also plain exports. They need no
   `assert`.
4. Added `setChars` beyond the original nine. Having a
   characteristic and having its node differ (bug 3), and combat tests write stun and END together.
5. Changed no test.

Verified:

- `npx oxlint` and `npx oxfmt --check` pass.
- Stubbed harness at `/tmp/char-assert-harness/run.mjs` imports the real module and exercises
  22 cases: every happy path, every failure path, unknown-field rejection, blank-label
  rejection, and the writer tuplets. All behave as intended.
- Failure messages carry actor type, edition, canonical label, and field:
  `[pc 6e] STR.max | got=15 want=99`.

Re-run the harness with `node /tmp/char-assert-harness/run.mjs`. It stubs
`module/utility/util.mjs` through a Node module resolve hook, so it needs no Foundry client.
Port it into the repo before Phase 6 if you want it in CI.

Verify: `npm run lint` passes. Import the module from one existing suite without behavior change.

### Phase 2 — Consolidate existence tests

1. Rename `testing-default-characteristics.mjs` to `testing-characteristics.mjs`.
   Keep the batch key. Update the import and call in `testing-main.mjs`. **Done.**
2. Add the `HAS_CHARACTERISTIC` table, one row per actor type per edition. The driver derives
   `lacks` from `CHARACTERISTIC_LABELS`, so every row tests both halves. Generate the rows from a
   live world; do not type them. **Done: 14 tests, 7 types x 2 editions.**
3. Move the has-characteristic `it` blocks from `testing-base.mjs` to `Has characteristic by
   template`. **Done: 11 blocks removed.**
4. Move the 18 has-characteristic `it` blocks from `testing-vehicles.mjs`. **Done.**
5. Move the 5 STUN has-characteristic `it` blocks from `testing-automaton.mjs`.
   Leave every "recognize that it has the ... automaton power" test untouched. **Done.**
   A power can take STUN away while the actor type stays the same, so a template row names the
   labels it drops in `lacksBecauseOfPowers`.
6. Convert the five `hasCharacteristic` guards in `testing-5e-calculated-active-effect.mjs` to a
   node test. **Rejected.** See below.

**Phase 2 step 6, rejected**

The guards ask "does this actor type have REC", not "is there a stored REC node". Both storage
paths exist for almost every label on every type: `system.characteristics.rec` always, and
`system.REC` except for the six movement powers. A swap changed behaviour, so the plan drops it.

Measured on the same tree, before and after the swap:

| Guard               | Vehicle                                                                     | Base2                                                                               |
| ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `hasCharacteristic` | skips, test passes                                                          | skips, test passes                                                                  |
| stored node test    | `[vehicle] Figured REC calculation ratio mismatch.: expected +0 to equal 4` | `[base2] Active effect failed to modify DEX max proxy.: expected 10 to be above 10` |

Keep the guards. They ask the permission question and answer it correctly.

Verify: `grep -rn "hasCharacteristic" module/testing` returns only the helper and the matrix
driver. Full Quench run of `actor.characteristics`, `actor.base`, `actor.vehicle`, and
`automaton` passes.

### Phase 3 — Consolidate default values

1. Add the `DEFAULTS` table to `testing-characteristics.mjs`.
2. Move the template default values from `testing-base.mjs` and `testing-vehicles.mjs` into
   `Values by template`.
3. Delete the duplicate `running.max` asserts at `testing-movement-end.mjs:199` and `:210`.
   Keep the END cost assertions. Add a comment pointing at `actor.characteristics`.

Verify: `grep -rn "running.max\|swimming.max\|leaping.max" module/testing` returns only the
helper, the tables, and intentional non-default cases.

### Phase 4 — Convert the cost suite

1. Create the `characteristics.cost` batch in a new `testing-characteristic-cost.mjs`.
2. Move the three pure-characteristic describes from `testing-full.mjs`.
3. Replace each block of `it` calls with one `assertCharTable` plus a generated `it` per
   characteristic.
4. Register the new batch in `testing-main.mjs`.

Verify: the moved scenarios report the same 99 test titles as before.
Diff the Quench JSON report against a pre-move baseline.

### Phase 5 — Funnel every read and write

1. Replace all 630 dotted reads with `charNode` or `assertCharField(s)`.
2. Replace the 20 direct mutations in `testing-upload.mjs` with `setChar`.
3. Leave ActiveEffect change-key literals (`key: "system.characteristics.dex.max"`) alone.
   They are persisted data, per bucket D of the refactor plan.
4. Leave update payload keys alone until `updateCharacteristics()` lands.

Verify the grep gates:

```sh
# No dotted model reads outside the helper.
grep -rn "system\.characteristics\.[a-z]*\.[a-z]" module/testing \
  | grep -v characteristic-assertions.mjs | grep -v 'key: "system\.characteristics' \
  | grep -v '"system\.characteristics\.[^"]*":'
# Expected: no output. Today this reports 536 lines.

# No direct model mutation anywhere in tests.
grep -rn "system\.characteristics\.[a-z]*\.[a-z]* *=[^=]" module/testing
# Expected: no output. Today this reports 20 lines, all in testing-upload.mjs.
```

### Phase 6 — Cleanup

1. Delete the emptied `describe` bodies and dead fixtures.
2. Update `CONTRIBUTING.md` with the new suite names and the helper's purpose.
3. Mark bucket H in `characteristics_refactor_plan.md` as done, and link this file.
4. Run `npm run validate`.

## 5. Guardrails

- **Keep batch keys stable.** Existing caller scripts select by name. Add keys additively.
  Never rename `actor.characteristics`.
- **Shared fixtures are read-only.** A test that mutates an actor creates its own.
  A shared mutated fixture makes the next test order-dependent.
- **Never share a fixture file between suites.** Each suite keeps its own uploaded XML, even when
  two suites upload the same template. Duplication beats coupling: a shared fixture file lets one
  suite break another. Phase 2 tried `characteristic-template-fixtures.mjs` and removed it.
- **Failed tests keep their actors.** `deleteQuenchActor` skips deletion on failure.
  Global teardown still sweeps `_Quench` actors, so leaks stay bounded.
- **Test title churn breaks saved selections.** `window.herosystem6eTestNames` output changes
  when titles move. Update any saved run recipes with the Phase 4 diff.
- **Do not change `hasCharacteristic` semantics from this work.** Bugs 3 and 4 in
  `characteristics_bugs.md` stay open. This plan only consolidates assertions.
- **The `HAS_CHARACTERISTIC` table can be wrong.** A bad row creates a false failure, not a false pass.
- **Existence means `hasCharacteristic`.** Never test whether a characteristic node exists. Every
  actor type stores a node for every label, so a node test passes for characteristics the actor
  does not have. Read a node only to read a value.
  Cross-check every row against `ignoreForActor` before merging.
- **One phase per commit.** A revert must undo one concern.

## 6. Acceptance criteria

1. Adding a new actor type's characteristic contract requires one table edit in
   `testing-characteristics.mjs`.
2. Both grep gates in Phase 5 return no output.
3. `hasCharacteristic` appears in tests only inside the helper and the matrix driver.
4. No test mutates `actor.system.characteristics` directly.
5. `npm run validate` passes.
6. A full Quench run passes with the same or a documented lower test count.
7. Total lines under `module/testing/` drop. Target: at least 1,500 lines removed.

## 7. Effort

| Phase            | Estimate | Risk                      |
| ---------------- | -------- | ------------------------- |
| 1 — Helper       | 0.5 day  | Low                       |
| 2 — Existence    | 1 day    | Medium: fixture moves     |
| 3 — Defaults     | 0.5 day  | Low                       |
| 4 — Cost suite   | 1 day    | Medium: report parity     |
| 5 — Funnel reads | 2 days   | High: 630 sites, 14 files |
| 6 — Cleanup      | 0.5 day  | Low                       |

Phases 1 through 4 stand alone and deliver the single-source-of-truth goal.
Phase 5 is the coupling to the funnel refactor. Schedule it after the funnel contract settles.
