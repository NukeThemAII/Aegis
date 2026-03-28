# Aegis

`Aegis.js` is a premium single-file Gunbot custom strategy for long-only spot trading.

Current strategy variant:
- `Aegis Regime Reclaim`

Runtime artifact:
- `customStrategies/Aegis.js`

Runtime language:
- plain JavaScript

Runtime design goal:
- one deployable Gunbot strategy file
- no external server dependency
- conservative syntax
- product-grade telemetry and charting

Operator configuration reference:
- [`GUIDE.md`](./GUIDE.md)

## What Aegis Is

Aegis is a regime-filtered pullback and reclaim strategy.

It is built to:
- avoid buying every dip
- enter only when broader context is acceptable
- prefer pullbacks into value over vertical chasing
- require evidence of response before entering
- scale only when the thesis still holds
- exit in readable layers

It is not built to:
- scalp every candle
- rely on a large indicator stack
- hide logic behind opaque weights
- depend on external infrastructure for version 1 runtime

## Runtime Model

Aegis runs entirely inside Gunbot and uses Gunbot-native state and execution surfaces.

Primary runtime dependencies:
- `gb.data`
- `gb.method`
- `gb.data.pairLedger.customStratStore`
- `gb.data.pairLedger.whatstrat`
- `gb.data.pairLedger.sidebarExtras`
- `gb.data.pairLedger.notifications`
- chart target fields and custom chart arrays

Compatibility assumptions:
- conservative Node.js environment
- Gunbot may execute custom strategies through direct eval
- `module.exports` may not exist at runtime

Aegis explicitly supports:
- CommonJS export when available
- self-invocation when Gunbot evaluates the file body directly

## Strategy Logic

### 1. Higher-Timeframe Regime Gate

Aegis blocks new longs unless the higher timeframe passes a simple regime check.

Default components:
- close above higher-timeframe slow EMA baseline
- fast EMA above slow EMA
- fast EMA slope above minimum threshold
- fast/slow EMA separation above minimum threshold

Default higher timeframe:
- `60m`

Purpose:
- stop blind dip buying in weak context
- keep the entry engine tied to an allowed backdrop

### 2. Value-Zone Pullback

Aegis looks for pullbacks into a local EMA band instead of chasing extension.

Default local value model:
- fast EMA: `9`
- slow EMA: `21`
- band buffer: `0.25%`
- impulse lookback: `18`

Value passes only when:
- price is in the band or has recently touched it
- pullback depth is not too shallow
- pullback depth is not too deep

### 3. Reclaim / Rejection Confirmation

Value alone is not enough.

Aegis requires response evidence such as:
- close back above fast EMA reclaim trigger
- acceptable close location in the signal candle
- sufficient lower wick quality
- bullish confirmation if enabled
- close improvement versus the previous close

### 4. Momentum Sanity

Aegis uses a local RSI recovery check to avoid buying a reclaim that still lacks internal recovery.

Default RSI logic:
- RSI length: `14`
- floor: `41`
- ceiling: `69`
- minimum RSI delta: `0.5`

### 5. Liquidity Sanity

Aegis applies a lightweight liquidity filter.

Default checks:
- max spread percentage
- minimum relative volume
- max signal range percentage

This is intentionally simple and Gunbot-native.

## Entry Scoring

The composite score is deterministic and transparent.

Score components:
- regime pass
- value zone pass
- reclaim pass
- momentum pass
- liquidity pass

Default minimum entry score:
- `5/5`

Composite behavior:
- the regime contributes one point
- current-frame logic contributes four points

This means the default behavior is deliberately strict.

## DCA Logic

DCA is allowed only when the original thesis still holds.

Default DCA guardrails:
- regime must still pass
- liquidity must still pass
- value must still be valid
- reclaim can be required
- minimum distance from last fill must be reached
- max DCA count must not be exceeded
- price must remain above invalidation
- depth versus break-even must remain within limit

Default DCA profile:
- balanced: max `2`
- conservative: max `1`

## Exit Architecture

Aegis exits are layered.

Default structure:
- `TP1` partial profit
- runner activation after TP1
- ATR-influenced runner trail
- invalidation exit
- stale-trade timeout exit

This gives the strategy a clear transition:
- thesis entry
- partial realization
- managed residual position

## Persistence Model

Aegis uses `customStratStore` only for lightweight supplemental state.

Current persisted fields include:
- phase
- DCA count
- trail peak
- trail stop
- last action timestamps
- notification dedupe keys
- higher-timeframe regime cache
- setup / skip continuity fields

It does not use persistence as the sole truth for:
- whether a bag exists
- live position state
- live balances

## Visualization

Charting is part of the product, not an afterthought.

Aegis uses:
- `customBuyTarget`
- `customSellTarget`
- `customStopTarget`
- `customTrailingTarget`
- `customDcaTarget`
- `customChartTargets`
- `customChartShapes`

Current chart contract includes:
- buy watch or buy ready line
- reclaim line
- TP1 preview
- invalidation line
- DCA line while applicable
- runner trail line while applicable
- value-zone rectangle
- risk-zone rectangle when appropriate

## Sidebar Telemetry

Every cycle publishes compact telemetry through `sidebarExtras`.

Current sidebar fields include:
- version
- regime state
- score
- stage
- setup state
- phase
- DCA count
- trail
- stop
- spread
- reclaim
- RSI
- PnL
- age
- skip reason

## Notifications

Aegis only notifies on meaningful state transitions.

Current notification classes:
- setup armed
- regime enabled
- regime disabled
- entry executed
- DCA executed
- TP1 executed
- runner exit
- invalidation exit
- stale exit

Notification dedupe is bounded and pruned in runtime version `1.1.1`.

## Override Model

For the full operator-facing setting reference, profile behavior, sizing semantics, and log-mode guidance, use [`GUIDE.md`](./GUIDE.md).

Aegis reads pair overrides from `gb.data.pairLedger.whatstrat`.

Representative override groups:

Capital and runtime:
- `AEGIS_ENABLED`
- `AEGIS_RISK_PROFILE`
- `AEGIS_TRADE_LIMIT`
- `AEGIS_REENTRY_COOLDOWN_MINUTES`

Regime:
- `REGIME_HTF_PERIOD`
- `REGIME_EMA_FAST`
- `REGIME_EMA_SLOW`
- `REGIME_MIN_SLOPE_PCT`
- `REGIME_MIN_SEPARATION_PCT`

Value zone:
- `VALUE_EMA_FAST`
- `VALUE_EMA_SLOW`
- `VALUE_BAND_BUFFER_PCT`
- `VALUE_MIN_PULLBACK_PCT`
- `VALUE_MAX_PULLBACK_PCT`

Reclaim:
- `RECLAIM_WICK_RATIO`
- `RECLAIM_CLOSE_LOCATION`
- `RECLAIM_REQUIRE_BULLISH_CLOSE`

Momentum:
- `MOMENTUM_RSI_LENGTH`
- `MOMENTUM_RSI_FLOOR`
- `MOMENTUM_RSI_CEILING`
- `MOMENTUM_MIN_RSI_DELTA`

Liquidity:
- `MAX_SPREAD_PCT`
- `MIN_RELATIVE_VOLUME`
- `VOLUME_LOOKBACK`
- `MAX_SIGNAL_RANGE_PCT`

DCA:
- `MAX_DCA_COUNT`
- `MIN_DCA_DISTANCE_PCT`
- `DCA_SIZE_MULTIPLIER`
- `MAX_DCA_DEPTH_PCT`
- `DCA_REQUIRE_RECLAIM`

Exits:
- `TP1_PCT`
- `TP1_SELL_RATIO`
- `RUNNER_TRAIL_MIN_PCT`
- `RUNNER_TRAIL_MAX_PCT`
- `RUNNER_TRAIL_ATR_MULT`
- `INVALIDATION_ATR_MULT`
- `INVALIDATION_LOOKBACK`
- `INVALIDATION_BUFFER_PCT`
- `STALE_EXIT_MINUTES`

Telemetry:
- `ENABLE_CHARTS`
- `ENABLE_CHART_SHAPES`
- `ENABLE_NOTIFICATIONS`
- `ENABLE_DEBUG_LOGS`
- `AEGIS_LOG_MODE`

## Current Development Deployment

Current active live deployment is on Binance spot pairs:
- `USDT-BTC`
- `USDT-PAXG`
- `USDT-ETH`
- `USDT-PENDLE`
- `USDT-BNB`
- `USDT-SOL`

Current primary development focus:
- `USDT-BTC`
  - regime-control pair
  - balanced profile
- `USDT-PAXG`
  - defensive validation pair
  - conservative profile

Current timeframe:
- `15m`

Higher-timeframe regime input:
- `60m`

## Current Live Interpretation

At the current audited state:
- BTC is mostly serving as the control pair for regime rejection
- PAXG is the closest recurring candidate to entry
- PAXG repeatedly reaches near-ready conditions but is currently blocked by reclaim quality and light liquidity

This does not indicate a runtime defect.
It indicates that pair-specific validation is the next engineering task.

## Logging

In this Gunbot build, Aegis custom log output is written to:
- `gunbot_logs/gunbot_logs.txt`

Do not assume Aegis strategy logs appear in pair-specific Gunbot log files.

Current Aegis log types:
- `STATE`
- `INFO`
- `WARN`
- `ERROR`
- `FATAL`

`AEGIS_LOG_MODE` options:
- `events`
- `changes`
- `cycle`

## Ops Monitor

The runtime strategy remains one file.

An optional non-runtime ops helper is available for cron-based live observation:
- `ops/aegis-monitor.js`

It writes:
- `ops/aegis-monitor-state.json`
- `ops/aegis-monitor-report.txt`
- `ops/aegis-monitor-history.log`
- `ops/aegis-monitor-cron.log`

Current cron install:
- every 5 minutes

Purpose:
- summarize the current live state of all Aegis pairs
- keep PAXG and BTC in focus
- surface repeated near-ready observations

Important limitation:
- monitor counts are based on parsed log observations
- they are not equivalent to unique candles, unique setups, or actual order attempts

## Installation

1. Place `Aegis.js` in Gunbot `customStrategies/`.
2. Set pair strategy to `custom`.
3. Set:
   - `BUY_METHOD: "custom"`
   - `SELL_METHOD: "custom"`
   - `STRAT_FILENAME: "Aegis.js"`
4. Apply pair overrides as needed.
5. Validate in simulator before broad live use.

## Testing Order

Recommended order:
- syntax check
- Gunbot simulator
- one-pair controlled validation
- multi-regime validation
- chart sanity check
- notification sanity check
- only then wider live deployment

## Known Assumptions

- Aegis assumes Gunbot can provide enough local candles for local indicator calculation
- Aegis assumes `getCandles(...)` is available for higher-timeframe regime data
- if higher-timeframe fetch fails and no cache exists, new entries are blocked
- Aegis is long-only spot logic

## Current Engineering Priority

The next meaningful improvement is not more indicators.

The next meaningful improvement is:
- pair-specific tuning discipline
- especially for `USDT-PAXG`
- with simulator evidence before relaxing defaults
