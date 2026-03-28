/*
 * Kestrel Tape Scalper
 * Version: 1.1.6
 * Updated: 2026-03-28
 *
 * Fast single-file Gunbot custom strategy.
 * Spot only. Long only.
 */

var KESTREL_META = {
  name: 'Kestrel Tape Scalper',
  version: '1.1.6',
  updated: '2026-03-28'
};

var KESTREL_COLORS = {
  good: '#2f9f6b',
  bad: '#cf5555',
  warn: '#cc9832',
  neutral: '#8794a8',
  info: '#4b84d4',
  zoneFill: 'rgba(75, 132, 212, 0.10)',
  zoneBorder: 'rgba(75, 132, 212, 0.40)',
  stopFill: 'rgba(207, 85, 85, 0.10)',
  stopBorder: 'rgba(207, 85, 85, 0.40)'
};

var KESTREL_BASE_CONFIG = {
  enabled: true,
  riskProfile: 'balanced',
  minCandles: 120,
  capital: {
    tradeLimitBase: 50,
    fundsReserveBase: 0,
    actionCooldownSeconds: 8,
    reentryCooldownMinutes: 25
  },
  trend: {
    emaFast: 8,
    emaSlow: 21,
    slopeLookback: 3,
    minSlopePct: 0.02,
    maxBelowSlowPct: 0.20
  },
  pullback: {
    lookback: 12,
    zoneBufferPct: 0.18,
    minPullbackPct: 0.15,
    maxPullbackPct: 1.35
  },
  confirm: {
    closeLocation: 0.55,
    minBouncePct: 0.05,
    requireBullishClose: true,
    requireCloseAboveFast: true
  },
  momentum: {
    rsiLength: 14,
    rsiFloor: 46,
    rsiCeiling: 72,
    minRsiDelta: 0.20
  },
  liquidity: {
    maxSpreadPct: 0.16,
    minRelativeVolume: 0.60,
    volumeLookback: 20,
    maxSignalRangePct: 1.80,
    projectCurrentVolume: true,
    projectedVolumeFloor: 0.30
  },
  risk: {
    minEntryScore: 4,
    useBuyEnabled: true,
    useSellEnabled: true
  },
  reload: {
    maxCount: 0,
    minDistancePct: 0.80,
    requireTrend: true
  },
  exits: {
    tp1Pct: 0.55,
    tp1SellRatio: 0.60,
    trailTriggerPct: 0.35,
    trailPct: 0.22,
    hardStopPct: 0.75,
    stopLookback: 6,
    stopBufferPct: 0.12,
    postEntryGraceSeconds: 60,
    timeStopMinutes: 90,
    timeStopMaxProfitPct: 0.20,
    momentumExitRsi: 44
  },
  visuals: {
    enableCharts: true,
    enableShapes: true
  },
  telemetry: {
    enableNotifications: true,
    enableDebugLogs: false,
    logMode: 'events',
    notificationRetentionMinutes: 1440,
    notificationKeyLimit: 150,
    notificationPruneIntervalMinutes: 60
  }
};

function applyRiskProfile(config) {
  var profile = String(config.riskProfile || 'balanced').toLowerCase();

  if (profile === 'conservative') {
    config.capital.reentryCooldownMinutes = 40;
    config.pullback.maxPullbackPct = 1.00;
    config.confirm.closeLocation = 0.60;
    config.momentum.minRsiDelta = 0.25;
    config.liquidity.minRelativeVolume = 0.80;
    config.liquidity.maxSignalRangePct = 1.30;
    config.risk.minEntryScore = 5;
    config.reload.maxCount = 0;
    config.exits.tp1Pct = 0.40;
    config.exits.trailTriggerPct = 0.28;
    config.exits.trailPct = 0.18;
    config.exits.hardStopPct = 0.60;
    config.exits.postEntryGraceSeconds = 90;
    config.exits.timeStopMinutes = 60;
    return;
  }

  if (profile === 'aggressive') {
    config.capital.reentryCooldownMinutes = 5;
    config.pullback.zoneBufferPct = 0.26;
    config.pullback.maxPullbackPct = 1.80;
    config.confirm.closeLocation = 0.48;
    config.confirm.minBouncePct = 0.01;
    config.momentum.rsiFloor = 42;
    config.momentum.minRsiDelta = 0.03;
    config.liquidity.minRelativeVolume = 0.20;
    config.liquidity.maxSignalRangePct = 2.40;
    config.risk.minEntryScore = 3;
    config.reload.maxCount = 3;
    config.reload.minDistancePct = 0.35;
    config.exits.tp1Pct = 0.45;
    config.exits.trailTriggerPct = 0.22;
    config.exits.trailPct = 0.20;
    config.exits.hardStopPct = 0.90;
    config.exits.postEntryGraceSeconds = 45;
    config.exits.timeStopMinutes = 60;
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
  if (typeof value === 'number' && isFinite(value)) {
    return String(value);
  }
  if (value === true || value === false) {
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
    value = value.trim().toLowerCase();
    if (value === 'true' || value === '1' || value === 'yes' || value === 'on') {
      return true;
    }
    if (value === 'false' || value === '0' || value === 'no' || value === 'off') {
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

function clamp(value, minValue, maxValue) {
  return Math.max(minValue, Math.min(maxValue, value));
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

function readFirstString(source, keys, fallback) {
  var i;
  var value;
  for (i = 0; i < keys.length; i += 1) {
    if (Object.prototype.hasOwnProperty.call(source, keys[i])) {
      value = safeString(source[keys[i]], fallback);
      if (value !== fallback) {
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

function normalizeLogMode(value) {
  value = safeString(value, 'events').toLowerCase();
  if (value === 'events' || value === 'changes' || value === 'cycle') {
    return value;
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
  var result = null;
  var i;
  for (i = start; i < values.length; i += 1) {
    if (!isFinite(values[i])) {
      continue;
    }
    if (result === null || values[i] > result) {
      result = values[i];
    }
  }
  return result === null ? 0 : result;
}

function lowestFromEnd(values, lookback) {
  var start = Math.max(0, values.length - lookback);
  var result = null;
  var i;
  for (i = start; i < values.length; i += 1) {
    if (!isFinite(values[i])) {
      continue;
    }
    if (result === null || values[i] < result) {
      result = values[i];
    }
  }
  return result === null ? 0 : result;
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

function normalizeTimestampToSeconds(value) {
  var numeric = safeNumber(value, 0);
  if (numeric > 1000000000000) {
    return Math.floor(numeric / 1000);
  }
  if (numeric > 1000000000) {
    return Math.floor(numeric);
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
  var config = deepClone(KESTREL_BASE_CONFIG);

  config.riskProfile = readFirstString(overrides, ['KESTREL_RISK_PROFILE'], config.riskProfile).toLowerCase();
  applyRiskProfile(config);

  config.enabled = readFirstBoolean(overrides, ['KESTREL_ENABLED'], config.enabled);
  config.minCandles = readFirstNumber(overrides, ['KESTREL_MIN_CANDLES'], config.minCandles);

  config.capital.tradeLimitBase = readFirstNumber(
    overrides,
    ['KESTREL_TRADE_LIMIT', 'TRADE_LIMIT', 'TRADING_LIMIT'],
    config.capital.tradeLimitBase
  );
  config.capital.fundsReserveBase = readFirstNumber(
    overrides,
    ['KESTREL_FUNDS_RESERVE', 'FUNDS_RESERVE'],
    config.capital.fundsReserveBase
  );
  config.capital.actionCooldownSeconds = readFirstNumber(
    overrides,
    ['KESTREL_ACTION_COOLDOWN_SECONDS'],
    config.capital.actionCooldownSeconds
  );
  config.capital.reentryCooldownMinutes = readFirstNumber(
    overrides,
    ['KESTREL_REENTRY_COOLDOWN_MINUTES'],
    config.capital.reentryCooldownMinutes
  );

  config.trend.emaFast = readFirstNumber(overrides, ['KESTREL_TREND_FAST_EMA'], config.trend.emaFast);
  config.trend.emaSlow = readFirstNumber(overrides, ['KESTREL_TREND_SLOW_EMA'], config.trend.emaSlow);
  config.trend.slopeLookback = readFirstNumber(overrides, ['KESTREL_TREND_SLOPE_LOOKBACK'], config.trend.slopeLookback);
  config.trend.minSlopePct = readFirstNumber(overrides, ['KESTREL_TREND_MIN_SLOPE_PCT'], config.trend.minSlopePct);
  config.trend.maxBelowSlowPct = readFirstNumber(overrides, ['KESTREL_TREND_MAX_BELOW_SLOW_PCT'], config.trend.maxBelowSlowPct);

  config.pullback.lookback = readFirstNumber(overrides, ['KESTREL_PULLBACK_LOOKBACK'], config.pullback.lookback);
  config.pullback.zoneBufferPct = readFirstNumber(overrides, ['KESTREL_PULLBACK_BUFFER_PCT'], config.pullback.zoneBufferPct);
  config.pullback.minPullbackPct = readFirstNumber(overrides, ['KESTREL_PULLBACK_MIN_PCT'], config.pullback.minPullbackPct);
  config.pullback.maxPullbackPct = readFirstNumber(overrides, ['KESTREL_PULLBACK_MAX_PCT'], config.pullback.maxPullbackPct);

  config.confirm.closeLocation = readFirstNumber(overrides, ['KESTREL_RECLAIM_CLOSE_LOCATION'], config.confirm.closeLocation);
  config.confirm.minBouncePct = readFirstNumber(overrides, ['KESTREL_RECLAIM_MIN_BOUNCE_PCT'], config.confirm.minBouncePct);
  config.confirm.requireBullishClose = readFirstBoolean(
    overrides,
    ['KESTREL_REQUIRE_BULLISH_CLOSE'],
    config.confirm.requireBullishClose
  );
  config.confirm.requireCloseAboveFast = readFirstBoolean(
    overrides,
    ['KESTREL_REQUIRE_CLOSE_ABOVE_FAST'],
    config.confirm.requireCloseAboveFast
  );

  config.momentum.rsiLength = readFirstNumber(overrides, ['KESTREL_MOMENTUM_RSI_LENGTH', 'RSI_LENGTH'], config.momentum.rsiLength);
  config.momentum.rsiFloor = readFirstNumber(overrides, ['KESTREL_MOMENTUM_RSI_FLOOR'], config.momentum.rsiFloor);
  config.momentum.rsiCeiling = readFirstNumber(overrides, ['KESTREL_MOMENTUM_RSI_CEILING'], config.momentum.rsiCeiling);
  config.momentum.minRsiDelta = readFirstNumber(overrides, ['KESTREL_MOMENTUM_MIN_DELTA'], config.momentum.minRsiDelta);

  config.liquidity.maxSpreadPct = readFirstNumber(overrides, ['KESTREL_MAX_SPREAD_PCT'], config.liquidity.maxSpreadPct);
  config.liquidity.minRelativeVolume = readFirstNumber(overrides, ['KESTREL_MIN_RELATIVE_VOLUME'], config.liquidity.minRelativeVolume);
  config.liquidity.volumeLookback = readFirstNumber(overrides, ['KESTREL_VOLUME_LOOKBACK'], config.liquidity.volumeLookback);
  config.liquidity.maxSignalRangePct = readFirstNumber(overrides, ['KESTREL_MAX_SIGNAL_RANGE_PCT'], config.liquidity.maxSignalRangePct);
  config.liquidity.projectCurrentVolume = readFirstBoolean(
    overrides,
    ['KESTREL_PROJECT_CURRENT_VOLUME', 'PROJECT_CURRENT_VOLUME'],
    config.liquidity.projectCurrentVolume
  );
  config.liquidity.projectedVolumeFloor = readFirstNumber(
    overrides,
    ['KESTREL_PROJECTED_VOLUME_FLOOR', 'PROJECTED_VOLUME_FLOOR'],
    config.liquidity.projectedVolumeFloor
  );

  config.risk.minEntryScore = readFirstNumber(overrides, ['KESTREL_MIN_ENTRY_SCORE'], config.risk.minEntryScore);
  config.risk.useBuyEnabled = readFirstBoolean(overrides, ['KESTREL_USE_BUY_ENABLED'], config.risk.useBuyEnabled);
  config.risk.useSellEnabled = readFirstBoolean(overrides, ['KESTREL_USE_SELL_ENABLED'], config.risk.useSellEnabled);

  config.reload.maxCount = readFirstNumber(overrides, ['KESTREL_MAX_RELOAD_COUNT'], config.reload.maxCount);
  config.reload.minDistancePct = readFirstNumber(overrides, ['KESTREL_RELOAD_DISTANCE_PCT'], config.reload.minDistancePct);
  config.reload.requireTrend = readFirstBoolean(overrides, ['KESTREL_RELOAD_REQUIRE_TREND'], config.reload.requireTrend);

  config.exits.tp1Pct = readFirstNumber(overrides, ['KESTREL_TP1_PCT'], config.exits.tp1Pct);
  config.exits.tp1SellRatio = readFirstNumber(overrides, ['KESTREL_TP1_SELL_RATIO'], config.exits.tp1SellRatio);
  config.exits.trailTriggerPct = readFirstNumber(overrides, ['KESTREL_TRAIL_TRIGGER_PCT'], config.exits.trailTriggerPct);
  config.exits.trailPct = readFirstNumber(overrides, ['KESTREL_TRAIL_PCT'], config.exits.trailPct);
  config.exits.hardStopPct = readFirstNumber(overrides, ['KESTREL_HARD_STOP_PCT'], config.exits.hardStopPct);
  config.exits.stopLookback = readFirstNumber(overrides, ['KESTREL_STOP_LOOKBACK'], config.exits.stopLookback);
  config.exits.stopBufferPct = readFirstNumber(overrides, ['KESTREL_STOP_BUFFER_PCT'], config.exits.stopBufferPct);
  config.exits.postEntryGraceSeconds = readFirstNumber(
    overrides,
    ['KESTREL_POST_ENTRY_GRACE_SECONDS'],
    config.exits.postEntryGraceSeconds
  );
  config.exits.timeStopMinutes = readFirstNumber(overrides, ['KESTREL_TIME_STOP_MINUTES'], config.exits.timeStopMinutes);
  config.exits.timeStopMaxProfitPct = readFirstNumber(
    overrides,
    ['KESTREL_TIME_STOP_MAX_PROFIT_PCT'],
    config.exits.timeStopMaxProfitPct
  );
  config.exits.momentumExitRsi = readFirstNumber(overrides, ['KESTREL_MOMENTUM_EXIT_RSI'], config.exits.momentumExitRsi);

  config.visuals.enableCharts = readFirstBoolean(overrides, ['ENABLE_CHARTS'], config.visuals.enableCharts);
  config.visuals.enableShapes = readFirstBoolean(overrides, ['ENABLE_CHART_SHAPES', 'DISPLAY_CHART_SHAPES'], config.visuals.enableShapes);
  config.telemetry.enableNotifications = readFirstBoolean(overrides, ['ENABLE_NOTIFICATIONS'], config.telemetry.enableNotifications);
  config.telemetry.enableDebugLogs = readFirstBoolean(overrides, ['ENABLE_DEBUG_LOGS', 'VERBOSE'], config.telemetry.enableDebugLogs);
  config.telemetry.logMode = normalizeLogMode(
    readFirstString(overrides, ['KESTREL_LOG_MODE'], config.telemetry.logMode)
  );

  config.capital.tradeLimitBase = Math.max(0, config.capital.tradeLimitBase);
  config.capital.fundsReserveBase = Math.max(0, config.capital.fundsReserveBase);
  config.capital.actionCooldownSeconds = Math.max(1, config.capital.actionCooldownSeconds);
  config.capital.reentryCooldownMinutes = Math.max(0, config.capital.reentryCooldownMinutes);
  config.minCandles = Math.max(40, config.minCandles);
  config.trend.emaFast = Math.max(2, config.trend.emaFast);
  config.trend.emaSlow = Math.max(config.trend.emaFast + 1, config.trend.emaSlow);
  config.trend.slopeLookback = Math.max(1, config.trend.slopeLookback);
  config.pullback.lookback = Math.max(4, config.pullback.lookback);
  config.confirm.closeLocation = clamp(config.confirm.closeLocation, 0.10, 0.95);
  config.confirm.minBouncePct = clamp(config.confirm.minBouncePct, 0, 1.50);
  config.momentum.rsiLength = Math.max(2, config.momentum.rsiLength);
  config.liquidity.volumeLookback = Math.max(3, config.liquidity.volumeLookback);
  config.liquidity.projectedVolumeFloor = clamp(config.liquidity.projectedVolumeFloor, 0.10, 1.0);
  config.risk.minEntryScore = clamp(config.risk.minEntryScore, 1, 5);
  config.reload.maxCount = Math.max(0, Math.floor(config.reload.maxCount));
  config.exits.tp1SellRatio = clamp(config.exits.tp1SellRatio, 0.05, 1.0);
  config.exits.stopLookback = Math.max(2, config.exits.stopLookback);
  config.exits.postEntryGraceSeconds = Math.max(0, config.exits.postEntryGraceSeconds);

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
    throw new Error('Kestrel could not resolve the Gunbot runtime object.');
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
  if (!pairLedger.customStratStore.kestrel || typeof pairLedger.customStratStore.kestrel !== 'object' || Array.isArray(pairLedger.customStratStore.kestrel)) {
    pairLedger.customStratStore.kestrel = {};
  }

  var state = pairLedger.customStratStore.kestrel;
  if (!state.notificationKeys || typeof state.notificationKeys !== 'object') {
    state.notificationKeys = {};
  }
  state.metaVersion = KESTREL_META.version;
  if (typeof state.phase !== 'string') {
    state.phase = 'flat';
  }
  if (typeof state.reloadCount !== 'number') {
    state.reloadCount = 0;
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
  if (typeof state.lastTrendOk !== 'boolean') {
    state.lastTrendOk = false;
  }
  if (typeof state.lastSetupArmed !== 'boolean') {
    state.lastSetupArmed = false;
  }
  if (typeof state.lastSkipReason !== 'string') {
    state.lastSkipReason = '';
  }
  if (typeof state.lastCycleSummaryKey !== 'string') {
    state.lastCycleSummaryKey = '';
  }
  if (typeof state.lastActionLabel !== 'string') {
    state.lastActionLabel = '';
  }
  if (typeof state.lastNotificationPruneAt !== 'number') {
    state.lastNotificationPruneAt = 0;
  }

  gb.data.pairLedger = pairLedger;
  return state;
}

function logPrefix(gb) {
  return '[' + KESTREL_META.name + ' ' + KESTREL_META.version + '][' + String(gb.data.exchangeName || '') + '][' + String(gb.data.pairName || '') + ']';
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

function calculateEMA(values, period) {
  var result = [];
  var previous;
  var multiplier;
  var i;
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
  var atr = 0;
  var i;
  if (!high || !low || !close || high.length !== low.length || high.length !== close.length || !high.length) {
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

function buildLiquidityReason(spreadPct, relativeVolume, signalRangePct, config) {
  if (spreadPct > config.liquidity.maxSpreadPct) {
    return 'spread-too-wide';
  }
  if (relativeVolume < config.liquidity.minRelativeVolume) {
    return 'volume-too-light';
  }
  if (signalRangePct > config.liquidity.maxSignalRangePct) {
    return 'range-too-wide';
  }
  return 'ok';
}

function analyzeFrame(gb, config, state, hasBag) {
  var candles = normalizeLocalCandles(gb);
  var close;
  var open;
  var high;
  var low;
  var volume;
  var timestamp;
  var size;
  var fastSeries;
  var slowSeries;
  var rsiSeries;
  var atrSeries;
  var lastIndex;
  var bid;
  var ask;
  var closeLast;
  var openLast;
  var highLast;
  var lowLast;
  var volumeLast;
  var completedVolume;
  var effectiveVolume;
  var fastLast;
  var fastPrev;
  var slowLast;
  var rsiLast;
  var rsiPrev;
  var atrLast;
  var recentHigh;
  var swingLow;
  var pullbackPct;
  var bouncePct;
  var closeLocation;
  var spreadPct;
  var avgVolume;
  var projectedVolume;
  var volumeProgressRatio;
  var relativeVolume;
  var signalRangePct;
  var slopeReferenceIndex;
  var slopePct;
  var trendOk;
  var pullbackOk;
  var confirmOk;
  var momentumOk;
  var liquidityOk;
  var trendReason;
  var pullbackReason;
  var confirmReason;
  var momentumReason;
  var liquidityReason;
  var score = 0;
  var entryTarget;
  var stopPrice;
  var tp1Price;
  var reloadTarget;
  var trailTriggerPrice;
  var currentPeriodMinutes;

  if (!candles) {
    return {
      ready: false,
      reason: 'waiting-local-candles'
    };
  }

  close = candles.close;
  open = candles.open;
  high = candles.high;
  low = candles.low;
  volume = candles.volume;
  timestamp = candles.timestamp;
  size = close.length;

  if (size < config.minCandles) {
    return {
      ready: false,
      reason: 'local-data-short'
    };
  }

  fastSeries = calculateEMA(close, config.trend.emaFast);
  slowSeries = calculateEMA(close, config.trend.emaSlow);
  rsiSeries = calculateRSI(close, config.momentum.rsiLength);
  atrSeries = calculateATR(high, low, close, 14);
  lastIndex = size - 1;
  bid = Math.max(safeNumber(gb.data.bid, 0), safeNumber(close[lastIndex], 0));
  ask = Math.max(bid, safeNumber(gb.data.ask, bid));
  closeLast = close[lastIndex];
  openLast = open[lastIndex];
  highLast = high[lastIndex];
  lowLast = low[lastIndex];
  volumeLast = volume[lastIndex];
  completedVolume = volume[Math.max(0, lastIndex - 1)];
  fastLast = lastDefined(fastSeries) || bid;
  fastPrev = previousDefined(fastSeries) || fastLast;
  slowLast = lastDefined(slowSeries) || bid;
  rsiLast = lastDefined(rsiSeries);
  rsiPrev = previousDefined(rsiSeries);
  atrLast = lastDefined(atrSeries) || Math.max(0, highLast - lowLast);
  recentHigh = highestFromEnd(high, config.pullback.lookback);
  swingLow = lowestFromEnd(low, config.exits.stopLookback);
  currentPeriodMinutes = safeNumber(gb.data.period, safeNumber(activeOverrides(gb).PERIOD, 0));
  if (!currentPeriodMinutes) {
    currentPeriodMinutes = 5;
  }

  pullbackPct = recentHigh > 0 ? ((recentHigh - bid) / recentHigh) * 100 : 0;
  bouncePct = lowLast > 0 ? ((closeLast - lowLast) / lowLast) * 100 : 0;
  closeLocation = highLast > lowLast ? (closeLast - lowLast) / (highLast - lowLast) : 0.5;
  spreadPct = bid > 0 && ask > 0 ? ((ask - bid) / bid) * 100 : 0;
  avgVolume = average(volume.slice(Math.max(0, volume.length - config.liquidity.volumeLookback - 1), volume.length - 1));
  volumeProgressRatio = candleProgressRatio(
    timestamp[lastIndex],
    currentPeriodMinutes,
    Date.now(),
    config.liquidity.projectedVolumeFloor
  );
  projectedVolume = projectSignalVolume(
    volumeLast,
    timestamp[lastIndex],
    currentPeriodMinutes,
    Date.now(),
    config
  );
  effectiveVolume = Math.max(projectedVolume, Math.max(0, safeNumber(completedVolume, 0)));
  relativeVolume = avgVolume > 0 ? effectiveVolume / avgVolume : 1;
  signalRangePct = lowLast > 0 ? ((highLast - lowLast) / lowLast) * 100 : 0;
  slopeReferenceIndex = Math.max(0, lastIndex - config.trend.slopeLookback);
  slopePct = percentChange(fastSeries[slopeReferenceIndex], fastLast);

  trendOk = fastLast > slowLast &&
    slopePct >= config.trend.minSlopePct &&
    bid >= (slowLast * (1 - (config.trend.maxBelowSlowPct / 100)));
  trendReason = trendOk ? 'ok' : 'trend-fail';

  if (bid > (fastLast * (1 + (config.pullback.zoneBufferPct / 100)))) {
    pullbackReason = 'above-pullback-zone';
  } else if (pullbackPct < config.pullback.minPullbackPct) {
    pullbackReason = 'pullback-too-shallow';
  } else if (pullbackPct > config.pullback.maxPullbackPct) {
    pullbackReason = 'pullback-too-deep';
  } else {
    pullbackReason = 'ok';
  }
  pullbackOk = pullbackReason === 'ok';

  if (config.confirm.requireCloseAboveFast && closeLast < fastLast) {
    confirmReason = 'below-reclaim-trigger';
  } else if (config.confirm.requireBullishClose && closeLast <= openLast) {
    confirmReason = 'bearish-signal-close';
  } else if (closeLocation < config.confirm.closeLocation) {
    confirmReason = 'weak-close-location';
  } else if (bouncePct < config.confirm.minBouncePct) {
    confirmReason = 'no-bounce';
  } else if (closeLast <= close[lastIndex - 1]) {
    confirmReason = 'no-close-improvement';
  } else {
    confirmReason = 'ok';
  }
  confirmOk = confirmReason === 'ok';

  if (!isFinite(rsiLast)) {
    momentumReason = 'rsi-unavailable';
  } else if (rsiLast < config.momentum.rsiFloor) {
    momentumReason = 'rsi-below-floor';
  } else if (rsiLast > config.momentum.rsiCeiling) {
    momentumReason = 'rsi-above-ceiling';
  } else if ((rsiLast - (rsiPrev || rsiLast)) < config.momentum.minRsiDelta) {
    momentumReason = 'rsi-delta-weak';
  } else {
    momentumReason = 'ok';
  }
  momentumOk = momentumReason === 'ok';

  liquidityReason = buildLiquidityReason(spreadPct, relativeVolume, signalRangePct, config);
  liquidityOk = liquidityReason === 'ok';

  if (trendOk) {
    score += 1;
  }
  if (pullbackOk) {
    score += 1;
  }
  if (confirmOk) {
    score += 1;
  }
  if (momentumOk) {
    score += 1;
  }
  if (liquidityOk) {
    score += 1;
  }

  entryTarget = fastLast;
  stopPrice = Math.min(
    bid * (1 - (config.exits.hardStopPct / 100)),
    (swingLow > 0 ? swingLow : bid) * (1 - (config.exits.stopBufferPct / 100))
  );
  if (!isFinite(stopPrice) || stopPrice <= 0 || stopPrice >= bid) {
    stopPrice = bid * (1 - (config.exits.hardStopPct / 100));
  }
  tp1Price = (safeNumber(gb.data.breakEven, 0) > 0 ? safeNumber(gb.data.breakEven, 0) : bid) * (1 + (config.exits.tp1Pct / 100));
  trailTriggerPrice = (safeNumber(gb.data.breakEven, 0) > 0 ? safeNumber(gb.data.breakEven, 0) : bid) * (1 + (config.exits.trailTriggerPct / 100));
  reloadTarget = state.lastFillPrice > 0
    ? state.lastFillPrice * (1 - (config.reload.minDistancePct / 100))
    : bid * (1 - (config.reload.minDistancePct / 100));

  return {
    ready: true,
    open: open,
    high: high,
    low: low,
    close: close,
    volume: volume,
    timestamp: timestamp,
    currentPeriodMinutes: currentPeriodMinutes,
    bid: bid,
    ask: ask,
    openLast: openLast,
    highLast: highLast,
    lowLast: lowLast,
    closeLast: closeLast,
    fast: fastLast,
    slow: slowLast,
    rsi: rsiLast || 0,
    atr: atrLast || 0,
    pullbackPct: pullbackPct,
    bouncePct: bouncePct,
    closeLocation: closeLocation,
    score: score,
    scoreMax: 5,
    trend: {
      ok: trendOk,
      slopePct: slopePct,
      reason: trendReason
    },
    pullback: {
      ok: pullbackOk,
      reason: pullbackReason,
      recentHigh: recentHigh
    },
    confirm: {
      ok: confirmOk,
      reason: confirmReason
    },
    momentum: {
      ok: momentumOk,
      reason: momentumReason,
      delta: isFinite(rsiLast) && isFinite(rsiPrev) ? (rsiLast - rsiPrev) : 0
    },
    liquidity: {
      ok: liquidityOk,
      reason: liquidityReason,
      spreadPct: spreadPct,
      relativeVolume: relativeVolume,
      avgVolume: avgVolume,
      signalVolume: volumeLast,
      completedVolume: completedVolume,
      effectiveVolume: effectiveVolume,
      projectedVolume: projectedVolume,
      volumeProgressRatio: volumeProgressRatio,
      signalRangePct: signalRangePct
    },
    entryTarget: entryTarget,
    stopPrice: stopPrice,
    tp1Price: tp1Price,
    trailTriggerPrice: trailTriggerPrice,
    reloadTarget: reloadTarget,
    lastTimestamp: timestamp.length ? timestamp[timestamp.length - 1] : 0
  };
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
  var bid = Math.max(safeNumber(gb.data.bid, 0), safeNumber(gb.data.ask, 0), safeNumber(gb.data.breakEven, 0));
  var positionValueBase = quoteAmountToBaseValue(quoteBalance, bid);
  var minimumSellBaseValue = minBaseVolumeToSell(gb);
  if (safeBoolean(gb.data.gotBag, false)) {
    return true;
  }
  return quoteBalance > 0 && (minimumSellBaseValue === 0 || positionValueBase >= minimumSellBaseValue);
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

function updateBagRecovery(gb, state, hasBag) {
  var recoveredEntryTime = recoveredBagEntryTime(gb);
  if (hasBag) {
    if (state.entryTime <= 0) {
      if (recoveredEntryTime > 0) {
        state.entryTime = recoveredEntryTime;
      } else {
        state.entryTime = Date.now();
      }
    } else if (state.phase === 'entry-pending' && recoveredEntryTime > state.entryTime) {
      state.entryTime = recoveredEntryTime;
    }
    if (state.phase === 'flat' || state.phase === 'cooldown') {
      state.phase = state.tp1Done ? 'runner' : 'bag';
    }
  }
}

function buildCompositeScore(frameMetrics) {
  return frameMetrics.score;
}

function buildSkipReason(runtime, frameMetrics, hasBag, hasOpenOrders, buyEnabled, enoughEntryBalance, compositeScore, config) {
  if (hasBag) {
    return 'manage-bag';
  }
  if (hasOpenOrders) {
    return 'open-order';
  }
  if (!buyEnabled) {
    return 'buy-disabled';
  }
  if (!enoughEntryBalance) {
    return 'insufficient-balance';
  }
  if (runtime.actionCooldownActive) {
    return 'action-cooldown';
  }
  if (runtime.reentryCooldownActive) {
    return 'reentry-cooldown';
  }
  if (!frameMetrics.trend.ok) {
    return frameMetrics.trend.reason;
  }
  if (!frameMetrics.pullback.ok) {
    return frameMetrics.pullback.reason;
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
  if (compositeScore < config.risk.minEntryScore) {
    return 'score-below-minimum';
  }
  return 'entry-ready';
}

function determineSetupStage(frameMetrics, hasBag, compositeScore, config) {
  if (hasBag) {
    return frameMetrics.trend.ok ? 'bag-manage' : 'bag-risk';
  }
  if (!frameMetrics.trend.ok) {
    return 'trend-blocked';
  }
  if (!frameMetrics.pullback.ok) {
    return 'pullback-watch';
  }
  if (!frameMetrics.confirm.ok) {
    return 'reclaim-watch';
  }
  if (!frameMetrics.momentum.ok) {
    return 'momentum-watch';
  }
  if (!frameMetrics.liquidity.ok) {
    return 'liquidity-screen';
  }
  if (compositeScore < config.risk.minEntryScore) {
    return 'score-blocked';
  }
  return 'entry-ready';
}

function updateTrailingState(state, frameMetrics, breakEven, config) {
  if (!state.tp1Done) {
    state.trailPeak = 0;
    state.trailStop = 0;
    return;
  }

  if (state.trailPeak <= 0 && frameMetrics.bid >= frameMetrics.trailTriggerPrice) {
    state.trailPeak = frameMetrics.bid;
  }
  if (state.trailPeak > 0) {
    state.trailPeak = Math.max(state.trailPeak, frameMetrics.bid);
    state.trailStop = state.trailPeak * (1 - (config.exits.trailPct / 100));
    if (breakEven > 0) {
      state.trailStop = Math.max(state.trailStop, breakEven);
    }
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
  var retained = [];
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
    } else {
      retained.push({ key: key, timestamp: timestamp });
    }
  }

  if (retained.length > limit) {
    retained.sort(function (left, right) {
      return right.timestamp - left.timestamp;
    });
    for (i = limit; i < retained.length; i += 1) {
      delete state.notificationKeys[retained[i].key];
    }
  }

  state.lastNotificationPruneAt = now;
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

function buildCycleSummaryKey(frameMetrics, state, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, stage) {
  return [
    frameMetrics.lastTimestamp || 0,
    stage,
    phaseName(state, hasBag, setupArmed, reentryCooldownActive),
    hasBag ? 1 : 0,
    setupArmed ? 1 : 0,
    skipReason,
    compositeScore,
    state.reloadCount,
    state.tp1Done ? 1 : 0,
    roundTo(safeNumber(state.trailStop, 0), 6)
  ].join('|');
}

function buildCycleSummaryLine(gb, config, frameMetrics, state, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, stage) {
  return [
    'tf=' + String(frameMetrics.currentPeriodMinutes) + 'm',
    'bid=' + formatPrice(frameMetrics.bid),
    'phase=' + phaseName(state, hasBag, setupArmed, reentryCooldownActive),
    'stage=' + stage,
    'score=' + formatScore(compositeScore, 5),
    'setup=' + (setupArmed ? 'armed' : 'idle'),
    'skip=' + skipReason,
    'trend=' + (frameMetrics.trend.ok ? 'ok' : frameMetrics.trend.reason),
    'pullback=' + (frameMetrics.pullback.ok ? 'ok' : frameMetrics.pullback.reason),
    'reclaim=' + (frameMetrics.confirm.ok ? 'ok' : frameMetrics.confirm.reason),
    'momentum=' + (frameMetrics.momentum.ok ? 'ok' : frameMetrics.momentum.reason),
    'liquidity=' + (frameMetrics.liquidity.ok ? 'ok' : frameMetrics.liquidity.reason),
    'spread=' + formatPercent(frameMetrics.liquidity.spreadPct),
    'relvol=' + roundTo(frameMetrics.liquidity.relativeVolume, 2).toFixed(2) + 'x',
    'pull=' + formatPercent(frameMetrics.pullbackPct),
    'rsi=' + roundTo(frameMetrics.rsi, 1).toFixed(1),
    'reload=' + String(state.reloadCount) + '/' + String(config.reload.maxCount),
    'stop=' + formatPrice(frameMetrics.stopPrice)
  ].join(' ');
}

function emitCycleSummary(gb, config, state, frameMetrics, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, stage) {
  var summaryKey;
  if (config.telemetry.logMode === 'events') {
    return;
  }
  summaryKey = buildCycleSummaryKey(frameMetrics, state, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, stage);
  if (config.telemetry.logMode === 'changes' && state.lastCycleSummaryKey === summaryKey) {
    return;
  }
  state.lastCycleSummaryKey = summaryKey;
  console.log(logPrefix(gb) + '[STATE] ' + buildCycleSummaryLine(gb, config, frameMetrics, state, hasBag, setupArmed, skipReason, compositeScore, reentryCooldownActive, stage));
}

function clearChartObjects(gb) {
  gb.data.pairLedger.customBuyTarget = null;
  gb.data.pairLedger.customSellTarget = null;
  gb.data.pairLedger.customStopTarget = null;
  gb.data.pairLedger.customCloseTarget = null;
  gb.data.pairLedger.customTrailingTarget = null;
  gb.data.pairLedger.customDcaTarget = null;
  gb.data.pairLedger.customChartTargets = [];
  gb.data.pairLedger.customChartShapes = [];
}

function createChartTarget(text, price, quantity, lineStyle, lineWidth, lineColor, bodyTextColor) {
  if (!isFinite(price) || price <= 0) {
    return null;
  }
  return {
    text: text,
    price: price,
    quantity: quantity || '',
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

function buildShapeWindow(frameMetrics, candlesBack, candlesForward) {
  var lastTime = normalizeTimestampToSeconds(frameMetrics.lastTimestamp);
  var periodSeconds = Math.max(60, Math.floor(safeNumber(frameMetrics.currentPeriodMinutes, 1) * 60));

  if (!lastTime) {
    lastTime = Math.floor(Date.now() / 1000);
  }

  return {
    startTime: lastTime - (periodSeconds * Math.max(1, candlesBack || 1)),
    endTime: lastTime + (periodSeconds * Math.max(1, candlesForward || 1))
  };
}

function setChartObjects(gb, config, state, frameMetrics, hasBag, stage) {
  var ledger = gb.data.pairLedger;
  var targets = [];
  var shapes = [];
  var entryPrice = Math.max(safeNumber(gb.data.breakEven, 0), safeNumber(state.lastFillPrice, 0));
  var zoneTop = frameMetrics.fast * (1 + (config.pullback.zoneBufferPct / 100));
  var zoneBottom = frameMetrics.fast * (1 - (config.pullback.zoneBufferPct / 100));
  var riskTop = Math.max(frameMetrics.entryTarget, entryPrice, frameMetrics.bid);
  var window = buildShapeWindow(frameMetrics, 3, 2);
  var target;

  if (!config.visuals.enableCharts) {
    clearChartObjects(gb);
    return;
  }

  ledger.customBuyTarget = hasBag ? null : frameMetrics.entryTarget;
  ledger.customSellTarget = frameMetrics.tp1Price;
  ledger.customStopTarget = frameMetrics.stopPrice;
  ledger.customCloseTarget = hasBag && state.tp1Done && state.trailStop > 0 ? state.trailStop : null;
  ledger.customTrailingTarget = state.tp1Done ? state.trailStop : null;
  ledger.customDcaTarget = hasBag && config.reload.maxCount > 0 ? frameMetrics.reloadTarget : null;

  target = createChartTarget('Kestrel Fast EMA', frameMetrics.fast, '', 1, 1, KESTREL_COLORS.info, '#0f1a2b');
  if (target) {
    targets.push(target);
  }
  target = createChartTarget('Kestrel Slow EMA', frameMetrics.slow, '', 1, 1, KESTREL_COLORS.neutral, '#111827');
  if (target) {
    targets.push(target);
  }
  if (hasBag && entryPrice > 0) {
    target = createChartTarget('Kestrel Entry Fill', entryPrice, '', 1, 1, KESTREL_COLORS.neutral, '#111827');
    if (target) {
      targets.push(target);
    }
  }
  target = createChartTarget(hasBag ? 'Kestrel TP1' : 'Kestrel Buy Watch', hasBag ? frameMetrics.tp1Price : frameMetrics.entryTarget, '', 0, 2, hasBag ? KESTREL_COLORS.good : KESTREL_COLORS.warn, '#122018');
  if (target) {
    targets.push(target);
  }
  target = createChartTarget('Kestrel Stop', frameMetrics.stopPrice, '', 2, 1, KESTREL_COLORS.bad, '#2b1111');
  if (target) {
    targets.push(target);
  }
  if (state.tp1Done && state.trailStop > 0) {
    target = createChartTarget('Kestrel Trail', state.trailStop, '', 0, 2, KESTREL_COLORS.good, '#122018');
    if (target) {
      targets.push(target);
    }
  }
  if (hasBag && config.reload.maxCount > 0) {
    target = createChartTarget('Kestrel Reload', frameMetrics.reloadTarget, '', 1, 1, KESTREL_COLORS.warn, '#2b2110');
    if (target) {
      targets.push(target);
    }
  }
  ledger.customChartTargets = targets;

  if (config.visuals.enableShapes) {
    target = buildRectangleShape(window.startTime, window.endTime, zoneTop, zoneBottom, KESTREL_COLORS.zoneFill, KESTREL_COLORS.zoneBorder);
    if (target) {
      shapes.push(target);
    }
    target = buildRectangleShape(window.startTime, window.endTime, riskTop, frameMetrics.stopPrice, KESTREL_COLORS.stopFill, KESTREL_COLORS.stopBorder);
    if (target) {
      shapes.push(target);
    }
    ledger.customChartShapes = shapes;
  } else {
    ledger.customChartShapes = [];
  }
}

function updateSidebar(gb, config, frameMetrics, state, runtime, hasBag, setupArmed, skipReason, compositeScore, stage) {
  gb.data.pairLedger.sidebarExtras = [
    { label: 'Kestrel', value: KESTREL_META.version, valueColor: KESTREL_COLORS.info },
    { label: 'Trend', value: frameMetrics.trend.ok ? 'ON' : 'OFF', valueColor: frameMetrics.trend.ok ? KESTREL_COLORS.good : KESTREL_COLORS.bad },
    { label: 'Score', value: formatScore(compositeScore, 5), valueColor: compositeScore >= config.risk.minEntryScore ? KESTREL_COLORS.good : KESTREL_COLORS.warn },
    { label: 'Stage', value: stage, valueColor: KESTREL_COLORS.neutral },
    { label: 'Setup', value: setupArmed ? 'ARMED' : 'IDLE', valueColor: setupArmed ? KESTREL_COLORS.good : KESTREL_COLORS.neutral },
    { label: 'Phase', value: phaseName(state, hasBag, setupArmed, runtime.reentryCooldownActive), valueColor: hasBag ? KESTREL_COLORS.good : KESTREL_COLORS.neutral },
    { label: 'Reload', value: String(state.reloadCount) + '/' + String(config.reload.maxCount), valueColor: KESTREL_COLORS.neutral },
    { label: 'Trail', value: state.trailStop > 0 ? formatPrice(state.trailStop) : '--', valueColor: state.trailStop > 0 ? KESTREL_COLORS.good : KESTREL_COLORS.neutral },
    { label: 'Stop', value: formatPrice(frameMetrics.stopPrice), valueColor: KESTREL_COLORS.bad },
    { label: 'Spread', value: formatPercent(frameMetrics.liquidity.spreadPct), valueColor: frameMetrics.liquidity.ok ? KESTREL_COLORS.good : KESTREL_COLORS.bad },
    { label: 'RSI', value: roundTo(frameMetrics.rsi, 1).toFixed(1), valueColor: frameMetrics.momentum.ok ? KESTREL_COLORS.good : KESTREL_COLORS.warn },
    { label: 'Skip', value: skipReason, valueColor: skipReason === 'entry-ready' ? KESTREL_COLORS.good : KESTREL_COLORS.warn }
  ];
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
    logWarn(gb, 'buy-skip', label + ' order value ' + formatPrice(orderValueBase) + ' is below MIN_VOLUME_TO_BUY ' + formatPrice(minimumBuyBaseValue));
    return false;
  }

  result = await gb.method.buyMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);
  if (!result) {
    return false;
  }
  state.lastActionAt = Date.now();
  state.lastActionLabel = label;
  state.lastFillPrice = executionPrice;
  if (label === 'entry') {
    state.entryTime = Date.now();
    state.reloadCount = 0;
    state.tp1Done = false;
    state.trailPeak = 0;
    state.trailStop = 0;
    state.phase = 'entry-pending';
  } else {
    state.reloadCount += 1;
    state.phase = 'bag';
  }

  logInfo(gb, label, 'Executed ' + label + ' market buy for ' + formatPrice(amountQuote) + ' quote units at approx ' + formatPrice(executionPrice) + ' with score ' + compositeScore + '/5');
  emitChartMark(gb, 'Kestrel ' + label + ' @ ' + formatPrice(executionPrice));
  return true;
}

function normalizedSellAmount(gb, requestedAmount, forceFullIfNeeded) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var marketPrice = Math.max(safeNumber(gb.data.bid, 0), safeNumber(gb.data.ask, 0), safeNumber(gb.data.breakEven, 0));
  var minimumSellBaseValue = minBaseVolumeToSell(gb);
  var amount = Math.min(requestedAmount, quoteBalance);
  var amountValueBase = quoteAmountToBaseValue(amount, marketPrice);
  var fullValueBase = quoteAmountToBaseValue(quoteBalance, marketPrice);

  if (amount <= 0 || quoteBalance <= 0) {
    return 0;
  }
  if (minimumSellBaseValue > 0 && amountValueBase < minimumSellBaseValue) {
    if (forceFullIfNeeded && fullValueBase >= minimumSellBaseValue) {
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

  logInfo(gb, label, 'Executed ' + label + ' market sell for ' + formatPrice(amountQuote) + ' quote units at approx ' + formatPrice(frameMetrics.bid));
  emitChartMark(gb, 'Kestrel ' + label + ' @ ' + formatPrice(frameMetrics.bid));
  return true;
}

function clearBagState(state, config) {
  state.phase = 'cooldown';
  state.reloadCount = 0;
  state.tp1Done = false;
  state.trailPeak = 0;
  state.trailStop = 0;
  state.lastFillPrice = 0;
  state.entryTime = 0;
  state.cooldownUntil = Date.now() + (config.capital.reentryCooldownMinutes * 60 * 1000);
}

async function runKestrelStrategy(gb) {
  var config = buildConfig(gb);
  var state = ensureState(gb);
  var runtime = {
    now: Date.now()
  };
  var buyEnabled;
  var sellEnabled;
  var hasBag;
  var hasOpenOrders;
  var availableBase;
  var enoughEntryBalance;
  var frameMetrics;
  var compositeScore;
  var skipReason;
  var setupArmed;
  var stage;
  var breakEven;
  var requestedBuyAmount;
  var reloadAmount;
  var sellAmount;
  var pnlPct;
  var ageMinutes;

  pruneNotificationKeys(state, config, runtime.now);
  runtime.actionCooldownActive = (runtime.now - safeNumber(state.lastActionAt, 0)) < (config.capital.actionCooldownSeconds * 1000);
  runtime.reentryCooldownActive = runtime.now < safeNumber(state.cooldownUntil, 0);

  buyEnabled = canUseBuyToggle(gb, config);
  sellEnabled = canUseSellToggle(gb, config);
  hasBag = hasUsableBag(gb);
  hasOpenOrders = !!(gb.data.openOrders && gb.data.openOrders.length);
  availableBase = availableBaseForBuys(gb, config);
  enoughEntryBalance = availableBase >= config.capital.tradeLimitBase;
  updateBagRecovery(gb, state, hasBag);
  runtime.postEntryGraceActive = hasBag &&
    safeNumber(state.lastActionAt, 0) > 0 &&
    (state.lastActionLabel === 'entry' || state.lastActionLabel === 'reload') &&
    ((runtime.now - safeNumber(state.lastActionAt, 0)) < (config.exits.postEntryGraceSeconds * 1000));

  if (!config.enabled) {
    clearChartObjects(gb);
    updateSidebar(gb, config, {
      trend: { ok: false },
      liquidity: { spreadPct: 0, ok: false },
      stopPrice: 0,
      rsi: 0
    }, state, runtime, hasBag, false, 'disabled', 0, 'disabled');
    if (state.lastSkipReason !== 'disabled') {
      logInfo(gb, 'disabled', 'Kestrel is disabled by override.');
    }
    state.lastSkipReason = 'disabled';
    state.lastSetupArmed = false;
    state.lastTrendOk = false;
    state.phase = hasBag ? 'bag' : 'flat';
    return;
  }

  frameMetrics = analyzeFrame(gb, config, state, hasBag);
  if (!frameMetrics.ready) {
    clearChartObjects(gb);
    if (state.lastSkipReason !== frameMetrics.reason) {
      logDebug(gb, config, 'skip', 'Skipping cycle because ' + frameMetrics.reason);
    }
    state.lastSkipReason = frameMetrics.reason;
    state.lastSetupArmed = false;
    state.lastTrendOk = false;
    state.phase = hasBag ? 'bag' : 'flat';
    return;
  }

  compositeScore = buildCompositeScore(frameMetrics);
  skipReason = buildSkipReason(runtime, frameMetrics, hasBag, hasOpenOrders, buyEnabled, enoughEntryBalance, compositeScore, config);
  setupArmed = !hasBag &&
    !hasOpenOrders &&
    !runtime.actionCooldownActive &&
    !runtime.reentryCooldownActive &&
    buyEnabled &&
    enoughEntryBalance &&
    frameMetrics.trend.ok &&
    frameMetrics.pullback.ok &&
    frameMetrics.liquidity.ok &&
    compositeScore >= Math.max(1, config.risk.minEntryScore - 1);
  stage = determineSetupStage(frameMetrics, hasBag, compositeScore, config);
  breakEven = safeNumber(gb.data.breakEven, 0);

  updateTrailingState(state, frameMetrics, breakEven, config);

  if (setupArmed && !state.lastSetupArmed) {
    sendNotification(gb, config, state, 'setup-armed', createNotification('Kestrel setup armed on ' + gb.data.pairName + ' with score ' + compositeScore + '/5.', 'info', false));
    logInfo(gb, 'setup-armed', 'Setup armed with score ' + compositeScore + '/5.');
  }

  if (state.lastTrendOk && !frameMetrics.trend.ok) {
    sendNotification(gb, config, state, 'trend-off', createNotification('Kestrel trend disabled on ' + gb.data.pairName + '.', 'warning', false));
  }
  if (!state.lastTrendOk && frameMetrics.trend.ok) {
    resetNotificationKey(state, 'trend-off');
    sendNotification(gb, config, state, 'trend-on', createNotification('Kestrel trend enabled on ' + gb.data.pairName + '.', 'info', false));
  }

  if (hasBag && !state.lastActionLabel) {
    state.phase = state.tp1Done ? 'runner' : 'bag';
  }
  if (state.phase === 'entry-pending' && hasBag) {
    state.phase = 'bag';
  }
  if (!hasBag && state.phase === 'entry-pending') {
    state.phase = 'flat';
  }
  if (state.lastSetupArmed && !setupArmed) {
    resetNotificationKey(state, 'setup-armed');
  }

  if (!state.lastTrendOk && frameMetrics.trend.ok) {
    resetNotificationKey(state, 'trend-on');
  }

  if (state.lastTrendOk && !frameMetrics.trend.ok) {
    resetNotificationKey(state, 'trend-on');
  }

  if (state.lastSetupArmed && !setupArmed) {
    resetNotificationKey(state, 'setup-armed');
  }

  if (state.lastTrendOk && frameMetrics.trend.ok) {
    resetNotificationKey(state, 'trend-off');
  }

  if (state.lastTrendOk !== frameMetrics.trend.ok) {
    state.lastTrendOk = frameMetrics.trend.ok;
  }

  if (state.lastSetupArmed !== setupArmed) {
    state.lastSetupArmed = setupArmed;
  }

  if (state.phase === 'cooldown' && !runtime.reentryCooldownActive && !hasBag) {
    state.phase = 'flat';
  }

  if (hasBag && !hasOpenOrders && skipReason === 'manage-bag' && sellEnabled) {
    pnlPct = breakEven > 0 ? percentChange(breakEven, frameMetrics.bid) : 0;
    ageMinutes = state.entryTime > 0 ? ((runtime.now - state.entryTime) / 60000) : 0;

    if (!state.tp1Done && frameMetrics.bid >= frameMetrics.tp1Price) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0) * config.exits.tp1SellRatio, true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'tp1', frameMetrics)) {
        sendNotification(gb, config, state, 'tp1-' + String(Date.now()), createNotification('Kestrel TP1 executed on ' + gb.data.pairName + '.', 'success', false));
      }
    } else if (state.tp1Done && state.trailStop > 0 && frameMetrics.bid <= state.trailStop) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'trail-exit', frameMetrics)) {
        sendNotification(gb, config, state, 'trail-exit-' + String(Date.now()), createNotification('Kestrel runner trail exit on ' + gb.data.pairName + '.', 'success', false));
        clearBagState(state, config);
      }
    } else if (frameMetrics.bid <= frameMetrics.stopPrice) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'stop-exit', frameMetrics)) {
        sendNotification(gb, config, state, 'stop-exit-' + String(Date.now()), createNotification('Kestrel stop exit on ' + gb.data.pairName + '.', 'warning', false));
        clearBagState(state, config);
      }
    } else if (!runtime.postEntryGraceActive && (frameMetrics.rsi <= config.exits.momentumExitRsi || frameMetrics.fast < frameMetrics.slow)) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'momentum-exit', frameMetrics)) {
        sendNotification(gb, config, state, 'momentum-exit-' + String(Date.now()), createNotification('Kestrel momentum exit on ' + gb.data.pairName + '.', 'warning', false));
        clearBagState(state, config);
      }
    } else if (!runtime.postEntryGraceActive && !state.tp1Done && ageMinutes >= config.exits.timeStopMinutes && pnlPct <= config.exits.timeStopMaxProfitPct) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'time-stop', frameMetrics)) {
        sendNotification(gb, config, state, 'time-stop-' + String(Date.now()), createNotification('Kestrel time stop exit on ' + gb.data.pairName + '.', 'warning', false));
        clearBagState(state, config);
      }
    }
  } else if (!hasBag && !hasOpenOrders && skipReason === 'entry-ready') {
    requestedBuyAmount = config.capital.tradeLimitBase / buyReferencePrice(frameMetrics);
    if (await executeBuy(gb, config, state, requestedBuyAmount, 'entry', compositeScore, frameMetrics)) {
      sendNotification(gb, config, state, 'entry-' + String(Date.now()), createNotification('Kestrel entry executed on ' + gb.data.pairName + ' at approx ' + formatPrice(frameMetrics.bid) + '.', 'success', false));
    }
  } else if (hasBag && !hasOpenOrders && buyEnabled && !runtime.actionCooldownActive && !runtime.reentryCooldownActive && state.reloadCount < config.reload.maxCount) {
    reloadAmount = config.capital.tradeLimitBase / buyReferencePrice(frameMetrics);
    pnlPct = breakEven > 0 ? percentChange(breakEven, frameMetrics.bid) : 0;
    if (
      frameMetrics.bid <= frameMetrics.reloadTarget &&
      frameMetrics.pullback.ok &&
      frameMetrics.liquidity.ok &&
      frameMetrics.confirm.ok &&
      (!config.reload.requireTrend || frameMetrics.trend.ok) &&
      availableBase >= config.capital.tradeLimitBase &&
      pnlPct > -1.5
    ) {
      if (await executeBuy(gb, config, state, reloadAmount, 'reload', compositeScore, frameMetrics)) {
        sendNotification(gb, config, state, 'reload-' + String(state.reloadCount) + '-' + String(Date.now()), createNotification('Kestrel reload executed on ' + gb.data.pairName + '.', 'warning', false));
      }
    }
  }

  if (!hasBag && state.phase === 'bag') {
    clearBagState(state, config);
  }

  setChartObjects(gb, config, state, frameMetrics, hasBag, stage);
  updateSidebar(gb, config, frameMetrics, state, runtime, hasBag, setupArmed, skipReason, compositeScore, stage);
  emitCycleSummary(gb, config, state, frameMetrics, hasBag, setupArmed, skipReason, compositeScore, runtime.reentryCooldownActive, stage);
  state.lastSkipReason = skipReason;
  if (!hasBag && state.phase !== 'cooldown' && state.phase !== 'entry-pending') {
    state.phase = setupArmed ? 'armed' : 'flat';
  }
}

async function kestrelEntryPoint(runtimeGb) {
  var gb = resolveGb(runtimeGb);
  if (!isExpectedStrategyFile(gb, 'Kestrel.js')) {
    return;
  }
  try {
    await runKestrelStrategy(gb);
  } catch (err) {
    logError(gb, 'fatal', 'Unhandled Kestrel runtime error.', err);
    throw err;
  }
}

if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = kestrelEntryPoint;
} else {
  kestrelEntryPoint(typeof gb !== 'undefined' ? gb : undefined);
}
