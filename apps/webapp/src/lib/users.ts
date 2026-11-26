import type { CreateUserInput, ListResponse, ManagedUser, UpdateUserInput } from '@cdp/contracts';
import { request } from './api';

export function listUsers(query: string) {
  return request<ListResponse<ManagedUser>>(`/users?${query}`);
}

export function createUser(input: CreateUserInput) {
  return request<{ data: ManagedUser }>('/users', 'POST', input);
}

export function updateUser(id: string, input: UpdateUserInput) {
  return request<{ data: ManagedUser }>(`/users/${id}`, 'PATCH', input);
}

export function deleteUser(id: string) {
  return request<void>(`/users/${id}`, 'DELETE');
}
