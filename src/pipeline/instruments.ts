import type { InstrumentGroup } from '../lib/types';

export interface InstrumentConfig {
  /** Yahoo Finance chart symbol (primary source). */
  symbol: string;
  /** Stooq symbol for the fallback CSV, when Stooq carries it. */
  stooq?: string;
  name: string;
  group: InstrumentGroup;
  currency: string;
  /** Decimal places to show. */
  decimals: number;
  /** Price is a percentage (bond yields). */
  isYield?: boolean;
}

/** The Markets page shows groups in this order, instruments in list order within each group. */
export const INSTRUMENTS: InstrumentConfig[] = [
  { symbol: '^GSPC', stooq: '^spx', name: 'S&P 500', group: 'indices', currency: 'USD', decimals: 2 },
  { symbol: '^IXIC', stooq: '^ndq', name: 'Nasdaq Composite', group: 'indices', currency: 'USD', decimals: 2 },
  { symbol: '^DJI', stooq: '^dji', name: 'Dow Jones', group: 'indices', currency: 'USD', decimals: 2 },
  { symbol: '^FTSE', stooq: '^ukx', name: 'FTSE 100', group: 'indices', currency: 'GBP', decimals: 2 },
  { symbol: '^GDAXI', stooq: '^dax', name: 'DAX', group: 'indices', currency: 'EUR', decimals: 2 },
  { symbol: '^N225', stooq: '^nkx', name: 'Nikkei 225', group: 'indices', currency: 'JPY', decimals: 2 },
  { symbol: '^HSI', stooq: '^hsi', name: 'Hang Seng', group: 'indices', currency: 'HKD', decimals: 2 },
  { symbol: '000001.SS', stooq: '^shc', name: 'Shanghai Composite', group: 'indices', currency: 'CNY', decimals: 2 },
  { symbol: 'NVDA', stooq: 'nvda.us', name: 'Nvidia', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'MSFT', stooq: 'msft.us', name: 'Microsoft', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'GOOGL', stooq: 'googl.us', name: 'Alphabet', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'META', stooq: 'meta.us', name: 'Meta', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'AMZN', stooq: 'amzn.us', name: 'Amazon', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'TSM', stooq: 'tsm.us', name: 'TSMC', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'AVGO', stooq: 'avgo.us', name: 'Broadcom', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'AMD', stooq: 'amd.us', name: 'AMD', group: 'ai-stocks', currency: 'USD', decimals: 2 },
  { symbol: 'EURUSD=X', stooq: 'eurusd', name: 'EUR/USD', group: 'fx', currency: 'USD', decimals: 4 },
  { symbol: 'JPY=X', stooq: 'usdjpy', name: 'USD/JPY', group: 'fx', currency: 'JPY', decimals: 2 },
  { symbol: 'GBPUSD=X', stooq: 'gbpusd', name: 'GBP/USD', group: 'fx', currency: 'USD', decimals: 4 },
  { symbol: 'CNY=X', stooq: 'usdcny', name: 'USD/CNY', group: 'fx', currency: 'CNY', decimals: 4 },
  { symbol: 'GC=F', stooq: 'xauusd', name: 'Gold', group: 'commodities-rates', currency: 'USD', decimals: 2 },
  { symbol: 'BZ=F', stooq: 'cb.f', name: 'Brent crude', group: 'commodities-rates', currency: 'USD', decimals: 2 },
  { symbol: '^TNX', stooq: '10usy.b', name: 'US 10-year yield', group: 'commodities-rates', currency: '%', decimals: 3, isYield: true },
  { symbol: 'BTC-USD', stooq: 'btcusd', name: 'Bitcoin', group: 'crypto', currency: 'USD', decimals: 0 },
  { symbol: 'ETH-USD', stooq: 'ethusd', name: 'Ether', group: 'crypto', currency: 'USD', decimals: 2 },
];

export const GROUP_LABELS: Record<InstrumentGroup, string> = {
  indices: 'Stock indices',
  'ai-stocks': 'AI bellwethers',
  fx: 'Currencies',
  'commodities-rates': 'Commodities and rates',
  crypto: 'Crypto',
};
