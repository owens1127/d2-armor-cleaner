# Dupewise — Full Product & Engineering Plan

Destiny 2 armor vault management tool: learn your build preferences, suggest dupe rules from vault shape, resolve redundant Tier 5 armor with guided comparisons, and sync keep/junk tags to DIM.

Inspired by [tier5.report](https://tier5.report/) heatmap UX, extended with preference learning and batch DIM tagging.

---

## 1. Executive summary

### Problem
- Tier 5 / Armor 3.0 creates many functionally similar pieces (same archetype, tertiary, tuning).
- [tier5.report](https://tier5.report/) shows *where* duplicates cluster but leaves keep/junk decisions manual.
- DIM has tags and search (`is:statlower`, `dupe:archetype+tertiarystat`) but no guided workflow or learned preferences.

### Solution
A web app with three layers:

1. **Dupe definition** — configurable grouping (tier5 parity) + vault-aware rule suggestions.
2. **Preference learning** — swipe/rank calibration so the app learns stat, set, and tuning priorities.
3. **Action & inference** — dupe duels within buckets, bulk DIM tags, and want-scores on all armor.

### Core principles
- **Classes are independent** — Titan, Hunter, and Warlock each have their own vault scan, heatmap, dupe buckets, and cleaning sessions.
- **Preferences are usually global** — stat weights, archetype/tertiary/tuning prefs, and set priorities apply to all classes unless the user opts into per-class overrides.
- **Dupes only in duels** — comparison UI only runs inside configured dupe buckets (count ≥ 2).
- **Tinder-style is one pattern** — also used for preference calibration, not the whole product.

---

## 2. User personas & goals

| Persona | Goal |
|---------|------|
| **Vault bloated** | Reduce 100+ T5 pieces per class with confidence |
| **Set chaser** | Keep best copy per set/slot, junk cross-set dupes |
| **Min-maxer** | Same tuning stat within buckets, stat dominance matters |
| **Casual cleaner** | App suggests rules + defaults, minimal config |

---

## 3. End-to-end user journey

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. LOGIN                                                                │
│    Bungie OAuth → DIM Sync token exchange                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. VAULT SCAN (per class, parallel fetch)                               │
│    Parse T5 armor → build ClassVaultState                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. DUPE RULE SUGGESTIONS (per class + global default)                   │
│    Impact preview → user accepts / customizes                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. PREFERENCE CALIBRATION (global, ~15–25 interactions)                 │
│    Stat rank · archetype focus · set pairwise · tertiary/tuning swipes  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. CLASS DASHBOARD                                                      │
│    Heatmap · dupe counts · want-score overlay · item feed               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
        ┌───────────────────────────┴───────────────────────────┐
        ↓                                                       ↓
┌───────────────────┐                               ┌───────────────────┐
│ 6a. CLEAN DUPES   │                               │ 6b. BROWSE ALL    │
│ Duels in buckets  │                               │ Inference scores  │
└───────────────────┘                               └───────────────────┘
        ↓                                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. REVIEW & APPLY                                                       │
│    Undo stack · bulk DIM tag POST · summary + DIM deep links            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 8. ONGOING                                                              │
│    Re-scan on focus · new drops scored · rule hints if vault grows        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Domain model (Destiny 2 Armor 3.0)

### 4.1 Stats (6)
| Stat | Old Armor 2.0 name |
|------|---------------------|
| Weapons | Mobility |
| Grenade | Discipline |
| Super | Intellect |
| Melee | Strength |
| Health | Resilience |
| Class | Recovery |

### 4.2 Archetypes
| Archetype | Primary | Secondary |
|-----------|---------|-----------|
| Gunner | Weapons | Grenade |
| Grenadier | Grenade | Super |
| Paragon | Super | Melee |
| Brawler | Melee | Health |
| Bulwark | Health | Class |
| Specialist | Class | Weapons |

Each piece has a **tertiary stat** (one of the four stats not in primary/secondary).

### 4.3 Tier 5 specifics
- 75 base stats (30 / 25 / 20 split by archetype).
- **Tuning stat** — one stat can be shifted via tuning mods (+5/−5 or +1 balanced).
- Up to **6 effective stat configurations** per piece when comparing (DIM models this for `is:statlower`).

### 4.4 Armor sets
From `equipableItemSetHash` → `DestinyEquipableItemSetDefinition` (name, set perks at 2/4/5 pieces).

### 4.5 Scope
- **MVP:** Tier 5 legendary armor only (tier5.report parity).
- **Later:** Tier 4+, artifice legacy rules if needed.

---

## 5. Architecture

### 5.1 High-level

```
┌──────────────────────────────────────────────────────────────┐
│                     React SPA (Vite + TS)                     │
├──────────────┬───────────────┬──────────────┬────────────────┤
│   Auth       │  Vault Engine │  Prefs ML    │  UI Shell      │
│   Bungie+    │  Parse·Group  │  Score·Learn │  Heatmap·Swipe │
│   DIM Sync   │  Suggest rules│  Infer       │  Review·Apply  │
└──────┬───────┴───────┬───────┴──────┬───────┴────────┬───────┘
       │               │              │                │
       ▼               ▼              ▼                ▼
  Bungie.net API   Manifest cache   localStorage    DIM Sync API
                   (IndexedDB)      (prefs profile)  (tags)
```

**MVP:** Client-only SPA. No backend required.
**Later:** Optional backend for encrypted pref sync, analytics, manifest proxy.

### 5.2 Tech stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Build | Vite + React 19 + TypeScript | Fast dev; matches tier5 ecosystem |
| Styling | Tailwind CSS 4 + shadcn/ui | Dark dashboard aesthetic |
| State | Zustand | Session decisions, vault cache, prefs |
| Persistence | localStorage + IndexedDB | Prefs + manifest cache |
| Auth | Bungie OAuth 2.0 (PKCE) | Community standard |
| APIs | Bungie.net + DIM Sync | Inventory + tags |
| Types | `@destinyitemmanager/dim-api-types` | DIM tag shapes |

### 5.3 External APIs

#### Bungie.net
- OAuth: read inventory, membership.
- Endpoints: profile, character inventory, item components (sockets, stats, instance data).
- Manifest: `DestinyInventoryItemDefinition`, `DestinyEquipableItemSetDefinition`, `DestinySandboxPerkDefinition`, stat definitions.

#### DIM Sync ([dim-api](https://github.com/DestinyItemManager/dim-api))
- `POST /auth/token` — exchange Bungie token for DIM token.
- `GET /profile?components=tags` — read tags.
- `POST /profile` — bulk `{ action: "tag", payload: { id, tag } }`.
- Tags: `keep` | `junk` | `favorite` | `infuse` | `archive`.

**Dev setup:** Register Bungie app + `POST https://api.destinyitemmanager.com/new_app` for localhost DIM key. Production key via DIM Discord.

---

## 6. Data models

### 6.1 Parsed armor item

```typescript
interface ArmorPiece {
  instanceId: string;
  itemHash: number;
  name: string;
  classType: 'titan' | 'hunter' | 'warlock';
  armorSlot: 'helmet' | 'arms' | 'chest' | 'legs' | 'classItem';
  tier: number;                    // gear tier 1–5
  power: number;
  location: 'vault' | 'character' | 'postmaster';
  characterId?: string;

  archetype: Archetype;
  baseStats: Record<Stat, number>; // non-zero only (3 stats)
  tertiaryStat: Stat;
  tuningStat?: Stat;

  armorSet?: {
    hash: number;
    name: string;
    perks: { name: string; description: string; icon?: string }[];
  };

  isMasterwork: boolean;
  dimTag?: TagValue | null;

  // Computed at score time
  statConfigurations?: StatVector[];  // tuning permutations
  wantScore?: number;
  wantConfidence?: 'low' | 'medium' | 'high';
  isDupe?: boolean;
  isIgnored?: boolean;
}
```

### 6.2 Dupe configuration

```typescript
interface DupeRuleConfig {
  minTier: number;                  // default 5

  // Bucket key components (all required for match)
  matchClass: true;                 // always true
  matchSlot: true;
  matchArchetype: true;
  matchTertiaryStat: true;

  // Optional strictness
  sameArmorSet: boolean;
  sameTuningStat: boolean;

  // Community heuristics (tier5 parity)
  dupeModeBogOnMyDog: boolean;      // exclude bad tertiary combos from dupe groups
  dupeModeMarruk: boolean;          // flag dupes with mismatched tuning

  // DIM tag filters
  ignoreTaggedInfuse: boolean;
  ignoreTaggedJunk: boolean;
  ignoreTaggedKeep: boolean;
  ignoreTaggedFavorite: boolean;
  ignoreTaggedArchive: boolean;

  filterArmorSetHashes: number[];   // empty = all sets
}

interface DupeBucketKey {
  classType: ClassType;
  armorSlot: ArmorSlot;
  archetype: Archetype;
  tertiaryStat: Stat;
  armorSetHash?: number;            // when sameArmorSet
  tuningStat?: Stat;                // when sameTuningStat
}

interface DupeBucket {
  key: DupeBucketKey;
  items: ArmorPiece[];
  hasDupes: boolean;                // items.length >= 2 after ignore filters
}
```

### 6.3 Class vault state (independent per class)

```typescript
interface ClassVaultState {
  classType: ClassType;
  items: ArmorPiece[];
  buckets: DupeBucket[];
  profile: VaultProfile;
  ruleSuggestions: DupeRuleSuggestion[];
  activeDupeRules: DupeRuleConfig;
  lastScannedAt: number;
}

interface VaultProfile {
  totalT5: number;
  totalBySlot: Record<ArmorSlot, number>;
  dupeBucketCount: Record<'loose' | 'standard' | 'setAware' | 'tuning' | 'full'>, number>;
  heavyBuckets: number;             // 5+ items in a bucket
  mixedSetBuckets: number;
  mixedTuningBuckets: number;
  taggedKeepInDupes: number;
  uniqueBucketRatio: number;
  largestBucket: { key: DupeBucketKey; count: number };
}
```

### 6.4 Preference profile (global with optional overrides)

```typescript
interface PreferenceProfile {
  version: number;
  calibratedAt?: number;
  calibrationCount: number;

  statWeights: Record<Stat, number>;
  archetypeWeights: Record<Archetype, number>;
  tertiaryWeights: Record<Archetype, Partial<Record<Stat, number>>>;
  tuningWeights: Record<Archetype, Partial<Record<Stat, number>>>;
  setWeights: Record<number, number>;   // set hash → weight
  setCompletionBonus: number;           // 0–1 multiplier

  buildMode: 'pve' | 'pvp' | 'mixed';

  defaultDupeRules: DupeRuleConfig;

  classOverrides?: Partial<Record<ClassType, Partial<PreferenceProfile>>>;
}
```

**Resolution order:** `classOverrides[class].field ?? global.field`

### 6.5 Session state

```typescript
interface CleaningSession {
  id: string;
  classType: ClassType;
  startedAt: number;
  decisions: DupeDecision[];
  pendingTags: { instanceId: string; tag: TagValue | null }[];
}

interface DupeDecision {
  bucketKey: DupeBucketKey;
  keptId: string;
  junkedIds: string[];
  wasRecommendationFollowed: boolean;
  timestamp: number;
}

interface CalibrationEvent {
  type: 'stat_rank' | 'archetype_pick' | 'tertiary_pair' | 'tuning_pair' | 'set_pair';
  payload: Record<string, unknown>;
  timestamp: number;
}
```

---

## 7. Dupe engine

### 7.1 Parsing pipeline (port tier5.report logic)

1. Filter manifest `tierType === 5` and legendary armor buckets.
2. **Archetype** — intrinsic plug hash map:
   - `1807652646` → Gunner, `3349393475` → Brawler, etc.
3. **Base stats** — sum visible socket `investmentStats` mapped via stat type hash.
4. **Tertiary** — the one stat with value > 0 not in `archetypePrimarySecondary[archetype]`.
5. **Tuning stat** — from reusable plugs hash map (tier5 `Y0` table).
6. **Armor set** — `itemDef.equippingBlock.equipableItemSetHash`.
7. **DIM tag** — merge from DIM Sync profile.

### 7.2 Bucket grouping

```typescript
function bucketKey(item: ArmorPiece, rules: DupeRuleConfig): string {
  const parts = [
    item.classType,
    item.armorSlot,
    item.archetype,
    item.tertiaryStat,
  ];
  if (rules.sameArmorSet) parts.push(String(item.armorSet?.hash ?? 0));
  if (rules.sameTuningStat) parts.push(String(item.tuningStat ?? 'none'));
  return parts.join('|');
}
```

Apply `isIgnored` from DIM tag filters before grouping.

Mark `isDupe = true` when bucket has ≥ 2 non-ignored items.

### 7.3 Impossible cells (heatmap)

Cell is **impossible** when column stat is primary or secondary for row archetype (diagonal stripe UI from tier5).

### 7.4 Dupe-only duel queue

Only buckets where `hasDupes === true`. Sort queue by:
1. Item count descending (worst buckets first)
2. Sum of want-score ambiguity (closest scores = higher priority)

---

## 8. Rule suggestion engine

### 8.1 Presets

| Preset ID | sameArmorSet | sameTuningStat | ignoreKeep | Typical vault |
|-----------|--------------|----------------|------------|---------------|
| `loose` | false | false | false | < 60 T5/class |
| `standard` | false | false | true | 60–120 T5 |
| `setAware` | true | false | true | many cross-set dupes |
| `tuning` | false | true | true | mixed tuning in buckets |
| `strict` | true | true | true | 120+ T5, min-max |

### 8.2 Algorithm

For each class:
1. Run bucket grouping under each preset (reuse same parsed items).
2. Compute metrics per preset:
   - `dupeBucketCount`
   - `itemsToReview` (sum of bucket sizes − 1 per bucket)
   - `falseDupeRisk` (cross-set or cross-tuning spread in top buckets)
3. Score presets:

```
score = w1 * itemsToReview_normalized
      + w2 * falseDupeRisk_reduction
      - w3 * too_strict_penalty   // buckets drop below useful threshold
```

4. Emit `DupeRuleSuggestion[]` with human-readable reasons and impact deltas.

### 8.3 Example suggestion card

```
Suggested for Hunter: Same armor set
────────────────────────────────────
Why: 11 of your 18 largest buckets mix 2+ sets.
Impact: 34 dupe groups → 41 groups, 78 → 54 items to review
[Apply to Hunter] [Apply to all classes] [Customize]
```

### 8.4 Strictness slider (UX)

Maps 0–100 to preset interpolation:
- 0–25: loose
- 25–50: standard
- 50–75: set-aware
- 75–90: tuning
- 90–100: strict

Slider updates live preview counts.

---

## 9. Preference learning

### 9.1 Calibration steps (global default)

| Step | Interaction | Updates |
|------|-------------|---------|
| 1. Build mode | PvE / PvP / Mixed | stat weight priors |
| 2. Stat rank | Drag-rank 6 stats | `statWeights` |
| 3. Archetype focus | Pick top 2–3 archetypes | `archetypeWeights` |
| 4. Set priority | Pairwise set cards (5–8) | `setWeights` |
| 5. Tertiary swipes | Per focused archetype | `tertiaryWeights` |
| 6. Tuning swipes | Per focused archetype | `tuningWeights` |

Minimum viable: steps 1–2 + one archetype tertiary round (~12 interactions).

### 9.2 Learning updates

**Pairwise win (Bradley-Terry simplified):**

```typescript
function recordPairwiseWin(winner: Feature, loser: Feature, weights: Map<Feature, number>) {
  const lr = 0.15;
  weights.set(winner, (weights.get(winner) ?? 0.5) + lr * (1 - sigmoid(diff)));
  weights.set(loser, (weights.get(loser) ?? 0.5) - lr * sigmoid(diff));
}
```

**Dupe decision feedback:**
- User keeps item A over B → boost features A has, penalize B (set, tuning, stats).
- User overrides recommendation → stronger learning rate for that feature class.

**Confidence:**
- `high`: ≥ 10 decisions on this archetype/set
- `medium`: 3–9
- `low`: < 3 → show “calibrate more” prompt

### 9.3 Per-class overrides (advanced)

Settings → “Different prefs per class?” → enable tabs.
Only overridden fields stored in `classOverrides[class]`.
Duels still update global unless override flag set for that dimension.

---

## 10. Scoring & inference

### 10.1 Item score function

```typescript
function scoreItem(item: ArmorPiece, prefs: PreferenceProfile, vault: ClassVaultState): ScoreBreakdown {
  const statFit = dot(normalizeStats(item), prefs.statWeights);
  const archetypeFit = prefs.archetypeWeights[item.archetype];
  const tertiaryFit = prefs.tertiaryWeights[item.archetype]?.[item.tertiaryStat] ?? 0.5;
  const tuningFit = item.tuningStat
    ? (prefs.tuningWeights[item.archetype]?.[item.tuningStat] ?? 0.5)
    : 0;
  const setFit = (prefs.setWeights[item.armorSet?.hash ?? 0] ?? 0)
    + setCompletionBonus(item, vault, prefs.setCompletionBonus);
  const tierBonus = item.tier === 5 ? 0.1 : 0;
  const mwBonus = item.isMasterwork ? 0.05 : 0;
  const dominance = statDominanceScore(item, vault.items);  // Pareto vs same slot

  return {
    total: weightedSum(...),
    explanation: buildExplanationStrings(...),
    confidence: prefs.calibrationCount >= 15 ? 'high' : 'low',
  };
}
```

### 10.2 Stat dominance (DIM-aligned)

- Compare as-if masterworked.
- Expand Tier 5 tuning mod permutations (up to 6 configs).
- If item A is strictly worse in all configs vs any same-slot piece → `dominance = -1` (auto-junk candidate).

### 10.3 Set completion bonus

```typescript
function setCompletionBonus(item: ArmorPiece, vault: ClassVaultState, multiplier: number): number {
  if (!item.armorSet) return 0;
  const owned = countSetPieces(vault.items, item.armorSet.hash);
  const thresholds = [2, 4, 5];
  const nextThreshold = thresholds.find(t => owned < t);
  if (!nextThreshold) return 0.2 * multiplier; // complete set
  return (nextThreshold - owned) / 5 * multiplier;
}
```

### 10.4 Want / skip labels

| Score percentile | Label |
|------------------|-------|
| Top 20% in class | **Keep eye on** |
| Middle | **Neutral** |
| Bottom 20% | **Low priority** |
| dominance < 0 | **Safe dismantle** (even if not dupe) |

---

## 11. UI specification

### 11.1 Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing + login |
| `/onboarding/rules` | Dupe rule suggestions |
| `/onboarding/calibrate` | Preference wizard |
| `/dashboard/:class` | Heatmap + summary |
| `/clean/:class` | Dupe duel session |
| `/review` | Pending tags + undo |
| `/settings` | Rules, prefs, overrides, API |

### 11.2 Class dashboard (tier5-inspired)

- Left: class icon + vertical label.
- Grid columns: 6 archetypes (armor view) OR 4 tertiary stats (archetype view toggle).
- Rows: 5 armor slots.
- Cell content:
  - Count (green) in tuning mode; icon stack otherwise.
  - Pink dot if `hasDupes`.
  - Red X if empty.
  - Stripes if impossible.
  - Red dotted outline on tuning icons if multiple share tuning stat.
  - Background tint by avg `wantScore` (inference overlay).
- Header: shared prefs summary + class vault stats.
- Per-class suggestion chip if rules differ from global.

### 11.3 Dupe duel screen

- Side-by-side cards: icon, name, power, stat bars, set perks, tuning.
- Recommendation badge + expandable “Why”.
- Actions: Keep left / Keep right / Skip bucket / Undo.
- Keyboard: `←` `→` `S` `U`.
- Progress: `n / totalDecisions`.
- Touch: swipe optional (Phase 3).

### 11.4 Calibration screens

- **Drag-rank:** 6 stat chips, vertical list.
- **Swipe:** two cards, label above (“Which tertiary for Gunner?”).
- Progress dots, skip allowed.

### 11.5 Review & apply

- Table: item, action (keep/junk), class, bucket, undo.
- “Apply N tags to DIM” button.
- Success → links: `tag:junk` search in DIM, copy `id:` query.
- Error handling: partial apply, retry failed.

---

## 12. Project structure

```
dupewise/
├── PLAN.md
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── components/
│   │   ├── ui/              # shadcn
│   │   ├── heatmap/
│   │   ├── duel/
│   │   ├── calibration/
│   │   └── review/
│   ├── lib/
│   │   ├── bungie/
│   │   │   ├── auth.ts
│   │   │   ├── api.ts
│   │   │   └── manifest.ts
│   │   ├── dim/
│   │   │   ├── auth.ts
│   │   │   └── tags.ts
│   │   ├── armor/
│   │   │   ├── parse.ts
│   │   │   ├── constants.ts   # archetype hashes, tuning hashes
│   │   │   └── stats.ts       # tuning permutations, dominance
│   │   ├── dupes/
│   │   │   ├── group.ts
│   │   │   ├── rules.ts
│   │   │   └── suggest.ts
│   │   ├── prefs/
│   │   │   ├── profile.ts
│   │   │   ├── calibrate.ts
│   │   │   └── learn.ts
│   │   └── scoring/
│   │       ├── score.ts
│   │       └── explain.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── vaultStore.ts      # ClassVaultState × 3
│   │   ├── prefsStore.ts
│   │   └── sessionStore.ts
│   └── types/
│       └── index.ts
└── docs/
    └── tier5-reverse-engineering.md   # optional reference notes
```

---

## 13. Implementation phases

### Phase 0 — Project setup (1–2 days)
- [ ] Vite + React + TS + Tailwind + shadcn
- [ ] Env template (Bungie key, client id/secret, redirect URI, DIM key)
- [ ] Routing skeleton
- [ ] Zustand stores scaffold
- [ ] Type definitions from §6

### Phase 1 — Auth & data (3–5 days)
- [ ] Bungie OAuth PKCE flow
- [ ] Membership + profile fetch
- [ ] Manifest download + IndexedDB cache
- [ ] Armor parser (`parse.ts`) — parity with tier5 `RM()` function
- [ ] DIM token exchange + tag read
- [ ] Unit tests: parser fixtures from known item JSON

### Phase 2 — Dupe engine & suggestions (3–4 days)
- [ ] Bucket grouping + ignore filters
- [ ] Vault profile metrics
- [ ] Preset comparison + suggestion cards
- [ ] Strictness slider + live preview
- [ ] Per-class independent `ClassVaultState`

### Phase 3 — Heatmap dashboard (3–4 days)
- [ ] Grid layout (armor / archetype view modes)
- [ ] Cell states: empty, impossible, count, dupe dot, tuning mode
- [ ] Class tabs (Titan / Hunter / Warlock)
- [ ] Click cell → bucket detail panel
- [ ] Item list sorted like tier5

### Phase 4 — Preference calibration (3–4 days)
- [ ] Global `PreferenceProfile` persistence
- [ ] Stat drag-rank + archetype pick
- [ ] Pairwise swipe components
- [ ] Learning updates on each interaction
- [ ] Optional per-class override UI

### Phase 5 — Scoring & inference (3–4 days)
- [ ] `scoreItem()` + explanation strings
- [ ] Stat dominance + tuning permutations
- [ ] Set completion bonus
- [ ] Want-score overlay on heatmap + item feed

### Phase 6 — Dupe duels & review (4–5 days)
- [ ] Duel queue from dupe buckets only
- [ ] Recommendation from scorer
- [ ] Decision store + undo
- [ ] Tournament for 3+ items (single elimination)
- [ ] Review screen
- [ ] Bulk DIM tag apply

### Phase 7 — Polish & ship (3–5 days)
- [ ] Re-scan on window focus (tier5 pattern)
- [ ] Loading / error states
- [ ] Mobile responsive
- [ ] Swipe gestures for calibration + duels
- [ ] README + deploy (Vercel/Netlify)
- [ ] Request production DIM API key

**Estimated MVP:** ~4–6 weeks part-time.

---

## 14. Testing strategy

| Area | Approach |
|------|----------|
| Armor parser | Golden fixtures from Bungie API sample JSON |
| Bucket grouping | Table-driven tests per preset |
| Rule suggester | Synthetic vault profiles (small/large/mixed) |
| Scoring | Assert ordering on hand-crafted item pairs |
| Learning | Pairwise sequence → weights move expected direction |
| DIM tags | Mock fetch; integration test with real API in dev |
| E2E | Playwright: login mock → calibrate → duel → review |

---

## 15. Security & privacy

- OAuth tokens in memory + sessionStorage (not localStorage for secrets).
- DIM token same treatment.
- Preference profile in localStorage (no PII).
- No server = no vault data leaves client except Bungie/DIM APIs.
- Clear “Logout clears tokens” action.

---

## 16. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Bungie API breaking changes | Pin manifest version; defensive parsing |
| DIM API key approval delay | Dev on localhost key first |
| Bad auto-junk recommendation | Never auto-apply; always review step; dominance-only auto-suggest |
| Overwhelming calibration | Skippable wizard; defaults from PvE meta weights |
| Class-specific meta shifts | Per-class override escape hatch |
| Large vault performance | Web worker for grouping/scoring; memoize buckets |

---

## 17. Future enhancements (post-MVP)

- Tier 4 armor support
- Export CSV / DIM loadout strings
- Backend sync for prefs across devices
- Community set tier lists (importable weights)
- “Quick clean” — auto-junk strict dominance dupes with one confirm
- Compare non-dupe items (explicit compare mode)
- Integration with DIM search export (`dupe:archetype+tertiarystat`)

---

## 18. Success metrics

- User completes calibration + cleans ≥ 1 class in first session.
- ≥ 80% of duel recommendations accepted (model is useful).
- Average session tags ≥ 10 items junk + keeps applied to DIM.
- Rule suggestion acceptance rate tracked (improve heuristics).

---

## 19. Reference links

- [tier5.report](https://tier5.report/)
- [DIM Sync API](https://github.com/DestinyItemManager/dim-api)
- [DIM Tags wiki](https://github.com/DestinyItemManager/DIM/wiki/Tags-and-Notes)
- [Armor 3.0 guide](https://shatteredvault.com/kb/armour-buildcrafting/)
- [DIM dupe search (`dupe:archetype+tertiarystat`)](https://github.com/DestinyItemManager/DIM/blob/master/docs/CHANGELOG.md)

---

## 20. Open decisions (defaults chosen)

| Question | Default for MVP |
|----------|-----------------|
| Tier scope | T5 only |
| Strictness UI | Slider + preset cards |
| Auto-junk | Suggest only, never silent apply |
| Pref storage | localStorage |
| Per-class rules | Global default + per-class suggestion apply |
| Per-class prefs | Off until user enables |

---

*Document version: 1.0 — consolidates product discussions through May 2026.*
