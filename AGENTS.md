# AGENTS.md

## Purpose

This file is the canonical coding policy for the **Aegis** Gunbot custom strategy repository.

This project exists to build a **single-file Gunbot custom strategy** in plain JavaScript that lives in `./customStrategies/Aegis.js` and runs fully inside Gunbot.

Gunbot already handles exchange API connections, market data plumbing, pair execution, and order placement.
We are not rebuilding a bot engine.
We are building a premium strategy file.

This document is written for agentic coding tools, especially Codex.
It is the single source of truth for project scope, coding style, architecture, observability requirements, session continuity, and delivery order.

---

## Project Identity

### Brand name

**Aegis**

### Strategy file

**Aegis.js**

### Repository name

**aegis-gunbot**

### Product positioning

Aegis is a **premium defensive momentum and pullback strategy** for Gunbot spot trading.

It should feel:

* selective, not hyperactive
* structured, not random
* premium, not gimmicky
* explainable, not black-box nonsense
* productized, so it can be sold later

### Commercial goal

Design Aegis so it can later be:

* sold as a premium custom strategy file
* tuned per pair and per market profile
* listed as a leader/copytrading product if performance and operational reliability justify it

Do not build vague “works on everything” marketing.
Build something real, legible, and pair-tunable.

---

## Hard Scope Boundary

### What we are building now

We are building **one JavaScript strategy file** for Gunbot:

* `./customStrategies/Aegis.js`

### What we are not building first

Do not start by building:

* a separate external bot engine
* a full dashboard
* a TypeScript sidecar
* a cron-heavy orchestration layer
* a multi-file deployment requirement for runtime
* a dependence on external infrastructure for the strategy to function

### External logic policy

External data or helper services are allowed only later, and only if they provide a clear edge.

For version 1, the strategy must remain **self-contained inside Gunbot**.

That means:

* use Gunbot data first
* use Gunbot methods first
* use Gunbot indicators or locally computed indicators first
* avoid external dependencies unless there is a proven reason

Simplicity, stability, and ease of sale matter more than novelty.

---

## Codex First Task

Before coding strategy logic, Codex must do a short but serious **capability audit**.

### Required audit targets

1. inspect the local Gunbot folder structure relevant to custom strategies
2. inspect official Gunbot custom strategy docs
3. inspect local example custom strategies
4. inspect any locally accessible paid or public strategy examples for architecture ideas only
5. identify what data is actually available in runtime through `gb.data`
6. identify what order and utility methods are available through `gb.method`
7. identify what extra OHLCV or modules can be loaded safely
8. identify what can be persisted safely in `gb.data.pairLedger.customStratStore`
9. identify what can be shown in sidebar, chart visuals, and GUI notifications
10. identify how pair overrides are exposed via `gb.data.pairLedger.whatstrat`
11. identify whether safe custom logging to file is useful for debug mode
12. document all findings in `LOG.md`

### Audit rule

Codex must not guess runtime capabilities when they can be verified from docs, snippets, or local examples.

### Ethics rule

If reference strategies are inspected:

* learn patterns
* learn architecture
* learn tuning philosophy
* do not clone proprietary logic line-for-line
* do not copy commercial code and lightly rename it

We are building an original strategy.

---

## Technical Reality

### Runtime target

Assume Gunbot custom strategies run in a **conservative Node.js environment** and write code accordingly.

### Language

The strategy file must be **plain JavaScript**.

### Compatibility rules

* prefer conservative syntax
* avoid fancy tooling assumptions
* avoid requiring a build step for runtime use
* avoid syntax that may fail in older Node runtimes
* keep the final runtime artifact to one plain `.js` file

### Single-file rule

The deployed strategy must be one file.

Internal helper functions inside that file are encouraged.
But the runtime delivery should remain:

* easy to drop into `./customStrategies/`
* easy to select in the GUI
* easy to distribute to customers

---

## Design Philosophy

Aegis must not be an indicator soup.

Aegis should combine:

* market regime filtering
* pullback structure recognition
* wick rejection or reclaim logic
* volatility awareness
* disciplined DCA only when justified
* partial exits and trailing logic
* clear telemetry
* strong chart visualization

This should look like a strategy built by someone who wants longevity, not just a flashy backtest.

---

## Core Strategy Thesis

### High-level idea

Aegis is a **regime-filtered execution strategy**.
It should enter only when:

* the broader context is acceptable
* local price structure offers value
* momentum is recovering rather than exhausted
* volatility is tradable, not chaotic
* liquidity conditions are acceptable

### Strategy personality

Aegis should behave like:

* patient during chop
* opportunistic on pullbacks
* defensive in weak regimes
* assertive when trend and reclaim line up

### Primary market fit

Best suited initially for:

* liquid Binance spot pairs
* high-liquidity majors and selected strong secondaries
* profiles such as BTC/USDT, ETH/USDT, PAXG/USDT, possibly SOL/USDT later

Do not optimize first for illiquid trash.

---

## Proposed Version 1 Algorithm

### Strategy name

**Aegis Regime Reclaim**

### Summary

A multi-layer spot strategy that buys pullbacks and reclaim patterns inside an allowed regime, avoids dead chop where possible, and exits with partial profit-taking plus a volatility-adaptive runner.

### Layer 1 — regime gate

Allow longs only when a higher timeframe regime passes.
Potential components:

* price above a higher timeframe baseline
* EMA slope agreement
* trend strength threshold
* optional bearish suppression mode

This should stop the strategy from blindly buying every dip.

### Layer 2 — value zone detection

Define a pullback area where entries are allowed.
Potential components:

* pullback toward fast/medium EMA band
* pullback toward rolling mean zone
* deviation from recent local impulse
* avoid entries after vertical extension

### Layer 3 — reclaim / rejection confirmation

Do not buy only because price is lower.
Require evidence of response.
Potential components:

* lower wick rejection
* close back above a trigger level
* reclaim of short-term EMA or mean zone
* oscillator recovery from reset state

### Layer 4 — momentum sanity

Momentum should confirm recovery, not late exhaustion.
Potential components:

* RSI rising from reset zone
* custom momentum delta positive
* stochRSI or wave-based confirmation only if it remains easy to debug

### Layer 5 — liquidity sanity

Avoid stupid entries in bad conditions.
Potential components:

* spread ceiling
* minimum volume condition
* skip candles with abnormal disorder
* optional order book pressure filter if runtime data is stable and useful

### Entry score

Use a simple point score so the strategy stays legible.
For example:

* regime passed
* in value zone
* wick rejection present
* momentum recovering
* spread acceptable

Only buy if the minimum score is reached.

Keep the score transparent in code and logs.

### DCA logic

DCA is allowed only under strict conditions.

DCA rules should include:

* regime still valid
* sufficient price distance from last fill
* max add count not exceeded
* no panic mode active
* no invalidation trigger active
* not allowed if the original thesis has clearly failed

DCA must not be used as blind averaging.

### Exit logic

Exits should be layered and readable.

Required:

* TP1 partial exit
* TP2 or runner transition
* trailing runner based on realized progress or volatility
* invalidation exit
* stale-trade time exit if trade goes nowhere too long

### Re-entry rule

After an exit, avoid instant revenge entries unless the setup fully resets.

---

## Better Ideas Pulled From Gunbot Docs

### 1. Make the chart part of the product

Aegis must not only trade well.
It must **show its logic visually**.

Use Gunbot chart tools to render:

* buy trigger line
* invalidation line
* TP1 line
* trailing line
* DCA line
* optional support / value-zone rectangle
* optional reclaim area path

A premium strategy that explains itself on-chart is easier to debug, easier to tune, and easier to sell.

### 2. Use sidebar metrics aggressively

Every cycle should publish compact sidebar telemetry such as:

* regime state
* entry score
* reclaim state
* bag phase
* DCA count
* active trail price
* invalidation price
* skip reason

The strategy should feel alive and self-explanatory in the Gunbot GUI.

### 3. Use GUI notifications only for meaningful events

Do not spam notifications every cycle.
Only notify on state transitions such as:

* setup armed
* entry fired
* DCA fired
* TP1 taken
* runner active
* invalidation exit
* regime disabled after being enabled

### 4. Prefer persistence for lightweight state, not truth

Use `customStratStore` for supplementary state such as:

* cooldown timestamp
* last action timestamp
* active phase
* stored trail price
* DCA count
* last entry score
* chart state cache if needed

Do not make critical truth depend entirely on persistent storage when the same truth can be derived from exchange state, open orders, balances, or pair ledger data.

### 5. Use AutoConfig later, not in v1 runtime

AutoConfig is useful later for operational tasks such as:

* adding or rotating approved pairs
* scheduling profile changes
* toggling safer presets during certain sessions
* managing product presets at scale

Do not make Aegis depend on AutoConfig to function.
AutoConfig is an ops layer, not the core edge.

### 6. Avoid programmatic config rewrites in the strategy unless there is a very strong reason

Gunbot supports writing config changes from a strategy, but this creates fragility.
Aegis should prefer pair overrides and transparent GUI control.
Direct config rewriting should be avoided in v1.

### 7. Learn from official examples, not just from competitors

Codex should study official Gunbot examples for:

* simple order flow
* loading additional modules
* computing custom indicators
* multi-timeframe ideas
* safe timing between actions
* trailing-target state handling

But Aegis should remain architecturally original.

---

## Strategy Architecture Inside One File

Even though delivery is one file, code must be structured internally.

Use clearly separated function blocks.

### Required internal sections

1. metadata and version block
2. defaults and override reads
3. state initialization
4. data normalization helpers
5. regime functions
6. structure / pullback functions
7. momentum functions
8. liquidity functions
9. entry scoring block
10. entry decision block
11. DCA decision block
12. exit decision block
13. chart visualization block
14. sidebar metrics block
15. GUI notification block
16. logging helpers
17. main async execution flow

Do not dump everything into one flat unreadable blob.

---

## Gunbot-Native Features We Must Use

Aegis should feel native to Gunbot.

### Must use

* `gb.data` market and position data
* `gb.method` execution methods
* `gb.data.pairLedger.customStratStore` for persistent state
* easy chart target lines in the pair ledger
* advanced chart targets or shapes when useful
* `sidebarExtras` for live stats
* GUI notifications for important state changes
* clear log messages

### Strongly recommended

* chart lines for buy / DCA / TP / stop / trail
* value-zone rectangles or paths when practical
* pair overrides for tunable settings
* custom reason codes when a trade is skipped
* optional file logging in debug mode only

### Do not abuse

* config rewriting
* unnecessary runtime file writes
* external API calls on every cycle without a strong reason
* notifications for routine non-events

---

## Visualization Contract

Aegis must maintain a stable visualization contract so users can understand the current state instantly.

### Easy target lines

If practical, set these simple lines when active:

* `customBuyTarget`
* `customSellTarget`
* `customStopTarget`
* `customTrailingTarget`
* `customDcaTarget`

### Advanced target array

If more flexibility is needed, use `customChartTargets` with consistent labels and styles.

### Shape usage

Use shapes only for high-value visuals such as:

* value zone rectangle
* reclaim band
* key support zone
* invalidation area

Do not clutter the chart with junk.

### Cleanup rule

Whenever a setup expires or a bag closes, stale chart objects must be updated or removed.
The chart must represent current logic, not fossilized past states.

---

## Override Philosophy

Expose only meaningful parameters in the GUI.

Every override must:

* have a sane default
* have a plain-English purpose
* be documented
* affect behavior materially

### Minimum override groups

* regime settings
* value zone settings
* reclaim / confirmation settings
* DCA settings
* exit settings
* risk settings
* visualization settings
* telemetry / debug settings

### Example override candidates

* `AEGIS_ENABLED`
* `AEGIS_MODE`
* `AEGIS_RISK_PROFILE`
* `REGIME_EMA_FAST`
* `REGIME_EMA_SLOW`
* `VALUE_ZONE_PCT`
* `MIN_ENTRY_SCORE`
* `MAX_DCA_COUNT`
* `MIN_DCA_DISTANCE_PCT`
* `TP1_PCT`
* `RUNNER_TRAIL_PCT`
* `STALE_EXIT_MINUTES`
* `ENABLE_CHARTS`
* `ENABLE_NOTIFICATIONS`
* `ENABLE_DEBUG_LOGS`

Do not expose 80 mystery knobs.

---

## Productization Rules

This is not just code.
It is a product.

### A premium strategy should have

* a strong short name
* a clear edge description
* understandable behavior
* distinct pair profiles
* visible telemetry
* clean release notes
* setup documentation
* risk disclosure

### Pair profile philosophy

Later releases may ship with tuned presets such as:

* Aegis BTC conservative
* Aegis ETH balanced
* Aegis PAXG defensive

Do not pretend one setting fits every market.

---

## Testing Rules

### Mandatory testing order

1. lint or sanity review
2. simulator mode in Gunbot
3. one-pair controlled test
4. multi-period test across trend, chop, dump, recovery
5. parameter stress test
6. visualization sanity check
7. only then consider small live deployment

### Required metrics to log or summarize

* trade count
* realized PnL
* average hold time
* win rate where derivable
* add count distribution
* skipped trade reasons
* worst underwater stretch approximation if possible
* capital efficiency notes
* notification sanity
* chart rendering sanity

### Anti-self-deception rule

Do not optimize only for one cherry-picked market phase.
Do not call something good just because it catches one vertical move.

---

## Logging and Telemetry Rules

Aegis must explain itself.

### Every cycle should make state observable

At minimum expose:

* regime state
* entry score
* reclaim state
* bag state
* DCA state
* active TP / trail state
* invalidation state
* why no trade was taken when conditions were close

### Important events should notify

Examples:

* setup armed
* buy executed
* DCA executed
* TP1 hit
* trail activated
* invalidation exit
* regime disabled

### Logging quality rule

Logs must be specific.
Not useless junk like “checking conditions”.
Use precise reason strings.

### File logging rule

Custom file logs are allowed for debug mode or strategy development mode.
They must be optional and lightweight.
Do not create noisy file-write behavior by default.

---

## Persistence Rules

### Initialization rule

Always initialize `customStratStore` defensively.

### Use cases allowed

* time gating between actions
* phase tracking
* stored trail targets
* stored last action time
* cached chart state
* notification deduplication

### Use cases discouraged

* relying on persistence as the sole truth of position state
* storing bulky history blobs
* storing critical irreversible state that cannot be recomputed

### Recovery rule

If persistent state is missing, corrupted, or incomplete, Aegis must recover gracefully by rebuilding what it can from live data and pair ledger context.

---

## AutoConfig Policy

AutoConfig is approved for future operational use, not for core runtime logic.

### Acceptable future uses

* scheduled pair scanning and activation
* enabling safer presets during selected windows
* rotating pair profiles across a product fleet
* maintaining copytrading product presets

### Not acceptable for v1 core logic

* requiring AutoConfig for entries or exits
* outsourcing core Aegis decision logic to AutoConfig jobs

---

## Coding Rules

### Non-negotiable

* no placeholder comments
* no fake implementations
* no pseudocode left in production files
* no lazy ellipsis like “rest of logic here”
* no giant undocumented magic numbers
* no silent catch blocks
* no copy-paste spaghetti

### Backup discipline

Before editing any existing file, create a timestamped backup copy.

Preferred backup location:

* `/home/xaos/gunbot/backups/aegis-YYYYMMDD-HHMMSS/`

At minimum, back up:

* `Aegis.js`
* `config.js` if it will be edited
* `AGENTS.md` if it will be edited
* `LOG.md` if it will be edited
* any additional file being modified in that session

### Practical style

* prefer small helper functions
* prefer explicit names over clever names
* prefer readable thresholds over compressed one-liners
* comment why, not the obvious what

### Determinism

If using scores, thresholds, or state machines, keep them deterministic and documented.

---

## Session Continuity

Every coding session must update `LOG.md`.

Codex must also consult and maintain `MEMORY.md` as the persistent operating memory for:

* current live development pairs
* current timeframe decisions
* current logging mode decisions
* known Gunbot runtime quirks
* sizing / notional assumptions that should not be relearned every session

### LOG.md must include

* what was analyzed
* what files changed
* what behavior was added or changed
* what remains next
* any runtime assumptions
* current test status
* blockers or open questions

Do not skip this.

### MEMORY.md must include

* current active development setup
* current operational rules that future sessions should preserve
* current known-good assumptions
* current known-bad assumptions or past mistakes to avoid

`LOG.md` is the chronological journal.
`MEMORY.md` is the compact working memory.

---

## Development Order

### Phase 0 — audit and scaffold

* inspect docs
* inspect local examples
* inspect accessible strategy references
* define runtime-safe architecture
* create `Aegis.js` skeleton
* create `LOG.md`
* document available Gunbot capabilities used by the strategy

### Phase 1 — working MVP

Build a simulation-ready version with:

* regime gate
* value zone pullback logic
* wick/reclaim confirmation
* simple transparent entry score
* strict DCA guardrails
* TP1 partial exit
* trailing runner
* persistent state
* chart lines
* sidebar stats
* good logs
* meaningful notifications

### Phase 2 — refinement

Add:

* better skip reason visibility
* refined shapes and zone visualization
* pair override cleanup
* improved exits
* defensive edge-case handling
* optional debug file logs

### Phase 3 — commercial polish

Add:

* release notes
* pair presets
* setup guide
* sales copy
* risk disclosure
* optional AutoConfig ops templates

---

## Immediate Next Task for Codex

Codex must first inspect the Gunbot custom strategy environment and then implement the first real version of `Aegis.js`.

### Immediate deliverables

1. inspect docs and local examples
2. write findings into `LOG.md`
3. scaffold `Aegis.js`
4. implement the first simulation-safe strategy based on **Aegis Regime Reclaim**
5. expose clean overrides
6. add chart lines, sidebar stats, and precise logs
7. add meaningful notification events
8. ensure the file is one plain JavaScript strategy file ready for `./customStrategies/`

---

## Final Principle

Aegis should win by being:

* disciplined
* explainable
* visually self-documenting
* robust
* easy to run
* easy to tune
* credible enough to sell

The first victory is not complexity.
The first victory is a clean single-file Gunbot strategy that behaves like a professional product.
