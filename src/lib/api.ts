export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? String(body.error)
      : `Ошибка сервера (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}
