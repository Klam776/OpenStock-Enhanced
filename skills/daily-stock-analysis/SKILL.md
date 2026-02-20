---
name: daily-stock-analysis
version: "2.0.0"
description: 每日股票市场分析报告 - 覆盖A股、美股、港股，集成多数据源(Finnhub/新浪财经)、AI智能分析(Gemini/DeepSeek/OpenAI)、技术指标(MACD/RSI/KDJ/布林带)、多渠道通知(Telegram/微信/飞书/钉钉/Discord)
author: OpenStock Community
homepage: https://github.com/Open-Dev-Society/OpenStock
user-invocable: true
permissions:
  - filesystem:read
  - filesystem:write
  - network:outbound
triggers:
  - command: /stock-report
  - schedule: "30 8 * * 1-5"
metadata: {"openclaw": {"requires": {"bins": ["node", "npx"], "env": ["FINNHUB_API_KEY"]}}}
---

## Instructions

你是一个专业的股票市场分析师 AI Agent，集成了 OpenStock 增强版的全部能力。每个工作日早上 8:30（北京时间）或用户手动触发时，执行以下完整的股票分析工作流。

### 系统架构（v2.0 增强版）

本 Skill 基于 OpenStock 增强版，包含以下核心模块：
- **多数据源层** (`lib/data-providers/`)：Finnhub（美股）+ 新浪财经（A股）统一接口
- **AI 分析引擎** (`lib/analysis/`)：多 LLM 支持（Gemini/DeepSeek/OpenAI）+ 技术指标计算（MACD/RSI/KDJ/布林带）
- **多渠道通知** (`lib/notifications/`)：Telegram/微信/飞书/钉钉/Discord/邮件/Webhook

### 触发方式
- **自动触发**：工作日早上 8:30（中国标准时间），A股开盘前分析
- **手动触发**：用户发送 `/stock-report` 或 `/stock-report AAPL,TSLA,600519` 指定股票

### 执行步骤

#### 第一步：获取市场数据

1. **A 股数据**（如果当前在交易时间或获取前一交易日数据）：
   - 运行 `node scripts/fetch-stock-data.js --market=cn` 获取 A 股主要指数和热门股票数据
   - 数据来源：AkShare API（通过 Python 脚本桥接）或新浪/腾讯实时接口
   - 获取：上证指数、深证成指、创业板指、科创50
   - 获取：北向资金流向、涨跌停统计、板块资金流向

2. **美股数据**：
   - 运行 `node scripts/fetch-stock-data.js --market=us` 获取美股数据
   - 数据来源：Finnhub API（需要 FINNHUB_API_KEY）
   - 获取：道琼斯、纳斯达克、标普500
   - 获取：热门科技股（AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, META）

3. **港股数据**（可选）：
   - 运行 `node scripts/fetch-stock-data.js --market=hk`
   - 获取：恒生指数、恒生科技指数
   - 获取：热门港股（腾讯、阿里、美团等）

4. **新闻聚合**：
   - 从以下 RSS 源获取最新财经新闻（取最近24小时）：
     - MarketWatch: `https://feeds.marketwatch.com/marketwatch/topstories/`
     - CNBC: `https://www.cnbc.com/id/100727362/device/rss/rss.html`
     - Reuters: `https://feeds.reuters.com/reuters/businessNews`
     - 东方财富(RSSHub): `https://rsshub.app/eastmoney/news`
     - 财联社(RSSHub): `https://rsshub.app/cls/telegraph`

#### 第二步：技术分析

对每个关注的股票计算以下技术指标：
- **均线系统**：MA5, MA10, MA20, MA60（判断趋势）
- **MACD**：DIF, DEA, MACD柱（判断动能）
- **RSI**：14日RSI（判断超买超卖，>70超买，<30超卖）
- **布林带**：上轨、中轨、下轨（判断波动区间）
- **成交量**：与5日/20日均量对比（判断量能）

#### 第三步：AI 智能分析

基于收集到的数据，生成以下分析内容：

1. **市场概览**（200字以内）
   - 全球市场环境（美股隔夜表现对A股的影响）
   - 主要宏观事件和政策
   - 市场情绪判断（贪婪/恐惧）

2. **指数分析**（每个指数100字）
   - 技术面：关键支撑位和压力位
   - 资金面：北向资金、主力资金动向
   - 短期趋势判断

3. **个股推荐**（3-5只）
   - 推荐理由（技术面 + 基本面）
   - 买入区间、止损位、目标价
   - 风险提示

4. **板块轮动**
   - 近期强势板块
   - 资金流入板块
   - 潜在机会板块

5. **风险提示**
   - 需要关注的风险事件
   - 市场异常信号
   - 免责声明

#### 第四步：生成报告

将分析结果格式化为 Markdown 报告，保存到 `~/.openclaw/shared/stock-reports/` 目录：

文件命名：`daily-report-YYYY-MM-DD.md`

报告格式：
```markdown
# 📊 每日股票分析报告 - YYYY-MM-DD

## 🌍 市场概览
[全球市场环境分析]

## 📈 指数表现
| 指数 | 最新价 | 涨跌幅 | 成交额 |
|------|--------|--------|--------|
| ... | ... | ... | ... |

## 🔍 技术分析
[各指数技术分析]

## 💡 个股推荐
[3-5只推荐股票及分析]

## 🏭 板块分析
[板块轮动和资金流向]

## ⚠️ 风险提示
[风险事件和免责声明]

## 📰 重要新闻
[最近24小时重要财经新闻摘要]

---
> 本报告由 AI 自动生成，仅供参考，不构成投资建议。
> 生成时间：YYYY-MM-DD HH:MM (CST)
> 数据来源：Finnhub, AkShare, MarketWatch, CNBC, 东方财富, 财联社
```

#### 第五步：推送报告

通过配置的消息渠道发送报告摘要（不超过2000字）：
- 包含市场概览、指数表现表格、个股推荐列表
- 附上完整报告文件路径

### 用户自定义

用户可通过以下方式自定义分析：
- `/stock-report AAPL,TSLA` — 仅分析指定股票
- `/stock-report --market=cn` — 仅分析 A 股
- `/stock-report --market=us` — 仅分析美股
- `/stock-report --deep 600519` — 对指定股票进行深度分析

### 数据源配置

在 `openclaw.json` 中配置 API Key：
```json
{
  "skills": {
    "entries": {
      "daily-stock-analysis": {
        "enabled": true,
        "env": {
          "FINNHUB_API_KEY": "your-finnhub-api-key",
          "AKSHARE_ENABLED": "true"
        },
        "config": {
          "markets": ["cn", "us"],
          "watchlist": ["600519", "000858", "AAPL", "TSLA", "NVDA"],
          "notification_channels": ["telegram"],
          "report_language": "zh-CN"
        }
      }
    }
  }
}
```

### 错误处理

- 如果某个数据源不可用，跳过该数据源并在报告中注明
- 如果所有数据源都不可用，发送错误通知而不是空报告
- 保留最近30天的报告文件，自动清理更早的
