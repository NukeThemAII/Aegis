/*
  summary-6h.js
  Periodic 6h digest for Aegis/Kestrel/Mako ops visibility.
  Writes: ops/summary-6h.txt
*/

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = '/home/xaos/gunbot';
var OPS = path.join(ROOT, 'customStrategies', 'ops');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return '';
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return null;
  }
}

function tailLines(text, maxLines) {
  if (!text) { return ''; }
  var lines = text.split('\n');
  if (lines.length <= maxLines) {
    return text.trim();
  }
  return lines.slice(lines.length - maxLines).join('\n').trim();
}

function extractLatestStateLines(logText, maxLines) {
  if (!logText) { return ''; }
  var lines = logText.split('\n');
  var out = [];
  for (var i = lines.length - 1; i >= 0 && out.length < maxLines; i -= 1) {
    var line = lines[i];
    if (line.indexOf('[Aegis Regime Reclaim') !== -1 || line.indexOf('[Kestrel Tape Scalper') !== -1 || line.indexOf('[Mako Micro Scalper') !== -1) {
      out.push(line);
    }
  }
  return out.reverse().join('\n').trim();
}

function summarizePairs(configJson) {
  if (!configJson || !configJson.pairs || !configJson.pairs.binance) {
    return 'No pair matrix found.';
  }
  var pairs = configJson.pairs.binance;
  var out = [];
  Object.keys(pairs).forEach(function(pair) {
    var p = pairs[pair] || {};
    var strat = (p.override && p.override.STRAT_FILENAME) ? p.override.STRAT_FILENAME : 'unknown';
    var period = (p.override && p.override.PERIOD) ? p.override.PERIOD : 'n/a';
    var profile = p.override && (p.override.AEGIS_RISK_PROFILE || p.override.KESTREL_RISK_PROFILE || p.override.MAKO_PROFILE);
    profile = profile || 'n/a';
    var enabled = p.enabled === true ? 'on' : 'off';
    out.push(pair + ' | ' + strat + ' | tf=' + period + 'm | profile=' + profile + ' | ' + enabled);
  });
  return out.join('\n');
}

function main() {
  var now = new Date();
  var header = '[OpenClaw 6h Digest] ' + now.toISOString();

  var configPath = path.join(ROOT, 'config.js');
  var configJson = readJsonSafe(configPath);
  var pairMatrix = summarizePairs(configJson);

  var logPath = path.join(ROOT, 'gunbot_logs', 'gunbot_logs.txt');
  var logText = readFileSafe(logPath);
  var latestStates = extractLatestStateLines(logText, 10);

  var aegisReport = readFileSafe(path.join(OPS, 'aegis-monitor-report.txt'));
  var kestrelReport = readFileSafe(path.join(OPS, 'kestrel-monitor-report.txt'));
  var makoReport = readFileSafe(path.join(OPS, 'mako-monitor-report.txt'));

  var out = [];
  out.push(header);
  out.push('');
  out.push('Pair matrix:');
  out.push(pairMatrix || 'No data');
  out.push('');
  out.push('Latest strategy state lines:');
  out.push(latestStates || 'No recent strategy state lines found.');
  out.push('');
  out.push('Aegis monitor report (tail):');
  out.push(tailLines(aegisReport, 80) || 'No aegis monitor report found.');
  out.push('');
  out.push('Kestrel monitor report (tail):');
  out.push(tailLines(kestrelReport, 80) || 'No kestrel monitor report found.');
  out.push('');
  out.push('Mako monitor report (tail):');
  out.push(tailLines(makoReport, 80) || 'No mako monitor report found.');

  fs.writeFileSync(path.join(OPS, 'summary-6h.txt'), out.join('\n') + '\n', 'utf8');
}

main();
