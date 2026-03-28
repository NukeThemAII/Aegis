#!/usr/bin/env node

/*
 * Aegis operations monitor.
 *
 * This is a cron-friendly helper for live development and tuning.
 * It does not affect Gunbot runtime strategy logic.
 */

var fs = require('fs');
var path = require('path');

var STRATEGY_NAME = 'Aegis Regime Reclaim';
var FOCUS_PAIR = 'USDT-PAXG';
var CONTROL_PAIR = 'USDT-BTC';
var INITIAL_SCAN_BYTES = 1024 * 1024 * 2;
var HISTORY_EVENT_LIMIT = 50;
var NEAR_READY_SCORE_MIN = 3;
var NEAR_READY_ALERT_OBSERVATIONS = 12;

var OPS_DIR = __dirname;
var CUSTOM_STRATEGIES_DIR = path.resolve(__dirname, '..');
var GUNBOT_DIR = path.resolve(CUSTOM_STRATEGIES_DIR, '..');

var CONFIG_PATH = path.join(GUNBOT_DIR, 'config.js');
var GUNBOT_LOG_PATH = path.join(GUNBOT_DIR, 'gunbot_logs', 'gunbot_logs.txt');
var STATE_PATH = path.join(OPS_DIR, 'aegis-monitor-state.json');
var REPORT_PATH = path.join(OPS_DIR, 'aegis-monitor-report.txt');
var HISTORY_PATH = path.join(OPS_DIR, 'aegis-monitor-history.log');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
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
    reclaimCounts: {},
    liquidityCounts: {},
    regimeOnObservations: 0,
    regimeBlockedObservations: 0,
    nearReadyObservations: 0,
    nearReadyLiquidityBlocked: 0,
    nearReadyReclaimBlocked: 0,
    currentStageStreak: 0,
    currentSkipStreak: 0
  };
}

function defaultMonitorState() {
  return {
    version: 1,
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

function readAegisPairs() {
  var config = safeReadJson(CONFIG_PATH, {});
  var binancePairs = config && config.pairs && config.pairs.binance ? config.pairs.binance : {};
  var results = [];

  Object.keys(binancePairs).forEach(function (pairName) {
    var pairConfig = binancePairs[pairName] || {};
    var overrides = pairConfig.override || {};

    if (overrides.STRAT_FILENAME !== 'Aegis.js') {
      return;
    }

    results.push({
      pairName: pairName,
      enabled: !!pairConfig.enabled,
      riskProfile: overrides.AEGIS_RISK_PROFILE || 'balanced',
      logMode: overrides.AEGIS_LOG_MODE || 'events',
      period: String(overrides.PERIOD || '15')
    });
  });

  results.sort(function (left, right) {
    return left.pairName.localeCompare(right.pairName);
  });

  return results;
}

function readNewLogText(state) {
  var stat = fs.statSync(GUNBOT_LOG_PATH);
  var startOffset = safeNumber(state.logOffset, 0);
  var length;
  var fd;
  var buffer;

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
  var tokens = String(message || '').trim().split(/\s+/);
  var payload = {};

  tokens.forEach(function (token) {
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

function isRegimeOn(regimeText) {
  return String(regimeText || '').indexOf('on(') === 0;
}

function updatePairState(pairState, version, payload, seenAt) {
  var score = parseScore(payload.score);
  var stage = payload.stage || 'unknown';
  var skip = payload.skip || 'unknown';
  var reclaim = payload.reclaim || 'unknown';
  var liquidity = payload.liquidity || 'unknown';
  var regimeOn = isRegimeOn(payload.regime);
  var latest = pairState.latest;

  pairState.observations += 1;
  pairState.lastSeenAt = seenAt;
  pairState.latestVersion = version;

  countMapIncrement(pairState.stageCounts, stage);
  countMapIncrement(pairState.skipCounts, skip);
  countMapIncrement(pairState.reclaimCounts, reclaim);
  countMapIncrement(pairState.liquidityCounts, liquidity);

  if (regimeOn) {
    pairState.regimeOnObservations += 1;
  } else {
    pairState.regimeBlockedObservations += 1;
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

  if (score >= NEAR_READY_SCORE_MIN && regimeOn && skip !== 'entry-ready') {
    pairState.nearReadyObservations += 1;
    if (liquidity !== 'ok') {
      pairState.nearReadyLiquidityBlocked += 1;
    }
    if (reclaim !== 'ok') {
      pairState.nearReadyReclaimBlocked += 1;
    }
  }

  pairState.latest = {
    seenAt: seenAt,
    version: version,
    tf: payload.tf || '--',
    bid: payload.bid || '--',
    phase: payload.phase || '--',
    stage: stage,
    regime: payload.regime || '--',
    score: payload.score || '0/5',
    setup: payload.setup || '--',
    skip: skip,
    value: payload.value || '--',
    reclaim: reclaim,
    momentum: payload.momentum || '--',
    liquidity: liquidity,
    spread: payload.spread || '--',
    pullback: payload.pullback || '--',
    rsi: payload.rsi || '--',
    dca: payload.dca || '--',
    stop: payload.stop || '--'
  };
}

function appendEvent(state, event) {
  state.recentEvents.push(event);
  state.recentEvents = keepRecent(state.recentEvents, HISTORY_EVENT_LIMIT);
}

function parseLogChunk(text, state, seenAt) {
  var lines = String(text || '').split(/\r?\n/);
  var stateRegex = /^\[Aegis Regime Reclaim ([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]\[STATE\]\s+(.*)$/;
  var eventRegex = /^\[Aegis Regime Reclaim ([^\]]+)\]\[([^\]]+)\]\[([^\]]+)\]\[(INFO|WARN|ERROR|FATAL)\]\[([^\]]+)\]\s+(.*)$/;
  var result = {
    stateLines: 0,
    eventLines: 0,
    newEvents: [],
    errors: []
  };

  lines.forEach(function (line) {
    var stateMatch = line.match(stateRegex);
    var eventMatch;
    var pairState;
    var event;

    if (!line) {
      return;
    }

    if (stateMatch) {
      pairState = ensurePairState(state, stateMatch[3]);
      updatePairState(pairState, stateMatch[1], parseStatePayload(stateMatch[4]), seenAt);
      result.stateLines += 1;
      return;
    }

    eventMatch = line.match(eventRegex);
    if (!eventMatch) {
      return;
    }

    event = {
      seenAt: seenAt,
      version: eventMatch[1],
      exchange: eventMatch[2],
      pairName: eventMatch[3],
      level: eventMatch[4],
      code: eventMatch[5],
      message: eventMatch[6]
    };

    appendEvent(state, event);
    result.newEvents.push(event);
    result.eventLines += 1;

    if (event.level === 'ERROR' || event.level === 'FATAL') {
      result.errors.push(event);
    }
  });

  return result;
}

function summarizeTopCounts(map) {
  return sortCountEntries(map).slice(0, 3).map(function (item) {
    return item.key + ' x' + item.count;
  }).join(', ');
}

function buildFocusNotes(pairState) {
  var latest = pairState && pairState.latest ? pairState.latest : null;
  var notes = [];

  if (!latest) {
    notes.push('No live state observed yet for ' + FOCUS_PAIR + '.');
    return notes;
  }

  notes.push(
    FOCUS_PAIR + ' latest: stage=' + latest.stage +
    ' score=' + latest.score +
    ' skip=' + latest.skip +
    ' reclaim=' + latest.reclaim +
    ' liquidity=' + latest.liquidity
  );
  notes.push(
    FOCUS_PAIR + ' near-ready observations=' + pairState.nearReadyObservations +
    ', liquidity-blocked near-ready=' + pairState.nearReadyLiquidityBlocked +
    ', reclaim-blocked near-ready=' + pairState.nearReadyReclaimBlocked
  );
  notes.push(
    FOCUS_PAIR + ' top skip blockers: ' + summarizeTopCounts(pairState.skipCounts)
  );

  return notes;
}

function buildControlNotes(pairState) {
  var latest = pairState && pairState.latest ? pairState.latest : null;
  var notes = [];

  if (!latest) {
    notes.push('No live state observed yet for ' + CONTROL_PAIR + '.');
    return notes;
  }

  notes.push(
    CONTROL_PAIR + ' latest: stage=' + latest.stage +
    ' regime=' + latest.regime +
    ' score=' + latest.score +
    ' skip=' + latest.skip
  );
  notes.push(
    CONTROL_PAIR + ' regime-on observations=' + pairState.regimeOnObservations +
    ', regime-blocked observations=' + pairState.regimeBlockedObservations
  );

  return notes;
}

function buildAlerts(pairStates) {
  var alerts = [];
  var focusState = pairStates[FOCUS_PAIR];
  var controlState = pairStates[CONTROL_PAIR];
  var focusLatest = focusState && focusState.latest ? focusState.latest : null;
  var controlLatest = controlState && controlState.latest ? controlState.latest : null;

  if (focusState && focusState.nearReadyObservations >= NEAR_READY_ALERT_OBSERVATIONS) {
    alerts.push(
      FOCUS_PAIR + ' has reached score ' + NEAR_READY_SCORE_MIN +
      '+ in an allowed regime for ' + focusState.nearReadyObservations +
      ' monitor observations without entry. Primary blockers so far: ' +
      summarizeTopCounts(focusState.skipCounts)
    );
  }

  if (focusLatest && focusLatest.liquidity === 'volume-too-light' && focusState.nearReadyLiquidityBlocked >= NEAR_READY_ALERT_OBSERVATIONS) {
    alerts.push(
      FOCUS_PAIR + ' repeatedly looks close enough to entry that pair-specific liquidity tuning should be tested in the simulator before changing global defaults.'
    );
  }

  if (focusLatest && focusLatest.reclaim === 'weak-lower-wick' && focusState.nearReadyReclaimBlocked >= NEAR_READY_ALERT_OBSERVATIONS) {
    alerts.push(
      FOCUS_PAIR + ' is also repeatedly failing reclaim quality. Do not relax reclaim rules until liquidity tolerance is tested first.'
    );
  }

  if (controlLatest && isRegimeOn(controlLatest.regime)) {
    alerts.push(
      CONTROL_PAIR + ' regime control pair is now ON. Re-check whether the broader market gate is starting to open.'
    );
  }

  return alerts;
}

function buildReport(pairs, state, parseResult, seenAt) {
  var lines = [];
  var alerts = buildAlerts(state.pairStates);

  lines.push('Aegis Monitor');
  lines.push('Generated: ' + seenAt);
  lines.push('Strategy: ' + STRATEGY_NAME);
  lines.push('');
  lines.push('Configured Pairs');
  pairs.forEach(function (pair) {
    lines.push(
      '- ' + pair.pairName +
      ' | enabled=' + pair.enabled +
      ' | risk=' + pair.riskProfile +
      ' | log=' + pair.logMode +
      ' | period=' + pair.period + 'm'
    );
  });
  lines.push('');
  lines.push('Latest Snapshot');
  pairs.forEach(function (pair) {
    var pairState = state.pairStates[pair.pairName];
    var latest = pairState && pairState.latest ? pairState.latest : null;
    if (!latest) {
      lines.push('- ' + pair.pairName + ' | no Aegis state line seen yet');
      return;
    }
    lines.push(
      '- ' + pair.pairName +
      ' | stage=' + latest.stage +
      ' | regime=' + latest.regime +
      ' | score=' + latest.score +
      ' | skip=' + latest.skip +
      ' | reclaim=' + latest.reclaim +
      ' | liquidity=' + latest.liquidity +
      ' | phase=' + latest.phase +
      ' | seen=' + latest.seenAt
    );
  });
  lines.push('');
  lines.push('Focus Pair');
  buildFocusNotes(state.pairStates[FOCUS_PAIR] || defaultPairState()).forEach(function (note) {
    lines.push('- ' + note);
  });
  lines.push('');
  lines.push('Control Pair');
  buildControlNotes(state.pairStates[CONTROL_PAIR] || defaultPairState()).forEach(function (note) {
    lines.push('- ' + note);
  });
  lines.push('');
  lines.push('New Log Activity');
  lines.push('- state lines processed this run: ' + parseResult.stateLines);
  lines.push('- event lines processed this run: ' + parseResult.eventLines);
  lines.push('- errors in this run: ' + parseResult.errors.length);
  if (parseResult.newEvents.length) {
    parseResult.newEvents.forEach(function (event) {
      lines.push(
        '- event ' + event.level +
        ' | ' + event.pairName +
        ' | ' + event.code +
        ' | ' + event.message
      );
    });
  }
  lines.push('');
  lines.push('Alerts');
  if (!alerts.length) {
    lines.push('- none');
  } else {
    alerts.forEach(function (alert) {
      lines.push('- ' + alert);
    });
  }

  return {
    reportText: lines.join('\n') + '\n',
    alerts: alerts
  };
}

function buildSummaryLine(pairs, state, parseResult, alerts, seenAt) {
  var focusLatest = state.pairStates[FOCUS_PAIR] && state.pairStates[FOCUS_PAIR].latest;
  var controlLatest = state.pairStates[CONTROL_PAIR] && state.pairStates[CONTROL_PAIR].latest;
  var focusSummary = focusLatest
    ? (FOCUS_PAIR + '=' + focusLatest.stage + '/' + focusLatest.score + '/' + focusLatest.skip + '/' + focusLatest.liquidity)
    : (FOCUS_PAIR + '=no-state');
  var controlSummary = controlLatest
    ? (CONTROL_PAIR + '=' + controlLatest.stage + '/' + controlLatest.score + '/' + controlLatest.skip)
    : (CONTROL_PAIR + '=no-state');

  return (
    '[' + seenAt + '] Aegis monitor' +
    ' | pairs=' + pairs.length +
    ' | ' + focusSummary +
    ' | ' + controlSummary +
    ' | new_states=' + parseResult.stateLines +
    ' | new_events=' + parseResult.eventLines +
    ' | alerts=' + alerts.length
  );
}

function main() {
  var seenAt = nowIso();
  var pairs;
  var state;
  var logText;
  var parseResult;
  var report;
  var summaryLine;

  ensureDir(OPS_DIR);

  pairs = readAegisPairs();
  state = safeReadJson(STATE_PATH, defaultMonitorState());
  logText = readNewLogText(state);
  parseResult = parseLogChunk(logText, state, seenAt);
  report = buildReport(pairs, state, parseResult, seenAt);
  summaryLine = buildSummaryLine(pairs, state, parseResult, report.alerts, seenAt);

  state.lastRunAt = seenAt;
  writeJson(STATE_PATH, state);
  fs.writeFileSync(REPORT_PATH, report.reportText);
  fs.appendFileSync(HISTORY_PATH, summaryLine + '\n');

  console.log(summaryLine);
  report.alerts.forEach(function (alert) {
    console.log('ALERT: ' + alert);
  });
}

try {
  main();
} catch (err) {
  console.error('Aegis monitor failed: ' + (err && err.stack ? err.stack : String(err)));
  process.exit(1);
}
