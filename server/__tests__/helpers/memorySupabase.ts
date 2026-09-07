// Small in-memory PostgREST stand-in. It caps SELECT responses independently
// of the requested range and supports error injection for persistence tests.
export function memorySupabase(seed: Record<string, any[]> = {}, cap = 73) {
  const tables = structuredClone(seed);
  const calls: Array<{ table: string; action: string }> = [];
  const failures = new Map<string, any>();

  function from(table: string) {
    let action = "select";
    let payload: any;
    const filters: Array<[string, any]> = [];
    const sorting: Array<[string, boolean]> = [];
    let start = 0;
    let end = Infinity;
    let single = false;
    const query: any = {
      select: () => query,
      order: (key: string, options?: { ascending?: boolean }) => {
        sorting.push([key, options?.ascending !== false]); return query;
      },
      eq: (key: string, value: any) => { filters.push([key, value]); return query; },
      range: (a: number, b: number) => { start = a; end = b; return query; },
      limit: (n: number) => { end = n - 1; return query; },
      maybeSingle: () => { single = true; return query; },
      single: () => { single = true; return query; },
      upsert: (value: any) => { action = "upsert"; payload = value; return query; },
      insert: (value: any) => { action = "insert"; payload = value; return query; },
      update: (value: any) => { action = "update"; payload = value; return query; },
      delete: () => { action = "delete"; return query; },
      then: (resolve: (value: any) => any, reject: (error: any) => any) => {
        return Promise.resolve().then(() => {
          calls.push({ table, action });
          const error = failures.get(`${table}:${action}`);
          if (error) return { data: null, error };
          const rows = tables[table] ||= [];
          const matches = (row: any) => filters.every(([key, value]) => row[key] === value);
          if (action === "select") {
            const selected = rows.filter(matches).sort((a, b) => {
              for (const [key, asc] of sorting) {
                if (a[key] === b[key]) continue;
                return (a[key] < b[key] ? -1 : 1) * (asc ? 1 : -1);
              }
              return 0;
            }).slice(start, Math.min(end + 1, start + cap));
            return { data: structuredClone(single ? selected[0] || null : selected), error: null };
          }
          if (action === "delete") tables[table] = rows.filter((row) => !matches(row));
          if (action === "update") rows.filter(matches).forEach((row) => Object.assign(row, structuredClone(payload)));
          if (action === "insert" || action === "upsert") {
            const index = rows.findIndex((row) => table === "user_funnel_progress"
              ? row.chat_id === payload.chat_id && row.funnel_id === payload.funnel_id
              : row.id === payload.id);
            if (index >= 0 && action === "insert") return { data: null, error: { code: "23505" } };
            if (index >= 0) rows[index] = { ...rows[index], ...structuredClone(payload) };
            else rows.push(structuredClone(payload));
          }
          return { data: null, error: null };
        }).then(resolve, reject);
      },
    };
    return query;
  }
  return { client: { from } as any, tables, calls, failures };
}
