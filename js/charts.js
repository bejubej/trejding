import { History } from './history.js';
import { state } from './app.js';

export const Charts = {
  render() {
    const history = History.get();
    if (!history || history.length === 0) {
      if (state.charts.trend) { state.charts.trend.destroy(); state.charts.trend = null; }
      if (state.charts.correlation) { state.charts.correlation.destroy(); state.charts.correlation = null; }
      return;
    }
    this.renderTrend(history);
    this.renderCorrelation(history);
  },

  renderTrend(history) {
    if (state.charts.trend) {
      state.charts.trend.destroy();
      state.charts.trend = null;
    }
    const canvas = document.querySelector('[data-chart="trend"]');
    if (!canvas) return;

    let cumulative = 0;
    const cumulativeProfit = history.map(w => {
      cumulative += parseFloat(w.profit) || 0;
      return cumulative;
    });

    try {
      state.charts.trend = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: history.map((w, i) => `Tydz. ${i + 1}`),
          datasets: [
            {
              type: 'bar',
              label: 'Zysk w tygodniu (R)',
              data: history.map(w => parseFloat(w.profit) || 0),
              backgroundColor: history.map(w => (parseFloat(w.profit) || 0) >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
              yAxisID: 'yProfit',
              order: 2
            },
            {
              type: 'line',
              label: '% Wykonania planu',
              data: history.map(w => parseFloat(w.stats ? w.stats.percentage : 0)),
              borderColor: '#38bdf8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              borderWidth: 2,
              yAxisID: 'yPerc',
              tension: 0.3,
              order: 1
            },
            {
              type: 'line',
              label: 'Skumulowany Zysk (R)',
              data: cumulativeProfit,
              borderColor: '#10b981',
              borderWidth: 3,
              yAxisID: 'yProfit',
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
            yPerc: {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
              max: 100,
              ticks: { color: '#38bdf8', callback: v => v + '%' },
              grid: { color: '#334155' },
              title: { display: true, text: '% Wykonania', color: '#38bdf8' }
            },
            yProfit: {
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
    } catch (e) {
      console.error("Chart trend error:", e);
    }
  },

  renderCorrelation(history) {
    if (state.charts.correlation) {
      state.charts.correlation.destroy();
      state.charts.correlation = null;
    }
    const canvas = document.querySelector('[data-chart="correlation"]');
    if (!canvas) return;

    const scatterData = history.map((w, i) => ({
      x: parseFloat(w.stats ? w.stats.percentage : 0),
      y: parseFloat(w.profit) || 0,
      label: `Tydz. ${i + 1}`
    }));

    try {
      state.charts.correlation = new Chart(canvas, {
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
              type: 'linear',
              title: { display: true, text: 'Wynik Finansowy (Zysk R)', color: '#94a3b8' },
              ticks: { color: '#94a3b8', callback: v => v + ' R' },
              grid: { color: '#334155' }
            }
          }
        }
      });
    } catch (e) {
      console.error("Chart correlation error:", e);
    }
  }
};
