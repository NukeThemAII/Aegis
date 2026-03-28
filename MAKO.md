# Mako Micro Scalper

`Mako.js` is a separate Gunbot custom strategy built specifically for high-frequency simulator work.

It is intentionally not an Aegis clone and not a Kestrel re-skin.

Core identity:
- intrabar mean-reversion
- anchor-deviation entries
- bounce and trigger state machine
- shallow scalp exits
- fast rearming

## What Makes It Different

Mako does not trade a higher-timeframe regime.

Mako does not wait for a classic pullback-then-reclaim trend continuation score.

Instead it watches the active short timeframe candle for a local overshoot below a rolling anchor and then requires:
- sufficient stretch from the anchor in ATR terms
- bounce recovery off the active candle low
- reclaim of a trigger price
- short-horizon pulse improvement
- acceptable spread and relative activity

That makes it suitable for repeated intrabar scalps on liquid pairs, especially in simulator mode.

## Runtime Target

- single-file runtime: `Mako.js`
- plain JavaScript
- Gunbot custom strategy
- spot only
- long only
- optimized for `5m`, but reacts inside the active candle through Gunbot websocket-driven cycles

## Units And Sizing

For `USDT-*` pairs, Mako treats:
- `MAKO_TRADE_LIMIT` as per-entry funding budget
- `TRADING_LIMIT` as total pair-level room for multiple layers
- `MIN_VOLUME_TO_BUY` and `MIN_VOLUME_TO_SELL` as minimum exchange-style notional guards

Current simulator example:
- `MAKO_TRADE_LIMIT=30`
- `TRADING_LIMIT=240`
- `MIN_VOLUME_TO_BUY=15`
- `MIN_VOLUME_TO_SELL=15`

That means:
- a fresh entry aims for about `30 USDT`
- each additional layer also uses about `30 USDT`
- the pair still has enough room for several layers without Gunbot pair caps becoming the first blocker
- partial and full exits still clear exchange-style minimum notional checks

## Strategy Machine

Mako uses an explicit state machine instead of a flat continuation score.

Primary stages:
- `idle`
- `liquidity-blocked`
- `stretch-watch`
- `armed`
- `entry-ready`
- `bag-manage`
- `trail-manage`

### 1. Rolling Anchor

Mako builds:
- anchor EMA
- fast EMA
- pulse EMA
- ATR
- short RSI

The anchor is the short-horizon fair-value line. Mako wants price to stretch away from it and then snap back.

### 2. Stretch Test

Entry watches begin only when price is sufficiently below the anchor in ATR terms.

Primary controls:
- `MAKO_ENTRY_ATR`
- `MAKO_MAX_STRETCH_ATR`

This is the main overshoot test. Too little stretch means there is no edge. Too much stretch means the move is disorderly and can be left alone.

### 3. Arm Test

Once stretched, Mako requires price to bounce off the active candle low.

Primary control:
- `MAKO_ARM_BOUNCE_RATIO`

This is not a full candle-close reclaim requirement. It is an intrabar recovery requirement.

### 4. Trigger Test

After the bounce, Mako requires price to reclaim a trigger level built from:
- active candle structure
- optional fast EMA reclaim
- optional trigger offset

Primary controls:
- `MAKO_REQUIRE_FAST_RECLAIM`
- `MAKO_TRIGGER_OFFSET_PCT`

### 5. Pulse Test

Mako only enters when the short-horizon pulse is no longer decaying.

Primary controls:
- `MAKO_REQUIRE_POSITIVE_PULSE`
- `MAKO_RSI_FLOOR`
- `MAKO_RSI_CEILING`

This is intentionally local and fast. It is not a higher-timeframe trend regime.

### 6. Liquidity Test

Mako uses:
- spread ceiling
- blended completed-candle and projected in-candle relative volume
- active-candle range sanity

Primary controls:
- `MAKO_MAX_SPREAD_PCT`
- `MAKO_MIN_RELATIVE_VOLUME`
- `MAKO_PROJECTED_VOLUME_FLOOR`
- `MAKO_MAX_SIGNAL_RANGE_PCT`

## Layers

Mako can add several small layers while a stretched move is still alive.

That is different from Aegis:
- Aegis layers into a defended thesis
- Mako layers into an ongoing overshoot that is still snapping back

Primary controls:
- `MAKO_MAX_LAYER_COUNT`
- `MAKO_LAYER_DISTANCE_ATR`
- `MAKO_REQUIRE_LOWER_LOW_FOR_ADD`

## Exit Model

Mako exits quickly and repeatedly.

It uses:
- TP1 partial scalp
- mean-exit target
- trailing stop after TP1
- hard stop
- time stop

Primary controls:
- `MAKO_TP1_PCT`
- `MAKO_TP1_SELL_RATIO`
- `MAKO_FULL_EXIT_PCT`
- `MAKO_TRAIL_TRIGGER_PCT`
- `MAKO_TRAIL_PCT`
- `MAKO_HARD_STOP_PCT`
- `MAKO_STOP_BUFFER_ATR`
- `MAKO_TIME_STOP_MINUTES`
- `MAKO_TIME_STOP_MAX_PROFIT_PCT`
- `MAKO_MEAN_EXIT_RSI`

## Profiles

Mako supports:
- `calm`
- `balanced`
- `turbo`

Aliases:
- `conservative` maps to `calm`
- `aggressive` maps to `turbo`

### `calm`

Use when you want fewer but cleaner mean-reversion trades:
- higher stretch requirement
- tighter risk
- fewer layers
- slower reentry

### `balanced`

Default development baseline:
- moderate stretch requirement
- moderate layering
- moderate reentry pace

### `turbo`

Use for true simulator stress testing:
- lower stretch threshold
- more layers
- faster reentry
- shorter holding time

This is the intended high-frequency mode.

## Telemetry

Mako telemetry is intentionally different from Aegis and Kestrel.

Useful live fields:
- `stage`
- `arm`
- `stretch`
- `bounce`
- `pulse`
- `rsi`
- `relvol`
- `layers`
- `target`
- `stop`
- `skip`

Example live state line shape:

```text
[Mako Micro Scalper 1.0.0][binance][USDT-XRP][STATE] tf=5m bid=... phase=... stage=armed arm=yes stretch=0.74atr bounce=0.32 pulse=+1.50 ...
```

## Required Pair Plumbing

```json
{
  "strategy": "custom",
  "override": {
    "STRAT_FILENAME": "Mako.js",
    "BUY_METHOD": "custom",
    "SELL_METHOD": "custom",
    "IS_MARGIN_STRAT": false
  }
}
```

## Current Simulator Matrix

Current deployment:
- `USDT-XRP`
  - `Mako.js`
  - `PERIOD=5`
  - `MAKO_PROFILE=turbo`
  - `MAKO_TRADE_LIMIT=30`
  - `TRADING_LIMIT=240`

This pair was chosen because it is liquid, cheap to size, and good for repeated intrabar tests.

## Main Overrides

### Runtime and capital

- `MAKO_ENABLED`
- `MAKO_PROFILE`
- `MAKO_TRADE_LIMIT`
- `TRADING_LIMIT`
- `MAKO_FUNDS_RESERVE`
- `MAKO_ACTION_COOLDOWN_SECONDS`
- `MAKO_REENTRY_COOLDOWN_SECONDS`
- `MAKO_MIN_CANDLES`

### Micro structure

- `MAKO_ANCHOR_EMA`
- `MAKO_FAST_EMA`
- `MAKO_PULSE_EMA`
- `MAKO_ATR_LENGTH`
- `MAKO_RSI_LENGTH`
- `MAKO_LOOKBACK_LOW_BARS`

### Stretch and trigger

- `MAKO_ENTRY_ATR`
- `MAKO_MAX_STRETCH_ATR`
- `MAKO_ARM_BOUNCE_RATIO`
- `MAKO_TRIGGER_OFFSET_PCT`
- `MAKO_REQUIRE_FAST_RECLAIM`
- `MAKO_REQUIRE_POSITIVE_PULSE`
- `MAKO_RSI_FLOOR`
- `MAKO_RSI_CEILING`

### Liquidity

- `MAKO_MAX_SPREAD_PCT`
- `MAKO_MIN_RELATIVE_VOLUME`
- `MAKO_VOLUME_LOOKBACK`
- `MAKO_PROJECT_CURRENT_VOLUME`
- `MAKO_PROJECTED_VOLUME_FLOOR`
- `MAKO_MAX_SIGNAL_RANGE_PCT`

### Layers and exits

- `MAKO_MAX_LAYER_COUNT`
- `MAKO_LAYER_DISTANCE_ATR`
- `MAKO_REQUIRE_LOWER_LOW_FOR_ADD`
- `MAKO_TP1_PCT`
- `MAKO_TP1_SELL_RATIO`
- `MAKO_FULL_EXIT_PCT`
- `MAKO_TRAIL_TRIGGER_PCT`
- `MAKO_TRAIL_PCT`
- `MAKO_HARD_STOP_PCT`
- `MAKO_STOP_BUFFER_ATR`
- `MAKO_TIME_STOP_MINUTES`
- `MAKO_TIME_STOP_MAX_PROFIT_PCT`
- `MAKO_MEAN_EXIT_RSI`

### Telemetry

- `MAKO_LOG_MODE`
- `ENABLE_CHARTS`
- `ENABLE_CHART_SHAPES`
- `ENABLE_NOTIFICATIONS`
- `ENABLE_DEBUG_LOGS`

## Ops

Mako has its own monitor:
- `ops/mako-monitor.js`

Generated runtime artifacts are already covered by the existing `.gitignore` patterns under `ops/`.
