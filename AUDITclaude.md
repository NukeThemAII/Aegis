# Aegis Deep Audit — Claude

## Revision 2

**Date:** 2026-03-28 (re-audit)
**Strategy version audited:** 1.3.4 (previously 1.1.1)
**File:** `Aegis.js` (2661 lines, ~86 KB — up from 2420 / 79 KB)
**Context reviewed:** AGENTS.md, MEMORY.md, LOG.md, AUDIT.md, AUDITgemini.md, GUIDE.md, README.md, Kestrel.js, Mako.js, KESTREL.md, MAKO.md

---

## Executive Summary

**Overall rating: Significantly improved.** The jump from v1.1.1 to v1.3.4 represents a serious maturation — 5 of my 6 original bug findings have been fully or partially addressed, and 2 of my 6 algorithmic proposals were implemented. The strategy also survived a live production incident (stale `whenwebought` → instant loss) and now has robust defenses against shared mutable runtime corruption, which was a bug class I hadn't even identified in the first audit.

**Score card vs. first audit:**
- Bug fixes adopted: **5/6** (83%)
- Algorithmic improvements adopted: **2/6** (33%)
- Structural improvements adopted: **0/4** (but see notes — some are now lower priority)
- New issues discovered this audit: **3**
- New production-learned hardening: **3 major items**

**The strategy is now meaningfully more production-safe than v1.1.1.**

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
- **Aegis.js** (v1.3.4) — regime-filtered pullback strategy, 15m pairs
- **Kestrel.js** (v1.1.5) — fast momentum reload strategy, 5m pairs
- **Mako.js** (v1.0.4) — intrabar HFT micro-scalper, 5m pairs

All three share the same defensive patterns:
- Runtime snapshot isolation ✓
- Strategy file guard ✓
- Proper bag recovery ✓
- Chart target / sidebar / notification contract ✓
- Persistent state initialization ✓

The shared patterns suggest a quasi-framework is emerging. If a fourth strategy is planned, consider extracting common infrastructure (snapshot, guard, notification, chart helpers) into a shared utility module that gets concatenated at build time.

### Pair matrix

Seven pairs are now active across three strategies. This is operationally ambitious but organizationally coherent — each strategy has a clear identity and appropriate pair assignments.

---

## Revised Summary Table

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
| **NEW** 3.1 | High | Snapshot is shallow — candle arrays shared | 🟡 New finding |
| **NEW** 3.2 | Medium | `lastFillPrice` uses max(ask,bid) | 🟡 New finding |
| **NEW** 5.1 | Medium | Entry path missing invalidation guard | 🟡 New finding |
| **NEW** 5.3 | Opportunity | Candle-close-only entry mode | 🟡 New proposal |
| **NEW** 5.4 | Opportunity | Regime-flip bag exit | 🟡 New proposal |

---

## Revised Recommended Implementation Order

### Batch 1 — Quick fixes (safe, no behavior change)
1. Deep-clone candle arrays in snapshot (NEW 3.1)
2. Use `ask` directly for `executionPrice` (NEW 3.2)
3. Add invalidation guard to entry path (NEW 5.1)
4. Add comment to double `setupStage` evaluation (NEW 5.2)

### Batch 2 — Algorithmic improvements (still recommended, validate in simulator)
5. ATR-relative value zone (2.1 — highest remaining value)
6. Regime hysteresis (3.2)
7. Weighted scoring (3.1)

### Batch 3 — Advanced features (after batch 2 is validated)
8. Chandelier-style trailing (2.4)
9. Scaled DCA (3.4)
10. Candle-close-only entry mode (NEW 5.3)
11. RSI divergence (2.2)
12. Regime-flip bag exit (NEW 5.4)

---

## Final Assessment

### v1.1.1 → v1.3.4 rating: **A-**

The development velocity has been impressive. In one day:
- 5 of 6 bugs were fixed (83% adoption of audit findings)
- 2 algorithmic improvements were implemented  
- 3 production-discovered issues were resolved with excellent hardening
- The strategy survived its first real-money incident and emerged stronger
- The ecosystem expanded from 1 to 3 strategy files with consistent architecture

**What moved the needle most:**
1. Runtime snapshot isolation — prevents an entire class of concurrency bugs
2. Volume projection system — turns an unreliable heuristic into a defensible measurement
3. Two-bar reclaim — captures a pattern the strategy was designed for but couldn't see
4. Bag recovery from order history — prevents immediate-loss bugs

**What's still on the table:**
The remaining improvements (ATR-relative zones, weighted scoring, regime hysteresis, Chandelier trailing) are all genuine upgrades, but they're now in the category of "make a working strategy better" rather than "fix a broken strategy." That's the right place to be.

**The strategy has crossed the threshold from "correct but cautious" to "production-hardened and operationally sound."** The next frontier is sharpening selectivity and exit quality, not fixing safety issues.

---
---

# Kestrel Deep Audit — Claude

**Date:** 2026-03-28
**Strategy version audited:** 1.1.5
**File:** `Kestrel.js` (1981 lines, ~68 KB)
**Context reviewed:** KESTREL.md, MEMORY.md, Aegis.js (for shared patterns)

---

## Executive Summary

Kestrel is a fast tape-style pullback scalper for 5m charts. It shares the Aegis defensive infrastructure (snapshot isolation, strategy file guard, bag recovery, volume projection) and applies them to a simpler, faster trading thesis: short-term trend continuation into shallow pullbacks.

**Overview:** The code quality is excellent — clean, consistent, and intentionally simpler than Aegis. All production-learned safety patterns from Aegis have been back-ported. The trading logic itself is sound for its narrow purpose but has several areas where the simplicity becomes a liability.

**Overall rating: B+**

The strategy is well-built and safe but algorithmically less mature than Aegis v1.3.4. It needs refinement in its exit logic and confirmation layer to become a credible scalper rather than a "buy-and-hope-the-trend-continues" system.

---

## Part 1: Architecture and Shared Infrastructure

### 1.1 Shared patterns correctly ported from Aegis — ✅ GOOD

All critical defensive patterns are present:
- `snapshotRuntimeData()` — shallow snapshot, same as Aegis (same shallow-clone limitation applies)
- `isExpectedStrategyFile()` — strategy file guard
- `recoveredBagEntryTime()` — multi-source bag time recovery
- `projectSignalVolume()` / `candleProgressRatio()` — volume projection
- `percentChange()` — safe denominator guard
- `calculateEMA()` — SMA-seeded EMA
- `activeOverrides()` — multi-path override resolution

### 1.2 State isolation — ✅ CORRECT

Kestrel stores state in `customStratStore.kestrel`, separate from Aegis's `customStratStore.aegis`. This is critical because pairs might theoretically switch strategies, and stale state from a different strategy must not contaminate the current one.

### 1.3 Shared shallow-snapshot issue — 🟡 INHERITED

Same as Aegis finding 3.1: `snapshotRuntimeData()` copies top-level references but candle arrays are still shared. Same fix applies — `.slice()` the candle arrays.

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

| # | Severity | Finding |
|---|----------|---------|
| K-2.1 | High | Momentum exit fires on transient fast<slow EMA crossover |
| K-2.2 | High | Same-cycle re-entry possible after loss exit |
| K-2.3 | Medium | Pullback uses raw high, catches wicks |
| K-2.4 | Medium | `executionPrice` should prefer ask |
| K-2.5 | Low | Duplicate notification reset calls |
| K-3.1 | Algo | No two-bar reclaim (Aegis has it) |
| K-3.2 | Algo | Momentum exit too aggressive for 5m |
| K-3.3 | Code | Stop min/max logic correct but non-obvious |
| K-3.4 | Algo | No ATR-adaptive trailing |
| K-3.5 | Code | Hardcoded -1.5% reload PnL guard |
| K-4.1 | Structural | No higher-TF guard — risky in bear markets |
| K-4.2 | Structural | Flat scoring — same as old Aegis |

---

## Kestrel Recommended Implementation Order

### Batch 1 — Quick fixes
1. Fix momentum exit `||` to `&&` (K-2.1) — highest impact
2. Add `runtime.reentryCooldownActive = true` after sell exits (K-2.2)
3. Port pullback high+close blend from Aegis (K-2.3)
4. Prefer ask for `executionPrice` (K-2.4)
5. Deduplicate notification resets (K-2.5)

### Batch 2 — Algorithmic
6. Port two-bar reclaim from Aegis (K-3.1)
7. Add RSI velocity to momentum exit (K-3.2)
8. Make reload PnL guard configurable (K-3.5)

### Batch 3 — Structural
9. Add optional parent trend EMA filter (K-4.1)
10. Add weighted scoring (K-4.2)

---
---

# Mako Deep Audit — Claude

**Date:** 2026-03-28
**Strategy version audited:** 1.0.4
**File:** `Mako.js` (1866 lines, ~66 KB)
**Context reviewed:** MAKO.md, MEMORY.md, Aegis.js, Kestrel.js (for cross-reference)

---

## Executive Summary

Mako is an intrabar mean-reversion micro-scalper. It operates on a fundamentally different thesis from Aegis (regime-filtered pullback) and Kestrel (trend continuation scalp): Mako looks for **price overshoot below a rolling anchor**, then enters on the snap-back.

This is the highest-frequency strategy in the family, with 4-second action cooldowns, 45-second re-entry cooldowns, and 0.24% TP1 targets. It's designed to execute dozens of micro-trades per day in simulator mode.

**Overall rating: B**

The architecture is clean and follows the family patterns, but the trading logic has several issues that are more impactful at this frequency. On a strategy that trades dozens of times per day, a small bug compounds fast.

---

## Part 1: Architecture Assessment

### M-1.1 Shared infrastructure — ✅ CORRECT

All defensive patterns present:
- Snapshot isolation ✓
- Strategy file guard ✓
- SMA-seeded EMA ✓
- Safe `percentChange()` ✓
- Volume projection ✓

### M-1.2 State namespace — ✅ CORRECT

Uses `customStratStore.mako`, properly isolated.

### M-1.3 Watch state machine — ✅ ORIGINAL AND WELL-DESIGNED

Unlike Aegis and Kestrel, Mako has an explicit watch state machine (`updateWatchState`) that tracks the stretch opportunity's lifecycle: start time, running low, anchor, trigger, and candle time. This is a genuinely good design choice for a high-frequency strategy — it prevents the strategy from re-evaluating the same stretch on every cycle.

### M-1.4 Shallow snapshot — 🟡 INHERITED

Same issue as Aegis/Kestrel.

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

## Mako Summary Table

| # | Severity | Finding |
|---|----------|---------|
| M-2.1 | Critical | `hasBag` uses raw balance > 0 — dust positions cause permanent stuck state |
| M-2.2 | High | Bag recovery uses bid as fill price fallback — inflates reload targets |
| M-2.3 | High | `normalizedSellAmount` doesn't check MIN_VOLUME_TO_SELL |
| M-2.4 | Medium | Trail starts immediately after TP1 — trailTriggerPct is computed but never used |
| M-2.5 | Medium | Layer buys reset trail state |
| M-2.6 | Low | Mean exit can drop below TP1 if anchor falls |
| M-3.1 | Algo | No volume-weighted stretch quality |
| M-3.2 | Algo | Watch timeout hardcoded as 2 candles |
| M-3.3 | Algo | TP targets don't account for spread costs — mathematically marginal |
| M-3.4 | Algo | Layer distance from last fill instead of break-even |
| M-4.1 | Structural | No anchor slope guard — rapid loss loop in trending selloffs |
| M-4.2 | Info | Notifications disabled by default |
| M-4.3 | Structural | Bag recovery simpler than siblings — no order history |

---

## Mako Recommended Implementation Order

### Batch 1 — Critical fixes (must do before any live deployment)
1. Port `hasUsableBag()` (M-2.1) — prevents permanent stuck states on dust
2. Fix trail trigger (M-2.4) — trailing is currently non-functional
3. Add spread cost to TP targets (M-3.3) — without this, profitability is mathematically impossible on typical spreads

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

# Cross-Strategy Comparison

## Architecture Consistency

| Feature | Aegis v1.3.4 | Kestrel v1.1.5 | Mako v1.0.4 |
|---------|-------------|----------------|-------------|
| Snapshot isolation | ✅ | ✅ | ✅ |
| Strategy file guard | ✅ | ✅ | ✅ |
| SMA-seeded EMA | ✅ | ✅ | ✅ |
| Safe `percentChange()` | ✅ | ✅ | ✅ |
| Volume projection | ✅ | ✅ | ✅ |
| `hasUsableBag()` | ✅ | ✅ | ❌ Missing |
| Multi-source bag recovery | ✅ | ✅ | ❌ Simplified |
| `normalizedSellAmount` with MIN check | ✅ | ✅ | ❌ Missing |
| Pullback high+close blend | ✅ | ❌ | N/A |
| Two-bar reclaim | ✅ | ❌ | N/A |
| Trail trigger guard | ✅ | ✅ | ❌ Broken |
| State update after await | ✅ | ✅ | ✅ |

## Strategy Ratings

| Strategy | Rating | Maturity | Primary Risk |
|----------|--------|----------|--------------|
| Aegis v1.3.4 | **A-** | Production-hardened | Selectivity (too conservative) |
| Kestrel v1.1.5 | **B+** | Development-ready | Momentum exit too aggressive |
| Mako v1.0.4 | **B** | Simulator-only | Dust stuck state, broken trailing, spread-negative math |

## Overall Ecosystem Assessment

The three strategies form a coherent family with shared DNA but distinct trading personalities. The code quality gradient (Aegis > Kestrel > Mako) mirrors the deployment maturity: Aegis has gone through production incidents and emerged stronger, while Mako is still in first-generation simulator mode.

**Top 3 cross-strategy actions:**
1. **Standardize `hasUsableBag()`** — copy from Aegis to Mako. 10 lines of code prevent permanent stuck states.
2. **Fix Mako's trailing** — the trailTriggerPct is computed but never used. This is a zero-effort bug fix.
3. **Add spread-cost accounting to Mako's TP** — without it, the strategy is break-even at best on typical spreads.

These three fixes combined would take Mako from "interesting simulator experiment" to "plausibly profitable micro-scalper."
