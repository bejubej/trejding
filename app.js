(function() {
    'use strict';

    // ------------------------------------------------------------------------
    // CONSTANTS
    // ------------------------------------------------------------------------

    const DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
    const FIELDS = ["AlertMode", "Limit", "Aligned", "Reset 5min", "Process/notPnL"];

    const STORAGE_KEYS = {
        CURRENT_WEEK: 'currentWeekData',
        HISTORY: 'weekHistory',
        SETTINGS: 'scorecardSettings',
        GITHUB_TOKEN: 'githubToken',
        GIST_ID: 'gistId',
        AUTO_SYNC: 'autoSyncEnabled'
    };

    const GITHUB_API = {
        GISTS: 'https://api.github.com/gists',
        DESCRIPTION: 'Trading Scorecard Data - Enhanced'
    };

    // ------------------------------------------------------------------------
    // STATE
    // ------------------------------------------------------------------------

    const state = {
        currentTab: 'current',
        charts: {
            trend: null,
            categories: null
        },
        autoSyncInterval: null,
        dom: {}
    };

    // ------------------------------------------------------------------------
    // DOM CACHE
    // ------------------------------------------------------------------------

    function cacheDOM() {
        state.dom = {
            // Tabs
            tabs: document.querySelector('[data-tabs]'),
            tabButtons: document.querySelectorAll('[data-tab]'),

            // Current week
            currentWeek: document.querySelector('[data-current-week]'),
            currentStats: document.querySelector('[data-current-stats]'),

            // History
            historyStats: document.querySelector('[data-history-stats]'),
            archiveList: document.querySelector('[data-archive-list]'),
            trendChart: document.querySelector('[data-chart="trend"]'),
            categoriesChart: document.querySelector('[data-chart="categories"]'),

            // Settings
            settingInputs: document.querySelectorAll('[data-setting]'),
            githubTokenInput: document.querySelector('[data-input="github-token"]'),
            gistIdInput: document.querySelector('[data-input="gist-id"]'),
            autoSyncInput: document.querySelector('[data-input="auto-sync"]'),
            syncStatus: document.querySelector('[data-sync-status]'),
            gistInfo: document.querySelector('[data-gist-info]')
        };
    }

    // ------------------------------------------------------------------------
    // STORAGE
    // ------------------------------------------------------------------------

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

        remove(key) {
            localStorage.removeItem(key);
        },

        getString(key) {
            return localStorage.getItem(key);
        },

        setString(key, value) {
            localStorage.setItem(key, value);
        }
    };

    // ------------------------------------------------------------------------
    // DOM MANIPULATION HELPERS
    // ------------------------------------------------------------------------

    const DOM = {
        create(tag, className = '', attributes = {}) {
            const el = document.createElement(tag);
            if (className) el.className = className;
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'data') {
                    Object.entries(value).forEach(([dataKey, dataValue]) => {
                        el.dataset[dataKey] = dataValue;
                    });
                } else {
                    el.setAttribute(key, value);
                }
            });
            return el;
        },

        text(content) {
            return document.createTextNode(content);
        },

        empty(element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        },

        setClass(element, className, condition) {
            if (condition) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        }
    };

    // ------------------------------------------------------------------------
    // SANITIZATION
    // ------------------------------------------------------------------------

    const Sanitize = {
        text(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        number(val, min = 0, max = 100) {
            const num = parseInt(val, 10);
            if (isNaN(num)) return min;
            return Math.max(min, Math.min(max, num));
        }
    };

    // ------------------------------------------------------------------------
    // TEMPLATES
    // ------------------------------------------------------------------------

    const Templates = {
        toggle(value = 0) {
            const el = DOM.create('div', `toggle ${value ? 'on' : 'off'}`, {
                data: { action: 'toggle', value: value }
            });
            el.textContent = value;
            return el;
        },

        dayOffButton(active = false) {
            const el = DOM.create('span', `day-off-btn ${active ? 'active' : ''}`, {
                data: { action: 'toggle-day-off' }
            });
            el.textContent = '🚫 Dzień wolny';
            return el;
        },

        notes(value = '', readonly = false) {
            const el = DOM.create('textarea', `notes ${readonly ? 'readonly' : ''}`, {
                placeholder: readonly ? '' : 'Dodaj notatkę...'
            });
            el.value = value;
            if (readonly) el.readOnly = true;
            return el;
        },

        dateInput() {
            return DOM.create('input', '', { type: 'date', data: { input: 'date' } });
        },

        tableRow(dayIndex, dayName, toggleValues = [], note = '', isDayOff = false) {
            const tr = DOM.create('tr', isDayOff ? 'day-off' : '', {
                data: { dayIndex: dayIndex }
            });

            // Day cell
            const dayCell = DOM.create('td', 'day-cell');
            dayCell.appendChild(DOM.text(dayName + ' '));
            dayCell.appendChild(Templates.dayOffButton(isDayOff));
            tr.appendChild(dayCell);

            // Toggle cells
            FIELDS.forEach((_, fieldIndex) => {
                const td = DOM.create('td');
                const value = toggleValues[fieldIndex] !== undefined ? parseInt(toggleValues[fieldIndex]) : 0;
                td.appendChild(Templates.toggle(value));
                tr.appendChild(td);
            });

            // Sum cell
            const sumCell = DOM.create('td', 'sumCell');
            sumCell.textContent = '0/5';
            tr.appendChild(sumCell);

            // Notes cell
            const notesCell = DOM.create('td');
            notesCell.appendChild(Templates.notes(note));
            tr.appendChild(notesCell);

            return tr;
        },

        table(weekData = null) {
            const table = DOM.create('table');
            const thead = DOM.create('thead');
            const tbody = DOM.create('tbody');

            // Header
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

            const thNotes = DOM.create('th');
            thNotes.textContent = 'Notatki';
            headRow.appendChild(thNotes);

            thead.appendChild(headRow);
            table.appendChild(thead);

            // Body
            DAYS.forEach((day, index) => {
                let toggles = [];
                let note = '';
                let isDayOff = false;

                if (weekData && weekData.days && weekData.days[index]) {
                    const dayData = weekData.days[index];
                    toggles = dayData.toggles || [];
                    note = dayData.note || '';
                    isDayOff = dayData.isDayOff || false;
                }

                tbody.appendChild(Templates.tableRow(index, day, toggles, note, isDayOff));
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

            // Header
            const header = DOM.create('div', 'archive-header', {
                data: { action: 'toggle-archive', index: index }
            });

            const headerLeft = DOM.create('div');
            const title = DOM.create('div', 'archive-title');
            title.textContent = `📅 ${dateStr}`;
            const date = DOM.create('div');
            date.style.fontSize = '0.85em';
            date.style.color = '#999';
            date.style.marginTop = '5px';
            date.textContent = `Zarchiwizowano: ${archivedDate}`;
            headerLeft.appendChild(title);
            headerLeft.appendChild(date);

            const headerRight = DOM.create('div', 'archive-stats');

            const stat1 = DOM.create('div', 'archive-stat');
            stat1.innerHTML = `Wykonanie: <strong>${week.stats.percentage}%</strong>`;

            const stat2 = DOM.create('div', 'archive-stat');
            stat2.innerHTML = `Punkty: <strong>${week.stats.totalChecked}/${week.stats.totalPossible}</strong>`;

            const stat3 = DOM.create('div', 'archive-stat');
            stat3.innerHTML = `Perfekcyjne: <strong>${week.stats.perfectDays}/${week.stats.activeDays}</strong>`;

            // Profit input
            const profitContainer = DOM.create('div', 'archive-profit');
            const profitLabel = DOM.create('span');
            profitLabel.textContent = 'Zysk: ';
            profitLabel.style.color = '#718096';
            profitLabel.style.fontSize = '0.9em';

            const profitInput = DOM.create('input', 'archive-profit-input', {
                type: 'number',
                placeholder: '0',
                data: { action: 'update-profit', index: index }
            });
            profitInput.value = week.profit || '';
            profitInput.style.width = '100px';

            const profitCurrency = DOM.create('span');
            profitCurrency.textContent = ' PLN';
            profitCurrency.style.color = '#718096';
            profitCurrency.style.fontSize = '0.9em';

            profitContainer.appendChild(profitLabel);
            profitContainer.appendChild(profitInput);
            profitContainer.appendChild(profitCurrency);

            const deleteBtn = DOM.create('button', 'archive-delete-btn', {
                data: { action: 'delete-archive', index: index }
            });
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Usuń ten tydzień';

            const icon = DOM.create('span', 'expand-icon', {
                data: { expandIcon: index }
            });
            icon.textContent = '▼';

            headerRight.appendChild(stat1);
            headerRight.appendChild(stat2);
            headerRight.appendChild(stat3);
            headerRight.appendChild(profitContainer);
            headerRight.appendChild(deleteBtn);
            headerRight.appendChild(icon);

            header.appendChild(headerLeft);
            header.appendChild(headerRight);

            // Content
            const content = DOM.create('div', 'archive-content', {
                data: { archiveContent: index }
            });
            content.appendChild(Templates.archiveTable(week));

            item.appendChild(header);
            item.appendChild(content);

            return item;
        },

        archiveTable(week) {
            const table = DOM.create('table');
            const thead = DOM.create('thead');
            const tbody = DOM.create('tbody');

            // Header
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

            const thNotes = DOM.create('th');
            thNotes.textContent = 'Notatki';
            headRow.appendChild(thNotes);

            thead.appendChild(headRow);
            table.appendChild(thead);

            // Body
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
                    const value = parseInt(val);
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
                    if (daySum === FIELDS.length) {
                        sumCell.classList.add('sum-perfect');
                    } else if (daySum >= FIELDS.length * 0.6) {
                        sumCell.classList.add('sum-good');
                    } else {
                        sumCell.classList.add('sum-poor');
                    }
                }
                tr.appendChild(sumCell);

                const notesCell = DOM.create('td');
                notesCell.appendChild(Templates.notes(day.note || '', true));
                tr.appendChild(notesCell);

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);
            return table;
        }
    };

    // ------------------------------------------------------------------------
    // CALCULATIONS
    // ------------------------------------------------------------------------

    const Calc = {
        weekStats(weekData) {
            let totalChecked = 0;
            let activeDays = 0;
            let perfectDays = 0;
            const categoryStats = {};

            FIELDS.forEach(field => {
                categoryStats[field] = { checked: 0, total: 0 };
            });

            weekData.days.forEach((day) => {
                if (day.isDayOff) return;

                activeDays++;
                let daySum = 0;

                day.toggles.forEach((val, fieldIndex) => {
                    const value = parseInt(val);
                    totalChecked += value;
                    daySum += value;

                    const fieldName = FIELDS[fieldIndex];
                    categoryStats[fieldName].checked += value;
                    categoryStats[fieldName].total += 1;
                });

                if (daySum === FIELDS.length) perfectDays++;
            });

            const totalPossible = activeDays * FIELDS.length;
            const percentage = totalPossible > 0 ? ((totalChecked / totalPossible) * 100).toFixed(1) : 0;

            return {
                totalChecked,
                totalPossible,
                percentage,
                perfectDays,
                activeDays,
                categoryStats
            };
        }
    };

    // ------------------------------------------------------------------------
    // CURRENT WEEK MANAGEMENT
    // ------------------------------------------------------------------------

    const CurrentWeek = {
        getData() {
            return Storage.get(STORAGE_KEYS.CURRENT_WEEK);
        },

        save() {
            const table = state.dom.currentWeek.querySelector('table');
            if (!table) return;

            const dateInputs = state.dom.currentWeek.querySelectorAll('[data-input="date"]');
            const rows = table.querySelectorAll('tbody tr');

            const weekData = {
                dateRange: {
                    start: dateInputs[0].value,
                    end: dateInputs[1].value
                },
                days: []
            };

            rows.forEach(row => {
                const toggles = Array.from(row.querySelectorAll('[data-action="toggle"]')).map(t => t.dataset.value);
                const note = row.querySelector('.notes').value;
                const isDayOff = row.classList.contains('day-off');

                weekData.days.push({ toggles, note, isDayOff });
            });

            Storage.set(STORAGE_KEYS.CURRENT_WEEK, weekData);
        },

        load() {
            const weekData = this.getData();
            if (!weekData) return;

            const dateInputs = state.dom.currentWeek.querySelectorAll('[data-input="date"]');
            if (weekData.dateRange) {
                dateInputs[0].value = weekData.dateRange.start || '';
                dateInputs[1].value = weekData.dateRange.end || '';
            }

            const table = state.dom.currentWeek.querySelector('table');
            const rows = table.querySelectorAll('tbody tr');

            rows.forEach((row, index) => {
                if (weekData.days && weekData.days[index]) {
                    const day = weekData.days[index];

                    DOM.setClass(row, 'day-off', day.isDayOff);
                    const btn = row.querySelector('[data-action="toggle-day-off"]');
                    if (btn) {
                        DOM.setClass(btn, 'active', day.isDayOff);
                    }

                    const toggles = row.querySelectorAll('[data-action="toggle"]');
                    toggles.forEach((toggle, i) => {
                        if (day.toggles && day.toggles[i] !== undefined) {
                            const val = day.toggles[i];
                            toggle.textContent = val;
                            toggle.dataset.value = val;
                            toggle.className = `toggle ${val === '1' ? 'on' : 'off'}`;
                        }
                    });

                    const textarea = row.querySelector('.notes');
                    if (textarea) {
                        textarea.value = day.note || '';
                    }
                }
            });

            this.updateStats();
            this.updateSums();
        },

        reset() {
            if (!confirm('Czy na pewno chcesz zresetować bieżący tydzień?')) {
                return;
            }

            Storage.remove(STORAGE_KEYS.CURRENT_WEEK);
            this.render();
        },

        render() {
            DOM.empty(state.dom.currentWeek);

            // Date range
            const dateBox = DOM.create('div', 'date-range');
            const label = DOM.create('strong');
            label.textContent = 'Zakres dat: ';
            dateBox.appendChild(label);
            dateBox.appendChild(Templates.dateInput());
            dateBox.appendChild(DOM.text(' — '));
            dateBox.appendChild(Templates.dateInput());

            state.dom.currentWeek.appendChild(dateBox);
            state.dom.currentWeek.appendChild(Templates.table());

            // Summary
            const summary = DOM.create('div', 'week-summary');
            summary.innerHTML = `
        <div class="summary-item">
          <div class="summary-value">0%</div>
          <div class="summary-label">Wykonanie</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">0/0</div>
          <div class="summary-label">Punkty</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">0/5</div>
          <div class="summary-label">Perfekcyjne dni</div>
        </div>
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

                if (row.classList.contains('day-off')) {
                    sumCell.textContent = '—';
                    sumCell.className = 'sumCell sum-off';
                    return;
                }

                const toggles = row.querySelectorAll('[data-action="toggle"]');
                let sum = 0;
                toggles.forEach(t => sum += parseInt(t.dataset.value));

                sumCell.textContent = `${sum}/${FIELDS.length}`;
                sumCell.className = 'sumCell';

                if (sum === FIELDS.length) {
                    sumCell.classList.add('sum-perfect');
                } else if (sum >= FIELDS.length * 0.6) {
                    sumCell.classList.add('sum-good');
                } else {
                    sumCell.classList.add('sum-poor');
                }
            });
        },

        updateStats() {
            const weekData = this.getData();
            if (!weekData) {
                DOM.empty(state.dom.currentStats);
                return;
            }

            const stats = Calc.weekStats(weekData);
            const settings = Settings.get();

            const goalMet = parseFloat(stats.percentage) >= parseFloat(settings.weeklyGoal);
            const perfectGoalMet = stats.perfectDays >= parseInt(settings.perfectDaysGoal);

            DOM.empty(state.dom.currentStats);

            state.dom.currentStats.appendChild(
                Templates.statCard(
                    `Wykonanie (cel: ${settings.weeklyGoal}%)`,
                    `${stats.percentage}%`,
                    goalMet ? '✅ Cel osiągnięty!' : '⚠️ Poniżej celu'
                )
            );

            state.dom.currentStats.appendChild(
                Templates.statCard('Łącznie punktów', `${stats.totalChecked}/${stats.totalPossible}`)
            );

            state.dom.currentStats.appendChild(
                Templates.statCard(
                    `Perfekcyjne dni (cel: ${settings.perfectDaysGoal})`,
                    `${stats.perfectDays}/${stats.activeDays}`,
                    perfectGoalMet ? '✅ Cel osiągnięty!' : '⚠️ Poniżej celu'
                )
            );
        },

        archive() {
            const weekData = this.getData();
            if (!weekData) {
                alert('Brak danych do zarchiwizowania!');
                return;
            }

            if (!weekData.dateRange.start || !weekData.dateRange.end) {
                alert('Proszę uzupełnić zakres dat przed archiwizacją!');
                return;
            }

            // Prompt for profit
            const profitInput = prompt('Podaj zysk/stratę dla tego tygodnia (w PLN/USD/etc):\n\nPrzykład: 1500 lub -300\nMożesz pominąć (kliknij OK bez wpisywania)', '');
            const profit = profitInput !== null && profitInput.trim() !== '' ? parseFloat(profitInput.trim()) : null;

            const stats = Calc.weekStats(weekData);

            const archivedWeek = {
                ...weekData,
                archivedAt: new Date().toISOString(),
                stats: stats,
                profit: profit
            };

            const history = History.get();
            history.push(archivedWeek);
            Storage.set(STORAGE_KEYS.HISTORY, history);

            this.reset();

            const profitStr = profit !== null ? `\nZysk: ${profit > 0 ? '+' : ''}${profit}` : '';
            alert(`✅ Tydzień zarchiwizowany!\n\nWykonanie: ${stats.percentage}%\nPerfekcyjne dni: ${stats.perfectDays}/${stats.activeDays}${profitStr}`);
        }
    };

    // ------------------------------------------------------------------------
    // HISTORY MANAGEMENT
    // ------------------------------------------------------------------------

    const History = {
        get() {
            return Storage.get(STORAGE_KEYS.HISTORY) || [];
        },

        clear() {
            if (!confirm('Czy na pewno chcesz wyczyścić całą historię? Ta operacja jest nieodwracalna!')) {
                return;
            }

            Storage.remove(STORAGE_KEYS.HISTORY);
            this.render();
            this.updateStats();
            Charts.render();
            alert('Historia wyczyszczona!');
        },

        deleteItem(index) {
            const history = this.get();
            const item = history[index];

            if (!item) return;

            const dateStr = `${item.dateRange.start} → ${item.dateRange.end}`;

            if (!confirm(`Czy na pewno chcesz usunąć tydzień:\n${dateStr}?\n\nTa operacja jest nieodwracalna!`)) {
                return;
            }

            history.splice(index, 1);
            Storage.set(STORAGE_KEYS.HISTORY, history);

            this.render();
            this.updateStats();
            Charts.render();
        },

        updateProfit(index, value) {
            const history = this.get();
            if (!history[index]) return;

            history[index].profit = value;
            Storage.set(STORAGE_KEYS.HISTORY, history);

            // Update chart only
            Charts.render();
        },

        render() {
            const history = this.get();

            DOM.empty(state.dom.archiveList);

            if (history.length === 0) {
                const empty = DOM.create('div', 'empty-archive');
                empty.innerHTML = `
          <div class="empty-archive-icon">📭</div>
          <h3>Brak zarchiwizowanych tygodni</h3>
          <p>Zarchiwizuj swój pierwszy tydzień, aby rozpocząć śledzenie postępów</p>
        `;
                state.dom.archiveList.appendChild(empty);
                return;
            }

            const sortedHistory = [...history].reverse();

            sortedHistory.forEach((week, index) => {
                const actualIndex = history.length - 1 - index;
                state.dom.archiveList.appendChild(Templates.archiveItem(week, actualIndex));
            });
        },

        updateStats() {
            const history = this.get();

            DOM.empty(state.dom.historyStats);

            if (history.length === 0) {
                state.dom.historyStats.appendChild(
                    Templates.statCard('Brak danych historycznych', '—')
                );
                return;
            }

            let totalChecked = 0;
            let totalPossible = 0;
            let totalPerfectDays = 0;
            const totalWeeks = history.length;

            history.forEach(week => {
                totalChecked += week.stats.totalChecked;
                totalPossible += week.stats.totalPossible;
                totalPerfectDays += week.stats.perfectDays;
            });

            const avgPercentage = totalPossible > 0 ? ((totalChecked / totalPossible) * 100).toFixed(1) : 0;
            const avgPerfectDays = (totalPerfectDays / totalWeeks).toFixed(1);

            state.dom.historyStats.appendChild(Templates.statCard('Średnie wykonanie', `${avgPercentage}%`));
            state.dom.historyStats.appendChild(Templates.statCard('Łącznie tygodni', totalWeeks));
            state.dom.historyStats.appendChild(Templates.statCard('Łącznie punktów', `${totalChecked}/${totalPossible}`));
            state.dom.historyStats.appendChild(Templates.statCard('Śr. perfekcyjnych dni', avgPerfectDays));
        }
    };

    // ------------------------------------------------------------------------
    // CHARTS
    // ------------------------------------------------------------------------

    const Charts = {
        render() {
            const history = History.get();

            if (history.length === 0) {
                if (state.charts.trend) state.charts.trend.destroy();
                if (state.charts.categories) state.charts.categories.destroy();
                return;
            }

            this.renderTrend(history);
            this.renderCategories(history);
        },

        renderTrend(history) {
            const settings = Settings.get();

            const trendData = {
                labels: history.map((w, i) => {
                    const start = new Date(w.dateRange.start).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
                    return `Tydz. ${i + 1}\n${start}`;
                }),
                datasets: [
                    {
                        label: 'Wykonanie (%)',
                        data: history.map(w => parseFloat(w.stats.percentage)),
                        borderColor: '#2b6cb0',
                        backgroundColor: 'rgba(43, 108, 176, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y-percentage'
                    },
                    {
                        label: 'Zysk (PLN)',
                        data: history.map(w => parseFloat(w.profit) || 0),
                        borderColor: '#2f855a',
                        backgroundColor: 'rgba(47, 133, 90, 0.1)',
                        tension: 0.4,
                        fill: false,
                        yAxisID: 'y-profit',
                        borderWidth: 2
                    }
                ]
            };

            if (state.charts.trend) state.charts.trend.destroy();

            state.charts.trend = new Chart(state.dom.trendChart, {
                type: 'line',
                data: trendData,
                options: {
                    responsive: true,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        'y-percentage': {
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: value => value + '%'
                            },
                            title: {
                                display: true,
                                text: 'Wykonanie (%)'
                            }
                        },
                        'y-profit': {
                            type: 'linear',
                            position: 'right',
                            beginAtZero: true,
                            ticks: {
                                callback: value => value + ' PLN'
                            },
                            title: {
                                display: true,
                                text: 'Zysk (PLN)'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
        },

        renderCategories(history) {
            const categoryData = {};
            FIELDS.forEach(field => {
                categoryData[field] = { checked: 0, total: 0 };
            });

            history.forEach(week => {
                FIELDS.forEach(field => {
                    if (week.stats.categoryStats && week.stats.categoryStats[field]) {
                        categoryData[field].checked += week.stats.categoryStats[field].checked;
                        categoryData[field].total += week.stats.categoryStats[field].total;
                    }
                });
            });

            const categoryPercentages = FIELDS.map(field => {
                const data = categoryData[field];
                return data.total > 0 ? ((data.checked / data.total) * 100).toFixed(1) : 0;
            });

            const categoriesData = {
                labels: FIELDS,
                datasets: [{
                    label: 'Wykonanie (%)',
                    data: categoryPercentages,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(76, 175, 80, 0.8)',
                        'rgba(255, 152, 0, 0.8)',
                        'rgba(33, 150, 243, 0.8)'
                    ]
                }]
            };

            if (state.charts.categories) state.charts.categories.destroy();

            state.charts.categories = new Chart(state.dom.categoriesChart, {
                type: 'bar',
                data: categoriesData,
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: value => value + '%'
                            }
                        }
                    }
                }
            });
        }
    };

    // ------------------------------------------------------------------------
    // SETTINGS
    // ------------------------------------------------------------------------

    const Settings = {
        get() {
            return Storage.get(STORAGE_KEYS.SETTINGS) || {
                weeklyGoal: 75,
                perfectDaysGoal: 2
            };
        },

        save() {
            const settings = {};
            state.dom.settingInputs.forEach(input => {
                const key = input.dataset.setting;
                settings[key] = Sanitize.number(input.value);
            });
            Storage.set(STORAGE_KEYS.SETTINGS, settings);
            CurrentWeek.updateStats();
            History.updateStats();
        },

        load() {
            const settings = this.get();
            state.dom.settingInputs.forEach(input => {
                const key = input.dataset.setting;
                if (settings[key] !== undefined) {
                    input.value = settings[key];
                }
            });
        }
    };

    // ------------------------------------------------------------------------
    // GITHUB SYNC
    // ------------------------------------------------------------------------

    const GitHub = {
        showStatus(message, type) {
            if (!state.dom.syncStatus) return;

            state.dom.syncStatus.textContent = message;
            state.dom.syncStatus.className = `sync-status show ${type}`;
            setTimeout(() => {
                state.dom.syncStatus.classList.remove('show');
            }, 5000);
        },

        getToken() {
            return Storage.getString(STORAGE_KEYS.GITHUB_TOKEN);
        },

        getGistId() {
            return Storage.getString(STORAGE_KEYS.GIST_ID);
        },

        saveToken() {
            if (!state.dom.githubTokenInput) return;

            const token = state.dom.githubTokenInput.value.trim();
            if (!token) {
                this.showStatus('Wpisz token!', 'error');
                return;
            }
            Storage.setString(STORAGE_KEYS.GITHUB_TOKEN, token);
            this.showStatus('Token zapisany!', 'success');
            state.dom.githubTokenInput.value = '';
            state.dom.githubTokenInput.placeholder = 'Token zapisany ✓';
        },

        removeToken() {
            Storage.remove(STORAGE_KEYS.GITHUB_TOKEN);
            Storage.remove(STORAGE_KEYS.GIST_ID);
            this.showStatus('Token usunięty', 'info');

            if (state.dom.githubTokenInput) {
                state.dom.githubTokenInput.placeholder = 'Wklej swój GitHub Personal Access Token...';
            }
            if (state.dom.gistInfo) {
                state.dom.gistInfo.textContent = '';
            }
        },

        async syncToCloud() {
            const token = this.getToken();
            const gistId = state.dom.gistIdInput ? state.dom.gistIdInput.value.trim() : this.getGistId();

            if (!token) {
                this.showStatus('Najpierw zapisz GitHub token!', 'error');
                return;
            }

            const currentData = Storage.getString(STORAGE_KEYS.CURRENT_WEEK);
            const historyData = Storage.getString(STORAGE_KEYS.HISTORY);
            const settingsData = Storage.getString(STORAGE_KEYS.SETTINGS);

            if (!currentData && !historyData) {
                this.showStatus('Brak danych do zapisania', 'error');
                return;
            }

            this.showStatus('Zapisywanie...', 'info');

            const gistData = {
                description: GITHUB_API.DESCRIPTION,
                public: false,
                files: {
                    'current-week.json': { content: currentData || '{}' },
                    'history.json': { content: historyData || '[]' },
                    'settings.json': { content: settingsData || '{}' }
                }
            };

            try {
                let response;
                if (gistId) {
                    response = await fetch(`${GITHUB_API.GISTS}/${gistId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `token ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(gistData)
                    });
                } else {
                    response = await fetch(GITHUB_API.GISTS, {
                        method: 'POST',
                        headers: {
                            'Authorization': `token ${token}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(gistData)
                    });
                }

                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }

                const result = await response.json();
                Storage.setString(STORAGE_KEYS.GIST_ID, result.id);

                if (state.dom.gistIdInput) {
                    state.dom.gistIdInput.value = result.id;
                }

                this.showStatus('✓ Zapisano do cloud!', 'success');

                if (state.dom.gistInfo) {
                    state.dom.gistInfo.textContent = `Zapisano w Gist ID: ${result.id.substring(0, 8)}...`;
                }
            } catch (error) {
                console.error('Sync error:', error);
                this.showStatus('Błąd synchronizacji: ' + error.message, 'error');
            }
        },

        async syncFromCloud() {
            const token = this.getToken();
            const gistId = state.dom.gistIdInput ? state.dom.gistIdInput.value.trim() : this.getGistId();

            if (!token) {
                this.showStatus('Najpierw zapisz GitHub token!', 'error');
                return;
            }

            if (!gistId) {
                this.showStatus('Podaj ID Gista!', 'error');
                return;
            }

            this.showStatus('Pobieranie...', 'info');

            try {
                const response = await fetch(`${GITHUB_API.GISTS}/${gistId}`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }

                const fullGist = await response.json();

                if (fullGist.files['current-week.json']) {
                    const content = fullGist.files['current-week.json'].content;
                    if (content && content.trim().length > 0) {
                        Storage.setString(STORAGE_KEYS.CURRENT_WEEK, content);
                    }
                }

                if (fullGist.files['history.json']) {
                    const content = fullGist.files['history.json'].content;
                    if (content && content.trim().length > 0) {
                        Storage.setString(STORAGE_KEYS.HISTORY, content);
                    }
                }

                if (fullGist.files['settings.json']) {
                    const content = fullGist.files['settings.json'].content;
                    if (content && content.trim().length > 0) {
                        Storage.setString(STORAGE_KEYS.SETTINGS, content);
                    }
                }

                Storage.setString(STORAGE_KEYS.GIST_ID, gistId);

                CurrentWeek.load();
                Settings.load();
                History.render();
                History.updateStats();

                this.showStatus('✓ Wczytano wszystkie dane z cloud!', 'success');

                if (state.dom.gistInfo) {
                    state.dom.gistInfo.textContent = `Połączono z Gist ID: ${gistId.substring(0, 8)}...`;
                }
            } catch (error) {
                console.error('Sync error:', error);
                this.showStatus('Błąd pobierania: ' + error.message, 'error');
            }
        },

        toggleAutoSync() {
            if (!state.dom.autoSyncInput) return;

            if (state.dom.autoSyncInput.checked) {
                state.autoSyncInterval = setInterval(() => {
                    this.syncToCloud();
                }, 300000); // 5 minutes
                this.showStatus('Auto-sync włączony (co 5 min)', 'success');
                Storage.setString(STORAGE_KEYS.AUTO_SYNC, 'true');
            } else {
                if (state.autoSyncInterval) {
                    clearInterval(state.autoSyncInterval);
                    state.autoSyncInterval = null;
                }
                this.showStatus('Auto-sync wyłączony', 'info');
                Storage.setString(STORAGE_KEYS.AUTO_SYNC, 'false');
            }
        },

        loadAutoSyncState() {
            if (!state.dom.autoSyncInput) return;

            const autoSyncPref = Storage.getString(STORAGE_KEYS.AUTO_SYNC);
            if (autoSyncPref === 'true') {
                state.dom.autoSyncInput.checked = true;
                this.toggleAutoSync();
            }
        },

        loadTokenState() {
            if (this.getToken() && state.dom.githubTokenInput) {
                state.dom.githubTokenInput.placeholder = 'Token zapisany ✓';
            }

            const gistId = this.getGistId();
            if (gistId) {
                if (state.dom.gistIdInput) {
                    state.dom.gistIdInput.value = gistId;
                }
                if (state.dom.gistInfo) {
                    state.dom.gistInfo.textContent = `Połączono z Gist ID: ${gistId.substring(0, 8)}...`;
                }
            }
        }
    };

    // ------------------------------------------------------------------------
    // EVENT HANDLERS
    // ------------------------------------------------------------------------

    const Handlers = {
        toggle(element) {
            const currentValue = parseInt(element.dataset.value);
            const newValue = currentValue === 1 ? 0 : 1;

            element.textContent = newValue;
            element.dataset.value = newValue;
            element.className = `toggle ${newValue ? 'on' : 'off'}`;

            CurrentWeek.save();
            CurrentWeek.updateSums();
            CurrentWeek.updateStats();
        },

        toggleDayOff(button) {
            const row = button.closest('tr');
            const isDayOff = row.classList.contains('day-off');

            DOM.setClass(row, 'day-off', !isDayOff);
            DOM.setClass(button, 'active', !isDayOff);

            CurrentWeek.save();
            CurrentWeek.updateSums();
            CurrentWeek.updateStats();
        },

        toggleArchive(element) {
            const index = element.dataset.index;
            const content = document.querySelector(`[data-archive-content="${index}"]`);
            const icon = document.querySelector(`[data-expand-icon="${index}"]`);

            content.classList.toggle('open');
            icon.classList.toggle('open');
        },

        dateChange() {
            CurrentWeek.save();
            CurrentWeek.updateStats();
        },

        notesChange() {
            CurrentWeek.save();
        },

        settingChange() {
            Settings.save();
        },

        switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            event.target.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');

            state.currentTab = tabName;

            if (tabName === 'history') {
                History.render();
                History.updateStats();
                Charts.render();
            } else if (tabName === 'current') {
                CurrentWeek.updateStats();
            }
        }
    };

    // ------------------------------------------------------------------------
    // EVENT DELEGATION
    // ------------------------------------------------------------------------

    function setupEventDelegation() {
        // Main container delegation
        document.querySelector('.container').addEventListener('click', (e) => {
            const target = e.target;
            const action = target.dataset.action;

            if (!action) return;

            switch (action) {
                case 'toggle':
                    Handlers.toggle(target);
                    break;
                case 'toggle-day-off':
                    Handlers.toggleDayOff(target);
                    break;
                case 'toggle-archive':
                    Handlers.toggleArchive(target);
                    break;
                case 'delete-archive':
                    const index = parseInt(target.dataset.index);
                    History.deleteItem(index);
                    break;
                case 'archive-week':
                    CurrentWeek.archive();
                    break;
                case 'reset-current':
                    CurrentWeek.reset();
                    break;
                case 'clear-history':
                    History.clear();
                    break;
                case 'save-token':
                    GitHub.saveToken();
                    break;
                case 'remove-token':
                    GitHub.removeToken();
                    break;
                case 'save-gist':
                    GitHub.syncToCloud();
                    break;
                case 'load-gist':
                    GitHub.syncFromCloud();
                    break;
                case 'sync-to-cloud':
                    GitHub.syncToCloud();
                    break;
                case 'sync-from-cloud':
                    GitHub.syncFromCloud();
                    break;
                case 'reset-all':
                    resetAll();
                    break;
            }
        });

        // Tab switching
        state.dom.tabs.addEventListener('click', (e) => {
            if (e.target.dataset.tab) {
                Handlers.switchTab(e.target.dataset.tab);
            }
        });

        // Input changes
        document.querySelector('.container').addEventListener('input', (e) => {
            const target = e.target;

            if (target.classList.contains('notes')) {
                Handlers.notesChange();
            } else if (target.dataset.input === 'date') {
                Handlers.dateChange();
            } else if (target.dataset.setting) {
                Handlers.settingChange();
            } else if (target.dataset.action === 'update-profit') {
                const index = parseInt(target.dataset.index);
                const value = target.value;
                History.updateProfit(index, value);
            }
        });

        // Auto-sync checkbox
        if (state.dom.autoSyncInput) {
            state.dom.autoSyncInput.addEventListener('change', () => {
                GitHub.toggleAutoSync();
            });
        }
    }

    // ------------------------------------------------------------------------
    // RESET ALL
    // ------------------------------------------------------------------------

    function resetAll() {
        if (!confirm('Czy na pewno chcesz wyczyścić WSZYSTKIE dane (tydzień + historia + ustawienia)? Ta operacja jest nieodwracalna!')) {
            return;
        }

        Storage.remove(STORAGE_KEYS.CURRENT_WEEK);
        Storage.remove(STORAGE_KEYS.HISTORY);
        Storage.remove(STORAGE_KEYS.SETTINGS);

        CurrentWeek.render();
        History.render();
        History.updateStats();
        Charts.render();
        Settings.load();

        alert('Wszystkie dane zostały wyczyszczone!');
    }

    // ------------------------------------------------------------------------
    // INITIALIZATION
    // ------------------------------------------------------------------------

    function init() {
        cacheDOM();
        setupEventDelegation();

        CurrentWeek.render();
        Settings.load();
        GitHub.loadTokenState();
        GitHub.loadAutoSyncState();
    }

    // Start application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
