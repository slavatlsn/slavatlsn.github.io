// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===

// Текущий выбранный инструмент (например, 'position', 'transition')
let currentTool = '';

// Основной объект сети Петри
let network = { 
    positions: {}, // Хранит позиции по их ID
    transitions: [], // Массив переходов
    arcs: {} // Хранит дуги по их ID
};

// Резервная копия начальной маркировки для сброса
let network_backup = {};

// Переменные для работы с canvas
let canvas = null;
let ctx = null;

// Переменные для отслеживания перетаскивания элементов
let isDragging = false;
let draggedElement = null;

// Переменная для хранения начальной точки при рисовании дуги
let arcStartPoint = null;

// Счетчик для генерации уникальных ID дуг
let nextArcId = 1;

// Выбранный элемент и его тип для редактирования свойств
let selectedElement = null;
let selectedElementType = null;

// Переменные для управления непрерывной симуляцией
let simulationInterval = null;
let currentSpeed = 5; // Значение скорости по умолчанию

// Таблица соответствия значений ползунка и времени задержки (в мс)
// Чем выше значение - тем быстрее симуляция
const speedSteps = [1500, 1200, 1000, 800, 600, 500, 400, 300, 250, 200, 180, 160, 140, 120, 100, 80, 70, 60, 50, 40]; 

// === ИНИЦИАЛИЗАЦИЯ ТЕМЫ ===

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

// === ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ===
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('petri-net-canvas');
    ctx = canvas.getContext('2d');

    // Настройка слушателей изменений свойств элементов
    setupPropertyListeners();

    // Устанавливаем начальное состояние интерфейса
    showProperties(currentTool);
    updateCursor();
    setupTools();

    // === НАСТРОЙКА КНОПОК ===
    document.getElementById('analyze-btn').addEventListener('click', startAnalysis);
    document.getElementById('analysis-modal').addEventListener('click', function(e) {
        if (e.target === this) closeAnalysisModal();
    });
    document.getElementById('new-network-btn').addEventListener('click', newNetwork);
    document.getElementById('load-example-btn').addEventListener('click', showExamples);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('save-btn').addEventListener('click', saveNetwork);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('mark-save-btn').addEventListener('click', saveMarkup);
    document.getElementById('step-btn').addEventListener('click', stepSimulation);
    document.getElementById('play-btn').addEventListener('click', toggleSimulation);

    // === ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ ===
    // Закрытие модального окна примеров при клике вне его области
    document.getElementById('examples-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeExamplesModal();
        }
    });

    // Настройка регулятора скорости симуляции
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    
    speedSlider.addEventListener('input', function() {
        currentSpeed = parseInt(this.value);
        speedValue.textContent = `${currentSpeed}x`;
        /* Будущая функциональность: изменение скорости "на лету"
        if (btn.textContent.includes('Пауза')) {
            clearInterval(simulationInterval);
            simulationInterval = setInterval(runSimulationStep, speedSteps[currentSpeed - 1]);
        }*/
    });

    // Обработчики для загрузки сети из файла
    document.getElementById('load-network-btn').addEventListener('click', () => {
        document.getElementById('load-network-input').click();
    });
    document.getElementById('load-network-input').addEventListener('change', loadNetworkFromFile);

    // Снятие выделения инструмента по клавише Escape
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' || event.key === 'Esc') {
            currentTool = '';
            document.querySelectorAll('.tool-button').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            updateCursor();
            showProperties(currentTool);
        }
    });

    // Закрытие модальных окон по клавише Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('examples-modal').style.display === 'flex') {
            closeExamplesModal();
        }
    });

    // === ОБРАБОТЧИКИ СОБЫТИЙ ХОЛСТА ===
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('contextmenu', disable);
    resizeCanvas(); // Первоначальная настройка размера
    
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', endDrag);

    // Инициализация холста (очистка)
    initCanvas();
});

// === АНАЛИЗ СЕТИ ПЕТРИ ===

// Запуск анализа сети
function startAnalysis() {
    document.getElementById('analysis-modal').style.display = 'flex';
    const resultsDiv = document.getElementById('analysis-results');
    resultsDiv.innerHTML = '<p>Выполняется анализ...</p>';
    
    // Задержка для обновления UI перед тяжелым расчетом
    setTimeout(() => {
        performAnalysis(resultsDiv);
    }, 100);
}

// Закрытие модального окна анализа
function closeAnalysisModal() {
    document.getElementById('analysis-modal').style.display = 'none';
}

// Основная функция анализа сети
function performAnalysis(resultsDiv) {
    let html = '';

    // 1. Проверка ограниченности (Safety)
    const maxSteps = 10;
    const analysisResult = simulateReachableStates(maxSteps);
    const isSafe = analysisResult.maximum <= 1;
    
    html += `
    <div class="analysis-item ${isSafe ? 'safe' : 'unsafe'}">
        <h4>Ограниченность</h4>
        <p>${analysisResult.finish 
            ? `✅ Сеть ограничена: все позиции ограничены (число фишек не более ${analysisResult.maximum}).` 
            : `⚠️ Сеть может не быть ограниченной: максимальное количество фишек в одной позиции — <strong>${analysisResult.maximum}</strong>.`}</p>
    </div>`;

    // 2. Проверка живости (Liveness)
    let livenessMessage = '';
    let livenessLevel = '';
    
    if (network.transitions.length === 0) {
        livenessLevel = 'dead';
        livenessMessage = '❌ Сеть мертва: нет переходов.';
    } else if (analysisResult.num_blockages === 0) {
        livenessLevel = 'live';
        livenessMessage = `✅ Сеть L-живая: все переходы могут сработать. За ${maxSteps} шагов найдено ${analysisResult.len} состояний.`;
    } else {
        livenessLevel = 'quasi-live';
        livenessMessage = `🟡 Сеть квазиживая: обнаружены блокировки. За ${maxSteps} шагов некоторые переходы не могли сработать (случаев: ${analysisResult.num_blockages}).`;
    }
    
    html += `
    <div class="analysis-item ${livenessLevel}">
        <h4>Живость</h4>
        <p>${livenessMessage}</p>
    </div>`;

    // 3. Анализ достижимости
    html += `
    <div class="analysis-item">
        <h4>Достижимость</h4>
        <p>Проведен анализ на <strong>${analysisResult.steps_num}</strong> уровн${analysisResult.steps_num % 10 === 1 ? 'е': 'ях'} симуляции.</p>
        <p>Обнаружено <strong>${analysisResult.len}</strong> уникальных состояний маркировки.</p>
        <p>Зафиксировано <strong>${analysisResult.num_blockages}</strong> случаев, когда переходы не могли сработать.</p>
        <p>${analysisResult.finish 
            ? 'Анализ завершен полностью.' 
            : 'Анализ прерван: достигнут лимит шагов. Возможны дополнительные состояния.'}</p>
    </div>`;

    // 4. Статистика сети
    html += `
    <div class="analysis-item">
        <h4>Статистика сети</h4>
        <p>Позиции: ${Object.keys(network.positions).length}, Переходы: ${network.transitions.length}, Дуги: ${Object.keys(network.arcs).length}</p>
    </div>`;

    resultsDiv.innerHTML = html;
}



// Симуляция достижимых состояний
function simulateReachableStates(maxSteps) {
    let visited = new Set();
    let max_marks = 0;
    let blockages = 0;
    let steps = 0;
    let now_mark = [getCurrentMarking()];
    
    while (now_mark.length > 0 && steps < maxSteps) {
        let new_mark = [];
        for(let i = 0; i < now_mark.length; i++) {
            const marking = now_mark[i];
            const stateKey = JSON.stringify(marking);
            alert(stateKey);
            if (visited.has(stateKey)) continue; // Пропускаем уже посещённые состояния
            visited.add(stateKey);
            for (const posId in marking) {
                if (marking[posId] > max_marks) 
                {
                    max_marks = marking[posId];
                }
            }
            // Пробуем все возможные переходы из этого состояния
            for (const transition of network.transitions) {
                if (canTransitionFireInMarking(transition, marking)) {
                    const newMarking = fireTransitionInMarking(transition, marking);
                    new_mark.push(newMarking);
                } else {
                    blockages++;
                }
            }
        }
        now_mark = new_mark;
        steps++;
    }
    return {maximum: max_marks, finish: steps < maxSteps, len: visited.size, num_blockages: blockages, steps_num: steps};
}

// Получение текущей маркировки сети
function getCurrentMarking() {
    let marking = {};
    for (const posId in network.positions) {
        marking[posId] = network.positions[posId].tokens;
    }
    return marking;
}

// Проверка, может ли переход сработать при данной маркировке
function canTransitionFireInMarking(transition, marking) {
    return transition.input.every(arcId => {
        const arc = network.arcs[arcId];
        const tokens = marking[arc.positionId] || 0;
        return (arc.isInhibitor && tokens < arc.weight) ||
               (!arc.isInhibitor && tokens >= arc.weight);
    });
}

// Моделирование срабатывания перехода без изменения реальной сети
function fireTransitionInMarking(transition, marking) {
    let newMarking = marking;
    
    // Удаляем фишки
    transition.input.forEach(arcId => {
        const arc = network.arcs[arcId];
        const posId = arc.positionId;
        if (newMarking[posId] !== undefined && !arc.isInhibitor) {
            newMarking[posId] -= arc.weight;
        }
    });
    
    // Добавляем фишки
    transition.output.forEach(arcId => {
        const arc = network.arcs[arcId];
        const posId = arc.positionId;
        if (newMarking[posId] === undefined) newMarking[posId] = 0;
        newMarking[posId] += arc.weight;
    });
    
    return newMarking;
}

// === РАБОТА С ПРИМЕРАМИ ===

// Показ модального окна с примерами
function showExamples() {
    document.getElementById('examples-modal').style.display = 'flex';
}

// Закрытие модального окна с примерами
function closeExamplesModal() {
    document.getElementById('examples-modal').style.display = 'none';
}

// Загрузка примера сети
function loadExample(exampleId) {
    let exampleNetwork = null;
    
    switch (exampleId) {
        case 'producer-consumer':
            exampleNetwork = {
                positions: {
                    'p1': { id: 'p1', x: 200, y: 150, name: 'Буфер пуст', tokens: 1 },
                    'p2': { id: 'p2', x: 400, y: 150, name: 'Буфер полон', tokens: 0 }
                },
                transitions: [
                    { id: 't1', x: 300, y: 100, name: 'Производить', input: ['a2'], output: ['a1'], guard: '', delay: 0 },
                    { id: 't2', x: 300, y: 200, name: 'Потреблять', input: ['a1'], output: ['a2'], guard: '', delay: 0 }
                ],
                arcs: {
                    'a1': { id: 'a1', positionId: 'p2', weight: 1, isInhibitor: false },
                    'a2': { id: 'a2', positionId: 'p1', weight: 1, isInhibitor: false }
                }
            };
            break;
            
        case 'fork-join':
            exampleNetwork = {
                positions: {
                    'p1': { id: 'p1', x: 150, y: 200, name: 'P1', tokens: 1 },
                    'p2': { id: 'p2', x: 300, y: 100, name: 'P2', tokens: 0 },
                    'p3': { id: 'p3', x: 300, y: 300, name: 'P3', tokens: 0 },
                    'p4': { id: 'p4', x: 450, y: 200, name: 'P4', tokens: 0 }
                },
                transitions: [
                    { id: 't1', x: 225, y: 200, name: 'Fork', input: ['a1'], output: ['a2', 'a3'], guard: '', delay: 0 },
                    { id: 't2', x: 375, y: 200, name: 'Join', input: ['a4', 'a5'], output: ['a6'], guard: '', delay: 0 }
                ],
                arcs: {
                    'a1': { id: 'a1', positionId: 'p1', weight: 1, isInhibitor: false },
                    'a2': { id: 'a2', positionId: 'p2', weight: 1, isInhibitor: false },
                    'a3': { id: 'a3', positionId: 'p3', weight: 1, isInhibitor: false },
                    'a4': { id: 'a4', positionId: 'p2', weight: 1, isInhibitor: false },
                    'a5': { id: 'a5', positionId: 'p3', weight: 1, isInhibitor: false },
                    'a6': { id: 'a6', positionId: 'p4', weight: 1, isInhibitor: false }
                }
            };
            break;
            
        case 'inhibitor':
            exampleNetwork = {
                positions: {
                    'p1': { id: 'p1', x: 150, y: 200, name: 'P1', tokens: 1 },
                    'p2': { id: 'p2', x: 300, y: 150, name: 'P2', tokens: 0 },
                    'p3': { id: 'p3', x: 450, y: 200, name: 'P3', tokens: 0 }
                },
                transitions: [
                    { id: 't1', x: 225, y: 200, name: 'T1', input: ['a1'], output: ['a2'], guard: '', delay: 0 },
                    { id: 't2', x: 375, y: 200, name: 'T2', input: ['a3', 'a4'], output: ['a5'], guard: '', delay: 0 }
                ],
                arcs: {
                    'a1': { id: 'a1', positionId: 'p1', weight: 1, isInhibitor: false },
                    'a2': { id: 'a2', positionId: 'p2', weight: 1, isInhibitor: false },
                    'a3': { id: 'a3', positionId: 'p1', weight: 1, isInhibitor: false },
                    'a4': { id: 'a4', positionId: 'p2', weight: 1, isInhibitor: true },
                    'a5': { id: 'a5', positionId: 'p3', weight: 1, isInhibitor: false }
                }
            };
            break;
            
        default:
            return;
    }

    // Загружаем сеть
    network = exampleNetwork;
    
    // Обновляем счетчик ID дуг
    let maxArcId = 1;
    for (const arcId in network.arcs) {
        const numId = parseInt(arcId.replace('a', ''));
        if (!isNaN(numId) && numId >= maxArcId) {
            maxArcId = numId + 1;
        }
    }
    nextArcId = maxArcId;
    
    // Сбрасываем выбор элемента
    selectedElement = null;
    selectedElementType = null;
    
    // Перерисовываем
    render();
    
    // Закрываем модальное окно
    network_backup = {};
    closeExamplesModal();
}

// === РАБОТА С ФАЙЛАМИ ===

// Сохранение сети в файл
function saveNetwork() {
    try {
        const dataStr = JSON.stringify(network, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'petri-network.json';
        link.click();

        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Ошибка при сохранении:', error);
        alert('Не удалось сохранить файл');
    }
}

// Загрузка сети из файла
function loadNetworkFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const loadedNetwork = JSON.parse(e.target.result);
            
            // Валидация структуры данных
            if (loadedNetwork.positions !== undefined && 
                loadedNetwork.transitions !== undefined && 
                loadedNetwork.arcs !== undefined) {
                
                // Загружаем сеть
                network = loadedNetwork;
                
                // Обновляем nextArcId
                let maxArcId = 1;
                for (const arcId in network.arcs) {
                    const numId = parseInt(arcId.replace('a', ''));
                    if (!isNaN(numId) && numId >= maxArcId) {
                        maxArcId = numId + 1;
                    }
                }
                nextArcId = maxArcId;
                
                // Сбрасываем выбор элемента
                selectedElement = null;
                selectedElementType = null;
                
                // Перерисовываем
                render();
                network_backup = {};
                
                // Очистка поля ввода
                event.target.value = '';
                
            } else {
                throw new Error('Некорректный формат файла');
            }
        } catch (error) {
            console.error('Ошибка при загрузке сети:', error);
            alert('Не удалось загрузить файл. Проверьте формат файла.');
            event.target.value = ''; // Очистка в случае ошибки
        }
    };
    
    reader.onerror = function() {
        alert('Ошибка при чтении файла');
        event.target.value = '';
    };
    
    reader.readAsText(file);
    render();
}

// === РАБОТА С СВОЙСТВАМИ ЭЛЕМЕНТОВ ===

// Настройка слушателей изменений свойств
function setupPropertyListeners() {
    document.getElementById('token-count').addEventListener('change', () => {
        if (selectedElementType === 'position' && selectedElement) {
            network.positions[selectedElement.id].tokens = parseInt(document.getElementById('token-count').value) || 0;
            render();
        }
    });
    
    document.getElementById('position-type').addEventListener('change', () => {
        if (selectedElementType === 'position' && selectedElement) {
            network.positions[selectedElement.id].type = document.getElementById('position-type').value;
            render();
        }
    });
    
    document.getElementById('guard-condition').addEventListener('change', () => {
        if (selectedElementType === 'transition' && selectedElement) {
            network.transitions[selectedElement.id].guard = document.getElementById('guard-condition').value;
            render();
        }
    });
    
    document.getElementById('transition-delay').addEventListener('change', () => {
        if (selectedElementType === 'transition' && selectedElement) {
            network.transitions[selectedElement.id].delay = parseFloat(document.getElementById('transition-delay').value) || 0;
            render();
        }
    });
    
    document.getElementById('arc-weight').addEventListener('change', () => {
        if (selectedElementType === 'arc' && selectedElement) {
            network.arcs[selectedElement.id].weight = parseInt(document.getElementById('arc-weight').value) || 1;
            render();
        }
    });
    
    document.getElementById('arc-type').addEventListener('change', () => {
        if (selectedElementType === 'arc' && selectedElement) {
            network.arcs[selectedElement.id].isInhibitor = document.getElementById('arc-type').value === 'red';
            render();
        }
    });
}

// Вызов один раз при старте
setupPropertyListeners();

// === ИНСТРУМЕНТЫ И СВОЙСТВА ===

// Настройка кнопок инструментов
function setupTools() {
    document.querySelectorAll('.tool-button').forEach(button => {
        button.addEventListener('click', function () {
            document.querySelectorAll('.tool-button').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');
            currentTool = this.getAttribute('data-tool');
            showProperties(currentTool);
            updateCursor();
        });
    });
}

// Обновление курсора в зависимости от выбранного инструмента
function updateCursor() {
    if (currentTool === 'move') {
        canvas.style.cursor = 'move';
    } else if (currentTool === 'delete') {
        canvas.style.cursor = 'pointer';
    } else if (currentTool === 'arc') {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'crosshair';
    }
}

// Отображение соответствующей панели свойств
function showProperties(tool) {
    document.querySelectorAll('.property-group').forEach(group => {
        group.style.display = 'none';
    });
    
    if (tool === 'position') {
        document.getElementById('position-properties').style.display = 'block';
    } else if (tool === 'transition') {
        document.getElementById('transition-properties').style.display = 'block';
    } else if (tool === 'arc') {
        document.getElementById('arc-properties').style.display = 'block';
    } else {
        document.getElementById('default-properties').style.display = 'block';
    }
}

// === РАБОТА С ХОЛСТОМ ===

// Инициализация холста (очистка)
function initCanvas() {
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#1a1a1a' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Изменение размера холста при изменении размера окна
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth * 0.95;
    canvas.height = container.clientHeight * 0.95;
    render();
}

// Поиск элемента под указателем мыши
function findElementAtPosition(x, y) {
    // Поиск позиций
    for (const posId in network.positions) {
        const pos = network.positions[posId];
        const dx = x - pos.x;
        const dy = y - pos.y;
        if (dx * dx + dy * dy <= 20 * 20) {
            return { type: 'position', element: pos, id: posId };
        }
    }
    
    // Поиск переходов
    for (let i = 0; i < network.transitions.length; i++) {
        let tr = network.transitions[i];
        if (x >= tr.x - 5 && x <= tr.x + 5 &&
            y >= tr.y - 15 && y <= tr.y + 15) {
            return { type: 'transition', element: tr, id: i };
        }
    }
    
    // Поиск дуг
    for (let transition of network.transitions) {
        // Проверяем входные дуги
        for (let arcId of transition.input) {
            const arc = network.arcs[arcId];
            if (arc) {
                const position = network.positions[arc.positionId];
                const toElement = transition;
                if (position && findArcAtPosition(x, y, position, toElement)) {
                    return { 
                        type: 'arc', 
                        element: arc,
                        id: arcId,
                        from: position,
                        to: toElement
                    };
                }
            }
        }
        
        // Проверяем выходные дуги
        for (let arcId of transition.output) {
            const arc = network.arcs[arcId];
            if (arc) {
                const fromElement = transition;
                const position = network.positions[arc.positionId];
                if (position && findArcAtPosition(x, y, fromElement, position)) {
                    return { 
                        type: 'arc', 
                        element: arc,
                        id: arcId,
                        from: fromElement,
                        to: position
                    };
                }
            }
        }
    }
    
    return null;
}

// Проверка, находится ли точка близко к дуге
function findArcAtPosition(x, y, from, to) {
    const TOLERANCE = 10;
    const POSITION_RADIUS = 20;
    const TRANSITION_SIZE = 5;
    
    let startX, startY, endX, endY;
    
    if (from.hasOwnProperty('input')) { // from - это переход
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const ratioFrom = TRANSITION_SIZE / distance;
        const ratioTo = POSITION_RADIUS / distance;
        
        startX = from.x + dx * ratioFrom;
        startY = from.y + dy * ratioFrom;
        endX = to.x - dx * ratioTo;
        endY = to.y - dy * ratioTo;
    } else { // from - это позиция
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const ratioFrom = POSITION_RADIUS / distance;
        const ratioTo = TRANSITION_SIZE / distance;
        
        startX = from.x + dx * ratioFrom;
        startY = from.y + dy * ratioFrom;
        endX = to.x - dx * ratioTo;
        endY = to.y - dy * ratioTo;
    }
    
    const distance = distanceFromPointToLine(x, y, startX, startY, endX, endY);
    return distance <= TOLERANCE;
}

// Вычисление расстояния от точки до линии
function distanceFromPointToLine(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
}

// Поиск элемента по ID
function findElementById(id) {
    if (network.positions[id]) {
        return network.positions[id];
    }
    return network.transitions.find(t => t.id === id);
}

// === ОБРАБОТЧИКИ СОБЫТИЙ МЫШИ И МАНИПУЛЯЦИИ С ЭЛЕМЕНТАМИ ===

// Обработка нажатия кнопки мыши
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'arc') {
        const element = findElementAtPosition(x, y);
        if (element) {
            arcStartPoint = {
                elementId: element.element.id,
                x: element.element.x,
                y: element.element.y,
                type: element.type
            };
            canvas.style.cursor = 'cell';
        }
    } else if (currentTool === 'move') {
        startDrag(e);
    } else if (currentTool === 'delete') {
        const element = findElementAtPosition(x, y);
        if (element) {
            removeElement(element);
            render();
        }
    } else if (currentTool === 'token') {
        const element = findElementAtPosition(x, y);
        if (element && element.type === 'position') {
            if(e.button === 0) {
                element.element.tokens += 1;
            } else if (e.button === 2 && element.element.tokens > 0) {
                element.element.tokens -= 1;
            }
            render();
        }
    } else {
        if (currentTool === 'position') {
            const id = 'p' + Date.now();
            const name = `P${Object.keys(network.positions).length + 1}`;
            network.positions[id] = {
                id,
                x,
                y,
                name,
                tokens: parseInt(document.getElementById("token-count").value) || 0,
                type: document.getElementById("position-type").value
            };
            render();
        } else if (currentTool === 'transition') {
            const id = 't' + Date.now();
            const name = `T${network.transitions.length + 1}`;
            network.transitions.push({
                id,
                x,
                y,
                name,
                input: [],
                output: [],
                guard: document.getElementById("guard-condition").value || "",
                delay: parseInt(document.getElementById("transition-delay").value) || 0
            });
            render();
        } else {
            const element = findElementAtPosition(x, y);
            if (element) {
                selectedElement = element;
                selectedElementType = element.type;
                showProperties(element.type);
                if (element.type === 'position') {
                    document.getElementById("position-name").value = element.element.name;
                    document.getElementById("token-count").value = element.element.tokens;
                    document.getElementById("position-type").value = element.element.type;
                } else if (element.type === 'transition') {
                    document.getElementById("guard-condition").value = element.element.guard;
                    document.getElementById("transition-delay").value = element.element.delay;
                    document.getElementById("transition-name").value = element.element.name;
                } else if (element.type === 'arc') {
                    document.getElementById('arc-weight').value = element.element.weight;
                    document.getElementById('arc-type').value = element.element.isInhibitor ? "red" : "default";
                }
                render();
            }
        }
    }
}

// Обработка отпускания кнопки мыши
function handleMouseUp(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'arc' && arcStartPoint) {
        const element = findElementAtPosition(x, y);
        
        if (element && element.element.id !== arcStartPoint.elementId) {
            const fromIsPosition = arcStartPoint.type === 'position';
            const toIsPosition = element.type === 'position';
            const isValidConnection = (fromIsPosition && !toIsPosition) || (!fromIsPosition && toIsPosition);
            const hasExistingArc = false;

            if (isValidConnection && !hasExistingArc) {
                const weight = parseInt(document.getElementById('arc-weight').value) || 1;
                const isInhibitor = document.getElementById('arc-type').value === 'red';
                
                const arcId = 'a' + (nextArcId++);
                const newArc = {
                    id: arcId,
                    positionId: fromIsPosition ? arcStartPoint.elementId : element.element.id,
                    weight: weight,
                    isInhibitor: isInhibitor && fromIsPosition
                };

                if(isInhibitor && !fromIsPosition) {
                    alert('Дуга от перехода к позиции не может иметь тип "ингибитор"');
                }
                
                network.arcs[arcId] = newArc;
                
                if (fromIsPosition) {
                    const transition = network.transitions.find(t => t.id === element.element.id);
                    if (transition) {
                        transition.input.push(arcId);
                    }
                } else {
                    const transition = network.transitions.find(t => t.id === arcStartPoint.elementId);
                    if (transition) {
                        transition.output.push(arcId);
                    }
                }
            } else {
                if(!isValidConnection) {
                    alert('Недопустимое соединение! Дуга должна соединять позицию с переходом или переход с позицией.');
                }
                if(hasExistingArc) {
                    alert('Ошибка: Дуга между этими элементами уже существует!\nУдалите существующую дугу перед созданием новой.');
                }
            }
        }
        
        arcStartPoint = null;
        canvas.style.cursor = 'crosshair';
        render();
    } else if (currentTool === 'move') {
        endDrag();
    }
}

// Обработка движения мыши
function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'arc' && arcStartPoint) {
        render();
        ctx.beginPath();
        ctx.moveTo(arcStartPoint.x, arcStartPoint.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#888';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    if (isDragging && draggedElement) {
        drag(e);
    }
}

// Начало перетаскивания
function startDrag(e) {
    if (currentTool !== 'move') return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const element = findElementAtPosition(x, y);
    if (element) {
        isDragging = true;
        draggedElement = element;
        canvas.style.cursor = 'grabbing';
    }
}

// Процесс перетаскивания
function drag(e) {
    if (!isDragging || !draggedElement) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    draggedElement.element.x = x;
    draggedElement.element.y = y;
    render();
}

// Завершение перетаскивания
function endDrag() {
    isDragging = false;
    draggedElement = null;
    canvas.style.cursor = 'crosshair';
}

// Удаление элемента из сети
function removeElement(element) {
    if (element.type === 'position') {
        delete network.positions[element.element.id];
        
        network.transitions.forEach(transition => {
            transition.input = transition.input.filter(arcId => {
                const arc = network.arcs[arcId];
                if (arc && arc.positionId === element.element.id) {
                    delete network.arcs[arcId];
                    return false;
                }
                return true;
            });
            
            transition.output = transition.output.filter(arcId => {
                const arc = network.arcs[arcId];
                if (arc && arc.positionId === element.element.id) {
                    delete network.arcs[arcId];
                    return false;
                }
                return true;
            });
        });
    } else if (element.type === 'transition') {
        network.transitions = network.transitions.filter(t => t.id !== element.element.id);
        
        const allArcIds = [...element.element.input, ...element.element.output];
        allArcIds.forEach(arcId => {
            if (network.arcs[arcId]) {
                delete network.arcs[arcId];
            }
        });
    } else if (element.type === 'arc') {
        delete network.arcs[element.element.id];
        
        network.transitions.forEach(transition => {
            transition.input = transition.input.filter(id => id !== element.element.id);
            transition.output = transition.output.filter(id => id !== element.element.id);
        });
    }
}

// === ОТРИСОВКА ===

// Основная функция отрисовки сети
function render() {
    initCanvas();
    drawArcs();
    
    for (const posId in network.positions) {
        drawPosition(network.positions[posId]);
    }
    
    network.transitions.forEach(transition => {
        drawTransition(transition);
    });
}

// Отрисовка всех дуг
function drawArcs() {
    network.transitions.forEach(transition => {
        transition.input.forEach(arcId => {
            const arc = network.arcs[arcId];
            if (arc) {
                const position = network.positions[arc.positionId];
                if (position) {
                    drawSingleArc(position, transition, arc.weight, arc.isInhibitor);
                }
            }
        });
        
        transition.output.forEach(arcId => {
            const arc = network.arcs[arcId];
            if (arc) {
                const position = network.positions[arc.positionId];
                if (position) {
                    drawSingleArc(transition, position, arc.weight, arc.isInhibitor);
                }
            }
        });
    });
}

// Отрисовка одной дуги
function drawSingleArc(from, to, weight, isInhibitor = false) {
    let startX, startY, endX, endY;
    const POSITION_RADIUS = 20;
    const TRANSITION_SIZE = 5;
    
    if (from.hasOwnProperty('input')) {
        startX = from.x;
        startY = from.y;
        
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const ratioFrom = TRANSITION_SIZE / distance;
        startX = from.x + dx * ratioFrom;
        startY = from.y + dy * ratioFrom;
        
        const ratioTo = POSITION_RADIUS / distance;
        endX = to.x - dx * ratioTo;
        endY = to.y - dy * ratioTo;
    } else {
        endX = to.x;
        endY = to.y;
        
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const ratioFrom = POSITION_RADIUS / distance;
        startX = from.x + dx * ratioFrom;
        startY = from.y + dy * ratioFrom;
        
        const ratioTo = TRANSITION_SIZE / distance;
        endX = to.x - dx * ratioTo;
        endY = to.y - dy * ratioTo;
    }
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    
    const lineColor = isInhibitor ? 
        (document.body.classList.contains('dark-theme') ? '#ff6b6b' : '#d63031') : 
        (document.body.classList.contains('dark-theme') ? '#888' : '#555');
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = isInhibitor ? 3 : 2;
    
    if (isInhibitor) {
        ctx.setLineDash([8, 4]);
    }
    
    ctx.stroke();
    ctx.setLineDash([]);
    
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowSize = 10;
    
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(
        midX - arrowSize * Math.cos(angle - Math.PI / 6),
        midY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        midX - arrowSize * Math.cos(angle + Math.PI / 6),
        midY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = lineColor;
    ctx.fill();
    
    if (weight > 0) {
        ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ccc' : '#000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(weight, midX, midY - 20);
    }
}

// Отрисовка позиции
function drawPosition(pos) {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = document.body.classList.contains('dark-theme') ? '#667' : '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ddd' : '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pos.name, pos.x, pos.y + 35);
    
    if (pos.tokens >= 0) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.fillStyle = '#667';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pos.tokens, pos.x, pos.y);
    }
}

// Отрисовка перехода
function drawTransition(tr) {
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ddd' : '#000';
    ctx.fillRect(tr.x - 5, tr.y - 15, 10, 30);
    
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ddd' : '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tr.name, tr.x, tr.y + 30);
}

// === БАЗОВЫЕ ФУНКЦИИ ===

// Создание новой пустой сети
function newNetwork() {
    network = { positions: {}, transitions: [], arcs: {} };
    nextArcId = 1;
    render();
}

// Функция для предотвращения контекстного меню
function disable(e) {
    e.preventDefault();
}

// === СИМУЛЯЦИЯ ===

// Сброс симуляции
function resetSimulation() {
    const btn = document.getElementById('play-btn');
    if(Object.keys(network_backup).length > 0 && btn.textContent.includes('Пуск'))
    {
        for(const posId in network.positions) 
        {
            network.positions[posId].tokens = network_backup[posId];
        }
        render();
    }
}

// Выполнение одного шага симуляции
function stepSimulation() {
    const enabledTransitions = network.transitions.filter(transition => {
        return transition.input.every(arcId => {
            const arc = network.arcs[arcId];
            const position = network.positions[arc.positionId];
            return position && (
                (arc.isInhibitor && position.tokens === 0) ||
                (!arc.isInhibitor && position.tokens >= arc.weight)
            );
        });
    });
    
    if (enabledTransitions.length > 0) {
        const transition = enabledTransitions[0];
        
        transition.input.forEach(arcId => {
            const arc = network.arcs[arcId];
            const position = network.positions[arc.positionId];
            if (position && !arc.isInhibitor) {
                position.tokens -= arc.weight;
            }
        });
        
        transition.output.forEach(arcId => {
            const arc = network.arcs[arcId];
            const position = network.positions[arc.positionId];
            if (position) {
                position.tokens += arc.weight;
            }
        });
        
        render();
    }
}

// Сохранение текущей маркировки
function saveMarkup() {
    for (const posId in network.positions) {
       network_backup[posId] = network.positions[posId].tokens;
    }
}

// Запуск/остановка непрерывной симуляции
function toggleSimulation() {
    const btn = document.getElementById('play-btn');
    if (btn.textContent.includes('Пуск')) {
        btn.textContent = '⏸ Пауза';
        simulationInterval = setInterval(stepSimulation, speedSteps[currentSpeed - 1]);
    } else {
        btn.textContent = '⏵ Пуск';
        clearInterval(simulationInterval);
    }
}

// === ТЕМА ===

// Переключение светлой/тёмной темы
function toggleTheme() {
    const btn = document.getElementById('theme-toggle');
    const body = document.body;
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
        btn.textContent = '🌙';
        btn.title = 'Светлая тема';
        localStorage.setItem('preferred-theme', 'dark');
    } else {
        btn.textContent = '☀️';
        btn.title = 'Темная тема';
        localStorage.setItem('preferred-theme', 'light');
    }
    render();
}