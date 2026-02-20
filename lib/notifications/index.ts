'use server';

export type NotificationChannel =
  | 'email'
  | 'telegram'
  | 'wechat'
  | 'feishu'
  | 'dingtalk'
  | 'discord'
  | 'webhook';

export interface NotificationConfig {
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  error?: string;
}

const TIMEOUT = 10_000;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

async function sendTelegram(message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const res = await fetchWithTimeout(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    }
  );
  return res.ok;
}

async function sendWechat(title: string, content: string): Promise<boolean> {
  const pushplusToken = process.env.PUSHPLUS_TOKEN;
  if (pushplusToken) {
    const res = await fetchWithTimeout('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: pushplusToken, title, content, template: 'markdown' }),
    });
    return res.ok;
  }
  const serverchanKey = process.env.SERVERCHAN_KEY;
  if (serverchanKey) {
    const res = await fetchWithTimeout(
      `https://sctapi.ftqq.com/${serverchanKey}.send?title=${encodeURIComponent(title)}&desp=${encodeURIComponent(content)}`
    );
    return res.ok;
  }
  return false;
}

async function sendFeishu(title: string, content: string): Promise<boolean> {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title,
            content: [[{ tag: 'text', text: content }]],
          },
        },
      },
    }),
  });
  return res.ok;
}

async function sendDingtalk(title: string, content: string): Promise<boolean> {
  const url = process.env.DINGTALK_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { title, text: `## ${title}\n\n${content}` },
    }),
  });
  return res.ok;
}

async function sendDiscord(title: string, content: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [{ title, description: content }] }),
  });
  return res.ok;
}

async function sendWebhook(data: Record<string, unknown>): Promise<boolean> {
  const url = process.env.NOTIFICATION_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}

export function getEnabledChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) channels.push('telegram');
  if (process.env.PUSHPLUS_TOKEN || process.env.SERVERCHAN_KEY) channels.push('wechat');
  if (process.env.FEISHU_WEBHOOK_URL) channels.push('feishu');
  if (process.env.DINGTALK_WEBHOOK_URL) channels.push('dingtalk');
  if (process.env.DISCORD_WEBHOOK_URL) channels.push('discord');
  if (process.env.NOTIFICATION_WEBHOOK_URL) channels.push('webhook');
  return channels;
}

export async function notify(
  title: string,
  content: string,
  options?: { channels?: NotificationChannel[]; markdown?: boolean }
): Promise<NotificationResult[]> {
  const channels = options?.channels ?? getEnabledChannels();
  const message = options?.markdown ? `**${title}**\n\n${content}` : `${title}\n\n${content}`;

  const tasks = channels.map(async (channel): Promise<NotificationResult> => {
    try {
      let success = false;
      switch (channel) {
        case 'telegram': success = await sendTelegram(message); break;
        case 'wechat':   success = await sendWechat(title, content); break;
        case 'feishu':   success = await sendFeishu(title, content); break;
        case 'dingtalk': success = await sendDingtalk(title, content); break;
        case 'discord':  success = await sendDiscord(title, content); break;
        case 'webhook':  success = await sendWebhook({ title, content }); break;
        default:         success = false;
      }
      return { channel, success };
    } catch (err) {
      return { channel, success: false, error: String(err) };
    }
  });

  return Promise.all(tasks);
}

export async function notifyStockAlert(data: {
  symbol: string;
  name: string;
  condition: 'ABOVE' | 'BELOW';
  targetPrice: number;
  currentPrice: number;
}): Promise<NotificationResult[]> {
  const direction = data.condition === 'ABOVE' ? '突破' : '跌破';
  const title = `股票告警：${data.name}(${data.symbol}) ${direction} ${data.targetPrice}`;
  const content = `**${data.name}**（${data.symbol}）当前价格 **${data.currentPrice}** 已${direction}目标价 **${data.targetPrice}**。`;
  return notify(title, content, { markdown: true });
}

export async function notifyDailyReport(report: string): Promise<NotificationResult[]> {
  const title = `每日报告 ${new Date().toLocaleDateString('zh-CN')}`;
  const summary = report.length > 2000 ? report.slice(0, 2000) + '...' : report;
  return notify(title, summary, { markdown: true });
}
