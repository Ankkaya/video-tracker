const isDev = import.meta.env.DEV;

function write(method: 'log' | 'info' | 'warn' | 'error' | 'debug', ...args: unknown[]) {
  if (!isDev) return;
  console[method](...args);
}

export const logger = {
  log: (...args: unknown[]) => write('log', ...args),
  info: (...args: unknown[]) => write('info', ...args),
  warn: (...args: unknown[]) => write('warn', ...args),
  error: (...args: unknown[]) => write('error', ...args),
  debug: (...args: unknown[]) => write('debug', ...args),
};
