# Aegis Operator Guide

This guide explains how to configure `Aegis.js` in Gunbot.

It is intentionally focused on what the runtime actually reads today in version `1.3.1`.

Use this document for:
- pair setup
- sizing and order budget configuration
- risk profile selection
- override tuning
- log mode selection

Use `README.md` for the higher-level strategy overview.

## Current Simulator Matrix

The current development rollout is intentionally split by pair:
- `USDT-BTC`: `conservative` Aegis control pair on `15m`
- `USDT-ETH`: `aggressive` Aegis conversion test on `15m`
- `USDT-PAXG`: `balanced` Aegis reclaim test on `15m` with looser pair-level reclaim and liquidity thresholds

This is deliberate. It keeps one defensive control pair while still forcing Aegis to prove that balanced and aggressive profiles can arm and convert setups in simulator mode.

## Scope

Aegis is a Gunbot custom strategy.

That means your pair config contains three different kinds of settings:
- Gunbot custom-strategy plumbing that must be correct for Aegis to run
- Gunbot pair settings that Aegis reads and uses
- legacy Gunbot settings that may still exist in your config but are ignored by Aegis

This guide keeps those separate.

## Minimum Pair Setup

For a pair to run Aegis correctly, these fields should be set:

```json
{
  "strategy": "custom",
  "override": {
    "STRAT_FILENAME": "Aegis.js",
    "BUY_METHOD": "custom",
    "SELL_METHOD": "custom",
    "IS_MARGIN_STRAT": false
  }
}
```

Recommended for current Aegis use:
- spot only
- no margin
- liquid Binance pairs
- start in simulator before live

## Units And Sizing

This is the most important section operationally.

For pairs like `USDT-BTC` or `USDT-PAXG`, Aegis treats:
- `baseBalance` as the funding currency balance
- `quoteBalance` as the asset balance
- `AEGIS_TRADE_LIMIT` as funding-currency budget per entry
- `TRADING_LIMIT` as optional pair-level headroom when you want more total room for DCA or simulator stress tests
- `MIN_VOLUME_TO_BUY` and `MIN_VOLUME_TO_SELL` as minimum order notional in the funding currency

In plain terms on `USDT-*` pairs:
- if `AEGIS_TRADE_LIMIT` is `100`, Aegis tries to deploy about `100 USDT` per new entry
- it converts that funding budget into asset quantity internally before calling `buyMarket(...)`
- if `TRADING_LIMIT` is `400` while `AEGIS_TRADE_LIMIT` is `100`, Aegis still buys about `100 USDT` per entry, but the pair config keeps enough total room for multiple adds in simulator mode
- if `MIN_VOLUME_TO_BUY` is `15`, Aegis will skip buys smaller than about `15 USDT` notional
- if `MIN_VOLUME_TO_SELL` is `15`, Aegis will skip sells smaller than about `15 USDT` notional unless selling the full bag clears the threshold

Operational meaning:
- `AEGIS_TRADE_LIMIT` controls how much capital Aegis wants to use
- `TRADING_LIMIT` can be left above `AEGIS_TRADE_LIMIT` when you want extra pair-level room for DCA or simulator stress testing
- `MIN_VOLUME_TO_BUY` and `MIN_VOLUME_TO_SELL` are exchange-style minimum notional guards
- they are not the same thing

## Risk Profiles

Aegis supports three profile values through `AEGIS_RISK_PROFILE`:
- `conservative`
- `balanced`
- `aggressive`

`balanced` is the base profile. The other two modify the defaults below it.

### Profile Summary

| Profile | Intent | Behavior |
| --- | --- | --- |
| `conservative` | defensive live deployment | tighter pullback window, fewer DCAs, faster partial profit, shorter stale timeout |
| `balanced` | default development baseline | base values from `AEGIS_BASE_CONFIG` |
| `aggressive` | looser execution profile | lower score threshold, more DCAs, looser reclaim and liquidity requirements |

### Exact Profile Effects

#### `balanced`

This is the unmodified base configuration:
- reentry cooldown: `90m`
- max pullback: `4.5%`
- min relative volume: `0.65`
- DCA max count: `2`
- DCA min distance: `1.75%`
- TP1: `1.6%`
- runner trail min/max: `0.90% / 2.40%`
- stale timeout: `720m`
- min entry score: `5`

#### `conservative`

Changes applied on top of balanced:
- reentry cooldown: `150m`
- value max pullback: `3.5%`
- max signal range: `2.4%`
- DCA max count: `1`
- DCA min distance: `2.2%`
- TP1: `1.3%`
- runner trail min/max: `0.80% / 1.80%`
- stale timeout: `540m`
- min entry score remains `5`

Use when:
- testing a slower pair
- using live capital more defensively
- you want fewer average-down actions

#### `aggressive`

Changes applied on top of balanced:
- reentry cooldown: `60m`
- reclaim close location: `0.52`
- RSI floor: `39`
- min relative volume: `0.50`
- DCA max count: `3`
- DCA min distance: `1.25%`
- TP1: `2.0%`
- runner trail min/max: `1.10% / 3.10%`
- stale timeout: `960m`
- min entry score: `4`

Use when:
- you understand the pair well
- you want more setup conversion
- you accept a looser trade filter

Do not start with `aggressive` on random pairs.

## Log Modes

`AEGIS_LOG_MODE` controls cycle-summary verbosity.

Allowed values:
- `events`
- `changes`
- `cycle`

### `events`

Only event logs are emitted.

Use when:
- you want the quietest live log stream
- you only care about actions and transitions

### `changes`

State summaries are emitted only when the composite cycle summary changes.

This is the best default for a wider live fleet.

Use when:
- you want visibility without log spam
- you are observing many pairs at once

### `cycle`

A state summary is emitted every cycle.

Use when:
- you are actively developing or tuning one or two pairs
- you want the fullest live visibility

### `ENABLE_DEBUG_LOGS`

This is separate from `AEGIS_LOG_MODE`.

`ENABLE_DEBUG_LOGS` controls extra debug lines.

Recommended:
- leave `ENABLE_DEBUG_LOGS` off unless you are actively debugging internals
- use `AEGIS_LOG_MODE=changes` or `cycle` first

## Settings Aegis Reads

Below are the settings that Aegis currently reads from `gb.data.pairLedger.whatstrat`.

### 1. Runtime And Capital

| Key | Default | Meaning |
| --- | --- | --- |
| `AEGIS_ENABLED` | `true` | Hard on/off switch for Aegis logic. |
| `AEGIS_RISK_PROFILE` | `balanced` | Selects `conservative`, `balanced`, or `aggressive`. |
| `AEGIS_TRADE_LIMIT` | `100` | Preferred per-entry funding budget. |
| `TRADE_LIMIT` | fallback alias | Alias for `AEGIS_TRADE_LIMIT`. |
| `TRADING_LIMIT` | fallback alias | Alias for `AEGIS_TRADE_LIMIT`. |
| `AEGIS_FUNDS_RESERVE` | `0` | Funding currency reserved from new buys. |
| `FUNDS_RESERVE` | fallback alias | Alias for `AEGIS_FUNDS_RESERVE`. |
| `AEGIS_ACTION_COOLDOWN_SECONDS` | `12` | Cooldown between direct actions. |
| `AEGIS_REENTRY_COOLDOWN_MINUTES` | profile driven | Cooldown after a full exit/reset. |
| `AEGIS_MIN_CANDLES` | `90` | Minimum local candles before Aegis will trade. |
| `AEGIS_USE_BUY_ENABLED` | `true` | If true, Aegis respects Gunbot `BUY_ENABLED`. |
| `AEGIS_USE_SELL_ENABLED` | `true` | If true, Aegis respects Gunbot `SELL_ENABLED`. |
| `BUY_ENABLED` | Gunbot value | Pair-level long permission gate if `AEGIS_USE_BUY_ENABLED` is true. |
| `SELL_ENABLED` | Gunbot value | Pair-level exit permission gate if `AEGIS_USE_SELL_ENABLED` is true. |
| `MIN_VOLUME_TO_BUY` | Gunbot value | Minimum buy notional check in funding currency. |
| `MIN_VOLUME_TO_SELL` | Gunbot value | Minimum sell notional check in funding currency. |

### 2. Regime

| Key | Default | Meaning |
| --- | --- | --- |
| `REGIME_HTF_PERIOD` | `60` | Higher-timeframe period in minutes for regime checks. |
| `PERIOD_MEDIUM` | fallback alias | Alias for `REGIME_HTF_PERIOD`. |
| `REGIME_CANDLE_COUNT` | `240` | Candle count requested for higher-timeframe analysis. |
| `REGIME_EMA_FAST` | `21` | HTF fast EMA. |
| `REGIME_EMA_SLOW` | `55` | HTF slow EMA. |
| `REGIME_SLOPE_LOOKBACK` | `3` | Lookback for HTF EMA slope check. |
| `REGIME_MIN_SLOPE_PCT` | `0.02` | Minimum HTF fast EMA slope percentage. |
| `REGIME_MIN_SEPARATION_PCT` | `0.10` | Minimum HTF fast/slow EMA separation percentage. |
| `REGIME_CACHE_SECONDS` | `600` | HTF fetch cache TTL. |

### 3. Value Zone

| Key | Default | Meaning |
| --- | --- | --- |
| `VALUE_EMA_FAST` | `9` | Fast EMA for local value band. |
| `VALUE_EMA_SLOW` | `21` | Slow EMA for local value band. |
| `VALUE_BAND_BUFFER_PCT` | `0.25` | Extra width around the local EMA band. |
| `VALUE_IMPULSE_LOOKBACK` | `18` | Lookback for recent impulse/pullback context. |
| `VALUE_MIN_PULLBACK_PCT` | `0.35` | Minimum pullback depth required. |
| `VALUE_MAX_PULLBACK_PCT` | profile driven | Maximum pullback depth allowed. |

### 4. Reclaim / Confirmation

| Key | Default | Meaning |
| --- | --- | --- |
| `RECLAIM_WICK_RATIO` | `0.35` | Minimum lower-wick quality for wick-based confirmation. |
| `RECLAIM_CLOSE_LOCATION` | `0.58` | Minimum candle close location within the signal range. |
| `RECLAIM_REQUIRE_BULLISH_CLOSE` | `true` | Require bullish candle body for confirmation. |
| `RECLAIM_ALLOW_TWO_BAR` | `true` | Allows a wick rejection candle plus follow-through candle to qualify as a reclaim. |

### 5. Momentum

| Key | Default | Meaning |
| --- | --- | --- |
| `MOMENTUM_RSI_LENGTH` | `14` | RSI length used by Aegis. |
| `RSI_LENGTH` | fallback alias | Alias for `MOMENTUM_RSI_LENGTH`. |
| `MOMENTUM_RSI_FLOOR` | `41` | Minimum RSI floor for recovery context. |
| `MOMENTUM_RSI_CEILING` | `69` | Upper RSI ceiling used to avoid late exhaustion. |
| `MOMENTUM_MIN_RSI_DELTA` | `0.5` | Minimum RSI improvement required from the prior reading. |

### 6. Liquidity

| Key | Default | Meaning |
| --- | --- | --- |
| `MAX_SPREAD_PCT` | `0.12` | Maximum spread percentage allowed. |
| `MIN_RELATIVE_VOLUME` | profile driven | Minimum projected-current-volume / average-completed-volume ratio. |
| `VOLUME_LOOKBACK` | `20` | Lookback for average-volume calculation. |
| `MAX_SIGNAL_RANGE_PCT` | profile driven | Maximum signal candle range percentage allowed. |
| `PROJECT_CURRENT_VOLUME` | `true` | If true, Aegis projects current-candle volume based on candle progress before comparing it with completed candles. |
| `PROJECTED_VOLUME_FLOOR` | `0.30` | Minimum candle-progress ratio used in the projection model. |

### 7. Risk / Entry

| Key | Default | Meaning |
| --- | --- | --- |
| `MIN_ENTRY_SCORE` | profile driven | Minimum composite entry score from `1` to `5`. |
| `AEGIS_CLOSE_ONLY_ENTRY` | `false` | If true, new entries are delayed until the live candle is near its close instead of being evaluated all candle long. |
| `AEGIS_CLOSE_ONLY_ENTRY_PROGRESS` | `0.92` | Candle progress threshold used when `AEGIS_CLOSE_ONLY_ENTRY=true`. `0.92` means the last 8% of the candle. |

### 8. DCA

| Key | Default | Meaning |
| --- | --- | --- |
| `MAX_DCA_COUNT` | profile driven | Maximum number of add-on buys. |
| `MIN_DCA_DISTANCE_PCT` | profile driven | Minimum price distance from last fill before DCA. |
| `DCA_SIZE_MULTIPLIER` | `1.0` | DCA budget multiplier applied to `AEGIS_TRADE_LIMIT`. |
| `MAX_DCA_DEPTH_PCT` | `6.0` | Maximum drawdown from break-even before DCA is blocked. |
| `DCA_REQUIRE_RECLAIM` | `true` | If true, DCA still needs reclaim confirmation. |

### 9. Exits

| Key | Default | Meaning |
| --- | --- | --- |
| `TP1_PCT` | profile driven | TP1 percentage above break-even or entry target. |
| `TP1_SELL_RATIO` | `0.50` | Fraction of the bag sold at TP1. |
| `RUNNER_TRAIL_MIN_PCT` | profile driven | Minimum runner trail distance. |
| `RUNNER_TRAIL_MAX_PCT` | profile driven | Maximum runner trail distance. |
| `RUNNER_TRAIL_ATR_MULT` | `1.60` | ATR influence on runner trail width. |
| `INVALIDATION_ATR_MULT` | `1.25` | ATR influence on invalidation distance. |
| `INVALIDATION_LOOKBACK` | `8` | Lookback for structural invalidation. |
| `INVALIDATION_BUFFER_PCT` | `0.15` | Extra invalidation buffer percentage. |
| `STALE_EXIT_MINUTES` | profile driven | Maximum time allowed for a dead trade. |
| `STALE_EXIT_MAX_PROFIT_PCT` | `0.35` | Stale exit only applies when unrealized profit is still below this level. |

### 10. Visuals And Telemetry

| Key | Default | Meaning |
| --- | --- | --- |
| `ENABLE_CHARTS` | `true` | Enables target-line chart output. |
| `ENABLE_CHART_SHAPES` | `true` | Enables rectangle/shape overlays. |
| `DISPLAY_CHART_SHAPES` | fallback alias | Alias for `ENABLE_CHART_SHAPES`. |
| `ENABLE_NOTIFICATIONS` | `true` | Enables GUI notifications on meaningful transitions. |
| `ENABLE_DEBUG_LOGS` | `false` | Enables extra debug lines. |
| `VERBOSE` | fallback alias | Alias for `ENABLE_DEBUG_LOGS`. |
| `AEGIS_LOG_MODE` | `events` | Controls `events`, `changes`, or `cycle` state logging. |

## Gunbot Settings That Matter Indirectly

These are not parsed as Aegis strategy overrides, but they still matter operationally:

| Key | Meaning |
| --- | --- |
| `PERIOD` | The live execution timeframe Gunbot feeds into Aegis. |
| `CANDLES_LENGTH` | How much local history Gunbot keeps available. More history is safer for Aegis. |
| `strategy` | Must be `custom`. |
| `BUY_METHOD` | Must be `custom`. |
| `SELL_METHOD` | Must be `custom`. |
| `STRAT_FILENAME` | Must point to `Aegis.js`. |
| `IS_MARGIN_STRAT` | Should remain `false` for current Aegis. |

Recommended:
- `PERIOD=15` for current active development
- `CANDLES_LENGTH=400` or higher

## What Aegis Ignores

Many traditional Gunbot knobs may still exist in your pair config because they came from another profile.

Aegis currently ignores them unless they are explicitly listed above.

Common examples that Aegis does not use directly:
- `ADX_*`
- `MFI_*`
- `STOCH_*`
- `STOCHRSI_*`
- `EMA1`
- `EMA2`
- `EMA3`
- `MACD_*`
- `KUMO_*`
- `TENKAN_*`
- classic built-in strategy thresholds from non-custom Gunbot strategies

Leaving those in config is usually harmless, but they can confuse operators.

## Recommended Starting Presets

### BTC / development control

Recommended start:
- `AEGIS_RISK_PROFILE=balanced`
- `AEGIS_LOG_MODE=cycle`
- `PERIOD=15`

Purpose:
- use BTC as the regime-control pair
- verify that Aegis stays disciplined when higher timeframe is weak

### PAXG / defensive validation

Recommended start:
- `AEGIS_RISK_PROFILE=balanced`
- `AEGIS_LOG_MODE=cycle`
- `PERIOD=15`

Current live tuning that has been tested operationally:
- `MIN_RELATIVE_VOLUME=0.25`
- `RECLAIM_WICK_RATIO=0.22`
- `RECLAIM_CLOSE_LOCATION=0.5`
- `MOMENTUM_MIN_RSI_DELTA=0.1`
- `VALUE_MIN_PULLBACK_PCT=0.2`
- `MIN_ENTRY_SCORE=4`

### Wider live observation fleet

Recommended start:
- `AEGIS_RISK_PROFILE=conservative`
- `AEGIS_LOG_MODE=changes`
- `PERIOD=15`

Use this when:
- you want to observe more pairs
- you do not yet have pair-specific evidence

## Example Pair Override Block

```json
{
  "strategy": "custom",
  "enabled": true,
  "override": {
    "STRAT_FILENAME": "Aegis.js",
    "BUY_METHOD": "custom",
    "SELL_METHOD": "custom",
    "IS_MARGIN_STRAT": false,
    "MIN_VOLUME_TO_BUY": 15,
    "MIN_VOLUME_TO_SELL": 15,
    "TRADING_LIMIT": 400,
    "AEGIS_TRADE_LIMIT": 100,
    "AEGIS_RISK_PROFILE": "conservative",
    "AEGIS_LOG_MODE": "changes",
    "ENABLE_CHARTS": true,
    "ENABLE_CHART_SHAPES": true,
    "ENABLE_NOTIFICATIONS": true,
    "ENABLE_DEBUG_LOGS": false,
    "PERIOD": "15",
    "CANDLES_LENGTH": "400"
  }
}
```

## Practical Tuning Order

Do not tune randomly.

Use this order:
1. get pair plumbing correct
2. set order budget and exchange minimums correctly
3. choose a risk profile
4. choose a log mode
5. observe live skip reasons
6. tune one group at a time:
   - liquidity
   - reclaim
   - momentum
   - value
   - DCA
   - exits

Do not start by changing ten settings at once.

## Current Reality Check

As of the current live deployment:
- PAXG is the main pair-specific tuning target
- BTC is the regime-control pair
- the other live pairs are still mostly observation scope

That means:
- use `GUIDE.md` to understand the knobs
- use `README.md` to understand the strategy
- use `LOG.md` and the monitor outputs to decide what to tune next
