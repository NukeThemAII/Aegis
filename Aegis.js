/*
 * Aegis Regime Reclaim
 * Version: 1.3.6
 * Updated: 2026-03-28
 *
 * Premium single-file Gunbot custom strategy.
 * Spot only. Long only.
 */

var AEGIS_META = {
  name: 'Aegis Regime Reclaim',
  version: '1.3.6',
  updated: '2026-03-28'
};

var AEGIS_COLORS = {
  good: '#36a269',
  bad: '#d05757',
  warn: '#d6a436',
  neutral: '#8b97a8',
  info: '#4e8bd6',
  zoneFill: 'rgba(54, 162, 105, 0.12)',
  zoneBorder: 'rgba(54, 162, 105, 0.50)',
  stopFill: 'rgba(208, 87, 87, 0.10)',
  stopBorder: 'rgba(208, 87, 87, 0.45)'
};

var AEGIS_BASE_CONFIG = {
  enabled: true,
  riskProfile: 'balanced',
  minCandles: 90,
  reentryResetScore: 2,
  capital: {
    tradeLimitBase: 100,
    fundsReserveBase: 0,
    actionCooldownSeconds: 12,
    reentryCooldownMinutes: 90
  },
  regime: {
    htfPeriod: 60,
    candleCount: 240,
    emaFast: 21,
    emaSlow: 55,
    slopeLookback: 3,
    minSlopePct: 0.02,
    minSeparationPct: 0.10,
    cacheSeconds: 600
  },
  value: {
    emaFast: 9,
    emaSlow: 21,
    bandBufferPct: 0.25,
    impulseLookback: 18,
    minPullbackPct: 0.35,
    maxPullbackPct: 4.5
  },
  confirm: {
    wickRatio: 0.35,
    closeLocation: 0.58,
    requireBullishClose: true,
    allowTwoBar: true
  },
  momentum: {
    rsiLength: 14,
    rsiFloor: 41,
    rsiCeiling: 69,
    minRsiDelta: 0.5
  },
  liquidity: {
    maxSpreadPct: 0.12,
    minRelativeVolume: 0.65,
    volumeLookback: 20,
    maxSignalRangePct: 3.2,
    projectCurrentVolume: true,
    projectedVolumeFloor: 0.30
  },
  risk: {
    minEntryScore: 5,
    closeOnlyEntry: false,
    closeOnlyEntryProgress: 0.92,
    useBuyEnabled: true,
    useSellEnabled: true
  },
  dca: {
    maxCount: 2,
    minDistancePct: 1.75,
    sizeMultiplier: 1.0,
    maxDepthFromBreakEvenPct: 6.0,
    requireReclaim: true
  },
  exits: {
    tp1Pct: 1.6,
    tp1SellRatio: 0.50,
    runnerTrailMinPct: 0.90,
    runnerTrailMaxPct: 2.40,
    runnerTrailAtrMult: 1.60,
    invalidationAtrMult: 1.25,
    invalidationLookback: 8,
    invalidationBufferPct: 0.15,
    staleMinutes: 720,
    staleMaxProfitPct: 0.35
  },
  visuals: {
    enableCharts: true,
    enableShapes: true
  },
  telemetry: {
    enableNotifications: true,
    enableDebugLogs: false,
    logMode: 'events',
    notificationRetentionMinutes: 4320,
    notificationKeyLimit: 200,
    notificationPruneIntervalMinutes: 60
  }
};

function applyRiskProfile(config) {
  var profile = String(config.riskProfile || 'balanced').toLowerCase();
  if (profile === 'conservative') {
    config.capital.reentryCooldownMinutes = 150;
    config.value.maxPullbackPct = 3.5;
    config.liquidity.maxSignalRangePct = 2.4;
    config.dca.maxCount = 1;
    config.dca.minDistancePct = 2.2;
    config.exits.tp1Pct = 1.3;
    config.exits.runnerTrailMinPct = 0.80;
    config.exits.runnerTrailMaxPct = 1.80;
    config.exits.staleMinutes = 540;
    config.risk.minEntryScore = 5;
    return;
  }

  if (profile === 'aggressive') {
    config.capital.reentryCooldownMinutes = 60;
    config.value.maxPullbackPct = 5.5;
    config.confirm.closeLocation = 0.52;
    config.momentum.rsiFloor = 39;
    config.liquidity.minRelativeVolume = 0.50;
    config.dca.maxCount = 3;
    config.dca.minDistancePct = 1.25;
    config.exits.tp1Pct = 2.0;
    config.exits.runnerTrailMinPct = 1.10;
    config.exits.runnerTrailMaxPct = 3.10;
    config.exits.staleMinutes = 960;
    config.risk.minEntryScore = 4;
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeNumber(value, fallback) {
  var parsed;
  if (typeof value === 'number') {
    return isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function safeString(value, fallback) {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  if (value === true || value === false) {
    return String(value);
  }
  if (typeof value === 'number' && isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function safeBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    var lower = value.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
      return false;
    }
  }
  return fallback;
}

function activeOverrides(gb) {
  if (gb && gb.data) {
    if (gb.data.whatstrat && typeof gb.data.whatstrat === 'object' && !Array.isArray(gb.data.whatstrat)) {
      return gb.data.whatstrat;
    }
    if (gb.data.pairLedger && gb.data.pairLedger.whatstrat && typeof gb.data.pairLedger.whatstrat === 'object' && !Array.isArray(gb.data.pairLedger.whatstrat)) {
      return gb.data.pairLedger.whatstrat;
    }
  }
  return {};
}

function snapshotRuntimeData(sourceData) {
  var snapshot = {};
  var key;

  if (!sourceData || typeof sourceData !== 'object') {
    return snapshot;
  }

  for (key in sourceData) {
    if (Object.prototype.hasOwnProperty.call(sourceData, key)) {
      snapshot[key] = Array.isArray(sourceData[key]) ? sourceData[key].slice() : sourceData[key];
    }
  }

  snapshot.pairName = safeString(sourceData.pairName, '');
  snapshot.exchangeName = safeString(sourceData.exchangeName, '');
  snapshot.period = safeNumber(sourceData.period, safeNumber(snapshot.period, 0));
  snapshot.pairLedger = sourceData.pairLedger && typeof sourceData.pairLedger === 'object' ? sourceData.pairLedger : {};
  snapshot.whatstrat = deepClone(activeOverrides({ data: sourceData }));

  return snapshot;
}

function readFirstNumber(source, keys, fallback) {
  var i;
  var value;
  for (i = 0; i < keys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(source, keys[i])) {
      value = safeNumber(source[keys[i]], null);
      if (value !== null) {
        return value;
      }
    }
  }
  return fallback;
}

function readFirstBoolean(source, keys, fallback) {
  var i;
  for (i = 0; i < keys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(source, keys[i])) {
      return safeBoolean(source[keys[i]], fallback);
    }
  }
  return fallback;
}

function readFirstString(source, keys, fallback) {
  var i;
  var value;
  for (i = 0; i < keys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(source, keys[i])) {
      value = safeString(source[keys[i]], null);
      if (value !== null) {
        return value;
      }
    }
  }
  return fallback;
}

function clamp(value, minValue, maxValue) {
  if (value < minValue) {
    return minValue;
  }
  if (value > maxValue) {
    return maxValue;
  }
  return value;
}

function normalizeLogMode(value) {
  var mode = safeString(value, 'events').toLowerCase();
  if (mode === 'cycle' || mode === 'changes' || mode === 'events') {
    return mode;
  }
  return 'events';
}

function roundTo(value, decimals) {
  var factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function average(values) {
  var total = 0;
  var count = 0;
  var i;
  for (i = 0; i < values.length; i += 1) {
    if (typeof values[i] === 'number' && isFinite(values[i])) {
      total += values[i];
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

function highestFromEnd(values, lookback) {
  var start = Math.max(0, values.length - lookback);
  var highest = null;
  var i;
  for (i = start; i < values.length; i += 1) {
    if (!isFinite(values[i])) {
      continue;
    }
    if (highest === null || values[i] > highest) {
      highest = values[i];
    }
  }
  return highest === null ? 0 : highest;
}

function lowestFromEnd(values, lookback) {
  var start = Math.max(0, values.length - lookback);
  var lowest = null;
  var i;
  for (i = start; i < values.length; i += 1) {
    if (!isFinite(values[i])) {
      continue;
    }
    if (lowest === null || values[i] < lowest) {
      lowest = values[i];
    }
  }
  return lowest === null ? 0 : lowest;
}

function percentChange(fromValue, toValue) {
  if (!isFinite(fromValue) || !isFinite(toValue) || Math.abs(fromValue) < 1e-10) {
    return 0;
  }
  return ((toValue - fromValue) / fromValue) * 100;
}

function normalizeTimestampToMillis(value) {
  var numeric = safeNumber(value, 0);
  if (numeric > 1000000000000) {
    return Math.round(numeric);
  }
  if (numeric > 1000000000) {
    return Math.round(numeric * 1000);
  }
  return 0;
}

function candleProgressRatio(lastTimestamp, periodMinutes, nowTimestamp, floor) {
  var openedAt = normalizeTimestampToMillis(lastTimestamp);
  var periodMs = Math.max(1, safeNumber(periodMinutes, 0)) * 60 * 1000;
  var elapsed;

  if (!openedAt || !periodMs) {
    return 1;
  }

  elapsed = safeNumber(nowTimestamp, 0) - openedAt;
  if (elapsed <= 0) {
    return floor;
  }

  return clamp(elapsed / periodMs, floor, 1);
}

function projectSignalVolume(signalVolume, lastTimestamp, periodMinutes, nowTimestamp, config) {
  var volume = Math.max(0, safeNumber(signalVolume, 0));
  var progressRatio;

  if (!config.liquidity.projectCurrentVolume) {
    return volume;
  }

  progressRatio = candleProgressRatio(
    lastTimestamp,
    periodMinutes,
    nowTimestamp,
    config.liquidity.projectedVolumeFloor
  );

  if (progressRatio >= 1) {
    return volume;
  }

  return volume / progressRatio;
}

function buildConfig(gb) {
  var overrides = activeOverrides(gb);
  var config = deepClone(AEGIS_BASE_CONFIG);

  config.riskProfile = readFirstString(overrides, ['AEGIS_RISK_PROFILE'], config.riskProfile).toLowerCase();
  applyRiskProfile(config);

  config.enabled = readFirstBoolean(overrides, ['AEGIS_ENABLED'], config.enabled);
  config.minCandles = readFirstNumber(overrides, ['AEGIS_MIN_CANDLES'], config.minCandles);

  config.capital.tradeLimitBase = readFirstNumber(
    overrides,
    ['AEGIS_TRADE_LIMIT', 'TRADE_LIMIT', 'TRADING_LIMIT'],
    config.capital.tradeLimitBase
  );
  config.capital.fundsReserveBase = readFirstNumber(
    overrides,
    ['AEGIS_FUNDS_RESERVE', 'FUNDS_RESERVE'],
    config.capital.fundsReserveBase
  );
  config.capital.actionCooldownSeconds = readFirstNumber(
    overrides,
    ['AEGIS_ACTION_COOLDOWN_SECONDS'],
    config.capital.actionCooldownSeconds
  );
  config.capital.reentryCooldownMinutes = readFirstNumber(
    overrides,
    ['AEGIS_REENTRY_COOLDOWN_MINUTES'],
    config.capital.reentryCooldownMinutes
  );

  config.regime.htfPeriod = readFirstNumber(overrides, ['REGIME_HTF_PERIOD', 'PERIOD_MEDIUM'], config.regime.htfPeriod);
  config.regime.candleCount = readFirstNumber(overrides, ['REGIME_CANDLE_COUNT'], config.regime.candleCount);
  config.regime.emaFast = readFirstNumber(overrides, ['REGIME_EMA_FAST'], config.regime.emaFast);
  config.regime.emaSlow = readFirstNumber(overrides, ['REGIME_EMA_SLOW'], config.regime.emaSlow);
  config.regime.slopeLookback = readFirstNumber(overrides, ['REGIME_SLOPE_LOOKBACK'], config.regime.slopeLookback);
  config.regime.minSlopePct = readFirstNumber(overrides, ['REGIME_MIN_SLOPE_PCT'], config.regime.minSlopePct);
  config.regime.minSeparationPct = readFirstNumber(overrides, ['REGIME_MIN_SEPARATION_PCT'], config.regime.minSeparationPct);
  config.regime.cacheSeconds = readFirstNumber(overrides, ['REGIME_CACHE_SECONDS'], config.regime.cacheSeconds);

  config.value.emaFast = readFirstNumber(overrides, ['VALUE_EMA_FAST'], config.value.emaFast);
  config.value.emaSlow = readFirstNumber(overrides, ['VALUE_EMA_SLOW'], config.value.emaSlow);
  config.value.bandBufferPct = readFirstNumber(overrides, ['VALUE_BAND_BUFFER_PCT'], config.value.bandBufferPct);
  config.value.impulseLookback = readFirstNumber(overrides, ['VALUE_IMPULSE_LOOKBACK'], config.value.impulseLookback);
  config.value.minPullbackPct = readFirstNumber(overrides, ['VALUE_MIN_PULLBACK_PCT'], config.value.minPullbackPct);
  config.value.maxPullbackPct = readFirstNumber(overrides, ['VALUE_MAX_PULLBACK_PCT'], config.value.maxPullbackPct);

  config.confirm.wickRatio = readFirstNumber(overrides, ['RECLAIM_WICK_RATIO'], config.confirm.wickRatio);
  config.confirm.closeLocation = readFirstNumber(overrides, ['RECLAIM_CLOSE_LOCATION'], config.confirm.closeLocation);
  config.confirm.requireBullishClose = readFirstBoolean(
    overrides,
    ['RECLAIM_REQUIRE_BULLISH_CLOSE'],
    config.confirm.requireBullishClose
  );
  config.confirm.allowTwoBar = readFirstBoolean(
    overrides,
    ['RECLAIM_ALLOW_TWO_BAR'],
    config.confirm.allowTwoBar
  );

  config.momentum.rsiLength = readFirstNumber(overrides, ['MOMENTUM_RSI_LENGTH', 'RSI_LENGTH'], config.momentum.rsiLength);
  config.momentum.rsiFloor = readFirstNumber(overrides, ['MOMENTUM_RSI_FLOOR'], config.momentum.rsiFloor);
  config.momentum.rsiCeiling = readFirstNumber(overrides, ['MOMENTUM_RSI_CEILING'], config.momentum.rsiCeiling);
  config.momentum.minRsiDelta = readFirstNumber(overrides, ['MOMENTUM_MIN_RSI_DELTA'], config.momentum.minRsiDelta);

  config.liquidity.maxSpreadPct = readFirstNumber(overrides, ['MAX_SPREAD_PCT'], config.liquidity.maxSpreadPct);
  config.liquidity.minRelativeVolume = readFirstNumber(overrides, ['MIN_RELATIVE_VOLUME'], config.liquidity.minRelativeVolume);
  config.liquidity.volumeLookback = readFirstNumber(overrides, ['VOLUME_LOOKBACK'], config.liquidity.volumeLookback);
  config.liquidity.maxSignalRangePct = readFirstNumber(overrides, ['MAX_SIGNAL_RANGE_PCT'], config.liquidity.maxSignalRangePct);
  config.liquidity.projectCurrentVolume = readFirstBoolean(
    overrides,
    ['PROJECT_CURRENT_VOLUME'],
    config.liquidity.projectCurrentVolume
  );
  config.liquidity.projectedVolumeFloor = readFirstNumber(
    overrides,
    ['PROJECTED_VOLUME_FLOOR'],
    config.liquidity.projectedVolumeFloor
  );

  config.risk.minEntryScore = readFirstNumber(overrides, ['MIN_ENTRY_SCORE'], config.risk.minEntryScore);
  config.risk.closeOnlyEntry = readFirstBoolean(overrides, ['AEGIS_CLOSE_ONLY_ENTRY'], config.risk.closeOnlyEntry);
  config.risk.closeOnlyEntryProgress = readFirstNumber(
    overrides,
    ['AEGIS_CLOSE_ONLY_ENTRY_PROGRESS'],
    config.risk.closeOnlyEntryProgress
  );
  config.risk.useBuyEnabled = readFirstBoolean(overrides, ['AEGIS_USE_BUY_ENABLED'], config.risk.useBuyEnabled);
  config.risk.useSellEnabled = readFirstBoolean(overrides, ['AEGIS_USE_SELL_ENABLED'], config.risk.useSellEnabled);

  config.dca.maxCount = readFirstNumber(overrides, ['MAX_DCA_COUNT'], config.dca.maxCount);
  config.dca.minDistancePct = readFirstNumber(overrides, ['MIN_DCA_DISTANCE_PCT'], config.dca.minDistancePct);
  config.dca.sizeMultiplier = readFirstNumber(overrides, ['DCA_SIZE_MULTIPLIER'], config.dca.sizeMultiplier);
  config.dca.maxDepthFromBreakEvenPct = readFirstNumber(
    overrides,
    ['MAX_DCA_DEPTH_PCT'],
    config.dca.maxDepthFromBreakEvenPct
  );
  config.dca.requireReclaim = readFirstBoolean(overrides, ['DCA_REQUIRE_RECLAIM'], config.dca.requireReclaim);

  config.exits.tp1Pct = readFirstNumber(overrides, ['TP1_PCT'], config.exits.tp1Pct);
  config.exits.tp1SellRatio = readFirstNumber(overrides, ['TP1_SELL_RATIO'], config.exits.tp1SellRatio);
  config.exits.runnerTrailMinPct = readFirstNumber(overrides, ['RUNNER_TRAIL_MIN_PCT'], config.exits.runnerTrailMinPct);
  config.exits.runnerTrailMaxPct = readFirstNumber(overrides, ['RUNNER_TRAIL_MAX_PCT'], config.exits.runnerTrailMaxPct);
  config.exits.runnerTrailAtrMult = readFirstNumber(overrides, ['RUNNER_TRAIL_ATR_MULT'], config.exits.runnerTrailAtrMult);
  config.exits.invalidationAtrMult = readFirstNumber(overrides, ['INVALIDATION_ATR_MULT'], config.exits.invalidationAtrMult);
  config.exits.invalidationLookback = readFirstNumber(overrides, ['INVALIDATION_LOOKBACK'], config.exits.invalidationLookback);
  config.exits.invalidationBufferPct = readFirstNumber(overrides, ['INVALIDATION_BUFFER_PCT'], config.exits.invalidationBufferPct);
  config.exits.staleMinutes = readFirstNumber(overrides, ['STALE_EXIT_MINUTES'], config.exits.staleMinutes);
  config.exits.staleMaxProfitPct = readFirstNumber(
    overrides,
    ['STALE_EXIT_MAX_PROFIT_PCT'],
    config.exits.staleMaxProfitPct
  );

  config.visuals.enableCharts = readFirstBoolean(
    overrides,
    ['ENABLE_CHARTS'],
    config.visuals.enableCharts
  );
  config.visuals.enableShapes = readFirstBoolean(
    overrides,
    ['ENABLE_CHART_SHAPES', 'DISPLAY_CHART_SHAPES'],
    config.visuals.enableShapes
  );

  config.telemetry.enableNotifications = readFirstBoolean(
    overrides,
    ['ENABLE_NOTIFICATIONS'],
    config.telemetry.enableNotifications
  );
  config.telemetry.enableDebugLogs = readFirstBoolean(
    overrides,
    ['ENABLE_DEBUG_LOGS', 'VERBOSE'],
    config.telemetry.enableDebugLogs
  );
  config.telemetry.logMode = normalizeLogMode(
    readFirstString(overrides, ['AEGIS_LOG_MODE'], config.telemetry.logMode)
  );

  config.capital.tradeLimitBase = Math.max(0, config.capital.tradeLimitBase);
  config.capital.fundsReserveBase = Math.max(0, config.capital.fundsReserveBase);
  config.capital.actionCooldownSeconds = Math.max(1, config.capital.actionCooldownSeconds);
  config.capital.reentryCooldownMinutes = Math.max(0, config.capital.reentryCooldownMinutes);
  config.regime.htfPeriod = Math.max(5, config.regime.htfPeriod);
  config.regime.candleCount = Math.max(50, config.regime.candleCount);
  config.regime.emaFast = Math.max(2, config.regime.emaFast);
  config.regime.emaSlow = Math.max(config.regime.emaFast + 1, config.regime.emaSlow);
  config.value.emaFast = Math.max(2, config.value.emaFast);
  config.value.emaSlow = Math.max(config.value.emaFast + 1, config.value.emaSlow);
  config.value.impulseLookback = Math.max(4, config.value.impulseLookback);
  config.confirm.wickRatio = clamp(config.confirm.wickRatio, 0.05, 0.95);
  config.confirm.closeLocation = clamp(config.confirm.closeLocation, 0.10, 0.95);
  config.momentum.rsiLength = Math.max(2, config.momentum.rsiLength);
  config.liquidity.volumeLookback = Math.max(3, config.liquidity.volumeLookback);
  config.liquidity.projectedVolumeFloor = clamp(config.liquidity.projectedVolumeFloor, 0.10, 1.0);
  config.risk.minEntryScore = clamp(config.risk.minEntryScore, 1, 5);
  config.risk.closeOnlyEntryProgress = clamp(config.risk.closeOnlyEntryProgress, 0.50, 1.0);
  config.dca.maxCount = Math.max(0, Math.floor(config.dca.maxCount));
  config.dca.sizeMultiplier = clamp(config.dca.sizeMultiplier, 0.25, 3.0);
  config.exits.tp1SellRatio = clamp(config.exits.tp1SellRatio, 0.05, 1.0);

  return config;
}

function resolveGb(runtimeGb) {
  var runtime;

  if (runtimeGb && runtimeGb.data && runtimeGb.method) {
    runtime = runtimeGb;
  } else if (typeof globalThis !== 'undefined' && globalThis.gb && globalThis.gb.data && globalThis.gb.method) {
    runtime = globalThis.gb;
  } else if (typeof global !== 'undefined' && global.gb && global.gb.data && global.gb.method) {
    runtime = global.gb;
  } else {
    throw new Error('Aegis could not resolve the Gunbot runtime object.');
  }

  return {
    data: snapshotRuntimeData(runtime.data),
    method: runtime.method
  };
}

function isExpectedStrategyFile(gb, expectedName) {
  var actual = safeString(activeOverrides(gb).STRAT_FILENAME, '');

  return actual.toLowerCase() === String(expectedName || '').toLowerCase();
}

function ensureState(gb) {
  var pairLedger = gb.data.pairLedger || {};
  if (!pairLedger.customStratStore || typeof pairLedger.customStratStore !== 'object' || Array.isArray(pairLedger.customStratStore)) {
    pairLedger.customStratStore = {};
  }
  if (!pairLedger.customStratStore.aegis || typeof pairLedger.customStratStore.aegis !== 'object' || Array.isArray(pairLedger.customStratStore.aegis)) {
    pairLedger.customStratStore.aegis = {};
  }

  var state = pairLedger.customStratStore.aegis;
  if (!state.notificationKeys || typeof state.notificationKeys !== 'object') {
    state.notificationKeys = {};
  }

  if (!state.htfMetrics || typeof state.htfMetrics !== 'object') {
    state.htfMetrics = {};
  }

  state.metaVersion = AEGIS_META.version;
  if (typeof state.phase !== 'string') {
    state.phase = 'flat';
  }
  if (typeof state.dcaCount !== 'number') {
    state.dcaCount = 0;
  }
  if (typeof state.tp1Done !== 'boolean') {
    state.tp1Done = false;
  }
  if (typeof state.trailPeak !== 'number') {
    state.trailPeak = 0;
  }
  if (typeof state.trailStop !== 'number') {
    state.trailStop = 0;
  }
  if (typeof state.lastActionAt !== 'number') {
    state.lastActionAt = 0;
  }
  if (typeof state.lastFillPrice !== 'number') {
    state.lastFillPrice = 0;
  }
  if (typeof state.entryTime !== 'number') {
    state.entryTime = 0;
  }
  if (typeof state.cooldownUntil !== 'number') {
    state.cooldownUntil = 0;
  }
  if (typeof state.needsReset !== 'boolean') {
    state.needsReset = false;
  }
  if (typeof state.lastRegimePass !== 'boolean') {
    state.lastRegimePass = false;
  }
  if (typeof state.lastSetupArmed !== 'boolean') {
    state.lastSetupArmed = false;
  }
  if (typeof state.lastSkipReason !== 'string') {
    state.lastSkipReason = '';
  }
  if (typeof state.lastEntryScore !== 'number') {
    state.lastEntryScore = 0;
  }
  if (typeof state.hadBagLastCycle !== 'boolean') {
    state.hadBagLastCycle = false;
  }
  if (typeof state.initialPositionSize !== 'number') {
    state.initialPositionSize = 0;
  }
  if (typeof state.lastActionLabel !== 'string') {
    state.lastActionLabel = '';
  }
  if (typeof state.lastErrorKey !== 'string') {
    state.lastErrorKey = '';
  }
  if (typeof state.lastCycleSummaryKey !== 'string') {
    state.lastCycleSummaryKey = '';
  }
  if (typeof state.lastNotificationPruneAt !== 'number') {
    state.lastNotificationPruneAt = 0;
  }

  gb.data.pairLedger = pairLedger;
  return state;
}

function logPrefix(gb) {
  return '[' + AEGIS_META.name + ' ' + AEGIS_META.version + '][' + String(gb.data.exchangeName || '') + '][' + String(gb.data.pairName || '') + ']';
}

function logInfo(gb, code, message) {
  console.log(logPrefix(gb) + '[INFO][' + code + '] ' + message);
}

function logWarn(gb, code, message) {
  console.log(logPrefix(gb) + '[WARN][' + code + '] ' + message);
}

function logDebug(gb, config, code, message) {
  if (!config.telemetry.enableDebugLogs) {
    return;
  }
  console.log(logPrefix(gb) + '[DEBUG][' + code + '] ' + message);
}

function logError(gb, code, message, err) {
  var extra = err && err.stack ? ' ' + err.stack : '';
  console.error(logPrefix(gb) + '[ERROR][' + code + '] ' + message + extra);
}

function formatPrice(value) {
  if (!isFinite(value)) {
    return '--';
  }
  if (Math.abs(value) >= 1000) {
    return roundTo(value, 2).toFixed(2);
  }
  if (Math.abs(value) >= 1) {
    return roundTo(value, 4).toFixed(4);
  }
  return roundTo(value, 8).toFixed(8);
}

function formatPercent(value) {
  if (!isFinite(value)) {
    return '--';
  }
  return roundTo(value, 2).toFixed(2) + '%';
}

function formatScore(value, maxValue) {
  return String(value) + '/' + String(maxValue);
}

function statusColor(isGood, neutral) {
  if (neutral) {
    return AEGIS_COLORS.neutral;
  }
  return isGood ? AEGIS_COLORS.good : AEGIS_COLORS.bad;
}

function quoteAmountToBaseValue(amountQuote, price) {
  var quoteAmount = safeNumber(amountQuote, 0);
  var marketPrice = safeNumber(price, 0);
  if (quoteAmount <= 0 || marketPrice <= 0) {
    return 0;
  }
  return quoteAmount * marketPrice;
}

function buyReferencePrice(frameMetrics) {
  var ask = safeNumber(frameMetrics && frameMetrics.ask, 0);
  var bid = safeNumber(frameMetrics && frameMetrics.bid, 0);

  return ask > 0 ? ask : bid;
}

function safeArrayValues(series) {
  var normalized = [];
  var i;
  var value;
  if (!series || !series.length) {
    return normalized;
  }
  for (i = 0; i < series.length; i += 1) {
    value = series[i];
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
      normalized.push(safeNumber(value.value, NaN));
    } else {
      normalized.push(safeNumber(value, NaN));
    }
  }
  return normalized;
}

function safeArrayTimestamps(series) {
  var normalized = [];
  var i;
  var value;
  if (!series || !series.length) {
    return normalized;
  }
  for (i = 0; i < series.length; i += 1) {
    value = series[i];
    if (value && typeof value === 'object') {
      if (Object.prototype.hasOwnProperty.call(value, 'timestamp')) {
        normalized.push(safeNumber(value.timestamp, NaN));
      } else if (Object.prototype.hasOwnProperty.call(value, 'time')) {
        normalized.push(safeNumber(value.time, NaN));
      } else if (Object.prototype.hasOwnProperty.call(value, 'value')) {
        normalized.push(safeNumber(value.value, NaN));
      }
    } else {
      normalized.push(safeNumber(value, NaN));
    }
  }
  return normalized;
}

function normalizeTimestampToSeconds(value) {
  var numeric = safeNumber(value, 0);
  if (numeric > 1000000000000) {
    return Math.round(numeric / 1000);
  }
  if (numeric > 1000000000) {
    return Math.round(numeric);
  }
  return 0;
}

function normalizeLocalCandles(gb) {
  var open = safeArrayValues(gb.data.candlesOpen || []);
  var high = safeArrayValues(gb.data.candlesHigh || []);
  var low = safeArrayValues(gb.data.candlesLow || []);
  var close = safeArrayValues(gb.data.candlesClose || []);
  var volume = safeArrayValues(gb.data.candlesVolume || []);
  var timestamp = safeArrayTimestamps(gb.data.candlesTimestamp || []);
  var size = Math.min(open.length, high.length, low.length, close.length, volume.length);

  if (timestamp.length > 0) {
    size = Math.min(size, timestamp.length);
  }

  if (!size) {
    return null;
  }

  return {
    open: open.slice(open.length - size),
    high: high.slice(high.length - size),
    low: low.slice(low.length - size),
    close: close.slice(close.length - size),
    volume: volume.slice(volume.length - size),
    timestamp: timestamp.length ? timestamp.slice(timestamp.length - size) : []
  };
}

function normalizeFetchedCandles(rawCandles) {
  if (!rawCandles || typeof rawCandles !== 'object') {
    return null;
  }

  var open = safeArrayValues(rawCandles.open || []);
  var high = safeArrayValues(rawCandles.high || []);
  var low = safeArrayValues(rawCandles.low || []);
  var close = safeArrayValues(rawCandles.close || []);
  var volume = safeArrayValues(rawCandles.volume || []);
  var timestamp = safeArrayTimestamps(rawCandles.timestamp || []);
  var size = Math.min(open.length, high.length, low.length, close.length, volume.length);

  if (timestamp.length > 0) {
    size = Math.min(size, timestamp.length);
  }

  if (!size) {
    return null;
  }

  return {
    open: open.slice(open.length - size),
    high: high.slice(high.length - size),
    low: low.slice(low.length - size),
    close: close.slice(close.length - size),
    volume: volume.slice(volume.length - size),
    timestamp: timestamp.length ? timestamp.slice(timestamp.length - size) : []
  };
}

function calculateEMA(values, period) {
  var result = [];
  var i;
  var multiplier;
  var previous;
  var seedTotal = 0;

  if (!values || values.length < period) {
    return result;
  }

  result.length = values.length;
  for (i = 0; i < (period - 1); i += 1) {
    seedTotal += values[i];
    result[i] = NaN;
  }
  seedTotal += values[period - 1];
  previous = seedTotal / period;
  result[period - 1] = previous;
  multiplier = 2 / (period + 1);
  for (i = period; i < values.length; i += 1) {
    previous = ((values[i] - previous) * multiplier) + previous;
    result[i] = previous;
  }
  return result;
}

function calculateRSI(values, period) {
  var result = [];
  var gains = 0;
  var losses = 0;
  var avgGain;
  var avgLoss;
  var delta;
  var gain;
  var loss;
  var i;

  if (!values || values.length <= period) {
    return result;
  }

  result.length = values.length;
  for (i = 1; i <= period; i += 1) {
    delta = values[i] - values[i - 1];
    gains += delta > 0 ? delta : 0;
    losses += delta < 0 ? Math.abs(delta) : 0;
  }

  avgGain = gains / period;
  avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));

  for (i = period + 1; i < values.length; i += 1) {
    delta = values[i] - values[i - 1];
    gain = delta > 0 ? delta : 0;
    loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
  }

  return result;
}

function calculateATR(high, low, close, period) {
  var tr = [];
  var result = [];
  var i;
  var atr = 0;
  if (!high || !low || !close || high.length !== low.length || high.length !== close.length || high.length === 0) {
    return result;
  }

  tr.push(high[0] - low[0]);
  for (i = 1; i < high.length; i += 1) {
    tr.push(
      Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      )
    );
  }

  if (tr.length < period) {
    return result;
  }

  atr = average(tr.slice(0, period));
  result.length = tr.length;
  result[period - 1] = atr;

  for (i = period; i < tr.length; i += 1) {
    atr = ((atr * (period - 1)) + tr[i]) / period;
    result[i] = atr;
  }

  return result;
}

function lastDefined(series) {
  var i;
  if (!series) {
    return null;
  }
  for (i = series.length - 1; i >= 0; i -= 1) {
    if (typeof series[i] === 'number' && isFinite(series[i])) {
      return series[i];
    }
  }
  return null;
}

function previousDefined(series) {
  var found = false;
  var i;
  if (!series) {
    return null;
  }
  for (i = series.length - 1; i >= 0; i -= 1) {
    if (typeof series[i] === 'number' && isFinite(series[i])) {
      if (found) {
        return series[i];
      }
      found = true;
    }
  }
  return null;
}

function analyzeHigherTimeframe(candles, config) {
  var close = candles ? candles.close : [];
  var fastSeries;
  var slowSeries;
  var lastIndex;
  var slopeReferenceIndex;
  var fastLast;
  var slowLast;
  var closeLast;
  var slopePct;
  var separationPct;
  var aboveBaseline;
  var aligned;
  var slopeOk;
  var separationOk;
  var score;

  if (!candles || !close || close.length < Math.max(config.regime.emaSlow + 5, config.regime.slopeLookback + 5)) {
    return {
      ready: false,
      pass: false,
      score: 0,
      close: 0,
      fast: 0,
      slow: 0,
      slopePct: 0,
      separationPct: 0,
      reason: 'htf-data-short'
    };
  }

  fastSeries = calculateEMA(close, config.regime.emaFast);
  slowSeries = calculateEMA(close, config.regime.emaSlow);
  lastIndex = close.length - 1;
  slopeReferenceIndex = Math.max(0, lastIndex - config.regime.slopeLookback);
  fastLast = fastSeries[lastIndex];
  slowLast = slowSeries[lastIndex];
  closeLast = close[lastIndex];
  slopePct = percentChange(fastSeries[slopeReferenceIndex], fastLast);
  separationPct = percentChange(slowLast, fastLast);
  aboveBaseline = closeLast > slowLast;
  aligned = fastLast > slowLast;
  slopeOk = slopePct >= config.regime.minSlopePct;
  separationOk = separationPct >= config.regime.minSeparationPct;
  score = (aboveBaseline ? 1 : 0) + (aligned ? 1 : 0) + (slopeOk ? 1 : 0) + (separationOk ? 1 : 0);

  return {
    ready: true,
    pass: aboveBaseline && aligned && (slopeOk || separationOk),
    score: score,
    close: closeLast,
    fast: fastLast,
    slow: slowLast,
    slopePct: slopePct,
    separationPct: separationPct,
    aboveBaseline: aboveBaseline,
    aligned: aligned,
    slopeOk: slopeOk,
    separationOk: separationOk,
    reason: aboveBaseline && aligned && (slopeOk || separationOk) ? 'regime-pass' : 'regime-fail'
  };
}

async function getHigherTimeframeMetrics(gb, state, config) {
  var now = Date.now();
  var cached = state.htfMetrics || {};
  var isFresh = cached.fetchedAt && ((now - cached.fetchedAt) < (config.regime.cacheSeconds * 1000));
  var raw;
  var normalized;
  var metrics;

  if (isFresh && cached.ready) {
    return cached;
  }

  try {
    raw = await gb.method.getCandles(
      config.regime.candleCount,
      config.regime.htfPeriod,
      gb.data.pairName,
      gb.data.exchangeName
    );
    normalized = normalizeFetchedCandles(raw);
    metrics = analyzeHigherTimeframe(normalized, config);
    metrics.fetchedAt = now;
    metrics.period = config.regime.htfPeriod;
    state.htfMetrics = metrics;
    return metrics;
  } catch (err) {
    if (cached && cached.ready) {
      cached.stale = true;
      cached.fetchError = String(err && err.message ? err.message : err);
      return cached;
    }
    return {
      ready: false,
      pass: false,
      score: 0,
      close: 0,
      fast: 0,
      slow: 0,
      slopePct: 0,
      separationPct: 0,
      reason: 'htf-fetch-failed',
      fetchError: String(err && err.message ? err.message : err)
    };
  }
}

function buildValueReason(valueBias, touchedBand, pullbackPct, config) {
  if (pullbackPct < config.value.minPullbackPct) {
    return 'pullback-too-shallow';
  }
  if (pullbackPct > config.value.maxPullbackPct) {
    return 'pullback-too-deep';
  }
  if (valueBias === 'above-band' && !touchedBand) {
    return 'above-value-band';
  }
  if (valueBias === 'below-band' && !touchedBand) {
    return 'below-value-band';
  }
  return 'value-zone-miss';
}

function buildConfirmReason(reclaimFast, closeLocation, wickRatio, bullishClose, signalClose, previousClose, config) {
  if (!reclaimFast) {
    return 'below-reclaim-trigger';
  }
  if (closeLocation < config.confirm.closeLocation) {
    return 'weak-close-location';
  }
  if (wickRatio < config.confirm.wickRatio) {
    return 'weak-lower-wick';
  }
  if (config.confirm.requireBullishClose && !bullishClose) {
    return 'bearish-signal-close';
  }
  if (signalClose <= previousClose) {
    return 'no-close-improvement';
  }
  return 'reclaim-miss';
}

function buildMomentumReason(rsiLast, rsiDelta, config) {
  if (rsiLast === null) {
    return 'rsi-unavailable';
  }
  if (rsiLast < config.momentum.rsiFloor) {
    return 'rsi-below-floor';
  }
  if (rsiLast > config.momentum.rsiCeiling) {
    return 'rsi-overheated';
  }
  if (rsiDelta < config.momentum.minRsiDelta) {
    return 'rsi-delta-weak';
  }
  return 'momentum-miss';
}

function buildLiquidityReason(bid, ask, spreadPct, relativeVolume, signalRangePct, config) {
  if (bid <= 0 || ask <= 0) {
    return 'market-price-missing';
  }
  if (spreadPct > config.liquidity.maxSpreadPct) {
    return 'spread-too-wide';
  }
  if (relativeVolume < config.liquidity.minRelativeVolume) {
    return 'volume-too-light';
  }
  if (signalRangePct > config.liquidity.maxSignalRangePct) {
    return 'signal-range-too-wide';
  }
  return 'liquidity-miss';
}

function analyzeCurrentFrame(gb, config, state, hasBag) {
  var candles = normalizeLocalCandles(gb);
  var close;
  var high;
  var low;
  var open;
  var volume;
  var timestamps;
  var lastIndex;
  var previousIndex;
  var fastEmaSeries;
  var slowEmaSeries;
  var rsiSeries;
  var atrSeries;
  var bid;
  var ask;
  var currentPeriodMinutes;
  var fastLast;
  var slowLast;
  var rsiLast;
  var rsiPrev;
  var atrLast;
  var signalOpen;
  var signalHigh;
  var signalLow;
  var signalClose;
  var signalVolume;
  var completedSignalVolume;
  var effectiveSignalVolume;
  var previousClose;
  var previousOpen;
  var previousHigh;
  var previousLow;
  var range;
  var wickRatio;
  var closeLocation;
  var previousRange;
  var previousWickRatio;
  var pullbackHigh;
  var pullbackPct;
  var bandTop;
  var bandBottom;
  var bandMid;
  var inBand;
  var touchedBand;
  var valueBias;
  var valueOk;
  var valueReason;
  var reclaimFast;
  var bullishClose;
  var singleBarReclaim;
  var twoBarReclaim;
  var reclaimOk;
  var confirmReason;
  var rsiDelta;
  var momentumOk;
  var momentumReason;
  var avgVolume;
  var projectedSignalVolume;
  var volumeProgressRatio;
  var relativeVolume;
  var spreadPct;
  var signalRangePct;
  var liquidityOk;
  var liquidityReason;
  var invalidationBase;
  var invalidationEma;
  var invalidationPrice;
  var dcaTarget;
  var entryTarget;
  var tp1Price;
  var trailPct;
  var score;

  if (!candles) {
    return {
      ready: false,
      reason: 'no-candles'
    };
  }

  close = candles.close;
  high = candles.high;
  low = candles.low;
  open = candles.open;
  volume = candles.volume;
  timestamps = candles.timestamp;

  if (close.length < config.minCandles) {
    return {
      ready: false,
      reason: 'insufficient-candles'
    };
  }

  lastIndex = close.length - 1;
  previousIndex = Math.max(0, lastIndex - 1);
  currentPeriodMinutes = safeNumber(gb.data.period, 15);
  fastEmaSeries = calculateEMA(close, config.value.emaFast);
  slowEmaSeries = calculateEMA(close, config.value.emaSlow);
  rsiSeries = calculateRSI(close, config.momentum.rsiLength);
  atrSeries = calculateATR(high, low, close, 14);
  bid = safeNumber(gb.data.bid, close[lastIndex]);
  ask = safeNumber(gb.data.ask, bid);
  fastLast = fastEmaSeries[lastIndex];
  slowLast = slowEmaSeries[lastIndex];
  rsiLast = lastDefined(rsiSeries);
  rsiPrev = previousDefined(rsiSeries);
  atrLast = lastDefined(atrSeries);
  signalOpen = open[lastIndex];
  signalHigh = high[lastIndex];
  signalLow = low[lastIndex];
  signalClose = close[lastIndex];
  signalVolume = volume[lastIndex];
  completedSignalVolume = volume[previousIndex];
  previousClose = close[previousIndex];
  previousOpen = open[previousIndex];
  previousHigh = high[previousIndex];
  previousLow = low[previousIndex];
  range = Math.max(0, signalHigh - signalLow);
  wickRatio = range > 0 ? (Math.min(signalOpen, signalClose) - signalLow) / range : 0;
  closeLocation = range > 0 ? (signalClose - signalLow) / range : 0.5;
  previousRange = Math.max(0, previousHigh - previousLow);
  previousWickRatio = previousRange > 0 ? (Math.min(previousOpen, previousClose) - previousLow) / previousRange : 0;
  pullbackHigh = (highestFromEnd(high, config.value.impulseLookback) + highestFromEnd(close, config.value.impulseLookback)) / 2;
  pullbackPct = pullbackHigh > 0 ? ((pullbackHigh - bid) / pullbackHigh) * 100 : 0;
  bandTop = Math.max(fastLast, slowLast) * (1 + (config.value.bandBufferPct / 100));
  bandBottom = Math.min(fastLast, slowLast) * (1 - (config.value.bandBufferPct / 100));
  bandMid = (bandTop + bandBottom) / 2;
  inBand = bid <= bandTop && bid >= bandBottom;
  touchedBand = signalLow <= bandTop && signalHigh >= bandBottom;
  valueBias = inBand ? 'inside-band' : (bid > bandTop ? 'above-band' : 'below-band');
  valueOk = (inBand || touchedBand) &&
    pullbackPct >= config.value.minPullbackPct &&
    pullbackPct <= config.value.maxPullbackPct;
  valueReason = valueOk ? 'value-ok' : buildValueReason(valueBias, touchedBand, pullbackPct, config);
  // The reclaim should be keyed to the candle close versus the fast baseline.
  // Requiring the live bid to remain above the line after the close makes
  // close-confirmed setups fail on tiny post-close wobble.
  reclaimFast = signalClose > fastLast;
  bullishClose = signalClose > signalOpen;
  singleBarReclaim = reclaimFast &&
    closeLocation >= config.confirm.closeLocation &&
    wickRatio >= config.confirm.wickRatio &&
    (!config.confirm.requireBullishClose || bullishClose) &&
    signalClose > previousClose;
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
  confirmReason = reclaimOk
    ? (twoBarReclaim && !singleBarReclaim ? 'reclaim-two-bar' : 'reclaim-ok')
    : buildConfirmReason(reclaimFast, closeLocation, wickRatio, bullishClose, signalClose, previousClose, config);
  rsiDelta = (rsiLast !== null && rsiPrev !== null) ? (rsiLast - rsiPrev) : 0;
  momentumOk = rsiLast !== null &&
    rsiLast >= config.momentum.rsiFloor &&
    rsiLast <= config.momentum.rsiCeiling &&
    rsiDelta >= config.momentum.minRsiDelta;
  momentumReason = momentumOk ? 'momentum-ok' : buildMomentumReason(rsiLast, rsiDelta, config);
  avgVolume = average(volume.slice(Math.max(0, volume.length - config.liquidity.volumeLookback - 1), volume.length - 1));
  volumeProgressRatio = candleProgressRatio(
    timestamps[lastIndex],
    currentPeriodMinutes,
    Date.now(),
    config.liquidity.projectedVolumeFloor
  );
  projectedSignalVolume = projectSignalVolume(
    signalVolume,
    timestamps[lastIndex],
    currentPeriodMinutes,
    Date.now(),
    config
  );
  effectiveSignalVolume = Math.max(projectedSignalVolume, Math.max(0, safeNumber(completedSignalVolume, 0)));
  relativeVolume = avgVolume > 0 ? effectiveSignalVolume / avgVolume : 1;
  spreadPct = bid > 0 ? ((ask - bid) / bid) * 100 : 999;
  signalRangePct = bid > 0 ? (range / bid) * 100 : 0;
  liquidityOk = spreadPct <= config.liquidity.maxSpreadPct &&
    relativeVolume >= config.liquidity.minRelativeVolume &&
    signalRangePct <= config.liquidity.maxSignalRangePct;
  liquidityReason = liquidityOk
    ? 'liquidity-ok'
    : buildLiquidityReason(bid, ask, spreadPct, relativeVolume, signalRangePct, config);

  invalidationEma = (atrLast !== null && slowLast) ? (slowLast - (atrLast * config.exits.invalidationAtrMult)) : slowLast;
  invalidationBase = Math.min(
    lowestFromEnd(low, config.exits.invalidationLookback),
    invalidationEma
  );
  invalidationPrice = invalidationBase > 0
    ? invalidationBase * (1 - (config.exits.invalidationBufferPct / 100))
    : 0;

  dcaTarget = state.lastFillPrice > 0
    ? state.lastFillPrice * (1 - (config.dca.minDistancePct / 100))
    : 0;
  entryTarget = Math.max(fastLast, signalClose);
  tp1Price = 0;
  if (hasBag && safeNumber(gb.data.breakEven, 0) > 0) {
    tp1Price = safeNumber(gb.data.breakEven, 0) * (1 + (config.exits.tp1Pct / 100));
  } else {
    tp1Price = entryTarget * (1 + (config.exits.tp1Pct / 100));
  }
  trailPct = atrLast !== null && bid > 0
    ? clamp((atrLast / bid) * 100 * config.exits.runnerTrailAtrMult, config.exits.runnerTrailMinPct, config.exits.runnerTrailMaxPct)
    : config.exits.runnerTrailMinPct;

  score = (valueOk ? 1 : 0) +
    (reclaimOk ? 1 : 0) +
    (momentumOk ? 1 : 0) +
    (liquidityOk ? 1 : 0);

  return {
    ready: true,
    candles: candles,
    currentPeriodMinutes: currentPeriodMinutes,
    bid: bid,
    ask: ask,
    fastEma: fastLast,
    slowEma: slowLast,
    rsi: rsiLast === null ? 0 : rsiLast,
    rsiDelta: rsiDelta,
    atr: atrLast === null ? 0 : atrLast,
    value: {
      ok: valueOk,
      bandTop: bandTop,
      bandBottom: bandBottom,
      bandMid: bandMid,
      bias: valueBias,
      inBand: inBand,
      touchedBand: touchedBand,
      pullbackPct: pullbackPct,
      reason: valueReason
    },
    confirm: {
      ok: reclaimOk,
      triggerPrice: fastLast,
      reclaimFast: reclaimFast,
      wickRatio: wickRatio,
      closeLocation: closeLocation,
      bullishClose: bullishClose,
      reason: confirmReason
    },
    momentum: {
      ok: momentumOk,
      reason: momentumReason
    },
    liquidity: {
      ok: liquidityOk,
      spreadPct: spreadPct,
      avgVolume: avgVolume,
      signalVolume: signalVolume,
      completedSignalVolume: completedSignalVolume,
      effectiveSignalVolume: effectiveSignalVolume,
      projectedSignalVolume: projectedSignalVolume,
      volumeProgressRatio: volumeProgressRatio,
      relativeVolume: relativeVolume,
      signalRangePct: signalRangePct,
      reason: liquidityReason
    },
    entryProgressRatio: volumeProgressRatio,
    invalidationPrice: invalidationPrice,
    dcaTarget: dcaTarget,
    entryTarget: entryTarget,
    tp1Price: tp1Price,
    trailPct: trailPct,
    score: score,
    scoreMax: 4,
    lastTimestamp: timestamps.length ? timestamps[timestamps.length - 1] : 0
  };
}

function buildCompositeScore(regimeMetrics, frameMetrics) {
  return (regimeMetrics.pass ? 1 : 0) + frameMetrics.score;
}

function canUseBuyToggle(gb, config) {
  if (!config.risk.useBuyEnabled) {
    return true;
  }
  return safeBoolean(activeOverrides(gb).BUY_ENABLED, true);
}

function canUseSellToggle(gb, config) {
  if (!config.risk.useSellEnabled) {
    return true;
  }
  return safeBoolean(activeOverrides(gb).SELL_ENABLED, true);
}

function minBaseVolumeToBuy(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).MIN_VOLUME_TO_BUY, 0));
}

function minBaseVolumeToSell(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).MIN_VOLUME_TO_SELL, 0));
}

function availableBaseForBuys(gb, config) {
  return Math.max(0, safeNumber(gb.data.baseBalance, 0) - config.capital.fundsReserveBase);
}

function hasUsableBag(gb) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var minSellBaseValue = minBaseVolumeToSell(gb);
  var bid = Math.max(
    safeNumber(gb.data.bid, 0),
    safeNumber(gb.data.ask, 0),
    safeNumber(gb.data.breakEven, 0)
  );
  var positionValueBase = quoteAmountToBaseValue(quoteBalance, bid);
  if (safeBoolean(gb.data.gotBag, false)) {
    return true;
  }
  return quoteBalance > 0 && (minSellBaseValue === 0 || positionValueBase >= minSellBaseValue);
}

function normalizeRecoveredEntryTime(rawValue) {
  var whenBought = safeNumber(rawValue, 0);
  if (whenBought > 1000000000 && whenBought < 1000000000000) {
    return Math.round(whenBought * 1000);
  }
  if (whenBought >= 1000000000000) {
    return Math.round(whenBought);
  }
  return 0;
}

function latestOrderTimestamp(gb, type) {
  var orders = gb && gb.data && Array.isArray(gb.data.orders) ? gb.data.orders : [];
  var pairName = gb && gb.data ? safeString(gb.data.pairName, '') : '';
  var latest = 0;
  var i;
  var order;
  var orderTime;

  for (i = 0; i < orders.length; i += 1) {
    order = orders[i];
    if (!order || safeString(order.pair, '') !== pairName || safeString(order.type, '').toLowerCase() !== type) {
      continue;
    }
    orderTime = safeNumber(order.time, 0);
    if (orderTime > latest) {
      latest = orderTime;
    }
  }

  return latest;
}

function recoveredBagEntryTime(gb) {
  var latestBuy = latestOrderTimestamp(gb, 'buy');
  var latestSell = latestOrderTimestamp(gb, 'sell');
  var whenBought = normalizeRecoveredEntryTime(gb && gb.data && gb.data.pairLedger ? gb.data.pairLedger.whenwebought : 0);

  if (latestBuy > 0 && latestBuy >= latestSell) {
    return latestBuy;
  }
  if (whenBought > 0 && whenBought >= latestSell) {
    return whenBought;
  }
  return latestBuy > 0 ? latestBuy : whenBought;
}

function updateBagRecovery(gb, state, runtime, hasBag) {
  var recoveredEntryTime = recoveredBagEntryTime(gb);
  if (hasBag) {
    if (state.entryTime <= 0) {
      if (recoveredEntryTime > 0) {
        state.entryTime = recoveredEntryTime;
      } else {
        state.entryTime = runtime.now;
      }
    } else if (state.phase === 'entry-pending' && recoveredEntryTime > state.entryTime) {
      state.entryTime = recoveredEntryTime;
    }
    if (state.lastFillPrice <= 0) {
      state.lastFillPrice = Math.max(safeNumber(gb.data.breakEven, 0), safeNumber(gb.data.bid, 0));
    }
    if (state.initialPositionSize <= 0) {
      state.initialPositionSize = safeNumber(gb.data.quoteBalance, 0);
    }
    if (state.phase === 'flat' || state.phase === 'cooldown') {
      state.phase = state.tp1Done ? 'runner' : 'bag';
    }
    return;
  }

  state.initialPositionSize = 0;
  state.trailPeak = 0;
  state.trailStop = 0;
}

function buildSkipReason(config, runtime, regimeMetrics, frameMetrics, hasBag, hasOpenOrders, buyEnabled, enoughBalance, compositeScore) {
  if (!config.enabled) {
    return 'disabled';
  }
  if (!frameMetrics.ready) {
    return frameMetrics.reason;
  }
  if (hasBag) {
    return 'in-bag';
  }
  if (hasOpenOrders) {
    return 'open-orders';
  }
  if (runtime.actionCooldownActive) {
    return 'action-cooldown';
  }
  if (runtime.reentryCooldownActive) {
    return 'exit-cooldown';
  }
  if (runtime.resetBlocked) {
    return 'reset-pending';
  }
  if (!buyEnabled) {
    return 'buy-disabled';
  }
  if (!enoughBalance) {
    return 'insufficient-base';
  }
  if (config.risk.closeOnlyEntry && frameMetrics.entryProgressRatio < config.risk.closeOnlyEntryProgress) {
    return 'waiting-candle-close';
  }
  if (!regimeMetrics.ready) {
    return regimeMetrics.reason;
  }
  if (!regimeMetrics.pass) {
    return 'regime-fail';
  }
  if (!frameMetrics.value.ok) {
    return frameMetrics.value.reason;
  }
  if (!frameMetrics.confirm.ok) {
    return frameMetrics.confirm.reason;
  }
  if (!frameMetrics.momentum.ok) {
    return frameMetrics.momentum.reason;
  }
  if (!frameMetrics.liquidity.ok) {
    return frameMetrics.liquidity.reason;
  }
  if (frameMetrics.invalidationPrice > 0 && frameMetrics.bid <= frameMetrics.invalidationPrice) {
    return 'below-invalidation';
  }
  if (compositeScore < config.risk.minEntryScore) {
    return 'score-' + compositeScore + '-of-5';
  }
  return 'entry-ready';
}

function maybeClearReset(state, config, regimeMetrics, frameMetrics, compositeScore) {
  if (!state.needsReset) {
    return;
  }
  if (!regimeMetrics.pass || !frameMetrics.value.ok) {
    state.needsReset = false;
  }
}

function determineSetupStage(config, runtime, regimeMetrics, frameMetrics, hasBag, hasOpenOrders, compositeScore, state) {
  if (hasBag) {
    return state.tp1Done ? 'runner-manage' : 'bag-manage';
  }
  if (!config.enabled) {
    return 'disabled';
  }
  if (!frameMetrics.ready) {
    return 'waiting-local-data';
  }
  if (hasOpenOrders) {
    return 'order-wait';
  }
  if (runtime.actionCooldownActive) {
    return 'action-cooldown';
  }
  if (runtime.reentryCooldownActive) {
    return 'reentry-cooldown';
  }
  if (runtime.resetBlocked) {
    return 'reset-pending';
  }
  if (config.risk.closeOnlyEntry && frameMetrics.entryProgressRatio < config.risk.closeOnlyEntryProgress) {
    return 'candle-close-watch';
  }
  if (!regimeMetrics.ready) {
    return 'waiting-htf';
  }
  if (!regimeMetrics.pass) {
    return 'regime-blocked';
  }
  if (!frameMetrics.value.ok) {
    return frameMetrics.value.bias === 'below-band' ? 'value-breakdown-watch' : 'value-pullback-watch';
  }
  if (!frameMetrics.confirm.ok) {
    return 'reclaim-watch';
  }
  if (!frameMetrics.momentum.ok) {
    return 'momentum-reset';
  }
  if (!frameMetrics.liquidity.ok) {
    return 'liquidity-screen';
  }
  if (frameMetrics.invalidationPrice > 0 && frameMetrics.bid <= frameMetrics.invalidationPrice) {
    return 'risk-invalidated';
  }
  if (compositeScore < config.risk.minEntryScore) {
    return 'score-blocked';
  }
  return 'entry-ready';
}

function updateTrailingState(state, frameMetrics, breakEven) {
  if (!state.tp1Done) {
    state.trailPeak = 0;
    state.trailStop = 0;
    return;
  }

  state.trailPeak = Math.max(state.trailPeak || 0, frameMetrics.bid);
  if (state.trailPeak <= 0) {
    state.trailPeak = frameMetrics.bid;
  }
  state.trailStop = state.trailPeak * (1 - (frameMetrics.trailPct / 100));
  if (breakEven > 0) {
    state.trailStop = Math.max(state.trailStop, breakEven);
  }
}

function createNotification(text, variant, persist) {
  return {
    text: text,
    variant: variant,
    persist: persist
  };
}

function sendNotification(gb, config, state, key, notification) {
  if (!config.telemetry.enableNotifications) {
    return;
  }
  if (state.notificationKeys[key]) {
    return;
  }
  gb.data.pairLedger.notifications = [notification];
  state.notificationKeys[key] = Date.now();
}

function resetNotificationKey(state, key) {
  if (state.notificationKeys[key]) {
    delete state.notificationKeys[key];
  }
}

function pruneNotificationKeys(state, config, now) {
  var keys = Object.keys(state.notificationKeys || {});
  var maxAgeMs = config.telemetry.notificationRetentionMinutes * 60 * 1000;
  var pruneIntervalMs = config.telemetry.notificationPruneIntervalMinutes * 60 * 1000;
  var limit = config.telemetry.notificationKeyLimit;
  var keyedTimestamps = [];
  var i;
  var key;
  var timestamp;

  if (!keys.length) {
    return;
  }

  if (state.lastNotificationPruneAt > 0 && (now - state.lastNotificationPruneAt) < pruneIntervalMs) {
    return;
  }

  for (i = 0; i < keys.length; i += 1) {
    key = keys[i];
    timestamp = safeNumber(state.notificationKeys[key], 0);
    if (timestamp <= 0 || (now - timestamp) > maxAgeMs) {
      delete state.notificationKeys[key];
      continue;
    }
    keyedTimestamps.push({
      key: key,
      timestamp: timestamp
    });
  }

  if (keyedTimestamps.length > limit) {
    keyedTimestamps.sort(function (left, right) {
      return right.timestamp - left.timestamp;
    });
    for (i = limit; i < keyedTimestamps.length; i += 1) {
      delete state.notificationKeys[keyedTimestamps[i].key];
    }
  }

  state.lastNotificationPruneAt = now;
}

function emitChartMark(gb, message) {
  try {
    gb.method.setTimeScaleMark(gb.data.pairName, gb.data.exchangeName, message);
  } catch (err) {
    console.log(logPrefix(gb) + '[WARN][mark] Could not add timescale mark: ' + String(err && err.message ? err.message : err));
  }
}

async function executeBuy(gb, config, state, amountQuote, label, compositeScore, frameMetrics) {
  var minimumBuyBaseValue = minBaseVolumeToBuy(gb);
  var executionPrice = buyReferencePrice(frameMetrics);
  var orderValueBase = quoteAmountToBaseValue(amountQuote, executionPrice);
  var result;

  if (amountQuote <= 0) {
    return false;
  }
  if (minimumBuyBaseValue > 0 && orderValueBase < minimumBuyBaseValue) {
    logWarn(
      gb,
      'buy-skip',
      label + ' order value ' + formatPrice(orderValueBase) +
      ' is below MIN_VOLUME_TO_BUY ' + formatPrice(minimumBuyBaseValue)
    );
    return false;
  }

  result = await gb.method.buyMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);
  if (!result) {
    return false;
  }
  state.lastActionAt = Date.now();
  state.lastActionLabel = label;
  state.lastFillPrice = executionPrice;
  state.lastEntryScore = compositeScore;

  if (label === 'entry') {
    state.entryTime = Date.now();
    state.dcaCount = 0;
    state.tp1Done = false;
    state.trailPeak = 0;
    state.trailStop = 0;
    state.needsReset = false;
    state.phase = 'entry-pending';
  } else if (label === 'dca') {
    state.dcaCount += 1;
    state.phase = 'bag';
  }

  logInfo(
    gb,
    label,
    'Executed ' + label + ' market buy for ' + formatPrice(amountQuote) +
    ' quote units at approx ' + formatPrice(executionPrice) +
    ' with score ' + compositeScore + '/5'
  );

  emitChartMark(gb, 'Aegis ' + label + ' @ ' + formatPrice(executionPrice));
  return true;
}

function normalizedSellAmount(gb, requestedAmount, forceFullIfNeeded) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var minimumSellBaseValue = minBaseVolumeToSell(gb);
  var marketPrice = Math.max(
    safeNumber(gb.data.bid, 0),
    safeNumber(gb.data.ask, 0),
    safeNumber(gb.data.breakEven, 0)
  );
  var amount = Math.min(requestedAmount, quoteBalance);
  var amountValueBase = quoteAmountToBaseValue(amount, marketPrice);
  var fullBalanceValueBase = quoteAmountToBaseValue(quoteBalance, marketPrice);

  if (amount <= 0 || quoteBalance <= 0) {
    return 0;
  }

  if (minimumSellBaseValue > 0 && amountValueBase < minimumSellBaseValue) {
    if (forceFullIfNeeded && fullBalanceValueBase >= minimumSellBaseValue) {
      return quoteBalance;
    }
    return 0;
  }

  return amount;
}

async function executeSell(gb, state, amountQuote, label, frameMetrics) {
  var result = await gb.method.sellMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);
  if (!result) {
    return false;
  }
  state.lastActionAt = Date.now();
  state.lastActionLabel = label;

  if (label === 'tp1') {
    state.tp1Done = true;
    state.phase = 'runner';
    state.trailPeak = Math.max(frameMetrics.bid, state.trailPeak || 0);
  } else {
    state.cooldownUntil = Date.now();
  }

  logInfo(
    gb,
    label,
    'Executed ' + label + ' market sell for ' + formatPrice(amountQuote) +
    ' quote units at approx ' + formatPrice(frameMetrics.bid)
  );

  emitChartMark(gb, 'Aegis ' + label + ' @ ' + formatPrice(frameMetrics.bid));
  return true;
}

function clearBagState(state, config) {
  state.tp1Done = false;
  state.dcaCount = 0;
  state.trailPeak = 0;
  state.trailStop = 0;
  state.lastFillPrice = 0;
  state.entryTime = 0;
  state.initialPositionSize = 0;
  state.phase = 'cooldown';
  state.needsReset = true;
  state.cooldownUntil = Date.now() + (config.capital.reentryCooldownMinutes * 60 * 1000);
}

function phaseName(state, hasBag, setupArmed, reentryCooldownActive) {
  if (state.phase === 'entry-pending' && !hasBag) {
    return 'entry-pending';
  }
  if (hasBag) {
    return state.tp1Done ? 'runner' : 'bag';
  }
  if (reentryCooldownActive) {
    return 'cooldown';
  }
  if (setupArmed) {
    return 'armed';
  }
  return 'flat';
}

function buildCycleSummaryKey(regimeMetrics, frameMetrics, state, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, setupStage) {
  var regimeKey = regimeMetrics && regimeMetrics.ready
    ? (regimeMetrics.pass ? 'on' : 'off') + ':' + String(regimeMetrics.score || 0)
    : 'wait';
  var frameKey = frameMetrics && frameMetrics.ready
    ? [
      frameMetrics.lastTimestamp || 0,
      frameMetrics.value ? frameMetrics.value.reason : 'no-value',
      frameMetrics.confirm ? frameMetrics.confirm.reason : 'no-confirm',
      frameMetrics.momentum ? frameMetrics.momentum.reason : 'no-momentum',
      frameMetrics.liquidity ? frameMetrics.liquidity.reason : 'no-liquidity'
    ].join(':')
    : 'not-ready';

  return [
    regimeKey,
    frameKey,
    setupStage,
    phaseName(state, hasBag, setupArmed, reentryCooldownActive),
    hasBag ? 1 : 0,
    setupArmed ? 1 : 0,
    skipReason,
    compositeScore,
    state.dcaCount,
    state.tp1Done ? 1 : 0,
    roundTo(safeNumber(state.trailStop, 0), 2)
  ].join('|');
}

function buildCycleSummaryLine(gb, config, regimeMetrics, frameMetrics, state, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, setupStage) {
  var phase = phaseName(state, hasBag, setupArmed, reentryCooldownActive);
  var periodMinutes = frameMetrics && frameMetrics.ready
    ? frameMetrics.currentPeriodMinutes
    : safeNumber(gb.data.period, 0);
  var bid = frameMetrics && frameMetrics.ready
    ? frameMetrics.bid
    : Math.max(safeNumber(gb.data.bid, 0), safeNumber(gb.data.ask, 0));
  var regimeLabel = regimeMetrics && regimeMetrics.ready
    ? ((regimeMetrics.pass ? 'on' : 'off') + '(' + formatScore(regimeMetrics.score, 4) + ')')
    : 'wait';
  var summary = [
    'tf=' + String(periodMinutes) + 'm',
    'bid=' + formatPrice(bid),
    'phase=' + phase,
    'stage=' + setupStage,
    'regime=' + regimeLabel,
    'score=' + formatScore(compositeScore, 5),
    'setup=' + (setupArmed ? 'armed' : 'idle'),
    'skip=' + skipReason
  ];

  if (frameMetrics && frameMetrics.ready) {
    summary.push('value=' + (frameMetrics.value.ok ? 'ok' : frameMetrics.value.reason));
    summary.push('reclaim=' + (frameMetrics.confirm.ok ? 'ok' : frameMetrics.confirm.reason));
    summary.push('momentum=' + (frameMetrics.momentum.ok ? 'ok' : frameMetrics.momentum.reason));
    summary.push('liquidity=' + (frameMetrics.liquidity.ok ? 'ok' : frameMetrics.liquidity.reason));
    summary.push('spread=' + formatPercent(frameMetrics.liquidity.spreadPct));
    summary.push('relvol=' + roundTo(frameMetrics.liquidity.relativeVolume, 2).toFixed(2) + 'x');
    summary.push('pullback=' + formatPercent(frameMetrics.value.pullbackPct));
    summary.push('rsi=' + roundTo(frameMetrics.rsi, 1).toFixed(1));
    summary.push('dca=' + String(state.dcaCount) + '/' + String(config.dca.maxCount));
    summary.push('stop=' + formatPrice(frameMetrics.invalidationPrice));
  }

  return summary.join(' ');
}

function emitCycleSummary(gb, config, state, regimeMetrics, frameMetrics, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, setupStage) {
  var summaryKey;

  if (config.telemetry.logMode === 'events') {
    return;
  }

  summaryKey = buildCycleSummaryKey(
    regimeMetrics,
    frameMetrics,
    state,
    hasBag,
    setupArmed,
    skipReason,
    compositeScore,
    reentryCooldownActive,
    setupStage
  );

  if (config.telemetry.logMode === 'changes' && state.lastCycleSummaryKey === summaryKey) {
    return;
  }

  state.lastCycleSummaryKey = summaryKey;
  console.log(
    logPrefix(gb) + '[STATE] ' +
    buildCycleSummaryLine(
      gb,
      config,
      regimeMetrics,
      frameMetrics,
      state,
      hasBag,
      setupArmed,
      skipReason,
      compositeScore,
      reentryCooldownActive,
      setupStage
    )
  );
}

function clearChartObjects(gb) {
  delete gb.data.pairLedger.customBuyTarget;
  delete gb.data.pairLedger.customSellTarget;
  delete gb.data.pairLedger.customStopTarget;
  delete gb.data.pairLedger.customCloseTarget;
  delete gb.data.pairLedger.customTrailingTarget;
  delete gb.data.pairLedger.customDcaTarget;
  gb.data.pairLedger.customChartTargets = [];
  gb.data.pairLedger.customChartShapes = [];
}

function createChartTarget(text, price, lineStyle, lineWidth, lineColor, bodyTextColor) {
  return {
    text: text,
    price: price,
    quantity: '',
    lineStyle: lineStyle,
    lineLength: 15,
    lineWidth: lineWidth,
    extendLeft: false,
    bodyBackgroundColor: lineColor,
    bodyTextColor: bodyTextColor,
    bodyBorderColor: 'rgba(0,0,0,0)',
    quantityBackgroundColor: lineColor,
    quantityTextColor: bodyTextColor,
    quantityBorderColor: 'rgba(0,0,0,0)',
    lineColor: lineColor
  };
}

function buildChartTargets(config, hasBag, frameMetrics, state, compositeScore, entryPrice) {
  var targets = [];
  var stopColor = AEGIS_COLORS.bad;
  var buyColor = AEGIS_COLORS.good;
  var trailColor = AEGIS_COLORS.warn;
  var reclaimColor = frameMetrics.confirm.ok ? buyColor : AEGIS_COLORS.info;
  var buyLabel = compositeScore >= config.risk.minEntryScore ? 'Aegis Buy Ready' : 'Aegis Buy Watch';

  if (hasBag) {
    if (entryPrice > 0) {
      targets.push(createChartTarget('Aegis Avg Fill', entryPrice, 1, 1, AEGIS_COLORS.neutral, '#111827'));
    }
    targets.push(createChartTarget('Aegis TP1', frameMetrics.tp1Price, 0, 1, buyColor, '#122018'));
    targets.push(createChartTarget('Aegis Invalidation', frameMetrics.invalidationPrice, 2, 1, stopColor, '#2b1111'));
    if (!state.tp1Done && frameMetrics.dcaTarget > 0) {
      targets.push(createChartTarget('Aegis DCA', frameMetrics.dcaTarget, 1, 1, AEGIS_COLORS.info, '#0f1a2b'));
    }
    if (state.tp1Done && state.trailStop > 0) {
      targets.push(createChartTarget('Aegis Trail', state.trailStop, 0, 2, trailColor, '#2b2110'));
    }
    return targets;
  }

  targets.push(
    createChartTarget(
      buyLabel,
      frameMetrics.entryTarget,
      0,
      1,
      compositeScore >= config.risk.minEntryScore ? buyColor : AEGIS_COLORS.neutral,
      '#122018'
    )
  );
  targets.push(createChartTarget('Aegis Reclaim', frameMetrics.confirm.triggerPrice, 1, 1, reclaimColor, '#0f1a2b'));
  targets.push(createChartTarget('Aegis TP1 Preview', frameMetrics.tp1Price, 1, 1, buyColor, '#122018'));
  targets.push(createChartTarget('Aegis Stop', frameMetrics.invalidationPrice, 2, 1, stopColor, '#2b1111'));
  return targets;
}

function buildRectangleShape(startTime, endTime, topPrice, bottomPrice, fillColor, borderColor) {
  if (!startTime || !endTime || !isFinite(topPrice) || !isFinite(bottomPrice)) {
    return null;
  }
  if (topPrice <= 0 || bottomPrice <= 0 || topPrice <= bottomPrice) {
    return null;
  }
  return {
    points: [
      { time: startTime, price: topPrice },
      { time: endTime, price: bottomPrice }
    ],
    options: {
      shape: 'rectangle',
      lock: true,
      disableSelection: true,
      disableSave: true,
      disableUndo: true,
      showInObjectsTree: false,
      setInBackground: true,
      overrides: {
        backgroundColor: fillColor,
        color: borderColor,
        textColor: borderColor,
        fillBackground: true
      }
    }
  };
}

function buildShapeWindow(frameMetrics) {
  var timestamps = frameMetrics.candles.timestamp || [];
  var startIndex;
  var startTime;
  var endTime;

  if (!timestamps.length) {
    return null;
  }

  startIndex = Math.max(0, timestamps.length - 12);
  startTime = normalizeTimestampToSeconds(timestamps[startIndex]);
  endTime = normalizeTimestampToSeconds(timestamps[timestamps.length - 1]);
  if (!startTime || !endTime) {
    return null;
  }

  return {
    startTime: startTime,
    endTime: endTime
  };
}

function buildValueZoneShape(frameMetrics) {
  var window = buildShapeWindow(frameMetrics);
  var shape;

  if (!window) {
    return [];
  }

  shape = buildRectangleShape(
    window.startTime,
    window.endTime,
    frameMetrics.value.bandTop,
    frameMetrics.value.bandBottom,
    AEGIS_COLORS.zoneFill,
    AEGIS_COLORS.zoneBorder
  );

  return shape ? [shape] : [];
}

function buildRiskZoneShape(frameMetrics) {
  var window = buildShapeWindow(frameMetrics);
  var riskTop;
  var shape;

  if (!window) {
    return [];
  }

  riskTop = Math.min(frameMetrics.value.bandBottom, frameMetrics.slowEma);
  if (riskTop <= frameMetrics.invalidationPrice) {
    return [];
  }

  shape = buildRectangleShape(
    window.startTime,
    window.endTime,
    riskTop,
    frameMetrics.invalidationPrice,
    AEGIS_COLORS.stopFill,
    AEGIS_COLORS.stopBorder
  );

  return shape ? [shape] : [];
}

function buildChartShapes(frameMetrics, hasBag, regimeMetrics, setupArmed) {
  var shapes = [];

  if (hasBag || regimeMetrics.pass || setupArmed) {
    shapes = shapes.concat(buildValueZoneShape(frameMetrics));
  }
  if (hasBag || setupArmed || (regimeMetrics.pass && frameMetrics.value.ok)) {
    shapes = shapes.concat(buildRiskZoneShape(frameMetrics));
  }

  return shapes;
}

function updateCharts(gb, config, regimeMetrics, frameMetrics, state, hasBag, setupArmed, compositeScore) {
  var entryPrice = Math.max(safeNumber(gb.data.breakEven, 0), safeNumber(state.lastFillPrice, 0));

  if (!config.visuals.enableCharts) {
    clearChartObjects(gb);
    return;
  }

  gb.data.pairLedger.customBuyTarget = null;
  gb.data.pairLedger.customSellTarget = null;
  gb.data.pairLedger.customStopTarget = null;
  gb.data.pairLedger.customCloseTarget = null;
  gb.data.pairLedger.customTrailingTarget = null;
  gb.data.pairLedger.customDcaTarget = null;

  if (hasBag) {
    gb.data.pairLedger.customSellTarget = frameMetrics.tp1Price;
    gb.data.pairLedger.customStopTarget = frameMetrics.invalidationPrice;
    gb.data.pairLedger.customCloseTarget = state.tp1Done && state.trailStop > 0 ? state.trailStop : null;
    gb.data.pairLedger.customDcaTarget = state.tp1Done ? null : frameMetrics.dcaTarget;
    gb.data.pairLedger.customTrailingTarget = state.tp1Done ? state.trailStop : null;
    gb.data.pairLedger.customChartTargets = buildChartTargets(config, true, frameMetrics, state, compositeScore, entryPrice);
    gb.data.pairLedger.customChartShapes = config.visuals.enableShapes
      ? buildChartShapes(frameMetrics, true, regimeMetrics, setupArmed)
      : [];
    return;
  }

  if (regimeMetrics.pass) {
    gb.data.pairLedger.customBuyTarget = frameMetrics.entryTarget;
    gb.data.pairLedger.customSellTarget = frameMetrics.tp1Price;
    gb.data.pairLedger.customStopTarget = frameMetrics.invalidationPrice;
    gb.data.pairLedger.customChartTargets = buildChartTargets(config, false, frameMetrics, state, compositeScore, 0);
    gb.data.pairLedger.customChartShapes = config.visuals.enableShapes
      ? buildChartShapes(frameMetrics, false, regimeMetrics, setupArmed)
      : [];
    return;
  }

  clearChartObjects(gb);
}

function stageColor(stage) {
  if (stage === 'entry-ready' || stage === 'bag-manage') {
    return AEGIS_COLORS.good;
  }
  if (stage === 'runner-manage') {
    return AEGIS_COLORS.warn;
  }
  if (
    stage === 'regime-blocked' ||
    stage === 'value-breakdown-watch' ||
    stage === 'liquidity-screen' ||
    stage === 'disabled'
  ) {
    return AEGIS_COLORS.bad;
  }
  return AEGIS_COLORS.neutral;
}

function updateSidebar(gb, config, regimeMetrics, frameMetrics, state, runtime, hasBag, setupArmed, skipReason, compositeScore, setupStage) {
  var phase = phaseName(state, hasBag, setupArmed, runtime.reentryCooldownActive);
  var breakEven = safeNumber(gb.data.breakEven, 0);
  var pnlPct = breakEven > 0 ? percentChange(breakEven, frameMetrics.bid) : 0;
  var ageMinutes = state.entryTime > 0 ? ((Date.now() - state.entryTime) / 60000) : 0;

  gb.data.pairLedger.sidebarExtras = [
    {
      label: 'Aegis',
      value: AEGIS_META.version,
      valueColor: AEGIS_COLORS.info
    },
    {
      label: 'Regime',
      value: regimeMetrics.ready ? (regimeMetrics.pass ? 'ON ' + formatScore(regimeMetrics.score, 4) : 'OFF ' + formatScore(regimeMetrics.score, 4)) : 'WAIT',
      tooltip: 'Higher timeframe gate based on baseline, alignment, slope, and separation.',
      valueColor: statusColor(regimeMetrics.pass, !regimeMetrics.ready)
    },
    {
      label: 'Score',
      value: formatScore(compositeScore, 5),
      tooltip: 'Composite entry score: regime + value zone + reclaim + momentum + liquidity.',
      valueColor: compositeScore >= config.risk.minEntryScore ? AEGIS_COLORS.good : AEGIS_COLORS.warn
    },
    {
      label: 'Stage',
      value: setupStage,
      tooltip: 'Current setup progression state for the reclaim workflow.',
      valueColor: stageColor(setupStage)
    },
    {
      label: 'Setup',
      value: setupArmed ? 'ARMED' : 'IDLE',
      tooltip: 'Setup armed requires regime, value zone, liquidity, and no cooldown / reset block.',
      valueColor: setupArmed ? AEGIS_COLORS.good : AEGIS_COLORS.neutral
    },
    {
      label: 'Phase',
      value: phase.toUpperCase(),
      tooltip: 'Current bag / setup phase.',
      valueColor: phase === 'runner' ? AEGIS_COLORS.warn : phase === 'bag' ? AEGIS_COLORS.good : AEGIS_COLORS.neutral
    },
    {
      label: 'DCA',
      value: String(state.dcaCount) + '/' + String(config.dca.maxCount),
      tooltip: 'Executed DCA count against allowed maximum.',
      valueColor: state.dcaCount > 0 ? AEGIS_COLORS.info : AEGIS_COLORS.neutral
    },
    {
      label: 'Trail',
      value: state.tp1Done && state.trailStop > 0 ? formatPrice(state.trailStop) : '--',
      tooltip: 'Runner trailing stop.',
      valueColor: state.tp1Done ? AEGIS_COLORS.warn : AEGIS_COLORS.neutral
    },
    {
      label: 'Stop',
      value: frameMetrics.ready ? formatPrice(frameMetrics.invalidationPrice) : '--',
      tooltip: 'Invalidation level for the current reclaim thesis.',
      valueColor: AEGIS_COLORS.bad
    },
    {
      label: 'Spread',
      value: frameMetrics.ready ? formatPercent(frameMetrics.liquidity.spreadPct) : '--',
      tooltip: 'Live bid/ask spread percentage.',
      valueColor: frameMetrics.ready ? (frameMetrics.liquidity.ok ? AEGIS_COLORS.good : AEGIS_COLORS.bad) : AEGIS_COLORS.neutral
    },
    {
      label: 'Reclaim',
      value: frameMetrics.ready ? (frameMetrics.confirm.ok ? 'OK' : frameMetrics.confirm.reason) : '--',
      tooltip: 'Short-term reclaim / rejection status.',
      valueColor: frameMetrics.ready ? statusColor(frameMetrics.confirm.ok, false) : AEGIS_COLORS.neutral
    },
    {
      label: 'RSI',
      value: frameMetrics.ready ? roundTo(frameMetrics.rsi, 1).toFixed(1) : '--',
      tooltip: 'Locally calculated RSI and recovery sanity check.',
      valueColor: frameMetrics.ready ? (frameMetrics.momentum.ok ? AEGIS_COLORS.good : AEGIS_COLORS.warn) : AEGIS_COLORS.neutral
    },
    {
      label: 'PnL',
      value: hasBag ? formatPercent(pnlPct) : '--',
      tooltip: 'Live bag PnL versus break-even price.',
      valueColor: hasBag ? (pnlPct >= 0 ? AEGIS_COLORS.good : AEGIS_COLORS.bad) : AEGIS_COLORS.neutral
    },
    {
      label: 'Age',
      value: hasBag && state.entryTime > 0 ? roundTo(ageMinutes, 0).toFixed(0) + 'm' : '--',
      tooltip: 'Minutes since current bag was detected or opened.',
      valueColor: hasBag ? AEGIS_COLORS.info : AEGIS_COLORS.neutral
    },
    {
      label: 'Skip',
      value: skipReason,
      tooltip: 'Primary reason no new entry was taken this cycle.',
      valueColor: skipReason === 'entry-ready' ? AEGIS_COLORS.good : AEGIS_COLORS.bad
    }
  ];
}

function resetNotificationsForTransitions(state, regimePass, setupArmed) {
  if (regimePass) {
    resetNotificationKey(state, 'regime-disabled');
  }
  if (!regimePass) {
    resetNotificationKey(state, 'regime-enabled');
  }
  if (!setupArmed) {
    resetNotificationKey(state, 'setup-armed');
  }
}

async function runAegis(gb) {
  var config = buildConfig(gb);
  var state = ensureState(gb);
  var runtime = {
    now: Date.now()
  };
  pruneNotificationKeys(state, config, runtime.now);
  var buyEnabled = canUseBuyToggle(gb, config);
  var sellEnabled = canUseSellToggle(gb, config);
  var hasBag = hasUsableBag(gb);
  var hasOpenOrders = !!(gb.data.openOrders && gb.data.openOrders.length);
  var availableBase = availableBaseForBuys(gb, config);
  var enoughEntryBalance = availableBase >= config.capital.tradeLimitBase;
  var regimeMetrics;
  var frameMetrics;
  var compositeScore;
  var skipReason;
  var setupArmed;
  var setupStage;
  var breakEven = safeNumber(gb.data.breakEven, 0);
  var requestedBuyAmount;
  var requestedDcaAmount;
  var sellAmount;
  var staleAgeMinutes;
  var pnlPct;

  runtime.actionCooldownActive = (runtime.now - safeNumber(state.lastActionAt, 0)) < (config.capital.actionCooldownSeconds * 1000);
  runtime.reentryCooldownActive = runtime.now < safeNumber(state.cooldownUntil, 0);
  runtime.resetBlocked = !!state.needsReset;

  updateBagRecovery(gb, state, runtime, hasBag);
  regimeMetrics = await getHigherTimeframeMetrics(gb, state, config);
  frameMetrics = analyzeCurrentFrame(gb, config, state, hasBag);

  if (!frameMetrics.ready) {
    clearChartObjects(gb);
    updateSidebar(gb, config, regimeMetrics, frameMetrics, state, runtime, hasBag, false, frameMetrics.reason, 0, 'waiting-local-data');
    if (state.lastSkipReason !== frameMetrics.reason) {
      logDebug(gb, config, 'skip', 'Skipping cycle because ' + frameMetrics.reason);
    }
    state.phase = hasBag ? 'bag' : 'flat';
    emitCycleSummary(gb, config, state, regimeMetrics, frameMetrics, hasBag, false, frameMetrics.reason, 0, runtime.reentryCooldownActive, 'waiting-local-data');
    state.lastSkipReason = frameMetrics.reason;
    state.hadBagLastCycle = hasBag;
    return;
  }

  if (!config.enabled) {
    clearChartObjects(gb);
    updateSidebar(gb, config, regimeMetrics, frameMetrics, state, runtime, hasBag, false, 'disabled', 0, 'disabled');
    if (state.lastSkipReason !== 'disabled') {
      logInfo(gb, 'disabled', 'Aegis is disabled by override.');
    }
    state.phase = hasBag ? 'bag' : 'flat';
    emitCycleSummary(gb, config, state, regimeMetrics, frameMetrics, hasBag, false, 'disabled', 0, runtime.reentryCooldownActive, 'disabled');
    state.lastSkipReason = 'disabled';
    state.hadBagLastCycle = hasBag;
    return;
  }

  compositeScore = buildCompositeScore(regimeMetrics, frameMetrics);
  maybeClearReset(state, config, regimeMetrics, frameMetrics, compositeScore);
  runtime.resetBlocked = !!state.needsReset;
  skipReason = buildSkipReason(
    config,
    runtime,
    regimeMetrics,
    frameMetrics,
    hasBag,
    hasOpenOrders,
    buyEnabled,
    enoughEntryBalance,
    compositeScore
  );
  setupArmed = !hasBag &&
    !hasOpenOrders &&
    !runtime.actionCooldownActive &&
    !runtime.reentryCooldownActive &&
    !runtime.resetBlocked &&
    buyEnabled &&
    enoughEntryBalance &&
    regimeMetrics.ready &&
    regimeMetrics.pass &&
    frameMetrics.value.ok &&
    frameMetrics.liquidity.ok;
  setupStage = determineSetupStage(config, runtime, regimeMetrics, frameMetrics, hasBag, hasOpenOrders, compositeScore, state);

  updateTrailingState(state, frameMetrics, breakEven);
  resetNotificationsForTransitions(state, regimeMetrics.pass, setupArmed);

  if (setupArmed && !state.lastSetupArmed) {
    sendNotification(
      gb,
      config,
      state,
      'setup-armed',
      createNotification(
        'Aegis setup armed on ' + gb.data.pairName + ' with score ' + compositeScore + '/5.',
        'info',
        false
      )
    );
    logInfo(gb, 'setup-armed', 'Setup armed with score ' + compositeScore + '/5.');
  }

  if (state.lastRegimePass && !regimeMetrics.pass) {
    sendNotification(
      gb,
      config,
      state,
      'regime-disabled',
      createNotification(
        'Aegis regime disabled on ' + gb.data.pairName + '. New longs are blocked.',
        'warning',
        false
      )
    );
    logInfo(gb, 'regime-off', 'Higher timeframe regime switched off.');
  }

  if (!state.lastRegimePass && regimeMetrics.pass) {
    sendNotification(
      gb,
      config,
      state,
      'regime-enabled',
      createNotification(
        'Aegis regime enabled on ' + gb.data.pairName + '. Reclaim entries are allowed again.',
        'info',
        false
      )
    );
  }

  if (state.hadBagLastCycle && !hasBag) {
    clearBagState(state, config);
    logInfo(gb, 'bag-flat', 'Bag closed outside the current Aegis action path. Reset and cooldown applied.');
  }

  if (!state.hadBagLastCycle && hasBag) {
    logInfo(gb, 'bag-detected', 'Recovered live bag state from Gunbot ledger.');
  }

  if (!hasBag && !hasOpenOrders && skipReason === 'entry-ready') {
    requestedBuyAmount = config.capital.tradeLimitBase / buyReferencePrice(frameMetrics);
    if (await executeBuy(gb, config, state, requestedBuyAmount, 'entry', compositeScore, frameMetrics)) {
      sendNotification(
        gb,
        config,
        state,
        'entry-executed-' + String(Date.now()),
        createNotification(
          'Aegis entry executed on ' + gb.data.pairName + ' at approx ' + formatPrice(frameMetrics.bid) + '.',
          'success',
          false
        )
      );
    }
  } else if (hasBag && !hasOpenOrders && buyEnabled && !runtime.actionCooldownActive && !runtime.reentryCooldownActive && !state.tp1Done) {
    pnlPct = breakEven > 0 ? percentChange(breakEven, frameMetrics.bid) : 0;
    requestedDcaAmount = (config.capital.tradeLimitBase * config.dca.sizeMultiplier) / buyReferencePrice(frameMetrics);
    if (
      regimeMetrics.pass &&
      frameMetrics.liquidity.ok &&
      frameMetrics.value.ok &&
      (!config.dca.requireReclaim || frameMetrics.confirm.ok) &&
      state.dcaCount < config.dca.maxCount &&
      frameMetrics.dcaTarget > 0 &&
      frameMetrics.bid <= frameMetrics.dcaTarget &&
      pnlPct >= (config.dca.maxDepthFromBreakEvenPct * -1) &&
      availableBase >= (config.capital.tradeLimitBase * config.dca.sizeMultiplier) &&
      frameMetrics.bid > frameMetrics.invalidationPrice
    ) {
      if (await executeBuy(gb, config, state, requestedDcaAmount, 'dca', compositeScore, frameMetrics)) {
        sendNotification(
          gb,
          config,
          state,
          'dca-' + String(state.dcaCount) + '-' + String(Date.now()),
          createNotification(
            'Aegis DCA #' + String(state.dcaCount) + ' executed on ' + gb.data.pairName + ' at approx ' + formatPrice(frameMetrics.bid) + '.',
            'warning',
            false
          )
        );
      }
    }
  }

  if (hasBag && !hasOpenOrders) {
    staleAgeMinutes = state.entryTime > 0 ? ((runtime.now - state.entryTime) / 60000) : 0;
    pnlPct = breakEven > 0 ? percentChange(breakEven, frameMetrics.bid) : 0;

    if (!sellEnabled) {
      logDebug(gb, config, 'sell-disabled', 'Sell exits are disabled by pair settings.');
    } else if (frameMetrics.bid <= frameMetrics.invalidationPrice && frameMetrics.invalidationPrice > 0) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'invalidation', frameMetrics)) {
        clearBagState(state, config);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'exit-invalidation-' + String(Date.now()),
          createNotification(
            'Aegis invalidation exit executed on ' + gb.data.pairName + '.',
            'error',
            true
          )
        );
      }
    } else if (!state.tp1Done && frameMetrics.bid >= frameMetrics.tp1Price) {
      sellAmount = normalizedSellAmount(
        gb,
        safeNumber(gb.data.quoteBalance, 0) * config.exits.tp1SellRatio,
        true
      );
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'tp1', frameMetrics)) {
        sendNotification(
          gb,
          config,
          state,
          'tp1-executed-' + String(Date.now()),
          createNotification(
            'Aegis TP1 taken on ' + gb.data.pairName + '. Runner trail armed at ' + formatPrice(state.trailStop) + '.',
            'success',
            false
          )
        );
      }
    } else if (state.tp1Done && state.trailStop > 0 && frameMetrics.bid <= state.trailStop) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'trail', frameMetrics)) {
        clearBagState(state, config);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'exit-trail-' + String(Date.now()),
          createNotification(
            'Aegis runner exit executed on ' + gb.data.pairName + ' at trailing stop.',
            'success',
            false
          )
        );
      }
    } else if (!state.tp1Done && state.entryTime > 0 && staleAgeMinutes >= config.exits.staleMinutes && pnlPct <= config.exits.staleMaxProfitPct) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'stale', frameMetrics)) {
        clearBagState(state, config);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'exit-stale-' + String(Date.now()),
          createNotification(
            'Aegis stale-trade exit executed on ' + gb.data.pairName + '.',
            'warning',
            false
          )
        );
      }
    }
  }

  if (state.lastSkipReason !== skipReason || (compositeScore >= (config.risk.minEntryScore - 1) && !hasBag)) {
    logDebug(
      gb,
      config,
      'state',
      'skip=' + skipReason +
      ' score=' + compositeScore + '/5' +
      ' regime=' + (regimeMetrics.pass ? 'on' : 'off') +
      ' stage=' + setupStage +
      ' value=' + (frameMetrics.value.ok ? 'ok' : frameMetrics.value.reason) +
      ' reclaim=' + (frameMetrics.confirm.ok ? 'ok' : frameMetrics.confirm.reason) +
      ' momentum=' + (frameMetrics.momentum.ok ? 'ok' : frameMetrics.momentum.reason) +
      ' liquidity=' + (frameMetrics.liquidity.ok ? 'ok' : frameMetrics.liquidity.reason)
    );
  }

  if (!hasBag && state.phase === 'cooldown') {
    runtime.reentryCooldownActive = true;
    setupArmed = false;
    skipReason = 'exit-cooldown';
  } else if (!hasBag && state.phase === 'entry-pending') {
    skipReason = 'action-cooldown';
  }

  // Re-evaluate after actions so sidebar/chart state reflects the post-trade phase.
  setupStage = determineSetupStage(config, runtime, regimeMetrics, frameMetrics, hasBag, hasOpenOrders, compositeScore, state);
  updateCharts(gb, config, regimeMetrics, frameMetrics, state, hasBag, setupArmed, compositeScore);
  updateSidebar(gb, config, regimeMetrics, frameMetrics, state, runtime, hasBag, setupArmed, skipReason, compositeScore, setupStage);

  state.phase = phaseName(state, hasBag, setupArmed, runtime.reentryCooldownActive);
  emitCycleSummary(gb, config, state, regimeMetrics, frameMetrics, hasBag, setupArmed, skipReason, compositeScore, runtime.reentryCooldownActive, setupStage);
  state.lastRegimePass = !!regimeMetrics.pass;
  state.lastSetupArmed = !!setupArmed;
  state.lastSkipReason = skipReason;
  state.hadBagLastCycle = hasBag;
}

async function aegisStrategy(runtimeGb) {
  var gb = resolveGb(runtimeGb);

  if (!isExpectedStrategyFile(gb, 'Aegis.js')) {
    return;
  }

  try {
    await runAegis(gb);
  } catch (err) {
    try {
      var pairName = gb && gb.data ? gb.data.pairName : 'unknown-pair';
      console.error('[' + AEGIS_META.name + ' ' + AEGIS_META.version + '][FATAL][' + pairName + '] ' + (err && err.stack ? err.stack : String(err)));
    } catch (secondaryError) {
      console.error('[' + AEGIS_META.name + ' ' + AEGIS_META.version + '][FATAL] Unhandled strategy error.');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = aegisStrategy;
} else {
  (async function () {
    await aegisStrategy(typeof gb !== 'undefined' ? gb : undefined);
  }());
}
