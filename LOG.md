
## 2026-04-01 05:55 UTC — Heartbeat

- **Aegis Monitor**: `[2026-04-01T05:59:45.800Z] Aegis monitor | pairs=4 | USDT-PAXG=runner-manage/3/5/in-bag/ok | USDT-BTC=bag-manage/3/5/in-bag | new_states=55 | new_events=0 | alerts=1 ALERT: USDT-BTC regime control pair is now ON. Re-check whether the broader market gate is starting to open.`
- **Kestrel Monitor**: `Kestrel monitor: pairs=3 new_states=39`
- **Observation**: The `USDT-BTC` regime control alert persists. `USDT-PAXG` continues in the runner-manage phase. No new errors or concerning transitions.

## 2026-04-01 - Live audit of active Aegis/Kestrel runtime and config

### What was analyzed

- Reviewed active pair matrix in `/home/xaos/gunbot/config.js`
- Reviewed recent live strategy output in `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`
- Reviewed current monitor outputs:
  - `/home/xaos/gunbot/customStrategies/ops/aegis-monitor-report.txt`
  - `/home/xaos/gunbot/customStrategies/ops/kestrel-monitor-report.txt`
  - `/home/xaos/gunbot/customStrategies/ops/summary-6h.txt`
- Reviewed current runtime code in:
  - `/home/xaos/gunbot/customStrategies/Aegis.js`
  - `/home/xaos/gunbot/customStrategies/Kestrel.js`
- Reviewed live pair state JSON for the active pairs.

### Findings

- Closed-trade evidence is currently positive across the active set:
  - `Aegis / USDT-PAXG`: realized PnL about `+1.22 USDT`
  - `Aegis / USDT-BTC`: realized PnL about `+1.34 USDT`
  - `Aegis / USDT-ETH`: realized PnL about `+1.46 USDT`
  - `Kestrel / USDT-PENDLE`: realized PnL about `+0.38 USDT`
  - `Kestrel / USDT-BNB`: realized PnL about `+0.36 USDT`
  - `Kestrel / USDT-XRP`: realized PnL about `+0.67 USDT`
- Open-bag posture also looks materially healthier than the older stop-exit phase:
  - `PAXG` is in runner mode with positive live PnL
  - `BTC` and `SOL` are managing live Aegis bags
  - `BNB`, `PENDLE`, and `XRP` are managing live Kestrel bags
- Two real defects were confirmed from live evidence:
  1. both strategies still defaulted `unlimitedCount` to `true`, which caused misleading `0/unl` add-cap telemetry despite `config.js` specifying capped add counts
  2. Aegis could emit `setup-armed` notifications during exit cooldown because cooldown normalization happened too late in the cycle
- No evidence justified loosening DCA / reload thresholds yet:
  - add counts are still `0/x`
  - but live bags are being managed cleanly
  - no new forced red exits were observed

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/Aegis.js`
- Updated `/home/xaos/gunbot/customStrategies/Kestrel.js`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`
- Updated `/home/xaos/gunbot/config.js`

### Behavior changed

- `Aegis.js` is now `1.4.1`
- `Kestrel.js` is now `1.4.1`
- Both strategies now default bounded add capacity correctly:
  - `unlimitedCount=false`
- Aegis now normalizes an expired cooldown back to `flat` before setup evaluation runs, which prevents false `setup-armed` events while the final state still reports cooldown / reset behavior.
- Added explicit pair overrides in `config.js` for:
  - `AEGIS_UNLIMITED_DCA=false`
  - `KESTREL_UNLIMITED_DCA=false`
  on all active custom pairs so behavior stays bounded even before every runtime refresh settles.

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-171726-apr1-audit-fixes`
- `node --check /home/xaos/gunbot/customStrategies/Aegis.js` passed
- `node --check /home/xaos/gunbot/customStrategies/Kestrel.js` passed
- `/home/xaos/gunbot/config.js` parses as valid JSON
- Live logs now show:
  - `Aegis Regime Reclaim 1.4.1`
  - `Kestrel Tape Scalper 1.4.1`
- Live telemetry now shows bounded add counts again:
  - Aegis examples: `0/1`, `0/2`, `0/3`
  - Kestrel examples: `0/4`
- The old spammy BTC `setup-armed` lines appear only in pre-fix `1.4.0` log output.

### Next

1. Let the current bags play out under `1.4.1` before touching reload / DCA thresholds.
2. Revisit add-threshold tuning only if the next few hours show price repeatedly missing add targets by a small margin while reclaim/liquidity stay valid.
3. Keep Aegis as the strict primary lane and Kestrel as the more experimental bag-management lane.

## 2026-04-01 - Spot bag doctrine update, unlimited below-BEP adds, and moving TP ladder

### What was analyzed

- Reviewed current Aegis and Kestrel bag-management code in:
  - `/home/xaos/gunbot/customStrategies/Aegis.js`
  - `/home/xaos/gunbot/customStrategies/Kestrel.js`
- Reviewed active pair overrides in `/home/xaos/gunbot/config.js`
- Reviewed live chart-target behavior and current state/log clues, especially:
  - static TP1 line after partial sells
  - old capped-add overrides conflicting with desired spot doctrine

### Findings

- The user-facing complaint was valid:
  - Aegis and Kestrel were still single-target partial systems (`TP1` + runner) instead of a true multi-chunk sell ladder.
  - On-chart sell targets did not move to the next logical target after TP1 because `customSellTarget` stayed pinned to the TP1 price.
- Aegis still blocked DCA after TP1, which is not compatible with a hold-the-bag spot doctrine.
- Both strategies still defaulted to bounded add counts after the earlier audit pass, which no longer matched the intended operating model.
- Neither strategy exposed an optional bag-exposure cap by base currency or `TRADING_LIMIT` percentage, even though that is the cleanest safety valve when unlimited add mode is enabled.

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/Aegis.js`
- Updated `/home/xaos/gunbot/customStrategies/Kestrel.js`
- Updated `/home/xaos/gunbot/customStrategies/AGENTS.md`
- Updated `/home/xaos/gunbot/customStrategies/GUIDE.md`
- Updated `/home/xaos/gunbot/customStrategies/KESTREL.md`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`
- Updated `/home/xaos/gunbot/config.js`

### Behavior changed

- `Aegis.js` is now `1.5.0`
- `Kestrel.js` is now `1.5.0`
- Default add doctrine changed in both strategies:
  - unlimited add mode now defaults to `true`
  - below-break-even filtering stays enabled by default
  - profit-only exits stay enabled by default
- Added optional bag-cap controls:
  - Aegis:
    - `AEGIS_MAX_BAG_BASE`
    - `AEGIS_MAX_BAG_PCT_OF_TRADING_LIMIT`
  - Kestrel:
    - `KESTREL_MAX_BAG_BASE`
    - `KESTREL_MAX_BAG_PCT_OF_TRADING_LIMIT`
- Added a real multi-step take-profit ladder in both strategies:
  - `TP1`
  - `TP2`
  - trailing runner
- On any new DCA / reload, the partial-sell ladder now resets against the refreshed bag average.
- Aegis DCA no longer stops just because TP1 already happened. If the market makes a lower low and the below-BEP guards still pass, the strategy can add again and re-arm the ladder.
- Chart targets now move with the active state:
  - before TP1: `customSellTarget = TP1`
  - after TP1: `customSellTarget = TP2`
  - after TP2: `customTrailingTarget = runner trail`
- Pair overrides were aligned to the doctrine:
  - active Aegis pairs now explicitly set `AEGIS_UNLIMITED_DCA=true`, `AEGIS_DCA_BELOW_BREAK_EVEN_ONLY=true`, `AEGIS_PROFIT_ONLY_EXITS=true`
  - active Kestrel pairs now explicitly set `KESTREL_UNLIMITED_DCA=true`, `KESTREL_RELOAD_BELOW_BREAK_EVEN_ONLY=true`, `KESTREL_PROFIT_ONLY_EXITS=true`

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-174222-spot-bag-ladder`
- `node --check /home/xaos/gunbot/customStrategies/Aegis.js` passed
- `node --check /home/xaos/gunbot/customStrategies/Kestrel.js` passed
- `/home/xaos/gunbot/config.js` was rewritten as valid JSON and still parses

### Next

1. Watch the next partial-sell event on both strategies and confirm the chart moves from `TP1` to `TP2` instead of leaving a stale first target behind.
2. Watch the first lower-low add after a partial sell and confirm the ladder resets cleanly from the new bag average.
3. If unlimited add mode becomes too loose on any pair, use the new bag-cap keys instead of reverting to hard stop-loss logic.

## 2026-04-01 - Viper spec rewrite and naming normalization

### What was analyzed

- Reviewed the existing `/home/xaos/gunbot/customStrategies/VIPER.md` draft
- Compared the old draft against the current live strategy lineup:
  - Aegis as the strict premium regime-entry lane
  - Kestrel as the fast beta lane
- Evaluated whether the old `RAAD` / `STRAD` draft was actually distinct enough to justify a future third strategy

### Findings

- The old draft had a good underlying idea, but it was inconsistent in identity:
  - mixed names: `STRAD`, `RAAD`, `BTC Spot Strategy Spec`
  - overly BTC-specific framing even though the logic can apply to other liquid spot pairs
- The real strategic difference versus Aegis and Kestrel is not speed or timeframe.
  It is **inventory-first bag management**:
  - BEP-aware adds
  - reserve-aware deployment
  - staged profitable trims
  - no-stop-loss spot doctrine from the start
- That makes Viper a valid future third lane, but only if it stays distinct from Aegis instead of becoming "Aegis with slower candles."

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/VIPER.md`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`

### Behavior changed

- Rewrote `VIPER.md` into a normalized Viper specification.
- Removed older mixed naming and made **Viper** the single product name.
- Changed the design from a BTC-only draft to a **pair-capable liquid-spot inventory strategy**.
- Incorporated current project doctrine and newer ideas from Aegis/Kestrel development:
  - spot only
  - no forced red exits by default
  - BEP-driven DCA
  - reserve-aware bag growth
  - staged trims
  - pair-capable profiles
  - strong telemetry / chart expectations
- Explicitly positioned Viper as:
  - distinct from Aegis
  - distinct from Kestrel
  - focused on inventory quality, not generic entry timing

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-180744-viper-spec-rewrite`
- Verified rewritten `/home/xaos/gunbot/customStrategies/VIPER.md` exists and renders as the new spec

### Next

1. Hold here as requested and do not start `Viper.js` yet.
2. If Viper moves into implementation later, treat it as a separate strategy family with separate docs and runtime logic.
3. Do not let Viper collapse into "Aegis with slower settings" or "Kestrel with more DCA."

## 2026-04-01 - Viper runtime implementation

### What was analyzed

- Implemented the first real `/home/xaos/gunbot/customStrategies/Viper.js` from the rewritten `/home/xaos/gunbot/customStrategies/VIPER.md` spec
- Validated the new file against current Aegis/Kestrel runtime patterns:
  - Gunbot override reads
  - spot inventory sizing semantics
  - pair-ledger persistence
  - chart/sidebar/notification payloads
- Ran syntax validation and a stubbed Gunbot runtime harness in:
  - flat / no-bag mode
  - in-bag / profitable trim mode

### Findings

- Viper is a genuinely distinct strategy family, not an Aegis clone:
  - daily macro regime
  - 4H execution layer
  - 1H timing confirmation
  - reserve-aware starter sizing
  - BEP-aware recovery buys
  - staged profitable trims instead of TP1/TP2/runner
- The first pass of `Viper.js` was structurally sound, but two control-flow bugs surfaced during validation:
  - regime-change notifications could never fire because `state.lastRegime` was overwritten before the comparison
  - add/trim cooldown states were not surfaced correctly in stage/skip reporting
- A third runtime issue was introduced during the first cleanup patch:
  - missing closing braces near the end of `runViper`
  - caught by `node --check` and fixed immediately

### Files changed

- Created `/home/xaos/gunbot/customStrategies/Viper.js`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`

### Behavior added

- Added `Viper Inventory Engine 1.0.1` as a new single-file Gunbot strategy
- Core logic shipped:
  - 1D macro regime classification: `bull`, `neutral`, `bear`
  - 4H execution scoring for starter entries, recovery adds, and profitable trim tiers
  - 1H timing confirmation for reclaim / reversal quality
  - reserve-aware capital gating
  - unlimited-or-capped BEP-aware add logic
  - profit-only staged trims: `trim1`, `trim2`, `trim3`
  - core-hold logic by regime instead of full exit bias
  - chart targets for starter/add, BEP, next trim, and risk floor zone
  - sidebar telemetry for regime, mode, setup, add state, trim state, reserve, and exposure
- Validation hardening added during implementation:
  - fixed regime transition notification logic
  - fixed add/trim cooldown stage reporting
  - removed `customStopTarget` usage so the chart does not imply stop-loss behavior in a profit-only spot strategy

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-183502-viper-runtime`
- `node --check /home/xaos/gunbot/customStrategies/Viper.js` passed
- Stubbed runtime harness passed in both:
  - flat starter-watch mode
  - in-bag trim execution mode
- Verified that Viper produces:
  - sidebar extras
  - chart targets/shapes
  - state logs without runtime exceptions

### Next

1. Attach `Viper.js` to one liquid simulator pair first, preferably BTC, ETH, or PAXG.
2. Watch the first real starter buy and verify:
   - reserve gating
   - add target placement
   - trim target movement after partial sells
3. If the first live Viper pair is too inactive, tune starter score and value-zone chase controls before touching recovery math.

## 2026-04-01 - Viper timeframe profile correction

### What was analyzed

- Reviewed the freshly restarted live matrix after new Viper pairs were added
- Verified `/home/xaos/gunbot/config.js` currently runs the Viper pairs on `PERIOD=15`
- Rechecked Viper’s internal timeframe defaults against the actual operator goal:
  - more action
  - still multi-timeframe
  - still inventory-aware

### Findings

- `240m` is `240 minutes = 4 hours`, not 4 days
- The pair chart timeframe and Viper’s internal fetch timeframes are separate concerns
- The original Viper default of `1D / 4H / 1H` was valid structurally, but too slow for the way this Gunbot setup is actually being used
- The better default for this repo is:
  - balanced: `4H / 1H / 15m`
  - aggressive: `2H / 30m / 15m`
  while keeping conservative at `1D / 4H / 1H`

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/Viper.js`
- Updated `/home/xaos/gunbot/customStrategies/VIPER.md`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`

### Behavior changed

- Bumped Viper to `1.0.2`
- Risk profiles now also define default internal timeframes:
  - `conservative`: macro `1440`, execution `240`, timing `60`
  - `balanced`: macro `240`, execution `60`, timing `15`
  - `aggressive`: macro `120`, execution `30`, timing `15`
- Cache intervals were tightened to match the faster balanced/aggressive profile expectations
- This means Viper can stay on pair `PERIOD=15` charts while making more frequent internal decisions without collapsing to pure 15m noise

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-192416-viper-timeframe-tune`
- `node --check /home/xaos/gunbot/customStrategies/Viper.js` passed after the profile timing change

### Next

1. Let the fresh Viper pairs run with the new balanced defaults before touching entry looseness.
2. If a specific Viper pair is still too slow, tune per-pair with:
   - `VIPER_MACRO_PERIOD`
   - `VIPER_EXECUTION_PERIOD`
   - `VIPER_TIMING_PERIOD`
3. Prefer timeframe tuning first, score loosening second.

## 2026-04-01 - Viper live pair audit and tuning pass

### What was analyzed

- Reviewed the freshly restarted Viper pair blocks in `/home/xaos/gunbot/config.js`
- Checked live Viper visibility in `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`
- Inspected active state files:
  - `/home/xaos/gunbot/json/binance-USDT-STO-state.json`
  - `/home/xaos/gunbot/json/binance-USDT-TAO-state.json`
  - `/home/xaos/gunbot/json/binance-USDT-ZEC-state.json`
  - `/home/xaos/gunbot/json/binance-USDT-NIGHT-state.json`
- Simulated the patched Viper runtime against the current state-file candle data to sanity-check stage and skip behavior before handing it back live

### Findings

- The new Viper pairs were not actually configured as Viper pairs in any meaningful way yet.
  They had been cloned from older generic pair blocks and were still carrying:
  - `TRADING_LIMIT = 0.002`
  - `MIN_VOLUME_TO_BUY = 0.001`
  - no `VIPER_RISK_PROFILE`
  - no `VIPER_LOG_MODE`
  - no explicit Viper timeframes or sizing controls
- That was the main operational defect.
  Before any strategy math discussion, Viper needed real pair overrides.
- Viper logs were effectively absent from `gunbot_logs.txt` because the live pairs were still on default event-only telemetry behavior.
- Live state before the patch showed:
  - `STO`: `bull`, flat, `starter-watch`, blocked by `chase-blocked` / then `not-in-value-zone`
  - `TAO`: `neutral`, flat, `starter-watch`, blocked by `not-in-value-zone`
  - `ZEC`: already in bag / inventory-manage state
  - `NIGHT`: `bear-standby`
- A deeper design issue also surfaced:
  faster Viper profiles had been using faster macro periods but still the same slow `50/200` regime model.
  That made the “faster” profiles too history-hungry and too sluggish for this repo’s actual operating style.

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/Viper.js`
- Updated `/home/xaos/gunbot/config.js`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`

### Behavior changed

- Bumped Viper to `1.0.3`
- Improved Viper runtime defaults:
  - default telemetry log mode is now `changes`
  - balanced profile now uses faster, more realistic internal timing for this workspace
  - aggressive profile now uses a genuinely faster regime model instead of reusing conservative-style `50/200`
- Added defensive sizing normalization:
  - if a Viper pair on a stable-base market inherits a nonsense generic trade limit like `0.002` and no explicit `VIPER_TRADE_LIMIT` is set, Viper now falls back to its sane default trade limit instead of silently starving itself
- Added aggregated local candle fallback for higher-timeframe fetches:
  - macro and timing candle requests can now rebuild from local pair candles when fetches fail and the period is a multiple of the chart timeframe
- Broadened starter value-zone logic slightly:
  - starter entries are now less strict than recovery adds, which fits Viper’s inventory-first role better

### Pair override changes

- All live Viper pairs now have explicit:
  - `VIPER_TRADE_LIMIT`
  - `MIN_VOLUME_TO_BUY = 15`
  - `MIN_VOLUME_TO_SELL = 15`
  - `VIPER_RISK_PROFILE`
  - `VIPER_LOG_MODE = cycle`
  - `VIPER_UNLIMITED_DCA = true`
  - `VIPER_DCA_BELOW_BREAK_EVEN_ONLY = true`
  - `VIPER_PROFIT_ONLY_EXITS = true`
  - charts / shapes / notifications enabled
- New live Viper posture:
  - `USDT-STO`: aggressive, `75`
  - `USDT-TAO`: balanced, `120`
  - `USDT-ZEC`: balanced, `100`
  - `USDT-NIGHT`: aggressive, `60`
- Pair `CANDLES_LENGTH` was increased to `800` on the Viper pairs to improve local chart depth and local higher-timeframe fallback quality

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-192416-viper-timeframe-tune`
- `node --check /home/xaos/gunbot/customStrategies/Viper.js` passed
- `/home/xaos/gunbot/config.js` parses cleanly as JSON
- Simulated post-patch Viper behavior against current state-file candles showed:
  - `STO`: `bull`, flat, `starter-watch`, `not-in-value-zone`
  - `TAO`: `neutral`, flat, `starter-watch`, `not-in-value-zone`
  - `ZEC`: in bag, `inventory-manage`, `discount-too-shallow`
  - `NIGHT`: `bear`, flat, `bear-standby`

### Next

1. Reload or restart the Viper pairs so Gunbot actually runs `Viper 1.0.3` and the new pair overrides.
2. Watch the first cycle logs for:
   - `STO` and `TAO` starter-watch evolution
   - `ZEC` bag-management and first trim behavior
   - `NIGHT` staying disciplined in bear-standby unless regime improves
3. If `STO` and `TAO` remain stuck on `not-in-value-zone` for many cycles after the reload, tune starter entry looseness again before touching recovery/add logic.

## 2026-04-01 - Viper Live Buy Audit And Sizing Normalization

### What was analyzed

- Reviewed latest live `Viper Inventory Engine 1.0.3` cycle logs in `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`
- Reviewed live pair state files for:
  - `USDT-TAO`
  - `USDT-STO`
  - `USDT-ZEC`
  - `USDT-NIGHT`
- Compared Viper trade-limit override handling against Aegis and Kestrel
- Audited Viper add-distance math and live pair overrides in `/home/xaos/gunbot/config.js`

### Findings

- Viper is live and managing inventory correctly, not forcing red exits.
- Current live posture:
  - `USDT-STO`: active bag, profit oscillating from roughly `-1.6%` back to `+3.7%`, then still in-bag
  - `USDT-ZEC`: active bag, shallow red, consistently blocked by `discount-too-shallow`
  - `USDT-TAO`: flat, `starter-watch`, mostly `waiting-reversal`
  - `USDT-NIGHT`: flat, `bear-standby`
- The main Viper tuning gap was not starter logic. It was add math on volatile pairs:
  - ATR-driven discount and spacing could dominate too hard
  - on `STO` this pushed `nextAdd` much too far below BEP for a spot inventory strategy
- Viper already supported `VIPER_TRADE_LIMIT`, but the live pair overrides were inconsistent (`120 / 75 / 100 / 60`), which made the UI and pair sizing less coherent than Aegis.

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/Viper.js`
- Updated `/home/xaos/gunbot/config.js`
- Updated `/home/xaos/gunbot/customStrategies/VIPER.md`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`

### Behavior changed

- Bumped Viper to `1.0.4`
- Added ATR caps to recovery/add math:
  - `VIPER_SPACING_ATR_CAP_PCT`
  - `VIPER_DISCOUNT_ATR_CAP_PCT`
- Viper now caps ATR-driven spacing and discount so cheap volatile pairs do not require extreme pullbacks before averaging down
- Added more operator-visible telemetry:
  - cycle logs now include `trade=`, `discT=`, and `space=`
  - sidebar now shows:
    - `Trade`
    - `Disc Tgt`
    - `Spacing`
- Normalized all live Viper pairs to `100 USDT` per trade through both:
  - `TRADING_LIMIT`
  - `VIPER_TRADE_LIMIT`
- Increased all live Viper pair `CANDLES_LENGTH` values to `800` to better support higher-timeframe aggregation fallback
- Added pair-specific ATR caps on the more active Viper lanes:
  - `STO`
  - `ZEC`
  - `NIGHT`

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-200054-viper-live-audit`
- `node --check /home/xaos/gunbot/customStrategies/Viper.js` pending after patch
- `/home/xaos/gunbot/config.js` parse pending after patch

### Next

1. Reload/restart the Viper pairs so Gunbot picks up `Viper 1.0.4` and the normalized `100` trade size.
2. Watch whether `STO` and `ZEC` move their `nextAdd` targets materially closer to BEP under the new ATR caps.
3. If `STO` still refuses normal recovery adds after the cap patch, lower aggressive-profile discount base next, not starter logic.

## 2026-04-01 - Live Cross-Strategy Audit And State Anchor Fix

### What was analyzed

- Reviewed latest live strategy logs across:
  - `Aegis`
  - `Kestrel`
  - `Viper`
- Reviewed latest pair-state snapshots and 6h digest output
- Checked repeated transition logs against runtime state handling

### Findings

- Viper is currently the strongest live-behaving lane:
  - `USDT-STO` successfully held inventory and executed `trim3` profitably under `Viper 1.0.4`
  - `USDT-ZEC` is stable but still too shallow for its next recovery add
  - `USDT-TAO` remains disciplined and flat in `starter-watch`
- Aegis trade logic is behaving defensively, but repeated:
  - `bag-detected`
  - `setup-armed`
  log lines showed that transition memory was not being anchored reliably enough across cycles
- The same underlying issue could affect Kestrel and Viper transition state too:
  - trim flags
  - DCA/reload counters
  - prior-cycle transition memory

### Root cause

- The strategies resolved a snapshot runtime object, but state initialization did not always anchor itself back to the live `pairLedger.customStratStore` object first.
- That made transition memory less reliable than intended, even though chart/state calculations inside a single cycle still worked.

### Files changed

- Updated `/home/xaos/gunbot/customStrategies/Aegis.js`
- Updated `/home/xaos/gunbot/customStrategies/Kestrel.js`
- Updated `/home/xaos/gunbot/customStrategies/Viper.js`
- Updated `/home/xaos/gunbot/customStrategies/LOG.md`
- Updated `/home/xaos/gunbot/customStrategies/MEMORY.md`

### Behavior changed

- Anchored all three strategies to `gb.data.pairLedger.customStratStore` as the canonical live persistent store
- Synced `gb.data.customStratStore` back to that live object after anchoring
- Bumped versions:
  - `Aegis 1.5.1`
  - `Kestrel 1.5.1`
  - `Viper 1.0.5`

### Live strategy read after audit

- `Aegis`
  - `PAXG` is still the closest flat setup, mostly blocked by reclaim timing/quality
  - `BTC`, `ETH`, and `SOL` are all active bags being managed without forced red exits
- `Kestrel`
  - all three beta pairs are active bags
  - no fresh evidence yet that reload thresholds are broken
  - no logic loosening was justified in this pass
- `Viper`
  - `STO` is proving the staged trim model can work live
  - `ZEC` remains conservative on adds, but not broken

### Verification

- Backup created at `/home/xaos/gunbot/backups/aegis-20260401-201812-state-anchor-fix`
- `node --check /home/xaos/gunbot/customStrategies/Aegis.js` passed
- `node --check /home/xaos/gunbot/customStrategies/Kestrel.js` passed
- `node --check /home/xaos/gunbot/customStrategies/Viper.js` passed
- `/home/xaos/gunbot/config.js` parses cleanly

### Next

1. Reload the active pairs so Gunbot picks up:
   - `Aegis 1.5.1`
   - `Kestrel 1.5.1`
   - `Viper 1.0.5`
2. Confirm that repeated `bag-detected` and `setup-armed` spam disappears.
3. Only if post-fix logs still show Viper `ZEC` or Kestrel bags missing obvious add opportunities, tune add thresholds next.
