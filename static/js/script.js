let currentTool = '';
let network = { 
    positions: {}, // Объект с id в качестве ключей
    transitions: [], // Массив переходов со свойствами input и output
    arcs: {} // Словарь дуг: ключ - id дуги, значение - объект дуги
};
let network_backup = {};
let canvas = null;
let ctx = null;
let isDragging = false;
let draggedElement = null;
let arcStartPoint = null;
let nextArcId = 1; // Счетчик для генерации уникальных ID дуг
let selectedElement = null;
let selectedElementType = null;

function disable(e) {
    e.preventDefault();
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('petri-net-canvas');
    ctx = canvas.getContext('2d');

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

    setupPropertyListeners();

    // Настройка инструментов
    showProperties(currentTool);
    updateCursor();
    setupTools();

    // Кнопки
    document.getElementById('new-network-btn').addEventListener('click', newNetwork);
    document.getElementById('load-example-btn').addEventListener('click', showExamples);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('save-btn').addEventListener('click', saveNetwork);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('step-btn').addEventListener('click', stepSimulation);
    document.getElementById('play-btn').addEventListener('click', toggleSimulation);
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

    // Изменение размера холста
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('contextmenu', disable);
    resizeCanvas(); // Первичная настройка

    // Обработчики событий для холста
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', endDrag);

    // Инициализация холста
    initCanvas();
});

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

// Вызовите один раз при старте
setupPropertyListeners();

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

            // Обновляем курсор в зависимости от инструмента
            updateCursor();
        });
    });
}

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

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth * 0.95;
    canvas.height = container.clientHeight * 0.95;
    render();
}

function initCanvas() {
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#1a1a1a' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

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


function findArcAtPosition(x, y, from, to) {
    const TOLERANCE = 10; // Допустимое расстояние от линии в пикселях
    
    // Радиусы элементов
    const POSITION_RADIUS = 20;
    const TRANSITION_SIZE = 5;
    
    let startX, startY, endX, endY;
    
    // Вычисляем точки начала и конца дуги с учетом размеров элементов
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
    
    // Вычисляем расстояние от точки до линии
    const distance = distanceFromPointToLine(x, y, startX, startY, endX, endY);
    
    return distance <= TOLERANCE;
}


function distanceFromPointToLine(px, py, x1, y1, x2, y2) {
    // Векторы
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    // Длина линии в квадрате
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    // Параметр проекции точки на линию
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    // Ближайшая точка на линии
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
    
    // Расстояние от исходной точки до ближайшей точки на линии
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
}

function findElementById(id) {
    if (network.positions[id]) {
        return network.positions[id];
    }
    return network.transitions.find(t => t.id === id);
}

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'arc') {
        // Начало рисования дуги
        const element = findElementAtPosition(x, y);
        if (element) {
            arcStartPoint = {
                elementId: element.element.id,
                x: element.element.x,
                y: element.element.y,
                type: element.type
            };
            // Визуальная обратная связь
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
                input: [],  // Массив ID входных дуг
                output: [], // Массив ID выходных дуг
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

function handleMouseUp(e) { //добавить проверку на кратные дуги (опционально)
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'arc' && arcStartPoint) {
        const element = findElementAtPosition(x, y);
        
        if (element && element.element.id !== arcStartPoint.elementId) {
            const fromIsPosition = arcStartPoint.type === 'position';
            const toIsPosition = element.type === 'position';
            const isValidConnection = (fromIsPosition && !toIsPosition) || (!fromIsPosition && toIsPosition);
            const hasExistingArc = false;//checkExistingArc(arcStartPoint, element);

            if (isValidConnection && !hasExistingArc) {
                const weight = parseInt(document.getElementById('arc-weight').value) || 1;
                const isInhibitor = document.getElementById('arc-type').value === 'red';
                
                // Создаем новую дугу
                const arcId = 'a' + (nextArcId++);
                const newArc = {
                    id: arcId,
                    positionId: fromIsPosition ? arcStartPoint.elementId : element.element.id,
                    weight: weight,
                    isInhibitor: isInhibitor && fromIsPosition
                };

                if(isInhibitor && !fromIsPosition)
                {
                    alert('Дуга от перехода к позиции не может иметь тип "ингибитор"')
                }
                
                // Добавляем дугу в глобальный словарь
                network.arcs[arcId] = newArc;
                
                // Добавляем ID дуги в соответствующий массив перехода
                if (fromIsPosition) {
                    // Позиция -> Переход (входная дуга)
                    const transition = network.transitions.find(t => t.id === element.element.id);
                    if (transition) {
                        transition.input.push(arcId);
                    }
                } else {
                    // Переход -> Позиция (выходная дуга)
                    const transition = network.transitions.find(t => t.id === arcStartPoint.elementId);
                    if (transition) {
                        transition.output.push(arcId);
                    }
                }
            } else {
                if(!isValidConnection)
                {
                    alert('Недопустимое соединение! Дуга должна соединять позицию с переходом или переход с позицией.');
                }
                if(hasExistingArc)
                {
                    alert('Ошибка: Дуга между этими элементами уже существует!\nУдалите существующую дугу перед созданием новой.');
                }
            }
        }
        
        // Сбрасываем начальную точку
        arcStartPoint = null;
        canvas.style.cursor = 'crosshair';
        render();
    } else if (currentTool === 'move') {
        endDrag();
    }
}

function checkExistingArc(startPoint, endPoint) {
    // Определяем направление дуги
    const startIsPosition = startPoint.type === 'position';
    const endIsPosition = endPoint.type === 'position';
    
    if (startIsPosition && !endIsPosition) {
        // Позиция -> Переход
        const transition = network.transitions.find(t => t.id === endPoint.element.id);
        if (transition) {
            return transition.input.some(arcId => {
                const arc = network.arcs[arcId];
                return arc && arc.positionId === startPoint.element.id;
            });
        }
    } else if (!startIsPosition && endIsPosition) {
        // Переход -> Позиция
        const transition = network.transitions.find(t => t.id === startPoint.element.id);
        if (transition) {
            return transition.output.some(arcId => {
                const arc = network.arcs[arcId];
                return arc && arc.positionId === endPoint.element.id;
            });
        }
    }
    
    return false;
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Рисование временной линии для дуги
    if (currentTool === 'arc' && arcStartPoint) {
        render(); // Перерисовываем основное содержимое
        // Рисуем временную линию
        ctx.beginPath();
        ctx.moveTo(arcStartPoint.x, arcStartPoint.y);
        ctx.lineTo(x, y);
        ctx.strokeStyle = '#888';
        ctx.setLineDash([5, 5]); // Пунктирная линия
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Перетаскивание элементов
    if (isDragging && draggedElement) {
        drag(e);
    }
}

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

function drag(e) {
    if (!isDragging || !draggedElement) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    draggedElement.element.x = x;
    draggedElement.element.y = y;
    render();
}

function endDrag() {
    isDragging = false;
    draggedElement = null;
    canvas.style.cursor = 'crosshair';
}

function removeElement(element) {
    if (element.type === 'position') {
        // Удаляем позицию из словаря
        delete network.positions[element.element.id];
        
        // Удаляем все дуги, связанные с этой позицией
        network.transitions.forEach(transition => {
            // Фильтруем входные дуги
            transition.input = transition.input.filter(arcId => {
                const arc = network.arcs[arcId];
                if (arc && arc.positionId === element.element.id) {
                    delete network.arcs[arcId]; // Удаляем дугу из глобального словаря
                    return false;
                }
                return true;
            });
            
            // Фильтруем выходные дуги
            transition.output = transition.output.filter(arcId => {
                const arc = network.arcs[arcId];
                if (arc && arc.positionId === element.element.id) {
                    delete network.arcs[arcId]; // Удаляем дугу из глобального словаря
                    return false;
                }
                return true;
            });
        });
    } else if (element.type === 'transition') {
        // Удаляем переход из массива
        network.transitions = network.transitions.filter(t => t.id !== element.element.id);
        
        // Удаляем все его дуги из глобального словаря
        const allArcIds = [...element.element.input, ...element.element.output];
        allArcIds.forEach(arcId => {
            if (network.arcs[arcId]) {
                delete network.arcs[arcId];
            }
        });
    } else if (element.type === 'arc') {
        // Удаляем дугу из глобального словаря
        delete network.arcs[element.element.id];
        
        // Удаляем ID дуги из соответствующего массива перехода
        network.transitions.forEach(transition => {
            transition.input = transition.input.filter(id => id !== element.element.id);
            transition.output = transition.output.filter(id => id !== element.element.id);
        });
    }
}

function render() {
    initCanvas();

    // Сначала рисуем все дуги, чтобы они были под элементами
    drawArcs();
    
    // Затем рисуем позиции и переходы
    for (const posId in network.positions) {
        drawPosition(network.positions[posId]);
    }
    
    network.transitions.forEach(transition => {
        drawTransition(transition);
    });
}

function drawArcs() {
    // Рисуем входные дуги (переход <- позиция)
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
        
        // Рисуем выходные дуги (переход -> позиция)
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

function drawSingleArc(from, to, weight, isInhibitor = false) {
    let startX, startY, endX, endY;
    
    // Радиусы элементов
    const POSITION_RADIUS = 20;
    const TRANSITION_SIZE = 5; // половина ширины перехода
    
    if (from.hasOwnProperty('input')) { // from - это переход
        // Переход -> Позиция (выходная дуга)
        startX = from.x;
        startY = from.y;
        
        // Вектор от перехода к позиции
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Точка на границе перехода
        const ratioFrom = TRANSITION_SIZE / distance;
        startX = from.x + dx * ratioFrom;
        startY = from.y + dy * ratioFrom;
        
        // Точка на границе позиции
        const ratioTo = POSITION_RADIUS / distance;
        endX = to.x - dx * ratioTo;
        endY = to.y - dy * ratioTo;
    } else { // from - это позиция
        // Позиция -> Переход (входная дуга)
        endX = to.x;
        endY = to.y;
        
        // Вектор от позиции к переходу
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Точка на границе позиции
        const ratioFrom = POSITION_RADIUS / distance;
        startX = from.x + dx * ratioFrom;
        startY = from.y + dy * ratioFrom;
        
        // Точка на границе перехода
        const ratioTo = TRANSITION_SIZE / distance;
        endX = to.x - dx * ratioTo;
        endY = to.y - dy * ratioTo;
    }
    
    // Основная линия дуги
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    
    // Цвет линии зависит от типа дуги
    const lineColor = isInhibitor ? 
        (document.body.classList.contains('dark-theme') ? '#ff6b6b' : '#d63031') : 
        (document.body.classList.contains('dark-theme') ? '#888' : '#555');
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = isInhibitor ? 3 : 2;
    
    // Если это ингибиторная дуга, делаем пунктирную линию
    if (isInhibitor) {
        ctx.setLineDash([8, 4]);
    }
    
    ctx.stroke();
    ctx.setLineDash([]); // Сбрасываем пунктир
    
    // Вычисляем середину дуги
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    
    // Направление дуги
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // Размер стрелки
    const arrowSize = 10;
    
    // Рисуем стрелку в середине дуги (если не ингибиторная)

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
    
    // Рисуем вес дуги чуть выше середины
    if (weight > 0) {
        ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ccc' : '#000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(weight, midX, midY - 20);
    }
}

function drawPosition(pos) {
    // Рисуем круг позиции
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = document.body.classList.contains('dark-theme') ? '#667' : '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Имя позиции
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ddd' : '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(pos.name, pos.x, pos.y + 35);
    
    // Фишки
    if (pos.tokens > 0) {
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

function drawTransition(tr) {
    // Рисуем прямоугольник перехода
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ddd' : '#000';
    ctx.fillRect(tr.x - 5, tr.y - 15, 10, 30);
    
    // Имя перехода
    ctx.fillStyle = document.body.classList.contains('dark-theme') ? '#ddd' : '#000';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tr.name, tr.x, tr.y + 30);
}

function newNetwork() {
    network = { positions: {}, transitions: [], arcs: {} };
    nextArcId = 1;
    render();
}

function showExamples() {
    alert("Примеры доступны в полной версии на study.aia.expert");
}

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

//---------------------------------------------------- Simulator --------------------------------------------------------

function resetSimulation() {
    const btn = document.getElementById('play-btn');
    if(btn.textContent.includes('Пуск'))
    {
        for(const posId in network.positions) 
        {
            network.positions[posId].tokens = network_backup[posId];
        }
        render();
    }
}

function stepSimulation() {
    // Простая реализация шага симуляции
    const btn = document.getElementById('play-btn');
    if(btn.textContent.includes('Пауза'))
    {
        const enabledTransitions = network.transitions.filter(transition => {
            // Проверяем, что все входные позиции имеют достаточное количество фишек
            return transition.input.every(arcId => {
                const arc = network.arcs[arcId];
                const position = network.positions[arc.positionId];
                // Для обычных дуг проверяем количество фишек
                // Для ингибиторных дуг проверяем отсутствие фишек
                return position && (
                    (arc.isInhibitor && position.tokens === 0) ||
                    (!arc.isInhibitor && position.tokens >= arc.weight)
                );
            });
        });
    
        if (enabledTransitions.length > 0) {
            // Берем первый активный переход
            const transition = enabledTransitions[0];
        
            // Удаляем фишки из входных позиций (только для не-ингибиторных дуг)
            transition.input.forEach(arcId => {
                const arc = network.arcs[arcId];
                const position = network.positions[arc.positionId];
                if (position && !arc.isInhibitor) {
                    position.tokens -= arc.weight;
                }
            });
        
            // Добавляем фишки в выходные позиции
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
}

function toggleSimulation() {
    const btn = document.getElementById('play-btn');
    if (btn.textContent.includes('Пуск')) {
        for (const posId in network.positions) 
        {
            network_backup[posId] = network.positions[posId].tokens;
        }
        btn.textContent = '⏸ Пауза';
    } else {
        btn.textContent = '⏵ Пуск';
    }
}

//----------------------------------------------- Theme switch -------------------------------------------

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
    render();
}