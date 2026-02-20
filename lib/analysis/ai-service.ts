'use server';

import type { TechnicalAnalysis } from './technical-indicators';

export type AIProvider = 'gemini' | 'deepseek' | 'openai';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

function getAvailableProviders(): AIConfig[] {
  const configs: AIConfig[] = [];
  if (process.env.GEMINI_API_KEY) {
    configs.push({
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-1.5-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    configs.push({
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/v1',
    });
  }
  if (process.env.OPENAI_API_KEY) {
    configs.push({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
    });
  }
  return configs;
}

async function callAI(prompt: string, config: AIConfig): Promise<string> {
  if (config.provider === 'gemini') {
    const res = await fetch(
      `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${config.provider} error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callWithFallback(prompt: string): Promise<string> {
  const providers = getAvailableProviders();
  if (providers.length === 0) return '未配置 AI 服务，请设置 GEMINI_API_KEY、DEEPSEEK_API_KEY 或 OPENAI_API_KEY。';
  for (const config of providers) {
    try {
      return await callAI(prompt, config);
    } catch {
      // 尝试下一个
    }
  }
  return 'AI 分析服务暂时不可用，请稍后重试。';
}

export async function generateStockAnalysis(data: {
  symbol: string;
  name: string;
  market: string;
  currentPrice: number;
  technicals: TechnicalAnalysis;
  news?: Array<{ title: string; summary?: string }>;
}): Promise<string> {
  const { symbol, name, market, currentPrice, technicals, news } = data;
  const t = technicals;

  const prompt = `你是专业的股票分析师，请对以下股票进行技术分析，用中文回答。

股票信息：${name}（${symbol}），市场：${market}，当前价格：${currentPrice}

技术指标：
- MA5: ${t.ma5?.toFixed(2) ?? 'N/A'}，MA10: ${t.ma10?.toFixed(2) ?? 'N/A'}，MA20: ${t.ma20?.toFixed(2) ?? 'N/A'}，MA60: ${t.ma60?.toFixed(2) ?? 'N/A'}
- RSI(14): ${t.rsi14?.toFixed(2) ?? 'N/A'}
- MACD: DIF=${t.macd?.DIF.toFixed(4) ?? 'N/A'}，DEA=${t.macd?.DEA.toFixed(4) ?? 'N/A'}，MACD=${t.macd?.MACD.toFixed(4) ?? 'N/A'}
- 布林带: 上轨=${t.bollinger?.upper.toFixed(2) ?? 'N/A'}，中轨=${t.bollinger?.middle.toFixed(2) ?? 'N/A'}，下轨=${t.bollinger?.lower.toFixed(2) ?? 'N/A'}
- KDJ: K=${t.kdj?.K.toFixed(2) ?? 'N/A'}，D=${t.kdj?.D.toFixed(2) ?? 'N/A'}，J=${t.kdj?.J.toFixed(2) ?? 'N/A'}
- 综合趋势：${t.trend === 'bullish' ? '看涨' : t.trend === 'bearish' ? '看跌' : '中性'}
- 系统信号：${t.signal}
${news?.length ? `\n近期新闻：\n${news.slice(0, 3).map(n => `- ${n.title}${n.summary ? '：' + n.summary : ''}`).join('\n')}` : ''}

请提供：1. 趋势判断 2. 关键支撑位和压力位 3. 操作建议 4. 风险提示。回答简洁专业，300字以内。`;

  return callWithFallback(prompt);
}

export async function generateMarketSummary(data: {
  indices: Array<{ name: string; current: number; change: number; changePercent: number }>;
  topMovers?: Array<{ symbol: string; name: string; changePercent: number }>;
  news?: Array<{ title: string }>;
}): Promise<string> {
  const { indices, topMovers, news } = data;

  const prompt = `你是专业的市场分析师，请对今日市场行情进行简要总结，用中文回答。

主要指数：
${indices.map(i => `- ${i.name}: ${i.current}（${i.change >= 0 ? '+' : ''}${i.change}，${i.changePercent >= 0 ? '+' : ''}${i.changePercent.toFixed(2)}%）`).join('\n')}
${topMovers?.length ? `\n涨跌幅较大个股：\n${topMovers.slice(0, 5).map(s => `- ${s.name}(${s.symbol}): ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%`).join('\n')}` : ''}
${news?.length ? `\n市场要闻：\n${news.slice(0, 3).map(n => `- ${n.title}`).join('\n')}` : ''}

请提供：1. 今日市场整体表现 2. 主要驱动因素 3. 明日展望。回答简洁，200字以内。`;

  return callWithFallback(prompt);
}
