import type { Region, Topic } from './types';

export const TOPIC_LABELS: Record<Topic, string> = {
  finance: 'Finance',
  ai: 'AI',
};

export const REGION_LABELS: Record<Region, string> = {
  global: 'Global',
  americas: 'Americas',
  europe: 'Europe',
  'asia-pacific': 'Asia-Pacific',
  'middle-east': 'Middle East',
};
