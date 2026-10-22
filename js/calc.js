import { FIELDS } from './dom.js';

export const Calc = {
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

      const checks = day.checked || (day.toggles ? day.toggles.map(v => v === '1' || v === 1 || v === true) : []);

      checks.forEach((isChecked, fieldIndex) => {
        const val = isChecked ? 1 : 0;
        totalChecked += val;
        daySum += val;

        const fieldName = FIELDS[fieldIndex];
        if (categoryStats[fieldName]) {
          categoryStats[fieldName].checked += val;
          categoryStats[fieldName].total += 1;
        }
      });

      if (daySum === FIELDS.length) {
        perfectDays++;
      }
    });

    const totalPossible = activeDays * FIELDS.length;
    const percentage = totalPossible > 0 ? ((totalChecked / totalPossible) * 100).toFixed(1) : 0;

    return { totalChecked, totalPossible, percentage, perfectDays, activeDays, categoryStats };
  }
};
