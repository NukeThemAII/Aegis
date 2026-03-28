#!/usr/bin/env node

/*
 * Mako operations monitor.
 *
 * Tracks live simulator behavior for Mako pairs without touching
 * Gunbot runtime logic.
 */

var fs = require('fs');
var path = require('path');

var STRATEGY_NAME = 'Mako Micro Scalper';
var FOCUS_PAIR = 'USDT-XRP';
var INITIAL_SCAN_BYTES = 1024 * 1024;
var HISTORY_EVENT_LIMIT = 50;
var READY_ALERT_OBSERVATIONS = 10;
var ARMED_ALERT_OBSERVATIONS = 20;

var OPS_DIR = __dirname;
var CUSTOM_STRATEGIES_DIR = path.resolve(__dirname, '..');
var GUNBOT_DIR = path.resolve(CUSTOM_STRATEGIES_DIR, '..');

var CONFIG_PATH = path.join(GUNBOT_DIR, 'config.js');
var GUNBOT_LOG_PATH = path.join(GUNBOT_DIR, 'gunbot_logs', 'gunbot_logs.txt');
var STATE_PATH = path.join(OPS_DIR, 'mako-monitor-state.json');
var REPORT_PATH = path.join(OPS_DIR, 'mako-monitor-report.txt');
var HISTORY_PATH = path.join(OPS_DIR, 'mako-monitor-history.log');

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

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultPairState() {
  return {
    observations: 0,
    lastSeenAt: '',
    latestVersion: '',
    latest: null,
    stageCounts: {},
    skipCounts: {},
    liquidityCounts: {},
    eventCounts: {},
    armedObservations: 0,
    readyObservations: 0,
    layeredObservations: 0,
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

function readMakoPairs() {
  var config = safeReadJson(CONFIG_PATH, {});
  var binancePairs = config && config.pairs && config.pairs.binance ? config.pairs.binance : {};
  var results = [];

  Object.keys(binancePairs).forEach(function (pairName) {
    var pairConfig = binancePairs[pairName] || {};
    var overrides = pairConfig.override || {};

    if (overrides.STRAT_FILENAME !== 'Mako.js') {
      return;
    }

    results.push({
      pairName: pairName,
      enabled: !!pairConfig.enabled,
      profile: overrides.MAKO_PROFILE || overrides.MAKO_RISK_PROFILE || 'balanced',
      logMode: overrides.MAKO_LOG_MODE || 'changes',
      period: String(overrides.PERIOD || '5')
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

function updatePairState(pairState, version, payload, seenAt) {
  var stage = payload.stage || 'unknown';
  var skip = payload.skip || 'unknown';
  var liquidity = payload.liquidity || 'unknown';
  var arm = payload.arm || 'no';
  var layers = payload.layers || '0/0';
  var latest = pairState.latest;

  pairState.observations += 1;
  pairState.lastSeenAt = seenAt;
  pairState.latestVersion = version;

  countMapIncrement(pairState.stageCounts, stage);
  countMapIncrement(pairState.skipCounts, skip);
  countMapIncrement(pairState.liquidityCounts, liquidity);

  if (arm === 'yes' || stage === 'armed') {
    pairState.armedObservations += 1;
  }
  if (stage === 'entry-ready') {
    pairState.readyObservations += 1;
  }
  if (String(layers).indexOf('0/') !== 0) {
    pairState.layeredObservations += 1;
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
    arm: arm,
    stretch: payload.stretch || '',
    bounce: payload.bounce || '',
    pulse: payload.pulse || '',
    rsi: payload.rsi || '',
    liquidity: liquidity,
    relvol: payload.relvol || '',
    spread: payload.spread || '',
    layers: layers,
    skip: skip,
    target: payload.target || '',
    stop: payload.stop || ''
  };
}

function processLogText(state, logText, knownPairs) {
  var lines = String(logText || '').split('\n');
  var pairLookup = {};
  var regex = new RegExp('^\\[' + escapeRegex(STRATEGY_NAME) + ' ([^\\]]+)\\]\\[[^\\]]*\\]\\[([^\\]]+)\\]\\[(STATE|INFO|WARN|ERROR)\\](?:\\[([^\\]]+)\\])?\\s*(.*)$');
  var newStates = 0;
  var newEvents = 0;
  var errors = 0;

  knownPairs.forEach(function (pair) {
    pairLookup[pair.pairName] = pair;
  });

  lines.forEach(function (line) {
    var match = regex.exec(line);
    var version;
    var pairName;
    var kind;
    var code;
    var message;
    var seenAt;
    var pairState;

    if (!match) {
      return;
    }

    version = match[1];
    pairName = match[2];
    kind = match[3];
    code = match[4] || '';
    message = match[5] || '';
    seenAt = nowIso();

    if (!pairLookup[pairName]) {
      return;
    }

    pairState = ensurePairState(state, pairName);

    if (kind === 'STATE') {
      updatePairState(pairState, version, parseStatePayload(message), seenAt);
      newStates += 1;
      return;
    }

    countMapIncrement(pairState.eventCounts, code || kind.toLowerCase());
    state.recentEvents.push({
      seenAt: seenAt,
      pairName: pairName,
      kind: kind,
      code: code || kind.toLowerCase(),
      message: message
    });
    newEvents += 1;

    if (kind === 'ERROR') {
      errors += 1;
    }
  });

  state.recentEvents = keepRecent(state.recentEvents, HISTORY_EVENT_LIMIT);

  return {
    newStates: newStates,
    newEvents: newEvents,
    errors: errors
  };
}

function buildAlerts(pairs, state) {
  var alerts = [];

  pairs.forEach(function (pair) {
    var pairState = ensurePairState(state, pair.pairName);
    var entryCount = pairState.eventCounts.entry || 0;

    if (pairState.readyObservations >= READY_ALERT_OBSERVATIONS && entryCount === 0) {
      alerts.push(pair.pairName + ' reached entry-ready ' + pairState.readyObservations + ' times without an entry event. Check trigger precision and order sizing.');
    }
    if (pairState.armedObservations >= ARMED_ALERT_OBSERVATIONS && entryCount === 0) {
      alerts.push(pair.pairName + ' has been armed ' + pairState.armedObservations + ' times without an entry event. Check reclaim threshold and cooldown pacing.');
    }
  });

  return alerts;
}

function buildReport(pairs, state, processed) {
  var lines = [];
  var focusState = ensurePairState(state, FOCUS_PAIR);
  var alerts = buildAlerts(pairs, state);

  lines.push('Mako Monitor Report');
  lines.push('Generated: ' + nowIso());
  lines.push('Pairs tracked: ' + String(pairs.length));
  lines.push('');

  pairs.forEach(function (pair) {
    var pairState = ensurePairState(state, pair.pairName);
    var latest = pairState.latest;
    var topSkips = sortCountEntries(pairState.skipCounts).slice(0, 3);

    lines.push(pair.pairName + ' | enabled=' + String(pair.enabled) + ' | profile=' + pair.profile + ' | log=' + pair.logMode);
    if (latest) {
      lines.push(
        '  latest: stage=' + latest.stage +
        ' arm=' + latest.arm +
        ' skip=' + latest.skip +
        ' stretch=' + latest.stretch +
        ' bounce=' + latest.bounce +
        ' pulse=' + latest.pulse +
        ' liquidity=' + latest.liquidity +
        ' relvol=' + latest.relvol +
        ' layers=' + latest.layers
      );
    } else {
      lines.push('  latest: no data');
    }
    lines.push(
      '  counters: observations=' + pairState.observations +
      ' armed=' + pairState.armedObservations +
      ' ready=' + pairState.readyObservations +
      ' layered=' + pairState.layeredObservations +
      ' stageStreak=' + pairState.currentStageStreak +
      ' skipStreak=' + pairState.currentSkipStreak
    );
    if (topSkips.length) {
      lines.push('  top skips: ' + topSkips.map(function (entry) {
        return entry.key + '=' + entry.count;
      }).join(', '));
    }
    lines.push('');
  });

  lines.push('Focus Pair');
  if (focusState.latest) {
    lines.push(
      '- ' + FOCUS_PAIR +
      ' latest: stage=' + focusState.latest.stage +
      ' arm=' + focusState.latest.arm +
      ' skip=' + focusState.latest.skip +
      ' stretch=' + focusState.latest.stretch +
      ' bounce=' + focusState.latest.bounce +
      ' pulse=' + focusState.latest.pulse +
      ' relvol=' + focusState.latest.relvol
    );
  } else {
    lines.push('- ' + FOCUS_PAIR + ' latest: no data');
  }
  lines.push(
    '- ' + FOCUS_PAIR +
    ' counters: armed=' + focusState.armedObservations +
    ', ready=' + focusState.readyObservations +
    ', entries=' + safeNumber(focusState.eventCounts.entry, 0) +
    ', layers=' + safeNumber(focusState.eventCounts.layer, 0)
  );
  lines.push('');

  lines.push('New Log Activity');
  lines.push('- state lines processed this run: ' + processed.newStates);
  lines.push('- event lines processed this run: ' + processed.newEvents);
  lines.push('- errors in this run: ' + processed.errors);
  lines.push('');

  lines.push('Alerts');
  if (alerts.length) {
    alerts.forEach(function (alert) {
      lines.push('- ' + alert);
    });
  } else {
    lines.push('- none');
  }
  lines.push('');

  lines.push('Recent events:');
  if (state.recentEvents.length) {
    state.recentEvents.slice(-10).forEach(function (event) {
      lines.push('- ' + event.seenAt + ' | ' + event.pairName + ' | ' + event.code + ' | ' + event.message);
    });
  } else {
    lines.push('- none');
  }

  return {
    reportText: lines.join('\n') + '\n',
    alerts: alerts
  };
}

function writeHistory(alerts) {
  var lines = [];
  if (!alerts.length) {
    return;
  }
  alerts.forEach(function (alert) {
    lines.push('[' + nowIso() + '] ALERT: ' + alert);
  });
  fs.appendFileSync(HISTORY_PATH, lines.join('\n') + '\n');
}

function main() {
  var pairs = readMakoPairs();
  var state = safeReadJson(STATE_PATH, defaultMonitorState());
  var processed;
  var built;
  var focusState;

  if (!pairs.length) {
    fs.writeFileSync(REPORT_PATH, 'Mako Monitor Report\nGenerated: ' + nowIso() + '\nPairs tracked: 0\n');
    return;
  }

  processed = processLogText(state, readNewLogText(state), pairs);
  state.lastRunAt = nowIso();
  built = buildReport(pairs, state, processed);
  focusState = ensurePairState(state, FOCUS_PAIR);

  writeJson(STATE_PATH, state);
  fs.writeFileSync(REPORT_PATH, built.reportText);
  writeHistory(built.alerts);

  console.log(
    '[' + nowIso() + '] Mako monitor | pairs=' + pairs.length +
    ' | ' + FOCUS_PAIR + '=' + (focusState.latest ? (focusState.latest.stage + '/' + focusState.latest.skip + '/' + focusState.latest.stretch) : 'no-data') +
    ' | new_states=' + processed.newStates +
    ' | new_events=' + processed.newEvents +
    ' | alerts=' + built.alerts.length
  );
}

main();
