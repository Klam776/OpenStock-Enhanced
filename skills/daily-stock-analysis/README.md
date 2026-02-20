# 🚀 OpenStock × OpenClaw 每日股票分析 Skill 安装指南

## 一、前置条件

- [OpenClaw](https://openclaw.ai) 已安装并运行
- Node.js 18+
- Finnhub API Key（免费获取：https://finnhub.io）

## 二、安装步骤

### 方式一：直接复制（推荐）

```bash
# 1. 复制 Skill 到 OpenClaw 工作空间
cp -r skills/daily-stock-analysis ~/.openclaw/workspace/skills/

# 2. 配置 API Key
# 编辑 ~/.openclaw/openclaw.json，添加以下配置（参考 openclaw.example.json）
```

### 方式二：从 ClawHub 安装（如已发布）

```bash
npx openclawskill install daily-stock-analysis
```

### 方式三：符号链接（开发模式）

```bash
ln -s $(pwd)/skills/daily-stock-analysis ~/.openclaw/workspace/skills/daily-stock-analysis
```

## 三、配置

### 3.1 必须配置

编辑 `~/.openclaw/openclaw.json`：

```json
{
  "skills": {
    "entries": {
      "daily-stock-analysis": {
        "enabled": true,
        "env": {
          "FINNHUB_API_KEY": "你的Finnhub API Key"
        }
      }
    }
  }
}
```

### 3.2 可选配置

```json
{
  "skills": {
    "entries": {
      "daily-stock-analysis": {
        "enabled": true,
        "env": {
          "FINNHUB_API_KEY": "your-key",
          "AKSHARE_ENABLED": "true"
        },
        "config": {
          "markets": ["cn", "us", "hk"],
          "watchlist_cn": ["600519", "000858"],
          "watchlist_us": ["AAPL", "NVDA", "TSLA"],
          "notification_channels": ["telegram"],
          "report_language": "zh-CN",
          "schedule": "30 8 * * 1-5",
          "timezone": "Asia/Shanghai"
        }
      }
    }
  }
}
```

### 3.3 配置 Telegram 通知（可选）

```bash
# 在 OpenClaw 中配置 Telegram
openclaw provider add telegram --token "YOUR_BOT_TOKEN"
```

## 四、使用方法

### 4.1 手动触发

通过任意 OpenClaw 连接的消息渠道发送：

```
/stock-report              # 全市场分析
/stock-report AAPL,TSLA    # 仅分析指定美股
/stock-report --market=cn  # 仅分析A股
/stock-report --deep 600519 # 深度分析贵州茅台
```

### 4.2 自动定时执行

Skill 已配置 Cron 定时任务（工作日早 8:30），也可手动添加：

```bash
openclaw cron add \
  --name "每日股票分析" \
  --cron "30 8 * * 1-5" \
  --tz "Asia/Shanghai" \
  --session isolated \
  --message "运行 daily-stock-analysis skill，生成今日市场分析报告" \
  --announce \
  --channel telegram
```

### 4.3 通过 Webhook 触发

```bash
curl -X POST http://localhost:18789/hooks/agent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "执行 /stock-report --market=all",
    "model": "opus",
    "channel": "telegram",
    "deliver": "announce"
  }'
```

## 五、报告存储

- 报告路径：`~/.openclaw/shared/stock-reports/daily-report-YYYY-MM-DD.md`
- 原始数据：`~/.openclaw/shared/stock-reports/market-data-YYYY-MM-DD.json`
- 自动清理 30 天前的报告

## 六、数据来源

| 数据源 | 覆盖市场 | 费用 | 说明 |
|--------|---------|------|------|
| Finnhub | 美股 | 免费层 60次/分钟 | 实时报价、公司资料、新闻 |
| 新浪财经 | A股 | 免费 | 实时行情（非官方接口） |
| AkShare | A/港/美股 | 免费 | 需 Python 环境 |
| MarketWatch RSS | 全球 | 免费 | 财经新闻 |
| CNBC RSS | 全球 | 免费 | 财经新闻 |
| 东方财富 RSS | A股 | 免费 | 通过 RSSHub |
| 财联社 RSS | A股 | 免费 | 通过 RSSHub |

## 七、故障排除

### 常见问题

**Q: 报告中缺少 A 股数据**
A: 新浪财经接口可能需要从中国大陆网络访问，或配置代理

**Q: Finnhub API 返回空数据**
A: 检查 API Key 是否正确，免费层有速率限制（60次/分钟）

**Q: 定时任务未执行**
A: 确保 OpenClaw 服务在后台运行：`openclaw status`

**Q: 想添加更多股票到监控列表**
A: 修改 `openclaw.json` 中的 `watchlist_cn`/`watchlist_us` 数组

## 八、相关资源

### 类似项目参考
- [daily_stock_analysis](https://github.com/ZhuLinsen/daily_stock_analysis) - 12.1k⭐ AI 驱动股票分析
- [FinceptTerminal](https://github.com/Fincept-Corporation/FinceptTerminal) - 2.6k⭐ 专业金融终端
- [zvt](https://github.com/zvtvz/zvt) - 4k⭐ 量化交易框架
- [qlib](https://github.com/microsoft/qlib) - 37.6k⭐ 微软 AI 量化平台

### 数据 API 文档
- [Finnhub 文档](https://finnhub.io/docs/api)
- [AkShare 文档](https://akshare.akfamily.xyz)
- [Tushare Pro 文档](https://tushare.pro/document/2)

### 量化社区
- [聚宽](https://www.joinquant.com) - 国内量化平台
- [QuantConnect](https://www.quantconnect.com) - 国际量化平台
- [r/algotrading](https://www.reddit.com/r/algotrading) - Reddit 算法交易社区
