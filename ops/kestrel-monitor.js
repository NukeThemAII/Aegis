#!/usr/bin/env node

/*
 * Kestrel operations monitor.
 *
 * Tracks live simulator behavior for Kestrel pairs without touching
 * Gunbot runtime logic.
 */

var fs = require('fs');
var path = require('path');

var STRATEGY_NAME = 'Kestrel Tape Scalper';
var FOCUS_PAIR = 'USDT-XRP';
var INITIAL_SCAN_BYTES = 1024 * 1024;
var HISTORY_EVENT_LIMIT = 50;
var NEAR_READY_SCORE_MIN = 3;
var NEAR_READY_ALERT_OBSERVATIONS = 8;

var OPS_DIR = __dirname;
var CUSTOM_STRATEGIES_DIR = path.resolve(__dirname, '..');
var GUNBOT_DIR = path.resolve(CUSTOM_STRATEGIES_DIR, '..');

var CONFIG_PATH = path.join(GUNBOT_DIR, 'config.js');
var GUNBOT_LOG_PATH = path.join(GUNBOT_DIR, 'gunbot_logs', 'gunbot_logs.txt');
var STATE_PATH = path.join(OPS_DIR, 'kestrel-monitor-state.json');
var REPORT_PATH = path.join(OPS_DIR, 'kestrel-monitor-report.txt');
var HISTORY_PATH = path.join(OPS_DIR, 'kestrel-monitor-history.log');

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

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function nowIso() {
  return new Date().toISOString();
}

function countMapIncrement(map, key) {
  var bucketKey = key || 'unknown';
  if (!Object.prototype.hasOwnProperty.call(map, bucketKey)) {
    map[bucketKey] = 0;
  }
  map[bucketKey] += 1;
}

function sortCountEntries(map) {
  return Object.keys(map).sort(function (left, right) {
    return map[right] - map[left];
  }).map(function (key) {
    return {
      key: key,
      count: map[key]
    };
  });
}

function keepRecent(items, limit) {
  if (items.length <= limit) {
    return items;
  }
  return items.slice(items.length - limit);
}

function defaultPairState() {
  return {
    observations: 0,
    lastSeenAt: '',
    latestVersion: '',
    latest: null,
    stageCounts: {},
    skipCounts: {},
    trendCounts: {},
    pullbackCounts: {},
    reclaimCounts: {},
    liquidityCounts: {},
    nearReadyObservations: 0,
    trendBlockedObservations: 0,
    currentStageStreak: 0,
    currentSkipStreak: 0
  };
}

function defaultMonitorState() {
  return {
    version: 1,
    matrixSignature: '',
    logOffset: 0,
    lastRunAt: '',
    pairStates: {},
    recentEvents: []
  };
}

function ensurePairState(state, pairName) {
  if (!state.pairStates[pairName] || typeof state.pairStates[pairName] !== 'object') {
    state.pairStates[pairName] = defaultPairState();
  }
  return state.pairStates[pairName];
}

function readKestrelPairs() {
  var config = safeReadJson(CONFIG_PATH, {});
  var binancePairs = config && config.pairs && config.pairs.binance ? config.pairs.binance : {};
  var results = [];

  Object.keys(binancePairs).forEach(function (pairName) {
    var pairConfig = binancePairs[pairName] || {};
    var overrides = pairConfig.override || {};

    if (overrides.STRAT_FILENAME !== 'Kestrel.js') {
      return;
    }
    if (!pairConfig.enabled) {
      return;
    }

    results.push({
      pairName: pairName,
      enabled: !!pairConfig.enabled,
      riskProfile: overrides.KESTREL_RISK_PROFILE || 'balanced',
      logMode: overrides.KESTREL_LOG_MODE || 'events',
      period: String(overrides.PERIOD || '5')
    });
  });

  results.sort(function (left, right) {
    return left.pairName.localeCompare(right.pairName);
  });

  return results;
}

function prunePairStates(state, pairs) {
  var active = {};

  pairs.forEach(function (pair) {
    active[pair.pairName] = true;
  });

  Object.keys(state.pairStates || {}).forEach(function (pairName) {
    if (!active[pairName]) {
      delete state.pairStates[pairName];
    }
  });
}

function pruneRecentEvents(state, pairs) {
  var active = {};

  pairs.forEach(function (pair) {
    active[pair.pairName] = true;
  });

  state.recentEvents = (state.recentEvents || []).filter(function (event) {
    return !!active[event.pairName];
  });
}

function buildMatrixSignature(pairs) {
  return pairs.map(function (pair) {
    return [
      pair.pairName,
      pair.riskProfile,
      pair.logMode,
      pair.period
    ].join('|');
  }).join('||');
}

function readNewLogText(state) {
  var stat = fs.statSync(GUNBOT_LOG_PATH);
  var startOffset = safeNumber(state.logOffset, 0);
  var fd;
  var buffer;
  var length;

  if (startOffset <= 0 && stat.size > INITIAL_SCAN_BYTES) {
    startOffset = stat.size - INITIAL_SCAN_BYTES;
  }
  if (startOffset > stat.size) {
    startOffset = 0;
  }

  length = stat.size - startOffset;
  state.logOffset = stat.size;

  if (length <= 0) {
    return '';
  }

  fd = fs.openSync(GUNBOT_LOG_PATH, 'r');
  buffer = Buffer.alloc(length);
  fs.readSync(fd, buffer, 0, length, startOffset);
  fs.closeSync(fd);
  return buffer.toString('utf8');
}

function parseStatePayload(message) {
  var payload = {};
  String(message || '').trim().split(/\s+/).forEach(function (token) {
    var separatorIndex = token.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }
    payload[token.slice(0, separatorIndex)] = token.slice(separatorIndex + 1);
  });
  return payload;
}

function parseScore(scoreText) {
  return safeNumber(String(scoreText || '0').split('/')[0], 0);
}

function updatePairState(pairState, version, payload, seenAt) {
  var score = parseScore(payload.score);
  var stage = payload.stage || 'unknown';
  var skip = payload.skip || 'unknown';
  var trend = payload.trend || 'unknown';
  var pullback = payload.pullback || 'unknown';
  var reclaim = payload.reclaim || 'unknown';
  var liquidity = payload.liquidity || 'unknown';
  var latest = pairState.latest;

  pairState.observations += 1;
  pairState.lastSeenAt = seenAt;
  pairState.latestVersion = version;

  countMapIncrement(pairState.stageCounts, stage);
  countMapIncrement(pairState.skipCounts, skip);
  countMapIncrement(pairState.trendCounts, trend);
  countMapIncrement(pairState.pullbackCounts, pullback);
  countMapIncrement(pairState.reclaimCounts, reclaim);
  countMapIncrement(pairState.liquidityCounts, liquidity);

  if (stage === 'trend-blocked') {
    pairState.trendBlockedObservations += 1;
  }
  if (score >= NEAR_READY_SCORE_MIN) {
    pairState.nearReadyObservations += 1;
  }

  if (latest && latest.stage === stage) {
    pairState.currentStageStreak += 1;
  } else {
    pairState.currentStageStreak = 1;
  }

  if (latest && latest.skip === skip) {
    pairState.currentSkipStreak += 1;
  } else {
    pairState.currentSkipStreak = 1;
  }

  pairState.latest = {
    seenAt: seenAt,
    version: version,
    tf: payload.tf || '',
    bid: payload.bid || '',
    phase: payload.phase || '',
    stage: stage,
    score: payload.score || '',
    setup: payload.setup || '',
    skip: skip,
    trend: trend,
    pullback: pullback,
    reclaim: reclaim,
    momentum: payload.momentum || '',
    liquidity: liquidity,
    spread: payload.spread || '',
    relvol: payload.relvol || '',
    pull: payload.pull || '',
    rsi: payload.rsi || '',
    reload: payload.reload || '',
    stop: payload.stop || ''
  };
}

function processLogText(state, logText, knownPairs) {
  var lines = String(logText || '').split('\n');
  var pairLookup = {};
  var newStates = 0;
  var recentEvents = state.recentEvents || [];

  knownPairs.forEach(function (pair) {
    pairLookup[pair.pairName] = true;
  });

  lines.forEach(function (line) {
    var match = line.match(/^\[Kestrel Tape Scalper ([^\]]+)\]\[[^\]]+\]\[([^\]]+)\]\[STATE\] (.+)$/);
    var version;
    var pairName;
    var payload;

    if (!match) {
      return;
    }

    version = match[1];
    pairName = match[2];

    if (!pairLookup[pairName]) {
      return;
    }

    payload = parseStatePayload(match[3]);
    updatePairState(ensurePairState(state, pairName), version, payload, nowIso());
    recentEvents.push({
      at: nowIso(),
      pairName: pairName,
      stage: payload.stage || 'unknown',
      score: payload.score || '',
      skip: payload.skip || 'unknown'
    });
    newStates += 1;
  });

  state.recentEvents = keepRecent(recentEvents, HISTORY_EVENT_LIMIT);
  return {
    newStates: newStates
  };
}

function buildAlertLines(pairs, state) {
  var lines = [];
  pairs.forEach(function (pair) {
    var pairState = ensurePairState(state, pair.pairName);
    var latest = pairState.latest;

    if (!latest) {
      return;
    }

    if (pairState.nearReadyObservations >= NEAR_READY_ALERT_OBSERVATIONS) {
      lines.push(
        pair.pairName +
        ' accumulated ' + String(pairState.nearReadyObservations) +
        ' near-ready observations. Inspect pullback and liquidity gates.'
      );
    }

    if (latest.stage === 'trend-blocked' && pairState.currentStageStreak >= 25) {
      lines.push(
        pair.pairName +
        ' stayed trend-blocked for ' + String(pairState.currentStageStreak) +
        ' consecutive observations.'
      );
    }
  });
  return lines;
}

function renderReport(pairs, state) {
  var lines = [];
  var alerts = buildAlertLines(pairs, state);

  lines.push('Kestrel Monitor Report');
  lines.push('Generated: ' + nowIso());
  lines.push('Pairs tracked: ' + String(pairs.length));
  lines.push('');

  if (!pairs.length) {
    lines.push('No Kestrel pairs detected in config.js.');
    return lines.join('\n') + '\n';
  }

  pairs.forEach(function (pair) {
    var pairState = ensurePairState(state, pair.pairName);
    var latest = pairState.latest;

    lines.push(pair.pairName + ' | enabled=' + String(pair.enabled) + ' | profile=' + pair.riskProfile + ' | log=' + pair.logMode);
    if (!latest) {
      lines.push('  no state lines captured yet');
      lines.push('');
      return;
    }
    lines.push(
      '  latest: stage=' + latest.stage +
      ' score=' + latest.score +
      ' skip=' + latest.skip +
      ' trend=' + latest.trend +
      ' pullback=' + latest.pullback +
      ' reclaim=' + latest.reclaim +
      ' liquidity=' + latest.liquidity +
      ' relvol=' + latest.relvol
    );
    lines.push(
      '  counters: observations=' + String(pairState.observations) +
      ' nearReady=' + String(pairState.nearReadyObservations) +
      ' trendBlocked=' + String(pairState.trendBlockedObservations) +
      ' stageStreak=' + String(pairState.currentStageStreak) +
      ' skipStreak=' + String(pairState.currentSkipStreak)
    );
    lines.push(
      '  top skips: ' +
      sortCountEntries(pairState.skipCounts).slice(0, 3).map(function (item) {
        return item.key + '=' + item.count;
      }).join(', ')
    );
    lines.push('');
  });

  if (alerts.length) {
    lines.push('Alerts:');
    alerts.forEach(function (line) {
      lines.push('- ' + line);
    });
    lines.push('');
  }

  lines.push('Recent events:');
  state.recentEvents.slice(-10).forEach(function (event) {
    lines.push(
      '- ' + event.at +
      ' | ' + event.pairName +
      ' | stage=' + event.stage +
      ' | score=' + event.score +
      ' | skip=' + event.skip
    );
  });

  return lines.join('\n') + '\n';
}

function appendHistoryLine(pairs, state, processResult) {
  var focusState = ensurePairState(state, FOCUS_PAIR);
  var latest = focusState.latest;
  var line =
    '[' + nowIso() + '] Kestrel monitor | pairs=' + String(pairs.length) +
    ' | focus=' + FOCUS_PAIR +
    (latest
      ? ('=' + latest.stage + '/' + latest.score + '/' + latest.skip + '/' + latest.liquidity)
      : '=no-state') +
    ' | new_states=' + String(processResult.newStates);

  fs.appendFileSync(HISTORY_PATH, line + '\n');
}

function main() {
  var state = safeReadJson(STATE_PATH, defaultMonitorState());
  var pairs = readKestrelPairs();
  var logText = '';
  var processResult;

  if (!pairs.length) {
    fs.writeFileSync(REPORT_PATH, 'Kestrel Monitor Report\nGenerated: ' + nowIso() + '\n\nNo Kestrel pairs detected.\n', 'utf8');
    writeJson(STATE_PATH, state);
    console.log('Kestrel monitor: no Kestrel pairs detected.');
    return;
  }

  if (state.matrixSignature !== buildMatrixSignature(pairs)) {
    state.pairStates = {};
    state.recentEvents = [];
    state.matrixSignature = buildMatrixSignature(pairs);
  }
  prunePairStates(state, pairs);
  pruneRecentEvents(state, pairs);

  if (fs.existsSync(GUNBOT_LOG_PATH)) {
    logText = readNewLogText(state);
  }

  processResult = processLogText(state, logText, pairs);
  state.lastRunAt = nowIso();

  fs.writeFileSync(REPORT_PATH, renderReport(pairs, state), 'utf8');
  writeJson(STATE_PATH, state);
  appendHistoryLine(pairs, state, processResult);

  console.log(
    'Kestrel monitor: pairs=' + String(pairs.length) +
    ' new_states=' + String(processResult.newStates)
  );
}

main();
