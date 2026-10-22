import { DAYS, FIELDS, FIELD_DESCRIPTIONS, DOM } from './dom.js';

export const Templates = {
  checkbox(checked = false) {
    const el = DOM.create('input', 'rule-checkbox', { type: 'checkbox' });
    el.checked = checked;
    return el;
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
  tableRow(dayIndex, dayName, checkedValues = [], isDayOff = false) {
    const tr = DOM.create('tr', isDayOff ? 'day-off' : '', { data: { dayIndex: dayIndex } });

    const dayCell = DOM.create('td', 'day-cell');
    dayCell.appendChild(DOM.text(dayName + ' '));
    dayCell.appendChild(Templates.dayOffButton(isDayOff));
    tr.appendChild(dayCell);

    FIELDS.forEach((_, fieldIndex) => {
      const td = DOM.create('td');
      const isChecked = checkedValues[fieldIndex] !== undefined ? !!checkedValues[fieldIndex] : false;
      const cb = Templates.checkbox(isChecked);
      if (isDayOff) cb.disabled = true;
      td.appendChild(cb);
      tr.appendChild(td);
    });

    const sumCell = DOM.create('td', 'sumCell');
    sumCell.textContent = `0/${FIELDS.length}`;
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
      let checkedValues = [];
      let isDayOff = false;

      if (weekData && weekData.days && weekData.days[index]) {
        const dayData = weekData.days[index];
        checkedValues = dayData.checked || [];
        isDayOff = dayData.isDayOff || false;
      }

      tbody.appendChild(Templates.tableRow(index, day, checkedValues, isDayOff));
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
    // Zatrzymanie propagacji, aby kliknięcie w pole edycji zysku nie zwijało/rozwijało całego akordeonu
    profitInput.addEventListener('click', (e) => e.stopPropagation());
    profitContainer.appendChild(profitInput);

    const deleteBtn = DOM.create('button', 'archive-delete-btn', { data: { action: 'delete-archive', index: index } });
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', (e) => e.stopPropagation());

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
      const isDayOff = day.isDayOff || false;
      const tr = DOM.create('tr', isDayOff ? 'day-off' : '');
      const dayCell = DOM.create('td', 'day-cell');
      dayCell.textContent = DAYS[index];
      if (isDayOff) {
        dayCell.appendChild(DOM.text(' '));
        dayCell.appendChild(Templates.dayOffButton(true));
      }
      tr.appendChild(dayCell);

      let daySum = 0;
      const checkedArr = day.checked || [];
      checkedArr.forEach(isChecked => {
        const val = isChecked ? 1 : 0;
        daySum += val;
        const td = DOM.create('td');
        const cb = Templates.checkbox(isChecked);
        cb.disabled = true; // w archiwum podgląd jest tylko do odczytu
        td.appendChild(cb);
        tr.appendChild(td);
      });

      const sumCell = DOM.create('td', 'sumCell');
      if (isDayOff) {
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
