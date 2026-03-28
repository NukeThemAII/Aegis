# TOOLS.md - Local Notes

## Trading Workspace Paths

- Gunbot config: `/home/xaos/gunbot/config.js`
- Strategy repo root: `/home/xaos/gunbot/customStrategies`
- Gunbot logs: `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`
- JSON state files: `/home/xaos/gunbot/json`
- Backup root: `/home/xaos/gunbot/backups`

## Strategy Runtime Files

- Aegis runtime: `/home/xaos/gunbot/customStrategies/Aegis.js`
- Kestrel runtime: `/home/xaos/gunbot/customStrategies/Kestrel.js`
- Main session log: `/home/xaos/gunbot/customStrategies/LOG.md`
- Durable memory: `/home/xaos/gunbot/customStrategies/MEMORY.md`

## Ops Scripts

- Aegis monitor: `/home/xaos/gunbot/customStrategies/ops/aegis-monitor.js`
- Kestrel monitor: `/home/xaos/gunbot/customStrategies/ops/kestrel-monitor.js`
- Log maintenance: `/home/xaos/gunbot/customStrategies/ops/log-maintenance.js`

## Cron

- Aegis monitor every 5 minutes
- Kestrel monitor every 5 minutes on an offset
- Log maintenance hourly

## Operating Rules

- Use live logs and pair state before changing strategy settings.
- Back up edited files before meaningful changes.
- Use `LOG.md` for session detail and `MEMORY.md` for durable rules.
- Treat Aegis as the main premium strategy and Kestrel as the beta/dev lane.
