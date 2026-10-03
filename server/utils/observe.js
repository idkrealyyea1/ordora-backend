'use strict';

/**
 * Minimal structured logging (stdlib only, JSON lines to stdout/stderr).
 * Values under secret-like keys are redacted so traces never carry
 * passwords, secrets, tokens, or credentials.
 */

const DENY = /password|passwd|secret|token|vapid|session|cookie|authorization|bearer|card|cvv|private[_-]?key/i;

function scrub(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[depth]';
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = DENY.test(k) ? '[redacted]' : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level, event, fields) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...scrub(fields || {}) });
  if (level === 'error') console.error(line);
  else console.log(line);
}

function info(event, fields) { emit('info', event, fields); }
function warn(event, fields) { emit('warn', event, fields); }
function error(event, fields) { emit('error', event, fields); }

module.exports = { info, warn, error, scrub };
