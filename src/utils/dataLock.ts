export async function withDataLock<T>(action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('Private sync requires a browser with secure storage locks.');
  return navigator.locks.request('fexec-data-write', action);
}
