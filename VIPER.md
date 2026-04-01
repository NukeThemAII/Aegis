# VIPER.md

## Viper
### Regime-Adaptive Inventory Engine For Gunbot Spot

## Purpose

This document defines the future **Viper** strategy.

It is a **strategy specification**, not runtime code.

Its job is to describe a spot-only inventory-management strategy that is:

- original
- explainable
- pair-capable
- compatible with Gunbot custom strategy runtime
- aligned with the current project doctrine:
  - spot only
  - long only
  - no forced stop-loss selling
  - no panic selling below break-even
  - DCA only when it improves inventory quality
  - partial sells only into profitable strength

This document replaces older mixed naming such as `STRAD` and `RAAD`.

Use **Viper** as the single product name going forward.

---

## Role In The Product Line

Viper is not Aegis with slower settings and it is not Kestrel with more DCA.

### Aegis

- selective regime reclaim strategy
- strongest current premium multi-pair product lane
- optimized around quality entries

### Kestrel

- fast beta lane
- useful for experimentation and quicker turn research
- optimized around faster pullback participation

### Viper

- inventory-first accumulation and distribution engine
- optimized around bag quality, BEP improvement, reserve protection, and staged profitable trims
- intended for spot traders who want the bot to **manage inventory intelligently through cycles**, not simply open and close isolated trades

Viper should behave like a disciplined spot operator:

- patient on first entry
- aggressive only on real discounts
- reserve-aware in weak regimes
- systematic about harvesting strength above BEP

---

## Hard Doctrine

### Non-negotiable

- spot only
- long only
- no liquidation logic
- no forced red stop-loss selling by default
- no blind grid
- no mindless martingale
- no chasing vertical green candles

### Core trading stance

Viper should:

- buy weakness selectively
- improve average inventory price only when the improvement is meaningful
- keep reserve capital for later dislocations
- sell profitable chunks into strength
- preserve a core bag when the regime justifies it

### What Viper is trying to optimize

Not raw trade count.

Viper is optimizing:

- inventory quality
- BEP recovery speed
- reserve preservation
- profit harvesting discipline
- ability to survive long weak periods without fake stop-loss behavior

---

## Market Fit

Viper is **not strictly BTC-only**.

It is best suited to:

- liquid Binance spot pairs
- majors and strong secondaries
- assets with enough liquidity and structure for meaningful pullbacks and profitable rebounds

Best initial candidates:

- `BTC/USDT`
- `ETH/USDT`
- `PAXG/USDT`
- `BNB/USDT`
- `SOL/USDT`

Avoid first-version optimization for:

- illiquid microcaps
- random meme pairs
- assets with poor order quality or wide spreads

---

## Strategy Philosophy

The best spot no-stop-loss system is not a pure breakout strategy and not a pure static grid.

### Why not pure breakout

Without stop losses, failed breakout entries can trap capital too high and too early.

### Why not pure grid

A fixed grid assumes the same spacing quality everywhere.
Real markets do not behave that way.

### Viper answer

Viper is a hybrid of:

- regime switching
- pullback accumulation
- BEP-aware averaging
- volatility-aware spacing
- staged partial distribution

This means:

- trend-following decides directional allowance
- mean reversion improves entries
- ATR and spacing logic prevent overbuying too fast
- staged trims rebuild dry powder above BEP

---

## Core Edge

Viper tries to win by doing five things better than average human spot traders:

1. It does not chase obvious green candles.
2. It buys discounts only when they improve future recovery odds.
3. It changes aggressiveness by regime.
4. It treats BEP as a working control variable, not a passive number.
5. It rebuilds cash through profitable trims instead of hoping for one perfect full exit.

---

## Timeframe Model

Viper should use three layers.

### Macro timeframe

Default:

- `1D`

Purpose:

- define regime
- decide aggressiveness
- decide reserve usage tolerance

### Execution timeframe

Default:

- `4H`

Purpose:

- main buy and sell decision layer
- spacing
- DCA ladder decisions
- trim conditions

### Refinement timeframe

Default:

- `1H`

Purpose:

- timing only
- reclaim / reversal confirmation
- optional exit refinement

Lower timeframe should never override the macro regime.
It should only refine timing.

Timeframes should be configurable later per pair.

### Current practical operating stance

For this repository, Viper should not default to ultra-slow operation.

The current intended profile behavior is:

- `conservative`
  - macro `1D`
  - execution `4H`
  - timing `1H`
- `balanced`
  - macro `4H`
  - execution `1H`
  - timing `15m`
- `aggressive`
  - macro `2H`
  - execution `30m`
  - timing `15m`

This keeps Viper pair-compatible with the way the bot is actually run here:

- pair chart `15m` for visibility and frequent cycling
- internal higher-timeframe fetches for structure and inventory decisions

Important:

- `240m` means **240 minutes = 4 hours**
- it does **not** mean 4 days
- pair `PERIOD=15` in Gunbot can still coexist with Viper using `60m` / `240m` internal candles through `getCandles(...)`

---

## Indicator Set

Viper should stay explainable and use only candle-derivable data.

### Required indicator set

- EMA 20
- EMA 50
- EMA 200
- RSI 14
- Bollinger Bands 20, 2
- ATR 14
- Volume SMA 20
- swing highs / swing lows
- candle body / wick structure
- live BEP
- last buy price
- last profitable trim price

### Optional later

- ADX
- VWAP
- RSI divergence
- effective BEP after realized trims

Do not turn Viper into indicator soup.

---

## Regime Model

Viper should classify the market into three states.

### 1. Bull regime

Typical conditions:

- daily close above EMA 200
- daily EMA 50 above EMA 200
- daily EMA 50 slope flat-to-up or rising
- no clear structural breakdown

Behavior:

- allow starter entries
- allow continuation buys
- allow normal recovery DCA below BEP
- trim less aggressively
- keep a larger core bag

### 2. Neutral regime

Typical conditions:

- daily price near EMA 200
- EMA separation weak
- mixed structure
- range or transition behavior

Behavior:

- demand deeper discounts
- use moderate reserve protection
- trim rebounds more actively
- be more selective on adds

### 3. Bear regime

Typical conditions:

- daily close below EMA 200
- daily EMA 50 below EMA 200
- daily EMA 50 slope down
- repeated lower highs / lower lows

Behavior:

- no aggressive normal buying
- only deep capitulation or major discount buys
- use smaller tranches
- preserve larger reserve
- sell profitable rebounds more aggressively
- still never sell below BEP by default

Doing nothing is a valid edge in bear regime.

---

## Capital Model

Because there is no forced stop-loss selling, capital structure matters more than signal count.

Viper should think in buckets:

- **core capital**
- **tactical capital**
- **reserve capital**

Example balanced model:

- `40%` core capacity
- `30%` tactical capacity
- `30%` reserve capacity

Example conservative model:

- `30%` core capacity
- `25%` tactical capacity
- `45%` reserve capacity

These should be configurable by pair profile later.

### Bag budget controls

Viper should support both:

- count-based DCA caps
- bag exposure caps

Bag exposure caps should allow:

- absolute base-currency cap
- percent-of-`TRADING_LIMIT` cap

Even when unlimited DCA is enabled, reserve policy and bag caps should still act as hard guardrails.

---

## Inventory State Model

Viper should know the state of the current inventory.

### 1. Flat

No inventory.

### 2. Starter

Small initial position only.

### 3. Built

Normal working position with tactical adds possible.

### 4. Heavy bag

Several adds filled.
New buys must become more selective.

### 5. Recovery mode

Inventory is large and the focus shifts to:

- selective lower adds
- profitable staged trims
- reserve rebuilding

The same signal should not cause the same action in every inventory state.

---

## Buy Architecture

Viper should have four buy types.

### 1. Starter buy

Used when inventory is flat or minimal.

Conditions:

- bull regime, or improving neutral regime
- pullback into value area
- no obvious blow-off extension
- reversal or reclaim evidence
- price quality acceptable

Sizing:

- small
- easy to improve later

Purpose:

- establish presence without overcommitting capital

### 2. Continuation pullback buy

Used in healthy bull structure when price cools inside trend.

Typical conditions:

- bull regime
- 4H pullback into EMA 20 / EMA 50 or mid-band zone
- RSI cooled off
- reclaim candle or rejection structure
- normal or improved volume

Sizing:

- moderate
- larger than starter only if structure is healthy

### 3. Recovery DCA buy

Used while holding a bag and price is below BEP.

This is the core Viper buy type.

Conditions:

- meaningful discount below BEP
- sufficient spacing from last buy
- fresh lower low, sweep, or new dislocation
- oversold or stretched condition
- reclaim or reversal evidence
- reserve check passes

This is **not** blind averaging.
It is discounted averaging with structure.

### 4. Capitulation buy

Used mainly in bear regime or major washout conditions.

Requires multiple extremes together:

- far below BEP
- volatility expansion
- downside wick or flush-and-reclaim
- deep RSI stretch
- volume spike
- preferably outside lower Bollinger band

This should be rare and high-conviction only.

---

## Buy Filters

Every buy should pass a filter stack.

### 1. Regime filter

Higher timeframe decides the allowed aggressiveness.

### 2. Discount filter

Recovery DCA should usually require a meaningful discount to BEP.

Suggested regime-aware starting ranges:

- bull: `1.5%` to `3%` below BEP
- neutral: `3%` to `5%` below BEP
- bear: `6%` to `10%` below BEP

These should stay configurable.

### 3. Spacing filter

Consecutive buys must not be too close.

Use the greater of:

- fixed percent distance from last buy
- ATR-based spacing

Concept:

- spacing >= `max(fixedPct, atrPct * atrMultiple)`

Bear regime should widen spacing further.

Runtime note:

- Viper should expose a dedicated per-pair trade amount override through `VIPER_TRADE_LIMIT`.
- Viper should also allow ATR caps for add math so volatile low-priced pairs do not push adds unrealistically far away:
  - `VIPER_SPACING_ATR_CAP_PCT`
  - `VIPER_DISCOUNT_ATR_CAP_PCT`
- These caps should limit ATR influence, not remove it. The goal is to keep inventory adds reachable in normal spot pullbacks while preserving BEP-aware discipline.

### 4. Cooldown filter

Do not keep buying every bar.

Require:

- minimum time or bar gap
- or a genuine new dislocation to override cooldown

### 5. Reserve filter

Never deplete reserve early just because price is lower.

### 6. Structure filter

Require one or more of:

- lower band reclaim
- hammer / long lower wick
- bullish engulfing
- reclaim of prior candle high
- reclaim of prior candle midpoint

### 7. No-chase filter

Avoid buys when:

- price is far above short EMA
- RSI is already hot
- candle is a large green expansion bar
- price is near upper band after several green bars
- the buy worsens inventory quality rather than improving it

---

## Buy Score Model

Viper should use a weighted score rather than one binary trigger.

Example score components:

- `+2` bull regime
- `+1` neutral improving
- `+2` price below lower Bollinger band
- `+1` RSI below `35`
- `+1` RSI below `30`
- `+1` volume above `1.5x` average
- `+1` meaningful discount below BEP
- `+1` new low / sweep / dislocation
- `+1` reversal candle confirmed
- `-2` bear regime without capitulation structure
- `-1` reserve would fall below minimum threshold

Example thresholds:

- starter buy: `>= 4`
- continuation buy: `>= 5`
- recovery buy: `>= 6`
- capitulation buy: `>= 7`

Exact weights and thresholds should remain configurable in code.

---

## DCA Ladder Logic

The DCA ladder must be dynamic, not static-grid.

The next add should depend on:

- regime
- ATR
- discount below BEP
- spacing from last fill
- current inventory state
- remaining reserve

### Conceptual ladder

Relative to BEP:

- layer 1: around `2%` to `3%`
- layer 2: around `4.5%` to `6%`
- layer 3: around `8%` to `10%`
- layer 4: around `13%` to `16%`
- layer 5: only true washout conditions

But these should not be fixed percentages only.
They should be adjusted by ATR and regime.

### Tranche sizing

Viper should avoid reckless martingale.

Example shape:

- starter = `1.00`
- add 1 = `1.00`
- add 2 = `1.20`
- add 3 = `1.40`
- add 4 = `1.60`
- panic add = `1.00` to `1.25`, only if reserve policy allows

Unlimited DCA is acceptable in doctrine only when:

- spacing holds
- reserve holds
- structure confirms
- bag cap is respected

Unlimited does **not** mean “buy every candle”.

---

## Sell Architecture

Viper should use partial sells only by default.

No automatic full liquidation unless the operator explicitly enables a special profile later.

### Sell purpose

Viper sells to:

- realize gains
- reduce overheated tactical inventory
- rebuild dry powder
- improve future re-buy flexibility

### Sell rule

Never partial-sell at a loss just because price looks weak.

### Trim ladder

Suggested conceptual tiers:

- **Tier 1 trim**
  - price modestly above BEP
  - mild stretch
  - sell `10%` to `15%` of tactical inventory

- **Tier 2 trim**
  - stronger stretch
  - upper band extension
  - RSI hot
  - sell another `10%` to `20%`

- **Tier 3 trim**
  - strong extension or euphoria
  - rejection wick or exhaustion behavior
  - sell `15%` to `25%`

### Regime-aware selling

- bull regime:
  - trim less aggressively
  - keep larger core

- neutral regime:
  - trim rebounds more actively
  - rebuild cash faster

- bear regime:
  - sell profitable rebounds more aggressively
  - still avoid selling below BEP

---

## BEP Management

Viper revolves around BEP.

It should track:

- raw BEP from live bag accounting
- distance from price to BEP
- distance from latest fill to current price
- distance from planned trim to BEP

### Optional advanced concept

Later versions may track:

- accounting BEP
- strategy-adjusted effective BEP after realized profitable trims

This should remain optional for v1.

---

## Anti-Overtrading Protections

Viper must explicitly avoid chop death.

Required protections:

- spacing between buys
- cooldown after buys
- stronger requirements in weak regime
- no repeat buy unless there is a fresh lower low or fresh dislocation
- no tiny partial sells that are meaningless after fees
- no noise trading around BEP

---

## Fee And Execution Awareness

The implementation must account for:

- exchange fees
- minimum notional
- step size / quantity rounding
- realistic fill assumptions

Avoid microscopic buys or sells that disappear into fees.

---

## Logging, Telemetry, And Visuals

Viper should be as observable as Aegis.

### Every action log should include

- regime
- price
- BEP before action
- projected BEP after action
- buy or trim score
- distance from last buy
- inventory state
- reserve remaining
- reason for action

### Every no-action cycle should be able to explain

- no discount
- spacing not met
- reserve too low
- weak regime
- no reclaim
- no capitulation
- no profitable trim edge

### Sidebar should expose

- regime
- inventory mode
- BEP
- discount to BEP
- reserve status
- bag exposure
- next add zone
- next trim zone
- add count
- trim phase
- skip reason

### Chart contract should include

- BEP line
- next add target
- next trim target
- optional add zone rectangle
- optional trim zone rectangle
- risk / reserve context when useful

---

## Version 1 Implementation Scope

Viper v1 should stay strong and simple.

### v1 components

- 1D regime filter
- 4H execution logic
- optional 1H timing confirmation
- EMA 50 / EMA 200 regime backbone
- Bollinger + RSI + ATR + volume
- BEP-aware DCA filter
- regime-aware reserve logic
- staged profitable trims
- clear logs, charts, sidebar, notifications

### v1 should not try to do everything

Do not begin with:

- machine learning
- external APIs
- fancy order-book models
- dozens of candle patterns
- massive indicator stacks

---

## Version 2 Candidates

Only after v1 proves itself:

- RSI divergence
- ADX trend strength
- effective BEP tracking
- volatility-compression breakout detector
- dynamic regime-aware sizing curve
- session-awareness
- more advanced tactical/core inventory separation

---

## Failure Modes To Avoid

Viper must guard against:

1. catching every falling knife
2. buying too close together
3. exhausting reserve too early
4. selling too much too early in bull regime
5. never trimming profit
6. treating all regimes the same
7. chasing green candles
8. ignoring fee reality

---

## Implementation Guidance

When Viper is coded later, preserve:

- single-file runtime compatibility
- clear override groups
- readable deterministic math
- strict separation between:
  - regime detection
  - inventory accounting
  - buy scoring
  - trim scoring
  - execution decisions
- Gunbot-safe quantity handling
- product-grade telemetry and charts

Viper should not become a naive grid bot and should not become “Aegis but slower”.

---

## One-Line Description

**Viper is a regime-aware spot inventory strategy that accumulates discounted weakness below BEP, protects reserve capital in weak markets, and trims profitable strength in layers to improve long-term bag quality.**
