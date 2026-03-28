/*
 * Mako Micro Scalper
 * Version: 1.0.4
 * Updated: 2026-03-28
 *
 * Intrabar stretch-and-snapback Gunbot custom strategy.
 * Spot only. Long only.
 */

var MAKO_META = {
  name: 'Mako Micro Scalper',
  version: '1.0.4',
  updated: '2026-03-28'
};

var MAKO_COLORS = {
  good: '#2aa66a',
  bad: '#d25a5a',
  warn: '#d89b31',
  neutral: '#8793a3',
  info: '#3b86d1',
  zoneFill: 'rgba(59, 134, 209, 0.10)',
  zoneBorder: 'rgba(59, 134, 209, 0.42)',
  riskFill: 'rgba(210, 90, 90, 0.10)',
  riskBorder: 'rgba(210, 90, 90, 0.38)'
};

var MAKO_BASE_CONFIG = {
  enabled: true,
  profile: 'balanced',
  minCandles: 120,
  capital: {
    tradeLimitBase: 30,
    fundsReserveBase: 0,
    actionCooldownSeconds: 4,
    reentryCooldownSeconds: 45
  },
  micro: {
    anchorEma: 20,
    fastEma: 5,
    pulseEma: 3,
    atrLength: 14,
    rsiLength: 7,
    volumeLookback: 20,
    lookbackLowBars: 8
  },
  stretch: {
    entryAtr: 0.65,
    maxStretchAtr: 3.2,
    armBounceRatio: 0.28,
    triggerOffsetPct: 0.02,
    requireFastReclaim: true,
    requirePositivePulse: true,
    rsiFloor: 34,
    rsiCeiling: 64
  },
  liquidity: {
    maxSpreadPct: 0.12,
    minRelativeVolume: 0.25,
    volumeLookback: 20,
    maxSignalRangePct: 1.60,
    projectCurrentVolume: true,
    projectedVolumeFloor: 0.25
  },
  layers: {
    maxCount: 3,
    distanceAtr: 0.40,
    requireLowerLowForAdd: true
  },
  exits: {
    tp1Pct: 0.24,
    tp1SellRatio: 0.60,
    fullExitPct: 0.38,
    trailTriggerPct: 0.16,
    trailPct: 0.10,
    hardStopPct: 0.90,
    stopBufferAtr: 0.15,
    timeStopMinutes: 20,
    timeStopMaxProfitPct: 0.10,
    meanExitRsi: 58
  },
  execution: {
    useBuyEnabled: true,
    useSellEnabled: true
  },
  visuals: {
    enableCharts: true,
    enableShapes: true
  },
  telemetry: {
    enableNotifications: false,
    enableDebugLogs: false,
    logMode: 'changes',
    notificationRetentionMinutes: 720,
    notificationKeyLimit: 120,
    notificationPruneIntervalMinutes: 60
  }
};

function applyProfile(config) {
  var profile = String(config.profile || 'balanced').toLowerCase();

  if (profile === 'conservative') {
    profile = 'calm';
  }
  if (profile === 'aggressive') {
    profile = 'turbo';
  }

  if (profile === 'calm') {
    config.capital.actionCooldownSeconds = 6;
    config.capital.reentryCooldownSeconds = 90;
    config.stretch.entryAtr = 0.85;
    config.stretch.maxStretchAtr = 2.5;
    config.stretch.armBounceRatio = 0.35;
    config.liquidity.minRelativeVolume = 0.35;
    config.liquidity.maxSignalRangePct = 1.20;
    config.layers.maxCount = 1;
    config.layers.distanceAtr = 0.55;
    config.exits.tp1Pct = 0.30;
    config.exits.tp1SellRatio = 0.75;
    config.exits.fullExitPct = 0.45;
    config.exits.trailTriggerPct = 0.20;
    config.exits.trailPct = 0.09;
    config.exits.hardStopPct = 0.70;
    config.exits.timeStopMinutes = 15;
    config.exits.timeStopMaxProfitPct = 0.08;
    return;
  }

  if (profile === 'turbo') {
    config.capital.actionCooldownSeconds = 2;
    config.capital.reentryCooldownSeconds = 20;
    config.stretch.entryAtr = 0.40;
    config.stretch.maxStretchAtr = 3.8;
    config.stretch.armBounceRatio = 0.18;
    config.stretch.triggerOffsetPct = 0.00;
    config.stretch.rsiFloor = 30;
    config.stretch.rsiCeiling = 68;
    config.liquidity.minRelativeVolume = 0.12;
    config.liquidity.maxSignalRangePct = 2.20;
    config.layers.maxCount = 5;
    config.layers.distanceAtr = 0.28;
    config.exits.tp1Pct = 0.18;
    config.exits.tp1SellRatio = 0.60;
    config.exits.fullExitPct = 0.28;
    config.exits.trailTriggerPct = 0.10;
    config.exits.trailPct = 0.08;
    config.exits.hardStopPct = 1.10;
    config.exits.timeStopMinutes = 12;
    config.exits.timeStopMaxProfitPct = 0.08;
    config.exits.meanExitRsi = 60;
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
      snapshot[key] = sourceData[key];
    }
  }

  snapshot.pairName = safeString(sourceData.pairName, '');
  snapshot.exchangeName = safeString(sourceData.exchangeName, '');
  snapshot.period = safeNumber(sourceData.period, safeNumber(snapshot.period, 0));
  snapshot.pairLedger = sourceData.pairLedger && typeof sourceData.pairLedger === 'object' ? sourceData.pairLedger : {};
  snapshot.whatstrat = deepClone(activeOverrides({ data: sourceData }));

  return snapshot;
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
      value = safeString(source[keys[i]], null);
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
  value = safeString(value, 'changes').toLowerCase();
  if (value === 'events' || value === 'changes' || value === 'cycle') {
    return value;
  }
  return 'changes';
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
  return count ? total / count : 0;
}

function lowestFromEnd(values, lookback) {
  var minValue = null;
  var i;
  var startIndex = Math.max(0, values.length - lookback);
  for (i = startIndex; i < values.length; i += 1) {
    if (typeof values[i] === 'number' && isFinite(values[i])) {
      if (minValue === null || values[i] < minValue) {
        minValue = values[i];
      }
    }
  }
  return minValue;
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

function percentChange(fromValue, toValue) {
  if (!isFinite(fromValue) || !isFinite(toValue) || Math.abs(fromValue) < 1e-10) {
    return 0;
  }
  return ((toValue - fromValue) / fromValue) * 100;
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

function resolveGb(runtimeGb) {
  var runtime;

  if (runtimeGb && runtimeGb.data && runtimeGb.method) {
    runtime = runtimeGb;
  } else if (typeof globalThis !== 'undefined' && globalThis.gb && globalThis.gb.data && globalThis.gb.method) {
    runtime = globalThis.gb;
  } else if (typeof global !== 'undefined' && global.gb && global.gb.data && global.gb.method) {
    runtime = global.gb;
  } else {
    throw new Error('Mako could not resolve the Gunbot runtime object.');
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
  if (!pairLedger.customStratStore.mako || typeof pairLedger.customStratStore.mako !== 'object' || Array.isArray(pairLedger.customStratStore.mako)) {
    pairLedger.customStratStore.mako = {};
  }

  var state = pairLedger.customStratStore.mako;

  if (!state.notificationKeys || typeof state.notificationKeys !== 'object') {
    state.notificationKeys = {};
  }
  if (typeof state.lastNotificationPruneAt !== 'number') {
    state.lastNotificationPruneAt = 0;
  }

  state.metaVersion = MAKO_META.version;
  state.phase = safeString(state.phase, 'flat');
  state.layerCount = Math.max(0, Math.floor(safeNumber(state.layerCount, 0)));
  state.tp1Done = !!state.tp1Done;
  state.trailPeak = safeNumber(state.trailPeak, 0);
  state.trailStop = safeNumber(state.trailStop, 0);
  state.lastActionAt = safeNumber(state.lastActionAt, 0);
  state.lastFillPrice = safeNumber(state.lastFillPrice, 0);
  state.entryTime = safeNumber(state.entryTime, 0);
  state.cooldownUntil = safeNumber(state.cooldownUntil, 0);
  state.watchActive = !!state.watchActive;
  state.watchStartedAt = safeNumber(state.watchStartedAt, 0);
  state.watchLow = safeNumber(state.watchLow, 0);
  state.watchAnchor = safeNumber(state.watchAnchor, 0);
  state.watchTrigger = safeNumber(state.watchTrigger, 0);
  state.watchStage = safeString(state.watchStage, 'idle');
  state.watchCandleTime = safeNumber(state.watchCandleTime, 0);
  state.lastStage = safeString(state.lastStage, '');
  state.lastSkipReason = safeString(state.lastSkipReason, '');
  state.lastCycleSummaryKey = safeString(state.lastCycleSummaryKey, '');
  state.hadBagLastCycle = !!state.hadBagLastCycle;

  gb.data.pairLedger = pairLedger;
  return state;
}

function readConfig(gb) {
  var overrides = activeOverrides(gb);
  var config = deepClone(MAKO_BASE_CONFIG);

  config.profile = readFirstString(overrides, ['MAKO_PROFILE', 'MAKO_RISK_PROFILE'], config.profile).toLowerCase();
  applyProfile(config);

  config.enabled = readFirstBoolean(overrides, ['MAKO_ENABLED'], config.enabled);
  config.capital.tradeLimitBase = readFirstNumber(overrides, ['MAKO_TRADE_LIMIT', 'TRADE_LIMIT', 'TRADING_LIMIT'], config.capital.tradeLimitBase);
  config.capital.fundsReserveBase = readFirstNumber(overrides, ['MAKO_FUNDS_RESERVE', 'FUNDS_RESERVE'], config.capital.fundsReserveBase);
  config.capital.actionCooldownSeconds = readFirstNumber(overrides, ['MAKO_ACTION_COOLDOWN_SECONDS'], config.capital.actionCooldownSeconds);
  config.capital.reentryCooldownSeconds = readFirstNumber(overrides, ['MAKO_REENTRY_COOLDOWN_SECONDS'], config.capital.reentryCooldownSeconds);
  config.minCandles = readFirstNumber(overrides, ['MAKO_MIN_CANDLES'], config.minCandles);

  config.micro.anchorEma = readFirstNumber(overrides, ['MAKO_ANCHOR_EMA'], config.micro.anchorEma);
  config.micro.fastEma = readFirstNumber(overrides, ['MAKO_FAST_EMA'], config.micro.fastEma);
  config.micro.pulseEma = readFirstNumber(overrides, ['MAKO_PULSE_EMA'], config.micro.pulseEma);
  config.micro.atrLength = readFirstNumber(overrides, ['MAKO_ATR_LENGTH'], config.micro.atrLength);
  config.micro.rsiLength = readFirstNumber(overrides, ['MAKO_RSI_LENGTH'], config.micro.rsiLength);
  config.micro.volumeLookback = readFirstNumber(overrides, ['MAKO_VOLUME_LOOKBACK'], config.micro.volumeLookback);
  config.micro.lookbackLowBars = readFirstNumber(overrides, ['MAKO_LOOKBACK_LOW_BARS'], config.micro.lookbackLowBars);

  config.stretch.entryAtr = readFirstNumber(overrides, ['MAKO_ENTRY_ATR'], config.stretch.entryAtr);
  config.stretch.maxStretchAtr = readFirstNumber(overrides, ['MAKO_MAX_STRETCH_ATR'], config.stretch.maxStretchAtr);
  config.stretch.armBounceRatio = readFirstNumber(overrides, ['MAKO_ARM_BOUNCE_RATIO'], config.stretch.armBounceRatio);
  config.stretch.triggerOffsetPct = readFirstNumber(overrides, ['MAKO_TRIGGER_OFFSET_PCT'], config.stretch.triggerOffsetPct);
  config.stretch.requireFastReclaim = readFirstBoolean(overrides, ['MAKO_REQUIRE_FAST_RECLAIM'], config.stretch.requireFastReclaim);
  config.stretch.requirePositivePulse = readFirstBoolean(overrides, ['MAKO_REQUIRE_POSITIVE_PULSE'], config.stretch.requirePositivePulse);
  config.stretch.rsiFloor = readFirstNumber(overrides, ['MAKO_RSI_FLOOR'], config.stretch.rsiFloor);
  config.stretch.rsiCeiling = readFirstNumber(overrides, ['MAKO_RSI_CEILING'], config.stretch.rsiCeiling);

  config.liquidity.maxSpreadPct = readFirstNumber(overrides, ['MAKO_MAX_SPREAD_PCT'], config.liquidity.maxSpreadPct);
  config.liquidity.minRelativeVolume = readFirstNumber(overrides, ['MAKO_MIN_RELATIVE_VOLUME'], config.liquidity.minRelativeVolume);
  config.liquidity.volumeLookback = readFirstNumber(overrides, ['MAKO_VOLUME_LOOKBACK', 'MAKO_RELATIVE_VOLUME_LOOKBACK'], config.liquidity.volumeLookback);
  config.liquidity.maxSignalRangePct = readFirstNumber(overrides, ['MAKO_MAX_SIGNAL_RANGE_PCT'], config.liquidity.maxSignalRangePct);
  config.liquidity.projectCurrentVolume = readFirstBoolean(overrides, ['MAKO_PROJECT_CURRENT_VOLUME'], config.liquidity.projectCurrentVolume);
  config.liquidity.projectedVolumeFloor = readFirstNumber(overrides, ['MAKO_PROJECTED_VOLUME_FLOOR'], config.liquidity.projectedVolumeFloor);

  config.layers.maxCount = readFirstNumber(overrides, ['MAKO_MAX_LAYER_COUNT'], config.layers.maxCount);
  config.layers.distanceAtr = readFirstNumber(overrides, ['MAKO_LAYER_DISTANCE_ATR'], config.layers.distanceAtr);
  config.layers.requireLowerLowForAdd = readFirstBoolean(overrides, ['MAKO_REQUIRE_LOWER_LOW_FOR_ADD'], config.layers.requireLowerLowForAdd);

  config.exits.tp1Pct = readFirstNumber(overrides, ['MAKO_TP1_PCT'], config.exits.tp1Pct);
  config.exits.tp1SellRatio = readFirstNumber(overrides, ['MAKO_TP1_SELL_RATIO'], config.exits.tp1SellRatio);
  config.exits.fullExitPct = readFirstNumber(overrides, ['MAKO_FULL_EXIT_PCT'], config.exits.fullExitPct);
  config.exits.trailTriggerPct = readFirstNumber(overrides, ['MAKO_TRAIL_TRIGGER_PCT'], config.exits.trailTriggerPct);
  config.exits.trailPct = readFirstNumber(overrides, ['MAKO_TRAIL_PCT'], config.exits.trailPct);
  config.exits.hardStopPct = readFirstNumber(overrides, ['MAKO_HARD_STOP_PCT'], config.exits.hardStopPct);
  config.exits.stopBufferAtr = readFirstNumber(overrides, ['MAKO_STOP_BUFFER_ATR'], config.exits.stopBufferAtr);
  config.exits.timeStopMinutes = readFirstNumber(overrides, ['MAKO_TIME_STOP_MINUTES'], config.exits.timeStopMinutes);
  config.exits.timeStopMaxProfitPct = readFirstNumber(overrides, ['MAKO_TIME_STOP_MAX_PROFIT_PCT'], config.exits.timeStopMaxProfitPct);
  config.exits.meanExitRsi = readFirstNumber(overrides, ['MAKO_MEAN_EXIT_RSI'], config.exits.meanExitRsi);

  config.execution.useBuyEnabled = readFirstBoolean(overrides, ['MAKO_USE_BUY_ENABLED'], config.execution.useBuyEnabled);
  config.execution.useSellEnabled = readFirstBoolean(overrides, ['MAKO_USE_SELL_ENABLED'], config.execution.useSellEnabled);

  config.visuals.enableCharts = readFirstBoolean(overrides, ['ENABLE_CHARTS'], config.visuals.enableCharts);
  config.visuals.enableShapes = readFirstBoolean(overrides, ['ENABLE_CHART_SHAPES'], config.visuals.enableShapes);

  config.telemetry.enableNotifications = readFirstBoolean(overrides, ['ENABLE_NOTIFICATIONS'], config.telemetry.enableNotifications);
  config.telemetry.enableDebugLogs = readFirstBoolean(overrides, ['ENABLE_DEBUG_LOGS'], config.telemetry.enableDebugLogs);
  config.telemetry.logMode = normalizeLogMode(readFirstString(overrides, ['MAKO_LOG_MODE'], config.telemetry.logMode));

  config.capital.tradeLimitBase = Math.max(0, config.capital.tradeLimitBase);
  config.capital.fundsReserveBase = Math.max(0, config.capital.fundsReserveBase);
  config.capital.actionCooldownSeconds = Math.max(0, config.capital.actionCooldownSeconds);
  config.capital.reentryCooldownSeconds = Math.max(0, config.capital.reentryCooldownSeconds);
  config.minCandles = Math.max(60, Math.floor(config.minCandles));

  config.micro.anchorEma = Math.max(5, Math.floor(config.micro.anchorEma));
  config.micro.fastEma = Math.max(2, Math.floor(config.micro.fastEma));
  config.micro.pulseEma = Math.max(2, Math.floor(config.micro.pulseEma));
  config.micro.atrLength = Math.max(5, Math.floor(config.micro.atrLength));
  config.micro.rsiLength = Math.max(4, Math.floor(config.micro.rsiLength));
  config.micro.volumeLookback = Math.max(5, Math.floor(config.micro.volumeLookback));
  config.micro.lookbackLowBars = Math.max(3, Math.floor(config.micro.lookbackLowBars));

  config.stretch.entryAtr = clamp(config.stretch.entryAtr, 0.10, 5.0);
  config.stretch.maxStretchAtr = Math.max(config.stretch.entryAtr + 0.10, config.stretch.maxStretchAtr);
  config.stretch.armBounceRatio = clamp(config.stretch.armBounceRatio, 0.05, 0.90);
  config.stretch.triggerOffsetPct = clamp(config.stretch.triggerOffsetPct, 0, 1.0);
  config.stretch.rsiFloor = clamp(config.stretch.rsiFloor, 5, 65);
  config.stretch.rsiCeiling = clamp(config.stretch.rsiCeiling, config.stretch.rsiFloor + 5, 90);

  config.liquidity.maxSpreadPct = clamp(config.liquidity.maxSpreadPct, 0.01, 1.0);
  config.liquidity.minRelativeVolume = clamp(config.liquidity.minRelativeVolume, 0.01, 5.0);
  config.liquidity.volumeLookback = Math.max(5, Math.floor(config.liquidity.volumeLookback));
  config.liquidity.maxSignalRangePct = clamp(config.liquidity.maxSignalRangePct, 0.10, 10.0);
  config.liquidity.projectedVolumeFloor = clamp(config.liquidity.projectedVolumeFloor, 0.10, 1.0);

  config.layers.maxCount = Math.max(0, Math.floor(config.layers.maxCount));
  config.layers.distanceAtr = clamp(config.layers.distanceAtr, 0.05, 3.0);

  config.exits.tp1Pct = clamp(config.exits.tp1Pct, 0.05, 3.0);
  config.exits.tp1SellRatio = clamp(config.exits.tp1SellRatio, 0.10, 1.0);
  config.exits.fullExitPct = Math.max(config.exits.tp1Pct, config.exits.fullExitPct);
  config.exits.trailTriggerPct = clamp(config.exits.trailTriggerPct, 0.05, 3.0);
  config.exits.trailPct = clamp(config.exits.trailPct, 0.03, 2.0);
  config.exits.hardStopPct = clamp(config.exits.hardStopPct, 0.10, 5.0);
  config.exits.stopBufferAtr = clamp(config.exits.stopBufferAtr, 0, 1.0);
  config.exits.timeStopMinutes = Math.max(1, Math.floor(config.exits.timeStopMinutes));
  config.exits.timeStopMaxProfitPct = clamp(config.exits.timeStopMaxProfitPct, 0, 2.0);
  config.exits.meanExitRsi = clamp(config.exits.meanExitRsi, 40, 90);

  return config;
}

function logPrefix(gb) {
  return '[' + MAKO_META.name + ' ' + MAKO_META.version + '][' + String(gb.data.exchangeName || '') + '][' + String(gb.data.pairName || '') + ']';
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

function formatSigned(value, decimals, suffix) {
  if (!isFinite(value)) {
    return '--';
  }
  return (value >= 0 ? '+' : '') + roundTo(value, decimals).toFixed(decimals) + String(suffix || '');
}

function quoteAmountToBaseValue(amountQuote, price) {
  var quoteAmount = safeNumber(amountQuote, 0);
  var marketPrice = safeNumber(price, 0);
  if (quoteAmount <= 0 || marketPrice <= 0) {
    return 0;
  }
  return quoteAmount * marketPrice;
}

function minimumBuyBaseValue(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).MIN_VOLUME_TO_BUY, 0));
}

function minimumSellBaseValue(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).MIN_VOLUME_TO_SELL, 0));
}

function projectSignalVolume(signalVolume, signalTimestamp, now, periodMinutes, minProgressRatio) {
  var periodMs = Math.max(1, safeNumber(periodMinutes, 1)) * 60 * 1000;
  var elapsedMs = safeNumber(now, 0) - safeNumber(signalTimestamp, 0);
  var progressRatio = clamp(periodMs > 0 ? (elapsedMs / periodMs) : 1, minProgressRatio, 1);
  return safeNumber(signalVolume, 0) / progressRatio;
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

function analyzeFrame(gb, config, state, now, hasBag) {
  var candles = normalizeLocalCandles(gb);
  var open;
  var high;
  var low;
  var close;
  var volume;
  var timestamp;
  var size;
  var anchorSeries;
  var fastSeries;
  var pulseSeries;
  var rsiSeries;
  var atrSeries;
  var lastIndex;
  var previousIndex;
  var currentPeriodMinutes;
  var periodMs;
  var signalTimestamp;
  var bid;
  var ask;
  var signalOpen;
  var signalHigh;
  var signalLow;
  var signalClose;
  var signalVolume;
  var completedVolume;
  var avgVolume;
  var projectedVolume;
  var effectiveVolume;
  var spreadPct;
  var relativeVolume;
  var signalRange;
  var signalRangePct;
  var anchorLast;
  var fastLast;
  var pulseLast;
  var pulsePrev;
  var rsiLast;
  var rsiPrev;
  var atrLast;
  var stretchAtr;
  var stretchReason;
  var bounceRatio;
  var bounceAtr;
  var armReason;
  var triggerPrice;
  var triggerReason;
  var pulseReason;
  var liquidityReason;
  var stage;
  var marketBreakEven;
  var baseReference;
  var recentLow;
  var structuralStop;
  var pctStop;
  var stopPrice;
  var tp1Price;
  var meanExitPrice;
  var reloadTarget;
  var trailTriggerPrice;
  var lowerStretchPrice;
  var maxStretchPrice;

  if (!candles) {
    return {
      ready: false,
      reason: 'waiting-local-candles'
    };
  }

  open = candles.open;
  high = candles.high;
  low = candles.low;
  close = candles.close;
  volume = candles.volume;
  timestamp = candles.timestamp;
  size = close.length;

  if (size < config.minCandles) {
    return {
      ready: false,
      reason: 'local-data-short'
    };
  }

  anchorSeries = calculateEMA(close, config.micro.anchorEma);
  fastSeries = calculateEMA(close, config.micro.fastEma);
  pulseSeries = calculateEMA(close, config.micro.pulseEma);
  rsiSeries = calculateRSI(close, config.micro.rsiLength);
  atrSeries = calculateATR(high, low, close, config.micro.atrLength);

  lastIndex = size - 1;
  previousIndex = Math.max(0, lastIndex - 1);

  anchorLast = lastDefined(anchorSeries);
  fastLast = lastDefined(fastSeries);
  pulseLast = lastDefined(pulseSeries);
  pulsePrev = previousDefined(pulseSeries);
  rsiLast = lastDefined(rsiSeries);
  rsiPrev = previousDefined(rsiSeries);
  atrLast = lastDefined(atrSeries);

  if (!isFinite(anchorLast) || !isFinite(fastLast) || !isFinite(pulseLast) || !isFinite(rsiLast) || !isFinite(atrLast) || atrLast <= 0) {
    return {
      ready: false,
      reason: 'indicator-warmup'
    };
  }

  currentPeriodMinutes = Math.max(1, Math.floor(readFirstNumber(activeOverrides(gb), ['PERIOD'], 5)));
  periodMs = currentPeriodMinutes * 60 * 1000;
  signalTimestamp = timestamp.length ? safeNumber(timestamp[lastIndex], 0) : 0;

  bid = safeNumber(gb.data.bid, close[lastIndex]);
  ask = safeNumber(gb.data.ask, bid);
  if (ask <= 0) {
    ask = bid;
  }
  bid = Math.max(0, bid);

  signalOpen = open[lastIndex];
  signalHigh = high[lastIndex];
  signalLow = low[lastIndex];
  signalClose = close[lastIndex];
  signalVolume = volume[lastIndex];
  completedVolume = volume[previousIndex];
  avgVolume = average(volume.slice(Math.max(0, previousIndex - config.liquidity.volumeLookback + 1), previousIndex + 1));
  projectedVolume = config.liquidity.projectCurrentVolume
    ? projectSignalVolume(signalVolume, signalTimestamp, now, currentPeriodMinutes, config.liquidity.projectedVolumeFloor)
    : safeNumber(signalVolume, 0);
  effectiveVolume = Math.max(projectedVolume, Math.max(0, safeNumber(completedVolume, 0)));

  spreadPct = ask > 0 ? ((ask - bid) / ask) * 100 : 0;
  relativeVolume = avgVolume > 0 ? effectiveVolume / avgVolume : 1;
  signalRange = Math.max(0, signalHigh - signalLow);
  signalRangePct = bid > 0 ? (signalRange / bid) * 100 : 0;

  stretchAtr = atrLast > 0 ? (anchorLast - bid) / atrLast : 0;
  if (stretchAtr < config.stretch.entryAtr) {
    stretchReason = 'not-stretched';
  } else if (stretchAtr > config.stretch.maxStretchAtr) {
    stretchReason = 'stretch-too-deep';
  } else {
    stretchReason = 'ok';
  }

  bounceRatio = signalRange > 0 ? (bid - signalLow) / signalRange : 0;
  bounceAtr = atrLast > 0 ? (bid - signalLow) / atrLast : 0;
  if (stretchReason !== 'ok') {
    armReason = stretchReason;
  } else if (bounceRatio < config.stretch.armBounceRatio) {
    armReason = 'bounce-too-small';
  } else {
    armReason = 'ok';
  }

  triggerPrice = Math.max(
    signalLow + (signalRange * Math.max(0.25, config.stretch.armBounceRatio)),
    signalOpen * (1 + (config.stretch.triggerOffsetPct / 100))
  );
  if (config.stretch.requireFastReclaim) {
    triggerPrice = Math.max(triggerPrice, fastLast);
  }

  if (armReason !== 'ok') {
    triggerReason = 'not-armed';
  } else if (bid < triggerPrice) {
    triggerReason = 'trigger-not-reclaimed';
  } else {
    triggerReason = 'ok';
  }

  if (rsiLast > config.stretch.rsiCeiling) {
    pulseReason = 'rsi-overheated';
  } else if (rsiLast < config.stretch.rsiFloor && safeNumber(rsiLast - rsiPrev, 0) < 0) {
    pulseReason = 'rsi-still-falling';
  } else if (config.stretch.requirePositivePulse && pulsePrev !== null && pulseLast < pulsePrev) {
    pulseReason = 'pulse-rolling-down';
  } else if (config.stretch.requirePositivePulse && (rsiLast - rsiPrev) < 0) {
    pulseReason = 'rsi-delta-negative';
  } else if (config.stretch.requirePositivePulse && bid < close[previousIndex]) {
    pulseReason = 'no-uptick';
  } else {
    pulseReason = 'ok';
  }

  liquidityReason = buildLiquidityReason(spreadPct, relativeVolume, signalRangePct, config);

  if (hasBag) {
    stage = state.tp1Done ? 'trail-manage' : 'bag-manage';
  } else if (stretchReason !== 'ok') {
    stage = 'idle';
  } else if (liquidityReason !== 'ok') {
    stage = 'liquidity-blocked';
  } else if (armReason !== 'ok') {
    stage = 'stretch-watch';
  } else if (triggerReason !== 'ok' || pulseReason !== 'ok') {
    stage = 'armed';
  } else {
    stage = 'entry-ready';
  }

  marketBreakEven = safeNumber(gb.data.breakEven, 0);
  baseReference = marketBreakEven > 0 ? marketBreakEven : bid;
  recentLow = lowestFromEnd(low, config.micro.lookbackLowBars);
  lowerStretchPrice = anchorLast - (atrLast * config.stretch.entryAtr);
  maxStretchPrice = anchorLast - (atrLast * config.stretch.maxStretchAtr);
  structuralStop = (recentLow !== null ? recentLow : signalLow) - (atrLast * config.exits.stopBufferAtr);
  pctStop = baseReference > 0 ? baseReference * (1 - (config.exits.hardStopPct / 100)) : bid;
  stopPrice = Math.max(structuralStop, pctStop);
  tp1Price = baseReference * (1 + (config.exits.tp1Pct / 100));
  meanExitPrice = Math.max(baseReference * (1 + (config.exits.fullExitPct / 100)), anchorLast);
  reloadTarget = (state.lastFillPrice > 0 ? state.lastFillPrice : baseReference) - (atrLast * config.layers.distanceAtr);
  trailTriggerPrice = baseReference * (1 + (config.exits.trailTriggerPct / 100));

  return {
    ready: true,
    currentPeriodMinutes: currentPeriodMinutes,
    periodMs: periodMs,
    lastTimestamp: signalTimestamp,
    bid: bid,
    ask: ask,
    anchor: anchorLast,
    fast: fastLast,
    pulse: pulseLast,
    pulseDelta: pulsePrev !== null ? percentChange(pulsePrev, pulseLast) : 0,
    rsi: rsiLast,
    rsiDelta: rsiPrev !== null ? (rsiLast - rsiPrev) : 0,
    atr: atrLast,
    signalOpen: signalOpen,
    signalHigh: signalHigh,
    signalLow: signalLow,
    signalClose: signalClose,
    signalRangePct: signalRangePct,
    stretchAtr: stretchAtr,
    bounceRatio: bounceRatio,
    bounceAtr: bounceAtr,
    entryTrigger: triggerPrice,
    lowerStretchPrice: lowerStretchPrice,
    maxStretchPrice: maxStretchPrice,
    tp1Price: tp1Price,
    meanExitPrice: meanExitPrice,
    reloadTarget: reloadTarget,
    trailTriggerPrice: trailTriggerPrice,
    stopPrice: stopPrice,
    recentLow: recentLow !== null ? recentLow : signalLow,
    stage: stage,
    setupArmed: stage === 'armed' || stage === 'entry-ready',
    stretch: {
      ok: stretchReason === 'ok',
      reason: stretchReason
    },
    arm: {
      ok: armReason === 'ok',
      reason: armReason
    },
    trigger: {
      ok: triggerReason === 'ok',
      reason: triggerReason
    },
    pulseSignal: {
      ok: pulseReason === 'ok',
      reason: pulseReason
    },
    liquidity: {
      ok: liquidityReason === 'ok',
      reason: liquidityReason,
      spreadPct: spreadPct,
      relativeVolume: relativeVolume,
      averageVolume: avgVolume,
      completedVolume: completedVolume,
      projectedVolume: projectedVolume,
      effectiveVolume: effectiveVolume
    }
  };
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

function clearWatchState(state) {
  state.watchActive = false;
  state.watchStartedAt = 0;
  state.watchLow = 0;
  state.watchAnchor = 0;
  state.watchTrigger = 0;
  state.watchStage = 'idle';
  state.watchCandleTime = 0;
}

function clearBagState(state, config, now) {
  state.layerCount = 0;
  state.tp1Done = false;
  state.trailPeak = 0;
  state.trailStop = 0;
  state.lastFillPrice = 0;
  state.entryTime = 0;
  state.cooldownUntil = now + (config.capital.reentryCooldownSeconds * 1000);
  state.phase = 'cooldown';
  clearWatchState(state);
}

function updateWatchState(state, frameMetrics, hasBag, now) {
  if (hasBag || !frameMetrics.ready) {
    clearWatchState(state);
    return;
  }

  if (frameMetrics.stretch.ok) {
    if (!state.watchActive) {
      state.watchActive = true;
      state.watchStartedAt = now;
      state.watchLow = frameMetrics.signalLow;
      state.watchAnchor = frameMetrics.anchor;
      state.watchTrigger = frameMetrics.entryTrigger;
      state.watchCandleTime = frameMetrics.lastTimestamp || now;
    }
    state.watchLow = state.watchLow > 0 ? Math.min(state.watchLow, frameMetrics.signalLow) : frameMetrics.signalLow;
    state.watchAnchor = frameMetrics.anchor;
    state.watchTrigger = frameMetrics.entryTrigger;
    state.watchStage = frameMetrics.stage;
    if (frameMetrics.lastTimestamp > 0) {
      state.watchCandleTime = frameMetrics.lastTimestamp;
    }
    return;
  }

  if (state.watchActive && (frameMetrics.bid >= frameMetrics.anchor || (now - state.watchStartedAt) > (frameMetrics.periodMs * 2))) {
    clearWatchState(state);
  }
}

function recoverBagState(gb, state, now, hasBag) {
  if (hasBag && !state.hadBagLastCycle) {
    state.phase = state.tp1Done ? 'trail' : 'bag';
    if (state.entryTime <= 0) {
      state.entryTime = now;
    }
    state.lastFillPrice = Math.max(state.lastFillPrice, safeNumber(gb.data.breakEven, 0), safeNumber(gb.data.bid, 0));
    clearWatchState(state);
  }
}

function updateTrailingState(state, frameMetrics, breakEven, config) {
  if (!state.tp1Done) {
    state.trailPeak = 0;
    state.trailStop = 0;
    return;
  }

  if (state.trailPeak <= 0) {
    state.trailPeak = frameMetrics.bid;
  } else {
    state.trailPeak = Math.max(state.trailPeak, frameMetrics.bid);
  }

  state.trailStop = state.trailPeak * (1 - (config.exits.trailPct / 100));
  if (breakEven > 0) {
    state.trailStop = Math.max(state.trailStop, breakEven);
  }
}

function phaseName(state, hasBag, setupArmed, reentryCooldownActive) {
  if (state.phase === 'entry-pending' && !hasBag) {
    return 'entry-pending';
  }
  if (hasBag) {
    return state.tp1Done ? 'trail' : 'bag';
  }
  if (reentryCooldownActive) {
    return 'cooldown';
  }
  if (setupArmed) {
    return 'armed';
  }
  if (state.watchActive) {
    return 'watch';
  }
  return 'flat';
}

function buildSkipReason(config, runtime, frameMetrics, hasBag, hasOpenOrders, buyEnabled, enoughEntryBalance) {
  if (!frameMetrics.ready) {
    return frameMetrics.reason;
  }
  if (!config.enabled && !hasBag) {
    return 'disabled';
  }
  if (hasBag) {
    return 'bag-open';
  }
  if (hasOpenOrders) {
    return 'open-orders';
  }
  if (runtime.actionCooldownActive) {
    return 'action-cooldown';
  }
  if (runtime.reentryCooldownActive) {
    return 'reentry-cooldown';
  }
  if (!buyEnabled) {
    return 'buy-disabled';
  }
  if (!enoughEntryBalance) {
    return 'insufficient-funds';
  }
  if (!frameMetrics.stretch.ok) {
    return frameMetrics.stretch.reason;
  }
  if (!frameMetrics.liquidity.ok) {
    return frameMetrics.liquidity.reason;
  }
  if (!frameMetrics.arm.ok) {
    return frameMetrics.arm.reason;
  }
  if (!frameMetrics.trigger.ok) {
    return frameMetrics.trigger.reason;
  }
  if (!frameMetrics.pulseSignal.ok) {
    return frameMetrics.pulseSignal.reason;
  }
  return 'entry-ready';
}

function buildCycleSummaryKey(frameMetrics, state, hasBag, setupArmed, skipReason, reentryCooldownActive) {
  return [
    frameMetrics.lastTimestamp || 0,
    frameMetrics.stage,
    phaseName(state, hasBag, setupArmed, reentryCooldownActive),
    skipReason,
    hasBag ? 1 : 0,
    setupArmed ? 1 : 0,
    state.layerCount,
    state.tp1Done ? 1 : 0,
    roundTo(frameMetrics.stretchAtr, 3),
    roundTo(frameMetrics.entryTrigger, 6),
    roundTo(state.trailStop, 6)
  ].join('|');
}

function buildCycleSummaryLine(frameMetrics, state, hasBag, setupArmed, skipReason, reentryCooldownActive, config) {
  return [
    'tf=' + String(frameMetrics.currentPeriodMinutes) + 'm',
    'bid=' + formatPrice(frameMetrics.bid),
    'phase=' + phaseName(state, hasBag, setupArmed, reentryCooldownActive),
    'stage=' + frameMetrics.stage,
    'arm=' + (setupArmed ? 'yes' : 'no'),
    'stretch=' + roundTo(frameMetrics.stretchAtr, 2).toFixed(2) + 'atr',
    'bounce=' + roundTo(frameMetrics.bounceRatio, 2).toFixed(2),
    'pulse=' + formatSigned(frameMetrics.rsiDelta, 2, ''),
    'rsi=' + roundTo(frameMetrics.rsi, 1).toFixed(1),
    'liquidity=' + (frameMetrics.liquidity.ok ? 'ok' : frameMetrics.liquidity.reason),
    'relvol=' + roundTo(frameMetrics.liquidity.relativeVolume, 2).toFixed(2) + 'x',
    'spread=' + formatPercent(frameMetrics.liquidity.spreadPct),
    'layers=' + String(state.layerCount) + '/' + String(config.layers.maxCount),
    'skip=' + skipReason,
    'target=' + formatPrice(hasBag ? frameMetrics.meanExitPrice : frameMetrics.entryTrigger),
    'stop=' + formatPrice(frameMetrics.stopPrice)
  ].join(' ');
}

function emitCycleSummary(gb, config, state, frameMetrics, hasBag, setupArmed, skipReason, reentryCooldownActive) {
  var summaryKey;
  if (config.telemetry.logMode === 'events') {
    return;
  }

  summaryKey = buildCycleSummaryKey(frameMetrics, state, hasBag, setupArmed, skipReason, reentryCooldownActive);
  if (config.telemetry.logMode === 'changes' && state.lastCycleSummaryKey === summaryKey) {
    return;
  }

  console.log(logPrefix(gb) + '[STATE] ' + buildCycleSummaryLine(frameMetrics, state, hasBag, setupArmed, skipReason, reentryCooldownActive, config));
  state.lastCycleSummaryKey = summaryKey;
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

function setChartObjects(gb, config, state, frameMetrics, hasBag) {
  var targets = [];
  var shapes = [];
  var zoneTop = frameMetrics.entryTrigger;
  var zoneBottom = frameMetrics.lowerStretchPrice;
  var entryPrice = Math.max(safeNumber(gb.data.breakEven, 0), safeNumber(state.lastFillPrice, 0));
  var riskTop = Math.max(frameMetrics.entryTrigger, entryPrice, frameMetrics.bid);
  var window = buildShapeWindow(frameMetrics, 1, 1);
  var target;

  if (!config.visuals.enableCharts) {
    clearChartObjects(gb);
    return;
  }

  gb.data.pairLedger.customBuyTarget = !hasBag ? frameMetrics.entryTrigger : null;
  gb.data.pairLedger.customSellTarget = hasBag ? (state.tp1Done ? frameMetrics.meanExitPrice : frameMetrics.tp1Price) : null;
  gb.data.pairLedger.customCloseTarget = hasBag ? frameMetrics.meanExitPrice : null;
  gb.data.pairLedger.customStopTarget = frameMetrics.stopPrice;
  gb.data.pairLedger.customTrailingTarget = state.tp1Done && state.trailStop > 0 ? state.trailStop : null;
  gb.data.pairLedger.customDcaTarget = hasBag && state.layerCount < config.layers.maxCount ? frameMetrics.reloadTarget : null;

  target = createChartTarget('Mako Anchor', frameMetrics.anchor, '', 1, 1, MAKO_COLORS.info, '#0f1a2b');
  if (target) {
    targets.push(target);
  }
  target = createChartTarget('Mako Fast', frameMetrics.fast, '', 1, 1, MAKO_COLORS.neutral, '#111827');
  if (target) {
    targets.push(target);
  }
  if (hasBag && entryPrice > 0) {
    target = createChartTarget('Mako Entry Fill', entryPrice, '', 1, 1, MAKO_COLORS.neutral, '#111827');
    if (target) {
      targets.push(target);
    }
  }
  target = createChartTarget('Mako Trigger', frameMetrics.entryTrigger, '', 0, 2, MAKO_COLORS.warn, '#2b2110');
  if (target) {
    targets.push(target);
  }
  target = createChartTarget('Mako Stop', frameMetrics.stopPrice, '', 2, 1, MAKO_COLORS.bad, '#2b1111');
  if (target) {
    targets.push(target);
  }

  if (hasBag) {
    target = createChartTarget('Mako TP1', frameMetrics.tp1Price, '', 0, 2, MAKO_COLORS.good, '#122018');
    if (target) {
      targets.push(target);
    }
    target = createChartTarget('Mako Mean Exit', frameMetrics.meanExitPrice, '', 1, 1, MAKO_COLORS.info, '#0f1a2b');
    if (target) {
      targets.push(target);
    }
  }
  if (state.tp1Done && state.trailStop > 0) {
    target = createChartTarget('Mako Trail', state.trailStop, '', 0, 2, MAKO_COLORS.warn, '#2b2110');
    if (target) {
      targets.push(target);
    }
  }
  if (hasBag && state.layerCount < config.layers.maxCount) {
    target = createChartTarget('Mako Layer', frameMetrics.reloadTarget, '', 1, 1, MAKO_COLORS.neutral, '#111827');
    if (target) {
      targets.push(target);
    }
  }
  gb.data.pairLedger.customChartTargets = targets;

  if (!config.visuals.enableShapes) {
    gb.data.pairLedger.customChartShapes = [];
    return;
  }

  if (!hasBag && frameMetrics.stretch.ok) {
    target = buildRectangleShape(window.startTime, window.endTime, zoneTop, zoneBottom, MAKO_COLORS.zoneFill, MAKO_COLORS.zoneBorder);
    if (target) {
      shapes.push(target);
    }
  }

  if ((hasBag || frameMetrics.stretch.ok) && frameMetrics.stopPrice > 0) {
    target = buildRectangleShape(window.startTime, window.endTime, riskTop, frameMetrics.stopPrice, MAKO_COLORS.riskFill, MAKO_COLORS.riskBorder);
    if (target) {
      shapes.push(target);
    }
  }

  gb.data.pairLedger.customChartShapes = shapes;
}

function updateSidebar(gb, config, frameMetrics, state, runtime, hasBag, setupArmed, skipReason) {
  gb.data.pairLedger.sidebarExtras = [
    { label: 'Mako', value: MAKO_META.version, valueColor: MAKO_COLORS.info },
    { label: 'Stage', value: frameMetrics.stage, valueColor: setupArmed ? MAKO_COLORS.warn : MAKO_COLORS.neutral },
    { label: 'Phase', value: phaseName(state, hasBag, setupArmed, runtime.reentryCooldownActive), valueColor: hasBag ? MAKO_COLORS.good : MAKO_COLORS.neutral },
    { label: 'Stretch', value: roundTo(frameMetrics.stretchAtr, 2).toFixed(2) + 'atr', valueColor: frameMetrics.stretch.ok ? MAKO_COLORS.warn : MAKO_COLORS.neutral },
    { label: 'Arm', value: setupArmed ? 'YES' : 'NO', valueColor: setupArmed ? MAKO_COLORS.good : MAKO_COLORS.neutral },
    { label: 'Pulse', value: formatSigned(frameMetrics.rsiDelta, 2, ''), valueColor: frameMetrics.pulseSignal.ok ? MAKO_COLORS.good : MAKO_COLORS.bad },
    { label: 'Layers', value: String(state.layerCount) + '/' + String(config.layers.maxCount), valueColor: MAKO_COLORS.neutral },
    { label: 'Trail', value: state.trailStop > 0 ? formatPrice(state.trailStop) : '--', valueColor: state.trailStop > 0 ? MAKO_COLORS.warn : MAKO_COLORS.neutral },
    { label: 'Stop', value: formatPrice(frameMetrics.stopPrice), valueColor: MAKO_COLORS.bad },
    { label: 'Spread', value: formatPercent(frameMetrics.liquidity.spreadPct), valueColor: frameMetrics.liquidity.ok ? MAKO_COLORS.good : MAKO_COLORS.bad },
    { label: 'RelVol', value: roundTo(frameMetrics.liquidity.relativeVolume, 2).toFixed(2) + 'x', valueColor: frameMetrics.liquidity.ok ? MAKO_COLORS.good : MAKO_COLORS.bad },
    { label: 'Skip', value: skipReason, valueColor: MAKO_COLORS.warn }
  ];
}

function emitChartMark(gb, message) {
  try {
    gb.method.setTimeScaleMark(gb.data.pairName, gb.data.exchangeName, message);
  } catch (err) {
    console.log(logPrefix(gb) + '[WARN][mark] Could not add timescale mark: ' + String(err && err.message ? err.message : err));
  }
}

async function executeBuy(gb, config, state, amountQuote, label, frameMetrics) {
  var executionPrice = Math.max(safeNumber(gb.data.ask, 0), safeNumber(gb.data.bid, 0));
  var minimumBuyValue = minimumBuyBaseValue(gb);
  var orderValueBase = quoteAmountToBaseValue(amountQuote, executionPrice);
  var result;

  if (!isFinite(amountQuote) || amountQuote <= 0 || executionPrice <= 0) {
    return false;
  }

  if (orderValueBase < minimumBuyValue) {
    logWarn(gb, 'buy-skip', label + ' order value ' + formatPrice(orderValueBase) + ' is below MIN_VOLUME_TO_BUY ' + formatPrice(minimumBuyValue));
    return false;
  }

  result = await gb.method.buyMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);
  if (!result) {
    return false;
  }

  state.lastActionAt = Date.now();
  state.lastFillPrice = executionPrice;
  state.trailPeak = 0;
  state.trailStop = 0;
  if (label === 'entry') {
    state.entryTime = Date.now();
    state.layerCount = 0;
    state.tp1Done = false;
    state.phase = 'entry-pending';
  } else {
    state.layerCount += 1;
    state.phase = 'bag';
  }

  emitChartMark(gb, 'Mako ' + label + ' @ ' + formatPrice(executionPrice));
  return true;
}

function normalizedSellAmount(gb, requestedAmount, forceFullIfNeeded) {
  var balance = safeNumber(gb.data.quoteBalance, 0);
  var target = Math.min(balance, Math.max(0, safeNumber(requestedAmount, 0)));

  if (forceFullIfNeeded && balance > 0 && target >= (balance * 0.995)) {
    return balance;
  }
  return target;
}

async function executeSell(gb, state, amountQuote, label, frameMetrics, config, forceFullIfNeeded) {
  var executionPrice = Math.max(safeNumber(gb.data.bid, 0), safeNumber(gb.data.ask, 0), safeNumber(gb.data.breakEven, 0));
  var minimumSellValue = minimumSellBaseValue(gb);
  var balance = safeNumber(gb.data.quoteBalance, 0);
  var fullValue = quoteAmountToBaseValue(balance, executionPrice);
  var orderValueBase = quoteAmountToBaseValue(amountQuote, executionPrice);
  var result;

  if (!isFinite(amountQuote) || amountQuote <= 0 || executionPrice <= 0) {
    return false;
  }

  if (orderValueBase < minimumSellValue) {
    if (forceFullIfNeeded && fullValue >= minimumSellValue) {
      amountQuote = balance;
      orderValueBase = fullValue;
    } else {
      logWarn(gb, 'sell-skip', label + ' order value ' + formatPrice(orderValueBase) + ' is below MIN_VOLUME_TO_SELL ' + formatPrice(minimumSellValue));
      return false;
    }
  }

  result = await gb.method.sellMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);
  if (!result) {
    return false;
  }

  state.lastActionAt = Date.now();
  if (label === 'tp1') {
    state.tp1Done = true;
    state.phase = 'trail';
    state.trailPeak = Math.max(state.trailPeak, frameMetrics.bid);
    state.trailStop = Math.max(frameMetrics.bid * (1 - (config.exits.trailPct / 100)), safeNumber(gb.data.breakEven, 0));
  }

  emitChartMark(gb, 'Mako ' + label + ' @ ' + formatPrice(executionPrice));
  return true;
}

async function runMako(gb) {
  var config = readConfig(gb);
  var state = ensureState(gb);
  var runtime = {
    now: Date.now(),
    actionCooldownActive: false,
    reentryCooldownActive: false
  };
  var hasBag = safeNumber(gb.data.quoteBalance, 0) > 0;
  var hasOpenOrders = Array.isArray(gb.data.openOrders) && gb.data.openOrders.length > 0;
  var buyEnabled = config.execution.useBuyEnabled ? safeBoolean(activeOverrides(gb).BUY_ENABLED, true) : true;
  var sellEnabled = config.execution.useSellEnabled ? safeBoolean(activeOverrides(gb).SELL_ENABLED, true) : true;
  var availableBase = safeNumber(gb.data.baseBalance, 0) - config.capital.fundsReserveBase;
  var enoughEntryBalance = availableBase >= config.capital.tradeLimitBase;
  var frameMetrics;
  var skipReason;
  var breakEven;
  var setupArmed;
  var requestedBuyAmount;
  var requestedLayerAmount;
  var sellAmount;
  var pnlPct;
  var ageMinutes;
  var previousStage;

  pruneNotificationKeys(state, config, runtime.now);
  runtime.actionCooldownActive = (runtime.now - state.lastActionAt) < (config.capital.actionCooldownSeconds * 1000);
  runtime.reentryCooldownActive = runtime.now < state.cooldownUntil;

  recoverBagState(gb, state, runtime.now, hasBag);
  frameMetrics = analyzeFrame(gb, config, state, runtime.now, hasBag);

  if (!frameMetrics.ready) {
    clearChartObjects(gb);
    gb.data.pairLedger.sidebarExtras = [
      { label: 'Mako', value: MAKO_META.version, valueColor: MAKO_COLORS.info },
      { label: 'Stage', value: frameMetrics.reason, valueColor: MAKO_COLORS.neutral }
    ];
    state.lastSkipReason = frameMetrics.reason;
    state.lastStage = frameMetrics.reason;
    state.hadBagLastCycle = hasBag;
    return;
  }

  updateWatchState(state, frameMetrics, hasBag, runtime.now);
  breakEven = safeNumber(gb.data.breakEven, 0);
  updateTrailingState(state, frameMetrics, breakEven, config);

  previousStage = state.lastStage;
  setupArmed = !hasBag && frameMetrics.setupArmed;
  skipReason = buildSkipReason(config, runtime, frameMetrics, hasBag, hasOpenOrders, buyEnabled, enoughEntryBalance);
  if (!config.enabled && !hasBag) {
    frameMetrics.stage = 'disabled';
    setupArmed = false;
  }

  if (setupArmed && previousStage !== frameMetrics.stage) {
    sendNotification(
      gb,
      config,
      state,
      'mako-armed-' + String(frameMetrics.lastTimestamp || runtime.now),
      createNotification(
        'Mako armed on ' + gb.data.pairName + ' with trigger ' + formatPrice(frameMetrics.entryTrigger) + '.',
        'info',
        false
      )
    );
    logInfo(gb, 'armed', 'Stretch armed at ' + roundTo(frameMetrics.stretchAtr, 2).toFixed(2) + 'atr with trigger ' + formatPrice(frameMetrics.entryTrigger) + '.');
  }

  if (state.hadBagLastCycle && !hasBag) {
    clearBagState(state, config, runtime.now);
    logInfo(gb, 'bag-flat', 'Bag closed outside the current Mako action path. Cooldown applied.');
  }

  if (!hasBag && !hasOpenOrders && config.enabled && skipReason === 'entry-ready') {
    requestedBuyAmount = config.capital.tradeLimitBase / Math.max(frameMetrics.ask, frameMetrics.bid);
    if (await executeBuy(gb, config, state, requestedBuyAmount, 'entry', frameMetrics)) {
      sendNotification(
        gb,
        config,
        state,
        'mako-entry-' + String(Date.now()),
        createNotification(
          'Mako entry executed on ' + gb.data.pairName + ' at approx ' + formatPrice(frameMetrics.bid) + '.',
          'success',
          false
        )
      );
      logInfo(gb, 'entry', 'Entry executed at approx ' + formatPrice(frameMetrics.bid) + '.');
    }
  } else if (
    hasBag &&
    !hasOpenOrders &&
    buyEnabled &&
    !runtime.actionCooldownActive &&
    !runtime.reentryCooldownActive &&
    state.layerCount < config.layers.maxCount &&
    frameMetrics.liquidity.ok &&
    frameMetrics.bid <= frameMetrics.reloadTarget &&
    frameMetrics.bid > frameMetrics.stopPrice &&
    availableBase >= config.capital.tradeLimitBase &&
    (!config.layers.requireLowerLowForAdd || frameMetrics.signalLow <= state.watchLow || state.watchLow <= 0)
  ) {
    requestedLayerAmount = config.capital.tradeLimitBase / Math.max(frameMetrics.ask, frameMetrics.bid);
    if (await executeBuy(gb, config, state, requestedLayerAmount, 'layer', frameMetrics)) {
      sendNotification(
        gb,
        config,
        state,
        'mako-layer-' + String(state.layerCount) + '-' + String(Date.now()),
        createNotification(
          'Mako layer #' + String(state.layerCount) + ' executed on ' + gb.data.pairName + '.',
          'warning',
          false
        )
      );
      logInfo(gb, 'layer', 'Layer #' + String(state.layerCount) + ' executed at approx ' + formatPrice(frameMetrics.bid) + '.');
    }
  }

  if (hasBag && !hasOpenOrders) {
    pnlPct = breakEven > 0 ? percentChange(breakEven, frameMetrics.bid) : 0;
    ageMinutes = state.entryTime > 0 ? ((runtime.now - state.entryTime) / 60000) : 0;

    if (!sellEnabled) {
      logDebug(gb, config, 'sell-disabled', 'Sell exits are disabled by pair settings.');
    } else if (frameMetrics.bid <= frameMetrics.stopPrice) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'stop', frameMetrics, config, true)) {
        clearBagState(state, config, runtime.now);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'mako-stop-' + String(Date.now()),
          createNotification(
            'Mako stop exit executed on ' + gb.data.pairName + '.',
            'error',
            true
          )
        );
        logInfo(gb, 'stop-exit', 'Stop exit executed at approx ' + formatPrice(frameMetrics.bid) + '.');
      }
    } else if (!state.tp1Done && frameMetrics.bid >= frameMetrics.tp1Price) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0) * config.exits.tp1SellRatio, false);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'tp1', frameMetrics, config, false)) {
        sendNotification(
          gb,
          config,
          state,
          'mako-tp1-' + String(Date.now()),
          createNotification(
            'Mako TP1 executed on ' + gb.data.pairName + '. Trail armed at ' + formatPrice(state.trailStop) + '.',
            'success',
            false
          )
        );
        logInfo(gb, 'tp1', 'TP1 executed at approx ' + formatPrice(frameMetrics.bid) + '.');
      }
    } else if (state.tp1Done && frameMetrics.bid >= frameMetrics.meanExitPrice && frameMetrics.rsi >= config.exits.meanExitRsi) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'mean', frameMetrics, config, true)) {
        clearBagState(state, config, runtime.now);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'mako-mean-' + String(Date.now()),
          createNotification(
            'Mako mean exit executed on ' + gb.data.pairName + '.',
            'success',
            false
          )
        );
        logInfo(gb, 'mean-exit', 'Mean reversion exit executed at approx ' + formatPrice(frameMetrics.bid) + '.');
      }
    } else if (state.tp1Done && state.trailStop > 0 && frameMetrics.bid <= state.trailStop) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'trail', frameMetrics, config, true)) {
        clearBagState(state, config, runtime.now);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'mako-trail-' + String(Date.now()),
          createNotification(
            'Mako trail exit executed on ' + gb.data.pairName + '.',
            'success',
            false
          )
        );
        logInfo(gb, 'trail-exit', 'Trail exit executed at approx ' + formatPrice(frameMetrics.bid) + '.');
      }
    } else if (!state.tp1Done && ageMinutes >= config.exits.timeStopMinutes && pnlPct <= config.exits.timeStopMaxProfitPct) {
      sellAmount = normalizedSellAmount(gb, safeNumber(gb.data.quoteBalance, 0), true);
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, 'time', frameMetrics, config, true)) {
        clearBagState(state, config, runtime.now);
        hasBag = false;
        sendNotification(
          gb,
          config,
          state,
          'mako-time-' + String(Date.now()),
          createNotification(
            'Mako time stop executed on ' + gb.data.pairName + '.',
            'warning',
            false
          )
        );
        logInfo(gb, 'time-exit', 'Time stop exit executed at approx ' + formatPrice(frameMetrics.bid) + '.');
      }
    }
  }

  setChartObjects(gb, config, state, frameMetrics, hasBag);
  updateSidebar(gb, config, frameMetrics, state, runtime, hasBag, setupArmed, skipReason);
  emitCycleSummary(gb, config, state, frameMetrics, hasBag, setupArmed, skipReason, runtime.reentryCooldownActive);

  if (!hasBag && state.phase !== 'cooldown' && state.phase !== 'entry-pending') {
    state.phase = phaseName(state, hasBag, setupArmed, runtime.reentryCooldownActive);
  }
  state.lastStage = frameMetrics.stage;
  state.lastSkipReason = skipReason;
  state.hadBagLastCycle = hasBag;
}

async function makoStrategy(runtimeGb) {
  var gb = resolveGb(runtimeGb);
  if (!isExpectedStrategyFile(gb, 'Mako.js')) {
    return;
  }
  try {
    await runMako(gb);
  } catch (err) {
    logError(gb, 'fatal', 'Unhandled Mako runtime error.', err);
    throw err;
  }
}

if (typeof module !== 'undefined' && module && module.exports) {
  module.exports = makoStrategy;
} else {
  makoStrategy(typeof gb !== 'undefined' ? gb : undefined);
}
