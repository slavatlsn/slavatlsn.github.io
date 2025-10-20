// === УПРАВЛЕНИЕ ТЕМОЙ ========================

// --- Инициализация темы при загрузке страницы ---
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('preferred-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;


const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');

// Применяем выбранную тему к документу
if (initialTheme === 'dark') {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '🌙';
    themeToggle.title = 'Светлая тема';
} else {
    themeToggle.textContent = '☀️';
    themeToggle.title = 'Темная тема';
}

// Подключаем основную функциональность только когда весь HTML будет готов.

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});

// --- Основная функция переключения темы ---
function toggleTheme() {
    const btn = document.getElementById('theme-toggle');
    const body = document.body;
    body.classList.toggle('dark-theme');
    if (body.classList.contains('dark-theme')) {
        btn.textContent = '🌙'; 
        btn.title = 'Светлая тема'; 
        
        // Сохраняем выбор в браузере
        localStorage.setItem('preferred-theme', 'dark');
    } else {
        btn.textContent = '☀️';
        btn.title = 'Темная тема'; 
        
        // Сохраняем выбор в браузере
        localStorage.setItem('preferred-theme', 'light');
    }
}