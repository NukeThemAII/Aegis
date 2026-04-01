
## Shared Spot Bag Rule Learned On 2026-03-29

- Aegis and Kestrel should now share the same core spot principle:
  - no forced red exits by default
  - hold the bag
  - DCA / reload selectively
  - realize profit only through TP and runner logic
- Structural invalidation / stop lines still matter, but in profit-only mode they are:
  - chart context
  - sidebar context
  - DCA discipline context
  not automatic sell triggers
- Break-even-aware add logic is worth keeping:
  - default add-on buys should only happen below break-even / average bag price
  - optional buffer can require slightly more discount before another add
  - this rule applies to DCA / reload only, not flat initial entries with no existing cost basis
- Unlimited DCA should exist only as an explicit operator option, not as a hidden default.
- Depth caps should remain configurable, with `0` meaning "disable the cap" rather than "block all adds."

## Runtime Audit Rule Learned On 2026-04-01

- If live logs show `0/unl` while `config.js` clearly specifies capped add counts, treat that as a strategy default bug first, not as a config problem.
- In Aegis, cooldown / reset normalization must happen before setup-armed notification logic. Otherwise the bot can emit false "armed" events even though the final state still resolves to cooldown or reset-pending.
- When realized PnL is positive and open bags are being held without forced red exits, do not loosen DCA / reload thresholds just because add counts are still zero.

## Spot Bag Doctrine Updated On 2026-04-01

- The current preferred live doctrine is now:
  - unlimited DCA / reload mode by default
  - below-break-even adds by default
  - profit-only exits by default
  - no forced red stop-loss, time-stop, or stale-stop exits in normal spot operation
- If unlimited mode ever needs a safety rail, prefer:
  - `MAX_DCA_COUNT` / `KESTREL_MAX_RELOAD_COUNT` when bounded counts are desired
  - `AEGIS_MAX_BAG_BASE` / `KESTREL_MAX_BAG_BASE`
  - `AEGIS_MAX_BAG_PCT_OF_TRADING_LIMIT` / `KESTREL_MAX_BAG_PCT_OF_TRADING_LIMIT`
  instead of reintroducing default stop-loss selling.
- Aegis and Kestrel now use a three-step profit ladder:
  - TP1 partial
  - TP2 partial
  - trailing runner
- Chart behavior must stay aligned with the active ladder:
  - after TP1, the sell target should move to TP2
  - after TP2, the trail should become the active close reference
- Any new DCA / reload must reset the take-profit ladder against the refreshed bag average. Do not keep stale TP state after adding size to a live bag.

## Viper Spec Rule Learned On 2026-04-01

- Viper is now the normalized name for the future inventory-first spot strategy line.
- Retire mixed draft labels like `STRAD` and `RAAD` in future sessions unless they are mentioned only as legacy references.
- Viper should remain distinct from the other two lanes:
  - Aegis = selective regime reclaim product
  - Kestrel = fast beta lane
  - Viper = reserve-aware inventory and BEP management engine
- Viper is no longer framed as BTC-only by default. Treat it as pair-capable for liquid spot pairs, while still expecting BTC / ETH / PAXG-class pairs to be the best first fit.
- If Viper is coded later, do not clone Aegis logic. Reuse only the safe runtime scaffolding:
  - override parsing
  - state persistence patterns
  - chart/sidebar/notification plumbing
  - order-safety helpers
  but build new signal and inventory math around regime, reserve, BEP, spacing, and trim ladders.

## Viper Runtime Rule Learned On 2026-04-01

- `Viper.js` now exists as a real runtime strategy and is no longer just a spec.
- Viper should stay distinct from Aegis/Kestrel in live tuning:
  - macro regime on `1D`
  - execution on `4H`
  - timing confirmation on `1H`
  - staged trims (`trim1`, `trim2`, `trim3`) instead of runner logic
  - reserve-aware starter and add math
  - BEP-improving recovery buys only
- Do not reintroduce stop-loss chart semantics into Viper:
  - use risk-floor visuals as context only
  - do not wire them to forced red exits by default
- When editing Viper, preserve these first validation fixes:
  - compare previous regime before updating `state.lastRegime`, otherwise regime notifications break
  - compute add/trim cooldown state before stage selection, otherwise stage/skip telemetry lies
  - always rerun `node --check` after patching `runViper`, because the file is large enough for brace mistakes to slip in during quick edits

## Viper Timeframe Rule Learned On 2026-04-01

- Pair chart timeframe and Viper internal decision timeframes are different.
- `PERIOD=15` on the Gunbot pair does not prevent Viper from using `60m`, `120m`, `240m`, or `1440m` candles internally through `getCandles(...)`.
- For this workspace, the preferred default profile timing is now:
  - `conservative`: `1D / 4H / 1H`
  - `balanced`: `4H / 1H / 15m`
  - `aggressive`: `2H / 30m / 15m`
- If the operator says "we want more action," tune Viper timeframe layers before loosening core discount / reserve / trim math.
- `240m` means 4 hours, not 4 days.

## Viper Live Pair Rule Learned On 2026-04-01

- New Viper pairs must not be cloned from generic pair blocks without explicit Viper overrides.
- If a Viper pair shows things like:
  - `TRADING_LIMIT = 0.002`
  - `MIN_VOLUME_TO_BUY = 0.001`
  - no `VIPER_RISK_PROFILE`
  - no `VIPER_LOG_MODE`
  then treat the problem as bad pair configuration first, not bad strategy logic.
- Current preferred live Viper pair posture:
  - `TAO` = balanced inventory lane
  - `ZEC` = balanced inventory lane
  - `STO` = aggressive inventory lane
  - `NIGHT` = aggressive inventory lane
- Current Viper dev rule:
  - use `VIPER_LOG_MODE = cycle` on live dev pairs until behavior is proven
  - use explicit `VIPER_TRADE_LIMIT` instead of relying on inherited `TRADING_LIMIT`
  - keep `MIN_VOLUME_TO_BUY/SELL = 15` on USDT-base spot pairs here
- Faster Viper profiles should also use faster regime EMAs:
  - balanced defaults now lean on `34 / 120`
  - aggressive defaults now lean on `21 / 72`
  instead of reusing `50 / 200` everywhere

## Viper Add-Math Rule Learned On 2026-04-01

- Viper live bags showed that uncapped ATR-driven add math can become too inert on volatile cheap pairs.
- The specific failure mode was:
  - bag is real
  - BEP discount exists
  - no forced red exit occurs
  - but `nextAdd` gets pushed too far away, so the strategy holds without constructive averaging
- Preserve the new Viper ATR caps:
  - `VIPER_SPACING_ATR_CAP_PCT`
  - `VIPER_DISCOUNT_ATR_CAP_PCT`
- These caps are part of the spot inventory doctrine now. They keep ATR in the model while preventing it from overwhelming fixed BEP-aware discount rules.

## Viper Live Sizing Rule Learned On 2026-04-01

- For this workspace, live Viper development should use a visible dedicated trade override:
  - `VIPER_TRADE_LIMIT = 100`
- Mirror it in `TRADING_LIMIT` for pair clarity and GUI consistency.
- Current preferred Viper live dev config:
  - `CANDLES_LENGTH = 800`
  - `VIPER_LOG_MODE = cycle`
  - `VIPER_UNLIMITED_DCA = true`
  - `VIPER_DCA_BELOW_BREAK_EVEN_ONLY = true`
  - `VIPER_PROFIT_ONLY_EXITS = true`

## Cross-Strategy State Rule Learned On 2026-04-01

- In this Gunbot workspace, strategy state must treat `gb.data.pairLedger.customStratStore` as the canonical live persistent store.
- Do not rely on `gb.data.customStratStore` alone after resolving a snapshot runtime object.
- After state initialization, always sync:
  - `gb.data.customStratStore = gb.data.pairLedger.customStratStore`
- If this rule is broken, the symptoms can look like:
  - repeated `bag-detected`
  - repeated `setup-armed`
  - trim/DCA counters not feeling stable across cycles
  - chart/sidebar transition memory lying or resetting

## Current Live Read On 2026-04-01

- Aegis remains the main product lane.
- Kestrel remains the beta lane and should not be loosened just to force more action while current bags are still developing.
- Viper is currently the strongest live proof-of-concept for profitable staged spot inventory trims:
  - `STO` produced a live `trim3` event under `Viper 1.0.4`
- When tuning next:
  - fix state integrity first
  - then evaluate repeated missed add opportunities
  - only then change thresholds
