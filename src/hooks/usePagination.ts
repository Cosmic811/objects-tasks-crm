import { useState } from 'react'

export function usePagination<T>(items: T[], size = 50) {
  const [requested, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = Math.min(requested, pages - 1)
  const start = page * size
  return {
    items: items.slice(start, start + size),
    page, pages, total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + size, items.length),
    previous: () => setPage(Math.max(0, page - 1)),
    next: () => setPage(Math.min(pages - 1, page + 1)),
  }
}
