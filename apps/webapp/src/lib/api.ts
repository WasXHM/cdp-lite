import type { ApiErrorBody, ListResponse } from '@cdp/contracts';

export class ApiError extends Error {
  constructor(public body: ApiErrorBody['error'], public status: number) { super(body.message); }
}
export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new Error('无法连接服务，请检查 API 是否已启动'); }
  if (response.status === 204) return undefined as T;
  const content = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(content?.error || { code: 'SERVER_ERROR', message: '服务连接失败，请检查 API 和数据库', details: [], requestId: response.headers.get('X-Request-Id') || '' }, response.status);
  return content as T;
}
export async function getDetail<T>(path: string): Promise<T> { return (await request<{ data: T }>(path)).data; }
export async function getAll<T>(path: string): Promise<T[]> {
  const result: T[] = [];
  let page = 1;
  while (true) {
    const response = await request<ListResponse<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`);
    result.push(...response.data);
    if (result.length >= response.pagination.total) return result;
    page++;
  }
}
export const dateLabel = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });
