#!/bin/sh
L="$HOME/miles-lab/runs/thermostat.log"
DONE="$HOME/miles-lab/queue2.done"
paused=0
c=
release() {
  if [ "$paused" = 1 ] && [ -n "$c" ] && docker unpause "$c" >/dev/null; then
    echo "$(date -u +%FT%TZ) resume on exit after $(( $(date +%s) - since )) s" >> "$L"
  fi
  paused=0
}
trap 'release; exit 1' INT TERM HUP
while [ ! -f "$DONE" ]; do
  t=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits | head -1)
  c=$(docker ps -q --filter ancestor=radixark/miles:latest | head -1)
  if [ -z "$c" ]; then paused=0
  elif [ "$paused" = 0 ] && [ "$t" -ge 84 ]; then docker pause "$c" >/dev/null && paused=1 && since=$(date +%s) && echo "$(date -u +%FT%TZ) pause at ${t}C" >> "$L"
  elif [ "$paused" = 1 ] && { { [ "$t" -le 74 ] && [ $(( $(date +%s) - since )) -ge 45 ]; } || [ $(( $(date +%s) - since )) -ge 120 ]; }; then docker unpause "$c" >/dev/null && paused=0 && echo "$(date -u +%FT%TZ) resume at ${t}C after $(( $(date +%s) - since )) s" >> "$L"
  fi
  sleep 5
done
release
