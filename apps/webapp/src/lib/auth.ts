import type { AuthLoginInput, AuthUser } from '@cdp/contracts';
import { getDetail, request } from './api';

export function login(input: AuthLoginInput) {
  return getDetail<AuthUser>('/auth/login', 'POST', input);
}

export function getCurrentUser() {
  return getDetail<AuthUser>('/auth/me');
}

export function logout() {
  return request<void>('/auth/logout', 'POST');
}
