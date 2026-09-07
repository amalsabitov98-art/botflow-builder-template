type PageResult<T> = { data: T[] | null; error: any };

// The server can cap a response below the requested page size. Continue until
// an empty page, advancing by the actual row count. Callers must order by a
// stable unique key (or add one as a tie breaker) and create a fresh query.
export async function readAllRows<T = any>(
  query: () => { range: (from: number, to: number) => PromiseLike<PageResult<T>> },
  maxRows = Infinity,
): Promise<PageResult<T>> {
  const rows: T[] = [];
  while (rows.length < maxRows) {
    const size = Math.min(500, maxRows - rows.length);
    const { data, error } = await query().range(rows.length, rows.length + size - 1);
    if (error) return { data: null, error };
    if (!data?.length) break;
    rows.push(...data);
  }
  return { data: rows, error: null };
}
