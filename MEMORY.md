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
