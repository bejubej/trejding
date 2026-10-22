import { STORAGE_KEYS, DOM } from './dom.js';
import { Storage } from './storage.js';
import { Templates } from './templates.js';
import { Charts } from './charts.js';
import { state } from './app.js';

export const History = {
  get() { return Storage.get(STORAGE_KEYS.HISTORY) || []; },

  clear() {
    if (!confirm('Czy na pewno chcesz usunąć całą historię?')) return;
    Storage.remove(STORAGE_KEYS.HISTORY);
    this.render();
    this.updateStats();
    Charts.render();
  },

  deleteItem(index) {
    const history = this.get();
    if (!history[index]) return;
    if (!confirm('Usunąć ten tydzień z historii?')) return;
    history.splice(index, 1);
    Storage.set(STORAGE_KEYS.HISTORY, history);
    this.render();
    this.updateStats();
    Charts.render();
  },

  updateProfit(index, value) {
    const history = this.get();
    if (!history[index]) return;
    history[index].profit = value !== '' ? parseFloat(value) : 0;
    Storage.set(STORAGE_KEYS.HISTORY, history);
    Charts.render();
    this.updateStats();
  },

  render() {
    const history = this.get();
    if (!state.dom.archiveList) return;
    DOM.empty(state.dom.archiveList);

    if (history.length === 0) {
      const empty = DOM.create('div', '', { style: 'color: #94a3b8; text-align: center; padding: 20px;' });
      empty.textContent = 'Brak zarchiwizowanych tygodni w historii.';
      state.dom.archiveList.appendChild(empty);
      return;
    }

    [...history].reverse().forEach((week, index) => {
      const actualIndex = history.length - 1 - index;
      state.dom.archiveList.appendChild(Templates.archiveItem(week, actualIndex));
    });
  },

  updateStats() {
    const history = this.get();
    if (!state.dom.historyStats) return;
    DOM.empty(state.dom.historyStats);

    if (history.length === 0) {
      state.dom.historyStats.appendChild(Templates.statCard('Brak danych historycznych', '—'));
      return;
    }

    let totalChecked = 0, totalPossible = 0, totalProfit = 0, winningWeeks = 0, bestPercentage = 0;
    history.forEach(w => {
      if (w.stats) {
        totalChecked += w.stats.totalChecked || 0;
        totalPossible += w.stats.totalPossible || 0;
        const perc = parseFloat(w.stats.percentage) || 0;
        if (perc > bestPercentage) bestPercentage = perc;
      }
      const p = parseFloat(w.profit) || 0;
      totalProfit += p;
      if (p > 0) winningWeeks++;
    });

    const avgPercentage = totalPossible > 0 ? ((totalChecked / totalPossible) * 100).toFixed(1) : 0;
    const avgProfit = (totalProfit / history.length).toFixed(2);
    const winRateWeeks = ((winningWeeks / history.length) * 100).toFixed(0);

    state.dom.historyStats.appendChild(Templates.statCard('Średnie wykonanie', `${avgPercentage}%`, `Najlepsze: ${bestPercentage}%`));
    state.dom.historyStats.appendChild(Templates.statCard('Całkowity zysk', `${totalProfit.toFixed(1)} R`, `Śr. tygodniowo: ${avgProfit} R`));
    state.dom.historyStats.appendChild(Templates.statCard('Skuteczność tygodniowa', `${winRateWeeks}%`, `${winningWeeks} z ${history.length} zyskownych`));
    state.dom.historyStats.appendChild(Templates.statCard('Łącznie tygodni', history.length, `Suma punktów: ${totalChecked}`));
  }
};
