import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { AiAudienceGenerateRequest, AiAudienceGenerateResult } from '@cdp/contracts';
import { request } from '../../../lib/api';

export function useGenerateAudienceRules() {
  const controllerRef = useRef<AbortController | null>(null);
  const mutation = useMutation({
    mutationFn: ({ input, signal }: { input: AiAudienceGenerateRequest; signal: AbortSignal }) =>
      request<{ data: AiAudienceGenerateResult }>('/audiences/generate-rules', 'POST', input, signal).then(response => response.data),
  });
  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = async (input: AiAudienceGenerateRequest) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try { return await mutation.mutateAsync({ input, signal: controller.signal }); }
    finally { if (controllerRef.current === controller) controllerRef.current = null; }
  };
  const cancel = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    mutation.reset();
  };
  return { ...mutation, generate, cancel };
}
