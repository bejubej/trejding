import { STORAGE_KEYS } from './dom.js';
import { Storage } from './storage.js';
import { CurrentWeek } from './currentWeek.js';
import { History } from './history.js';
import { Charts } from './charts.js';
import { Settings } from './settings.js';
import { state } from './app.js';

export const FileBackup = {
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
