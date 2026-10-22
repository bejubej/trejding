import { STORAGE_KEYS, FIELDS, DOM } from './dom.js';
import { Storage } from './storage.js';
import { Calc } from './calc.js';
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

  updateArchivedWeek(archiveIndex) {
    const history = this.get();
    if (!history[archiveIndex]) return;

    const contentDiv = document.querySelector(`[data-archive-content="${archiveIndex}"]`);
    if (!contentDiv) return;

    const table = contentDiv.querySelector('table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    const updatedDays = [];

    rows.forEach(row => {
      const checkboxes = Array.from(row.querySelectorAll('input[type="checkbox"]'));
      const checked = checkboxes.map(cb => cb.checked);
      const isDayOff = row.classList.contains('day-off');
      updatedDays.push({ checked, isDayOff });
    });

    history[archiveIndex].days = updatedDays;
    history[archiveIndex].stats = Calc.weekStats(history[archiveIndex]);

    Storage.set(STORAGE_KEYS.HISTORY, history);
    Charts.render();
    this.updateStats();

    // Aktualizujemy wyświetlany procent wykonania w nagłówku archiwum bez zamykania akordeonu
    const statPercEl = document.querySelector(`[data-archive-stat-perc="${archiveIndex}"]`);
    if (statPercEl) {
      statPercEl.innerHTML = `Wykonanie: <strong>${history[archiveIndex].stats.percentage}%</strong>`;
    }

    // Aktualizujemy sumy w wierszach tabeli archiwum
    rows.forEach(row => {
      const sumCell = row.querySelector('.sumCell');
      if (!sumCell) return;
      if (row.classList.contains('day-off')) {
        sumCell.textContent = '—';
        sumCell.className = 'sumCell sum-off';
        return;
      }
      const checkboxes = row.querySelectorAll('input[type="checkbox"]');
      let sum = 0;
      checkboxes.forEach(cb => { if (cb.checked) sum++; });

      sumCell.textContent = `${sum}/${FIELDS.length}`;
      sumCell.className = 'sumCell';
      if (sum === FIELDS.length) sumCell.classList.add('sum-perfect');
      else if (sum >= FIELDS.length * 0.6) sumCell.classList.add('sum-good');
      else sumCell.classList.add('sum-poor');
    });
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

    // Podpięcie zdarzeń do nowo wyrenderowanego archiwum (edycja checkboxów oraz dni wolnych w historii)
    state.dom.archiveList.querySelectorAll('.archive-content').forEach(content => {
      content.addEventListener('change', e => {
        if (e.target.type === 'checkbox') {
          const archiveItem = e.target.closest('.archive-item');
          if (archiveItem) {
            const archiveIndex = parseInt(archiveItem.dataset.archiveIndex);
            History.updateArchivedWeek(archiveIndex);
          }
        }
      });

      content.addEventListener('click', e => {
        const dayOffBtn = e.target.closest('[data-action="toggle-archive-day-off"]');
        if (dayOffBtn) {
          const row = dayOffBtn.closest('tr');
          const archiveItem = e.target.closest('.archive-item');
          if (row && archiveItem) {
            row.classList.toggle('day-off');
            dayOffBtn.classList.toggle('active');
            const isOff = row.classList.contains('day-off');
            row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
              cb.disabled = isOff;
              if (isOff) cb.checked = false;
            });
            const archiveIndex = parseInt(archiveItem.dataset.archiveIndex);
            History.updateArchivedWeek(archiveIndex);
          }
        }
      });
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
