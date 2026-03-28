# Aegis Deep Audit — Claude

## Revision 4

**Date:** 2026-03-28 (fourth pass — reclaim logic refinement)
**Strategy version audited:** 1.3.6 (previously 1.3.5 / 1.3.4 / 1.1.1)
**File:** `Aegis.js`
**Context reviewed:** AGENTS.md, MEMORY.md, LOG.md, Kestrel.js v1.2.0, Mako.js v1.0.5, live trade logs

---

## Executive Summary

**Overall rating: A (upgraded from A-).** Between v1.3.4 and v1.3.5, all four of my Revision 2 "new findings" (snapshot shallow-clone, ask-preference for execution, entry path invalidation guard, candle-close-only mode) have been resolved. The same hardening pass also fixed mirror findings across Kestrel and Mako.

**Score card vs. first audit (cumulative):**
- Original bug fixes adopted: **6/6** (100% — was 83%)
- Algorithmic improvements adopted: **2/6** (33%)
- Structural improvements adopted: **0/4** (deferred by design)
- Revision 2 new findings resolved: **4/4** (100%)
- Revision 2 new production hardening: **3 major items** (all verified live)

**The strategy has zero known bugs.** All remaining proposals are algorithmic enhancements, not safety issues.

---

## Part 1: Status of Previous Findings

### 1.1 EMA seeding bias — ✅ FIXED

**Previous:** `calculateEMA()` seeded with `values[0]`, producing biased results on short data.

**Current (line 833–857):**
```javascript
seedTotal = 0;
for (i = 0; i < (period - 1); i += 1) {
  seedTotal += values[i];
  result[i] = NaN;
}
seedTotal += values[period - 1];
previous = seedTotal / period;
result[period - 1] = previous;
```

Now uses SMA of the first `period` values as the seed, and marks pre-seed values as `NaN`. This matches the standard TradingView/industry EMA calculation exactly.

**Verdict:** Fully fixed. This is now a correct, industry-standard implementation.

---

### 1.2 `percentChange()` unsafe denominator — ✅ FIXED

**Previous:** Used `!fromValue` which was both too broad and missed tiny denominators.

**Current (line 334–339):**
```javascript
function percentChange(fromValue, toValue) {
  if (!isFinite(fromValue) || !isFinite(toValue) || Math.abs(fromValue) < 1e-10) {
    return 0;
  }
  return ((toValue - fromValue) / fromValue) * 100;
}
```

**Verdict:** Fully fixed. Exactly the fix I proposed.

---

### 1.3 `maybeClearReset()` inverted logic — ✅ FIXED

**Previous:** Cleared `needsReset` when conditions were bad AND score was low, enabling revenge trades.

**Current (line 1587–1594):**
```javascript
function maybeClearReset(state, config, regimeMetrics, frameMetrics, compositeScore) {
  if (!state.needsReset) { return; }
  if (!regimeMetrics.pass || !frameMetrics.value.ok) {
    state.needsReset = false;
  }
}
```

Composite score is no longer part of the reset-clearing condition. Reset clears only when the market has genuinely drifted away from the prior thesis (regime fails or value zone no longer valid).

**Verdict:** Fully fixed. The anti-revenge-trade logic now works as designed.

---

### 1.4 Stale exit can kill runners — ✅ FIXED

**Previous:** Stale exit had no guard against firing during runner phase.

**Current (line 2579):**
```javascript
} else if (!state.tp1Done && state.entryTime > 0 && staleAgeMinutes >= config.exits.staleMinutes && pnlPct <= config.exits.staleMaxProfitPct) {
```

The `!state.tp1Done` guard now prevents stale exits from killing active trailing runners.

**Verdict:** Fully fixed. Exact fix I proposed.

---

### 1.5 Volume measurement — ✅ FIXED (substantially improved)

**Previous:** Compared partial current candle volume to completed candle averages, causing false `volume-too-light` on PAXG.

**Current (lines 352–389, 1302–1317):** A completely new volume projection system was implemented:

1. **`candleProgressRatio()`** — estimates how far through the current candle we are based on timestamp
2. **`projectSignalVolume()`** — projects current candle volume to full-candle equivalent based on elapsed time
3. **`effectiveSignalVolume`** — takes the maximum of projected current volume and completed prior candle volume
4. New config keys: `projectCurrentVolume` (bool), `projectedVolumeFloor` (0.30)

This is a better solution than my simple "use prior candle" proposal. The projection approach:
- Handles the partial candle problem correctly
- Falls back to the prior completed candle as a floor
- Is configurable per pair
- Has a floor ratio (0.30) to prevent division-by-near-zero early in a candle

**Verdict:** Exceeds the original fix proposal. Well-engineered.

---

### 1.6 Entry sizing uses bid instead of ask — ✅ FIXED

**Previous:** `requestedBuyAmount = config.capital.tradeLimitBase / frameMetrics.bid`

**Current (line 2475):**
```javascript
requestedBuyAmount = config.capital.tradeLimitBase / Math.max(frameMetrics.ask, frameMetrics.bid);
```

Uses `Math.max(ask, bid)` which is even safer — handles the edge case where ask might be stale/zero.

**DCA sizing (line 2491)** also uses the same safe calculation.

**Verdict:** Fixed and improved.

---

### 2.5 Pullback measurement — ✅ FIXED

**Previous:** Used only `highestFromEnd(high, ...)` which caught wicks.

**Current (line 1264):**
```javascript
pullbackHigh = (highestFromEnd(high, config.value.impulseLookback) + highestFromEnd(close, config.value.impulseLookback)) / 2;
```

Now blends the high and close to produce a structural impulse level, exactly as I proposed.

**Verdict:** Fully fixed.

---

### 2.6 Two-bar reclaim — ✅ IMPLEMENTED

**Previous:** Single-candle-only reclaim confirmation.

**Current (lines 1283–1295):** Full two-bar reclaim pattern now exists:
```javascript
twoBarReclaim = !!(
  config.confirm.allowTwoBar &&
  previousIndex < lastIndex &&
  previousWickRatio >= config.confirm.wickRatio &&
  reclaimFast &&
  bullishClose &&
  signalClose > previousClose &&
  signalClose >= previousHigh
);
reclaimOk = singleBarReclaim || twoBarReclaim;
```

Also includes a new config toggle `allowTwoBar` (default `true`) and proper reason differentiation (`reclaim-two-bar` vs `reclaim-ok`).

**Verdict:** Fully implemented, with additional configurability and telemetry beyond what I proposed.

---

### 5.3 Error handling in executeBuy / executeSell — ✅ FIXED

**Previous:** State mutations happened before the await, causing partial state updates on failed orders.

**Current (lines 1754–1758):**
```javascript
result = await gb.method.buyMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);
if (!result) {
  return false;
}
state.lastActionAt = Date.now();
```

State updates now happen after the order succeeds. Same pattern in `executeSell`.

**Verdict:** Fully fixed.

---

## Part 2: Status of Unimplemented Proposals

### 2.1 ATR-relative value zone — NOT IMPLEMENTED

The value zone still uses fixed-percentage bands (line 1266–1267). This remains a valid improvement for multi-pair deployment, but is lower urgency now that the volume projection system has resolved the PAXG bottleneck.

**Recommendation:** Still worth doing when refining the multi-pair deployment posture.

---

### 2.2 RSI divergence detection — NOT IMPLEMENTED

Still a good idea for a future "quality bonus" signal. Not urgent.

---

### 2.3 Regime trend strength — NOT IMPLEMENTED

The regime gate logic is unchanged. The regime already uses slope + separation + alignment + baseline, which is a reasonable 4-check gate. The wobbly-regime risk remains but hasn't been a live problem based on MEMORY.md observations.

**Recommendation:** Defer until regime whipsawing is observed as an actual live problem.

---

### 2.4 Chandelier-style trailing — NOT IMPLEMENTED

The trailing logic (line 1642–1657) is unchanged from the simple peak-trail approach. This remains a valid improvement:
```javascript
state.trailPeak = Math.max(state.trailPeak || 0, frameMetrics.bid);
state.trailStop = state.trailPeak * (1 - (frameMetrics.trailPct / 100));
```

The trail percentage is already ATR-adaptive via `trailPct = clamp(atr/bid * atrMult, min, max)`, which partially addresses the concern. A smoothed peak ratchet would still be an improvement for reducing premature trail stops after impulse moves.

**Recommendation:** Consider implementing after the first few successful runner exits provide data on current trail behavior.

---

### 3.1 Weighted scoring — NOT IMPLEMENTED

Score is still flat 1+1+1+1+1 = 5. Still a valid improvement for pair-specific tuning flexibility.

---

### 3.2 Regime hysteresis — NOT IMPLEMENTED

Still valid. The 10-minute HTF cache provides some dampening, but it's not the same as a consecutive-pass/fail counter.

---

### 3.3 Volatility-regime interaction — NOT IMPLEMENTED

Still valid but lower priority.

---

### 3.4 Scaled DCA — NOT IMPLEMENTED

Still valid but lower priority.

---

## Part 3: New Findings in v1.3.4

### 3.1 NEW — HIGH: Runtime snapshot is defensive but imperfect

**Location:** `snapshotRuntimeData()` (line 207–228)

The runtime snapshot was added after a real production incident where Gunbot's shared mutable runtime caused cross-pair contamination. This is a critical hardening — the strategy now snapshots `gb.data` at cycle start before any async operations.

However, the snapshot is shallow:
```javascript
for (key in sourceData) {
  if (Object.prototype.hasOwnProperty.call(sourceData, key)) {
    snapshot[key] = sourceData[key];
  }
}
```

This copies top-level references, but nested objects (like candle arrays, orderbook, etc.) are still shared references to the original mutable runtime data. If Gunbot mutates those arrays between the snapshot and a later read, the strategy could see inconsistent data mid-cycle.

**Impact:** Low probability in practice (most Gunbot mutations happen between cycles, not during), but theoretically possible during the `getCandles` await.

**Recommendation:** Deep-clone the candle arrays specifically:
```javascript
snapshot.candlesOpen = sourceData.candlesOpen ? sourceData.candlesOpen.slice() : [];
snapshot.candlesHigh = sourceData.candlesHigh ? sourceData.candlesHigh.slice() : [];
snapshot.candlesLow = sourceData.candlesLow ? sourceData.candlesLow.slice() : [];
snapshot.candlesClose = sourceData.candlesClose ? sourceData.candlesClose.slice() : [];
snapshot.candlesVolume = sourceData.candlesVolume ? sourceData.candlesVolume.slice() : [];
snapshot.candlesTimestamp = sourceData.candlesTimestamp ? sourceData.candlesTimestamp.slice() : [];
```

Array `.slice()` is fast and creates new array references without the overhead of `JSON.parse(JSON.stringify(...))`.

---

### 3.2 NEW — MEDIUM: `executeBuy` uses `Math.max(ask, bid)` for fill price logging, which is correct for sizing but misleading for slippage tracking

**Location:** Line 1737

```javascript
var executionPrice = Math.max(safeNumber(frameMetrics.ask, 0), safeNumber(frameMetrics.bid, 0));
```

This is used for `state.lastFillPrice`. On most exchanges, market buys fill at the ask. Using `Math.max(ask, bid)` is practically correct (ask >= bid in normal markets), but in edge cases where Gunbot reports a stale or inverted spread, this could set `lastFillPrice` to an incorrect value.

**Impact:** If `lastFillPrice` is wrong, DCA distance calculations (`dcaTarget`) will trigger at the wrong level.

**Recommendation:** Prefer `frameMetrics.ask` directly, with bid as fallback:
```javascript
var executionPrice = safeNumber(frameMetrics.ask, 0) > 0 ? frameMetrics.ask : frameMetrics.bid;
```

---

### 3.3 NEW — LOW: `isExpectedStrategyFile()` guard compares `STRAT_FILENAME` case-insensitively, but the actual strategy file check uses `activeOverrides(gb)` which reads from the snapshot

**Location:** Line 2638

```javascript
if (!isExpectedStrategyFile(gb, 'Aegis.js')) {
  return;
}
```

The guard was added after a real production incident. It correctly prevents Aegis from executing on pairs assigned to Kestrel or Mako. However, it calls `activeOverrides(gb)` which reads from the snapshot — and the snapshot's `whatstrat` is deep-cloned at resolve time (line 225).

If the issue was that the runtime `gb` object was mutable and shared across pairs, then the snapshot solves it. But the guard runs *before* `runAegis(gb)`, and the `gb` passed to it is already the resolved/snapshotted object, so the guard is correct and safe.

**Verdict:** No bug here. Just documenting that I verified the guard is working correctly with the snapshot model.

---

## Part 4: New Hardening Added Since v1.1.1

These are improvements that weren't in my original audit recommendations but were discovered through production operations. They deserve recognition because they represent real-world hardening that static audits miss.

### 4.1 Runtime snapshot isolation — EXCELLENT

**Problem discovered:** Gunbot custom strategy runtime objects behave like shared mutable async contexts across pairs. Aegis executed a stale sell on a Kestrel pair.

**Fix:** `snapshotRuntimeData()` at cycle start + snapshot-based execution.

**Verdict:** This is the most important production safety improvement since v1.1.1. It prevents an entire class of cross-contamination bugs.

---

### 4.2 Bag recovery from live order history — EXCELLENT

**Problem discovered:** `pairLedger.whenwebought` can be stale from a prior day, causing fresh bags to be recovered with ancient timestamps and immediately stale-exited.

**Fix:** `recoveredBagEntryTime()` (line 1492–1504) now uses a priority chain:
1. Latest local buy order timestamp
2. Compare against latest sell order timestamp
3. Only fall back to `whenwebought` when order history doesn't provide a newer answer

**Verdict:** This was a real loss-causing production bug. The fix is correct and robust.

---

### 4.3 Strategy file guard (`isExpectedStrategyFile`) — GOOD

**Problem discovered:** Gunbot `eval` runtime can execute strategy footers on wrong pairs.

**Fix:** Early return if `STRAT_FILENAME` doesn't match.

**Verdict:** Simple and effective. Now present in all three strategy files.

---

### 4.4 Chart mark on trade events — NICE

`emitChartMark()` (line 1727–1733) now posts time-scale markers on executed buys and sells. This is a good observability addition for post-trade analysis.

---

## Part 5: New Improvement Proposals

### 5.1 MEDIUM — Add bid-above-invalidation guard to entry path

**Current:** The DCA path checks `frameMetrics.bid > frameMetrics.invalidationPrice` (line 2502), but the **initial entry** path does not.

If the entry conditions are met (score 5/5) but the bid has already dipped below the invalidation price, Aegis would enter and then immediately trigger an invalidation exit on the next cycle.

**Fix:** Add the same guard to the entry block:
```javascript
if (!hasBag && !hasOpenOrders && skipReason === 'entry-ready' && frameMetrics.bid > frameMetrics.invalidationPrice) {
```

---

### 5.2 LOW — `setupStage` is computed twice per cycle

**Location:** Lines 2416 and 2623

```javascript
setupStage = determineSetupStage(...); // first call
// ... trade logic ...
setupStage = determineSetupStage(...); // second call after state changes
```

The second call re-evaluates after trade execution has potentially changed the state. This is correct behavior (the stage should reflect post-action state for the sidebar/chart), but the variable name reuse makes it non-obvious. A comment explaining this intentional double-call would improve readability.

---

### 5.3 OPPORTUNITY — Candle-close-only mode for entries

Currently Aegis evaluates on every cycle (roughly every 10-30 seconds per pair). Most indicators are only meaningful at candle close. Evaluating mid-candle creates noise — EMAs, RSI, and volume are all stale or partial until the candle closes.

A toggle like `AEGIS_CLOSE_ONLY_ENTRY` that skips entry evaluation until the current candle is within the last few seconds of its period could reduce false-positive setups that disappear before candle close.

```javascript
if (config.closeOnlyEntry) {
  var candleProgress = candleProgressRatio(timestamps[lastIndex], currentPeriodMinutes, Date.now(), 0);
  if (candleProgress < 0.92) {
    // Skip entry evaluation — wait for candle close
    return;
  }
}
```

This is particularly relevant for PAXG where many "almost ready" setups show up mid-candle and then decay before close.

---

### 5.4 OPPORTUNITY — Stale HTF exit during bags

When Aegis holds a bag and the regime flips off, nothing changes — the bag just sits. The strategy relies on the stale-exit timer or invalidation to ultimately close these positions.

An optional "regime flip during bag" exit could be useful:
- If regime was on when the entry was taken, and now flips off
- And TP1 has not been reached
- Consider exiting at break-even or a small loss instead of waiting for invalidation

This would prevent the scenario where a regime-supported entry becomes a regime-unsupported bag-holder.

---

## Part 6: Ecosystem Growth Assessment

### New strategy files

The repository now contains three strategy files:
- **Aegis.js** (v1.3.5) — regime-filtered pullback strategy, 15m pairs
- **Kestrel.js** (v1.2.0) — fast tape scalper, 5m pairs (now with `beta` profile)
- **Mako.js** (v1.0.5) — intrabar HFT micro-scalper, 5m pairs (currently off active matrix)

All three now share the **hardened** defensive patterns:
- Runtime snapshot isolation with array `.slice()` ✓ (fixed since Revision 2)
- Strategy file guard ✓
- Proper bag recovery ✓
- `buyReferencePrice()` preferring ask ✓ (fixed since Revision 2)
- Chart target / sidebar / notification contract ✓
- Persistent state initialization ✓

The shared patterns suggest a quasi-framework is emerging. If a fourth strategy is planned, consider extracting common infrastructure (snapshot, guard, notification, chart helpers) into a shared utility module that gets concatenated at build time.

### Pair matrix (updated)

The active matrix has been rationalized to 4 pairs across 2 strategies:
- **Aegis** (3 pairs): USDT-BTC (conservative/15m), USDT-PAXG (balanced/15m, close-only-entry enabled), USDT-SOL (aggressive/15m)
- **Kestrel** (1 pair): USDT-XRP (beta/5m)
- **Mako**: off active matrix — intentionally shelved until remaining bugs are addressed

This is a significant operational improvement — the previous 7-pair deployment had config drift (SOL running Aegis with Kestrel keys, XRP running Kestrel with Aegis keys).

---

## Revised Summary Table (Revision 3)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1.1 | ~Critical~ | EMA seeding bias | ✅ **Fixed in 1.2.0** |
| 1.2 | ~High~ | `percentChange()` unsafe | ✅ **Fixed in 1.2.0** |
| 1.3 | ~High~ | `maybeClearReset()` inverted | ✅ **Fixed in 1.3.x** |
| 1.4 | ~Medium~ | Stale exit kills runners | ✅ **Fixed in 1.3.x** |
| 1.5 | ~Medium~ | Partial candle volume measurement | ✅ **Fixed in 1.2.0** (exceeded proposal) |
| 1.6 | ~Low~ | Entry sizing bid→ask | ✅ **Fixed in 1.2.0** |
| 2.1 | Algo | ATR-relative value zone | ❌ Not implemented |
| 2.2 | Algo | RSI divergence | ❌ Not implemented |
| 2.3 | Algo | Regime trend strength | ❌ Not implemented |
| 2.4 | Algo | Chandelier trailing | ❌ Not implemented |
| 2.5 | Algo | Pullback uses high+close blend | ✅ **Fixed in 1.3.x** |
| 2.6 | Algo | Two-bar reclaim | ✅ **Implemented in 1.2.0** |
| 3.1 | Structural | Weighted score | ❌ Not implemented |
| 3.2 | Structural | Regime hysteresis | ❌ Not implemented |
| 3.3 | Structural | Volatility-regime interaction | ❌ Not implemented |
| 3.4 | Structural | Scaled DCA | ❌ Not implemented |
| 5.3 | Code | State update before await | ✅ **Fixed in 1.3.x** |
| R2-3.1 | ~High~ | Snapshot shallow — candle arrays shared | ✅ **Fixed in 1.3.5** (`.slice()` added) |
| R2-3.2 | ~Medium~ | `lastFillPrice` uses max(ask,bid) | ✅ **Fixed in 1.3.5** (`buyReferencePrice()`) |
| R2-5.1 | ~Medium~ | Entry path missing invalidation guard | ✅ **Fixed in 1.3.5** (`below-invalidation` skip) |
| R2-5.3 | ~Opportunity~ | Candle-close-only entry mode | ✅ **Implemented in 1.3.5** (disabled by default) |
| R2-5.4 | Opportunity | Regime-flip bag exit | 🟡 Still proposed |
| R4-1 | Refinement | Reclaim relaxed: `close > fast` only (was `close > fast && bid > fast`) | ✅ **Applied in 1.3.6** — correct for close-confirmed mode |

---

## Revised Recommended Implementation Order (Revision 3)

### ~~Batch 1 — Quick fixes~~ ✅ ALL RESOLVED IN 1.3.5
1. ~~Deep-clone candle arrays in snapshot~~ ✅
2. ~~Use `ask` directly for `executionPrice`~~ ✅
3. ~~Add invalidation guard to entry path~~ ✅
4. ~~Add comment to double `setupStage` evaluation~~ ✅

### Batch 2 — Algorithmic improvements (recommended, validate in simulator)
5. ATR-relative value zone (2.1 — highest remaining value)
6. Regime hysteresis (3.2)
7. Weighted scoring (3.1)

### Batch 3 — Advanced features (after batch 2 is validated)
8. Chandelier-style trailing (2.4)
9. Scaled DCA (3.4)
10. ~~Candle-close-only entry mode~~ ✅ Implemented as `AEGIS_CLOSE_ONLY_ENTRY`
11. RSI divergence (2.2)
12. Regime-flip bag exit (R2-5.4)

---

## Final Assessment

### v1.1.1 → v1.3.6 rating: **A**

Aegis continues to have zero known bugs. The v1.3.6 change is a single-line refinement to the reclaim confirmation logic:

**The change:** `reclaimFast = signalClose > fastLast && bid > fastLast` → `reclaimFast = signalClose > fastLast`

**Audit assessment: ✅ Correct and well-reasoned.**

The old dual-condition required both the candle close AND the live bid to be above the fast EMA. For close-confirmed setups (especially with `AEGIS_CLOSE_ONLY_ENTRY=true` on PAXG), this was overly strict — a candle that closed cleanly above the fast EMA would fail the reclaim check if the bid dipped even 1 tick below the line in the few seconds after the close. The fix properly aligns the reclaim with the close-confirmation thesis: the close is the signal, the bid is just noise after the fact.

This does slightly widen the entry filter — previously, both close AND bid had to be above fast EMA; now only close is checked. But the remaining confirmation layers (close location, wick ratio, bullish close, `signalClose > previousClose`) still provide strong filtering. The change is proportionate and data-driven (observed PAXG behavior, documented in LOG.md).

**Cumulative status:**
- Original bugs: 6/6 fixed (100%)
- Revision 2 new findings: 4/4 fixed (100%)
- Algorithmic improvements: 2/6 implemented (33%)
- Structural improvements: 0/4 (deferred, not needed for safety)
- Live-derived refinements: 1 (reclaim relaxation, v1.3.6)

**What changed since Revision 3 (v1.3.5 → v1.3.6):**
1. Reclaim check relaxed to `signalClose > fastLast` only — removes false negatives on close-confirmed setups
2. Kestrel XRP beta got `KESTREL_MOMENTUM_RSI_CEILING: 76` config override (not a code change)

**What's still on the table:**
Same as Revision 3 — ATR-relative zones, weighted scoring, regime hysteresis, Chandelier trailing, regime-flip bag exit. All optional enhancements.

**Aegis v1.3.6 is production-clean with zero known bugs.** The reclaim refinement improves live conversion without weakening discipline.

---
---

# Kestrel Deep Audit — Claude

## Revision 2

**Date:** 2026-03-28 (re-audit — post-hardening commit reconciliation)
**Strategy version audited:** 1.2.0 (previously 1.1.5)
**File:** `Kestrel.js`
**Context reviewed:** KESTREL.md, MEMORY.md, Aegis.js v1.3.5 (for shared patterns)

---

## Executive Summary

Kestrel is a fast tape-style pullback scalper for 5m charts. It shares the Aegis defensive infrastructure (snapshot isolation, strategy file guard, bag recovery, volume projection) and applies them to a simpler, faster trading thesis: short-term trend continuation into shallow pullbacks.

**Changes since Revision 1:** Two infrastructure fixes landed (snapshot deep-clone, `buyReferencePrice()`), plus a new `beta` risk profile for simulator-first experimental deployment on USDT-XRP. The Kestrel-specific algorithmic findings remain open.

**Overall rating: B+ (unchanged)**

Infrastructure is now hardened to match Aegis. The strategy-specific algorithmic issues (momentum exit, pullback measurement, scoring) remain unaddressed and are the primary upgrade targets.

---

## Part 1: Architecture and Shared Infrastructure

### 1.1 Shared patterns correctly ported from Aegis — ✅ GOOD

All critical defensive patterns are present and now hardened:
- `snapshotRuntimeData()` — ✅ now deep-clones arrays with `.slice()` (fixed in v1.2.0)
- `isExpectedStrategyFile()` — strategy file guard
- `recoveredBagEntryTime()` — multi-source bag time recovery
- `projectSignalVolume()` / `candleProgressRatio()` — volume projection
- `percentChange()` — safe denominator guard
- `calculateEMA()` — SMA-seeded EMA
- `activeOverrides()` — multi-path override resolution
- `buyReferencePrice()` — ✅ new helper preferring ask (added in v1.2.0)

### 1.2 State isolation — ✅ CORRECT

Kestrel stores state in `customStratStore.kestrel`, separate from Aegis's `customStratStore.aegis`. This is critical because pairs might theoretically switch strategies, and stale state from a different strategy must not contaminate the current one.

### 1.3 ~~Shared shallow-snapshot issue~~ — ✅ FIXED IN v1.2.0

`snapshotRuntimeData()` now applies `.slice()` to top-level arrays, preventing cross-pair array mutation. Resolved.

---

## Part 2: Bugs and Edge Cases

### K-2.1 HIGH — Momentum exit fires independently of post-entry grace for stops

**Location:** Line 1914

```javascript
} else if (!runtime.postEntryGraceActive && (frameMetrics.rsi <= config.exits.momentumExitRsi || frameMetrics.fast < frameMetrics.slow)) {
```

The momentum exit checks `!runtime.postEntryGraceActive`, but the condition includes `frameMetrics.fast < frameMetrics.slow` (fast EMA below slow EMA). On a 5m chart, after a valid entry, a single bearish candle can temporarily drag the fast EMA below the slow EMA. The momentum exit would fire immediately after the 60-second grace period expires — often just one or two cycles after entry.

**Impact:** Premature exits on completely normal post-entry retracements. On a 5m scalper, this is a frequent event.

**Fix:** The fast-below-slow check should either:
1. Have its own separate grace period (longer than 60s), or
2. Require N consecutive cycles of `fast < slow` before triggering, or
3. Only fire when combined with RSI deterioration, not standalone:

```javascript
} else if (!runtime.postEntryGraceActive && frameMetrics.rsi <= config.exits.momentumExitRsi && frameMetrics.fast < frameMetrics.slow) {
  // changed || to && — both conditions must be true, not either
```

---

### K-2.2 HIGH — No re-entry cooldown after momentum/time exits, only after bag clears

**Location:** `clearBagState()` (line 1740-1749)

`clearBagState` correctly sets `cooldownUntil` after a bag closes. However, if a sell executes via the `trail-exit`, `stop-exit`, or `momentum-exit` path, `clearBagState` is called, which starts the cooldown. BUT — the `time-stop` and `momentum-exit` paths set `state.cooldownUntil = Date.now() + cooldown`, and **immediately on the same cycle** the `hasBag` check at line 1950 can also fire `clearBagState` again, which resets the cooldown timer. This is benign but redundant.

The real issue is more subtle: the reload path at line 1932 checks `!runtime.reentryCooldownActive`, but `reentryCooldownActive` was computed at line 1777 **before** any sells happened this cycle. If a sell clears a bag AND the market instantly re-arms (same cycle, same candle data), the strategy could re-enter on the very next cycle because the cooldown was set "this cycle" but the reentryCooldownActive flag was computed "before this cycle."

**Impact:** Rare, but possible same-cycle re-entry after a loss exit.

**Fix:** After any sell that calls `clearBagState`, set `runtime.reentryCooldownActive = true` to prevent same-cycle re-entry:
```javascript
if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'stop-exit', frameMetrics)) {
  clearBagState(state, config);
  runtime.reentryCooldownActive = true; // ADD THIS
}
```

---

### K-2.3 MEDIUM — Pullback measurement uses `highestFromEnd(high, ...)` — catches wicks

**Location:** Line 991

```javascript
recentHigh = highestFromEnd(high, config.pullback.lookback);
```

Aegis fixed this in v1.3.x to use a blend of high and close. Kestrel still uses raw highs, which means a single spike wick inflates the pullback percentage and makes shallow consolidations look like "good pullbacks."

**Fix:** Match the Aegis approach:
```javascript
recentHigh = (highestFromEnd(high, config.pullback.lookback) + highestFromEnd(close, config.pullback.lookback)) / 2;
```

---

### K-2.4 MEDIUM — `executionPrice` in `executeBuy` uses `Math.max(ask, bid)`

**Location:** Line 1663

Same issue as Aegis finding 3.2. Should prefer `ask` directly with `bid` as fallback.

---

### K-2.5 LOW — Notification key management has redundant reset calls

**Location:** Lines 1861-1887

```javascript
if (state.lastSetupArmed && !setupArmed) {
  resetNotificationKey(state, 'setup-armed');
}
// ... 12 lines later ...
if (state.lastSetupArmed && !setupArmed) {
  resetNotificationKey(state, 'setup-armed');
}
```

The block from ~1861 to ~1887 has duplicate conditional reset calls. `resetNotificationKey` for `'setup-armed'` is called twice under the same condition, and `resetNotificationKey` for `'trend-on'` is called under two different (but overlapping) conditions. This is harmless but suggests copy-paste assembly.

**Fix:** Deduplicate the notification state management block.

---

## Part 3: Algorithmic Improvements

### K-3.1 No confirm layer complexity — single-candle only

**Current:** Kestrel's confirmation is simpler than Aegis. It checks:
1. Close above fast EMA (optional)
2. Bullish close (optional)
3. Close location above threshold
4. Bounce off low above threshold
5. Close above prior close

There is **no two-bar reclaim** (which Aegis v1.3.4 has). For a 5m scalper that reacts to tape-style bounces, this is actually more critical than for Aegis, because 5m candles are noisier and single-candle signals are less reliable.

**Fix:** Port the `allowTwoBar` pattern from Aegis. On 5m, a wick rejection candle followed by a bullish follow-through is a very common and high-probability pattern.

---

### K-3.2 Momentum exit is too aggressive for a scalper

**Current:** The momentum exit at line 1914 fires whenever RSI drops below 44 OR the fast EMA drops below the slow EMA. On a 5m chart, transient RSI dips below 44 are common and don't necessarily indicate trend failure.

**Improvement:** Add a RSI velocity check. Instead of a hard floor, check whether RSI is accelerating downward:
```javascript
var rsiVelocity = frameMetrics.rsi - (rsiPrev || frameMetrics.rsi);
var momentumDecaying = frameMetrics.rsi <= config.exits.momentumExitRsi && rsiVelocity < -1.5;
```

This catches genuine momentum deterioration while ignoring mere noise.

---

### K-3.3 Stop price logic may produce inverted stop

**Location:** Lines 1086-1092

```javascript
stopPrice = Math.min(
  bid * (1 - (config.exits.hardStopPct / 100)),
  (swingLow > 0 ? swingLow : bid) * (1 - (config.exits.stopBufferPct / 100))
);
```

Using `Math.min` takes the **tighter** stop. If the swing low is very close to the bid (which is common on 5m pullbacks), the structural stop can be extremely tight — tighter than the hard stop percentage intends.

**Fix:** Use `Math.max` to take the **wider** stop (more protective of capital but less likely to whipsaw):
```javascript
stopPrice = Math.max(
  bid * (1 - (config.exits.hardStopPct / 100)),
  (swingLow > 0 ? swingLow : bid) * (1 - (config.exits.stopBufferPct / 100))
);
```

Wait — actually, `Math.min` gives the *lower* price = *wider* stop (further from current price). Re-reading: a stop at a lower price means a bigger loss tolerance. The hard stop at `0.75%` below bid gives a lower price, while the swing-low stop may be closer. `Math.min` picks the lower (more generous) stop.

Actually, the logic IS correct as-is if you want the **less aggressive** stop. But the validator at line 1090 checks `stopPrice >= bid`, which would fire if both computed stops are above bid (shouldn't happen with these percentages). This is fine. **No bug here.**

---

### K-3.4 No ATR-adaptive trailing

Same as Aegis finding 2.4 — the trailing stop uses a fixed percentage from peak. On a 5m chart with highly variable ATR, this is even more relevant.

---

### K-3.5 Reload condition requires PnL > -1.5% — hardcoded magic number

**Location:** Line 1942

```javascript
pnlPct > -1.5
```

This is undocumented and not configurable. It silently blocks reloads when the bag is more than 1.5% underwater. For a scalper with 0.55% TP1, being 1.5% underwater is already a significant loss, and the strategy should probably be exiting rather than considering reloads at that point.

**Fix:** Make this configurable and document it:
```javascript
// In KESTREL_BASE_CONFIG.reload:
maxReloadLossPct: 1.5,

// In reload condition:
pnlPct > -config.reload.maxReloadLossPct
```

---

## Part 4: Structural Assessment

### K-4.1 No regime gate — by design, but risky

Kestrel intentionally doesn't use a higher-timeframe regime gate. This is documented in KESTREL.md as a design choice: "This is a short-horizon continuation gate, not a high-timeframe regime engine."

The risk: on 5m charts, the trend filter (`fast > slow + slope + bid > slow - buffer`) will pass during bear market bounces. Kestrel will enter continuation trades into dead cat bounces, and the `0.75%` hard stop will slowly bleed capital.

**Recommendation:** Consider an optional "parent trend" check using a longer EMA (e.g., 50-period). This wouldn't be a full Aegis-style regime gate — just a "don't trade if the 50 EMA is clearly falling" filter. Make it optional via `KESTREL_PARENT_TREND_EMA` = 0 to disable, >0 to enable.

---

### K-4.2 Score is flat and binary — same as Aegis v1.1.1

Five components, each 0 or 1, with `minEntryScore = 4` (balanced). This means any 4-of-5 combination triggers entry. But trend + pullback + momentum + liquidity without confirmation is a weaker setup than trend + pullback + confirmation + momentum without liquidity.

Same weighted-score recommendation as Aegis finding 3.1.

---

## Kestrel Summary Table

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| K-1.3 | ~High~ | Snapshot shallow — arrays shared | ✅ **Fixed in 1.2.0** |
| K-2.1 | High | Momentum exit fires on transient fast<slow EMA crossover | 🟡 Open |
| K-2.2 | High | Same-cycle re-entry possible after loss exit | 🟡 Open |
| K-2.3 | Medium | Pullback uses raw high, catches wicks | 🟡 Open |
| K-2.4 | ~Medium~ | `executionPrice` should prefer ask | ✅ **Fixed in 1.2.0** (`buyReferencePrice()`) |
| K-2.5 | Low | Duplicate notification reset calls | 🟡 Open |
| K-3.1 | Algo | No two-bar reclaim (Aegis has it) | 🟡 Open |
| K-3.2 | Algo | Momentum exit too aggressive for 5m | 🟡 Open |
| K-3.3 | Code | Stop min/max logic correct but non-obvious | ℹ️ Informational |
| K-3.4 | Algo | No ATR-adaptive trailing | 🟡 Open |
| K-3.5 | Code | Hardcoded -1.5% reload PnL guard | 🟡 Open |
| K-4.1 | Structural | No higher-TF guard — risky in bear markets | 🟡 Open |
| K-4.2 | Structural | Flat scoring — same as old Aegis | 🟡 Open |
| **NEW** | Info | `beta` risk profile added for simulator dev | ✅ Implemented |

---

## Kestrel Recommended Implementation Order (Revised)

### ~~Batch 1a — Infrastructure fixes~~ ✅ RESOLVED
1. ~~Prefer ask for `executionPrice`~~ ✅ Fixed in 1.2.0
2. ~~Deep-clone arrays in snapshot~~ ✅ Fixed in 1.2.0

### Batch 1b — Quick strategy fixes (highest priority)
3. Fix momentum exit `||` to `&&` (K-2.1) — **highest remaining impact**
4. Add `runtime.reentryCooldownActive = true` after sell exits (K-2.2)
5. Port pullback high+close blend from Aegis (K-2.3)
6. Deduplicate notification resets (K-2.5)

### Batch 2 — Algorithmic
7. Port two-bar reclaim from Aegis (K-3.1)
8. Add RSI velocity to momentum exit (K-3.2)
9. Make reload PnL guard configurable (K-3.5)

### Batch 3 — Structural
10. Add optional parent trend EMA filter (K-4.1)
11. Add weighted scoring (K-4.2)

---
---

# Mako Deep Audit — Claude

## Revision 2

**Date:** 2026-03-28 (re-audit — post-hardening commit reconciliation)
**Strategy version audited:** 1.0.5 (previously 1.0.4)
**File:** `Mako.js`
**Context reviewed:** MAKO.md, MEMORY.md, Aegis.js v1.3.5, Kestrel.js v1.2.0

---

## Executive Summary

Mako is an intrabar mean-reversion micro-scalper. It operates on a fundamentally different thesis from Aegis (regime-filtered pullback) and Kestrel (trend continuation scalp): Mako looks for **price overshoot below a rolling anchor**, then enters on the snap-back.

**Changes since Revision 1:** Two infrastructure fixes landed (snapshot deep-clone, `buyReferencePrice()`). Mako has been removed from the active deployment matrix pending resolution of its strategy-specific bugs (dust stuck state, broken trailing, spread-negative TP math).

**Overall rating: B (unchanged)**

The infrastructure is now hardened, but the three critical strategy-level findings remain unresolved. Mako should not be deployed live until at minimum M-2.1 (dust), M-2.4 (trailing), and M-3.3 (spread costs) are fixed.

---

## Part 1: Architecture Assessment

### M-1.1 Shared infrastructure — ✅ CORRECT AND NOW HARDENED

All defensive patterns present and updated:
- Snapshot isolation with `.slice()` ✓ (fixed in v1.0.5)
- Strategy file guard ✓
- SMA-seeded EMA ✓
- Safe `percentChange()` ✓
- Volume projection ✓
- `buyReferencePrice()` preferring ask ✓ (added in v1.0.5)

### M-1.2 State namespace — ✅ CORRECT

Uses `customStratStore.mako`, properly isolated.

### M-1.3 Watch state machine — ✅ ORIGINAL AND WELL-DESIGNED

Unlike Aegis and Kestrel, Mako has an explicit watch state machine (`updateWatchState`) that tracks the stretch opportunity's lifecycle: start time, running low, anchor, trigger, and candle time. This is a genuinely good design choice for a high-frequency strategy — it prevents the strategy from re-evaluating the same stretch on every cycle.

### ~~M-1.4 Shallow snapshot~~ — ✅ FIXED IN v1.0.5

Snapshot now applies `.slice()` to arrays. Resolved.

---

## Part 2: Bugs and Edge Cases

### M-2.1 CRITICAL — `hasBag` uses raw `quoteBalance > 0`, not `hasUsableBag()`

**Location:** Line 1625

```javascript
var hasBag = safeNumber(gb.data.quoteBalance, 0) > 0;
```

Both Aegis and Kestrel use a proper `hasUsableBag()` function that checks:
1. `gb.data.gotBag` flag
2. Whether the quote balance * bid exceeds `MIN_VOLUME_TO_SELL`

Mako uses a raw `quoteBalance > 0` check. This means:
- Dust amounts (e.g., 0.00001 XRP worth $0.0001) will be treated as a bag
- The strategy will enter "bag-manage" mode indefinitely on dust positions
- Time stops, trail stops, and all exit logic will fire but sell nothing (below MIN_VOLUME_TO_SELL)
- The strategy gets stuck until the dust is manually cleared

**Impact:** On a strategy designed for 20-minute round trips, getting stuck on dust is a complete operational halt.

**Fix:** Port the `hasUsableBag()` function from Kestrel/Aegis:
```javascript
function hasUsableBag(gb) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var bid = Math.max(safeNumber(gb.data.bid, 0), safeNumber(gb.data.ask, 0));
  var positionValueBase = quoteBalance * bid;
  var minimumSellBaseValue = minimumSellBaseValue(gb);
  if (safeBoolean(gb.data.gotBag, false)) {
    return true;
  }
  return quoteBalance > 0 && (minimumSellBaseValue === 0 || positionValueBase >= minimumSellBaseValue);
}
```

---

### M-2.2 HIGH — `recoverBagState` uses bid as `lastFillPrice` fallback

**Location:** Line 1199

```javascript
state.lastFillPrice = Math.max(state.lastFillPrice, safeNumber(gb.data.breakEven, 0), safeNumber(gb.data.bid, 0));
```

On bag recovery (e.g., after a Gunbot restart), if `lastFillPrice` is 0 and `breakEven` is 0, the current bid is used as the fill price. But the current bid may be significantly different from the actual fill price.

This inflates `lastFillPrice` if bid is above the actual entry, which causes:
- `reloadTarget` to be set too high (reload = lastFillPrice - ATR * distanceATR)
- Layers fire too early, averaging up instead of down

**Fix:** On recovery, don't include bid as a floor — use only persisted data:
```javascript
state.lastFillPrice = Math.max(state.lastFillPrice, safeNumber(gb.data.breakEven, 0));
if (state.lastFillPrice <= 0) {
  state.lastFillPrice = safeNumber(gb.data.bid, 0); // true last resort only
}
```

---

### M-2.3 HIGH — `normalizedSellAmount` doesn't check `MIN_VOLUME_TO_SELL` at all

**Location:** Lines 1568-1576

```javascript
function normalizedSellAmount(gb, requestedAmount, forceFullIfNeeded) {
  var balance = safeNumber(gb.data.quoteBalance, 0);
  var target = Math.min(balance, Math.max(0, safeNumber(requestedAmount, 0)));
  if (forceFullIfNeeded && balance > 0 && target >= (balance * 0.995)) {
    return balance;
  }
  return target;
}
```

Compare with Aegis/Kestrel's `normalizedSellAmount` which checks whether the order's base value meets `MIN_VOLUME_TO_SELL`. Mako's version only normalizes the amount against the balance — it never validates against exchange minimums.

The `executeSell` function at line 1578 does check `minimumSellValue`, but only after `normalizedSellAmount` has already capped the amount. If a partial TP1 (60% of balance) is below `MIN_VOLUME_TO_SELL`, `executeSell` will:
1. Try to force-full if `forceFullIfNeeded` is true
2. Skip the sell if force-full also doesn't meet the minimum

The logic works but **differently** from Aegis/Kestrel, creating a maintenance risk. The `normalizedSellAmount` function name suggests it handles normalization, but it doesn't handle the minimum-volume normalization that the same-named function handles in the other strategies.

**Fix:** Align `normalizedSellAmount` with Aegis/Kestrel's implementation to reduce cross-strategy maintenance surprises.

---

### M-2.4 MEDIUM — Trail stop is initialized immediately after TP1 without requiring trail trigger

**Location:** Lines 1204-1221

```javascript
function updateTrailingState(state, frameMetrics, breakEven, config) {
  if (!state.tp1Done) { ... return; }
  if (state.trailPeak <= 0) {
    state.trailPeak = frameMetrics.bid; // immediately set peak
  } else {
    state.trailPeak = Math.max(state.trailPeak, frameMetrics.bid);
  }
  state.trailStop = state.trailPeak * (1 - (config.exits.trailPct / 100));
```

Compare with Kestrel's `updateTrailingState` (line 1335-1352):
```javascript
if (state.trailPeak <= 0 && frameMetrics.bid >= frameMetrics.trailTriggerPrice) {
  state.trailPeak = frameMetrics.bid; // only set peak when trigger is reached
}
```

Kestrel requires the bid to reach a `trailTriggerPrice` before activating the trail. Mako immediately starts trailing from the current bid after TP1. With a 0.10% trail percentage, this means the trail stop is set at 0.10% below TP1 level — extremely tight. A single tick down will trigger the trail exit.

Meanwhile, `config.exits.trailTriggerPct` IS defined (default 0.16%) and `frameMetrics.trailTriggerPrice` IS computed (line 1019), but **never used** in `updateTrailingState`.

**Impact:** The trail is effectively a "sell everything on the next downtick after TP1." The trailing functionality is broken — it doesn't trail, it exits immediately.

**Fix:** Add the trigger check:
```javascript
if (state.trailPeak <= 0 && frameMetrics.bid >= frameMetrics.trailTriggerPrice) {
  state.trailPeak = frameMetrics.bid;
}
```

---

### M-2.5 MEDIUM — `executeBuy` resets `trailPeak` and `trailStop` on every buy including layers

**Location:** Lines 1552-1553

```javascript
state.trailPeak = 0;
state.trailStop = 0;
```

On layer adds, this resets the trailing state. If TP1 had already fired and a trail was active, adding a layer would destroy the trail. However, in practice, layers happen before TP1 (while price is dropping and stretching further), so this is unlikely to fire during a trail.

**Impact:** Low probability but incorrect behavior if it occurs.

**Fix:** Only reset trail state on initial entry, not on layers:
```javascript
if (label === 'entry') {
  state.trailPeak = 0;
  state.trailStop = 0;
}
```

---

### M-2.6 LOW — `meanExitPrice` uses `Math.max(baseReference * (1 + fullExitPct/100), anchorLast)`

**Location:** Line 1017

```javascript
meanExitPrice = Math.max(baseReference * (1 + (config.exits.fullExitPct / 100)), anchorLast);
```

The anchor EMA is used as a floor for the mean exit. This is by design (Mako believes price should revert to the anchor). But the anchor is a moving target — if the anchor drops during a trade (because recent candles are lower), the mean exit drops too, potentially exiting at a worse level than TP1.

With `tp1Pct = 0.24%` and `fullExitPct = 0.38%`, the intended flow is TP1 → mean exit → trail. But if the anchor drops below `breakEven * 1.0038`, the mean exit also drops, and can land below TP1. In that case, the strategy would TP1 at 0.24%, then try to mean-exit at a lower level — which would be a losing trade.

**Fix:** Floor the mean exit at the TP1 level:
```javascript
meanExitPrice = Math.max(baseReference * (1 + (config.exits.fullExitPct / 100)), anchorLast, frameMetrics.tp1Price);
```

---

## Part 3: Algorithmic Improvements

### M-3.1 Volume-weighted stretch for entry quality scoring

**Current:** The stretch is measured purely as `(anchor - bid) / ATR`. This treats all stretches equally regardless of whether the stretch happened on volume (conviction selling) or thin air (gap/wick).

**Improvement:** Weight the stretch by relative volume:
```javascript
var volumeAdjustedStretch = stretchAtr * Math.max(0.5, Math.min(2.0, relativeVolume));
```

A stretch on heavy volume into the entry zone is a stronger mean-reversion signal than a stretch on no volume (which might just be a liquidity gap).

---

### M-3.2 Stretch decay timer — watch shouldn't persist indefinitely

**Current:** `updateWatchState` resets the watch if `bid >= anchor` OR if more than `periodMs * 2` has elapsed. But `periodMs * 2` on a 5m chart is only 10 minutes. If a stretch develops slowly over 15 minutes, the watch expires prematurely.

Conversely, if a stretch persists for exactly 9 minutes (just under the 2-candle timeout), the watch stays active but the setup is clearly failing (price isn't recovering).

**Improvement:** Use a separate `MAKO_WATCH_TIMEOUT_CANDLES` config parameter instead of hardcoded `periodMs * 2`:
```javascript
var watchTimeoutMs = config.stretch.watchTimeoutCandles * frameMetrics.periodMs;
if (state.watchActive && (frameMetrics.bid >= frameMetrics.anchor || (now - state.watchStartedAt) > watchTimeoutMs)) {
  clearWatchState(state);
}
```

---

### M-3.3 No spread cost accounting in TP targets

With `tp1Pct = 0.24%` and `maxSpreadPct = 0.12%`, the full round-trip spread cost is ~0.24% (buy at ask, sell at bid). This means **100% of TP1 profit is eaten by spread costs** on a max-spread entry. The strategy is effectively break-even on its best exits.

**Fix:** The TP targets should account for spread:
```javascript
var spreadCost = frameMetrics.liquidity.spreadPct || 0;
var effectiveTp1Pct = config.exits.tp1Pct + spreadCost;
tp1Price = baseReference * (1 + (effectiveTp1Pct / 100));
```

This is THE most impactful improvement for Mako's profitability. Without it, the strategy is mathematically marginal even when the trading thesis is correct.

---

### M-3.4 Layer distance should use break-even, not last fill

**Location:** Line 1018

```javascript
reloadTarget = (state.lastFillPrice > 0 ? state.lastFillPrice : baseReference) - (atrLast * config.layers.distanceAtr);
```

Using `lastFillPrice` means each layer is ATR-distance from the **previous layer**, not from the average. After 3 layers, the distance between the last layer and break-even could be minimal, providing no meaningful improvement to the average.

**Fix:** Use break-even for layer spacing:
```javascript
reloadTarget = (breakEven > 0 ? breakEven : (state.lastFillPrice > 0 ? state.lastFillPrice : baseReference)) - (atrLast * config.layers.distanceAtr);
```

---

## Part 4: Structural Assessment

### M-4.1 No regime or trend gate — by design, but very risky for real money

Mako deliberately has no trend filter. It's designed as a pure mean-reversion system: stretch → bounce → snap back to anchor. The anchor EMA IS the trend proxy.

The risk: in a genuine trending selloff, price will stretch below the anchor, Mako will enter, price will continue falling, Mako will layer in, the time stop fires at a loss, and Mako immediately re-enters the next stretch — all within 20 minutes. This creates a rapid loss accumulation loop.

**Recommendation for live deployment:** Add an optional "anchor slope" guard:
```javascript
var anchorSlope = percentChange(anchorSeries[lastIndex - 3], anchorLast);
if (anchorSlope < -0.05) {
  // anchor is falling — don't mean-revert into a falling mean
  stretchReason = 'anchor-falling';
}
```

---

### M-4.2 Notifications disabled by default

**Current:** `config.telemetry.enableNotifications = false`

For a strategy that might execute 30+ trades per day, this is understandable. But it means state transitions go completely unnoticed. Consider making notifications opt-in for state-change-only events (like Kestrel's approach) rather than blanket disabled.

---

### M-4.3 `recoverBagState` is simpler than Aegis/Kestrel — no order history check

**Location:** Lines 1193-1201

Mako's bag recovery just checks `hadBagLastCycle` and uses `Date.now()` as entryTime if unknown. It doesn't use `latestOrderTimestamp` to find actual buy time from order history. Given Mako's 20-minute time stops, recovering with the wrong entry time could immediately fire the time stop.

**Fix:** Port `recoveredBagEntryTime()` from Kestrel/Aegis.

---

## Mako Summary Table (Revised)

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| M-1.4 | ~High~ | Snapshot shallow — arrays shared | ✅ **Fixed in 1.0.5** |
| M-2.1 | Critical | `hasBag` uses raw balance > 0 — dust stuck state | 🔴 **Open — blocks live deployment** |
| M-2.2 | High | Bag recovery uses bid as fill price fallback | 🟡 Open |
| M-2.3 | High | `normalizedSellAmount` doesn't check MIN_VOLUME_TO_SELL | 🟡 Open |
| M-2.4 | Medium | Trail starts immediately after TP1 — trailTriggerPct never used | 🔴 **Open — trailing is broken** |
| M-2.5 | Medium | Layer buys reset trail state | 🟡 Open |
| M-2.6 | Low | Mean exit can drop below TP1 if anchor falls | 🟡 Open |
| M-3.1 | Algo | No volume-weighted stretch quality | 🟡 Open |
| M-3.2 | Algo | Watch timeout hardcoded as 2 candles | 🟡 Open |
| M-3.3 | Algo | TP targets don't account for spread costs | 🔴 **Open — profitability risk** |
| M-3.4 | Algo | Layer distance from last fill instead of break-even | 🟡 Open |
| M-4.1 | Structural | No anchor slope guard — rapid loss loop | 🟡 Open |
| M-4.2 | Info | Notifications disabled by default | ℹ️ Informational |
| M-4.3 | Structural | Bag recovery simpler than siblings | 🟡 Open |
| **NEW** | Info | `buyReferencePrice()` now prefers ask | ✅ Fixed in 1.0.5 |
| **NEW** | Ops | Removed from active deployment matrix | ✅ Correct decision |

---

## Mako Recommended Implementation Order (Revised)

### ~~Batch 0 — Infrastructure~~ ✅ RESOLVED
- ~~Deep-clone arrays in snapshot~~ ✅ Fixed in 1.0.5
- ~~Prefer ask for execution price~~ ✅ Fixed in 1.0.5

### Batch 1 — Critical fixes (must do before any live deployment)
1. Port `hasUsableBag()` (M-2.1) — **prevents permanent stuck states on dust**
2. Fix trail trigger (M-2.4) — **trailing is currently non-functional**
3. Add spread cost to TP targets (M-3.3) — **without this, profitability is mathematically impossible on typical spreads**

### Batch 2 — High-priority fixes
4. Fix bag recovery fill price (M-2.2)
5. Align `normalizedSellAmount` with siblings (M-2.3)
6. Floor mean exit at TP1 level (M-2.6)
7. Only reset trail state on entry, not layers (M-2.5)

### Batch 3 — Algorithmic
8. Add anchor slope guard (M-4.1) — prevents loss spiral
9. Use break-even for layer spacing (M-3.4)
10. Port `recoveredBagEntryTime()` from siblings (M-4.3)
11. Make watch timeout configurable (M-3.2)

---
---

# Cross-Strategy Comparison (Revision 2)

## Architecture Consistency

| Feature | Aegis v1.3.5 | Kestrel v1.2.0 | Mako v1.0.5 |
|---------|-------------|----------------|-------------|
| Snapshot isolation (deep) | ✅ | ✅ | ✅ |
| Strategy file guard | ✅ | ✅ | ✅ |
| SMA-seeded EMA | ✅ | ✅ | ✅ |
| Safe `percentChange()` | ✅ | ✅ | ✅ |
| Volume projection | ✅ | ✅ | ✅ |
| `buyReferencePrice()` | ✅ | ✅ | ✅ |
| `hasUsableBag()` | ✅ | ✅ | ❌ Missing |
| Multi-source bag recovery | ✅ | ✅ | ❌ Simplified |
| `normalizedSellAmount` with MIN check | ✅ | ✅ | ❌ Missing |
| Pullback high+close blend | ✅ | ❌ | N/A |
| Two-bar reclaim | ✅ | ❌ | N/A |
| Trail trigger guard | ✅ | ✅ | ❌ Broken |
| Entry invalidation guard | ✅ | N/A | N/A |
| Close-only entry mode | ✅ | N/A | N/A |
| State update after await | ✅ | ✅ | ✅ |

## Strategy Ratings (Revised)

| Strategy | Rating | Change | Maturity | Primary Risk |
|----------|--------|--------|----------|--------------|
| Aegis v1.3.6 | **A** | — | Production-clean, zero known bugs | Selectivity (algo improvement opportunity) |
| Kestrel v1.2.0 | **B+** | — | Infrastructure hardened, algo open | Momentum exit too aggressive |
| Mako v1.0.5 | **B** | — | Infrastructure hardened, shelved | Dust stuck, broken trailing, spread-negative math |

## What Changed Since Initial Audit

The hardening commit (`4a2de99`) and matrix refresh commit (`34f5ad6`) resolved:
- **7 findings across 3 strategies** (snapshot × 3, buyReferencePrice × 3, Aegis invalidation guard)
- **1 new feature** (Aegis close-only entry, now deployed on PAXG)
- **1 new risk profile** (Kestrel `beta` for XRP)
- **Config drift cleanup** (SOL and XRP pair assignments corrected)
- **Operational rationalization** (Mako removed from active matrix, 7 pairs → 4 pairs)

## Overall Ecosystem Assessment

The three strategies form a coherent family with shared DNA but distinct trading personalities. The code quality gradient (Aegis > Kestrel > Mako) still holds, but the gap has narrowed significantly at the infrastructure layer — all three now share identical defensive plumbing.

**Remaining top 3 cross-strategy actions (all Mako-specific):**
1. **Port `hasUsableBag()` to Mako** — 10 lines of code prevent permanent stuck states on dust positions.
2. **Fix Mako's trail trigger** — `trailTriggerPct` is defined, computed, and never used. Zero-effort bug fix.
3. **Add spread-cost accounting to Mako's TP** — without it, the strategy is break-even at best.

**For Kestrel, the highest-value remaining fix is:**
4. **Fix momentum exit `||` to `&&`** (K-2.1) — prevents premature exits on normal 5m retracements.

The ecosystem has crossed into a state where **Aegis is production-clean** and the sibling strategies have well-understood, documented upgrade paths.
