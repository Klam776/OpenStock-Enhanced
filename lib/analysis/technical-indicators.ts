'use server';

export function calculateMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function calculateRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  const changes = prices.slice(-period - 1).map((p, i, arr) => i === 0 ? 0 : p - arr[i - 1]).slice(1);
  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? -c : 0);
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { DIF: number; DEA: number; MACD: number } | null {
  if (prices.length < slowPeriod + signalPeriod) return null;

  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  const fastEMA = ema(prices, fastPeriod);
  const slowEMA = ema(prices, slowPeriod);
  const dif = fastEMA.map((v, i) => v - slowEMA[i]).slice(slowPeriod - 1);
  const dea = ema(dif, signalPeriod);
  const last = dea.length - 1;
  return {
    DIF: dif[dif.length - 1],
    DEA: dea[last],
    MACD: (dif[dif.length - 1] - dea[last]) * 2,
  };
}

export function calculateBollinger(
  prices: number[],
  period = 20,
  multiplier = 2
): { upper: number; middle: number; lower: number } | null {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period);
  return { upper: middle + multiplier * std, middle, lower: middle - multiplier * std };
}

export function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 9
): { K: number; D: number; J: number } | null {
  if (closes.length < period) return null;
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const close = closes[closes.length - 1];
  const rsv = highestHigh === lowestLow ? 50 : ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
  const K = rsv * (1 / 3) + 50 * (2 / 3);
  const D = K * (1 / 3) + 50 * (2 / 3);
  return { K, D, J: 3 * K - 2 * D };
}

export interface TechnicalAnalysis {
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  ma60: number | null;
  rsi14: number | null;
  macd: { DIF: number; DEA: number; MACD: number } | null;
  bollinger: { upper: number; middle: number; lower: number } | null;
  kdj: { K: number; D: number; J: number } | null;
  trend: 'bullish' | 'bearish' | 'neutral';
  signal: string;
}

export function analyzeTechnicals(
  prices: number[],
  highs?: number[],
  lows?: number[]
): TechnicalAnalysis {
  const ma5 = calculateMA(prices, 5);
  const ma10 = calculateMA(prices, 10);
  const ma20 = calculateMA(prices, 20);
  const ma60 = calculateMA(prices, 60);
  const rsi14 = calculateRSI(prices);
  const macd = calculateMACD(prices);
  const bollinger = calculateBollinger(prices);
  const kdj = highs && lows ? calculateKDJ(highs, lows, prices) : null;

  const current = prices[prices.length - 1];
  let bullishCount = 0;
  let bearishCount = 0;

  if (ma5 && ma20) { ma5 > ma20 ? bullishCount++ : bearishCount++; }
  if (current && ma20) { current > ma20 ? bullishCount++ : bearishCount++; }
  if (rsi14) { rsi14 > 50 ? bullishCount++ : bearishCount++; }
  if (macd) { macd.MACD > 0 ? bullishCount++ : bearishCount++; }

  const trend: TechnicalAnalysis['trend'] =
    bullishCount > bearishCount + 1 ? 'bullish' :
    bearishCount > bullishCount + 1 ? 'bearish' : 'neutral';

  let signal = '持有观望';
  if (rsi14 && rsi14 < 30 && trend !== 'bearish') signal = '超卖，考虑买入';
  else if (rsi14 && rsi14 > 70 && trend !== 'bullish') signal = '超买，考虑卖出';
  else if (trend === 'bullish' && macd && macd.MACD > 0) signal = '趋势向上，可考虑买入';
  else if (trend === 'bearish' && macd && macd.MACD < 0) signal = '趋势向下，建议减仓';

  return { ma5, ma10, ma20, ma60, rsi14, macd, bollinger, kdj, trend, signal };
}
