import { STORAGE_KEYS, FIELDS, DOM } from './dom.js';
import { Storage } from './storage.js';
import { Calc } from './calc.js';
import { Templates } from './templates.js';
import { Settings } from './settings.js';
import { History } from './history.js';
import { Charts } from './charts.js';
import { state } from './app.js';

export const CurrentWeek = {
  getData() { return Storage.get(STORAGE_KEYS.CURRENT_WEEK); },

  save() {
    if (!state.dom.currentWeek) return;
    const table = state.dom.currentWeek.querySelector('table');
    if (!table) return;

    const dateInputs = state.dom.currentWeek.querySelectorAll('[data-input="date"]');
    const rows = table.querySelectorAll('tbody tr');

    const weekData = {
      dateRange: {
        start: dateInputs[0] ? dateInputs[0].value : '',
        end: dateInputs[1] ? dateInputs[1].value : ''
      },
      days: []
    };

    rows.forEach(row => {
      const checkboxes = Array.from(row.querySelectorAll('input[type="checkbox"]'));
      const checked = checkboxes.map(cb => cb.checked);
      const isDayOff = row.classList.contains('day-off');
      weekData.days.push({ checked, isDayOff });
    });

    Storage.set(STORAGE_KEYS.CURRENT_WEEK, weekData);
  },

  render() {
    if (!state.dom.currentWeek) return;
    DOM.empty(state.dom.currentWeek);

    const weekData = this.getData();
    const dateBox = DOM.create('div', 'date-range');
    const label = DOM.create('strong');
    label.textContent = 'Zakres dat tygodnia: ';
    dateBox.appendChild(label);
    
    const startDateInput = Templates.dateInput();
    const endDateInput = Templates.dateInput();
    if (weekData && weekData.dateRange) {
      startDateInput.value = weekData.dateRange.start || '';
      endDateInput.value = weekData.dateRange.end || '';
    }
    dateBox.appendChild(startDateInput);
    dateBox.appendChild(DOM.text(' — '));
    dateBox.appendChild(endDateInput);

    state.dom.currentWeek.appendChild(dateBox);
    const wrapper = DOM.create('div', 'card-container');
    wrapper.appendChild(Templates.table(weekData));
    state.dom.currentWeek.appendChild(wrapper);

    const summary = DOM.create('div', 'week-summary');
    summary.innerHTML = `
      <div class="summary-item"><div class="summary-value" data-summary="percentage">0%</div><div class="summary-label">Wykonanie</div></div>
      <div class="summary-item"><div class="summary-value" data-summary="points">0/0</div><div class="summary-label">Punkty</div></div>
      <div class="summary-item"><div class="summary-value" data-summary="perfect">0/5</div><div class="summary-label">Perfekcyjne dni</div></div>
    `;
    state.dom.currentWeek.appendChild(summary);

    this.updateSums();
    this.updateStats();
  },

  updateSums() {
    if (!state.dom.currentWeek) return;
    const table = state.dom.currentWeek.querySelector('table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
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

  updateStats() {
    if (!state.dom.currentWeek) return;
    const weekData = this.getData() || { days: [] };
    const table = state.dom.currentWeek.querySelector('table');
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      weekData.days = Array.from(rows).map(row => ({
        checked: Array.from(row.querySelectorAll('input[type="checkbox"]')).map(cb => cb.checked),
        isDayOff: row.classList.contains('day-off')
      }));
    }

    const stats = Calc.weekStats(weekData);
    const settings = Settings.get();

    const summaryPercentage = state.dom.currentWeek.querySelector('[data-summary="percentage"]');
    const summaryPoints = state.dom.currentWeek.querySelector('[data-summary="points"]');
    const summaryPerfect = state.dom.currentWeek.querySelector('[data-summary="perfect"]');

    if (summaryPercentage) summaryPercentage.textContent = `${stats.percentage}%`;
    if (summaryPoints) summaryPoints.textContent = `${stats.totalChecked}/${stats.totalPossible}`;
    if (summaryPerfect) summaryPerfect.textContent = `${stats.perfectDays}/${stats.activeDays}`;

    if (state.dom.currentStats) {
      DOM.empty(state.dom.currentStats);
      const goalMet = parseFloat(stats.percentage) >= parseFloat(settings.weeklyGoal);
      const perfectGoalMet = stats.perfectDays >= parseInt(settings.perfectDaysGoal);

      state.dom.currentStats.appendChild(Templates.statCard(`Wykonanie (cel: ${settings.weeklyGoal}%)`, `${stats.percentage}%`, goalMet ? '✅ Cel osiągnięty' : '⚠️ Poniżej celu'));
      state.dom.currentStats.appendChild(Templates.statCard('Łącznie punktów', `${stats.totalChecked}/${stats.totalPossible}`));
      state.dom.currentStats.appendChild(Templates.statCard(`Perfekcyjne dni (cel: ${settings.perfectDaysGoal})`, `${stats.perfectDays}/${stats.activeDays}`, perfectGoalMet ? '✅ Cel osiągnięty' : '⚠️ Poniżej celu'));
    }
  },

  reset() {
    if (!confirm('Czy na pewno chcesz zresetować bieżący tydzień?')) return;
    Storage.remove(STORAGE_KEYS.CURRENT_WEEK);
    this.render();
  },

  archive() {
    if (!state.dom.currentWeek) return;
    const dateInputs = state.dom.currentWeek.querySelectorAll('[data-input="date"]');
    const startDate = dateInputs[0] ? dateInputs[0].value : '';
    const endDate = dateInputs[1] ? dateInputs[1].value : '';

    if (!startDate || !endDate) {
      alert('Proszę uzupełnić zakres dat przed archiwizacją!');
      return;
    }

    CurrentWeek.save();
    const savedData = this.getData();

    const profitInput = prompt('Podaj zysk/stratę dla tego tygodnia w jednostkach R (np. 3.5 lub -1):', '');
    const profit = profitInput !== null && profitInput.trim() !== '' ? parseFloat(profitInput.trim()) : 0;
    const stats = Calc.weekStats(savedData);

    const archivedWeek = {
      ...savedData,
      archivedAt: new Date().toISOString(),
      stats: stats,
      profit: isNaN(profit) ? 0 : profit
    };

    const history = History.get();
    history.push(archivedWeek);
    Storage.set(STORAGE_KEYS.HISTORY, history);

    Storage.remove(STORAGE_KEYS.CURRENT_WEEK);
    this.render();
    History.render();
    History.updateStats();
    Charts.render();
    alert(`✅ Tydzień zarchiwizowany pomyślnie!`);
  }
};
