#!/usr/bin/env node

/*
 * Log maintenance for Gunbot strategy development.
 *
 * Trims oversized logs in place while keeping the newest tail.
 * This is designed for long-running simulator sessions with cycle logging.
 */

var fs = require('fs');
var path = require('path');

var OPS_DIR = __dirname;
var CUSTOM_STRATEGIES_DIR = path.resolve(OPS_DIR, '..');
var GUNBOT_DIR = path.resolve(CUSTOM_STRATEGIES_DIR, '..');

var REPORT_PATH = path.join(OPS_DIR, 'log-maintenance-report.txt');
var STATE_PATH = path.join(OPS_DIR, 'log-maintenance-state.json');

var RULES = [
  {
    label: 'gunbot-main-log',
    mode: 'single',
    filePath: path.join(GUNBOT_DIR, 'gunbot_logs', 'gunbot_logs.txt'),
    maxBytes: 64 * 1024 * 1024,
    keepBytes: 16 * 1024 * 1024
  },
  {
    label: 'gunbot-pair-logs',
    mode: 'directory',
    dirPath: path.join(GUNBOT_DIR, 'gunbot_logs'),
    filePattern: /^binance\..+\.log$/,
    maxBytes: 48 * 1024 * 1024,
    keepBytes: 12 * 1024 * 1024
  },
  {
    label: 'ops-logs',
    mode: 'directory',
    dirPath: OPS_DIR,
    filePattern: /\.(log|txt)$/,
    excludeFiles: {
      'aegis-monitor-report.txt': true,
      'kestrel-monitor-report.txt': true,
      'log-maintenance-report.txt': true
    },
    maxBytes: 4 * 1024 * 1024,
    keepBytes: 1 * 1024 * 1024
  }
];

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

function formatBytes(value) {
  var bytes = safeNumber(value, 0);
  if (bytes >= 1024 * 1024 * 1024) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GiB';
  }
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MiB';
  }
  if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + ' KiB';
  }
  return String(bytes) + ' B';
}

function nowIso() {
  return new Date().toISOString();
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

function trimToWholeLines(buffer, keepBytes) {
  var text = buffer.toString('utf8');
  var firstNewlineIndex;

  if (buffer.length < keepBytes) {
    return text;
  }

  firstNewlineIndex = text.indexOf('\n');
  if (firstNewlineIndex >= 0 && firstNewlineIndex < (text.length - 1)) {
    return text.slice(firstNewlineIndex + 1);
  }

  return text;
}

function trimFile(filePath, maxBytes, keepBytes) {
  var stat;
  var startOffset;
  var fd;
  var buffer;
  var retainedText;

  if (!fs.existsSync(filePath)) {
    return {
      filePath: filePath,
      existed: false,
      trimmed: false,
      beforeBytes: 0,
      afterBytes: 0
    };
  }

  stat = fs.statSync(filePath);
  if (stat.size <= maxBytes) {
    return {
      filePath: filePath,
      existed: true,
      trimmed: false,
      beforeBytes: stat.size,
      afterBytes: stat.size
    };
  }

  startOffset = Math.max(0, stat.size - keepBytes);
  fd = fs.openSync(filePath, 'r');
  buffer = Buffer.alloc(stat.size - startOffset);
  fs.readSync(fd, buffer, 0, buffer.length, startOffset);
  fs.closeSync(fd);

  retainedText = trimToWholeLines(buffer, keepBytes);
  fs.writeFileSync(filePath, retainedText, 'utf8');

  return {
    filePath: filePath,
    existed: true,
    trimmed: true,
    beforeBytes: stat.size,
    afterBytes: fs.statSync(filePath).size
  };
}

function listRuleFiles(rule) {
  var entries;
  if (rule.mode === 'single') {
    return [rule.filePath];
  }

  if (!fs.existsSync(rule.dirPath)) {
    return [];
  }

  entries = fs.readdirSync(rule.dirPath);
  return entries.filter(function (name) {
    if (rule.excludeFiles && rule.excludeFiles[name]) {
      return false;
    }
    return rule.filePattern.test(name);
  }).map(function (name) {
    return path.join(rule.dirPath, name);
  });
}

function runRule(rule) {
  return listRuleFiles(rule).map(function (filePath) {
    return trimFile(filePath, rule.maxBytes, rule.keepBytes);
  });
}

function summarize(results) {
  var summary = {
    ranAt: nowIso(),
    checkedFiles: 0,
    trimmedFiles: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    reclaimedBytes: 0,
    files: []
  };

  results.forEach(function (result) {
    summary.checkedFiles += 1;
    summary.bytesBefore += result.beforeBytes;
    summary.bytesAfter += result.afterBytes;
    if (result.trimmed) {
      summary.trimmedFiles += 1;
      summary.reclaimedBytes += Math.max(0, result.beforeBytes - result.afterBytes);
      summary.files.push({
        filePath: result.filePath,
        beforeBytes: result.beforeBytes,
        afterBytes: result.afterBytes
      });
    }
  });

  return summary;
}

function renderReport(summary) {
  var lines = [];

  lines.push('Log Maintenance Report');
  lines.push('Generated: ' + summary.ranAt);
  lines.push('');
  lines.push('Checked files: ' + String(summary.checkedFiles));
  lines.push('Trimmed files: ' + String(summary.trimmedFiles));
  lines.push('Bytes before: ' + formatBytes(summary.bytesBefore));
  lines.push('Bytes after: ' + formatBytes(summary.bytesAfter));
  lines.push('Reclaimed: ' + formatBytes(summary.reclaimedBytes));
  lines.push('');

  if (!summary.files.length) {
    lines.push('No files required trimming.');
    return lines.join('\n') + '\n';
  }

  lines.push('Trimmed files:');
  summary.files.forEach(function (item) {
    lines.push(
      '- ' + item.filePath +
      ' | ' + formatBytes(item.beforeBytes) +
      ' -> ' + formatBytes(item.afterBytes)
    );
  });

  return lines.join('\n') + '\n';
}

function main() {
  var previousState = safeReadJson(STATE_PATH, {});
  var results = [];
  var summary;

  ensureDir(OPS_DIR);

  RULES.forEach(function (rule) {
    results = results.concat(runRule(rule));
  });

  summary = summarize(results);
  summary.previousRunAt = previousState.ranAt || '';

  fs.writeFileSync(REPORT_PATH, renderReport(summary), 'utf8');
  writeJson(STATE_PATH, summary);
  console.log(
    '[log-maintenance] checked=' + String(summary.checkedFiles) +
    ' trimmed=' + String(summary.trimmedFiles) +
    ' reclaimed=' + formatBytes(summary.reclaimedBytes)
  );
}

main();
