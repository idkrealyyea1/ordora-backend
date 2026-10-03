'use strict';

/**
 * Lightweight in-process Server-Sent Events hub used to push
 * "new order" notifications to restaurant dashboards.
 * Single-instance only by design (no external broker needed).
 * ponytail: in-process Map; events don't cross nodes and vanish on restart —
 * external broker/retained mailbox if multi-node or guaranteed delivery matters.
 */

const clients = new Map(); // restaurantId -> Set<res>

let heartbeat = null;

function ensureHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    for (const set of clients.values()) {
      for (const res of set) res.write(': ping\n\n');
    }
  }, 25000);
  heartbeat.unref();
}

function addClient(restaurantId, res) {
  ensureHeartbeat();
  if (!clients.has(restaurantId)) clients.set(restaurantId, new Set());
  clients.get(restaurantId).add(res);

  const remove = () => {
    const set = clients.get(restaurantId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(restaurantId);
    }
    if (clients.size === 0 && heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };
  res.on('close', remove);
  res.on('finish', remove);
}

function broadcast(restaurantId, event, data) {
  const set = clients.get(restaurantId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      /* closed connections are cleaned up on 'close' */
    }
  }
}

/** Close every open stream (graceful shutdown); safe to call with none open. */
function closeAll() {
  for (const set of clients.values()) {
    for (const res of set) {
      try {
        res.end();
      } catch {
        /* already gone */
      }
    }
  }
  clients.clear();
  if (heartbeat) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
}

module.exports = { addClient, broadcast, closeAll };
