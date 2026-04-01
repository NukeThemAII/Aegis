/*
 * Viper Inventory Engine
 * Version: 1.0.5
 * Updated: 2026-04-01
 *
 * Spot only. Long only.
 * Inventory-first accumulation and distribution strategy.
 */

var VIPER_META = {
  name: 'Viper Inventory Engine',
  version: '1.0.5',
  updated: '2026-04-01'
};

var VIPER_COLORS = {
  good: '#2ea36c',
  bad: '#cf5a5a',
  warn: '#d09a33',
  neutral: '#8a97a8',
  info: '#4b84d4',
  zoneFill: 'rgba(46, 163, 108, 0.10)',
  zoneBorder: 'rgba(46, 163, 108, 0.45)',
  trimFill: 'rgba(208, 154, 51, 0.10)',
  trimBorder: 'rgba(208, 154, 51, 0.45)',
  riskFill: 'rgba(207, 90, 90, 0.10)',
  riskBorder: 'rgba(207, 90, 90, 0.45)'
};

var VIPER_BASE_CONFIG = {
  enabled: true,
  riskProfile: 'balanced',
  minCandles: 120,
  capital: {
    tradeLimitBase: 100,
    fundsReserveBase: 0,
    reservePctOfTradingLimit: 20,
    actionCooldownSeconds: 12,
    reentryCooldownMinutes: 45
  },
  timeframe: {
    macroPeriod: 1440,
    macroCandles: 140,
    macroCacheSeconds: 1800,
    executionPeriod: 240,
    executionCandles: 220,
    executionCacheSeconds: 300,
    timingPeriod: 60,
    timingCandles: 200,
    timingCacheSeconds: 120
  },
  regime: {
    emaFast: 50,
    emaSlow: 200,
    slopeLookback: 5,
    minSlopePct: 0.00,
    neutralBandPct: 2.0
  },
  indicator: {
    emaFast: 20,
    emaSlow: 50,
    bbLength: 20,
    bbStdDev: 2,
    rsiLength: 14,
    atrLength: 14,
    volumeLookback: 20,
    swingLookback: 16
  },
  entry: {
    starterMinScore: 5,
    starterSizeMultiplier: 1.0,
    valueZoneBufferPct: 0.8,
    chaseAboveUpperBandPct: 0.40,
    chaseAboveEmaFastPct: 2.5,
    chaseRsi: 68,
    requireTimingConfirm: true
  },
  add: {
    unlimitedCount: true,
    maxCount: 4,
    belowBreakEvenOnly: true,
    belowBreakEvenBufferPct: 0,
    minSpacingPct: 1.5,
    spacingAtrMult: 1.2,
    spacingAtrCapPct: 3.0,
    spacingGrowthPct: 30,
    discountAtrMult: 1.4,
    discountAtrCapPct: 4.0,
    discountStepPct: 1.5,
    bullDiscountPct: 2.0,
    neutralDiscountPct: 4.0,
    bearDiscountPct: 7.0,
    capitulationExtraDiscountPct: 2.5,
    maxDepthFromBreakEvenPct: 0,
    addSizeBaseMultiplier: 1.0,
    addSizeStepMultiplier: 0.20,
    addSizeMaxMultiplier: 1.60,
    addMinScore: 5,
    bearAddMinScore: 6,
    addCooldownBars: 1,
    requireReversal: true,
    maxBagBase: 0,
    maxBagPctOfTradingLimit: 0
  },
  exits: {
    trim1Pct: 4.0,
    trim1Ratio: 0.15,
    trim1MinScore: 2,
    trim2Pct: 8.0,
    trim2Ratio: 0.20,
    trim2MinScore: 2,
    trim3Pct: 14.0,
    trim3Ratio: 0.25,
    trim3MinScore: 3,
    trimExtensionEmaFastPct: 2.2,
    bullCoreHoldRatio: 0.35,
    neutralCoreHoldRatio: 0.20,
    bearCoreHoldRatio: 0.10,
    minMinutesBetweenTrims: 60,
    profitOnlyExits: true
  },
  liquidity: {
    maxSpreadPct: 0.15,
    minRelativeVolume: 0.60,
    projectCurrentVolume: true,
    projectedVolumeFloor: 0.25
  },
  risk: {
    useBuyEnabled: true,
    useSellEnabled: true
  },
  visuals: {
    enableCharts: true,
    enableShapes: true
  },
  telemetry: {
    enableNotifications: true,
    enableDebugLogs: false,
    logMode: 'changes',
    notificationRetentionMinutes: 2880,
    notificationKeyLimit: 200,
    notificationPruneIntervalMinutes: 60
  }
};

function applyRiskProfile(config) {
  var profile = String(config.riskProfile || 'balanced').toLowerCase();

  config.timeframe.macroPeriod = 60;
  config.timeframe.executionPeriod = 30;
  config.timeframe.timingPeriod = 15;
  config.timeframe.macroCandles = 140;
  config.timeframe.executionCandles = 220;
  config.timeframe.timingCandles = 200;
  config.timeframe.macroCacheSeconds = 180;
  config.timeframe.executionCacheSeconds = 90;
  config.timeframe.timingCacheSeconds = 60;
  config.regime.emaFast = 34;
  config.regime.emaSlow = 120;
  config.regime.slopeLookback = 4;
  config.regime.neutralBandPct = 1.6;
  config.entry.starterMinScore = 4;
  config.entry.valueZoneBufferPct = 1.15;
  config.entry.chaseAboveUpperBandPct = 1.0;
  config.entry.chaseAboveEmaFastPct = 4.5;
  config.entry.chaseRsi = 74;
  config.add.spacingAtrCapPct = 3.0;
  config.add.discountAtrCapPct = 4.0;

  if (profile === 'conservative') {
    config.timeframe.macroPeriod = 1440;
    config.timeframe.executionPeriod = 240;
    config.timeframe.timingPeriod = 60;
    config.timeframe.macroCandles = 260;
    config.timeframe.executionCandles = 260;
    config.timeframe.timingCandles = 240;
    config.timeframe.macroCacheSeconds = 1800;
    config.timeframe.executionCacheSeconds = 300;
    config.timeframe.timingCacheSeconds = 120;
    config.capital.reservePctOfTradingLimit = 30;
    config.capital.reentryCooldownMinutes = 90;
    config.entry.starterMinScore = 5;
    config.entry.valueZoneBufferPct = 0.9;
    config.entry.chaseAboveUpperBandPct = 0.45;
    config.entry.chaseAboveEmaFastPct = 2.8;
    config.entry.chaseRsi = 70;
    config.add.maxCount = 3;
    config.add.bullDiscountPct = 2.5;
    config.add.neutralDiscountPct = 4.5;
    config.add.bearDiscountPct = 8.0;
    config.add.spacingAtrCapPct = 4.0;
    config.add.discountAtrCapPct = 5.5;
    config.add.addSizeMaxMultiplier = 1.40;
    config.exits.trim1Pct = 4.5;
    config.exits.trim2Pct = 9.0;
    config.exits.trim3Pct = 16.0;
    config.exits.bullCoreHoldRatio = 0.40;
    config.exits.neutralCoreHoldRatio = 0.25;
    config.exits.bearCoreHoldRatio = 0.12;
    return;
  }

  if (profile === 'aggressive') {
    config.timeframe.macroPeriod = 30;
    config.timeframe.executionPeriod = 15;
    config.timeframe.timingPeriod = 15;
    config.timeframe.macroCandles = 120;
    config.timeframe.executionCandles = 200;
    config.timeframe.timingCandles = 200;
    config.timeframe.macroCacheSeconds = 90;
    config.timeframe.executionCacheSeconds = 45;
    config.timeframe.timingCacheSeconds = 45;
    config.regime.emaFast = 21;
    config.regime.emaSlow = 72;
    config.regime.slopeLookback = 4;
    config.regime.neutralBandPct = 1.2;
    config.capital.reservePctOfTradingLimit = 12;
    config.capital.reentryCooldownMinutes = 15;
    config.entry.starterMinScore = 3;
    config.entry.valueZoneBufferPct = 1.6;
    config.entry.chaseAboveUpperBandPct = 1.8;
    config.entry.chaseAboveEmaFastPct = 6.5;
    config.entry.chaseRsi = 78;
    config.entry.requireTimingConfirm = false;
    config.add.maxCount = 6;
    config.add.bullDiscountPct = 1.5;
    config.add.neutralDiscountPct = 3.0;
    config.add.bearDiscountPct = 5.5;
    config.add.spacingAtrCapPct = 2.4;
    config.add.discountAtrCapPct = 3.4;
    config.add.addSizeMaxMultiplier = 1.80;
    config.exits.trim1Pct = 3.5;
    config.exits.trim2Pct = 7.0;
    config.exits.trim3Pct = 12.0;
    config.exits.bullCoreHoldRatio = 0.25;
    config.exits.neutralCoreHoldRatio = 0.15;
    config.exits.bearCoreHoldRatio = 0.08;
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

function pairBaseAsset(gb) {
  var pairName = gb && gb.data ? safeString(gb.data.pairName, '') : '';
  var parts = pairName.split('-');
  return parts.length ? parts[0].toUpperCase() : '';
}

function isStableBaseAsset(gb) {
  var asset = pairBaseAsset(gb);
  return [
    'USDT',
    'USDC',
    'BUSD',
    'FDUSD',
    'TUSD',
    'DAI',
    'USDP',
    'USD1',
    'USD',
    'EUR',
    'AEUR',
    'EURI'
  ].indexOf(asset) >= 0;
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

function sum(values) {
  var total = 0;
  var i;
  for (i = 0; i < values.length; i += 1) {
    if (typeof values[i] === 'number' && isFinite(values[i])) {
      total += values[i];
    }
  }
  return total;
}

function highestFromEnd(values, lookback, endOffset) {
  var end = Math.max(0, values.length - safeNumber(endOffset, 0));
  var start = Math.max(0, end - lookback);
  var highest = null;
  var i;
  for (i = start; i < end; i += 1) {
    if (!isFinite(values[i])) {
      continue;
    }
    if (highest === null || values[i] > highest) {
      highest = values[i];
    }
  }
  return highest === null ? 0 : highest;
}

function lowestFromEnd(values, lookback, endOffset) {
  var end = Math.max(0, values.length - safeNumber(endOffset, 0));
  var start = Math.max(0, end - lookback);
  var lowest = null;
  var i;
  for (i = start; i < end; i += 1) {
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
    return Math.round(numeric / 1000);
  }
  if (numeric > 1000000000) {
    return Math.round(numeric);
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

function aggregateCandles(candles, sourcePeriod, targetPeriod) {
  var factor;
  var out;
  var i;
  var end;

  if (!candles || !candles.close || !candles.close.length) {
    return null;
  }

  factor = Math.max(1, Math.round(targetPeriod / Math.max(1, sourcePeriod)));
  if (factor <= 1) {
    return candles;
  }

  out = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: [],
    timestamp: []
  };

  for (i = 0; i < candles.close.length; i += factor) {
    end = Math.min(i + factor, candles.close.length);
    if ((end - i) < factor) {
      break;
    }
    out.open.push(candles.open[i]);
    out.close.push(candles.close[end - 1]);
    out.high.push(highestFromEnd(candles.high.slice(i, end), end - i, 0));
    out.low.push(lowestFromEnd(candles.low.slice(i, end), end - i, 0));
    out.volume.push(sum(candles.volume.slice(i, end)));
    if (candles.timestamp && candles.timestamp.length >= end) {
      out.timestamp.push(candles.timestamp[end - 1]);
    }
  }

  return out.close.length ? out : null;
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

function calculateSMA(values, period) {
  var result = [];
  var windowSum = 0;
  var i;

  if (!values || values.length < period) {
    return result;
  }

  result.length = values.length;
  for (i = 0; i < values.length; i += 1) {
    windowSum += values[i];
    if (i >= period) {
      windowSum -= values[i - period];
    }
    if (i >= (period - 1)) {
      result[i] = windowSum / period;
    } else {
      result[i] = NaN;
    }
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

function calculateBollinger(values, period, stdDevMultiplier) {
  var midSeries = calculateSMA(values, period);
  var upperSeries = [];
  var lowerSeries = [];
  var start;
  var slice;
  var mean;
  var variance;
  var stdev;
  var i;
  var j;

  if (!values || values.length < period) {
    return {
      mid: midSeries,
      upper: upperSeries,
      lower: lowerSeries
    };
  }

  upperSeries.length = values.length;
  lowerSeries.length = values.length;

  for (i = 0; i < values.length; i += 1) {
    if (i < (period - 1)) {
      upperSeries[i] = NaN;
      lowerSeries[i] = NaN;
      continue;
    }
    start = i - period + 1;
    slice = values.slice(start, i + 1);
    mean = average(slice);
    variance = 0;
    for (j = 0; j < slice.length; j += 1) {
      variance += Math.pow(slice[j] - mean, 2);
    }
    variance = variance / slice.length;
    stdev = Math.sqrt(variance);
    upperSeries[i] = mean + (stdev * stdDevMultiplier);
    lowerSeries[i] = mean - (stdev * stdDevMultiplier);
  }

  return {
    mid: midSeries,
    upper: upperSeries,
    lower: lowerSeries
  };
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

function wickRatios(openValue, highValue, lowValue, closeValue) {
  var range = Math.max(0, highValue - lowValue);
  var lower = 0;
  var upper = 0;
  var closeLocation = 0.5;

  if (range > 0) {
    lower = (Math.min(openValue, closeValue) - lowValue) / range;
    upper = (highValue - Math.max(openValue, closeValue)) / range;
    closeLocation = (closeValue - lowValue) / range;
  }

  return {
    lower: lower,
    upper: upper,
    closeLocation: closeLocation,
    range: range
  };
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
    throw new Error('Viper could not resolve the Gunbot runtime object.');
  }

  return {
    data: snapshotRuntimeData(runtime.data),
    method: runtime.method
  };
}

function buildConfig(gb) {
  var overrides = activeOverrides(gb);
  var config = deepClone(VIPER_BASE_CONFIG);
  var explicitTradeLimit = Object.prototype.hasOwnProperty.call(overrides, 'VIPER_TRADE_LIMIT');

  config.riskProfile = readFirstString(overrides, ['VIPER_RISK_PROFILE'], config.riskProfile).toLowerCase();
  applyRiskProfile(config);

  config.enabled = readFirstBoolean(overrides, ['VIPER_ENABLED'], config.enabled);
  config.minCandles = readFirstNumber(overrides, ['VIPER_MIN_CANDLES'], config.minCandles);

  config.capital.tradeLimitBase = readFirstNumber(
    overrides,
    ['VIPER_TRADE_LIMIT', 'TRADE_LIMIT', 'TRADING_LIMIT'],
    config.capital.tradeLimitBase
  );
  config.capital.fundsReserveBase = readFirstNumber(
    overrides,
    ['VIPER_FUNDS_RESERVE', 'FUNDS_RESERVE'],
    config.capital.fundsReserveBase
  );
  config.capital.reservePctOfTradingLimit = readFirstNumber(
    overrides,
    ['VIPER_RESERVE_PCT_OF_TRADING_LIMIT'],
    config.capital.reservePctOfTradingLimit
  );
  config.capital.actionCooldownSeconds = readFirstNumber(
    overrides,
    ['VIPER_ACTION_COOLDOWN_SECONDS'],
    config.capital.actionCooldownSeconds
  );
  config.capital.reentryCooldownMinutes = readFirstNumber(
    overrides,
    ['VIPER_REENTRY_COOLDOWN_MINUTES'],
    config.capital.reentryCooldownMinutes
  );

  config.timeframe.macroPeriod = readFirstNumber(overrides, ['VIPER_MACRO_PERIOD'], config.timeframe.macroPeriod);
  config.timeframe.macroCandles = readFirstNumber(overrides, ['VIPER_MACRO_CANDLES'], config.timeframe.macroCandles);
  config.timeframe.macroCacheSeconds = readFirstNumber(overrides, ['VIPER_MACRO_CACHE_SECONDS'], config.timeframe.macroCacheSeconds);
  config.timeframe.executionPeriod = readFirstNumber(overrides, ['VIPER_EXECUTION_PERIOD'], config.timeframe.executionPeriod);
  config.timeframe.executionCandles = readFirstNumber(overrides, ['VIPER_EXECUTION_CANDLES'], config.timeframe.executionCandles);
  config.timeframe.executionCacheSeconds = readFirstNumber(overrides, ['VIPER_EXECUTION_CACHE_SECONDS'], config.timeframe.executionCacheSeconds);
  config.timeframe.timingPeriod = readFirstNumber(overrides, ['VIPER_TIMING_PERIOD'], config.timeframe.timingPeriod);
  config.timeframe.timingCandles = readFirstNumber(overrides, ['VIPER_TIMING_CANDLES'], config.timeframe.timingCandles);
  config.timeframe.timingCacheSeconds = readFirstNumber(overrides, ['VIPER_TIMING_CACHE_SECONDS'], config.timeframe.timingCacheSeconds);

  config.regime.emaFast = readFirstNumber(overrides, ['VIPER_REGIME_FAST_EMA'], config.regime.emaFast);
  config.regime.emaSlow = readFirstNumber(overrides, ['VIPER_REGIME_SLOW_EMA'], config.regime.emaSlow);
  config.regime.slopeLookback = readFirstNumber(overrides, ['VIPER_REGIME_SLOPE_LOOKBACK'], config.regime.slopeLookback);
  config.regime.minSlopePct = readFirstNumber(overrides, ['VIPER_REGIME_MIN_SLOPE_PCT'], config.regime.minSlopePct);
  config.regime.neutralBandPct = readFirstNumber(overrides, ['VIPER_REGIME_NEUTRAL_BAND_PCT'], config.regime.neutralBandPct);

  config.indicator.emaFast = readFirstNumber(overrides, ['VIPER_EMA_FAST'], config.indicator.emaFast);
  config.indicator.emaSlow = readFirstNumber(overrides, ['VIPER_EMA_SLOW'], config.indicator.emaSlow);
  config.indicator.bbLength = readFirstNumber(overrides, ['VIPER_BB_LENGTH'], config.indicator.bbLength);
  config.indicator.bbStdDev = readFirstNumber(overrides, ['VIPER_BB_STDDEV'], config.indicator.bbStdDev);
  config.indicator.rsiLength = readFirstNumber(overrides, ['VIPER_RSI_LENGTH', 'RSI_LENGTH'], config.indicator.rsiLength);
  config.indicator.atrLength = readFirstNumber(overrides, ['VIPER_ATR_LENGTH'], config.indicator.atrLength);
  config.indicator.volumeLookback = readFirstNumber(overrides, ['VIPER_VOLUME_LOOKBACK'], config.indicator.volumeLookback);
  config.indicator.swingLookback = readFirstNumber(overrides, ['VIPER_SWING_LOOKBACK'], config.indicator.swingLookback);

  config.entry.starterMinScore = readFirstNumber(overrides, ['VIPER_STARTER_MIN_SCORE'], config.entry.starterMinScore);
  config.entry.starterSizeMultiplier = readFirstNumber(overrides, ['VIPER_STARTER_SIZE_MULTIPLIER'], config.entry.starterSizeMultiplier);
  config.entry.valueZoneBufferPct = readFirstNumber(overrides, ['VIPER_VALUE_ZONE_BUFFER_PCT'], config.entry.valueZoneBufferPct);
  config.entry.chaseAboveUpperBandPct = readFirstNumber(overrides, ['VIPER_CHASE_ABOVE_UPPER_BAND_PCT'], config.entry.chaseAboveUpperBandPct);
  config.entry.chaseAboveEmaFastPct = readFirstNumber(overrides, ['VIPER_CHASE_ABOVE_EMA_FAST_PCT'], config.entry.chaseAboveEmaFastPct);
  config.entry.chaseRsi = readFirstNumber(overrides, ['VIPER_CHASE_RSI'], config.entry.chaseRsi);
  config.entry.requireTimingConfirm = readFirstBoolean(overrides, ['VIPER_REQUIRE_TIMING_CONFIRM'], config.entry.requireTimingConfirm);

  config.add.unlimitedCount = readFirstBoolean(overrides, ['VIPER_UNLIMITED_DCA', 'VIPER_UNLIMITED_ADDS'], config.add.unlimitedCount);
  config.add.maxCount = readFirstNumber(overrides, ['VIPER_MAX_DCA_COUNT', 'VIPER_MAX_ADD_COUNT'], config.add.maxCount);
  config.add.belowBreakEvenOnly = readFirstBoolean(overrides, ['VIPER_DCA_BELOW_BREAK_EVEN_ONLY'], config.add.belowBreakEvenOnly);
  config.add.belowBreakEvenBufferPct = readFirstNumber(overrides, ['VIPER_DCA_BELOW_BREAK_EVEN_BUFFER_PCT'], config.add.belowBreakEvenBufferPct);
  config.add.minSpacingPct = readFirstNumber(overrides, ['VIPER_MIN_SPACING_PCT'], config.add.minSpacingPct);
  config.add.spacingAtrMult = readFirstNumber(overrides, ['VIPER_SPACING_ATR_MULT'], config.add.spacingAtrMult);
  config.add.spacingAtrCapPct = readFirstNumber(overrides, ['VIPER_SPACING_ATR_CAP_PCT'], config.add.spacingAtrCapPct);
  config.add.spacingGrowthPct = readFirstNumber(overrides, ['VIPER_SPACING_GROWTH_PCT'], config.add.spacingGrowthPct);
  config.add.discountAtrMult = readFirstNumber(overrides, ['VIPER_DISCOUNT_ATR_MULT'], config.add.discountAtrMult);
  config.add.discountAtrCapPct = readFirstNumber(overrides, ['VIPER_DISCOUNT_ATR_CAP_PCT'], config.add.discountAtrCapPct);
  config.add.discountStepPct = readFirstNumber(overrides, ['VIPER_DISCOUNT_STEP_PCT'], config.add.discountStepPct);
  config.add.bullDiscountPct = readFirstNumber(overrides, ['VIPER_BULL_DISCOUNT_PCT'], config.add.bullDiscountPct);
  config.add.neutralDiscountPct = readFirstNumber(overrides, ['VIPER_NEUTRAL_DISCOUNT_PCT'], config.add.neutralDiscountPct);
  config.add.bearDiscountPct = readFirstNumber(overrides, ['VIPER_BEAR_DISCOUNT_PCT'], config.add.bearDiscountPct);
  config.add.capitulationExtraDiscountPct = readFirstNumber(overrides, ['VIPER_CAPITULATION_EXTRA_DISCOUNT_PCT'], config.add.capitulationExtraDiscountPct);
  config.add.maxDepthFromBreakEvenPct = readFirstNumber(overrides, ['VIPER_MAX_DCA_DEPTH_PCT'], config.add.maxDepthFromBreakEvenPct);
  config.add.addSizeBaseMultiplier = readFirstNumber(overrides, ['VIPER_ADD_SIZE_BASE_MULT'], config.add.addSizeBaseMultiplier);
  config.add.addSizeStepMultiplier = readFirstNumber(overrides, ['VIPER_ADD_SIZE_STEP_MULT'], config.add.addSizeStepMultiplier);
  config.add.addSizeMaxMultiplier = readFirstNumber(overrides, ['VIPER_ADD_SIZE_MAX_MULT'], config.add.addSizeMaxMultiplier);
  config.add.addMinScore = readFirstNumber(overrides, ['VIPER_ADD_MIN_SCORE'], config.add.addMinScore);
  config.add.bearAddMinScore = readFirstNumber(overrides, ['VIPER_BEAR_ADD_MIN_SCORE'], config.add.bearAddMinScore);
  config.add.addCooldownBars = readFirstNumber(overrides, ['VIPER_ADD_COOLDOWN_BARS'], config.add.addCooldownBars);
  config.add.requireReversal = readFirstBoolean(overrides, ['VIPER_ADD_REQUIRE_REVERSAL'], config.add.requireReversal);
  config.add.maxBagBase = readFirstNumber(overrides, ['VIPER_MAX_BAG_BASE'], config.add.maxBagBase);
  config.add.maxBagPctOfTradingLimit = readFirstNumber(overrides, ['VIPER_MAX_BAG_PCT_OF_TRADING_LIMIT'], config.add.maxBagPctOfTradingLimit);

  config.exits.trim1Pct = readFirstNumber(overrides, ['VIPER_TRIM1_PCT'], config.exits.trim1Pct);
  config.exits.trim1Ratio = readFirstNumber(overrides, ['VIPER_TRIM1_RATIO'], config.exits.trim1Ratio);
  config.exits.trim1MinScore = readFirstNumber(overrides, ['VIPER_TRIM1_MIN_SCORE'], config.exits.trim1MinScore);
  config.exits.trim2Pct = readFirstNumber(overrides, ['VIPER_TRIM2_PCT'], config.exits.trim2Pct);
  config.exits.trim2Ratio = readFirstNumber(overrides, ['VIPER_TRIM2_RATIO'], config.exits.trim2Ratio);
  config.exits.trim2MinScore = readFirstNumber(overrides, ['VIPER_TRIM2_MIN_SCORE'], config.exits.trim2MinScore);
  config.exits.trim3Pct = readFirstNumber(overrides, ['VIPER_TRIM3_PCT'], config.exits.trim3Pct);
  config.exits.trim3Ratio = readFirstNumber(overrides, ['VIPER_TRIM3_RATIO'], config.exits.trim3Ratio);
  config.exits.trim3MinScore = readFirstNumber(overrides, ['VIPER_TRIM3_MIN_SCORE'], config.exits.trim3MinScore);
  config.exits.trimExtensionEmaFastPct = readFirstNumber(overrides, ['VIPER_TRIM_EXTENSION_EMA_FAST_PCT'], config.exits.trimExtensionEmaFastPct);
  config.exits.bullCoreHoldRatio = readFirstNumber(overrides, ['VIPER_BULL_CORE_HOLD_RATIO'], config.exits.bullCoreHoldRatio);
  config.exits.neutralCoreHoldRatio = readFirstNumber(overrides, ['VIPER_NEUTRAL_CORE_HOLD_RATIO'], config.exits.neutralCoreHoldRatio);
  config.exits.bearCoreHoldRatio = readFirstNumber(overrides, ['VIPER_BEAR_CORE_HOLD_RATIO'], config.exits.bearCoreHoldRatio);
  config.exits.minMinutesBetweenTrims = readFirstNumber(overrides, ['VIPER_MIN_MINUTES_BETWEEN_TRIMS'], config.exits.minMinutesBetweenTrims);
  config.exits.profitOnlyExits = readFirstBoolean(overrides, ['VIPER_PROFIT_ONLY_EXITS'], config.exits.profitOnlyExits);

  config.liquidity.maxSpreadPct = readFirstNumber(overrides, ['VIPER_MAX_SPREAD_PCT'], config.liquidity.maxSpreadPct);
  config.liquidity.minRelativeVolume = readFirstNumber(overrides, ['VIPER_MIN_RELATIVE_VOLUME'], config.liquidity.minRelativeVolume);
  config.liquidity.projectCurrentVolume = readFirstBoolean(overrides, ['VIPER_PROJECT_CURRENT_VOLUME'], config.liquidity.projectCurrentVolume);
  config.liquidity.projectedVolumeFloor = readFirstNumber(overrides, ['VIPER_PROJECTED_VOLUME_FLOOR'], config.liquidity.projectedVolumeFloor);

  config.risk.useBuyEnabled = readFirstBoolean(overrides, ['VIPER_USE_BUY_ENABLED'], config.risk.useBuyEnabled);
  config.risk.useSellEnabled = readFirstBoolean(overrides, ['VIPER_USE_SELL_ENABLED'], config.risk.useSellEnabled);

  config.visuals.enableCharts = readFirstBoolean(overrides, ['ENABLE_CHARTS', 'VIPER_ENABLE_CHARTS'], config.visuals.enableCharts);
  config.visuals.enableShapes = readFirstBoolean(overrides, ['ENABLE_CHART_SHAPES', 'VIPER_ENABLE_SHAPES'], config.visuals.enableShapes);
  config.telemetry.enableNotifications = readFirstBoolean(overrides, ['ENABLE_NOTIFICATIONS'], config.telemetry.enableNotifications);
  config.telemetry.enableDebugLogs = readFirstBoolean(overrides, ['ENABLE_DEBUG_LOGS', 'VERBOSE'], config.telemetry.enableDebugLogs);
  config.telemetry.logMode = normalizeLogMode(readFirstString(overrides, ['VIPER_LOG_MODE'], config.telemetry.logMode));

  config.capital.tradeLimitBase = Math.max(0, config.capital.tradeLimitBase);
  if (!explicitTradeLimit && config.capital.tradeLimitBase > 0 && config.capital.tradeLimitBase < 1 && isStableBaseAsset(gb)) {
    config.capital.tradeLimitBase = VIPER_BASE_CONFIG.capital.tradeLimitBase;
  }
  config.capital.fundsReserveBase = Math.max(0, config.capital.fundsReserveBase);
  config.capital.reservePctOfTradingLimit = clamp(config.capital.reservePctOfTradingLimit, 0, 1000);
  config.capital.actionCooldownSeconds = Math.max(1, config.capital.actionCooldownSeconds);
  config.capital.reentryCooldownMinutes = Math.max(0, config.capital.reentryCooldownMinutes);

  config.timeframe.macroPeriod = Math.max(60, config.timeframe.macroPeriod);
  config.timeframe.executionPeriod = Math.max(15, config.timeframe.executionPeriod);
  config.timeframe.timingPeriod = Math.max(5, config.timeframe.timingPeriod);
  config.timeframe.macroCandles = Math.max(50, config.timeframe.macroCandles);
  config.timeframe.executionCandles = Math.max(80, config.timeframe.executionCandles);
  config.timeframe.timingCandles = Math.max(80, config.timeframe.timingCandles);
  config.timeframe.macroCacheSeconds = Math.max(60, config.timeframe.macroCacheSeconds);
  config.timeframe.executionCacheSeconds = Math.max(30, config.timeframe.executionCacheSeconds);
  config.timeframe.timingCacheSeconds = Math.max(30, config.timeframe.timingCacheSeconds);

  config.regime.emaFast = Math.max(5, config.regime.emaFast);
  config.regime.emaSlow = Math.max(config.regime.emaFast + 10, config.regime.emaSlow);
  config.regime.slopeLookback = Math.max(1, config.regime.slopeLookback);
  config.regime.neutralBandPct = clamp(config.regime.neutralBandPct, 0.5, 10.0);

  config.indicator.emaFast = Math.max(2, config.indicator.emaFast);
  config.indicator.emaSlow = Math.max(config.indicator.emaFast + 1, config.indicator.emaSlow);
  config.indicator.bbLength = Math.max(10, config.indicator.bbLength);
  config.indicator.bbStdDev = clamp(config.indicator.bbStdDev, 1.0, 4.0);
  config.indicator.rsiLength = Math.max(2, config.indicator.rsiLength);
  config.indicator.atrLength = Math.max(2, config.indicator.atrLength);
  config.indicator.volumeLookback = Math.max(5, config.indicator.volumeLookback);
  config.indicator.swingLookback = Math.max(4, config.indicator.swingLookback);

  config.entry.starterMinScore = clamp(config.entry.starterMinScore, 1, 8);
  config.entry.starterSizeMultiplier = clamp(config.entry.starterSizeMultiplier, 0.25, 3.0);
  config.entry.valueZoneBufferPct = clamp(config.entry.valueZoneBufferPct, 0.10, 5.0);
  config.entry.chaseAboveUpperBandPct = clamp(config.entry.chaseAboveUpperBandPct, 0, 3.0);
  config.entry.chaseAboveEmaFastPct = clamp(config.entry.chaseAboveEmaFastPct, 0.10, 10.0);
  config.entry.chaseRsi = clamp(config.entry.chaseRsi, 50, 95);

  config.add.maxCount = Math.max(0, Math.floor(config.add.maxCount));
  config.add.belowBreakEvenBufferPct = clamp(config.add.belowBreakEvenBufferPct, 0, 10.0);
  config.add.minSpacingPct = clamp(config.add.minSpacingPct, 0.10, 20.0);
  config.add.spacingAtrMult = clamp(config.add.spacingAtrMult, 0.10, 10.0);
  config.add.spacingAtrCapPct = clamp(config.add.spacingAtrCapPct, 0.10, 20.0);
  config.add.spacingGrowthPct = clamp(config.add.spacingGrowthPct, 0, 200);
  config.add.discountAtrMult = clamp(config.add.discountAtrMult, 0, 10.0);
  config.add.discountAtrCapPct = clamp(config.add.discountAtrCapPct, 0.10, 20.0);
  config.add.discountStepPct = clamp(config.add.discountStepPct, 0, 10.0);
  config.add.maxDepthFromBreakEvenPct = Math.max(0, config.add.maxDepthFromBreakEvenPct);
  config.add.addSizeBaseMultiplier = clamp(config.add.addSizeBaseMultiplier, 0.25, 5.0);
  config.add.addSizeStepMultiplier = clamp(config.add.addSizeStepMultiplier, 0, 2.0);
  config.add.addSizeMaxMultiplier = clamp(config.add.addSizeMaxMultiplier, config.add.addSizeBaseMultiplier, 10.0);
  config.add.addMinScore = clamp(config.add.addMinScore, 1, 10);
  config.add.bearAddMinScore = clamp(config.add.bearAddMinScore, config.add.addMinScore, 12);
  config.add.addCooldownBars = Math.max(0, Math.floor(config.add.addCooldownBars));
  config.add.maxBagBase = Math.max(0, config.add.maxBagBase);
  config.add.maxBagPctOfTradingLimit = clamp(config.add.maxBagPctOfTradingLimit, 0, 1000);

  config.exits.trim1Ratio = clamp(config.exits.trim1Ratio, 0.02, 0.95);
  config.exits.trim2Ratio = clamp(config.exits.trim2Ratio, 0.02, 0.95);
  config.exits.trim3Ratio = clamp(config.exits.trim3Ratio, 0.02, 0.95);
  config.exits.trim1MinScore = clamp(config.exits.trim1MinScore, 1, 6);
  config.exits.trim2MinScore = clamp(config.exits.trim2MinScore, 1, 6);
  config.exits.trim3MinScore = clamp(config.exits.trim3MinScore, 1, 6);
  config.exits.trimExtensionEmaFastPct = clamp(config.exits.trimExtensionEmaFastPct, 0.2, 20.0);
  config.exits.bullCoreHoldRatio = clamp(config.exits.bullCoreHoldRatio, 0, 0.95);
  config.exits.neutralCoreHoldRatio = clamp(config.exits.neutralCoreHoldRatio, 0, 0.95);
  config.exits.bearCoreHoldRatio = clamp(config.exits.bearCoreHoldRatio, 0, 0.95);
  config.exits.minMinutesBetweenTrims = Math.max(0, config.exits.minMinutesBetweenTrims);

  config.liquidity.maxSpreadPct = clamp(config.liquidity.maxSpreadPct, 0.01, 5.0);
  config.liquidity.minRelativeVolume = clamp(config.liquidity.minRelativeVolume, 0.01, 10.0);
  config.liquidity.projectedVolumeFloor = clamp(config.liquidity.projectedVolumeFloor, 0.10, 1.0);

  return config;
}

function isExpectedStrategyFile(gb, expectedName) {
  var actual = safeString(activeOverrides(gb).STRAT_FILENAME, '');
  return actual.toLowerCase() === String(expectedName || '').toLowerCase();
}

function ensureState(gb) {
  if (!gb.data.pairLedger || typeof gb.data.pairLedger !== 'object') {
    gb.data.pairLedger = {};
  }
  if (!gb.data.pairLedger.customStratStore || typeof gb.data.pairLedger.customStratStore !== 'object' || Array.isArray(gb.data.pairLedger.customStratStore)) {
    if (gb.data.customStratStore && typeof gb.data.customStratStore === 'object' && !Array.isArray(gb.data.customStratStore)) {
      gb.data.pairLedger.customStratStore = gb.data.customStratStore;
    } else {
      gb.data.pairLedger.customStratStore = {};
    }
  }
  gb.data.customStratStore = gb.data.pairLedger.customStratStore;
  if (!gb.data.customStratStore.viper || typeof gb.data.customStratStore.viper !== 'object' || Array.isArray(gb.data.customStratStore.viper)) {
    gb.data.customStratStore.viper = {};
  }

  var state = gb.data.customStratStore.viper;

  if (!state.notificationKeys || typeof state.notificationKeys !== 'object') {
    state.notificationKeys = {};
  }
  if (!state.candleCache || typeof state.candleCache !== 'object') {
    state.candleCache = {};
  }

  state.metaVersion = VIPER_META.version;
  if (typeof state.phase !== 'string') {
    state.phase = 'flat';
  }
  if (typeof state.addCount !== 'number') {
    state.addCount = 0;
  }
  if (typeof state.trim1Done !== 'boolean') {
    state.trim1Done = false;
  }
  if (typeof state.trim2Done !== 'boolean') {
    state.trim2Done = false;
  }
  if (typeof state.trim3Done !== 'boolean') {
    state.trim3Done = false;
  }
  if (typeof state.lastActionAt !== 'number') {
    state.lastActionAt = 0;
  }
  if (typeof state.lastBuyAt !== 'number') {
    state.lastBuyAt = 0;
  }
  if (typeof state.lastTrimAt !== 'number') {
    state.lastTrimAt = 0;
  }
  if (typeof state.lastFillPrice !== 'number') {
    state.lastFillPrice = 0;
  }
  if (typeof state.lastTrimPrice !== 'number') {
    state.lastTrimPrice = 0;
  }
  if (typeof state.entryTime !== 'number') {
    state.entryTime = 0;
  }
  if (typeof state.cooldownUntil !== 'number') {
    state.cooldownUntil = 0;
  }
  if (typeof state.bagPeakSize !== 'number') {
    state.bagPeakSize = 0;
  }
  if (typeof state.lastActionLabel !== 'string') {
    state.lastActionLabel = '';
  }
  if (typeof state.lastSkipReason !== 'string') {
    state.lastSkipReason = '';
  }
  if (typeof state.lastStage !== 'string') {
    state.lastStage = '';
  }
  if (typeof state.lastRegime !== 'string') {
    state.lastRegime = '';
  }
  if (typeof state.lastStarterArmed !== 'boolean') {
    state.lastStarterArmed = false;
  }
  if (typeof state.lastAddReady !== 'boolean') {
    state.lastAddReady = false;
  }
  if (typeof state.lastTrimReady !== 'string') {
    state.lastTrimReady = '';
  }
  if (typeof state.hadBagLastCycle !== 'boolean') {
    state.hadBagLastCycle = false;
  }
  if (typeof state.lastCycleSummaryKey !== 'string') {
    state.lastCycleSummaryKey = '';
  }
  if (typeof state.lastNotificationPruneAt !== 'number') {
    state.lastNotificationPruneAt = 0;
  }
  if (typeof state.lastClosedAt !== 'number') {
    state.lastClosedAt = 0;
  }
  if (typeof state.lastClosedReason !== 'string') {
    state.lastClosedReason = '';
  }

  return state;
}

function logPrefix(gb) {
  return '[' + VIPER_META.name + ' ' + VIPER_META.version + '][' + String(gb.data.exchangeName || '') + '][' + String(gb.data.pairName || '') + ']';
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
    return VIPER_COLORS.neutral;
  }
  return isGood ? VIPER_COLORS.good : VIPER_COLORS.bad;
}

function minBaseVolumeToBuy(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).MIN_VOLUME_TO_BUY, 0));
}

function minBaseVolumeToSell(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).MIN_VOLUME_TO_SELL, 0));
}

function tradingLimitBase(gb) {
  return Math.max(0, safeNumber(activeOverrides(gb).TRADING_LIMIT, 0));
}

function reserveRequirementBase(gb, config) {
  var tradingLimit = tradingLimitBase(gb);
  var pctReserve = tradingLimit > 0 ? (tradingLimit * (config.capital.reservePctOfTradingLimit / 100)) : 0;

  return Math.max(config.capital.fundsReserveBase, pctReserve);
}

function availableBaseForBuys(gb, config) {
  return Math.max(0, safeNumber(gb.data.baseBalance, 0) - reserveRequirementBase(gb, config));
}

function hasUsableBag(gb) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var minSellBaseValue = minBaseVolumeToSell(gb);
  var bid = Math.max(
    safeNumber(gb.data.bid, 0),
    safeNumber(gb.data.ask, 0),
    safeNumber(gb.data.BEP, 0),
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

function latestMatchingOrder(gb, type) {
  var orders = gb && gb.data && Array.isArray(gb.data.orders) ? gb.data.orders : [];
  var pairName = gb && gb.data ? safeString(gb.data.pairName, '') : '';
  var latest = 0;
  var latestOrder = null;
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
      latestOrder = order;
    }
  }

  return latestOrder;
}

function recoveredBagEntryTime(gb) {
  var latestBuy = latestMatchingOrder(gb, 'buy');
  var latestSell = latestMatchingOrder(gb, 'sell');
  var whenBought = normalizeRecoveredEntryTime(gb && gb.data && gb.data.pairLedger ? gb.data.pairLedger.whenwebought : 0);
  var latestBuyTime = latestBuy ? safeNumber(latestBuy.time, 0) : 0;
  var latestSellTime = latestSell ? safeNumber(latestSell.time, 0) : 0;

  if (latestBuyTime > 0 && latestBuyTime >= latestSellTime) {
    return latestBuyTime;
  }
  if (whenBought > 0 && whenBought >= latestSellTime) {
    return whenBought;
  }
  return latestBuyTime > 0 ? latestBuyTime : whenBought;
}

function updateBagRecovery(gb, state, now, hasBag) {
  var recoveredEntry = recoveredBagEntryTime(gb);

  if (!hasBag) {
    state.bagPeakSize = 0;
    return;
  }

  if (state.entryTime <= 0) {
    state.entryTime = recoveredEntry > 0 ? recoveredEntry : now;
  }
  if (state.lastFillPrice <= 0) {
    state.lastFillPrice = Math.max(safeNumber(gb.data.BEP, 0), safeNumber(gb.data.breakEven, 0), safeNumber(gb.data.bid, 0));
  }
  state.bagPeakSize = Math.max(state.bagPeakSize || 0, safeNumber(gb.data.quoteBalance, 0));

  if (state.phase === 'flat' || state.phase === 'cooldown') {
    state.phase = phaseName(state, true, false, false);
  }
}

function recordExternalClose(state, now) {
  state.lastClosedAt = now;
  state.lastClosedReason = 'external-close';
}

async function getCachedCandles(gb, state, cacheKey, period, count, cacheSeconds, allowLocalFallback) {
  var cache = state.candleCache && state.candleCache[cacheKey] ? state.candleCache[cacheKey] : null;
  var now = Date.now();
  var raw;
  var normalized;
  var localPeriod;

  if (cache && cache.ready && cache.fetchedAt > 0 && ((now - cache.fetchedAt) < (cacheSeconds * 1000))) {
    return cache;
  }

  try {
    raw = await gb.method.getCandles(count, period, gb.data.pairName, gb.data.exchangeName);
    normalized = normalizeFetchedCandles(raw);
    if (!normalized) {
      throw new Error('empty-candles');
    }
    cache = {
      ready: true,
      fetchedAt: now,
      period: period,
      candles: normalized,
      stale: false
    };
    state.candleCache[cacheKey] = cache;
    return cache;
  } catch (err) {
    if (cache && cache.ready) {
      cache.stale = true;
      cache.fetchError = String(err && err.message ? err.message : err);
      return cache;
    }
    if (allowLocalFallback) {
      normalized = normalizeLocalCandles(gb);
      if (normalized) {
        localPeriod = Math.max(1, safeNumber(gb.data.period, period));
        normalized = aggregateCandles(normalized, localPeriod, period) || normalized;
        return {
          ready: true,
          fetchedAt: now,
          period: period,
          candles: normalized,
          stale: true,
          fetchError: String(err && err.message ? err.message : err)
        };
      }
    }
    return {
      ready: false,
      fetchedAt: now,
      period: period,
      candles: null,
      fetchError: String(err && err.message ? err.message : err)
    };
  }
}

function macroRegimeLabel(metrics) {
  if (!metrics || !metrics.ready) {
    return 'unknown';
  }
  return metrics.label;
}

function macroScoreWeight(metrics) {
  if (!metrics || !metrics.ready) {
    return 0;
  }
  if (metrics.label === 'bull') {
    return 2;
  }
  if (metrics.label === 'neutral' && metrics.improving) {
    return 1;
  }
  return 0;
}

function coreHoldRatioForRegime(config, regimeLabel) {
  if (regimeLabel === 'bull') {
    return config.exits.bullCoreHoldRatio;
  }
  if (regimeLabel === 'bear') {
    return config.exits.bearCoreHoldRatio;
  }
  return config.exits.neutralCoreHoldRatio;
}

function regimeDiscountBase(config, regimeLabel) {
  if (regimeLabel === 'bull') {
    return config.add.bullDiscountPct;
  }
  if (regimeLabel === 'bear') {
    return config.add.bearDiscountPct;
  }
  return config.add.neutralDiscountPct;
}

function discountTargetPct(config, regimeLabel, addCount, atrPct, capitulationBias) {
  var base = regimeDiscountBase(config, regimeLabel);
  var stepped = base + (Math.max(0, addCount) * config.add.discountStepPct);
  var atrDriven = Math.min(atrPct * config.add.discountAtrMult, config.add.discountAtrCapPct);
  var result = Math.max(stepped, atrDriven);

  if (capitulationBias) {
    result += config.add.capitulationExtraDiscountPct;
  }

  return result;
}

function spacingRequirementPct(config, addCount, atrPct) {
  var fixed = config.add.minSpacingPct * (1 + ((Math.max(0, addCount) * config.add.spacingGrowthPct) / 100));
  var atrDriven = Math.min(atrPct * config.add.spacingAtrMult, config.add.spacingAtrCapPct);

  return Math.max(fixed, atrDriven);
}

function addSizeMultiplier(config, addCount, regimeLabel) {
  var base = config.add.addSizeBaseMultiplier + (Math.max(0, addCount) * config.add.addSizeStepMultiplier);
  var regimeScale = 1;

  if (regimeLabel === 'neutral') {
    regimeScale = 0.90;
  } else if (regimeLabel === 'bear') {
    regimeScale = 0.75;
  }

  return clamp(base * regimeScale, 0.25, config.add.addSizeMaxMultiplier);
}

function adjustTrimTargetPct(basePct, regimeLabel) {
  if (regimeLabel === 'bull') {
    return basePct * 1.10;
  }
  if (regimeLabel === 'bear') {
    return basePct * 0.85;
  }
  return basePct;
}

function adjustTrimRatio(baseRatio, regimeLabel) {
  if (regimeLabel === 'bull') {
    return clamp(baseRatio * 0.85, 0.02, 0.95);
  }
  if (regimeLabel === 'bear') {
    return clamp(baseRatio * 1.15, 0.02, 0.95);
  }
  return baseRatio;
}

function configuredBagBaseLimit(gb, config) {
  var explicitBase = Math.max(0, safeNumber(config && config.add ? config.add.maxBagBase : 0, 0));
  var tradingLimit = tradingLimitBase(gb);
  var pctLimit = Math.max(0, safeNumber(config && config.add ? config.add.maxBagPctOfTradingLimit : 0, 0));

  if (explicitBase > 0) {
    return explicitBase;
  }
  if (pctLimit > 0 && tradingLimit > 0) {
    return tradingLimit * (pctLimit / 100);
  }
  return 0;
}

function currentBagBaseExposure(gb, fallbackPrice) {
  var quoteBalance = Math.max(0, safeNumber(gb && gb.data ? gb.data.quoteBalance : 0, 0));
  var breakEven = Math.max(0, safeNumber(gb && gb.data ? gb.data.BEP : 0, 0), safeNumber(gb && gb.data ? gb.data.breakEven : 0, 0));
  var price = breakEven > 0
    ? breakEven
    : Math.max(
      0,
      safeNumber(fallbackPrice, 0),
      safeNumber(gb && gb.data ? gb.data.bid : 0, 0),
      safeNumber(gb && gb.data ? gb.data.ask : 0, 0)
    );

  return quoteAmountToBaseValue(quoteBalance, price);
}

function withinBagBaseLimit(gb, config, plannedQuoteAmount, plannedPrice) {
  var limit = configuredBagBaseLimit(gb, config);
  var projectedBaseValue;

  if (limit <= 0) {
    return true;
  }

  projectedBaseValue = currentBagBaseExposure(gb, plannedPrice) +
    quoteAmountToBaseValue(plannedQuoteAmount, plannedPrice);

  return projectedBaseValue <= (limit + 0.00000001);
}

function hasAddCapacity(config, state) {
  if (config.add.unlimitedCount) {
    return true;
  }
  return state.addCount < config.add.maxCount;
}

function withinAddDepthLimit(config, discountToBepPct) {
  if (config.add.maxDepthFromBreakEvenPct <= 0) {
    return true;
  }
  return discountToBepPct <= config.add.maxDepthFromBreakEvenPct;
}

function inventoryMode(state, gb, config, regimeLabel) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var baseReference = Math.max(0.00000001, config.capital.tradeLimitBase / Math.max(0.00000001, Math.max(safeNumber(gb.data.BEP, 0), safeNumber(gb.data.bid, 0), safeNumber(gb.data.ask, 0))));
  var ratio = quoteBalance / baseReference;
  var discountToBepPct = 0;
  var bep = Math.max(0, safeNumber(gb.data.BEP, 0), safeNumber(gb.data.breakEven, 0));

  if (bep > 0 && safeNumber(gb.data.bid, 0) < bep) {
    discountToBepPct = percentChange(safeNumber(gb.data.bid, 0), bep);
  }

  if (!hasUsableBag(gb)) {
    return 'flat';
  }
  if (state.addCount <= 0 && ratio < 1.35) {
    return 'starter';
  }
  if (state.addCount >= 3 || ratio >= 3.0) {
    return discountToBepPct >= regimeDiscountBase(config, regimeLabel) ? 'recovery' : 'heavy';
  }
  if (discountToBepPct >= regimeDiscountBase(config, regimeLabel)) {
    return 'recovery';
  }
  return 'built';
}

function evaluateMacro(candles, config) {
  var close = candles ? candles.close : [];
  var fastSeries;
  var slowSeries;
  var lastIndex;
  var slopeIndex;
  var closeLast;
  var fastLast;
  var slowLast;
  var fastSlopePct;
  var closeDistancePct;
  var label;
  var improving;
  var score = 0;

  if (!candles || !close || close.length < Math.max(config.regime.emaSlow + 5, config.regime.slopeLookback + 5)) {
    return {
      ready: false,
      label: 'unknown',
      improving: false,
      score: 0,
      reason: 'macro-data-short'
    };
  }

  fastSeries = calculateEMA(close, config.regime.emaFast);
  slowSeries = calculateEMA(close, config.regime.emaSlow);
  lastIndex = close.length - 1;
  slopeIndex = Math.max(0, lastIndex - config.regime.slopeLookback);
  closeLast = close[lastIndex];
  fastLast = fastSeries[lastIndex];
  slowLast = slowSeries[lastIndex];
  fastSlopePct = percentChange(fastSeries[slopeIndex], fastLast);
  closeDistancePct = percentChange(slowLast, closeLast);

  if (closeLast > slowLast && fastLast > slowLast && fastSlopePct >= config.regime.minSlopePct) {
    label = 'bull';
    score = 3;
  } else if (closeLast < slowLast && fastLast < slowLast && fastSlopePct <= (-1 * config.regime.minSlopePct)) {
    label = 'bear';
    score = 0;
  } else {
    label = 'neutral';
    score = 1;
  }

  improving = label === 'neutral' && (closeLast >= fastLast || fastSlopePct > 0 || Math.abs(closeDistancePct) <= config.regime.neutralBandPct);

  return {
    ready: true,
    label: label,
    improving: improving,
    score: score,
    close: closeLast,
    fast: fastLast,
    slow: slowLast,
    fastSlopePct: fastSlopePct,
    closeDistancePct: closeDistancePct,
    lastTimestamp: candles.timestamp && candles.timestamp.length ? candles.timestamp[candles.timestamp.length - 1] : 0,
    reason: label
  };
}

function evaluateTiming(candles, config) {
  var close = candles ? candles.close : [];
  var open = candles ? candles.open : [];
  var high = candles ? candles.high : [];
  var low = candles ? candles.low : [];
  var volume = candles ? candles.volume : [];
  var emaSeries;
  var rsiSeries;
  var avgVolume;
  var lastIndex;
  var wick;
  var closeLast;
  var openLast;
  var highLast;
  var lowLast;
  var prevClose;
  var prevHigh;
  var volumeLast;
  var emaLast;
  var rsiLast;
  var volumeRatio;
  var reclaimOk;
  var bearishReject;

  if (!candles || close.length < Math.max(config.indicator.bbLength + 5, config.indicator.rsiLength + 5)) {
    return {
      ready: false,
      confirm: false,
      bearishReject: false,
      reason: 'timing-data-short'
    };
  }

  lastIndex = close.length - 1;
  closeLast = close[lastIndex];
  openLast = open[lastIndex];
  highLast = high[lastIndex];
  lowLast = low[lastIndex];
  prevClose = close[Math.max(0, lastIndex - 1)];
  prevHigh = high[Math.max(0, lastIndex - 1)];
  emaSeries = calculateEMA(close, config.indicator.emaFast);
  rsiSeries = calculateRSI(close, config.indicator.rsiLength);
  emaLast = lastDefined(emaSeries) || closeLast;
  rsiLast = lastDefined(rsiSeries) || 50;
  avgVolume = average(volume.slice(Math.max(0, volume.length - config.indicator.volumeLookback - 1), volume.length - 1));
  volumeLast = volume[lastIndex];
  volumeRatio = avgVolume > 0 ? (volumeLast / avgVolume) : 1;
  wick = wickRatios(openLast, highLast, lowLast, closeLast);

  reclaimOk = closeLast > emaLast &&
    closeLast > prevClose &&
    closeLast >= ((Math.max(openLast, prevClose) + lowLast) / 2) &&
    (wick.lower >= 0.30 || wick.closeLocation >= 0.58 || closeLast >= prevHigh) &&
    rsiLast >= 40 &&
    volumeRatio >= 0.80;

  bearishReject = closeLast < openLast &&
    wick.upper >= 0.30 &&
    closeLast < emaLast &&
    rsiLast >= 60;

  return {
    ready: true,
    confirm: reclaimOk,
    bearishReject: bearishReject,
    rsi: rsiLast,
    emaFast: emaLast,
    volumeRatio: volumeRatio,
    reason: reclaimOk ? 'timing-ok' : 'timing-soft'
  };
}

function analyzeExecution(candles, gb, config, state, hasBag, macroMetrics, timingMetrics) {
  var close = candles ? candles.close : [];
  var open = candles ? candles.open : [];
  var high = candles ? candles.high : [];
  var low = candles ? candles.low : [];
  var volume = candles ? candles.volume : [];
  var timestamp = candles ? candles.timestamp : [];
  var emaFastSeries;
  var emaSlowSeries;
  var ema200Series;
  var rsiSeries;
  var atrSeries;
  var bb;
  var lastIndex;
  var prevIndex;
  var bid;
  var ask;
  var openLast;
  var highLast;
  var lowLast;
  var closeLast;
  var volumeLast;
  var prevClose;
  var prevOpen;
  var prevHigh;
  var prevLow;
  var wick;
  var emaFastLast;
  var emaSlowLast;
  var ema200Last;
  var rsiLast;
  var rsiPrev;
  var atrLast;
  var bbMid;
  var bbUpper;
  var bbLower;
  var avgVolume;
  var projectedVolume;
  var completedVolume;
  var effectiveVolume;
  var relativeVolume;
  var spreadPct;
  var atrPct;
  var volumeOk;
  var liquidityOk;
  var lowerBandStretch;
  var aboveUpperBand;
  var valueZone;
  var starterUpperBound;
  var starterLowerBound;
  var oversold;
  var deepOversold;
  var noChase;
  var execReversal;
  var confirmReversal;
  var recentLow;
  var recentHigh;
  var newLow;
  var extensionPct;
  var bep;
  var discountToBepPct;
  var profitPct;
  var spacingPct;
  var discountTarget;
  var nextAddTarget;
  var starterTarget;
  var riskFloor;
  var starterScore = 0;
  var addScore = 0;
  var trimScore = 0;
  var addReason = 'n/a';
  var trimReason = 'n/a';
  var starterReason = 'n/a';
  var starterReady = false;
  var addReady = false;
  var trimTier = '';
  var trimTarget = 0;
  var trimAmountRatio = 0;
  var trimTierScore = 0;
  var regimeLabel = macroRegimeLabel(macroMetrics);
  var timingConfirmed = timingMetrics && timingMetrics.ready ? timingMetrics.confirm : false;
  var bearishTiming = timingMetrics && timingMetrics.ready ? timingMetrics.bearishReject : false;

  if (!candles || close.length < Math.max(config.minCandles, config.indicator.bbLength + 5, config.indicator.atrLength + 5)) {
    return {
      ready: false,
      reason: 'execution-data-short'
    };
  }

  lastIndex = close.length - 1;
  prevIndex = Math.max(0, lastIndex - 1);
  bid = Math.max(safeNumber(gb.data.bid, 0), safeNumber(close[lastIndex], 0));
  ask = Math.max(bid, safeNumber(gb.data.ask, bid));
  openLast = open[lastIndex];
  highLast = high[lastIndex];
  lowLast = low[lastIndex];
  closeLast = close[lastIndex];
  volumeLast = volume[lastIndex];
  prevClose = close[prevIndex];
  prevOpen = open[prevIndex];
  prevHigh = high[prevIndex];
  prevLow = low[prevIndex];
  wick = wickRatios(openLast, highLast, lowLast, closeLast);

  emaFastSeries = calculateEMA(close, config.indicator.emaFast);
  emaSlowSeries = calculateEMA(close, config.indicator.emaSlow);
  ema200Series = calculateEMA(close, Math.max(config.indicator.emaSlow, config.regime.emaSlow));
  rsiSeries = calculateRSI(close, config.indicator.rsiLength);
  atrSeries = calculateATR(high, low, close, config.indicator.atrLength);
  bb = calculateBollinger(close, config.indicator.bbLength, config.indicator.bbStdDev);

  emaFastLast = lastDefined(emaFastSeries) || bid;
  emaSlowLast = lastDefined(emaSlowSeries) || bid;
  ema200Last = lastDefined(ema200Series) || bid;
  rsiLast = lastDefined(rsiSeries) || 50;
  rsiPrev = previousDefined(rsiSeries) || rsiLast;
  atrLast = lastDefined(atrSeries) || Math.max(0, highLast - lowLast);
  bbMid = lastDefined(bb.mid) || bid;
  bbUpper = lastDefined(bb.upper) || bid;
  bbLower = lastDefined(bb.lower) || bid;

  avgVolume = average(volume.slice(Math.max(0, volume.length - config.indicator.volumeLookback - 1), volume.length - 1));
  projectedVolume = projectSignalVolume(volumeLast, timestamp[lastIndex], config.timeframe.executionPeriod, Date.now(), config);
  completedVolume = volume[Math.max(0, lastIndex - 1)];
  effectiveVolume = Math.max(projectedVolume, Math.max(0, safeNumber(completedVolume, 0)));
  relativeVolume = avgVolume > 0 ? (effectiveVolume / avgVolume) : 1;
  spreadPct = bid > 0 ? ((ask - bid) / bid) * 100 : 999;
  atrPct = bid > 0 ? ((atrLast / bid) * 100) : 0;

  volumeOk = relativeVolume >= config.liquidity.minRelativeVolume;
  liquidityOk = spreadPct <= config.liquidity.maxSpreadPct && volumeOk;

  lowerBandStretch = bid <= bbLower;
  aboveUpperBand = bid >= bbUpper;
  starterUpperBound = Math.max(bbMid, emaFastLast * (1 + (config.entry.valueZoneBufferPct / 100)));
  starterLowerBound = Math.min(bbLower, emaSlowLast * (1 - ((config.entry.valueZoneBufferPct * 1.5) / 100)));
  valueZone = bid <= starterUpperBound && bid >= starterLowerBound;
  oversold = lowerBandStretch || rsiLast <= 35;
  deepOversold = (bid <= bbLower && rsiLast <= 30);
  noChase = !(bid > (bbUpper * (1 + (config.entry.chaseAboveUpperBandPct / 100))) ||
    bid > (emaFastLast * (1 + (config.entry.chaseAboveEmaFastPct / 100))) ||
    rsiLast >= config.entry.chaseRsi);

  execReversal = closeLast > openLast &&
    closeLast > prevClose &&
    (wick.lower >= 0.30 || wick.closeLocation >= 0.58 || closeLast >= prevHigh || closeLast >= ((prevHigh + prevLow) / 2));
  confirmReversal = execReversal || timingConfirmed;

  recentLow = lowestFromEnd(low, config.indicator.swingLookback, 1);
  recentHigh = highestFromEnd(high, config.indicator.swingLookback, 1);
  newLow = recentLow > 0 && (lowLast <= recentLow || bid <= (recentLow * 1.002));
  extensionPct = percentChange(emaFastLast, bid);

  bep = Math.max(0, safeNumber(gb.data.BEP, 0), safeNumber(gb.data.breakEven, 0));
  discountToBepPct = bep > 0 && bid < bep ? ((bep - bid) / bep) * 100 : 0;
  profitPct = bep > 0 ? percentChange(bep, bid) : 0;

  spacingPct = spacingRequirementPct(config, state.addCount, atrPct);
  discountTarget = discountTargetPct(config, regimeLabel, state.addCount, atrPct, regimeLabel === 'bear');
  nextAddTarget = hasBag
    ? Math.min(
      state.lastFillPrice > 0 ? state.lastFillPrice * (1 - (spacingPct / 100)) : bid,
      bep > 0 ? bep * (1 - ((discountTarget + config.add.belowBreakEvenBufferPct) / 100)) : bid
    )
    : Math.min(emaFastLast, bbMid, bid);
  starterTarget = Math.min(emaFastLast, bbMid);
  riskFloor = Math.min(
    lowestFromEnd(low, Math.max(6, config.indicator.swingLookback), 0),
    bbLower,
    emaSlowLast - atrLast
  );
  if (!isFinite(riskFloor) || riskFloor <= 0) {
    riskFloor = Math.min(lowLast, emaSlowLast);
  }

  starterScore += macroScoreWeight(macroMetrics);
  starterScore += valueZone ? 1 : 0;
  starterScore += confirmReversal ? 1 : 0;
  starterScore += volumeOk ? 1 : 0;
  starterScore += noChase ? 1 : 0;
  starterScore += bid <= bbMid ? 1 : 0;

  if (regimeLabel === 'bear') {
    starterReason = 'bear-regime-starter-blocked';
  } else if (!noChase) {
    starterReason = 'chase-blocked';
  } else if (!valueZone && bid > starterTarget) {
    starterReason = 'not-in-value-zone';
  } else if (config.entry.requireTimingConfirm && !confirmReversal) {
    starterReason = 'waiting-reversal';
  } else if (!liquidityOk) {
    starterReason = volumeOk ? 'spread-too-wide' : 'volume-too-light';
  } else if (starterScore < config.entry.starterMinScore) {
    starterReason = 'starter-score-low';
  } else {
    starterReason = 'starter-ready';
    starterReady = true;
  }

  addScore += discountToBepPct >= discountTarget ? 2 : 0;
  addScore += bid <= nextAddTarget ? 1 : 0;
  addScore += newLow ? 1 : 0;
  addScore += (oversold ? 1 : 0);
  addScore += (confirmReversal ? 1 : 0);
  addScore += (volumeOk ? 1 : 0);
  addScore += (liquidityOk ? 1 : 0);
  addScore += (macroMetrics.ready ? 1 : 0);

  if (!hasBag) {
    addReason = 'flat';
  } else if (config.add.belowBreakEvenOnly && !(discountToBepPct > config.add.belowBreakEvenBufferPct)) {
    addReason = 'not-below-bep';
  } else if (discountToBepPct < discountTarget) {
    addReason = 'discount-too-shallow';
  } else if (!(bid <= nextAddTarget)) {
    addReason = 'spacing-not-met';
  } else if (!newLow && regimeLabel !== 'bull') {
    addReason = 'no-new-low';
  } else if (config.add.requireReversal && !confirmReversal) {
    addReason = 'reversal-not-confirmed';
  } else if (!liquidityOk) {
    addReason = volumeOk ? 'spread-too-wide' : 'volume-too-light';
  } else if (regimeLabel === 'bear' && !(deepOversold && confirmReversal && volumeOk)) {
    addReason = 'no-capitulation';
  } else if (addScore < (regimeLabel === 'bear' ? config.add.bearAddMinScore : config.add.addMinScore)) {
    addReason = 'add-score-low';
  } else {
    addReason = regimeLabel === 'bear' ? 'capitulation-ready' : 'recovery-ready';
    addReady = true;
  }

  trimScore += aboveUpperBand ? 1 : 0;
  trimScore += rsiLast >= 68 ? 1 : 0;
  trimScore += extensionPct >= config.exits.trimExtensionEmaFastPct ? 1 : 0;
  trimScore += (wick.upper >= 0.30 || bearishTiming) ? 1 : 0;
  trimScore += profitPct > 0 ? 1 : 0;

  if (profitPct >= adjustTrimTargetPct(config.exits.trim3Pct, regimeLabel) && trimScore >= config.exits.trim3MinScore && !state.trim3Done) {
    trimTier = 'trim3';
    trimTarget = bep > 0 ? bep * (1 + (adjustTrimTargetPct(config.exits.trim3Pct, regimeLabel) / 100)) : bid;
    trimAmountRatio = adjustTrimRatio(config.exits.trim3Ratio, regimeLabel);
    trimTierScore = trimScore;
    trimReason = 'trim3-ready';
  } else if (profitPct >= adjustTrimTargetPct(config.exits.trim2Pct, regimeLabel) && trimScore >= config.exits.trim2MinScore && !state.trim2Done) {
    trimTier = 'trim2';
    trimTarget = bep > 0 ? bep * (1 + (adjustTrimTargetPct(config.exits.trim2Pct, regimeLabel) / 100)) : bid;
    trimAmountRatio = adjustTrimRatio(config.exits.trim2Ratio, regimeLabel);
    trimTierScore = trimScore;
    trimReason = 'trim2-ready';
  } else if (profitPct >= adjustTrimTargetPct(config.exits.trim1Pct, regimeLabel) && trimScore >= config.exits.trim1MinScore && !state.trim1Done) {
    trimTier = 'trim1';
    trimTarget = bep > 0 ? bep * (1 + (adjustTrimTargetPct(config.exits.trim1Pct, regimeLabel) / 100)) : bid;
    trimAmountRatio = adjustTrimRatio(config.exits.trim1Ratio, regimeLabel);
    trimTierScore = trimScore;
    trimReason = 'trim1-ready';
  } else if (profitPct <= 0) {
    trimReason = 'below-bep';
  } else if (!aboveUpperBand && rsiLast < 68 && extensionPct < config.exits.trimExtensionEmaFastPct) {
    trimReason = 'not-extended';
  } else {
    trimReason = 'trim-score-low';
  }

  return {
    ready: true,
    bid: bid,
    ask: ask,
    period: config.timeframe.executionPeriod,
    candles: candles,
    macroRegime: regimeLabel,
    emaFast: emaFastLast,
    emaSlow: emaSlowLast,
    ema200: ema200Last,
    rsi: rsiLast,
    rsiDelta: rsiLast - rsiPrev,
    atr: atrLast,
    atrPct: atrPct,
    bbMid: bbMid,
    bbUpper: bbUpper,
    bbLower: bbLower,
    relativeVolume: relativeVolume,
    spreadPct: spreadPct,
    volumeOk: volumeOk,
    liquidityOk: liquidityOk,
    lowerBandStretch: lowerBandStretch,
    aboveUpperBand: aboveUpperBand,
    valueZone: valueZone,
    oversold: oversold,
    deepOversold: deepOversold,
    noChase: noChase,
    execReversal: execReversal,
    confirmReversal: confirmReversal,
    bearishTiming: bearishTiming,
    recentLow: recentLow,
    recentHigh: recentHigh,
    newLow: newLow,
    extensionPct: extensionPct,
    bep: bep,
    discountToBepPct: discountToBepPct,
    profitPct: profitPct,
    spacingPct: spacingPct,
    discountTargetPct: discountTarget,
    nextAddTarget: nextAddTarget,
    starterTarget: starterTarget,
    riskFloor: riskFloor,
    starterScore: starterScore,
    starterReady: starterReady,
    starterReason: starterReason,
    addScore: addScore,
    addReady: addReady,
    addReason: addReason,
    trimScore: trimScore,
    trimTier: trimTier,
    trimReason: trimReason,
    trimTarget: trimTarget,
    trimAmountRatio: trimAmountRatio,
    trimTierScore: trimTierScore,
    wickLower: wick.lower,
    wickUpper: wick.upper,
    closeLocation: wick.closeLocation,
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

function phaseName(state, hasBag, starterArmed, reentryCooldownActive) {
  if (state.phase === 'entry-pending' && !hasBag) {
    return 'entry-pending';
  }
  if (hasBag) {
    if (state.trim3Done) {
      return 'trimmed-3';
    }
    if (state.trim2Done) {
      return 'trimmed-2';
    }
    if (state.trim1Done) {
      return 'trimmed-1';
    }
    return 'bag';
  }
  if (reentryCooldownActive) {
    return 'cooldown';
  }
  if (starterArmed) {
    return 'armed';
  }
  return 'flat';
}

function addLimitText(config) {
  if (config.add.unlimitedCount) {
    return 'unl';
  }
  return String(config.add.maxCount);
}

function trimTierLabel(frameMetrics) {
  if (!frameMetrics || !frameMetrics.trimTier) {
    return '--';
  }
  return frameMetrics.trimTier.toUpperCase();
}

function primarySkipReason(hasBag, frameMetrics) {
  if (!hasBag) {
    return frameMetrics.starterReason;
  }
  if (frameMetrics.trimTier || frameMetrics.profitPct > 0) {
    return frameMetrics.trimReason;
  }
  return frameMetrics.addReason;
}

function determineStage(config, runtime, macroMetrics, frameMetrics, hasBag, hasOpenOrders, starterArmed) {
  var mode;
  if (!config.enabled) {
    return 'disabled';
  }
  if (!macroMetrics.ready) {
    return 'waiting-macro';
  }
  if (!frameMetrics.ready) {
    return 'waiting-execution';
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
  if (!hasBag) {
    if (starterArmed) {
      return 'starter-ready';
    }
    if (macroMetrics.label === 'bear') {
      return 'bear-standby';
    }
    return 'starter-watch';
  }

  mode = runtime.inventoryMode || 'built';
  if (runtime.trimCooldownActive && frameMetrics.trimTier) {
    return 'trim-cooldown';
  }
  if (runtime.addCooldownActive && frameMetrics.addReady) {
    return 'add-cooldown';
  }
  if (frameMetrics.trimTier) {
    return 'trim-ready';
  }
  if (frameMetrics.addReady) {
    return 'add-ready';
  }
  if (mode === 'recovery') {
    return 'recovery-manage';
  }
  if (mode === 'heavy') {
    return 'heavy-manage';
  }
  return 'inventory-manage';
}

function logStageColor(stage) {
  if (stage === 'starter-ready' || stage === 'add-ready' || stage === 'trim-ready') {
    return VIPER_COLORS.good;
  }
  if (stage === 'recovery-manage' || stage === 'heavy-manage') {
    return VIPER_COLORS.warn;
  }
  if (stage === 'bear-standby' || stage === 'disabled') {
    return VIPER_COLORS.bad;
  }
  return VIPER_COLORS.neutral;
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

function emitChartMark(gb, message) {
  try {
    gb.method.setTimeScaleMark(gb.data.pairName, gb.data.exchangeName, message);
  } catch (err) {
    console.log(logPrefix(gb) + '[WARN][mark] Could not add timescale mark: ' + String(err && err.message ? err.message : err));
  }
}

async function executeBuy(gb, config, state, amountQuote, label, frameMetrics, score) {
  var executionPrice = buyReferencePrice(frameMetrics);
  var orderValueBase = quoteAmountToBaseValue(amountQuote, executionPrice);
  var minimumBuyBaseValue = minBaseVolumeToBuy(gb);
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
  state.lastBuyAt = state.lastActionAt;
  state.lastActionLabel = label;
  state.lastFillPrice = executionPrice;
  state.lastTrimPrice = 0;
  state.trim1Done = false;
  state.trim2Done = false;
  state.trim3Done = false;

  if (label === 'starter') {
    state.entryTime = Date.now();
    state.addCount = 0;
    state.bagPeakSize = 0;
    state.phase = 'entry-pending';
  } else {
    state.addCount += 1;
    state.phase = 'bag';
  }

  logInfo(
    gb,
    label,
    'Executed ' + label + ' market buy for ' + formatPrice(amountQuote) +
    ' quote units at approx ' + formatPrice(executionPrice) +
    ' | score=' + score
  );
  emitChartMark(gb, 'Viper ' + label + ' @ ' + formatPrice(executionPrice));
  return true;
}

function normalizedSellAmount(gb, requestedAmount, forceFullIfNeeded) {
  var quoteBalance = safeNumber(gb.data.quoteBalance, 0);
  var marketPrice = Math.max(
    safeNumber(gb.data.bid, 0),
    safeNumber(gb.data.ask, 0),
    safeNumber(gb.data.BEP, 0),
    safeNumber(gb.data.breakEven, 0)
  );
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

function coreHoldAmount(gb, state, config, regimeLabel) {
  return Math.max(0, safeNumber(state.bagPeakSize, 0) * coreHoldRatioForRegime(config, regimeLabel));
}

async function executeSell(gb, state, amountQuote, label, frameMetrics) {
  var result = await gb.method.sellMarket(amountQuote, gb.data.pairName, gb.data.exchangeName);

  if (!result) {
    return false;
  }

  state.lastActionAt = Date.now();
  state.lastTrimAt = state.lastActionAt;
  state.lastActionLabel = label;
  state.lastTrimPrice = frameMetrics.bid;

  if (label === 'trim1') {
    state.trim1Done = true;
  } else if (label === 'trim2') {
    state.trim1Done = true;
    state.trim2Done = true;
  } else if (label === 'trim3') {
    state.trim1Done = true;
    state.trim2Done = true;
    state.trim3Done = true;
  } else {
    state.cooldownUntil = Date.now();
  }

  logInfo(
    gb,
    label,
    'Executed ' + label + ' market sell for ' + formatPrice(amountQuote) +
    ' quote units at approx ' + formatPrice(frameMetrics.bid)
  );
  emitChartMark(gb, 'Viper ' + label + ' @ ' + formatPrice(frameMetrics.bid));
  return true;
}

function clearBagState(state, config) {
  state.phase = 'cooldown';
  state.addCount = 0;
  state.trim1Done = false;
  state.trim2Done = false;
  state.trim3Done = false;
  state.lastFillPrice = 0;
  state.lastTrimPrice = 0;
  state.entryTime = 0;
  state.bagPeakSize = 0;
  state.cooldownUntil = Date.now() + (config.capital.reentryCooldownMinutes * 60 * 1000);
}

function buildCycleSummaryKey(macroMetrics, frameMetrics, state, hasBag, starterArmed, skipReason, stage, runtime) {
  return [
    macroMetrics.lastTimestamp || 0,
    frameMetrics.lastTimestamp || 0,
    phaseName(state, hasBag, starterArmed, runtime.reentryCooldownActive),
    stage,
    skipReason,
    state.addCount,
    state.trim1Done ? 1 : 0,
    state.trim2Done ? 1 : 0,
    state.trim3Done ? 1 : 0
  ].join('|');
}

function buildCycleSummaryLine(gb, config, macroMetrics, frameMetrics, state, hasBag, starterArmed, skipReason, stage, runtime) {
  var bagMode = runtime.inventoryMode || 'flat';
  var nextTrim = frameMetrics.trimTarget > 0 ? formatPrice(frameMetrics.trimTarget) : '--';

  return [
    'tf=' + String(config.timeframe.executionPeriod) + 'm',
    'trade=' + formatPrice(config.capital.tradeLimitBase),
    'bid=' + formatPrice(frameMetrics.bid),
    'phase=' + phaseName(state, hasBag, starterArmed, runtime.reentryCooldownActive),
    'mode=' + bagMode,
    'stage=' + stage,
    'regime=' + macroMetrics.label,
    'setup=' + (starterArmed ? 'armed' : 'idle'),
    'skip=' + skipReason,
    'starter=' + String(frameMetrics.starterScore),
    'add=' + String(frameMetrics.addScore),
    'trim=' + String(frameMetrics.trimScore),
    'discount=' + formatPercent(frameMetrics.discountToBepPct),
    'discT=' + formatPercent(frameMetrics.discountTargetPct),
    'space=' + formatPercent(frameMetrics.spacingPct),
    'profit=' + formatPercent(frameMetrics.profitPct),
    'relvol=' + roundTo(frameMetrics.relativeVolume, 2).toFixed(2) + 'x',
    'dca=' + String(state.addCount) + '/' + addLimitText(config),
    'nextAdd=' + formatPrice(frameMetrics.nextAddTarget),
    'nextTrim=' + nextTrim
  ].join(' ');
}

function emitCycleSummary(gb, config, state, macroMetrics, frameMetrics, hasBag, starterArmed, skipReason, stage, runtime) {
  var summaryKey;

  if (config.telemetry.logMode === 'events') {
    return;
  }

  summaryKey = buildCycleSummaryKey(macroMetrics, frameMetrics, state, hasBag, starterArmed, skipReason, stage, runtime);
  if (config.telemetry.logMode === 'changes' && state.lastCycleSummaryKey === summaryKey) {
    return;
  }

  state.lastCycleSummaryKey = summaryKey;
  console.log(logPrefix(gb) + '[STATE] ' + buildCycleSummaryLine(gb, config, macroMetrics, frameMetrics, state, hasBag, starterArmed, skipReason, stage, runtime));
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
  if (!startTime || !endTime || !isFinite(topPrice) || !isFinite(bottomPrice) || topPrice <= bottomPrice) {
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

function buildShapeWindow(candles) {
  var timestamps = candles && candles.timestamp ? candles.timestamp : [];
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

function setChartObjects(gb, config, state, macroMetrics, frameMetrics, hasBag, starterArmed, runtime) {
  var ledger = gb.data.pairLedger;
  var targets = [];
  var shapes = [];
  var window = buildShapeWindow(frameMetrics.candles);
  var bep = frameMetrics.bep > 0 ? frameMetrics.bep : Math.max(safeNumber(gb.data.BEP, 0), safeNumber(gb.data.breakEven, 0));
  var nextTrim = frameMetrics.trimTarget > 0 ? frameMetrics.trimTarget : (bep > 0 ? bep * (1 + (adjustTrimTargetPct(config.exits.trim1Pct, macroMetrics.label) / 100)) : 0);
  var nextBuy = hasBag ? frameMetrics.nextAddTarget : frameMetrics.starterTarget;
  var chartLabel = hasBag ? 'Viper Next Add' : 'Viper Starter';
  var trimLabel = frameMetrics.trimTier ? ('Viper ' + frameMetrics.trimTier.toUpperCase()) : 'Viper Next Trim';
  var coreLine = hasBag ? coreHoldAmount(gb, state, config, macroMetrics.label) : 0;

  if (!config.visuals.enableCharts) {
    clearChartObjects(gb);
    return;
  }

  ledger.customBuyTarget = hasBag ? null : nextBuy;
  ledger.customSellTarget = nextTrim > 0 ? nextTrim : null;
  ledger.customStopTarget = null;
  ledger.customCloseTarget = null;
  ledger.customTrailingTarget = null;
  ledger.customDcaTarget = hasBag ? nextBuy : null;

  if (nextBuy > 0) {
    targets.push(createChartTarget(chartLabel, nextBuy, '', 1, 1, VIPER_COLORS.info, '#0f1a2b'));
  }
  if (bep > 0) {
    targets.push(createChartTarget('Viper BEP', bep, '', 1, 1, VIPER_COLORS.neutral, '#111827'));
  }
  if (nextTrim > 0) {
    targets.push(createChartTarget(trimLabel, nextTrim, '', 0, 2, VIPER_COLORS.good, '#122018'));
  }
  if (frameMetrics.riskFloor > 0) {
    targets.push(createChartTarget('Viper Risk Floor', frameMetrics.riskFloor, '', 2, 1, VIPER_COLORS.bad, '#2b1111'));
  }
  if (hasBag && coreLine > 0 && safeNumber(gb.data.quoteBalance, 0) > coreLine) {
    targets.push(createChartTarget('Viper Core Hold', bep, formatPercent(coreHoldRatioForRegime(config, macroMetrics.label) * 100), 1, 1, VIPER_COLORS.warn, '#2b2110'));
  }

  ledger.customChartTargets = targets;

  if (config.visuals.enableShapes && window) {
    if (nextBuy > 0 && frameMetrics.riskFloor > 0 && nextBuy > frameMetrics.riskFloor) {
      shapes.push(buildRectangleShape(window.startTime, window.endTime, nextBuy, frameMetrics.riskFloor, VIPER_COLORS.zoneFill, VIPER_COLORS.zoneBorder));
    }
    if (nextTrim > 0 && bep > 0 && nextTrim > bep) {
      shapes.push(buildRectangleShape(window.startTime, window.endTime, nextTrim, bep, VIPER_COLORS.trimFill, VIPER_COLORS.trimBorder));
    }
    ledger.customChartShapes = shapes;
  } else {
    ledger.customChartShapes = [];
  }
}

function updateSidebar(gb, config, macroMetrics, frameMetrics, state, runtime, hasBag, starterArmed, stage, skipReason) {
  var reserveMin = reserveRequirementBase(gb, config);
  var reserveFree = availableBaseForBuys(gb, config);
  var bagExposure = currentBagBaseExposure(gb, frameMetrics.bid);
  var nextTrim = frameMetrics.trimTarget > 0 ? formatPrice(frameMetrics.trimTarget) : '--';

  gb.data.pairLedger.sidebarExtras = [
    { label: 'Viper', value: VIPER_META.version, valueColor: VIPER_COLORS.info },
    { label: 'Trade', value: formatPrice(config.capital.tradeLimitBase), valueColor: VIPER_COLORS.info },
    { label: 'Regime', value: macroMetrics.ready ? macroMetrics.label.toUpperCase() : 'WAIT', valueColor: macroMetrics.label === 'bull' ? VIPER_COLORS.good : macroMetrics.label === 'bear' ? VIPER_COLORS.bad : VIPER_COLORS.warn },
    { label: 'Mode', value: runtime.inventoryMode.toUpperCase(), valueColor: hasBag ? VIPER_COLORS.info : VIPER_COLORS.neutral },
    { label: 'Stage', value: stage, valueColor: logStageColor(stage) },
    { label: 'Setup', value: starterArmed ? 'ARMED' : 'IDLE', valueColor: starterArmed ? VIPER_COLORS.good : VIPER_COLORS.neutral },
    { label: 'Add', value: String(state.addCount) + '/' + addLimitText(config), valueColor: state.addCount > 0 ? VIPER_COLORS.info : VIPER_COLORS.neutral },
    { label: 'Starter', value: formatScore(frameMetrics.starterScore, 7), valueColor: frameMetrics.starterReady ? VIPER_COLORS.good : VIPER_COLORS.neutral },
    { label: 'Recovery', value: formatScore(frameMetrics.addScore, 8), valueColor: frameMetrics.addReady ? VIPER_COLORS.good : VIPER_COLORS.neutral },
    { label: 'Trim', value: frameMetrics.trimTier ? (frameMetrics.trimTier.toUpperCase() + ' ' + formatScore(frameMetrics.trimTierScore, 5)) : formatScore(frameMetrics.trimScore, 5), valueColor: frameMetrics.trimTier ? VIPER_COLORS.good : VIPER_COLORS.neutral },
    { label: 'BEP', value: frameMetrics.bep > 0 ? formatPrice(frameMetrics.bep) : '--', valueColor: frameMetrics.bep > 0 ? VIPER_COLORS.info : VIPER_COLORS.neutral },
    { label: 'Discount', value: hasBag ? formatPercent(frameMetrics.discountToBepPct) : '--', valueColor: hasBag && frameMetrics.discountToBepPct > 0 ? VIPER_COLORS.warn : VIPER_COLORS.neutral },
    { label: 'Disc Tgt', value: hasBag ? formatPercent(frameMetrics.discountTargetPct) : '--', valueColor: hasBag ? VIPER_COLORS.info : VIPER_COLORS.neutral },
    { label: 'Spacing', value: hasBag ? formatPercent(frameMetrics.spacingPct) : '--', valueColor: hasBag ? VIPER_COLORS.neutral : VIPER_COLORS.neutral },
    { label: 'Next Add', value: formatPrice(frameMetrics.nextAddTarget), valueColor: hasBag ? VIPER_COLORS.info : VIPER_COLORS.neutral },
    { label: 'Next Trim', value: nextTrim, valueColor: nextTrim !== '--' ? VIPER_COLORS.good : VIPER_COLORS.neutral },
    { label: 'Reserve', value: formatPrice(reserveFree), tooltip: 'Available base currency after reserve requirement. Minimum reserve target: ' + formatPrice(reserveMin), valueColor: reserveFree > 0 ? VIPER_COLORS.good : VIPER_COLORS.bad },
    { label: 'Exposure', value: hasBag ? formatPrice(bagExposure) : '--', tooltip: 'Current live bag exposure in base currency terms.', valueColor: hasBag ? VIPER_COLORS.info : VIPER_COLORS.neutral },
    { label: 'Skip', value: skipReason, valueColor: skipReason.indexOf('ready') >= 0 ? VIPER_COLORS.good : VIPER_COLORS.bad }
  ];
}

function buildStatusLines(frameMetrics) {
  return {
    starter: frameMetrics.starterReady ? 'starter-ready' : frameMetrics.starterReason,
    add: frameMetrics.addReady ? 'add-ready' : frameMetrics.addReason,
    trim: frameMetrics.trimTier ? frameMetrics.trimTier : frameMetrics.trimReason
  };
}

function executeStarterAmount(config, frameMetrics) {
  return (config.capital.tradeLimitBase * config.entry.starterSizeMultiplier) / buyReferencePrice(frameMetrics);
}

function executeAddAmount(config, frameMetrics, state, macroMetrics) {
  return (config.capital.tradeLimitBase * addSizeMultiplier(config, state.addCount, macroMetrics.label)) / buyReferencePrice(frameMetrics);
}

function markTrimDone(state, trimTier) {
  if (trimTier === 'trim1') {
    state.trim1Done = true;
  } else if (trimTier === 'trim2') {
    state.trim1Done = true;
    state.trim2Done = true;
  } else if (trimTier === 'trim3') {
    state.trim1Done = true;
    state.trim2Done = true;
    state.trim3Done = true;
  }
}

async function runViper(gb) {
  var config = buildConfig(gb);
  var state = ensureState(gb);
  var runtime = {
    now: Date.now()
  };
  var previousRegime = state.lastRegime || '';
  var buyEnabled;
  var sellEnabled;
  var hasBag;
  var hasOpenOrders;
  var macroCandles;
  var executionCandles;
  var timingCandles;
  var macroMetrics;
  var timingMetrics;
  var frameMetrics;
  var reserveFree;
  var starterArmed;
  var stage;
  var skipReason;
  var buyAmount;
  var addAmount;
  var sellAmount;
  var minimumCoreHold;
  var trimReady;
  var trimCooldownActive;
  var addCooldownActive;
  var trimRequested;
  var statusLines;

  pruneNotificationKeys(state, config, runtime.now);
  runtime.actionCooldownActive = (runtime.now - safeNumber(state.lastActionAt, 0)) < (config.capital.actionCooldownSeconds * 1000);
  runtime.reentryCooldownActive = runtime.now < safeNumber(state.cooldownUntil, 0);
  runtime.trimCooldownActive = false;
  runtime.addCooldownActive = false;

  buyEnabled = canUseBuyToggle(gb, config);
  sellEnabled = canUseSellToggle(gb, config);
  hasBag = hasUsableBag(gb);
  hasOpenOrders = !!(gb.data.openOrders && gb.data.openOrders.length);
  reserveFree = availableBaseForBuys(gb, config);

  updateBagRecovery(gb, state, runtime.now, hasBag);
  runtime.inventoryMode = inventoryMode(state, gb, config, state.lastRegime || 'neutral');

  if (state.hadBagLastCycle && !hasBag) {
    recordExternalClose(state, runtime.now);
    clearBagState(state, config);
    runtime.reentryCooldownActive = runtime.now < safeNumber(state.cooldownUntil, 0);
  }
  if (!state.hadBagLastCycle && hasBag) {
    state.bagPeakSize = Math.max(state.bagPeakSize || 0, safeNumber(gb.data.quoteBalance, 0));
  }

  macroCandles = await getCachedCandles(gb, state, 'macro', config.timeframe.macroPeriod, config.timeframe.macroCandles, config.timeframe.macroCacheSeconds, true);
  executionCandles = await getCachedCandles(gb, state, 'execution', config.timeframe.executionPeriod, config.timeframe.executionCandles, config.timeframe.executionCacheSeconds, true);
  timingCandles = await getCachedCandles(gb, state, 'timing', config.timeframe.timingPeriod, config.timeframe.timingCandles, config.timeframe.timingCacheSeconds, true);

  macroMetrics = evaluateMacro(macroCandles.ready ? macroCandles.candles : null, config);
  state.lastRegime = macroMetrics.label;
  timingMetrics = evaluateTiming(timingCandles.ready ? timingCandles.candles : null, config);
  frameMetrics = analyzeExecution(executionCandles.ready ? executionCandles.candles : null, gb, config, state, hasBag, macroMetrics, timingMetrics);
  runtime.trimCooldownActive = (runtime.now - safeNumber(state.lastTrimAt, 0)) < (config.exits.minMinutesBetweenTrims * 60 * 1000);
  runtime.addCooldownActive = config.add.addCooldownBars > 0 &&
    (runtime.now - safeNumber(state.lastBuyAt, 0)) < (config.add.addCooldownBars * config.timeframe.executionPeriod * 60 * 1000);

  if (!config.enabled || !macroMetrics.ready || !frameMetrics.ready) {
    clearChartObjects(gb);
    if (!config.enabled) {
      skipReason = 'disabled';
      stage = 'disabled';
    } else if (!macroMetrics.ready) {
      skipReason = macroMetrics.reason;
      stage = 'waiting-macro';
    } else {
      skipReason = frameMetrics.reason;
      stage = 'waiting-execution';
    }
    gb.data.pairLedger.sidebarExtras = [
      { label: 'Viper', value: VIPER_META.version, valueColor: VIPER_COLORS.info },
      { label: 'Stage', value: stage, valueColor: logStageColor(stage) },
      { label: 'Skip', value: skipReason, valueColor: VIPER_COLORS.bad }
    ];
    state.hadBagLastCycle = hasBag;
    state.lastSkipReason = skipReason;
    return;
  }

  runtime.inventoryMode = inventoryMode(state, gb, config, macroMetrics.label);
  starterArmed = !hasBag &&
    !hasOpenOrders &&
    !runtime.actionCooldownActive &&
    !runtime.reentryCooldownActive &&
    buyEnabled &&
    reserveFree >= (config.capital.tradeLimitBase * config.entry.starterSizeMultiplier) &&
    frameMetrics.starterReady;

  stage = determineStage(config, runtime, macroMetrics, frameMetrics, hasBag, hasOpenOrders, starterArmed);
  statusLines = buildStatusLines(frameMetrics);
  skipReason = primarySkipReason(hasBag, frameMetrics);
  trimCooldownActive = runtime.trimCooldownActive;
  addCooldownActive = runtime.addCooldownActive;

  if (trimCooldownActive && frameMetrics.trimTier) {
    skipReason = 'trim-cooldown';
  } else if (addCooldownActive && frameMetrics.addReady) {
    skipReason = 'add-cooldown';
  }

  if (starterArmed && !state.lastStarterArmed) {
    sendNotification(gb, config, state, 'starter-armed', createNotification('Viper starter setup armed on ' + gb.data.pairName + '.', 'info', false));
    logInfo(gb, 'starter-armed', 'Starter setup armed with score ' + frameMetrics.starterScore + '.');
  }

  if (previousRegime && previousRegime !== macroMetrics.label) {
    resetNotificationKey(state, 'regime-' + previousRegime);
    sendNotification(gb, config, state, 'regime-' + macroMetrics.label, createNotification('Viper regime changed to ' + macroMetrics.label.toUpperCase() + ' on ' + gb.data.pairName + '.', macroMetrics.label === 'bear' ? 'warning' : 'info', false));
  }

  if (!hasBag && !hasOpenOrders && starterArmed) {
    buyAmount = executeStarterAmount(config, frameMetrics);
    if (
      reserveFree >= (config.capital.tradeLimitBase * config.entry.starterSizeMultiplier) &&
      withinBagBaseLimit(gb, config, buyAmount, buyReferencePrice(frameMetrics)) &&
      (await executeBuy(gb, config, state, buyAmount, 'starter', frameMetrics, frameMetrics.starterScore))
    ) {
      sendNotification(gb, config, state, 'starter-buy-' + String(Date.now()), createNotification('Viper starter buy executed on ' + gb.data.pairName + '.', 'success', false));
      hasBag = true;
      skipReason = 'starter-executed';
    }
  } else if (hasBag && !hasOpenOrders && buyEnabled && !runtime.actionCooldownActive && !runtime.reentryCooldownActive && !addCooldownActive) {
    addAmount = executeAddAmount(config, frameMetrics, state, macroMetrics);
    if (
      frameMetrics.addReady &&
      hasAddCapacity(config, state) &&
      reserveFree >= (config.capital.tradeLimitBase * addSizeMultiplier(config, state.addCount, macroMetrics.label)) &&
      withinAddDepthLimit(config, frameMetrics.discountToBepPct) &&
      withinBagBaseLimit(gb, config, addAmount, buyReferencePrice(frameMetrics))
    ) {
      if (await executeBuy(gb, config, state, addAmount, macroMetrics.label === 'bear' ? 'capitulation' : 'recovery', frameMetrics, frameMetrics.addScore)) {
        sendNotification(gb, config, state, 'add-buy-' + String(Date.now()), createNotification('Viper ' + (macroMetrics.label === 'bear' ? 'capitulation' : 'recovery') + ' buy executed on ' + gb.data.pairName + '.', 'warning', false));
        skipReason = 'add-executed';
      }
    }
  }

  if (hasBag && !hasOpenOrders && sellEnabled && !trimCooldownActive) {
    trimReady = !!frameMetrics.trimTier;
    minimumCoreHold = coreHoldAmount(gb, state, config, macroMetrics.label);
    trimRequested = trimReady
      ? Math.max(0, safeNumber(gb.data.quoteBalance, 0) * frameMetrics.trimAmountRatio)
      : 0;

    if (trimReady && safeNumber(gb.data.quoteBalance, 0) > minimumCoreHold) {
      sellAmount = normalizedSellAmount(
        gb,
        Math.min(trimRequested, Math.max(0, safeNumber(gb.data.quoteBalance, 0) - minimumCoreHold)),
        false
      );
      if (sellAmount > 0 && await executeSell(gb, state, sellAmount, frameMetrics.trimTier, frameMetrics)) {
        markTrimDone(state, frameMetrics.trimTier);
        sendNotification(gb, config, state, frameMetrics.trimTier + '-' + String(Date.now()), createNotification('Viper ' + frameMetrics.trimTier.toUpperCase() + ' trim executed on ' + gb.data.pairName + '.', 'success', false));
        skipReason = frameMetrics.trimTier + '-executed';
      }
    }
  }

  if (!hasBag && state.phase === 'entry-pending') {
    state.phase = runtime.reentryCooldownActive ? 'cooldown' : 'flat';
  } else if (hasBag && state.phase === 'entry-pending') {
    state.phase = phaseName(state, hasBag, false, false);
  }

  if (!hasBag && state.phase !== 'cooldown' && state.phase !== 'entry-pending') {
    state.phase = starterArmed ? 'armed' : 'flat';
  }

  if (state.lastSkipReason !== skipReason || frameMetrics.addReady || frameMetrics.trimTier || starterArmed) {
    logDebug(
      gb,
      config,
      'state',
      'starter=' + statusLines.starter +
      ' add=' + statusLines.add +
      ' trim=' + statusLines.trim +
      ' regime=' + macroMetrics.label +
      ' mode=' + runtime.inventoryMode
    );
  }

  setChartObjects(gb, config, state, macroMetrics, frameMetrics, hasBag, starterArmed, runtime);
  updateSidebar(gb, config, macroMetrics, frameMetrics, state, runtime, hasBag, starterArmed, stage, skipReason);
  emitCycleSummary(gb, config, state, macroMetrics, frameMetrics, hasBag, starterArmed, skipReason, stage, runtime);

  state.lastStarterArmed = starterArmed;
  state.lastAddReady = frameMetrics.addReady;
  state.lastTrimReady = frameMetrics.trimTier;
  state.lastStage = stage;
  state.lastSkipReason = skipReason;
  state.hadBagLastCycle = hasBag;
}

async function viperEntryPoint(runtimeGb) {
  var gb = resolveGb(runtimeGb);

  if (!isExpectedStrategyFile(gb, 'Viper.js')) {
    return;
  }

  try {
    await runViper(gb);
  } catch (err) {
    try {
      var pairName = gb && gb.data ? gb.data.pairName : 'unknown-pair';
      console.error('[' + VIPER_META.name + ' ' + VIPER_META.version + '][FATAL][' + pairName + '] ' + (err && err.stack ? err.stack : String(err)));
    } catch (secondaryError) {
      console.error('[' + VIPER_META.name + ' ' + VIPER_META.version + '][FATAL] Unhandled strategy error.');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = viperEntryPoint;
} else {
  (async function () {
    await viperEntryPoint(typeof gb !== 'undefined' ? gb : undefined);
  }());
}
