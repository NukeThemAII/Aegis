# HEARTBEAT.md

## Periodic Trading Workspace Check

When heartbeat runs in this workspace:

1. Read the active custom-pair matrix from `/home/xaos/gunbot/config.js`.
2. Read the latest strategy output from `/home/xaos/gunbot/gunbot_logs/gunbot_logs.txt`.
3. Run:
   - `/home/xaos/gunbot/customStrategies/ops/aegis-monitor.js`
   - `/home/xaos/gunbot/customStrategies/ops/kestrel-monitor.js`
4. Look for:
   - repeated skip reasons on near-ready pairs
   - fresh `INFO`, `WARN`, or `ERROR` lines from Aegis or Kestrel
   - wrong-strategy-on-wrong-pair symptoms
   - obviously stale bags, broken chart telemetry, or transition spam
5. Only propose or apply changes when supported by repeated live evidence.
6. If meaningful work is done, update:
   - `/home/xaos/gunbot/customStrategies/LOG.md`
   - `/home/xaos/gunbot/customStrategies/MEMORY.md`

If nothing needs action, keep the result concise.
