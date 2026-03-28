# LOG.md

## 2026-03-27

### Session focus

Phase 0 audit for Aegis, followed by the first real implementation target for `Aegis.js`.

### What was analyzed before coding

1. `AGENTS.md`
2. Local Gunbot folder structure under `/home/xaos/gunbot`
3. Local pair and memory state files under `/home/xaos/gunbot/json`
4. `/home/xaos/gunbot/config.js`
5. Official Gunbot custom strategy docs:
   - Create and Run a Custom Strategy in Gunbot
   - Available Methods and Modules for Custom Strategies
   - Available Market and Position Data
   - Persistent Storage for Custom Strategies
   - Visualize Strategy Targets
   - Display Custom Stats and GUI Notifications
   - Send Notifications to the Gunbot GUI
   - Control Strategy Parameters from the GUI
   - Add Your Own Logs to Custom Strategies
   - Custom Strategy Code Examples

### Local repository / Gunbot environment findings

- Working directory is `/home/xaos/gunbot/customStrategies`.
- `customStrategies` currently contained only `AGENTS.md` before this session.
- No project `README.md` was present in the repo-local scope. Only unrelated `README` files existed under `node_modules`.
- Gunbot root contains relevant runtime files and folders:
  - `/home/xaos/gunbot/config.js`
  - `/home/xaos/gunbot/config-js-example.txt`
  - `/home/xaos/gunbot/json/`
  - `/home/xaos/gunbot/gunbot_logs/`
  - `/home/xaos/gunbot/customStrategies/`
- Current live pair config in `config.js` is `binance / USDT-PAXG`, currently using another custom strategy profile (`quanta_exotrader`) with `BUY_METHOD` and `SELL_METHOD` both set to `custom`.

### Local example strategy findings

- No local custom strategy source files were present in `./customStrategies`.
- No other local custom strategy JavaScript sources were found outside `node_modules`.
- Locally accessible strategy references were limited to pair-state artifacts:
  - `/home/xaos/gunbot/json/memory.json`
  - `/home/xaos/gunbot/json/binance-USDT-PAXG-state.json`
  - `/home/xaos/gunbot/json/binance-USDT-PAXG-quantaexotrader-state.json`
- These were used only for runtime shape verification and UI/telemetry architecture ideas, not for code reuse.

### Verified Gunbot runtime capabilities used for Aegis

#### Strategy runtime model

- Gunbot custom strategies run as asynchronous JavaScript functions.
- Gunbot docs explicitly state Node.js compatibility target `v14.4.0`.
- Strategy files are stored in `./customStrategies` and selected in GUI as custom strategy filenames.

#### `gb.data`

Verified from official docs and local pair-state structures:

- Core pair context:
  - `gb.data.pairName`
  - `gb.data.exchangeName`
  - `gb.data.period`
- Balances and position state:
  - `gb.data.baseBalance`
  - `gb.data.quoteBalance`
  - `gb.data.onOrdersBalance`
  - `gb.data.breakEven`
  - `gb.data.gotBag`
  - `gb.data.openOrders`
  - `gb.data.orders`
- Orderbook / pricing:
  - `gb.data.bid`
  - `gb.data.ask`
  - `gb.data.orderbook`
- Candle arrays:
  - `gb.data.candlesOpen`
  - `gb.data.candlesHigh`
  - `gb.data.candlesLow`
  - `gb.data.candlesClose`
  - `gb.data.candlesVolume`
  - `gb.data.candlesTimestamp`
  - `gb.data.candles`
- Precalculated indicators documented as available when configured:
  - `ema1`, `ema2`, `ema3`
  - `rsi`
  - `mfi`
  - `lowBB`, `highBB`
  - `fastSma`, `slowSma`
  - `macd`, `macdSignal`, `macdHistogram`
  - `stochK`, `stochD`, `stochRsi`
  - `atr`, `adx`, `diPlus`, `diMinus`
  - Ichimoku values
- Raw pair ledger:
  - `gb.data.pairLedger`
  - Official docs confirm this mirrors pair JSON data and may hold custom persistent variables.

#### `gb.method`

Verified from official docs:

- Spot order methods:
  - `buyMarket`
  - `sellMarket`
  - `buyLimit`
  - `sellLimit`
  - post-only limit methods
- Utility / data methods:
  - `getCandles`
  - `getLedger`
  - `getTrend`
  - `cancelOrder`
  - `setTimeScaleMark`
  - `tulind`
  - `require`
- Order methods return Promises.
- `getCandles(count, period, pair, exchange)` is the safest documented way to fetch extra OHLCV for higher-timeframe logic.

#### Additional OHLCV / module loading

- Official docs verify `await gb.method.getCandles(...)` for extra timeframes.
- Official docs verify `gb.method.require(...)` for loading Node/CommonJS modules from `user_modules`.
- For Aegis v1, no external module dependency is required.

#### Persistence

- Official docs verify `gb.data.pairLedger.customStratStore` as the supported persistent storage area for custom strategies.
- Official guidance warns against heavy dependence on persistence for critical truth.
- Local state files currently do not contain a `customStratStore`, so Aegis must initialize it defensively.
- Safe intended Aegis v1 persistence uses:
  - cooldown timestamps
  - phase flags
  - DCA count
  - trail peak / trail stop state
  - last action metadata
  - notification dedupe
  - cached higher-timeframe regime metrics

#### Pair overrides

- Official docs verify custom override access via `gb.data.pairLedger.whatstrat`.
- Official docs warn GUI-entered numeric values may arrive as strings and booleans may arrive as booleans or strings.
- Local config and state files confirm `whatstrat` is the merged override/settings object for the active pair.
- Aegis should parse all overrides defensively.

#### Chart targets / visuals

- Official docs verify easy target fields:
  - `gb.data.pairLedger.customBuyTarget`
  - `gb.data.pairLedger.customSellTarget`
  - `gb.data.pairLedger.customStopTarget`
  - `gb.data.pairLedger.customCloseTarget`
  - `gb.data.pairLedger.customTrailingTarget`
  - `gb.data.pairLedger.customDcaTarget`
- Official docs verify advanced line arrays via `gb.data.pairLedger.customChartTargets`.
- Official docs verify advanced shapes via `gb.data.pairLedger.customChartShapes`.
- Local state files confirm `customChartShapes` and `customChartTargets` exist in pair ledger state.
- Local `quantaexotrader` state confirms TradingView shape objects persist and use price/time point objects plus `options`.

#### Sidebar telemetry / GUI notifications

- Official docs verify:
  - `gb.data.pairLedger.sidebarExtras`
  - `gb.data.pairLedger.notifications`
- Official docs state `sidebarExtras` is overwritten each cycle and must be refreshed every run.
- Official docs state notifications are arrays of objects with:
  - `text`
  - `variant`
  - `persist`
- Local memory state confirms `sidebarExtras` is heavily used by another strategy and persists in pair ledger.

#### Logging

- Official docs verify `gb.method.require('fs')` can be used for custom file logging.
- For Aegis v1, optional file logging is useful only for explicit debug mode and should remain off by default to avoid noisy writes.

### Runtime assumptions for Aegis v1

- Aegis will target spot only and will not depend on futures-only fields.
- Aegis will not depend on external services or `user_modules`.
- Aegis will compute its own core EMA, RSI, and ATR values from candle arrays so it does not depend on indicator-tab configuration.
- Higher-timeframe regime logic will use `gb.method.getCandles(...)` with lightweight cached derived metrics in `customStratStore`.
- If higher-timeframe fetch fails and no cached regime metrics exist, Aegis will block new entries rather than guessing regime.
- Live bag truth will be derived from current Gunbot state (`gotBag`, balances, break-even, open orders), not only from persistence.
- Aegis will treat `whatstrat.TRADE_LIMIT` and `whatstrat.TRADING_LIMIT` as interchangeable base-currency sizing inputs when present, because both patterns exist locally / in docs.

### Files changed in this session

- Added `LOG.md`
- Added `Aegis.js`

### Behavior implemented

#### Aegis core flow

- Single-file plain JavaScript custom strategy exported as an async function.
- Defensive Gunbot runtime resolution:
  - accepts a passed-in `gb` object if Gunbot provides it
  - falls back to `globalThis.gb` / `global.gb` if Gunbot exposes `gb` globally
- Internal structure split into:
  - metadata / defaults
  - override parsing
  - state initialization
  - math helpers
  - higher-timeframe regime fetch / analysis
  - current-timeframe setup analysis
  - decision / action helpers
  - chart updates
  - sidebar telemetry
  - notification helpers
  - main execution flow

#### Entry logic

- Higher-timeframe regime gate based on:
  - HTF close vs slow EMA
  - HTF fast EMA vs slow EMA
  - HTF fast EMA slope
  - HTF fast/slow separation sanity
- Value-zone pullback gate based on:
  - local fast/slow EMA band
  - recent impulse pullback percentage
- Reclaim confirmation based on:
  - lower wick ratio
  - close location within candle range
  - close above fast EMA
  - close above previous close
- Momentum sanity based on locally calculated RSI and RSI delta
- Liquidity sanity based on:
  - live spread
  - relative candle volume
  - signal candle range ceiling
- Composite score is transparent:
  - regime + value + reclaim + momentum + liquidity
- Default profile requires full 5/5 score for entries

#### DCA logic

- DCA only when:
  - bag exists
  - no open orders
  - no active TP1 runner phase
  - regime still valid
  - liquidity still valid
  - value zone still valid
  - reclaim still valid by default
  - price has moved the configured minimum distance below last fill
  - DCA count has not exceeded cap
  - price is still above invalidation
  - depth below break-even has not exceeded configured max

#### Exit logic

- Invalidation full exit
- TP1 partial exit
- Runner activation after TP1
- ATR-adaptive trailing stop for runner
- Stale-trade timeout exit when a trade has gone nowhere for too long

#### Persistence / recovery

- Uses `gb.data.pairLedger.customStratStore.aegis`
- Stores only lightweight state:
  - cooldown
  - phase
  - DCA count
  - trail peak / stop
  - last action timestamps
  - last fill estimate
  - last skip reason
  - notification dedupe keys
  - cached HTF derived metrics
- Recovers bag timing conservatively from live state, with `pairLedger.whenwebought` used only as optional fallback if present

#### Visualization / telemetry

- Easy targets:
  - `customBuyTarget`
  - `customSellTarget`
  - `customStopTarget`
  - `customTrailingTarget`
  - `customDcaTarget`
- Advanced chart targets with Aegis-specific labels
- Optional value-zone rectangle shape
- Sidebar telemetry each cycle with:
  - strategy version
  - regime state
  - score
  - setup state
  - phase
  - DCA count
  - trail stop
  - invalidation
  - spread
  - RSI
  - live PnL
  - bag age
  - skip reason
- GUI notifications for:
  - setup armed
  - regime enabled
  - regime disabled
  - entry executed
  - DCA executed
  - TP1 taken / runner armed
  - invalidation exit
  - stale exit
  - runner trail exit

### Runtime assumptions still in force

- Export shape assumption:
  - docs clearly say custom strategies are async functions, but local sources did not explicitly show whether Gunbot passes `gb` as an argument or exposes it globally
  - implementation supports both argument-passed and global `gb`
- Higher-timeframe data assumption:
  - Aegis expects `gb.method.getCandles(...)` to be available and to return documented OHLCV object arrays
  - if HTF fetch fails and no cached HTF metrics exist, Aegis blocks new entries instead of inferring regime
- File logging:
  - intentionally deferred for v1 runtime simplicity even though Gunbot supports it

### Current test status

- `node --check /home/xaos/gunbot/customStrategies/Aegis.js` passed
- Stubbed execution against local pair-state data passed for:
  - base strategy execution
  - no-HTF-data fallback branch
  - normal HTF normalization / regime-analysis branch using synthetic `getCandles` output built from local candles
- No live Gunbot simulator run was performed inside this session
- No live exchange run was performed inside this session

### 2026-03-27 runtime fix

- Gunbot reported `ReferenceError: module is not defined`
- This confirmed the current Gunbot runtime evaluates custom strategy code directly instead of always exposing a CommonJS `module` object
- `Aegis.js` was updated so that:
  - it exports via `module.exports` only when `module` exists
  - otherwise it self-invokes `aegisStrategy(...)` for Gunbot eval execution
- Follow-up syntax check passed after this change

### Remaining / next iteration

1. Run Aegis in Gunbot simulator on one controlled pair
2. Validate chart cleanup behavior in the actual GUI
3. Validate notification cadence in the actual GUI
4. Confirm Gunbot runtime calls the strategy export exactly as expected
5. Tune default thresholds on majors like BTC/USDT and ETH/USDT
6. Consider optional debug file logging only after simulator evidence justifies it

### 2026-03-27 live runtime inspection

- Verified that Aegis is currently attached to `USDT-BTC`, not `USDT-PAXG`
- `USDT-PAXG` is still running another custom strategy profile (`STRAT_FILENAME: "filename.js"`) and its sidebar telemetry remains Quanta exoTrader output
- Aegis is executing without runtime exceptions on `USDT-BTC`
- Current live Aegis state from `binance-USDT-BTC-state.json`:
  - `Regime: OFF 0/4`
  - `Score: 1/5`
  - `Setup: IDLE`
  - `Phase: FLAT`
  - `Skip: regime-fail`
  - no active chart targets or shapes
  - no active notifications
- Current cached higher timeframe regime metrics in `customStratStore.aegis.htfMetrics`:
  - `close: 65788.2`
  - `fast EMA: 67259.4576`
  - `slow EMA: 68585.4874`
  - `slopePct: -0.7159`
  - `separationPct: -1.9334`
  - `reason: regime-fail`
- Interpretation:
  - Aegis is correctly staying flat because its higher timeframe gate is bearish and failing all 4 regime checks
- Pair log visibility note:
  - `binance.USDT-BTC.log` currently shows only Gunbot core cycle tables
  - no Aegis-specific log lines have appeared yet because:
    - `ENABLE_DEBUG_LOGS` defaults to false
    - info logs only fire on meaningful transitions such as setup armed, regime toggle, entries, exits, or bag recovery
    - current runtime has remained in the same flat / regime-fail state

### 2026-03-27 development observability and config hardening

- Created backups before editing:
  - `/home/xaos/gunbot/backups/aegis-20260327-194241/`
- Added persistent working memory file:
  - `MEMORY.md`
- Updated `AGENTS.md` to require:
  - timestamped backups before edits
  - `MEMORY.md` maintenance alongside `LOG.md`
- Aegis logging was upgraded with a compact cycle-summary mode:
  - new override: `AEGIS_LOG_MODE`
  - supported values:
    - `events`
    - `changes`
    - `cycle`
- Current development configuration sets both active pairs to:
  - `AEGIS_LOG_MODE: "cycle"`
  - `ENABLE_DEBUG_LOGS: false`
- Important Gunbot runtime discovery:
  - custom strategy `console.log` output is not written into the pair-specific files such as:
    - `gunbot_logs/binance.USDT-BTC.log`
    - `gunbot_logs/binance.USDT-PAXG.log`
  - Aegis custom log lines are written into:
    - `gunbot_logs/gunbot_logs.txt`
- Verified live Aegis log output exists there for both pairs with lines such as:
  - `[STATE] tf=15m ... regime=... score=... skip=...`

### 2026-03-27 Gunbot notional fix

- Corrected a Gunbot environment mismatch in Aegis:
  - `MIN_VOLUME_TO_BUY` and `MIN_VOLUME_TO_SELL` must be treated as base-currency order value thresholds in Aegis checks
  - market order method amounts still remain quote-asset amounts for `buyMarket(...)` and `sellMarket(...)`
- Fixed affected runtime paths:
  - bag detection
  - buy minimum threshold validation
  - sell minimum threshold validation
- This prevents false sell blocking on pairs such as `USDT-BTC` and `USDT-PAXG`

### 2026-03-27 pair configuration decision

- Both live development pairs are now explicitly configured for Aegis:
  - `USDT-BTC`
  - `USDT-PAXG`
- Both remain on `15m` execution candles for now
- Decision rationale:
  - acceptable for development because Aegis already uses a `60m` higher-timeframe regime gate internally
  - keeping both on `15m` improves feedback speed while tuning
  - reassess later for production, with `PAXG` the first candidate to move to `30m` if needed
- Added explicit pair overrides in `config.js` for both pairs:
  - `MIN_VOLUME_TO_BUY: 10`
  - `MIN_VOLUME_TO_SELL: 10`
  - `TRADING_LIMIT: 100`
  - `AEGIS_TRADE_LIMIT: 100`
  - pair-specific `AEGIS_RISK_PROFILE`
  - charts / notifications enabled

### 2026-03-27 Aegis 1.1.0 explainability and chart refinement

- Created a fresh backup before this refinement pass:
  - `/home/xaos/gunbot/backups/aegis-20260327-200555/`
  - additional `config.js` backup copy:
    - `/home/xaos/gunbot/backups/aegis-20260327-200555/config.js.pre-1.1.0-tuning`
- Upgraded `Aegis.js` from `1.0.0` to `1.1.0`
- Refined frame-analysis diagnostics with granular reason codes:
  - value reasons now distinguish:
    - `pullback-too-shallow`
    - `pullback-too-deep`
    - `above-value-band`
    - `below-value-band`
  - reclaim reasons now distinguish:
    - `below-reclaim-trigger`
    - `weak-close-location`
    - `weak-lower-wick`
    - `bearish-signal-close`
    - `no-close-improvement`
  - momentum reasons now distinguish:
    - `rsi-unavailable`
    - `rsi-below-floor`
    - `rsi-overheated`
    - `rsi-delta-weak`
  - liquidity reasons now distinguish:
    - `market-price-missing`
    - `spread-too-wide`
    - `volume-too-light`
    - `signal-range-too-wide`
- Added an explicit setup-stage classifier for live telemetry and logs:
  - examples:
    - `regime-blocked`
    - `value-pullback-watch`
    - `value-breakdown-watch`
    - `reclaim-watch`
    - `momentum-reset`
    - `liquidity-screen`
    - `entry-ready`
    - `bag-manage`
    - `runner-manage`
- Improved cycle-summary logging:
  - state lines now include:
    - `stage=...`
    - per-component reason labels instead of just `0/1`
  - this makes live log reading materially more useful during tuning
- Improved chart productization:
  - chart targets now render earlier when regime is on, not only when score is already high
  - preview targets now include:
    - buy watch / buy ready
    - reclaim line
    - TP1 preview
    - stop
  - bag charts still render TP1 / invalidation / DCA / trail
  - added a second risk-zone rectangle below the value zone when the setup is active enough to matter
- Improved sidebar telemetry:
  - added `Stage`
  - added `Reclaim`
  - `Skip` now renders as a real blocker state instead of neutral decoration

### 2026-03-27 live 1.1.0 findings

- Verified live Gunbot output picked up `Aegis Regime Reclaim 1.1.0` in:
  - `gunbot_logs/gunbot_logs.txt`
- New live logs now show materially better diagnostics, for example:
  - `USDT-PAXG`:
    - `phase=armed`
    - `stage=reclaim-watch`
    - `score=3/5`
    - `skip=weak-close-location`
    - `value=ok`
    - `reclaim=weak-close-location`
    - `momentum=rsi-delta-weak`
    - `liquidity=ok`
  - `USDT-BTC`:
    - `stage=regime-blocked`
    - `skip=regime-fail`
    - `reclaim=below-reclaim-trigger`
    - `momentum=rsi-below-floor`
    - `liquidity=volume-too-light`
- Important environment finding:
  - Aegis is currently attached to more than just `USDT-BTC` and `USDT-PAXG`
  - live logs also showed:
    - `USDT-ETH`
    - `USDT-PENDLE`
    - `USDT-BNB`
    - `USDT-SOL`

### 2026-03-27 config hygiene for development logs

- Updated `config.js` after backing it up so development logging stays readable:
  - `USDT-BTC`
    - `AEGIS_RISK_PROFILE: "balanced"`
    - `AEGIS_LOG_MODE: "cycle"`
  - `USDT-PAXG`
    - `AEGIS_RISK_PROFILE: "conservative"`
    - `AEGIS_LOG_MODE: "cycle"`
  - `USDT-ETH`
    - `AEGIS_LOG_MODE: "changes"`
  - `USDT-PENDLE`
    - `AEGIS_LOG_MODE: "changes"`
  - `USDT-BNB`
    - `AEGIS_LOG_MODE: "changes"`
  - `USDT-SOL`
    - `AEGIS_LOG_MODE: "changes"`
- `config.js` JSON parse check passed after these edits

### Current test status after 1.1.0

- `node --check /home/xaos/gunbot/customStrategies/Aegis.js` passed
- `config.js` JSON parse check passed
- Live Gunbot log output confirms `1.1.0` is executing
- Full GUI verification of the new chart visuals has not yet been performed in this session
- Pair state JSON files did not expose the sidebar extras directly, so live GUI sidebar verification remains pending

### Remaining / next iteration after 1.1.0

1. Inspect the actual Gunbot chart for `USDT-PAXG` while it remains in `reclaim-watch`
2. Confirm the new risk-zone rectangle and reclaim line look clean rather than cluttered
3. Decide whether setup-armed should require momentum in addition to value plus liquidity
4. Consider a dedicated `entry-watch` / `near-ready` notification only if it adds value without spam
5. Add a compact summary of stale-skip and blocker frequencies if simulator evidence justifies it

### 2026-03-27 expanded live deployment review and audit follow-up

- Reviewed current live Aegis deployment from `config.js`
- Aegis is now active on six Binance spot pairs:
  - `USDT-BTC`
  - `USDT-PAXG`
  - `USDT-ETH`
  - `USDT-PENDLE`
  - `USDT-BNB`
  - `USDT-SOL`
- Current pair profiles / log modes:
  - `USDT-BTC`
    - `balanced`
    - `cycle`
  - `USDT-PAXG`
    - `conservative`
    - `cycle`
  - `USDT-ETH`
    - `conservative`
    - `changes`
  - `USDT-PENDLE`
    - `conservative`
    - `changes`
  - `USDT-BNB`
    - `conservative`
    - `changes`
  - `USDT-SOL`
    - `conservative`
    - `changes`
- Reviewed live Aegis state lines in `gunbot_logs/gunbot_logs.txt`
- Current latest live snapshot:
  - `USDT-PAXG`
    - regime `ON 4/4`
    - stage `reclaim-watch`
    - score `3/5`
    - skip `weak-lower-wick`
    - momentum `ok`
    - liquidity blocked by `volume-too-light`
  - `USDT-BTC`
    - regime `OFF 0/4`
    - stage `regime-blocked`
    - score `2/5`
    - reclaim `weak-lower-wick`
    - momentum `ok`
    - liquidity blocked by `volume-too-light`
  - `USDT-ETH`
    - regime `OFF 0/4`
    - stage `regime-blocked`
    - score `2/5`
    - momentum `ok`
    - liquidity blocked by `volume-too-light`
  - `USDT-PENDLE`
    - regime `OFF 0/4`
    - stage `regime-blocked`
    - score `2/5`
    - liquidity blocked by `volume-too-light`
  - `USDT-BNB`
    - regime `OFF 0/4`
    - stage `regime-blocked`
    - score `2/5`
    - liquidity blocked by `volume-too-light`
  - `USDT-SOL`
    - regime `OFF 0/4`
    - stage `regime-blocked`
    - score `1/5`
    - reclaim `below-reclaim-trigger`
    - momentum `rsi-below-floor`
- Event / error status from live logs:
  - no `ERROR` or `FATAL` lines observed for Aegis
  - one meaningful `INFO` event observed:
    - `USDT-PAXG` setup armed
  - no entries, DCA events, TP1 events, runner exits, or invalidation exits observed yet in the reviewed log window
- Performance interpretation:
  - too early to judge trading performance because no completed trades were observed
  - current live evidence supports that Aegis is filtering aggressively rather than overtrading
  - `USDT-PAXG` is the only pair currently close enough to the thesis to deserve primary attention

### 2026-03-27 Gemini audit review

- Reviewed `AUDITgemini.md`
- Audit assessment is directionally correct:
  - it correctly recognized the strategy architecture, defensive posture, runtime compatibility work, and telemetry quality
- Two audit suggestions were evaluated:
  - chart overlap cleanup:
    - valid but lower priority until we visually confirm chart clutter in the actual GUI
  - notification-key growth:
    - valid and worth fixing immediately because it is a pure maintenance improvement with no strategy-side behavioral risk

### 2026-03-27 Aegis 1.1.1 maintenance fix

- Created fresh backups before editing:
  - `/home/xaos/gunbot/backups/aegis-20260327-202039/`
- Upgraded `Aegis.js` from `1.1.0` to `1.1.1`
- Implemented bounded notification dedupe storage:
  - added notification retention settings in internal telemetry config
  - added `lastNotificationPruneAt` to persistent state
  - added `pruneNotificationKeys(...)`
  - prune runs from main execution flow and removes:
    - invalid timestamps
    - stale notification keys
    - excess keys beyond a fixed cap
- This addresses the main long-run persistence hygiene concern raised by the Gemini audit without changing trade logic

### Current test status after 1.1.1

- `node --check /home/xaos/gunbot/customStrategies/Aegis.js` passed
- Live `1.1.1` execution has not yet been confirmed in Gunbot logs inside this session
- No simulator run was performed in this follow-up pass

### Remaining / next iteration after 1.1.1

1. Confirm Gunbot reloads and starts emitting `Aegis Regime Reclaim 1.1.1` lines
2. Check whether `USDT-PAXG` can convert `reclaim-watch` into a real entry or keeps failing on liquidity / wick quality
3. Decide whether `minRelativeVolume` is too strict for defensive metals like `PAXG`
4. Review actual chart visuals for overlap before changing chart-target logic further

### 2026-03-27 Aegis monitor automation

- User requested automation around the current live review items:
  1. watch `USDT-PAXG` reclaim behavior
  2. keep `USDT-BTC` as the regime-control pair
  3. surface when `PAXG` repeatedly reaches near-ready conditions without entering
- Created a non-runtime operations helper:
  - `ops/aegis-monitor.js`
- Purpose:
  - parse Aegis lines from `gunbot_logs/gunbot_logs.txt`
  - maintain lightweight monitor state outside the strategy runtime
  - summarize current live pair states
  - track repeated `PAXG` near-ready observations
  - preserve `BTC` regime-control visibility
  - emit simple tuning alerts without touching Gunbot execution logic
- Generated helper outputs:
  - `ops/aegis-monitor-state.json`
  - `ops/aegis-monitor-report.txt`
  - `ops/aegis-monitor-history.log`
  - `ops/aegis-monitor-cron.log`
- Cron setup:
  - backed up current user crontab first:
    - `/home/xaos/gunbot/backups/aegis-20260327-202039/crontab.before`
  - existing crontab status before install:
    - no user crontab existed
  - installed job:
    - `*/5 * * * * /usr/bin/node /home/xaos/gunbot/customStrategies/ops/aegis-monitor.js >> /home/xaos/gunbot/customStrategies/ops/aegis-monitor-cron.log 2>&1`

### 2026-03-27 first monitor output

- Manual run of `ops/aegis-monitor.js` succeeded
- Current first-pass automated read:
  - `USDT-PAXG`
    - still `reclaim-watch`
    - still `3/5`
    - still blocked by:
      - reclaim quality:
        - mostly `weak-lower-wick`
      - liquidity:
        - `volume-too-light`
  - `USDT-BTC`
    - still functioning as the regime-control pair
    - current state remains `regime-blocked`
- First automated recommendation:
  - `PAXG` has accumulated repeated near-ready observations in an allowed regime without entry
  - before changing reclaim logic, pair-specific liquidity tolerance should be tested in the simulator
- Important interpretation note:
  - monitor counts are based on Aegis log observations, not completed candles or actual order attempts

### Current test status after automation pass

- `ops/aegis-monitor.js` executed successfully under Node
- cron entry installed successfully
- helper report/state/history files are being written in `ops/`
- no runtime strategy code was changed in this automation pass

### Remaining / next iteration after automation pass

1. Let the cron monitor accumulate more PAXG observations
2. Re-read `ops/aegis-monitor-report.txt` after a few hours
3. If PAXG remains near-ready with liquidity as the persistent blocker, test pair-specific `MIN_RELATIVE_VOLUME` relaxation in the simulator only
4. Keep BTC unchanged as the regime-control reference unless its higher-timeframe gate materially improves

### 2026-03-27 full audit and technical README

- Created session backups before editing tracked docs:
  - `/home/xaos/gunbot/backups/aegis-20260327-203314/`
- Wrote a full current-state audit:
  - `AUDIT.md`
- Wrote a technical strategy README:
  - `README.md`

### 2026-03-27 audit outcome

- Audited scope:
  - `Aegis.js`
  - `ops/aegis-monitor.js`
  - current Aegis deployment in `config.js`
  - current live Aegis output in `gunbot_logs/gunbot_logs.txt`
  - current monitor output in `ops/aegis-monitor-report.txt`
- Syntax checks passed:
  - `node --check /home/xaos/gunbot/customStrategies/Aegis.js`
  - `node --check /home/xaos/gunbot/customStrategies/ops/aegis-monitor.js`
- High-level audit verdict:
  - no critical or high-severity runtime defects found
  - code quality and observability are strong
  - main gap is validation depth and pair-specific tuning, not implementation quality

### 2026-03-27 main audit findings

1. Live rollout scope exceeds validated tuning scope
   - Aegis is live on six pairs while primary validation still centers on BTC and PAXG
2. PAXG appears over-filtered for the current `15m` conservative profile
   - repeated near-ready observations keep failing on reclaim quality and `volume-too-light`
3. The ops monitor is useful but observation-based
   - its counters represent parsed log samples, not unique candles or actual entry attempts

### 2026-03-27 README coverage

- README now documents:
  - strategy thesis
  - runtime model
  - regime / value / reclaim / momentum / liquidity layers
  - scoring, DCA, exits, persistence, charts, sidebar, notifications
  - override groups
  - live deployment assumptions
  - ops monitor usage
  - logging location
  - installation and testing order

### Current test status after audit/docs pass

- `Aegis.js` syntax check passed
- `ops/aegis-monitor.js` syntax check passed
- `Aegis Regime Reclaim 1.1.1` is still active in live logs
- No new strategy runtime code changes were made in this pass

### Remaining / next iteration after audit/docs pass

1. Keep the monitor running and collect more PAXG evidence
2. Simulator-test a PAXG-only liquidity relaxation before changing reclaim rules
3. Treat the extra live pairs as observation scope until pair-specific validation catches up

### 2026-03-27 expanded pair audit and config tuning

- User enabled additional Aegis pairs and requested a fresh review of:
  - live Aegis logs
  - `config.js`
  - Gunbot pair state files in `/home/xaos/gunbot/json/`
- Created session backups before editing:
  - `/home/xaos/gunbot/backups/aegis-20260327-212032/`
    - `config.js`
    - `LOG.md`
    - `MEMORY.md`

### 2026-03-27 new runtime findings from config, logs, and json state

- Confirmed current enabled Aegis live pairs in `config.js`:
  - `USDT-PAXG`
  - `USDT-BTC`
  - `USDT-ETH`
  - `USDT-PENDLE`
  - `USDT-BNB`
  - `USDT-SOL`
- Confirmed no pair-specific Aegis overrides were set before this pass beyond risk profile / log mode / period.
- Verified Gunbot pair state persistence format more precisely:
  - Aegis runtime state is persisted in the raw pair state json, not under a nested `pairLedger` object.
  - Important live fields currently persist at top level such as:
    - `whatstrat`
    - `customStratStore.aegis`
    - `customBuyTarget`
    - `customSellTarget`
    - `customStopTarget`
    - `sidebarExtras`
    - `notifications`
- Verified Aegis sidebar labels are present across the enabled pairs.
- Verified Aegis chart targets are currently active only on `USDT-PAXG`, which matches its regime-on / setup-watch state.

### 2026-03-27 live read before config changes

- `USDT-PAXG`
  - only currently enabled pair with higher-timeframe regime passing
  - recent sample from the last ~1000 Aegis state lines:
    - `regimeOn`: `464 / 464`
    - `score >= 3`: `59`
    - top stage states:
      - `value-pullback-watch`
      - `reclaim-watch`
    - dominant blockers:
      - `above-value-band`
      - `weak-close-location`
      - `bearish-signal-close`
      - `weak-lower-wick`
    - persistent secondary blockers:
      - `rsi-delta-weak`
      - `volume-too-light`
- `USDT-BTC`
  - remains the clean regime-control pair
  - recent sample:
    - `regimeOn`: `0 / 424`
    - `score >= 3`: `0`
    - all reviewed states remain `regime-blocked`
- `USDT-ETH`, `USDT-PENDLE`, `USDT-BNB`, `USDT-SOL`
  - all currently remain regime-off in the reviewed window
  - `USDT-PENDLE` occasionally reached `score >= 3`, but still failed the regime gate

### 2026-03-27 config changes made

- Edited:
  - `/home/xaos/gunbot/config.js`
- Added pair-specific `USDT-PAXG` overrides only:
  - `MIN_RELATIVE_VOLUME: 0.5`
  - `RECLAIM_CLOSE_LOCATION: 0.55`
  - `MOMENTUM_MIN_RSI_DELTA: 0.2`
- Rationale:
  - PAXG is the only pair currently operating inside an allowed higher-timeframe regime.
  - The reviewed logs show repeated PAXG setup progress being blocked by:
    - light relative volume
    - close-location reclaim strictness
    - weak incremental RSI recovery
  - The value-zone gate was intentionally not loosened in this pass.
  - The other newly enabled pairs were intentionally left unchanged because they are still mostly failing the regime filter, so tuning them now would not be evidence-based.

### 2026-03-27 validation after config changes

- `config.js` JSON parse passed:
  - `node` parse check succeeded
- Verified Gunbot picked up the new `USDT-PAXG` overrides in live pair state without a restart:
  - `MIN_RELATIVE_VOLUME: 0.5`
  - `RECLAIM_CLOSE_LOCATION: 0.55`
  - `MOMENTUM_MIN_RSI_DELTA: 0.2`
- Immediate post-change live read:
  - `USDT-PAXG` remains flat
  - latest reviewed state is still:
    - `stage=reclaim-watch`
    - `score=2/5`
    - `skip=weak-close-location`
    - `liquidity=volume-too-light`
  - interpretation:
    - the config change was applied successfully
    - it did not create an unsafe forced entry condition
- No strategy runtime code was changed in this pass.
- No Aegis syntax changes were required in this pass.

### Remaining / next iteration after expanded pair audit

1. Keep watching `gunbot_logs/gunbot_logs.txt` and `/home/xaos/gunbot/json/binance-USDT-PAXG-state.json` to see whether the new PAXG thresholds improve progression from:
   - `value-pullback-watch`
   - to `reclaim-watch`
   - to `setup armed`
2. If PAXG still stalls without progressing beyond reclaim quality, test either:
   - a `30m` PAXG profile
   - or a slightly wider PAXG value band
   in simulator before making more live config changes.
3. Keep BTC unchanged as the regime-control reference until its higher-timeframe regime meaningfully improves.

### 2026-03-28 overnight live review and operator docs

- User requested:
  - analysis of the overnight collected Aegis data
  - clear operator documentation for the strategy settings
  - GitHub push guidance for `https://github.com/NukeThemAII/Aegis`
- Created session backups before docs work:
  - `/home/xaos/gunbot/backups/aegis-20260328-060151/`
    - `README.md`
    - `LOG.md`
    - `MEMORY.md`

### 2026-03-28 overnight monitor findings

- Reviewed:
  - `ops/aegis-monitor-report.txt`
  - `ops/aegis-monitor-history.log`
  - `ops/aegis-monitor-state.json`
  - live pair state jsons in `/home/xaos/gunbot/json/`
- Latest monitor snapshot at `2026-03-28T04:55:01.589Z`:
  - no monitor-reported runtime errors
  - no completed Aegis trade lifecycle observed
  - `USDT-PAXG` remained the only consistently regime-on pair
  - `USDT-BTC` remained fully regime-blocked
- Focused review from the PAXG tuning window forward (`2026-03-27T22:20Z` to `2026-03-28T05:00Z`):
  - monitor samples reviewed: `81`
  - total new state lines processed in those samples: `11807`
  - `USDT-PAXG`
    - `score >= 3`: `13` samples
    - `score >= 4`: `1` sample
    - stage:
      - `reclaim-watch`: `79`
      - `momentum-reset`: `2`
    - dominant blockers after tuning:
      - `below-reclaim-trigger`: `40`
      - `weak-close-location`: `27`
      - `weak-lower-wick`: `10`
    - liquidity result:
      - `volume-too-light`: `80`
      - `ok`: `1`
  - `USDT-BTC`
    - remained `regime-blocked` across the reviewed overnight window
    - only `4` samples reached score `2/5`
- Interpretation:
  - the PAXG pair-specific tuning did not create unsafe entries
  - PAXG still has a real setup flow, but reclaim confirmation and relative volume remain the main gating points
  - blocker mix shifted from mostly `weak-close-location` toward more `below-reclaim-trigger`, which suggests the reclaim threshold nudge changed behavior without solving the deeper setup quality issue

### 2026-03-28 live pair-state confirmation

- Confirmed `USDT-PAXG` still runs with:
  - `AEGIS_RISK_PROFILE=conservative`
  - `PERIOD=15`
  - `MIN_RELATIVE_VOLUME=0.5`
  - `RECLAIM_CLOSE_LOCATION=0.55`
  - `MOMENTUM_MIN_RSI_DELTA=0.2`
- Confirmed current PAXG regime metrics remain valid:
  - HTF regime still passes `4/4`
- Confirmed current PAXG live state remains flat:
  - latest skip reason:
    - `below-reclaim-trigger`
  - latest summary key shows:
    - `value-ok`
    - `below-reclaim-trigger`
    - `momentum-ok`
    - `volume-too-light`
- Confirmed no versioned non-`[STATE]` Aegis lines were found in the reviewed live log window, so no verified entry / DCA / exit action was seen.

### 2026-03-28 docs and repo work

- Added a dedicated operator reference:
  - `GUIDE.md`
- Updated:
  - `README.md`
- Documentation decision:
  - keep `README.md` as the strategy overview
  - keep `GUIDE.md` as the operator and config reference
- `GUIDE.md` now documents:
  - required Gunbot custom-strategy plumbing
  - sizing semantics for:
    - `MIN_VOLUME_TO_BUY`
    - `MIN_VOLUME_TO_SELL`
    - `TRADING_LIMIT`
    - `AEGIS_TRADE_LIMIT`
  - all currently parsed Aegis override groups
  - exact risk profile behavior
  - log mode behavior
  - which legacy Gunbot knobs Aegis ignores
  - recommended starter presets

### 2026-03-28 GitHub findings

- Confirmed remote GitHub repository exists:
  - `NukeThemAII/Aegis`
  - default branch:
    - `main`
- Confirmed current remote `README.md` on GitHub is older and more presentation-oriented than the current local technical docs.
- Confirmed current working directory `/home/xaos/gunbot/customStrategies` is not a git repository.
- Safe publishing implication:
  - do not run blind `git push` from the current working directory
  - safest path is:
    - clone the remote repo
    - copy the current local files into that clone
    - commit
    - push

### Current test status after overnight review/docs pass

- No strategy runtime code was changed in this pass.
- No syntax changes to `Aegis.js` were required in this pass.
- Documentation files changed:
  - `GUIDE.md`
  - `README.md`
- The overnight evidence still supports:
  - simulator-first tuning before any broader live loosening

### Remaining / next iteration after overnight review/docs pass

1. Decide whether PAXG should next be tested on:
   - `30m`
   - or a slightly wider value band
2. Keep BTC unchanged as the regime-control pair.
3. Treat the other live pairs as observation scope until they produce regime-on evidence.
4. Publish the current docs and strategy files into the GitHub repo using a clone-first workflow.
