'use server';

import { SinaProvider } from './sina-provider';
import { FinnhubProvider } from './finnhub-provider';
import type { DataProvider, StockQuote, MarketIndex } from './types';

export type { StockQuote, MarketIndex, DataProvider };

const providers: Record<string, DataProvider> = {
  CN: new SinaProvider(),
  US: new FinnhubProvider(),
};

export function getProvider(market: string): DataProvider | null {
  return providers[market.toUpperCase()] || null;
}

export async function getAllIndices(): Promise<MarketIndex[]> {
  const results = await Promise.allSettled(
    Object.values(providers).map(p => p.getIndices())
  );
  return results
    .filter((r): r is PromiseFulfilledResult<MarketIndex[]> => r.status === 'fulfilled')
    .flatMap(r => r.value);
}

export async function getMultiMarketQuote(symbol: string, market: string): Promise<StockQuote | null> {
  const provider = getProvider(market);
  if (!provider) return null;
  return provider.getQuote(symbol);
}
