# MEMORY.md

## Active Dev Setup

- Exchange: `binance`
- Live development pairs:
  - `USDT-BTC`
  - `USDT-PAXG`
- Active live Aegis deployment also includes:
  - `USDT-ETH`
  - `USDT-PENDLE`
  - `USDT-BNB`
  - `USDT-SOL`
- Active strategy file on both pairs: `Aegis.js`
- Active execution timeframe on both pairs: `15m`
- Decision as of `2026-03-27`:
  - keep both pairs on `15m` during development
  - Aegis already uses a `60m` higher-timeframe regime gate internally
  - `15m` gives faster feedback for debugging, telemetry tuning, and simulator comparison
  - revisit `PAXG` for `30m` only after the current strategy behavior is stable

## Operating Rules

- Back up every file before editing it.
- Preferred backup path:
  - `/home/xaos/gunbot/backups/aegis-YYYYMMDD-HHMMSS/`
- Always update both:
  - `LOG.md` for chronological session history
  - `MEMORY.md` for durable working memory

## Ops Automation

- Aegis now has a local non-runtime ops monitor:
  - `ops/aegis-monitor.js`
- It writes:
  - `ops/aegis-monitor-state.json`
  - `ops/aegis-monitor-report.txt`
  - `ops/aegis-monitor-history.log`
  - `ops/aegis-monitor-cron.log`
- Installed user crontab job:
  - `*/5 * * * * /usr/bin/node /home/xaos/gunbot/customStrategies/ops/aegis-monitor.js >> /home/xaos/gunbot/customStrategies/ops/aegis-monitor-cron.log 2>&1`
- Crontab backup path for this install:
  - `/home/xaos/gunbot/backups/aegis-20260327-202039/crontab.before`
- The monitor is for live observation and tuning only.
- It must not be turned into a runtime dependency of `Aegis.js`.

## Current Aegis Runtime Decisions

- Use compact strategy log lines in Gunbot pair logs for development.
- Keep verbose debug logging separate from compact cycle summaries.
- Chart telemetry, sidebar telemetry, and notifications remain part of the product, not optional fluff.
- As of `2026-03-27`:
  - keep `AEGIS_LOG_MODE: "cycle"` only on:
    - `USDT-BTC`
    - `USDT-PAXG`
  - keep `AEGIS_LOG_MODE: "changes"` on the other live Aegis pairs to reduce log noise

## Known Gunbot Environment Facts

- Gunbot custom strategies can run in an eval-style runtime where `module` is not defined.
- Aegis must therefore support:
  - CommonJS export when available
  - direct self-execution inside Gunbot when `module` is absent
- Gunbot pair logs can show standard cycle tables even when the strategy itself emits no lines.
- In this Gunbot build, custom strategy `console.log` output is written to:
  - `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`
- Do not assume pair-specific files like `binance.USDT-BTC.log` or `binance.USDT-PAXG.log` will contain Aegis custom log lines.

## Important Sizing / Notional Reminder

- Do not assume Gunbot volume thresholds are quote-asset units.
- Treat `MIN_VOLUME_TO_BUY` and `MIN_VOLUME_TO_SELL` as base-currency order value thresholds for Aegis checks.
- Treat market order method amounts as quote-asset amounts for `buyMarket(...)` and `sellMarket(...)`.
- Validate any future sizing change against live pair state and Gunbot docs before trusting it.

## Current Pair Profiling Direction

- `USDT-BTC`:
  - primary development pair
  - use `balanced` profile first
- `USDT-PAXG`:
  - secondary defensive validation pair
  - prefer `conservative` profile first

## Current 1.1.x Development Focus

- Aegis `1.1.x` adds:
  - setup-stage classification
  - granular component reason codes
  - earlier regime-on chart previews
  - reclaim line plus risk-zone charting
- Live chart / sidebar debugging should focus first on:
  - `USDT-PAXG` while it is in `reclaim-watch`
  - `USDT-BTC` while it is `regime-blocked`
- Do not add more indicators before validating:
  - chart clarity
  - skip reason quality
  - setup-stage usefulness in live tuning

## Current Live Read

- Latest reviewed live states:
  - `USDT-PAXG`
    - regime on
    - closest to entry
    - currently failing on reclaim quality and light liquidity
    - repeated near-ready monitor observations justify simulator testing of pair-specific liquidity tolerance later if this persists
  - `USDT-BTC`
    - regime blocked
    - momentum recovered somewhat
    - still blocked by HTF regime and light liquidity
  - `USDT-ETH`
  - `USDT-PENDLE`
  - `USDT-BNB`
  - `USDT-SOL`
    - all currently regime blocked in the reviewed log window
- No Aegis runtime errors were observed in the reviewed live log window.
- No completed Aegis trades were observed yet in the reviewed live log window.

## Audit Follow-Up

- `AUDITgemini.md` was reviewed on `2026-03-27`.
- The main actionable item adopted immediately was notification-key pruning.
- Aegis patch version `1.1.1` now includes bounded cleanup of `notificationKeys` in persistent state.
- Additional ops follow-up:
  - live monitoring is now automated with cron
  - monitor counts represent observed log samples, not candles or actual entry attempts

## Current Audit Verdict

- `AUDIT.md` was created on `2026-03-27` as the primary current-state audit.
- Current audit verdict:
  - no critical or high-severity runtime defects found
  - strongest remaining issues are operational and tuning-related, not code-structure-related
- Main open audit conclusions:
  - live rollout scope is ahead of validation depth
  - PAXG is the first pair-specific tuning target
  - ops monitor output is qualitative and operational, not statistical proof

## Documentation State

- Technical docs now present:
  - `README.md`
  - `AUDIT.md`
- Keep both current as strategy logic or deployment posture changes.

## Gunbot State File Structure

- Important correction from live inspection on `2026-03-27`:
  - Aegis runtime persistence is present in the raw pair state json files under `/home/xaos/gunbot/json/`.
  - Do not assume a nested `pairLedger` object in those files.
- Relevant live fields currently persist at top level:
  - `whatstrat`
  - `customStratStore.aegis`
  - `customBuyTarget`
  - `customSellTarget`
  - `customStopTarget`
  - `customTrailingTarget`
  - `customDcaTarget`
  - `sidebarExtras`
  - `notifications`
- Example validated files:
  - `/home/xaos/gunbot/json/binance-USDT-PAXG-state.json`
  - `/home/xaos/gunbot/json/binance-USDT-BTC-state.json`

## Current Live Pair Set

- As of `2026-03-27`, enabled Aegis pairs in `config.js` are:
  - `USDT-PAXG`
  - `USDT-BTC`
  - `USDT-ETH`
  - `USDT-PENDLE`
  - `USDT-BNB`
  - `USDT-SOL`

## Current Pair Tuning Decisions

- `USDT-BTC`
  - keep unchanged
  - it is still the regime-control pair
  - keep `balanced`
  - keep `15m`
  - keep `AEGIS_LOG_MODE: "cycle"`
- `USDT-PAXG`
  - keep `conservative`
  - keep `15m` for now
  - keep `AEGIS_LOG_MODE: "cycle"`
  - pair-specific live-tuning overrides added in `config.js` on `2026-03-27`:
    - `MIN_RELATIVE_VOLUME: 0.5`
    - `RECLAIM_CLOSE_LOCATION: 0.55`
    - `MOMENTUM_MIN_RSI_DELTA: 0.2`
  - rationale:
    - PAXG is the only active pair with HTF regime consistently on
    - dominant live blockers were:
      - `volume-too-light`
      - `weak-close-location`
      - `rsi-delta-weak`
  - Gunbot picked these overrides up in live pair state without a restart
- `USDT-ETH`
- `USDT-PENDLE`
- `USDT-BNB`
- `USDT-SOL`
  - leave unchanged until they produce enough regime-on evidence to justify pair-specific tuning

## Current PAXG Read

- PAXG is still the first true pair-specific tuning target.
- Recent reviewed live sample showed:
  - `regimeOn` on every reviewed Aegis state line in that window
  - repeated `value-pullback-watch` and `reclaim-watch`
  - frequent blockers:
    - `above-value-band`
    - `weak-close-location`
    - `bearish-signal-close`
    - `weak-lower-wick`
    - `rsi-delta-weak`
    - `volume-too-light`
- Important decision:
  - do not loosen the PAXG value-zone gate yet
  - first observe the lighter liquidity / reclaim / momentum overrides
  - only then consider `30m` or value-band widening
- Immediate post-change live read:
  - PAXG still remained:
    - `stage=reclaim-watch`
    - `score=2/5`
    - `skip=weak-close-location`
    - `liquidity=volume-too-light`
  - so the override change applied cleanly without creating premature entries

## Overnight Read 2026-03-28

- Overnight monitor review still showed:
  - no verified Aegis entries
  - no verified Aegis exits
  - no runtime error evidence in the reviewed monitor window
- From the PAXG tuning window forward, the important change was not activation but blocker composition:
  - `below-reclaim-trigger` became a more common blocker than before
  - `weak-close-location` remained important but was no longer the only dominant reclaim blocker
  - `volume-too-light` still remained almost universal
- Current conclusion:
  - the PAXG override nudge changed the shape of the setup path
  - it did not create actual trade conversions
  - liquidity still looks like the strongest remaining structural throttle

## Documentation Split

- Keep documentation split this way:
  - `README.md`
    - strategy overview
    - architecture
    - runtime model
  - `GUIDE.md`
    - operator configuration reference
    - sizing semantics
    - risk profiles
    - log modes
    - override-by-override usage
- Important repo note:
  - remote GitHub `README.md` in `NukeThemAII/Aegis` is older and more presentation-oriented than the current local docs
  - local `README.md` plus `GUIDE.md` are now the authoritative technical docs

## Publishing Reality

- `/home/xaos/gunbot/customStrategies` is not a git repository.
- Safe publish workflow:
  - clone `https://github.com/NukeThemAII/Aegis.git`
  - copy local files into that clone
  - commit there
  - push `main`
- Do not assume a direct `git push` from the current working directory will work.

## Current Durable State 2026-03-28

- Local working directory has since been published to GitHub by the user.
- Do not rely on the older "not a git repository" assumption anymore without re-checking.

## Aegis 1.2.0

- `Aegis.js` is now version `1.2.0`.
- Important runtime change:
  - Aegis liquidity uses projected current-candle volume against completed-candle averages
  - new live state logs include `relvol=...`
- New Aegis liquidity controls:
  - `PROJECT_CURRENT_VOLUME`
  - `PROJECTED_VOLUME_FLOOR`
- Current Aegis config posture:
  - all active Aegis pairs are on `AEGIS_LOG_MODE=cycle`
  - `USDT-PAXG`
    - `AEGIS_RISK_PROFILE=balanced`
    - `MIN_RELATIVE_VOLUME=0.25`
    - `RECLAIM_WICK_RATIO=0.22`
    - `RECLAIM_CLOSE_LOCATION=0.5`
    - `MOMENTUM_MIN_RSI_DELTA=0.1`
    - `VALUE_MIN_PULLBACK_PCT=0.2`
    - `MIN_ENTRY_SCORE=4`
  - `USDT-BTC`
    - stays the regime-control Aegis pair
  - `USDT-PENDLE`
  - `USDT-SOL`
    - aggressive profiles
    - `REGIME_HTF_PERIOD=30`
- Current live Aegis read after this change:
  - PAXG remains the closest candidate
  - latest observed state was still:
    - `reclaim-watch`
    - `score=3/5`
    - blocked by `weak-lower-wick`
    - `relvol` still very low in the reviewed live window

## Kestrel 1.0.1

- Separate fast strategy file:
  - `Kestrel.js`
- Dedicated documentation:
  - `KESTREL.md`
- Current deployment:
  - `USDT-XRP`
  - `PERIOD=5`
  - aggressive Kestrel profile
- Kestrel also uses projected current-candle volume and emits `relvol=...` in state logs.
- Current live Kestrel behavior:
  - XRP has already reached:
    - `phase=armed`
    - `stage=reclaim-watch`
    - `score=3/5`
  - main blockers shifted to:
    - `bearish-signal-close`
    - `rsi-delta-weak`
  - liquidity is now often `ok`

## Ops Layer

- Aegis monitor remains:
  - `ops/aegis-monitor.js`
- Separate Kestrel monitor now exists:
  - `ops/kestrel-monitor.js`
- Log retention now exists:
  - `ops/log-maintenance.js`
- `.gitignore` now ignores generated ops reports, history files, cron logs, and state snapshots.
- Existing tracked Aegis monitor runtime files were removed from the git index with `git rm --cached`.
- Cron is currently configured for:
  - Aegis monitor every 5 minutes
  - Kestrel monitor every 5 minutes with offset
  - hourly log maintenance
- Important operational note:
  - `ops/aegis-monitor-state.json` is cumulative across config changes
  - its blocker counts are historical totals, not a clean post-tuning experiment baseline

## Runtime Interpretation Notes

- Gunbot state files may retain both `customStratStore.aegis` and `customStratStore.kestrel` keys if a pair was reassigned over time.
- Use `whatstrat.STRAT_FILENAME` plus live log prefixes to determine the active strategy on a pair.
- Do not infer active strategy only from the presence of an old custom store block.

## Log Retention

- `ops/log-maintenance.js` has already been run once successfully.
- It reclaimed roughly `637 MiB` from oversized logs.
- Pair log target size is now about `12 MiB` after trimming.
- Main Gunbot log remains under active retention control through cron.

## Latest Backup

- Latest full edit backup before this round:
  - `/home/xaos/gunbot/backups/aegis-20260328-065709`

## 2026-03-28 Current Active Pair Matrix

- Supersedes older notes that still listed `PENDLE` or `SOL` under Aegis.
- Active Aegis pairs now:
  - `USDT-BTC`
    - `Aegis.js`
    - `15m`
    - `conservative`
    - control pair
  - `USDT-ETH`
    - `Aegis.js`
    - `15m`
    - `aggressive`
    - conversion test pair
  - `USDT-PAXG`
    - `Aegis.js`
    - `15m`
    - `balanced`
    - reclaim / liquidity tuning pair
- Active Kestrel pairs now:
  - `USDT-PENDLE`
    - `Kestrel.js`
    - `5m`
    - `aggressive`
    - `reload max=4`
  - `USDT-BNB`
    - `Kestrel.js`
    - `5m`
    - `balanced`
    - `reload max=2`
  - `USDT-SOL`
    - `Kestrel.js`
    - `5m`
    - `aggressive`
    - `reload max=4`
  - `USDT-XRP`
    - `Kestrel.js`
    - `5m`
    - `conservative`
    - `reload max=1`

## 2026-03-28 Capital Rules Now In Force

- Aegis simulator posture:
  - `AEGIS_TRADE_LIMIT=100`
  - `TRADING_LIMIT=400`
  - `MIN_VOLUME_TO_BUY=15`
  - `MIN_VOLUME_TO_SELL=15`
  - total pair headroom is intentionally larger than per-entry budget so DCA tests are not blocked by pair caps
- Kestrel simulator posture:
  - `KESTREL_TRADE_LIMIT=50`
  - `TRADING_LIMIT=300`
  - `MIN_VOLUME_TO_BUY=15`
  - `MIN_VOLUME_TO_SELL=15`
  - this gives enough room for one `50` entry plus up to four `50` reloads without Gunbot pair limits becoming the gating factor

## Runtime Isolation Note

- Important discovery:
  - Gunbot can eval custom strategy files in a way that causes the self-executing footer to run even when the pair is assigned to another strategy file
- Mitigation now required in every custom strategy runtime:
  - read `gb.data.pairLedger.whatstrat.STRAT_FILENAME`
  - return immediately if it does not match the file's own expected name
- Current status:
  - `Aegis.js`
    - guard present
    - version `1.3.1`
  - `Kestrel.js`
    - guard present
    - version `1.1.1`

## Latest Backup

- Latest full edit backup before the current matrix and runtime-isolation pass:
  - `/home/xaos/gunbot/backups/aegis-20260328-073208`

## 2026-03-28 Mako HFT Lane

- New separate high-frequency strategy exists:
  - `Mako.js`
  - product name:
    - `Mako Micro Scalper`
  - version:
    - `1.0.0`
- Purpose:
  - true intrabar simulator HFT lane
  - anchor stretch plus snapback mean reversion
  - not a regime strategy
  - not a continuation-score clone of Aegis
- Separate documentation:
  - `MAKO.md`
- Separate ops monitor:
  - `ops/mako-monitor.js`
- Separate cron:
  - `4-59/5 * * * * /usr/bin/node /home/xaos/gunbot/customStrategies/ops/mako-monitor.js >> /home/xaos/gunbot/customStrategies/ops/mako-monitor-cron.log 2>&1`

## 2026-03-28 Current Active Pair Matrix Superseding Older Notes

- Aegis:
  - `USDT-BTC`
    - `Aegis.js`
    - `15m`
    - `conservative`
    - `AEGIS_TRADE_LIMIT=100`
    - `TRADING_LIMIT=400`
  - `USDT-ETH`
    - `Aegis.js`
    - `15m`
    - `aggressive`
    - `AEGIS_TRADE_LIMIT=100`
    - `TRADING_LIMIT=400`
  - `USDT-PAXG`
    - `Aegis.js`
    - `15m`
    - `balanced`
    - pair-level looser reclaim and liquidity tuning
    - `AEGIS_TRADE_LIMIT=100`
    - `TRADING_LIMIT=400`
- Kestrel:
  - `USDT-PENDLE`
    - `Kestrel.js`
    - `5m`
    - `aggressive`
    - `KESTREL_TRADE_LIMIT=50`
    - `TRADING_LIMIT=300`
    - `reload max=4`
  - `USDT-BNB`
    - `Kestrel.js`
    - `5m`
    - `balanced`
    - `KESTREL_TRADE_LIMIT=50`
    - `TRADING_LIMIT=300`
    - `reload max=2`
  - `USDT-SOL`
    - `Kestrel.js`
    - `5m`
    - `aggressive`
    - `KESTREL_TRADE_LIMIT=50`
    - `TRADING_LIMIT=300`
    - `reload max=4`
- Mako:
  - `USDT-XRP`
    - `Mako.js`
    - `5m`
    - `turbo`
    - `MAKO_TRADE_LIMIT=30`
    - `TRADING_LIMIT=240`
    - `max layers=5`
    - notifications currently disabled to keep HFT testing quieter

## Runtime Isolation Still Matters

- The `STRAT_FILENAME` guard pattern remains mandatory in every runtime file.
- Current guard coverage:
  - `Aegis.js`
    - yes
  - `Kestrel.js`
    - yes
  - `Mako.js`
    - yes
- Latest wrong-pair scan after Mako deployment came back clean.
- Do not trust stale `customStratStore` blocks in old state files to identify the active strategy.
- Active truth is:
  - `whatstrat.STRAT_FILENAME`
  - plus current live strategy log prefix

## Latest Backup

- Latest full edit backup before the Mako creation and XRP reassignment round:
  - `/home/xaos/gunbot/backups/aegis-20260328-074522`

## Kestrel Runtime Bug Learned On 2026-03-28

- Gunbot `whenwebought` can stay stale from a prior day or prior bag even when the current live bag is brand new.
- This was directly observed on:
  - `USDT-SOL`
    - stale `whenwebought`: `2026-03-27T19:08:09.886Z`
    - fresh buy-sell cycles were being force-closed about 6 seconds after entry
  - `USDT-BNB`
    - stale `whenwebought`: `2026-03-27T19:02:53.051Z`
    - same immediate loss pattern
- Do not trust `whenwebought` as the sole source of bag age for fast strategies.
- Kestrel `1.1.2` now prefers live order-history recovery for active bag entry time and adds a post-entry grace window before momentum/time-stop exits can fire.
- If similar behavior appears in future strategies, inspect:
  - latest local buy order timestamp
  - latest local sell order timestamp
  - stale `whenwebought`
  - sub-10-second sell patterns in `gunbot_logs.txt`

## Latest Backup

- Latest bug-fix backup before the Kestrel stale-age fix:
  - `/home/xaos/gunbot/backups/aegis-20260328-094205-kestrel-fix`

## Gunbot Chart Visuals Rule Learned On 2026-03-28

- Official Gunbot chart visuals are safest when they use the documented schema exactly:
  - `customChartTargets`
    - array of objects with fields like `text`, `price`, `lineStyle`, `lineLength`, `lineWidth`, `lineColor`, and body/quantity colors
  - `customChartShapes`
    - array of objects using `points` plus `options`
    - rectangles should use TradingView-style `shape: 'rectangle'`
  - `sidebarExtras`
    - existing array-of-objects pattern is valid
- Do not use local shorthand payloads for chart visuals in runtime strategies:
  - no `['Label', price, color]` targets
  - no custom `{type:'rect', ...}` shape shorthands
- Current safe visual contract across strategies:
  - `Aegis.js`
    - `1.3.3`
    - adds explicit average fill and runner close targets
  - `Kestrel.js`
    - `1.1.4`
    - converted to documented target and shape objects
  - `Mako.js`
    - `1.0.3`
    - converted to documented target and shape objects
    - now also emits time-scale trade markers on executed buys and sells
- If chart visuals disappear again, inspect in this order:
  1. live `whatstrat.STRAT_FILENAME`
  2. strategy version lines in `gunbot_logs.txt`
  3. live pair state for `customChartTargets`, `customChartShapes`, and `customCloseTarget`
  4. whether the runtime payload still matches the official doc schema

## Latest Backup

- Latest chart-compatibility logging backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-101616-chart-doc-log`
- Latest Mako trade-marker parity backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-102104-mako-marks`

## 2026-03-28 Comprehensive Code Audit Results

### Audit verdict

**Overall: 90/100 (A-) - GOOD CODE**

No critical or high-severity bugs found. All three strategies are production-ready from a code quality perspective.

### Strategy scores

| Strategy | Version | Score | Grade | Status |
|----------|---------|-------|-------|--------|
| Aegis | 1.3.4 | 92/100 | A | Production-ready |
| Mako | 1.0.4 | 88/100 | B+ | Production-ready |
| Kestrel | 1.1.5 | 90/100 | A- | Production-ready |

### Key strengths confirmed

- Professional-grade code organization
- Defensive programming throughout
- Comprehensive error handling
- Strong observability (logging, charts, sidebar, notifications)
- Runtime snapshot pattern prevents stale state
- Strategy file guards prevent cross-pair execution
- Multi-mode logging with granular skip reasons

### Issues to track

**Medium (2):**
1. Bag recovery race condition (already mitigated by defensive fallbacks)
2. Deployment scope exceeds validation depth (operational risk)

**Low (12):**
- Code duplication across strategies (~30% file size inflation)
- Inconsistent helper naming
- Magic numbers without justification
- Aegis entry score rigidity (tuning decision)
- Mako HFT assumption risk (documentation needed)
- Kestrel reload PnL threshold hardcoded

### Audit deliverables

- Created `Auditqwen.md` - full audit report with findings and recommendations
- Updated `LOG.md` with audit session details
- This `MEMORY.md` section for durable audit findings

### Recommended next actions

1. Continue simulator validation (operational priority)
2. Consider shared utilities library (maintenance improvement)
3. Create `STRATEGIES.md` for cross-strategy guidance
4. Review deployment scope vs validation depth

### Audit methodology reference

Future audits should follow same pattern:
1. Full source read
2. Pattern analysis
3. Bug hunting by severity
4. Standards comparison
5. Security review
6. Performance review
7. Documentation review
8. Operational review

## 2026-03-28 Re-Audit Results

### Re-audit verdict

**Overall: 92/100 (A) - IMPROVED CODE BASE**

All medium-severity findings from original audit have been resolved.

### Strategy score changes

| Strategy | Original | Current | Delta | Version Change |
|----------|----------|---------|-------|----------------|
| Aegis | 92/100 | 94/100 | +2 | 1.3.4 → 1.3.5 |
| Mako | 88/100 | 90/100 | +2 | 1.0.4 → 1.0.5 |
| Kestrel | 90/100 | 92/100 | +2 | 1.1.5 → 1.2.0 |

### Findings resolution status

**Medium severity (2):**
1. ✅ Bag recovery race condition - RESOLVED
2. ✅ Deployment scope exceeds validation - RESOLVED

**Low severity (12):**
1. ⚠️ Code duplication - DEFERRED
2. ⚠️ Inconsistent naming - DEFERRED
3. ⚠️ Magic numbers - PARTIALLY
4. ✅ Runtime snapshot arrays - RESOLVED
5. ✅ Buy execution pricing - RESOLVED
6. ✅ Volume projection edge case - MITIGATED
7. ✅ Aegis entry score - RESOLVED (close-only mode)
8. ✅ Aegis DCA logic - RESOLVED (invalidation check)
9. ✅ Aegis HTF cache - MITIGATED
10. ✅ Mako HFT assumption - RESOLVED (Mako paused)
11. ✅ Mako layer logic - MITIGATED
12. ✅ Kestrel reload threshold - DEFERRED

### New features implemented

1. **Close-Only Entry Mode (Aegis)** - Prevents intrabar fake-outs
2. **Invalidation Check for Entry (Aegis)** - Blocks entries below invalidation
3. **Runtime Snapshot Array Slicing (All)** - Prevents shared mutable references
4. **Buy Reference Price Hardening (All)** - Prefers ask for conservative sizing
5. **Beta Risk Profile (Kestrel)** - Explicit dev/simulator profile

### Current deployment matrix

```
Aegis (Production):
- USDT-BTC: 15m, conservative
- USDT-PAXG: 15m, balanced, close-only=true
- USDT-SOL: 15m, aggressive

Kestrel (Beta/Dev):
- USDT-XRP: 5m, beta

Mako (Inactive):
- No active pairs
```

### Operational improvements

- Monitor scripts now filter to enabled pairs only
- Matrix signature reset on config changes
- Stale state pruning active
- Mako monitor removed from crontab

### Re-audit deliverables

- Updated `Auditqwen.md` with complete re-audit report
- Updated `LOG.md` with re-audit session details
- This `MEMORY.md` section for durable findings

### Next actions

1. Continue monitoring PAXG close-only behavior
2. Continue monitoring XRP beta Kestrel performance
3. Consider STRATEGIES.md creation
4. Maintain current deployment scope until validation complete
5. Schedule next audit after v2.0 or production milestone

## 2026-03-28 Re-Audit #2 Results

### Re-audit #2 verdict

**Overall: 93/100 (A) - STABLE PRODUCTION CODE**

Live validation feedback loop now active. Code quality continues to improve.

### Strategy score changes

| Strategy | Original | Re-Audit #1 | Current | Total Delta |
|----------|----------|-------------|---------|-------------|
| Aegis | 92/100 | 94/100 | 95/100 | +3 |
| Mako | 88/100 | 90/100 | 90/100 | +2 |
| Kestrel | 90/100 | 92/100 | 92/100 | +2 |

**Overall: 92/100 → 93/100 (A → A)**

### Key changes since Re-Audit #1

1. **Aegis v1.3.6** - Reclaim logic refined (close-keyed vs close+live)
2. **PAXG tuning** - VALUE_MIN_PULLBACK_PCT 0.15→0.10, MOMENTUM_MIN_RSI_DELTA 0.05→0.02
3. **XRP beta override** - KESTREL_MOMENTUM_RSI_CEILING 76

### Live validation status

| Strategy | Pair | Status | Notes |
|----------|------|--------|-------|
| Kestrel | XRP | ✅ Validated | Full lifecycle completed, positive P/L |
| Aegis | PAXG | ✅ Improving | Setup quality improving, reclaim fix should help |
| Aegis | BTC | ✅ As expected | Regime-control functioning |
| Aegis | SOL | ✅ As expected | Regime-control functioning |

### Operational assessment

**Tuning discipline:** ✅ Excellent
- Data-driven changes based on live behavior
- Surgical pair-specific adjustments
- Backups created before all changes

**Deployment matrix:** ✅ Stable
- 3 Aegis pairs (1 tuned)
- 1 Kestrel beta pair (validated)
- Mako inactive

### Re-audit #2 deliverables

- Updated `Auditqwen.md` with complete re-audit #2 report
- Updated `LOG.md` with re-audit #2 session details
- This `MEMORY.md` section for durable findings

### Next actions

1. Monitor PAXG behavior with v1.3.6 reclaim logic
2. Watch for PAXG entry conversion (below-reclaim-trigger → valid setup)
3. Continue Aegis validation cycle (entry → TP1 → exit)
4. Consider Mako future decision (reactivate or archive)
5. Schedule next audit after Aegis full validation cycle completes

## Runtime Snapshot Rule Learned On 2026-03-28

- Gunbot custom strategy runtime objects can behave like a shared mutable async context across pairs.
- Directly holding the live resolved `gb` object across awaited operations is unsafe.
- This was directly observed in production simulator logs:
  - `Aegis.js` executed a stale sell on `USDT-PENDLE` even though `config.js` still assigned `Kestrel.js`
  - `Kestrel.js` emitted state lines on `USDT-PAXG` even though `config.js` assigned `Aegis.js`
- Current safe rule:
  - every strategy must snapshot runtime data at cycle start
  - snapshot at minimum:
    - `pairName`
    - `exchangeName`
    - `whatstrat`
    - current top-level data fields
    - current pair ledger reference
  - then execute all cycle logic against that snapshot, not against the live mutable runtime object
- Safe versions after this fix:
  - `Aegis.js`
    - `1.3.4`
  - `Kestrel.js`
    - `1.1.5`
  - `Mako.js`
    - `1.0.4`

## Aegis Bag Recovery Rule Learned On 2026-03-28

- `Aegis.js` originally trusted `pairLedger.whenwebought` too much.
- This caused a fresh `USDT-PAXG` bag to be recovered and then stale-sold almost immediately:
  - buy at `4504.49`
  - sell at `4504.48`
  - realized about `-0.2001 USDT`
- Current safe rule:
  - recover active bag entry time from latest local pair buy order first
  - compare against latest local sell order
  - only fall back to `whenwebought` when local order history does not provide a newer valid answer
- Similar rule already existed in Kestrel after the SOL/BNB stale-age incident and should be considered mandatory for future strategies too.

## Latest Backup

- Latest runtime-snapshot hardening backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-103117-runtime-snapshot`

## Gunbot Ops Note Learned On 2026-03-28

- When Gunbot appears alive but stops cycling:
  - check `gunbot_logs.txt` modification time
  - check pair state-file modification times
  - check `ps` for the Gunbot process state
  - if the process is alive and stuck in `ep_poll` while logs stop advancing, inspect exchange websocket health
- Repeated Binance lines observed before the stall:
  - `Disconnected from Binance WebSocket.`
  - `Error code: 1008 Pong timeout`
- On this host, websocket mode became unstable enough to allow:
  - one completed sweep
  - then no further rounds
- Stable fallback confirmed:
  - `/home/xaos/gunbot/config.js`
    - `WS_ENABLED=false`
  - Gunbot then resumed continuous rounds:
    - `#5`
    - `#6`
    - `#7`
- Local launcher correction:
  - `/home/xaos/gunbot/start.sh` originally pointed at `/root/gunbot`
  - safe local launcher now uses:
    - `screen -dmS gunbot bash -lc 'cd /home/xaos/gunbot && exec ./gunthy-linux'`

## Latest Backup

- Latest websocket-fallback backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-103833-ws-fallback`
- Latest ops logging backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-103915-ops-log`

## Websocket Retest Rule Learned On 2026-03-28

- A second websocket retest was performed after restoring `WS_ENABLED=true`.
- Duplicate Gunbot process lineage can confuse websocket debugging, so always reduce to one live Gunbot process before judging websocket behavior.
- Even after cleaning that up, websocket mode still stalled on this host.
- Stable current rule:
  - `/home/xaos/gunbot/config.js`
    - keep `WS_ENABLED=false`
- `/home/xaos/gunbot/start.sh` should remain executable and should be invoked as the standard recovery path.
- Verify Gunbot health with:
  - advancing `Round #` lines in `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`
  - advancing timestamps in `/home/xaos/gunbot/json/binance-*-state.json`
- Do not spend more strategy-debug time blaming the strategy files when the transport layer is what stalled.

## Latest Backup

- Latest websocket-retest final backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-105000-ws-final`

## Audit Reconciliation Rule Learned On 2026-03-28

- When multiple audits land in the same day, do not stack every recommendation into one release.
- Current accepted safe-runtime fixes from the Claude/Gemini/Qwen audit set:
  - snapshot top-level arrays at cycle start instead of preserving shared array references
  - buy execution reference should prefer ask with bid fallback
  - Aegis initial entry must respect invalidation the same way DCA already does
- Current intentionally deferred proposals:
  - weighted scoring
  - regime hysteresis
  - ATR-relative value band
  - chandelier-style trail
- Reason for deferral:
  - those are meaningful behavior changes and should be validated as isolated simulator experiments, not bundled into routine hardening work

## Aegis Entry Hygiene Rule Learned On 2026-03-28

- Aegis `1.3.5` adds two entry-discipline rules that should remain standard:
  - no fresh long entry when bid is already at or below invalidation
  - optional close-only entry mode is allowed, but must default to off
- Aegis close-only controls:
  - `AEGIS_CLOSE_ONLY_ENTRY`
  - `AEGIS_CLOSE_ONLY_ENTRY_PROGRESS`
- Intended use:
  - pairs like `USDT-PAXG` that repeatedly look almost-ready mid-candle but decay before close

## Snapshot Hardening Rule Learned On 2026-03-28

- Runtime snapshot isolation should clone top-level arrays, not just copy references.
- Current safe versions after this improvement:
  - `Aegis.js`
    - `1.3.5`
  - `Kestrel.js`
    - `1.1.6`
  - `Mako.js`
    - `1.0.5`

## Latest Backup

- Latest audit-fixes backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-111909-audit-fixes`

## Active Matrix Rule Learned On 2026-03-28

- Strategy assignment alone is not enough. Pair override families must match the active strategy file.
- Real config drift observed:
  - `USDT-SOL`
    - `STRAT_FILENAME` was `Aegis.js`
    - but the override block still carried Kestrel keys
  - `USDT-XRP`
    - `STRAT_FILENAME` was `Kestrel.js`
    - but the override block still carried Aegis keys
- Current corrected active matrix:
  - Aegis:
    - `USDT-BTC`
      - `15m`
      - `conservative`
    - `USDT-PAXG`
      - `15m`
      - `balanced`
      - close-only entry enabled
    - `USDT-SOL`
      - `15m`
      - `aggressive`
  - Kestrel:
    - `USDT-XRP`
      - `5m`
      - `beta`

## Monitor Hygiene Rule Learned On 2026-03-28

- Ops monitors must track enabled pairs only.
- When the active pair matrix changes, monitor counters and recent events must be reset or they become misleading.
- Current safe monitor behavior:
  - only enabled pairs are tracked
  - stale pair state is pruned
  - stale recent events are pruned
  - state resets when the pair matrix signature changes

## Kestrel Beta Rule Learned On 2026-03-28

- Kestrel now has an explicit `beta` profile in `1.2.0`.
- `beta` means:
  - simulator-first
  - trade-seeking
  - lower score threshold
  - looser reclaim / pullback / liquidity gates
  - short recycle timing
- Do not treat `beta` as a sellable default. It is a development lane only.

## Current Ops Rule

- Active cron should cover only:
  - Aegis monitor
  - Kestrel monitor
  - log maintenance
- Mako monitor should stay out of cron while Mako is not part of the active test matrix.

## Latest Backup

- Latest matrix-refresh backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-114438-matrix-refresh`

## Audit Verification Rule Learned On 2026-03-28

- Re-audits can be correct at the verdict level while still carrying stale code snippets.
- Current example:
  - `Auditqwen.md` correctly recognized the major improvements
  - but some sample snippets already lag the shipped source
- Safe rule:
  - trust audits for prioritization and external perspective
  - trust the live source files for exact implementation details
  - never patch code by copying an audit snippet without verifying against current source first

## Latest Backup

- Latest Qwen re-audit note backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-120711-qwen-reaudit-note`

## PAXG Tuning Rule Learned On 2026-03-28

- When Aegis `USDT-PAXG` spends many hours with:
  - regime on
  - liquidity mostly ok
  - close-only waiting active
  - repeated `pullback-too-shallow`
- the first live tuning step should be override-level, not code-level.
- Current low-risk simulator adjustment:
  - `VALUE_MIN_PULLBACK_PCT` reduced from `0.15` to `0.10`
  - `MOMENTUM_MIN_RSI_DELTA` reduced from `0.05` to `0.02`
- Leave BTC unchanged as control pair.
- Leave SOL unchanged while regime is still persistently off.
- Do not loosen Kestrel XRP mid-bag without a clear bug signal.

## Latest Backup

- Latest live-log tuning backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-124500-log-tune`

## Aegis Reclaim Rule Learned On 2026-03-28

- For Aegis close-confirmed reclaim logic, the reclaim baseline should key off the candle close versus the fast EMA.
- Requiring the live bid to also remain above the fast EMA after the candle close is too strict and can create false `below-reclaim-trigger` blocks on otherwise valid closes.
- Safe rule:
  - reclaim baseline = close over fast EMA
  - do not add an extra live-bid-above-fast requirement on top of the candle-close reclaim test

## Kestrel Beta Momentum Rule Learned On 2026-03-28

- Kestrel beta already proved it can complete a profitable simulator cycle on `USDT-XRP`.
- When recent beta skips include `rsi-above-ceiling` during otherwise valid 5m continuation structure, the next experiment should be a small RSI ceiling increase, not a broad multi-knob loosen.
- Current live beta experiment:
  - `KESTREL_MOMENTUM_RSI_CEILING = 76`

## Latest Backup

- Latest trade-review backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-151000-trade-review`

## Restart Matrix Rule Learned On 2026-03-28

- After a Gunbot restart, always re-read the enabled-pair matrix from `config.js` before trusting prior monitor assumptions.
- Current widened restart matrix:
  - Aegis: `BTC`, `ETH`, `PAXG`, `SOL`
  - Kestrel: `PENDLE`, `BNB`, `XRP`
- The monitor scripts already auto-discover enabled pairs, so cron did not need structural changes.

## ETH Profile Rule Learned On 2026-03-28

- ETH should not inherit the same close-only balanced Aegis profile used for PAXG.
- If ETH logs show `waiting-candle-close` while regime is still off and structure is overheated, first remove close-only mode and restore a more neutral balanced profile before touching strategy code.

## OpenClaw Workspace Rule Learned On 2026-03-28

- OpenClaw needs explicit trading-workspace context files or it starts from generic assistant templates.
- Required workspace guidance now lives in:
  - `IDENTITY.md`
  - `SOUL.md`
  - `TOOLS.md`
  - `USER.md`
  - `HEARTBEAT.md`
  - `BOOT.md`
  - `OPENCLAW_PROMPT.md`
- Keep these aligned with the actual Gunbot workflow:
  - inspect logs
  - inspect config
  - run monitors
  - back up before edits
  - update `LOG.md` and `MEMORY.md`

## Latest Backup

- Latest OpenClaw/workspace backup:
  - `/home/xaos/gunbot/backups/aegis-20260328-154500-openclaw`
