export const DAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek"];
export const FIELDS = ["AlertMode", "Limit", "Aligned", "Reset 5min", "Process"];

export const FIELD_DESCRIPTIONS = {
    "AlertMode": "",
    "Limit": "",
    "Aligned": "",
    "Reset 5min": "",
    "Process": ""
};

export const STORAGE_KEYS = {
    CURRENT_WEEK: 'currentWeekData',
    HISTORY: 'weekHistory',
    SETTINGS: 'scorecardSettings'
};

export const DOM = {
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

export const Sanitize = {
    number(val, min = 0, max = 100) {
        const num = parseInt(val, 10);
        return isNaN(num) ? min : Math.max(min, Math.min(max, num));
    }
};