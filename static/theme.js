const THEME_KEY = 'automate-theme';

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = savedTheme || (prefersLight ? 'light' : 'dark');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  document.body.classList.toggle('bg-slate-50', theme === 'light');
  document.body.classList.toggle('bg-slate-950', theme === 'dark');
  document.body.classList.toggle('text-slate-900', theme === 'light');
  document.body.classList.toggle('text-slate-100', theme === 'dark');
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const next = isDark ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', next === 'dark');
  document.documentElement.classList.toggle('light', next === 'light');
  localStorage.setItem(THEME_KEY, next);
  document.body.classList.toggle('bg-slate-50', next === 'light');
  document.body.classList.toggle('bg-slate-950', next === 'dark');
  document.body.classList.toggle('text-slate-900', next === 'light');
  document.body.classList.toggle('text-slate-100', next === 'dark');
}
