// File: `parent-pulse-backend/src/logsEmitter.js`
import EventEmitter from 'events';

const logs = new EventEmitter();

const stringify = (...args) =>
  args
    .map(a => (typeof a === 'string' ? a : (() => {
      try { return JSON.stringify(a); } catch { return String(a); }
    })()))
    .join(' ');

const orig = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

console.log = (...args) => {
  const message = stringify(...args);
  logs.emit('log', { level: 'info', message, ts: new Date().toISOString() });
  orig.log.apply(console, args);
};
console.info = (...args) => {
  const message = stringify(...args);
  logs.emit('log', { level: 'info', message, ts: new Date().toISOString() });
  orig.info.apply(console, args);
};
console.warn = (...args) => {
  const message = stringify(...args);
  logs.emit('log', { level: 'warn', message, ts: new Date().toISOString() });
  orig.warn.apply(console, args);
};
console.error = (...args) => {
  const message = stringify(...args);
  logs.emit('log', { level: 'error', message, ts: new Date().toISOString() });
  orig.error.apply(console, args);
};

export default logs;