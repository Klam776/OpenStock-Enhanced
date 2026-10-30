import TradingViewWidget from "@/components/TradingViewWidget";
import { CANDLE_CHART_WIDGET_CONFIG } from "@/lib/constants";
import { getAllIndices } from "@/lib/data-providers";
import type { MarketIndex } from "@/lib/data-providers/types";

const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

// Display order for the four headline A-share indices (Sina source).
const CN_INDEX_ORDER = ["000001", "399001", "399006", "000688"];

const CN_OVERVIEW_WIDGET_CONFIG = {
    colorTheme: 'dark',
    dateRange: '12M',
    locale: 'en',
    largeChartUrl: '',
    isTransparent: true,
    showFloatingTooltip: true,
    plotLineColorGrowing: '#0FEDBE',
    plotLineColorFalling: '#0FEDBE',
    gridLineColor: 'rgba(240, 243, 250, 0)',
    scaleFontColor: '#DBDBDB',
    belowLineFillColorGrowing: 'rgba(41, 98, 255, 0.12)',
    belowLineFillColorFalling: 'rgba(41, 98, 255, 0.12)',
    belowLineFillColorGrowingBottom: 'rgba(41, 98, 255, 0)',
    belowLineFillColorFallingBottom: 'rgba(41, 98, 255, 0)',
    symbolActiveColor: 'rgba(15, 237, 190, 0.05)',
    tabs: [
        {
            title: 'Indices',
            symbols: [
                { s: 'SSE:000001', d: '上证指数' },
                { s: 'SZSE:399001', d: '深证成指' },
                { s: 'SZSE:399006', d: '创业板指' },
                { s: 'SSE:000688', d: '科创50' },
                { s: 'SSE:000300', d: '沪深300' },
            ],
        },
        {
            title: 'Leaders',
            symbols: [
                { s: 'SSE:600519', d: '贵州茅台' },
                { s: 'SZSE:300750', d: '宁德时代' },
                { s: 'SSE:601318', d: '中国平安' },
                { s: 'SSE:600036', d: '招商银行' },
                { s: 'SZSE:000858', d: '五粮液' },
                { s: 'SZSE:002594', d: '比亚迪' },
            ],
        },
    ],
    support_host: 'https://www.tradingview.com',
    backgroundColor: '#141414',
    width: '100%',
    height: 600,
    showSymbolLogo: true,
    showChart: true,
};

const CN_QUOTES_WIDGET_CONFIG = {
    title: 'A-Share Leaders',
    width: '100%',
    height: 600,
    locale: 'en',
    showSymbolLogo: true,
    colorTheme: 'dark',
    isTransparent: false,
    backgroundColor: '#0F0F0F',
    symbolsGroups: [
        {
            name: 'A股龙头',
            symbols: [
                { name: 'SSE:600519', displayName: '贵州茅台' },
                { name: 'SZSE:300750', displayName: '宁德时代' },
                { name: 'SSE:601318', displayName: '中国平安' },
                { name: 'SSE:600036', displayName: '招商银行' },
                { name: 'SZSE:000858', displayName: '五粮液' },
                { name: 'SZSE:002594', displayName: '比亚迪' },
                { name: 'SSE:601899', displayName: '紫金矿业' },
                { name: 'SZSE:000333', displayName: '美的集团' },
                { name: 'SSE:600900', displayName: '长江电力' },
                { name: 'SZSE:000001', displayName: '平安银行' },
            ],
        },
    ],
};

export default async function CnMarketPage() {
    let indices: MarketIndex[] = [];
    try {
        const all = await getAllIndices();
        indices = CN_INDEX_ORDER
            .map((code) => all.find((i) => i.market === 'CN' && i.symbol === code))
            .filter((i): i is MarketIndex => Boolean(i));
    } catch {
        indices = [];
    }

    return (
        <div className="flex min-h-screen home-wrapper">
            <div className="w-full">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-100">A股市场</h1>
                    <p className="text-gray-500 mt-1">
                        China A-Share Market — 指数卡为新浪实时源，图表与行情表来自 TradingView。
                    </p>
                </div>

                {indices.length > 0 && (
                    <section className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                        {indices.map((idx) => {
                            const up = idx.change >= 0;
                            return (
                                <div
                                    key={idx.symbol}
                                    className="rounded-2xl border border-white/10 bg-white/5 p-5"
                                >
                                    <div className="text-gray-400 text-sm">{idx.name}</div>
                                    <div className="text-3xl font-bold text-gray-100 mt-2">
                                        {idx.current.toFixed(2)}
                                    </div>
                                    <div className={`mt-1 font-medium ${up ? 'text-red-500' : 'text-green-500'}`}>
                                        {up ? '+' : ''}
                                        {idx.change.toFixed(2)} ({up ? '+' : ''}
                                        {idx.changePercent.toFixed(2)}%)
                                    </div>
                                </div>
                            );
                        })}
                    </section>
                )}

                <section className="grid w-full gap-8 home-section">
                    <div className="md:col-span-1 xl:col-span-1">
                        <TradingViewWidget
                            title="Market Overview"
                            scriptUrl={`${scriptUrl}market-overview.js`}
                            config={CN_OVERVIEW_WIDGET_CONFIG}
                            className="custom-chart"
                            height={600}
                        />
                    </div>
                    <div className="md:col-span-1 xl:col-span-2">
                        <TradingViewWidget
                            title="上证指数 Shanghai Composite"
                            scriptUrl={`${scriptUrl}advanced-chart.js`}
                            config={CANDLE_CHART_WIDGET_CONFIG('SSE:000001')}
                            className="custom-chart"
                            height={600}
                        />
                    </div>
                </section>

                <section className="w-full mt-8">
                    <TradingViewWidget
                        title="A股龙头行情 Leaders"
                        scriptUrl={`${scriptUrl}market-quotes.js`}
                        config={CN_QUOTES_WIDGET_CONFIG}
                        height={600}
                    />
                </section>
            </div>
        </div>
    );
}
