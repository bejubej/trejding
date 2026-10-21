(function() {
  'use strict';

  const DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
  const FIELDS = ["AlertMode", "Limit", "Aligned", "Reset 5min", "Process"];

  const FIELD_DESCRIPTIONS = {
    "AlertMode": "",
    "Limit": "",
    "Aligned": "",
    "Reset 5min": "",
    "Process": ""
  };

  const STORAGE_KEYS = {
    CURRENT_WEEK: 'currentWeekData',
    HISTORY: 'weekHistory',
    SETTINGS: 'scorecardSettings'
  };

  const state = {
    currentTab: 'current',
    charts: { trend: null, correlation: null },
    dom: {}
  };

  function cacheDOM() {
    state.dom = {
      tabs: document.querySelector('[data-tabs]'),
      tabButtons: document.querySelectorAll('[data-tab]'),
      tabContents: document.querySelectorAll('.tab-content'),
      currentWeek: document.querySelector('[data-current-week]'),
      currentStats: document.querySelector('[data-current-stats]'),
      historyStats: document.querySelector('[data-history-stats]'),
      archiveList: document.querySelector('[data-archive-list]'),
      trendChart: document.querySelector('[data-chart="trend"]'),
      correlationChart: document.querySelector('[data-chart="correlation"]'),
      settingInputs: document.querySelectorAll('[data-setting]'),
      fileInput: document.getElementById('import-file-input')
    };
  }

  const Storage = {
    get(key) {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.error(`Error reading ${key}:`, e);
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error(`Error writing ${key}:`, e);
        return false;
      }
    },
    remove(key) { localStorage.removeItem(key); }
  };

  const DOM = {
    create(tag, className = '', attributes = {}) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'data') {
          Object.entries(value).forEach(([dk, dv]) => el.dataset[dk] = dv);
        } else {
          el.setAttribute(key, value);
        }
      });
      return el;
    },
    text(content) { return document.createTextNode(content); },
    empty(element) { while (element && element.firstChild) element.removeChild(element.firstChild); },
    setClass(element, className, condition) {
      if (condition) element.classList.add(className);
      else element.classList.remove(className);
    }
  };

  const Sanitize = {
    number(val, min = 0, max = 100) {
      const num = parseInt(val, 10);
      return isNaN(num) ? min : Math.max(min, Math.min(max, num));
    }
  };

  const Templates = {
    toggle(value = 0) {
      return DOM.create('div', `toggle ${value ? 'on' : 'off'}`, { data: { action: 'toggle', value: value } });
    },
    dayOffButton(active = false) {
      const el = DOM.create('span', `day-off-btn ${active ? 'active' : ''}`, { data: { action: 'toggle-day-off' } });
      el.textContent = '🚫 Dzień wolny';
      return el;
    },
    dateInput() {
      return DOM.create('input', '', { type: 'date', data: { input: 'date' } });
    },
    descriptionRow() {
      const tr = DOM.create('tr', 'field-description-row');
      tr.appendChild(DOM.create('td', 'field-description-daycell'));
      FIELDS.forEach(field => {
        const td = DOM.create('td', 'field-description-cell');
        td.textContent = FIELD_DESCRIPTIONS[field] || '';
        tr.appendChild(td);
      });
      tr.appendChild(DOM.create('td', 'field-description-daycell'));
      return tr;
    },
    tableRow(dayIndex, dayName, toggleValues = [], isDayOff = false) {
      const tr = DOM.create('tr', isDayOff ? 'day-off' : '', { data: { dayIndex: dayIndex } });

      const dayCell = DOM.create('td', 'day-cell');
      dayCell.appendChild(DOM.text(dayName + ' '));
      dayCell.appendChild(Templates.dayOffButton(isDayOff));
      tr.appendChild(dayCell);

      FIELDS.forEach((_, fieldIndex) => {
        const td = DOM.create('td');
        const value = toggleValues[fieldIndex] !== undefined ? parseInt(toggleValues[fieldIndex]) : 0;
        td.appendChild(Templates.toggle(value));
        tr.appendChild(td);
      });

      const sumCell = DOM.create('td', 'sumCell');
      sumCell.textContent = '0/' + FIELDS.length;
      tr.appendChild(sumCell);

      return tr;
    },
    table(weekData = null) {
      const table = DOM.create('table');
      const thead = DOM.create('thead');
      const tbody = DOM.create('tbody');

      const headRow = DOM.create('tr');
      const thDay = DOM.create('th');
      thDay.textContent = 'Dzień';
      headRow.appendChild(thDay);

      FIELDS.forEach(field => {
        const th = DOM.create('th');
        th.textContent = field;
        headRow.appendChild(th);
      });

      const thSum = DOM.create('th');
      thSum.textContent = 'Suma';
      headRow.appendChild(thSum);

      thead.appendChild(headRow);
      thead.appendChild(Templates.descriptionRow());
      table.appendChild(thead);

      DAYS.forEach((day, index) => {
        let toggles = [];
        let isDayOff = false;

        if (weekData && weekData.days && weekData.days[index]) {
          const dayData = weekData.days[index];
          toggles = dayData.toggles || [];
          isDayOff = dayData.isDayOff || false;
        }

        tbody.appendChild(Templates.tableRow(index, day, toggles, isDayOff));
      });

      table.appendChild(tbody);
      return table;
    },
    statCard(label, value, badge = null) {
      const card = DOM.create('div', 'stat-card');
      const labelEl = DOM.create('div', 'stat-label');
      labelEl.textContent = label;
      const valueEl = DOM.create('div', 'stat-value');
      valueEl.textContent = value;

      card.appendChild(labelEl);
      card.appendChild(valueEl);

      if (badge) {
        const badgeEl = DOM.create('div', 'stat-badge');
        badgeEl.textContent = badge;
        card.appendChild(badgeEl);
      }
      return card;
    },
    archiveItem(week, index) {
      const item = DOM.create('div', 'archive-item');
      const dateStr = `${week.dateRange.start} → ${week.dateRange.end}`;
      const archivedDate = new Date(week.archivedAt).toLocaleDateString('pl-PL');

      const header = DOM.create('div', 'archive-header', { data: { action: 'toggle-archive', index: index } });
      const headerLeft = DOM.create('div');
      const title = DOM.create('div', 'archive-title');
      title.textContent = `📅 ${dateStr}`;
      const date = DOM.create('div');
      date.style.fontSize = '0.8rem';
      date.style.color = '#94a3b8';
      date.style.marginTop = '4px';
      date.textContent = `Zarchiwizowano: ${archivedDate}`;
      headerLeft.appendChild(title);
      headerLeft.appendChild(date);

      const headerRight = DOM.create('div', 'archive-stats');
      const stat1 = DOM.create('div', 'archive-stat');
      stat1.innerHTML = `Wykonanie: <strong>${week.stats.percentage}%</strong>`;
      const stat2 = DOM.create('div', 'archive-stat');
      stat2.innerHTML = `Zysk: <strong style="color: ${(week.profit || 0) >= 0 ? '#10b981' : '#ef4444'}">${week.profit || 0} R</strong>`;

      const profitContainer = DOM.create('div', 'archive-profit');
      const profitInput = DOM.create('input', 'archive-profit-input', {
        type: 'number',
        placeholder: 'Zysk R',
        data: { action: 'update-profit', index: index }
      });
      profitInput.value = week.profit !== null && week.profit !== undefined ? week.profit : '';
      profitInput.style.width = '90px';
      profitContainer.appendChild(profitInput);

      const deleteBtn = DOM.create('button', 'archive-delete-btn', { data: { action: 'delete-archive', index: index } });
      deleteBtn.textContent = '🗑️';

      const icon = DOM.create('span', 'expand-icon', { data: { expandIcon: index } });
      icon.textContent = '▼';

      headerRight.appendChild(stat1);
      headerRight.appendChild(stat2);
      headerRight.appendChild(profitContainer);
      headerRight.appendChild(deleteBtn);
      headerRight.appendChild(icon);

      header.appendChild(headerLeft);
      header.appendChild(headerRight);

      const content = DOM.create('div', 'archive-content', { data: { archiveContent: index } });
      content.appendChild(Templates.archiveTable(week));

      item.appendChild(header);
      item.appendChild(content);
      return item;
    },
    archiveTable(week) {
      const table = DOM.create('table');
      const thead = DOM.create('thead');
      const tbody = DOM.create('tbody');

      const headRow = DOM.create('tr');
      const thDay = DOM.create('th');
      thDay.textContent = 'Dzień';
      headRow.appendChild(thDay);

      FIELDS.forEach(field => {
        const th = DOM.create('th');
        th.textContent = field;
        headRow.appendChild(th);
      });

      const thSum = DOM.create('th');
      thSum.textContent = 'Suma';
      headRow.appendChild(thSum);

      thead.appendChild(headRow);
      thead.appendChild(Templates.descriptionRow());
      table.appendChild(thead);

      week.days.forEach((day, index) => {
        const tr = DOM.create('tr', day.isDayOff ? 'day-off' : '');
        const dayCell = DOM.create('td', 'day-cell');
        dayCell.textContent = DAYS[index];
        if (day.isDayOff) {
          dayCell.appendChild(DOM.text(' '));
          dayCell.appendChild(Templates.dayOffButton(true));
        }
        tr.appendChild(dayCell);

        let daySum = 0;
        day.toggles.forEach(val => {
          const value = parseInt(val) || 0;
          daySum += value;
          const td = DOM.create('td');
          const toggle = DOM.create('div', `toggle ${value ? 'on' : 'off'}`);
          toggle.style.pointerEvents = 'none';
          toggle.textContent = val;
          td.appendChild(toggle);
          tr.appendChild(td);
        });

        const sumCell = DOM.create('td', 'sumCell');
        if (day.isDayOff) {
          sumCell.className = 'sumCell sum-off';
          sumCell.textContent = '—';
        } else {
          sumCell.textContent = `${daySum}/${FIELDS.length}`;
          if (daySum === FIELDS.length) sumCell.classList.add('sum-perfect');
          else if (daySum >= FIELDS.length * 0.6) sumCell.classList.add('sum-good');
          else sumCell.classList.add('sum-poor');
        }
        tr.appendChild(sumCell);

        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      return table;
    }
  };

  const Calc = {
    weekStats(weekData) {
      let totalChecked = 0;
      let activeDays = 0;
      let perfectDays = 0;
      const categoryStats = {};

      FIELDS.forEach(field => { categoryStats[field] = { checked: 0, total: 0 }; });

      if (!weekData || !weekData.days) {
        return { totalChecked, totalPossible: 0, percentage: 0, perfectDays, activeDays, categoryStats };
      }

      weekData.days.forEach((day) => {
        if (day.isDayOff) return;
        activeDays++;
        let daySum = 0;

        day.toggles.forEach((val, fieldIndex) => {
          const value = parseInt(val) || 0;
          totalChecked += value;
          daySum += value;

          const fieldName = FIELDS[fieldIndex];
          if (categoryStats[fieldName]) {
            categoryStats[fieldName].checked += value;
            categoryStats[fieldName].total += 1;
          }
        });

        if (daySum === FIELDS.length) perfectDays++;
      });

      const totalPossible = activeDays * FIELDS.length;
      const percentage = totalPossible > 0 ? ((totalChecked / totalPossible) * 100).toFixed(1) : 0;

      return { totalChecked, totalPossible, percentage, perfectDays, activeDays, categoryStats };
    }
  };

  const CurrentWeek = {
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
        const toggles = Array.from(row.querySelectorAll('[data-action="toggle"]')).map(t => t.dataset.value);
        const isDayOff = row.classList.contains('day-off');
        weekData.days.push({ toggles, isDayOff });
      });

      Storage.set(STORAGE_KEYS.CURRENT_WEEK, weekData);
    },

    load() {
      const weekData = this.getData();
      if (!weekData) return;

      const dateInputs = state.dom.currentWeek.querySelectorAll('[data-input="date"]');
      if (weekData.dateRange && dateInputs.length >= 2) {
        dateInputs[0].value = weekData.dateRange.start || '';
        dateInputs[1].value = weekData.dateRange.end || '';
      }

      const table = state.dom.currentWeek.querySelector('table');
      if (!table) return;
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach((row, index) => {
        if (weekData.days && weekData.days[index]) {
          const day = weekData.days[index];
          DOM.setClass(row, 'day-off', day.isDayOff);
          const btn = row.querySelector('[data-action="toggle-day-off"]');
          if (btn) DOM.setClass(btn, 'active', day.isDayOff);

          const toggles = row.querySelectorAll('[data-action="toggle"]');
          toggles.forEach((toggle, i) => {
            if (day.toggles && day.toggles[i] !== undefined) {
              const val = day.toggles[i];
              toggle.textContent = val;
              toggle.dataset.value = val;
              toggle.className = `toggle ${val === '1' ? 'on' : 'off'}`;
            }
          });
        }
      });

      this.updateStats();
      this.updateSums();
    },

    reset() {
      if (!confirm('Czy na pewno chcesz zresetować bieżący tydzień?')) return;
      Storage.remove(STORAGE_KEYS.CURRENT_WEEK);
      this.render();
    },

    render() {
      DOM.empty(state.dom.currentWeek);

      const dateBox = DOM.create('div', 'date-range');
      const label = DOM.create('strong');
      label.textContent = 'Zakres dat tygodnia: ';
      dateBox.appendChild(label);
      dateBox.appendChild(Templates.dateInput());
      dateBox.appendChild(DOM.text(' — '));
      dateBox.appendChild(Templates.dateInput());

      state.dom.currentWeek.appendChild(dateBox);
      const wrapper = DOM.create('div', 'card-container');
      wrapper.appendChild(Templates.table());
      state.dom.currentWeek.appendChild(wrapper);

      const summary = DOM.create('div', 'week-summary');
      summary.innerHTML = `
        <div class="summary-item"><div class="summary-value" data-summary="percentage">0%</div><div class="summary-label">Wykonanie</div></div>
        <div class="summary-item"><div class="summary-value" data-summary="points">0/0</div><div class="summary-label">Punkty</div></div>
        <div class="summary-item"><div class="summary-value" data-summary="perfect">0/5</div><div class="summary-label">Perfekcyjne dni</div></div>
      `;
      state.dom.currentWeek.appendChild(summary);
      this.load();
    },

    updateSums() {
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

        const toggles = row.querySelectorAll('[data-action="toggle"]');
        let sum = 0;
        toggles.forEach(t => sum += parseInt(t.dataset.value) || 0);

        sumCell.textContent = `${sum}/${FIELDS.length}`;
        sumCell.className = 'sumCell';

        if (sum === FIELDS.length) sumCell.classList.add('sum-perfect');
        else if (sum >= FIELDS.length * 0.6) sumCell.classList.add('sum-good');
        else sumCell.classList.add('sum-poor');
      });
    },

    updateStats() {
      const weekData = this.getData();
      const stats = Calc.weekStats(weekData);
      const settings = Settings.get();

      const summaryPercentage = state.dom.currentWeek.querySelector('[data-summary="percentage"]');
      const summaryPoints = state.dom.currentWeek.querySelector('[data-summary="points"]');
      const summaryPerfect = state.dom.currentWeek.querySelector('[data-summary="perfect"]');

      if (summaryPercentage) summaryPercentage.textContent = `${stats.percentage}%`;
      if (summaryPoints) summaryPoints.textContent = `${stats.totalChecked}/${stats.totalPossible}`;
      if (summaryPerfect) summaryPerfect.textContent = `${stats.perfectDays}/${stats.activeDays}`;

      DOM.empty(state.dom.currentStats);
      const goalMet = parseFloat(stats.percentage) >= parseFloat(settings.weeklyGoal);
      const perfectGoalMet = stats.perfectDays >= parseInt(settings.perfectDaysGoal);

      state.dom.currentStats.appendChild(Templates.statCard(`Wykonanie (cel: ${settings.weeklyGoal}%)`, `${stats.percentage}%`, goalMet ? '✅ Cel osiągnięty' : '⚠️ Poniżej celu'));
      state.dom.currentStats.appendChild(Templates.statCard('Łącznie punktów', `${stats.totalChecked}/${stats.totalPossible}`));
      state.dom.currentStats.appendChild(Templates.statCard(`Perfekcyjne dni (cel: ${settings.perfectDaysGoal})`, `${stats.perfectDays}/${stats.activeDays}`, perfectGoalMet ? '✅ Cel osiągnięty' : '⚠️ Poniżej celu'));
    },

    archive() {
      const weekData = this.getData();
      if (!weekData || !weekData.dateRange.start || !weekData.dateRange.end) {
        alert('Proszę uzupełnić zakres dat przed archiwizacją!');
        return;
      }

      const profitInput = prompt('Podaj zysk/stratę dla tego tygodnia w jednostkach R (np. 3.5 lub -1):', '');
      const profit = profitInput !== null && profitInput.trim() !== '' ? parseFloat(profitInput.trim()) : 0;
      const stats = Calc.weekStats(weekData);

      const archivedWeek = {
        ...weekData,
        archivedAt: new Date().toISOString(),
        stats: stats,
        profit: isNaN(profit) ? 0 : profit
      };

      const history = History.get();
      history.push(archivedWeek);
      Storage.set(STORAGE_KEYS.HISTORY, history);

      Storage.remove(STORAGE_KEYS.CURRENT_WEEK);
      this.render();
      alert(`✅ Tydzień zarchiwizowany pomyślnie!`);
    }
  };

  const History = {
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
      DOM.empty(state.dom.historyStats);

      if (history.length === 0) {
        state.dom.historyStats.appendChild(Templates.statCard('Brak danych historycznych', '—'));
        return;
      }

      let totalChecked = 0, totalPossible = 0, totalProfit = 0, winningWeeks = 0, bestPercentage = 0;
      history.forEach(w => {
        totalChecked += w.stats.totalChecked;
        totalPossible += w.stats.totalPossible;
        const p = parseFloat(w.profit) || 0;
        totalProfit += p;
        if (p > 0) winningWeeks++;
        const perc = parseFloat(w.stats.percentage) || 0;
        if (perc > bestPercentage) bestPercentage = perc;
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

  const Charts = {
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

  const Settings = {
    get() { return Storage.get(STORAGE_KEYS.SETTINGS) || { weeklyGoal: 75, perfectDaysGoal: 2 }; },
    save() {
      const settings = {};
      state.dom.settingInputs.forEach(input => {
        settings[input.dataset.setting] = Sanitize.number(input.value);
      });
      Storage.set(STORAGE_KEYS.SETTINGS, settings);
      CurrentWeek.updateStats();
      History.updateStats();
    },
    load() {
      const settings = this.get();
      state.dom.settingInputs.forEach(input => {
        if (settings[input.dataset.setting] !== undefined) {
          input.value = settings[input.dataset.setting];
        }
      });
    }
  };

  const FileBackup = {
    exportData() {
      const backupData = {
        currentWeek: CurrentWeek.getData(),
        history: History.get(),
        settings: Settings.get(),
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `scorecard-backup-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    triggerImport() {
      if (state.dom.fileInput) {
        state.dom.fileInput.value = '';
        state.dom.fileInput.click();
      }
    },

    handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (confirm('Nadpisać obecne dane danymi z pliku kopii zapasowej?')) {
            if (parsed.currentWeek) Storage.set(STORAGE_KEYS.CURRENT_WEEK, parsed.currentWeek);
            if (parsed.history) Storage.set(STORAGE_KEYS.HISTORY, parsed.history);
            if (parsed.settings) Storage.set(STORAGE_KEYS.SETTINGS, parsed.settings);

            CurrentWeek.render();
            History.render();
            History.updateStats();
            Charts.render();
            Settings.load();
            alert('✅ Dane zaimportowane pomyślnie!');
          }
        } catch (err) {
          alert('❌ Błąd odczytu pliku: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  function initEvents() {
    if (state.dom.tabs) {
      state.dom.tabs.addEventListener('click', e => {
        const btn = e.target.closest('[data-tab]');
        if (!btn) return;
        const targetTab = btn.dataset.tab;
        state.dom.tabButtons.forEach(b => DOM.setClass(b, 'active', b === btn));
        state.dom.tabContents.forEach(c => DOM.setClass(c, 'active', c.id === `tab-${targetTab}`));
        state.currentTab = targetTab;

        if (targetTab === 'history') {
          History.render();
          History.updateStats();
          Charts.render();
        }
      });
    }

    if (state.dom.currentWeek) {
      state.dom.currentWeek.addEventListener('click', e => {
        const toggleBtn = e.target.closest('[data-action="toggle"]');
        if (toggleBtn) {
          const val = parseInt(toggleBtn.dataset.value) === 1 ? 0 : 1;
          toggleBtn.dataset.value = val;
          toggleBtn.textContent = val;
          toggleBtn.className = `toggle ${val === 1 ? 'on' : 'off'}`;
          CurrentWeek.updateSums();
          CurrentWeek.updateStats();
          CurrentWeek.save();
          return;
        }

        const dayOffBtn = e.target.closest('[data-action="toggle-day-off"]');
        if (dayOffBtn) {
          const row = dayOffBtn.closest('tr');
          if (row) {
            row.classList.toggle('day-off');
            dayOffBtn.classList.toggle('active');
            CurrentWeek.updateSums();
            CurrentWeek.updateStats();
            CurrentWeek.save();
          }
        }
      });

      state.dom.currentWeek.addEventListener('input', () => CurrentWeek.save());
    }

    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      if (action === 'archive-week') CurrentWeek.archive();
      if (action === 'reset-current') CurrentWeek.reset();
      if (action === 'clear-history') History.clear();
      if (action === 'export-file') FileBackup.exportData();
      if (action === 'import-file') FileBackup.triggerImport();

      if (action === 'reset-all') {
        if (confirm('Czy na pewno chcesz usunąć WSZYSTKIE dane?')) {
          localStorage.clear();
          location.reload();
        }
      }

      if (action === 'toggle-archive') {
        const index = btn.dataset.index;
        const content = document.querySelector(`[data-archive-content="${index}"]`);
        const icon = document.querySelector(`[data-expand-icon="${index}"]`);
        if (content) {
          content.classList.toggle('open');
          if (icon) icon.classList.toggle('open');
        }
      }

      if (action === 'delete-archive') {
        History.deleteItem(parseInt(btn.dataset.index));
      }
    });

    if (state.dom.archiveList) {
      state.dom.archiveList.addEventListener('input', e => {
        const input = e.target.closest('[data-action="update-profit"]');
        if (input) {
          History.updateProfit(parseInt(input.dataset.index), input.value);
        }
      });
    }

    if (state.dom.settingInputs) {
      state.dom.settingInputs.forEach(input => {
        input.addEventListener('change', () => Settings.save());
      });
    }

    if (state.dom.fileInput) {
      state.dom.fileInput.addEventListener('change', FileBackup.handleFileSelect);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    cacheDOM();
    CurrentWeek.render();
    Settings.load();
    initEvents();
  });

})();
