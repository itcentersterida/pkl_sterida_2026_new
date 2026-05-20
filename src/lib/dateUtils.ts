export function safeToDate(ts: any): Date {
  if (!ts) return new Date();

  try {
    // 1. If it's already a Date object
    if (ts instanceof Date) return ts;

    // 2. If it has a .toDate() method (standard Firestore Timestamp)
    if (typeof ts.toDate === 'function') {
      return ts.toDate();
    }

    // 3. If it looks like a Firestore Timestamp object from plain JSON (seconds/nanoseconds)
    if (ts && typeof ts === 'object' && ('seconds' in ts || 'nanoseconds' in ts)) {
      const seconds = Number(ts.seconds || 0);
      const nanoseconds = Number(ts.nanoseconds || 0);
      return new Date((seconds * 1000) + Math.floor(nanoseconds / 1000000));
    }

    // 4. If it's a string (ISO, etc.) or a number (timestamp)
    if (typeof ts === 'string' || typeof ts === 'number') {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? new Date() : d;
    }
  } catch (e) {
    console.warn('safeToDate failed to convert:', ts, e);
  }

  return new Date();
}

export function formatSafeTime(ts: any, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  try {
    const d = safeToDate(ts);
    return d.toLocaleTimeString('id-ID', options);
  } catch (error) {
    return '--:--';
  }
}

export function formatSafeDate(ts: any, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  try {
    const d = safeToDate(ts);
    return d.toLocaleDateString('id-ID', options);
  } catch (error) {
    return '-';
  }
}
