import { useQuery } from '@tanstack/react-query';
import type { EventModel, Metadata } from '@cdp/contracts';
import { getAll, getDetail } from '../../../lib/api';

export function useRuleCatalog(type: 'TAG' | 'ATTRIBUTE' | 'EVENT') {
  return useQuery({
    queryKey: ['catalog', type],
    queryFn: () => getAll<Metadata | EventModel>(`/rule-catalog?type=${type}`),
  });
}
export function useMetadata(id: string) {
  return useQuery({ queryKey: ['metadata', id], queryFn: () => getDetail<Metadata>(`/metadata/${id}`), enabled: !!id });
}
export function useEvent(id: string) {
  return useQuery({ queryKey: ['event', id], queryFn: () => getDetail<EventModel>(`/event-models/${id}`), enabled: !!id });
}
