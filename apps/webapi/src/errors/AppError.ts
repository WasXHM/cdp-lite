import type { ValidationIssue } from '@cdp/contracts';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details: ValidationIssue[] = []) {
    super(message);
  }
}
