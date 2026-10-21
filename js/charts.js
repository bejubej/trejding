import { History } from './history.js';
import { state } from './app.js';

export const Charts = {
    render() {
        const history = History.get();
        if (history.length === 0) {
            if (state.charts.trend) state.charts.trend.destroy();
            if (state.charts.correlation) state.charts.correlation.destroy();
            return;
        }
        this.renderTrend(history);
        this.renderCorrelation(history);
    },

    renderTrend(history) {
        if (state.charts.trend) state.charts.trend.destroy();
        if (!state.dom.trendChart) return;

        let cumulative = 0;
        const cumulativeProfit = history.map(w => {
            cumulative += parseFloat(w.profit) || 0;
            return cumulative;
        });

        state.charts.trend = new Chart(state.dom.trendChart, {
            data: {
                labels: history.map((w, i) => `Tydz. ${i + 1}`),
                datasets: [
                    {
                        type: 'bar',
                        label: 'Zysk w tygodniu (R)',
                        data: history.map(w => parseFloat(w.profit) || 0),
                        backgroundColor: history.map(w => (parseFloat(w.profit) || 0) >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
                        yAxisID: 'y-profit',
                        order: 2
                    },
                    {
                        type: 'line',
                        label: '% Wykonania planu',
                        data: history.map(w => parseFloat(w.stats.percentage)),
                        borderColor: '#38bdf8',
                        backgroundColor: 'rgba(56, 189, 248, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y-percentage',
                        tension: 0.3,
                        order: 1
                    },
                    {
                        type: 'line',
                        label: 'Skumulowany Zysk (R)',
                        data: cumulativeProfit,
                        borderColor: '#10b981',
                        borderWidth: 3,
                        yAxisID: 'y-profit',
                        tension: 0.2,
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#f8fafc' } } },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
                    'y-percentage': {
                        type: 'linear',
                        position: 'left',
                        beginAtZero: true,
                        max: 100,
                        ticks: { color: '#38bdf8', callback: v => v + '%' },
                        grid: { color: '#334155' },
                        title: { display: true, text: '% Wykonania', color: '#38bdf8' }
                    },
                    'y-profit': {
                        type: 'linear',
                        position: 'right',
                        beginAtZero: false,
                        ticks: { color: '#10b981', callback: v => v + ' R' },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: 'Zysk w R', color: '#10b981' }
                    }
                }
            }
        });
    },

    renderCorrelation(history) {
        if (state.charts.correlation) state.charts.correlation.destroy();
        if (!state.dom.correlationChart) return;

        const scatterData = history.map((w, i) => ({
            x: parseFloat(w.stats.percentage),
            y: parseFloat(w.profit) || 0,
            label: `Tydz. ${i + 1}`
        }));

        state.charts.correlation = new Chart(state.dom.correlationChart, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Tygodnie (Dyscyplina vs Wynik)',
                    data: scatterData,
                    backgroundColor: '#4f46e5',
                    borderColor: '#818cf8',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#f8fafc' } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const raw = ctx.raw;
                                return `${raw.label}: ${raw.x}% Wykonania ➔ ${raw.y} R`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: 100,
                        title: { display: true, text: '% Wykonania Planu (Dyscyplina)', color: '#94a3b8' },
                        ticks: { color: '#94a3b8', callback: v => v + '%' },
                        grid: { color: '#334155' }
                    },
                    y: {
                        title: { display: true, text: 'Wynik Finansowy (Zysk R)', color: '#94a3b8' },
                        ticks: { color: '#94a3b8', callback: v => v + ' R' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    }
};