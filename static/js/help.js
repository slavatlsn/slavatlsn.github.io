document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('preferred-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    if (initialTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = '🌙';
        themeToggle.title = 'Светлая тема';
    } else {
        themeToggle.textContent = '☀️';
        themeToggle.title = 'Темная тема';
    }
    
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});

function toggleTheme() {
    const btn = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Переключаем тему
    body.classList.toggle('dark-theme');
    
    // Обновляем состояние кнопки
    if (body.classList.contains('dark-theme')) {
        btn.textContent = '🌙';
        btn.title = 'Светлая тема';
        localStorage.setItem('preferred-theme', 'dark');
    } else {
        btn.textContent = '☀️';
        btn.title = 'Темная тема';
        localStorage.setItem('preferred-theme', 'light');
    }
}