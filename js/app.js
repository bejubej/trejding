import { DOM } from './dom.js';
import { CurrentWeek } from './currentWeek.js';
import { History } from './history.js';
import { Charts } from './charts.js';
import { Settings } from './settings.js';
import { FileBackup } from './backup.js';

export const state = {
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
        state.dom.currentWeek.addEventListener('change', () => {
            CurrentWeek.updateSums();
            CurrentWeek.updateStats();
            CurrentWeek.save();
        });

        state.dom.currentWeek.addEventListener('input', () => {
            CurrentWeek.save();
        });

        state.dom.currentWeek.addEventListener('click', e => {
            const dayOffBtn = e.target.closest('[data-action="toggle-day-off"]');
            if (dayOffBtn) {
                const row = dayOffBtn.closest('tr');
                if (row) {
                    row.classList.toggle('day-off');
                    dayOffBtn.classList.toggle('active');
                    const isOff = row.classList.contains('day-off');
                    row.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                        cb.disabled = isOff;
                        if (isOff) cb.checked = false;
                    });
                    CurrentWeek.updateSums();
                    CurrentWeek.updateStats();
                    CurrentWeek.save();
                }
            }
        });
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