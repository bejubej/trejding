import { STORAGE_KEYS, Sanitize } from './dom.js';
import { Storage } from './storage.js';
import { CurrentWeek } from './currentWeek.js';
import { History } from './history.js';
import { state } from './app.js';

export const Settings = {
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
