export async function fetchWithDeadline(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 20_000,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController()
  const parent = init?.signal ?? (input instanceof Request ? input.signal : null)
  const abort = () => controller.abort(parent?.reason)
  if (parent?.aborted) abort()
  else parent?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)
  try {
    const response = await fetcher(input, { ...init, signal: controller.signal })
    // This client uses JSON responses. Keep the deadline active through body download.
    const body = await response.arrayBuffer()
    return new Response([204, 205, 304].includes(response.status) ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    })
  } finally {
    clearTimeout(timer)
    parent?.removeEventListener('abort', abort)
  }
}

export async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>,
): Promise<T[]> {
  const result: T[] = []
  for (;;) {
    const { data, error, count } = await page(result.length, result.length + 499)
    if (error) throw error
    if (data === null) throw new Error('NOT_FOUND')
    result.push(...data)
    if (!data.length || (count !== null && result.length >= count)) return result
  }
}
