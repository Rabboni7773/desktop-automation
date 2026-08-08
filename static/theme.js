const THEME_KEY = 'automate-theme';

function _applyTheme(theme) {
  const isLight = theme === 'light';
  const isDark = theme === 'dark';

  // <html> class — drives Tailwind dark: variants
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.classList.toggle('light', isLight);

  // <body> background + text
  document.body.classList.toggle('bg-slate-50', isLight);
  document.body.classList.toggle('bg-slate-950', isDark);
  document.body.classList.toggle('text-slate-900', isLight);
  document.body.classList.toggle('text-slate-100', isDark);

  // #app background (bg was removed from HTML so theme.js owns it)
  const app = document.getElementById('app');
  if (app) {
    app.classList.toggle('bg-slate-50', isLight);
    app.classList.toggle('bg-slate-950', isDark);
  }
}

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = savedTheme || (prefersLight ? 'light' : 'dark');
  _applyTheme(theme);
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  _applyTheme(next);
}
