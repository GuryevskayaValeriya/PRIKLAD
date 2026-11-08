/**
 * Quiz Engine & Gated Learning System for PRIKLAD (Modules 1, 2, and 3).
 * Управляет пошаговым доступом к подмодулям через проверочные вопросы (Checkpoints).
 * Поддерживает:
 * - Пул разнообразных вопросов для каждой темы (каждый раз случайный вопрос);
 * - Жесткое закрепление вопроса и статуса при верном ответе (в LocalStorage);
 * - Лаконичную обратную связь без подсказок-спойлеров («Неверно. Подумайте ещё раз!») + кнопка «Сменить вопрос ↻»;
 * - Полную синхронизацию со всеми 3 модулями курса (Модули 1, 2 и 3).
 */

(function () {
    const MODULE_CONFIGS = {
        1: {
            unlockedKey: 'priklad_mod1_unlocked',
            completedKey: 'priklad_mod1_completed',
            activeQKey: 'priklad_mod1_active_q',
            defaultUnlocked: ['sec-intro', 'sec-1-1'],
            allSections: [
                'sec-intro', 'sec-1-1', 'sec-1-2', 'sec-1-3', 'sec-1-4',
                'sec-1-5', 'sec-1-6', 'sec-1-7', 'sec-1-8', 'sec-1-9',
                'sec-1-10', 'sec-quiz', 'sec-seminar', 'sec-lab'
            ],
            navGroupId: 'nav-group-mod1',
            progressContainerId: 'mod1-progress-container',
            progressTitle: 'Прогресс Модуля 1',
            totalSubmodules: 10,
            introSecId: 'sec-intro',
            introNextTarget: 'sec-1-1',
            introCardTitle: '🚀 Готовы перейти к материалу лекции?',
            introCardDesc: 'Первая тема: От задачи к абстракции — признаковое пространство $\\mathbb{R}^d$ и модели ML',
            introBtnText: 'Начать тему 1.1: Задача и абстракция →',
            getQuizzes: () => (window.MODULE1_QUIZZES || {})
        },
        2: {
            unlockedKey: 'priklad_mod2_unlocked',
            completedKey: 'priklad_mod2_completed',
            activeQKey: 'priklad_mod2_active_q',
            defaultUnlocked: ['sec-2-intro', 'sec-2-1'],
            allSections: [
                'sec-2-intro', 'sec-2-1', 'sec-2-2', 'sec-2-3', 'sec-2-4',
                'sec-2-5', 'sec-2-6', 'sec-2-7', 'sec-2-8', 'sec-2-9',
                'sec-2-10', 'sec-2-quiz', 'sec-2-seminar', 'sec-2-lab'
            ],
            navGroupId: 'nav-group-mod2',
            progressContainerId: 'mod2-progress-container',
            progressTitle: 'Прогресс Модуля 2',
            totalSubmodules: 10,
            introSecId: 'sec-2-intro',
            introNextTarget: 'sec-2-1',
            introCardTitle: '🚀 Готовы перейти к материалу лекции?',
            introCardDesc: 'Первая тема: Задача, абстракция и линейные системы $Ax = b$',
            introBtnText: 'Начать тему 2.1: Задача и линейные системы →',
            getQuizzes: () => (window.MODULE2_QUIZZES || {})
        },
        3: {
            unlockedKey: 'priklad_mod3_unlocked',
            completedKey: 'priklad_mod3_completed',
            activeQKey: 'priklad_mod3_active_q',
            defaultUnlocked: ['sec-3-intro', 'sec-3-1'],
            allSections: [
                'sec-3-intro', 'sec-3-1', 'sec-3-2', 'sec-3-3', 'sec-3-4',
                'sec-3-5', 'sec-3-6', 'sec-3-7', 'sec-3-8', 'sec-3-9',
                'sec-3-10', 'sec-3-11', 'sec-3-quiz', 'sec-3-seminar', 'sec-3-lab'
            ],
            navGroupId: 'nav-group-mod3',
            progressContainerId: 'mod3-progress-container',
            progressTitle: 'Прогресс Модуля 3',
            totalSubmodules: 11,
            introSecId: 'sec-3-intro',
            introNextTarget: 'sec-3-1',
            introCardTitle: '🚀 Готовы перейти к материалу лекции?',
            introCardDesc: 'Первая тема: Мотивация сжатия данных и спектральная теория',
            introBtnText: 'Начать тему 3.1: Зачем сжимать данные? →',
            getQuizzes: () => (window.MODULE3_QUIZZES || {})
        }
    };

    function getModuleIdForSection(secId) {
        if (!secId) return 1;
        if (secId.startsWith('sec-2-') || secId === 'sec-2-intro') return 2;
        if (secId.startsWith('sec-3-') || secId === 'sec-3-intro') return 3;
        return 1;
    }

    function getQuizDataForSection(secId) {
        const modId = getModuleIdForSection(secId);
        const cfg = MODULE_CONFIGS[modId];
        return cfg ? cfg.getQuizzes() : {};
    }

    // --- Надежный 2-этапный рендерер математических формул KaTeX ---
    function renderAllMathIn(container) {
        if (!container) return;

        const execute = () => {
            if (window.renderMathInElement) {
                try {
                    window.renderMathInElement(container, {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false },
                            { left: '\\[', right: '\\]', display: true },
                            { left: '\\(', right: '\\)', display: false }
                        ],
                        throwOnError: false
                    });
                } catch (e) {
                    console.warn('Auto-render error:', e);
                }
            }

            if (window.katex && typeof window.katex.renderToString === 'function') {
                const textNodes = [];
                const walker = document.createTreeWalker(
                    container,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node) => {
                            const parent = node.parentElement;
                            if (!parent) return NodeFilter.FILTER_REJECT;
                            if (parent.closest('.katex') || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
                                return NodeFilter.FILTER_REJECT;
                            }
                            if (node.nodeValue && node.nodeValue.includes('$')) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                            return NodeFilter.FILTER_SKIP;
                        }
                    }
                );

                while (walker.nextNode()) {
                    textNodes.push(walker.currentNode);
                }

                textNodes.forEach(node => {
                    const val = node.nodeValue;
                    if (!val || !val.includes('$')) return;

                    const regex = /\$\$([\s\S]+?)\$\$|\$([^\$\n]+?)\$/g;
                    if (!regex.test(val)) return;
                    regex.lastIndex = 0;

                    const span = document.createElement('span');
                    let lastIdx = 0;
                    let match;

                    while ((match = regex.exec(val)) !== null) {
                        if (match.index > lastIdx) {
                            span.appendChild(document.createTextNode(val.substring(lastIdx, match.index)));
                        }

                        const isDisplay = Boolean(match[1]);
                        const tex = isDisplay ? match[1] : match[2];

                        try {
                            const html = window.katex.renderToString(tex, {
                                displayMode: isDisplay,
                                throwOnError: false
                            });
                            const temp = document.createElement('span');
                            temp.innerHTML = html;
                            span.appendChild(temp.firstElementChild || temp);
                        } catch (err) {
                            span.appendChild(document.createTextNode(match[0]));
                        }

                        lastIdx = match.index + match[0].length;
                    }

                    if (lastIdx < val.length) {
                        span.appendChild(document.createTextNode(val.substring(lastIdx)));
                    }

                    if (node.parentNode) {
                        node.parentNode.replaceChild(span, node);
                    }
                });
            }
        };

        execute();
        setTimeout(execute, 40);
        setTimeout(execute, 200);
    }

    // --- 1. Работа с LocalStorage для любого модуля ---

    function getUnlockedSections(modId) {
        const cfg = MODULE_CONFIGS[modId] || MODULE_CONFIGS[1];
        try {
            const data = localStorage.getItem(cfg.unlockedKey);
            return data ? JSON.parse(data) : [...cfg.defaultUnlocked];
        } catch (e) {
            return [...cfg.defaultUnlocked];
        }
    }

    function getCompletedQuizzes(modId) {
        const cfg = MODULE_CONFIGS[modId] || MODULE_CONFIGS[1];
        try {
            const data = localStorage.getItem(cfg.completedKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveProgress(modId, unlocked, completed) {
        const cfg = MODULE_CONFIGS[modId] || MODULE_CONFIGS[1];
        try {
            localStorage.setItem(cfg.unlockedKey, JSON.stringify(unlocked));
            localStorage.setItem(cfg.completedKey, JSON.stringify(completed));
        } catch (e) {
            console.warn(`Не удалось сохранить прогресс для Модуля ${modId}:`, e);
        }
    }

    function getActiveQuestions(modId) {
        const cfg = MODULE_CONFIGS[modId] || MODULE_CONFIGS[1];
        try {
            const data = localStorage.getItem(cfg.activeQKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            return {};
        }
    }

    function saveActiveQuestions(modId, data) {
        const cfg = MODULE_CONFIGS[modId] || MODULE_CONFIGS[1];
        try {
            localStorage.setItem(cfg.activeQKey, JSON.stringify(data));
        } catch (e) {
            console.warn(`Не удалось сохранить активные вопросы для Модуля ${modId}:`, e);
        }
    }

    function getQuestionPool(secData) {
        if (!secData) return [];
        if (Array.isArray(secData.pool) && secData.pool.length > 0) {
            return secData.pool;
        }
        if (secData.question) {
            return [secData];
        }
        return [];
    }

    function unlockNextSection(currentSecId, nextSecId) {
        const modId = getModuleIdForSection(currentSecId);
        const unlocked = getUnlockedSections(modId);
        const completed = getCompletedQuizzes(modId);

        if (!completed.includes(currentSecId)) {
            completed.push(currentSecId);
        }

        if (nextSecId && !unlocked.includes(nextSecId)) {
            unlocked.push(nextSecId);
        }

        // Если сдан финальный подпункт теории модуля — открываем практику
        if (currentSecId === 'sec-1-10') {
            ['sec-quiz', 'sec-seminar', 'sec-lab'].forEach(id => {
                if (!unlocked.includes(id)) unlocked.push(id);
            });
        } else if (currentSecId === 'sec-2-10') {
            ['sec-2-quiz', 'sec-2-seminar', 'sec-2-lab'].forEach(id => {
                if (!unlocked.includes(id)) unlocked.push(id);
            });
        } else if (currentSecId === 'sec-3-11') {
            ['sec-3-quiz', 'sec-3-seminar', 'sec-3-lab'].forEach(id => {
                if (!unlocked.includes(id)) unlocked.push(id);
            });
        }

        saveProgress(modId, unlocked, completed);
        updateNavigationLocks();
        updateProgressBar();
    }

    // --- 2. Обновление блокировок в навигации для всех модулей ---

    function updateNavigationLocks() {
        [1, 2, 3].forEach(modId => {
            const cfg = MODULE_CONFIGS[modId];
            const unlocked = getUnlockedSections(modId);
            const completed = getCompletedQuizzes(modId);

            const modGroup = document.getElementById(cfg.navGroupId);
            if (!modGroup) return;

            const navItems = modGroup.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                const target = item.getAttribute('data-target');
                if (!target) return;

                // Проверяем, принадлежит ли этот пункт текущему модулю
                if (getModuleIdForSection(target) !== modId) return;

                let titleEl = item.querySelector('.nav-item-title');
                if (!titleEl) {
                    const oldBadge = item.querySelector('.nav-status-badge');
                    if (oldBadge) oldBadge.remove();
                    const rawText = item.textContent.replace(/[🔒•✓]/g, '').trim();
                    item.innerHTML = `<span class="nav-item-title">${rawText}</span>`;
                    titleEl = item.querySelector('.nav-item-title');
                }

                const isUnlocked = unlocked.includes(target);
                const isCompleted = completed.includes(target);

                const oldBadge = item.querySelector('.nav-status-badge');
                if (oldBadge) oldBadge.remove();

                const badge = document.createElement('span');
                badge.className = 'nav-status-badge';

                if (isUnlocked) {
                    item.classList.remove('locked');
                    if (isCompleted) {
                        item.classList.add('completed');
                        badge.textContent = '✓';
                        badge.title = 'Подмодуль пройден';
                        badge.className += ' badge-success';
                    } else {
                        item.classList.remove('completed');
                        badge.textContent = '•';
                        badge.title = 'Доступно для изучения';
                        badge.className += ' badge-open';
                    }
                } else {
                    item.classList.add('locked');
                    item.classList.remove('completed');
                    badge.textContent = '🔒';
                    badge.title = 'Пройдите предыдущий подмодуль для разблокировки';
                    badge.className += ' badge-locked';
                }

                item.appendChild(badge);
            });
        });
    }

    // --- 3. Панель прогресса и инструменты преподавателя для каждого модуля ---

    function setupProgressSidebarUI() {
        [1, 2, 3].forEach(modId => {
            const cfg = MODULE_CONFIGS[modId];
            const modGroup = document.getElementById(cfg.navGroupId);
            if (!modGroup || document.getElementById(cfg.progressContainerId)) return;

            const progressContainer = document.createElement('div');
            progressContainer.id = cfg.progressContainerId;
            progressContainer.className = 'learning-progress-box';
            progressContainer.innerHTML = `
                <div class="progress-header">
                    <span class="progress-title">${cfg.progressTitle}</span>
                    <span id="mod${modId}-progress-count" class="progress-counter">0 / ${cfg.totalSubmodules}</span>
                </div>
                <div class="progress-track-bg">
                    <div id="mod${modId}-progress-fill" class="progress-track-fill" style="width: 0%;"></div>
                </div>
                <div class="teacher-tools">
                    <button id="btn-reset-mod${modId}-progress" class="btn-tool-chip" title="Сбросить прогресс Модуля ${modId} и начать сначала">Сбросить</button>
                    <button id="btn-unlock-all-mod${modId}" class="btn-tool-chip" title="Открыть все разделы Модуля ${modId} (режим преподавателя)">Открыть всё 🔓</button>
                </div>
            `;

            modGroup.insertBefore(progressContainer, modGroup.firstChild);

            document.getElementById(`btn-reset-mod${modId}-progress`)?.addEventListener('click', () => {
                if (confirm(`Сбросить прогресс Модуля ${modId} и начать сначала?`)) {
                    saveProgress(modId, [...cfg.defaultUnlocked], []);
                    try {
                        localStorage.removeItem(cfg.activeQKey);
                    } catch (e) {}
                    updateNavigationLocks();
                    updateProgressBar();
                    refreshAllQuizWidgets();
                    const firstNav = modGroup.querySelector(`.nav-item[data-target="${cfg.defaultUnlocked[1]}"]`);
                    firstNav?.click();
                }
            });

            document.getElementById(`btn-unlock-all-mod${modId}`)?.addEventListener('click', () => {
                const quizzes = cfg.getQuizzes();
                saveProgress(modId, [...cfg.allSections], Object.keys(quizzes));
                updateNavigationLocks();
                updateProgressBar();
                refreshAllQuizWidgets();
            });
        });
    }

    function updateProgressBar() {
        [1, 2, 3].forEach(modId => {
            const cfg = MODULE_CONFIGS[modId];
            const completed = getCompletedQuizzes(modId);
            const count = completed.length;
            const percent = Math.min(100, Math.round((count / cfg.totalSubmodules) * 100));

            const counterEl = document.getElementById(`mod${modId}-progress-count`);
            const fillEl = document.getElementById(`mod${modId}-progress-fill`);

            if (counterEl) counterEl.textContent = `${count} / ${cfg.totalSubmodules} (${percent}%)`;
            if (fillEl) fillEl.style.width = `${percent}%`;
        });
    }

    // --- 4. Кнопки перехода в конце вводных разделов sec-intro, sec-2-intro, sec-3-intro ---

    function setupIntroNextButtons() {
        [1, 2, 3].forEach(modId => {
            const cfg = MODULE_CONFIGS[modId];
            const introSec = document.getElementById(cfg.introSecId);
            if (!introSec || introSec.querySelector(`.intro-next-step-card-mod${modId}`)) return;

            const card = document.createElement('div');
            card.className = `intro-next-step-card intro-next-step-card-mod${modId}`;
            card.innerHTML = `
                <div class="intro-next-info">
                    <h3>${cfg.introCardTitle}</h3>
                    <p>${cfg.introCardDesc}</p>
                </div>
                <button id="btn-start-mod${modId}-lesson" class="btn-start-course">
                    ${cfg.introBtnText}
                </button>
            `;
            introSec.appendChild(card);

            card.querySelector(`#btn-start-mod${modId}-lesson`)?.addEventListener('click', () => {
                const nav = document.querySelector(`.nav-item[data-target="${cfg.introNextTarget}"]`);
                if (nav) nav.click();
            });

            renderAllMathIn(card);
        });
    }

    // --- 5. Отрисовка интерактивных карточек вопросов (Checkpoints) ---

    function renderQuizForSection(secId) {
        const modId = getModuleIdForSection(secId);
        const quizzes = getQuizDataForSection(secId);
        if (!quizzes || !quizzes[secId]) return;

        const secEl = document.getElementById(secId);
        if (!secEl) return;

        const secData = quizzes[secId];
        const pool = getQuestionPool(secData);
        if (pool.length === 0) return;

        const completed = getCompletedQuizzes(modId);
        const isPassed = completed.includes(secId);

        const activeMap = getActiveQuestions(modId);
        let saved = activeMap[secId];

        let qIndex = 0;
        if (isPassed) {
            // Если подмодуль сдан — используем сохраненный закрепленный вопрос
            if (saved && typeof saved.qIndex === 'number' && saved.qIndex >= 0 && saved.qIndex < pool.length) {
                qIndex = saved.qIndex;
            } else {
                qIndex = 0;
            }
        } else {
            // Если еще не сдан — проверяем, выбран ли уже вопрос
            if (saved && typeof saved.qIndex === 'number' && saved.qIndex >= 0 && saved.qIndex < pool.length && !saved.isPassed) {
                qIndex = saved.qIndex;
            } else {
                // Выбираем случайный вопрос из пула
                qIndex = Math.floor(Math.random() * pool.length);
                activeMap[secId] = { qIndex: qIndex, isPassed: false };
                saveActiveQuestions(modId, activeMap);
            }
        }

        const currentQ = pool[qIndex];
        let card = secEl.querySelector('.quiz-gate-card');

        // Проверяем, отображается ли в карточке именно текущий вопрос (qIndex)
        const currentCardQIndex = card ? parseInt(card.getAttribute('data-qindex'), 10) : -1;

        if (!card || currentCardQIndex !== qIndex) {
            if (card) card.remove();

            card = document.createElement('div');
            card.className = 'quiz-gate-card';
            card.id = `gate-card-${secId}`;
            card.setAttribute('data-qindex', qIndex);

            card.innerHTML = `
                <div class="quiz-gate-header">
                    <h3 class="quiz-gate-title">Вопрос для перехода к следующему разделу</h3>
                </div>
                <div class="quiz-gate-question">${currentQ.question}</div>
                <div class="quiz-options-list">
                    ${currentQ.options.map((opt, i) => `
                        <label class="quiz-option-label" data-index="${i}">
                            <input type="radio" name="quiz_choice_${secId}" value="${i}">
                            <span class="quiz-option-marker">${String.fromCharCode(65 + i)}</span>
                            <span class="quiz-option-text">${opt}</span>
                        </label>
                    `).join('')}
                </div>
                <div class="quiz-feedback" id="feedback_${secId}"></div>
                <div class="quiz-actions-row">
                    <button class="btn-quiz-check" id="btn-check-${secId}">
                        <span>Проверить ответ</span>
                    </button>
                    ${pool.length > 1 && !isPassed ? `
                        <button class="btn-tool-chip btn-quiz-retry" id="btn-retry-${secId}" style="display:none; padding:0.75rem 1.1rem; font-size:0.88rem;" title="Попробовать другой вопрос из темы">
                            <span>Сменить вопрос ↻</span>
                        </button>
                    ` : ''}
                    <button class="btn-quiz-next" id="btn-next-${secId}">
                        <span>Перейти к ${secData.nextTitle} →</span>
                    </button>
                </div>
            `;

            secEl.appendChild(card);

            const btnCheck = card.querySelector(`#btn-check-${secId}`);
            const btnNext = card.querySelector(`#btn-next-${secId}`);
            const btnRetry = card.querySelector(`#btn-retry-${secId}`);
            const feedback = card.querySelector(`#feedback_${secId}`);

            btnCheck?.addEventListener('click', () => {
                const checkedRadio = card.querySelector(`input[name="quiz_choice_${secId}"]:checked`);
                if (!checkedRadio) {
                    feedback.className = 'quiz-feedback error';
                    feedback.innerHTML = '⚠️ Пожалуйста, выберите один из вариантов ответа выше.';
                    return;
                }

                const selectedIdx = parseInt(checkedRadio.value, 10);
                const allLabels = card.querySelectorAll('.quiz-option-label');
                allLabels.forEach(l => l.classList.remove('option-correct', 'option-wrong'));

                if (selectedIdx === currentQ.correctIndex) {
                    // Верно! ЗАКРЕПЛЯЕМ вопрос и ответ
                    allLabels[selectedIdx].classList.add('option-correct');
                    feedback.className = 'quiz-feedback success';
                    feedback.innerHTML = `
                        <strong>Абсолютно верно!</strong><br>
                        Следующий подмодуль разблокирован!
                    `;
                    btnNext?.classList.add('visible');
                    if (btnRetry) btnRetry.style.display = 'none';

                    // Сохраняем закрепленный вопрос в activeMap
                    const map = getActiveQuestions(modId);
                    map[secId] = { qIndex: qIndex, selectedIdx: selectedIdx, isPassed: true };
                    saveActiveQuestions(modId, map);

                    // Блокируем радио-кнопки
                    card.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
                    btnCheck.disabled = true;
                    btnCheck.style.opacity = '0.6';
                    btnCheck.style.cursor = 'default';

                    renderAllMathIn(feedback);
                    unlockNextSection(secId, secData.nextSectionId);
                } else {
                    // Неверно! БЕЗ ПОДСКАЗОК - только лаконичное напоминание
                    allLabels[selectedIdx].classList.add('option-wrong');
                    feedback.className = 'quiz-feedback error';
                    feedback.innerHTML = `<strong>Неверно.</strong> Подумайте ещё раз!`;
                    btnNext?.classList.remove('visible');

                    // Показываем кнопку смены вопроса, если в пуле есть альтернативные вопросы
                    if (btnRetry && pool.length > 1) {
                        btnRetry.style.display = 'inline-flex';
                    }
                    renderAllMathIn(feedback);
                }
            });

            btnRetry?.addEventListener('click', () => {
                // Выбираем другой вопрос из пула
                const map = getActiveQuestions(modId);
                let nextIdx = (qIndex + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
                map[secId] = { qIndex: nextIdx, isPassed: false };
                saveActiveQuestions(modId, map);
                renderQuizForSection(secId);
            });

            btnNext?.addEventListener('click', () => {
                const targetNav = document.querySelector(`.nav-item[data-target="${secData.nextSectionId}"]`);
                if (targetNav) {
                    targetNav.click();
                }
            });

            renderAllMathIn(card);
        }

        const feedback = card.querySelector(`#feedback_${secId}`);
        const btnNext = card.querySelector(`#btn-next-${secId}`);
        const btnCheck = card.querySelector(`#btn-check-${secId}`);
        const btnRetry = card.querySelector(`#btn-retry-${secId}`);
        const correctRadio = card.querySelector(`input[value="${currentQ.correctIndex}"]`);
        const allLabels = card.querySelectorAll('.quiz-option-label');

        if (isPassed) {
            if (correctRadio) correctRadio.checked = true;
            allLabels.forEach((l, idx) => {
                if (idx === currentQ.correctIndex) l.classList.add('option-correct');
                else l.classList.remove('option-correct', 'option-wrong');
            });
            card.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
            if (btnCheck) {
                btnCheck.disabled = true;
                btnCheck.style.opacity = '0.6';
                btnCheck.style.cursor = 'default';
            }
            if (btnRetry) btnRetry.style.display = 'none';

            feedback.className = 'quiz-feedback success';
            feedback.innerHTML = `
                <strong>✓ Пройдено!</strong> Раздел <em>«${secData.nextTitle}»</em> разблокирован.
            `;
            btnNext?.classList.add('visible');
            renderAllMathIn(feedback);
        } else {
            btnNext?.classList.remove('visible');
            if (btnCheck) {
                btnCheck.disabled = false;
                btnCheck.style.opacity = '1';
                btnCheck.style.cursor = 'pointer';
            }
            if (!card.querySelector(`input[name="quiz_choice_${secId}"]:checked`)) {
                feedback.className = 'quiz-feedback';
                feedback.innerHTML = '';
            }
        }

        renderAllMathIn(card);
    }

    function refreshAllQuizWidgets() {
        [1, 2, 3].forEach(modId => {
            const cfg = MODULE_CONFIGS[modId];
            const quizzes = cfg.getQuizzes();
            Object.keys(quizzes).forEach(secId => {
                renderQuizForSection(secId);
            });
        });
    }

    // --- 6. Защита кликов по заблокированным пунктам в меню ---

    function interceptNavigationClicks() {
        document.body.addEventListener('click', (e) => {
            const item = e.target.closest('.nav-item');
            if (!item) return;

            if (item.classList.contains('locked')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                showLockedNotification();
            }
        }, true);
    }

    let notifyTimeout = null;
    function showLockedNotification() {
        let toast = document.getElementById('quiz-lock-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'quiz-lock-toast';
            toast.className = 'quiz-lock-toast';
            document.body.appendChild(toast);
        }

        toast.innerHTML = '🔒 <b>Раздел заблокирован!</b><br><span style="font-size:0.86rem; font-weight:400; opacity:0.9;">Ответьте на контрольный вопрос в конце текущей темы для перехода.</span>';
        toast.classList.add('show');

        clearTimeout(notifyTimeout);
        notifyTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3200);
    }

    // --- 7. Инициализация при загрузке ---

    function initQuizSystem() {
        setupProgressSidebarUI();
        setupIntroNextButtons();
        updateNavigationLocks();
        updateProgressBar();
        refreshAllQuizWidgets();
        setTimeout(refreshAllQuizWidgets, 100);
        setTimeout(refreshAllQuizWidgets, 500);
        interceptNavigationClicks();

        // Обновляем виджеты и рендерим формулы при смене раздела
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const targetId = item.getAttribute('data-target');
                setTimeout(() => {
                    refreshAllQuizWidgets();
                    const targetSec = document.getElementById(targetId);
                    if (targetSec) renderAllMathIn(targetSec);
                }, 60);
            });
        });

        // Слушаем переключение модулей
        document.querySelectorAll('.btn-module-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                setTimeout(() => {
                    updateNavigationLocks();
                    updateProgressBar();
                    refreshAllQuizWidgets();
                }, 80);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQuizSystem);
    } else {
        initQuizSystem();
    }

    window.PrikladQuizEngine = {
        unlockAll: (modId) => {
            const targetMods = modId ? [modId] : [1, 2, 3];
            targetMods.forEach(m => {
                const cfg = MODULE_CONFIGS[m];
                if (cfg) {
                    saveProgress(m, [...cfg.allSections], Object.keys(cfg.getQuizzes()));
                }
            });
            updateNavigationLocks();
            updateProgressBar();
            refreshAllQuizWidgets();
        },
        reset: (modId) => {
            const targetMods = modId ? [modId] : [1, 2, 3];
            targetMods.forEach(m => {
                const cfg = MODULE_CONFIGS[m];
                if (cfg) {
                    saveProgress(m, [...cfg.defaultUnlocked], []);
                    try {
                        localStorage.removeItem(cfg.activeQKey);
                    } catch (e) {}
                }
            });
            updateNavigationLocks();
            updateProgressBar();
            refreshAllQuizWidgets();
        },
        renderAllMath: renderAllMathIn
    };
})();
