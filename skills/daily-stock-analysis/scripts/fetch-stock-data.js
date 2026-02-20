#!/usr/bin/env node

/**
 * OpenStock Daily Stock Data Fetcher
 *
 * 获取 A股/美股/港股 市场数据，供 OpenClaw Skill 使用
 *
 * 用法：
 *   node fetch-stock-data.js --market=cn     # A股数据
 *   node fetch-stock-data.js --market=us     # 美股数据
 *   node fetch-stock-data.js --market=hk     # 港股数据
 *   node fetch-stock-data.js --market=all    # 全部市场
 *   node fetch-stock-data.js --symbols=AAPL,TSLA  # 指定股票
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ============== 配置 ==============

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(
  process.env.HOME || '/root',
  '.openclaw', 'shared', 'stock-reports'
);

// A 股热门股票
const CN_WATCHLIST = [
  { symbol: '000001', name: '上证指数', type: 'index' },
  { symbol: '399001', name: '深证成指', type: 'index' },
  { symbol: '399006', name: '创业板指', type: 'index' },
  { symbol: '000688', name: '科创50', type: 'index' },
  { symbol: '600519', name: '贵州茅台', type: 'stock' },
  { symbol: '000858', name: '五粮液', type: 'stock' },
  { symbol: '601318', name: '中国平安', type: 'stock' },
  { symbol: '600036', name: '招商银行', type: 'stock' },
  { symbol: '000333', name: '美的集团', type: 'stock' },
  { symbol: '002594', name: '比亚迪', type: 'stock' },
];

// 美股热门股票
const US_WATCHLIST = [
  { symbol: '^DJI', name: '道琼斯工业平均指数', type: 'index' },
  { symbol: '^GSPC', name: '标普500指数', type: 'index' },
  { symbol: '^IXIC', name: '纳斯达克综合指数', type: 'index' },
  { symbol: 'AAPL', name: 'Apple', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla', type: 'stock' },
  { symbol: 'META', name: 'Meta', type: 'stock' },
];

// 港股热门股票
const HK_WATCHLIST = [
  { symbol: 'HSI', name: '恒生指数', type: 'index' },
  { symbol: 'HSTECH', name: '恒生科技指数', type: 'index' },
  { symbol: '00700', name: '腾讯控股', type: 'stock' },
  { symbol: '09988', name: '阿里巴巴', type: 'stock' },
  { symbol: '03690', name: '美团', type: 'stock' },
  { symbol: '09888', name: '百度', type: 'stock' },
];

// ============== HTTP 工具 ==============

function httpGet(url, headers = {}, rawBuffer = false) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers, timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const data = rawBuffer ? buffer : buffer.toString('utf-8');
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          const errMsg = rawBuffer ? buffer.toString('utf-8').substring(0, 200) : data.substring(0, 200);
          reject(new Error(`HTTP ${res.statusCode}: ${errMsg}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

function decodeGBK(buffer) {
  try {
    const decoder = new TextDecoder('gbk');
    return decoder.decode(buffer);
  } catch {
    return buffer.toString('utf-8');
  }
}

// ============== Finnhub API（美股）==============

async function fetchFinnhubQuote(symbol) {
  if (!FINNHUB_API_KEY) {
    return { symbol, error: 'FINNHUB_API_KEY not set' };
  }
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const res = await httpGet(url);
    const data = JSON.parse(res.data);
    return {
      symbol,
      current: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      timestamp: data.t,
    };
  } catch (err) {
    return { symbol, error: err.message };
  }
}

async function fetchFinnhubCompanyProfile(symbol) {
  if (!FINNHUB_API_KEY) return null;
  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    const res = await httpGet(url);
    return JSON.parse(res.data);
  } catch {
    return null;
  }
}

async function fetchFinnhubNews(category = 'general') {
  if (!FINNHUB_API_KEY) return [];
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const url = `https://finnhub.io/api/v1/news?category=${category}&minId=0&token=${FINNHUB_API_KEY}`;
    const res = await httpGet(url);
    const news = JSON.parse(res.data);
    return news.slice(0, 10).map(n => ({
      title: n.headline,
      summary: n.summary,
      source: n.source,
      url: n.url,
      datetime: new Date(n.datetime * 1000).toISOString(),
    }));
  } catch {
    return [];
  }
}

// ============== 新浪财经 API（A股实时）==============

async function fetchSinaQuote(symbols) {
  const results = [];
  for (const item of symbols) {
    try {
      // 确定交易所前缀：上交所(sh) vs 深交所(sz)
      // 上交所指数：000001(上证综指)、000688(科创50) 等以 000 开头
      // 上交所股票：6 开头
      // 深交所指数：399xxx
      // 深交所股票：0、3 开头
      const isShanghai = item.symbol.startsWith('6') ||
        (item.type === 'index' && !item.symbol.startsWith('399'));
      const prefix = isShanghai ? 'sh' : 'sz';
      const sinaSymbol = item.type === 'index'
        ? `s_${prefix}${item.symbol}`
        : `${prefix}${item.symbol}`;

      const url = `https://hq.sinajs.cn/list=${sinaSymbol}`;
      const res = await httpGet(url, { Referer: 'https://finance.sina.com.cn' }, true);
      const decoded = decodeGBK(res.data);

      const match = decoded.match(/"(.+)"/);
      if (match) {
        const parts = match[1].split(',');
        if (item.type === 'index') {
          // 指数格式：名称,当前点数,涨跌点,涨跌幅,成交量(手),成交额(万元)
          results.push({
            symbol: item.symbol,
            name: parts[0] || item.name,
            current: parseFloat(parts[1]),
            change: parseFloat(parts[2]),
            changePercent: parseFloat(parts[3]),
            volume: parts[4],
            amount: parts[5],
            type: 'index',
          });
        } else {
          // 股票格式：名称,今开,昨收,当前价,最高,最低,...,成交量,成交额,...
          results.push({
            symbol: item.symbol,
            name: parts[0] || item.name,
            open: parseFloat(parts[1]),
            previousClose: parseFloat(parts[2]),
            current: parseFloat(parts[3]),
            high: parseFloat(parts[4]),
            low: parseFloat(parts[5]),
            volume: parts[8],
            amount: parts[9],
            change: parseFloat(parts[3]) - parseFloat(parts[2]),
            changePercent: ((parseFloat(parts[3]) - parseFloat(parts[2])) / parseFloat(parts[2]) * 100).toFixed(2),
            type: 'stock',
          });
        }
      }
    } catch (err) {
      results.push({ symbol: item.symbol, name: item.name, error: err.message });
    }
  }
  return results;
}

// ============== 新浪财经 API（港股实时）==============

async function fetchSinaHKQuote(symbols) {
  const results = [];
  for (const item of symbols) {
    try {
      const code = item.type === 'index'
        ? `rt_hk${item.symbol}`
        : `rt_hk${item.symbol.padStart(5, '0')}`;
      const url = `https://hq.sinajs.cn/list=${code}`;
      const res = await httpGet(url, { Referer: 'https://finance.sina.com.cn' }, true);
      const decoded = decodeGBK(res.data);
      const match = decoded.match(/"(.+)"/);
      if (match) {
        const parts = match[1].split(',');
        if (parts.length >= 14) {
          const current = parseFloat(parts[6]);
          const prev = parseFloat(parts[3]);
          if (current && prev) {
            results.push({
              symbol: item.symbol,
              name: parts[1] || item.name,
              current,
              open: parseFloat(parts[2]),
              high: parseFloat(parts[4]),
              low: parseFloat(parts[5]),
              previousClose: prev,
              change: parseFloat((current - prev).toFixed(3)),
              changePercent: parseFloat((((current - prev) / prev) * 100).toFixed(2)),
              volume: parts[12],
              amount: parts[11],
              type: item.type,
            });
          }
        }
      }
    } catch (err) {
      results.push({ symbol: item.symbol, name: item.name, error: err.message });
    }
  }
  return results;
}

// ============== 东方财富 API（A股备用）==============

async function fetchEastMoneyIndices() {
  try {
    const url = 'https://push2delay.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f2,f3,f4,f12,f14&secids=1.000001,0.399001,0.399006,1.000688';
    const res = await httpGet(url, { Referer: 'https://www.eastmoney.com' });
    const data = JSON.parse(res.data);
    return (data.data?.diff ?? []).map(d => ({
      symbol: d.f12,
      name: d.f14,
      current: d.f2,
      change: d.f4,
      changePercent: d.f3,
      type: 'index',
    }));
  } catch {
    return [];
  }
}

async function fetchEastMoneyQuote(symbol) {
  try {
    const secid = symbol.startsWith('6') || symbol === '000001' ? `1.${symbol}` : `0.${symbol}`;
    const url = `https://push2delay.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170`;
    const res = await httpGet(url, { Referer: 'https://www.eastmoney.com' });
    const d = JSON.parse(res.data).data;
    if (!d || !d.f43) return null;
    return {
      symbol: d.f57,
      name: d.f58,
      current: d.f43 / 100,
      open: d.f46 / 100,
      high: d.f44 / 100,
      low: d.f45 / 100,
      previousClose: d.f60 / 100,
      change: d.f169 / 100,
      changePercent: d.f170 / 100,
      volume: d.f47,
      amount: d.f48,
      type: 'stock',
    };
  } catch {
    return null;
  }
}

// ============== RSS 新闻获取 ==============

async function fetchRSSNews(feedUrl, source) {
  try {
    const res = await httpGet(feedUrl);
    const items = [];
    // 简单 XML 解析（提取 title 和 link）
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;

    let match;
    let count = 0;
    while ((match = itemRegex.exec(res.data)) && count < 5) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(titleRegex);
      const linkMatch = itemXml.match(linkRegex);

      if (titleMatch) {
        items.push({
          title: titleMatch[1] || titleMatch[2],
          url: linkMatch ? linkMatch[1] : '',
          source,
        });
        count++;
      }
    }
    return items;
  } catch {
    return [];
  }
}

// ============== 技术指标计算 ==============

function calculateMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (prices.length < slowPeriod) return null;

  // 简化 EMA 计算
  function ema(data, period) {
    const k = 2 / (period + 1);
    let result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  const fastEMA = ema(prices, fastPeriod);
  const slowEMA = ema(prices, slowPeriod);
  const dif = fastEMA.map((v, i) => v - slowEMA[i]);
  const dea = ema(dif.slice(slowPeriod - 1), signalPeriod);

  const lastDIF = dif[dif.length - 1];
  const lastDEA = dea[dea.length - 1];

  return {
    DIF: lastDIF.toFixed(2),
    DEA: lastDEA.toFixed(2),
    MACD: ((lastDIF - lastDEA) * 2).toFixed(2),
  };
}

function calculateBollinger(prices, period = 20, multiplier = 2) {
  if (prices.length < period) return null;

  const slice = prices.slice(-period);
  const ma = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - ma, 2), 0) / period);

  return {
    upper: (ma + multiplier * std).toFixed(2),
    middle: ma.toFixed(2),
    lower: (ma - multiplier * std).toFixed(2),
  };
}

// ============== 报告生成 ==============

function generateReport(marketData, news, date) {
  const lines = [];

  lines.push(`# 📊 每日股票分析报告 - ${date}`);
  lines.push('');
  lines.push(`> 生成时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} (CST)`);
  lines.push('');

  // 市场概览
  lines.push('## 🌍 市场概览');
  lines.push('');

  for (const [market, data] of Object.entries(marketData)) {
    if (!data || data.length === 0) continue;

    const marketNames = { cn: 'A 股市场', us: '美股市场', hk: '港股市场' };
    lines.push(`### ${marketNames[market] || market}`);
    lines.push('');

    // 指数表
    const indices = data.filter(d => d.type === 'index' && !d.error);
    if (indices.length > 0) {
      lines.push('| 指数 | 最新价 | 涨跌额 | 涨跌幅 |');
      lines.push('|------|--------|--------|--------|');
      for (const idx of indices) {
        const sign = idx.change >= 0 ? '+' : '';
        const emoji = idx.change >= 0 ? '🟢' : '🔴';
        lines.push(`| ${emoji} ${idx.name || idx.symbol} | ${idx.current} | ${sign}${idx.change} | ${sign}${idx.changePercent}% |`);
      }
      lines.push('');
    }

    // 个股表
    const stocks = data.filter(d => d.type === 'stock' && !d.error);
    if (stocks.length > 0) {
      lines.push('| 股票 | 代码 | 最新价 | 涨跌幅 |');
      lines.push('|------|------|--------|--------|');
      for (const s of stocks) {
        const sign = s.change >= 0 ? '+' : '';
        const emoji = s.change >= 0 ? '🟢' : '🔴';
        lines.push(`| ${emoji} ${s.name} | ${s.symbol} | ${s.current} | ${sign}${s.changePercent}% |`);
      }
      lines.push('');
    }
  }

  // 新闻
  if (news && news.length > 0) {
    lines.push('## 📰 重要新闻');
    lines.push('');
    for (const n of news) {
      lines.push(`- **${n.title}** — ${n.source}`);
      if (n.url) lines.push(`  [阅读全文](${n.url})`);
    }
    lines.push('');
  }

  // 免责声明
  lines.push('---');
  lines.push('');
  lines.push('> ⚠️ **免责声明**：本报告由 AI 自动生成，仅供参考，不构成任何投资建议。');
  lines.push('> 投资有风险，入市须谨慎。请根据自身风险承受能力做出投资决策。');
  lines.push('');
  lines.push('> 📊 **数据来源**：Finnhub API, 新浪财经, MarketWatch, CNBC, 东方财富, 财联社');
  lines.push(`> 🤖 **Powered by**: [OpenStock](https://github.com/Open-Dev-Society/OpenStock) + [OpenClaw](https://openclaw.ai)`);

  return lines.join('\n');
}

// ============== 主流程 ==============

async function main() {
  const args = process.argv.slice(2);
  const marketArg = args.find(a => a.startsWith('--market='));
  const symbolsArg = args.find(a => a.startsWith('--symbols='));

  const market = marketArg ? marketArg.split('=')[1] : 'all';
  const customSymbols = symbolsArg ? symbolsArg.split('=')[1].split(',') : null;

  console.log(`🚀 OpenStock 数据获取开始...`);
  console.log(`📅 日期：${new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`🎯 市场：${market}`);

  const marketData = {};
  const allNews = [];

  // 并行获取数据
  const tasks = [];

  if (market === 'all' || market === 'cn') {
    tasks.push(
      fetchSinaQuote(CN_WATCHLIST).then(data => { marketData.cn = data; })
        .catch(err => { console.error('A股数据获取失败:', err.message); marketData.cn = []; })
    );
  }

  if (market === 'all' || market === 'us') {
    tasks.push(
      Promise.all(
        US_WATCHLIST.filter(s => s.type === 'stock').map(s => fetchFinnhubQuote(s.symbol))
      ).then(data => {
        marketData.us = data.map((d, i) => ({
          ...d,
          name: US_WATCHLIST.filter(s => s.type === 'stock')[i].name,
          type: 'stock',
        }));
      }).catch(err => { console.error('美股数据获取失败:', err.message); marketData.us = []; })
    );
  }

  if (market === 'all' || market === 'hk') {
    tasks.push(
      fetchSinaHKQuote(HK_WATCHLIST).then(data => { marketData.hk = data; })
        .catch(err => { console.error('港股数据获取失败:', err.message); marketData.hk = []; })
    );
  }

  // 新闻获取
  tasks.push(
    Promise.all([
      fetchFinnhubNews('general'),
      fetchRSSNews('https://feeds.marketwatch.com/marketwatch/topstories/', 'MarketWatch'),
    ]).then(([finnhubNews, mwNews]) => {
      allNews.push(...finnhubNews, ...mwNews);
    }).catch(() => {})
  );

  await Promise.all(tasks);

  // 生成报告
  const date = new Date().toISOString().split('T')[0];
  const report = generateReport(marketData, allNews, date);

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 保存报告
  const reportPath = path.join(OUTPUT_DIR, `daily-report-${date}.md`);
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`✅ 报告已生成：${reportPath}`);

  // 保存原始数据（JSON）
  const dataPath = path.join(OUTPUT_DIR, `market-data-${date}.json`);
  fs.writeFileSync(dataPath, JSON.stringify({ marketData, news: allNews, date }, null, 2), 'utf-8');
  console.log(`📦 原始数据：${dataPath}`);

  // 清理 30 天前的报告
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const filePath = path.join(OUTPUT_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ 清理旧文件：${file}`);
      }
    }
  } catch {}

  // 输出摘要到 stdout（供 OpenClaw 读取）
  console.log('\n--- 报告摘要 ---');
  console.log(report.substring(0, 2000));

  return { reportPath, dataPath, marketData, news: allNews };
}

main().catch(err => {
  console.error('❌ 执行失败:', err);
  process.exit(1);
});
