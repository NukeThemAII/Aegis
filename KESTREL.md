# Kestrel Tape Scalper

`Kestrel.js` is a separate Gunbot custom strategy from Aegis.

It is intentionally narrower in purpose:
- faster
- more local
- more trade-seeking
- simulator-first

Do not treat Kestrel as a replacement for Aegis. It is the aggressive sibling for short-horizon development work.

## Runtime Target

- single-file runtime: `Kestrel.js`
- plain JavaScript
- Gunbot custom strategy
- spot only
- long only

## Units And Sizing

For `USDT-*` pairs, Kestrel treats:
- `KESTREL_TRADE_LIMIT` as per-entry funding budget
- `TRADING_LIMIT` as optional total pair-level room for multiple reloads or simulator stress runs
- `MIN_VOLUME_TO_BUY` and `MIN_VOLUME_TO_SELL` as minimum exchange-style notional guards

Practical example:
- `KESTREL_TRADE_LIMIT=50`
- `TRADING_LIMIT=300`
- `MIN_VOLUME_TO_BUY=15`
- `MIN_VOLUME_TO_SELL=15`

That means:
- a fresh entry aims for about `50 USDT`
- reloads also size from that `50 USDT` base unless overridden
- the pair still has enough total room for multiple reloads in simulator mode
- orders smaller than about `15 USDT` are skipped as too small

For the current simulator matrix, `300` is the preferred Kestrel pair headroom because it comfortably allows:
- one initial `50 USDT` entry
- up to four additional `50 USDT` reloads
- one small safety margin so Gunbot pair-level limits do not become the bottleneck during ladder tests

## Strategy Thesis

Kestrel is a fast tape-style pullback scalper for `5m` to `15m` charts.

It looks for:
- short-term trend continuation
- shallow pullbacks into a fast EMA zone
- reclaim quality inside the signal candle
- momentum recovery
- acceptable spread and activity

Then it exits quickly:
- partial TP1
- trailing runner
- hard stop
- momentum deterioration exit
- time stop if the move stalls

## Core Logic

### 1. Trend filter

Kestrel checks:
- fast EMA above slow EMA
- fast EMA slope above a minimum threshold
- price not materially below the slow EMA baseline

This is a short-horizon continuation gate, not a high-timeframe regime engine.

### 2. Pullback zone

Kestrel requires price to pull back from a recent local high into a defined zone around the fast EMA.

This avoids buying pure extension and keeps entries tied to local structure.

### 3. Reclaim confirmation

The signal candle must show response quality through:
- close location inside the candle range
- minimum bounce off the low
- optional bullish close requirement
- optional close above the fast EMA

### 4. Momentum sanity

Kestrel uses RSI and RSI delta to avoid entering when the bounce is already fading.

### 5. Liquidity sanity

Kestrel uses:
- spread ceiling
- blended completed-candle and projected in-candle relative volume
- signal range sanity

The blended-volume logic matters in websocket mode. Gunbot cycles inside the active candle, so comparing raw partial volume to completed-candle averages would otherwise block almost everything.

## Position Management

### Entry

Kestrel scores five components:
- trend
- pullback
- reclaim
- momentum
- liquidity

It only enters when the composite score meets `KESTREL_MIN_ENTRY_SCORE`.

### Reloads

Reloads are optional and intentionally limited.

They require:
- bag already open
- reload count below the configured max
- minimum distance from last fill
- trend still acceptable if `KESTREL_RELOAD_REQUIRE_TREND=true`

### Exits

Kestrel manages bags in layers:
- TP1 partial sell
- runner trail activation after progress
- hard stop
- momentum exit on deterioration
- time stop for stale positions

## Telemetry

Kestrel follows the same product standard as Aegis:
- chart targets
- chart shapes
- sidebar telemetry
- state logs
- GUI notifications on meaningful transitions

Useful live fields include:
- stage
- score
- skip reason
- trend / pullback / reclaim / momentum / liquidity reasons
- `relvol`
- reload count
- stop level

## Current Simulator Matrix

The active Kestrel rollout is intentionally profile-split:
- `USDT-PENDLE`: aggressive fast ladder test on `5m`
- `USDT-BNB`: balanced fast continuation test on `5m`
- `USDT-SOL`: aggressive high-beta fast test on `5m`

This keeps the fast strategy honest. We are not testing one profile three times and calling that validation.

## Main Overrides

### Required plumbing

```json
{
  "strategy": "custom",
  "override": {
    "STRAT_FILENAME": "Kestrel.js",
    "BUY_METHOD": "custom",
    "SELL_METHOD": "custom",
    "IS_MARGIN_STRAT": false
  }
}
```

### Capital and control

- `KESTREL_ENABLED`
- `KESTREL_RISK_PROFILE`
- `KESTREL_TRADE_LIMIT`
- `TRADING_LIMIT`
- `KESTREL_FUNDS_RESERVE`
- `KESTREL_ACTION_COOLDOWN_SECONDS`
- `KESTREL_REENTRY_COOLDOWN_MINUTES`
- `KESTREL_MIN_CANDLES`

### Trend

- `KESTREL_TREND_FAST_EMA`
- `KESTREL_TREND_SLOW_EMA`
- `KESTREL_TREND_SLOPE_LOOKBACK`
- `KESTREL_TREND_MIN_SLOPE_PCT`
- `KESTREL_TREND_MAX_BELOW_SLOW_PCT`

### Pullback and reclaim

- `KESTREL_PULLBACK_LOOKBACK`
- `KESTREL_PULLBACK_BUFFER_PCT`
- `KESTREL_PULLBACK_MIN_PCT`
- `KESTREL_PULLBACK_MAX_PCT`
- `KESTREL_RECLAIM_CLOSE_LOCATION`
- `KESTREL_RECLAIM_MIN_BOUNCE_PCT`
- `KESTREL_REQUIRE_BULLISH_CLOSE`
- `KESTREL_REQUIRE_CLOSE_ABOVE_FAST`

### Momentum and liquidity

- `KESTREL_MOMENTUM_RSI_LENGTH`
- `KESTREL_MOMENTUM_RSI_FLOOR`
- `KESTREL_MOMENTUM_RSI_CEILING`
- `KESTREL_MOMENTUM_MIN_DELTA`
- `KESTREL_MAX_SPREAD_PCT`
- `KESTREL_MIN_RELATIVE_VOLUME`
- `KESTREL_VOLUME_LOOKBACK`
- `KESTREL_MAX_SIGNAL_RANGE_PCT`
- `KESTREL_PROJECT_CURRENT_VOLUME`
- `KESTREL_PROJECTED_VOLUME_FLOOR`

### Reload and exit

- `KESTREL_MAX_RELOAD_COUNT`
- `KESTREL_RELOAD_DISTANCE_PCT`
- `KESTREL_RELOAD_REQUIRE_TREND`
- `KESTREL_TP1_PCT`
- `KESTREL_TP1_SELL_RATIO`
- `KESTREL_TRAIL_TRIGGER_PCT`
- `KESTREL_TRAIL_PCT`
- `KESTREL_HARD_STOP_PCT`
- `KESTREL_STOP_LOOKBACK`
- `KESTREL_STOP_BUFFER_PCT`
- `KESTREL_POST_ENTRY_GRACE_SECONDS`
- `KESTREL_TIME_STOP_MINUTES`
- `KESTREL_TIME_STOP_MAX_PROFIT_PCT`
- `KESTREL_MOMENTUM_EXIT_RSI`

`KESTREL_POST_ENTRY_GRACE_SECONDS` is specifically there to stop bad immediate discretionary exits on a fresh fill. Hard stops still work immediately. Momentum and time-stop exits wait until the grace window is over.

### Visual and logging controls

- `KESTREL_LOG_MODE`
- `ENABLE_CHARTS`
- `ENABLE_CHART_SHAPES`
- `ENABLE_NOTIFICATIONS`
- `ENABLE_DEBUG_LOGS`

## Risk Profiles

### Conservative

Use when:
- validating chart behavior
- testing on slower majors
- minimizing reload activity

Characteristics:
- higher score requirement
- tighter pullback rules
- stronger liquidity requirement
- no reloads
- shorter time stop

### Balanced

This is the base profile.

Use when:
- bringing a new pair online
- comparing Kestrel behavior against Aegis on the same market

### Aggressive

Use only in simulator first.

Characteristics:
- lower score threshold
- looser reclaim and pullback thresholds
- lower relative-volume threshold
- up to three reloads
- smaller per-entry sizing by default
- shorter re-entry cooldown
- faster TP / trail behavior for simulator HFT testing

## Current Test Posture

Current intended usage:
- Aegis on multiple `15m` pairs as the disciplined regime strategy
- Kestrel on separate fast pairs, currently configured on:
  - `USDT-PENDLE`
  - `USDT-BNB`
  - `USDT-SOL`
  all on `5m`

That separation is deliberate:
- Aegis is for structured pullback continuation inside a regime gate
- Kestrel is for higher-frequency local continuation testing

## Ops Files

Kestrel development uses separate ops files:
- `ops/kestrel-monitor.js`
- `ops/kestrel-monitor-report.txt`
- `ops/kestrel-monitor-state.json`
- `ops/kestrel-monitor-history.log`

These are separate from Aegis monitoring on purpose.
