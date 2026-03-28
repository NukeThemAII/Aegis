# Aegis Audit

Date: 2026-03-27

Scope:
- `Aegis.js`
- `ops/aegis-monitor.js`
- current `config.js` Aegis deployment
- current live Aegis log output in `gunbot_logs/gunbot_logs.txt`
- current monitor report in `ops/aegis-monitor-report.txt`

## Executive Verdict

No critical or high-severity runtime defects were identified in the current audited state.

The strategy is in a good engineering position for:
- simulator work
- one to two supervised live observation pairs
- continued pair-specific tuning

The strategy is not yet in a strong enough validation state for broad live rollout across the full six-pair deployment currently present in `config.js`.

Current release posture:
- runtime quality: good
- runtime safety posture: good
- observability: strong
- pair validation depth: incomplete
- documentation state: improved in this session

## Findings

### 1. Medium: Live rollout scope exceeds validated tuning scope

Evidence:
- Aegis is live on six Binance pairs in `config.js:4`, `config.js:68`, `config.js:132`, `config.js:196`, `config.js:260`, `config.js:324`
- The project memory and prior development path clearly centered validation on BTC and PAXG first
- Current live logs still show the extra pairs acting mostly as unvalidated observation targets rather than clearly tuned production profiles

Why this matters:
- Strategy behavior may appear "stable" simply because the regime gate is blocking entries, not because all enabled pairs are properly tuned
- Pair-specific liquidity, reclaim quality, and value-zone behavior differ materially between BTC, PAXG, ETH, PENDLE, BNB, and SOL
- Broad early rollout increases noise in logs and increases the chance of drawing incorrect conclusions from untuned pairs

Recommendation:
- Treat `USDT-BTC` and `USDT-PAXG` as the primary validation set
- Treat `USDT-ETH`, `USDT-PENDLE`, `USDT-BNB`, and `USDT-SOL` as observation-only until simulator validation is completed for each profile
- Keep the extra pairs enabled only if the operational goal is data collection rather than live production confidence

### 2. Medium: The current PAXG profile appears over-filtered for the chosen 15m live setup

Evidence:
- Current monitor report shows repeated near-ready PAXG observations without entry in `ops/aegis-monitor-report.txt:17-24`
- Current alerts repeatedly point to reclaim quality and light liquidity in `ops/aegis-monitor-report.txt:35-38`
- The runtime liquidity gate is enforced in `Aegis.js:1150-1159`
- Current PAXG profile is `conservative` with `AEGIS_LOG_MODE=cycle` in `config.js:4-65`

Observed live pattern:
- regime is on
- score repeatedly reaches `3/5`
- momentum often recovers to `ok`
- the setup keeps failing on:
  - `weak-lower-wick`
  - `volume-too-light`

Why this matters:
- This is exactly the kind of pair that can be misclassified as "bad market conditions" when the real issue is that defaults are too strict for that instrument on `15m`
- PAXG has different participation and structure characteristics than BTC
- If the monitor keeps showing the same blocker combination, Aegis may be leaving too much valid opportunity on the table for that pair profile

Recommendation:
- Do not loosen reclaim logic first
- First run simulator tests with a PAXG-only override experiment around liquidity tolerance
- Candidate first test:
  - reduce `MIN_RELATIVE_VOLUME` for PAXG only
- Only if that is insufficient, test a slightly softer reclaim threshold for PAXG

### 3. Low: The ops monitor produces sample-based signals, not candle-based or order-attempt-based metrics

Evidence:
- The monitor increments near-ready counters for every qualifying parsed state line in `ops/aegis-monitor.js:244-250`
- Alerts are then built from those observation counts in `ops/aegis-monitor.js:401-418`
- The monitor report itself currently surfaces this count directly in `ops/aegis-monitor-report.txt:23`

Why this matters:
- `cycle` log mode can emit multiple observations inside one candle window
- The monitor is useful for qualitative trend detection, but its counts are not equivalent to:
  - unique candles
  - unique setups
  - unique entry attempts
- Without that distinction, the alerting language can overstate how many independent opportunities were actually missed

Recommendation:
- Continue using the monitor for directional operational signals
- Do not use its counters as backtest-like evidence
- Future improvement:
  - deduplicate observations by candle timestamp and pair

## Strengths

### Runtime architecture

- Conservative JavaScript runtime style is maintained throughout
- Gunbot eval compatibility is handled explicitly
- The strategy remains a true single-file runtime artifact
- State management is lightweight and appropriately scoped to `customStratStore`

### Strategy design

- The core design remains disciplined and explainable
- The regime gate is doing real work and is preventing blind dip-buying in weak markets
- Entry logic is still transparent enough to tune without reverse-engineering an indicator soup
- DCA remains guarded rather than blind

### Observability

- Chart targets and shapes are meaningful rather than decorative
- Sidebar telemetry is product-grade
- Current live state lines are highly readable and materially useful for tuning
- The added ops monitor is correctly kept outside the runtime strategy path

### Operational safety

- No current Aegis runtime `ERROR` or `FATAL` lines were found in the reviewed live log window
- Notification-key pruning was added in `1.1.1`, which improves long-run persistence hygiene

## Architecture Assessment

### Runtime strategy

Assessment: strong

Notes:
- clear internal sectioning
- deterministic scoring
- good defensive parsing
- production-grade logging for a single-file Gunbot strategy

### Ops helper

Assessment: useful but intentionally lightweight

Notes:
- good for cron-based observation
- not yet a complete analytics layer
- acceptable for current development stage

### Deployment config

Assessment: operationally ahead of validation depth

Notes:
- configuration is coherent
- the issue is not structure
- the issue is scope versus validation confidence

## Live State Snapshot

At audit time:
- `USDT-BTC`
  - functioning as the regime-control pair
  - currently blocked by higher-timeframe regime and weak local conditions
- `USDT-PAXG`
  - closest live candidate
  - repeatedly near-ready
  - still blocked by reclaim quality and liquidity
- `USDT-ETH`
  - occasionally structurally cleaner than BTC
  - still regime blocked in the reviewed window
- `USDT-PENDLE`, `USDT-BNB`, `USDT-SOL`
  - currently more useful as observation pairs than validated deployment pairs

## Recommended Next Actions

1. Keep BTC as the control pair and do not loosen it.
2. Use PAXG as the first pair-specific tuning target.
3. Simulator-test a PAXG-only liquidity relaxation before touching reclaim logic.
4. Keep the monitor running, but treat its counts as observational, not statistical truth.
5. Delay any claim of multi-pair production readiness until each extra pair has its own simulator evidence.

## Final Assessment

Aegis is in a strong engineering state for a custom Gunbot strategy product.

The code quality, runtime discipline, and observability are already above the average custom strategy baseline.

The current gap is no longer core implementation quality. The current gap is validation depth and pair-specific tuning discipline.
