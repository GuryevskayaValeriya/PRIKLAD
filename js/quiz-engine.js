/**
 * Quiz Engine & Gated Learning System for PRIKLAD (Module 1).
 * Управляет пошаговым доступом к подмодулям через проверочные вопросы.
 */

(function () {
    const STORAGE_KEY_UNLOCKED = 'priklad_mod1_unlocked';
    const STORAGE_KEY_COMPLETED = 'priklad_mod1_completed';

    const DEFAULT_UNLOCKED = ['sec-intro', 'sec-1-1'];
    const ALL_MOD1_SECTIONS = [
        'sec-intro', 'sec-1-1', 'sec-1-2', 'sec-1-3', 'sec-1-4',
        'sec-1-5', 'sec-1-6', 'sec-1-7', 'sec-1-8', 'sec-1-9',
        'sec-1-10', 'sec-quiz', 'sec-seminar', 'sec-lab'
    ];

    function getQuizData() {
        if (typeof window !== 'undefined' && window.MODULE1_QUIZZES) return window.MODULE1_QUIZZES;
        if (typeof MODULE1_QUIZZES !== 'undefined') return MODULE1_QUIZZES;
        return null;
    }

    // --- Надежный 2-этапный рендерер математических формул KaTeX ---
    function renderAllMathIn(container) {
        if (!container) return;

        const execute = () => {
            // 1. Попытка стандартного рендеринга через auto-render
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

            // 2. Гарантированный резервный проход через katex.renderToString
            // Находит любые оставшиеся необработанные формулы $...$ и $$...$$
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

    // --- 1. Работа с LocalStorage ---

    function getUnlockedSections() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_UNLOCKED);
            return data ? JSON.parse(data) : [...DEFAULT_UNLOCKED];
        } catch (e) {
            return [...DEFAULT_UNLOCKED];
        }
    }

    function getCompletedQuizzes() {
        try {
            const data = localStorage.getItem(STORAGE_KEY_COMPLETED);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveProgress(unlocked, completed) {
        try {
            localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify(unlocked));
            localStorage.setItem(STORAGE_KEY_COMPLETED, JSON.stringify(completed));
        } catch (e) {
            console.warn('Не удалось сохранить прогресс:', e);
        }
    }

    function unlockNextSection(currentSecId, nextSecId) {
        const unlocked = getUnlockedSections();
        const completed = getCompletedQuizzes();

        if (!completed.includes(currentSecId)) {
            completed.push(currentSecId);
        }

        if (nextSecId && !unlocked.includes(nextSecId)) {
            unlocked.push(nextSecId);
        }

        // Если сдан подмодуль 1.10 — разблокируем весь блок практики
        if (currentSecId === 'sec-1-10') {
            ['sec-quiz', 'sec-seminar', 'sec-lab'].forEach(id => {
                if (!unlocked.includes(id)) unlocked.push(id);
            });
        }

        saveProgress(unlocked, completed);
        updateNavigationLocks();
        updateProgressBar();
    }

    // --- 2. Обновление блокировок в навигации ---

    function updateNavigationLocks() {
        const unlocked = getUnlockedSections();
        const completed = getCompletedQuizzes();

        const mod1Group = document.getElementById('nav-group-mod1');
        if (!mod1Group) return;

        const navItems = mod1Group.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const target = item.getAttribute('data-target');
            if (!target) return;

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
    }

    // --- 3. Панель прогресса и инструменты преподавателя ---

    function setupProgressSidebarUI() {
        const mod1Group = document.getElementById('nav-group-mod1');
        if (!mod1Group || document.getElementById('mod1-progress-container')) return;

        const progressContainer = document.createElement('div');
        progressContainer.id = 'mod1-progress-container';
        progressContainer.className = 'learning-progress-box';
        progressContainer.innerHTML = `
            <div class="progress-header">
                <span class="progress-title">Прогресс Модуля 1</span>
                <span id="mod1-progress-count" class="progress-counter">0 / 10</span>
            </div>
            <div class="progress-track-bg">
                <div id="mod1-progress-fill" class="progress-track-fill" style="width: 0%;"></div>
            </div>
            <div class="teacher-tools">
                <button id="btn-reset-mod1-progress" class="btn-tool-chip" title="Сбросить прогресс и начать сначала">Сбросить</button>
                <button id="btn-unlock-all-mod1" class="btn-tool-chip" title="Открыть все разделы модуля (режим преподавателя)">Открыть всё 🔓</button>
            </div>
        `;

        mod1Group.insertBefore(progressContainer, mod1Group.firstChild);

        document.getElementById('btn-reset-mod1-progress')?.addEventListener('click', () => {
            if (confirm('Сбросить прогресс Модуля 1 и начать с темы 1.1?')) {
                saveProgress([...DEFAULT_UNLOCKED], []);
                updateNavigationLocks();
                updateProgressBar();
                refreshAllQuizWidgets();
                const firstNav = mod1Group.querySelector('.nav-item[data-target="sec-1-1"]');
                firstNav?.click();
            }
        });

        document.getElementById('btn-unlock-all-mod1')?.addEventListener('click', () => {
            saveProgress([...ALL_MOD1_SECTIONS], Object.keys(getQuizData() || {}));
            updateNavigationLocks();
            updateProgressBar();
            refreshAllQuizWidgets();
        });
    }

    function updateProgressBar() {
        const completed = getCompletedQuizzes();
        const totalSubmodules = 10;
        const count = completed.length;
        const percent = Math.min(100, Math.round((count / totalSubmodules) * 100));

        const counterEl = document.getElementById('mod1-progress-count');
        const fillEl = document.getElementById('mod1-progress-fill');

        if (counterEl) counterEl.textContent = `${count} / ${totalSubmodules} (${percent}%)`;
        if (fillEl) fillEl.style.width = `${percent}%`;
    }

    // --- 4. Кнопка перехода в конце вводного раздела sec-intro ---

    function setupIntroNextButton() {
        const introSec = document.getElementById('sec-intro');
        if (!introSec || introSec.querySelector('.intro-next-step-card')) return;

        const card = document.createElement('div');
        card.className = 'intro-next-step-card';
        card.innerHTML = `
            <div class="intro-next-info">
                <h3>🚀 Готовы перейти к материалу лекции?</h3>
                <p>Первая тема: От задачи к абстракции — признаковое пространство $\\mathbb{R}^d$ и модели ML</p>
            </div>
            <button id="btn-start-mod1-lesson" class="btn-start-course">
                Начать тему 1.1: Задача и абстракция →
            </button>
        `;
        introSec.appendChild(card);

        card.querySelector('#btn-start-mod1-lesson')?.addEventListener('click', () => {
            const nav11 = document.querySelector('.nav-item[data-target="sec-1-1"]');
            if (nav11) nav11.click();
        });

        renderAllMathIn(card);
    }

    // --- 5. Отрисовка интерактивных карточек вопросов ---

    function renderQuizForSection(secId) {
        const quizzes = getQuizData();
        if (!quizzes || !quizzes[secId]) return;

        const secEl = document.getElementById(secId);
        if (!secEl) return;

        let card = secEl.querySelector('.quiz-gate-card');
        const data = quizzes[secId];
        const completed = getCompletedQuizzes();
        const isPassed = completed.includes(secId);

        if (!card) {
            card = document.createElement('div');
            card.className = 'quiz-gate-card';
            card.id = `gate-card-${secId}`;
            card.innerHTML = `
                <div class="quiz-gate-header">
                    <h3 class="quiz-gate-title">Вопрос для перехода к следующему разделу</h3>
                </div>
                <div class="quiz-gate-question">${data.question}</div>
                <div class="quiz-options-list">
                    ${data.options.map((opt, i) => `
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
                    <button class="btn-quiz-next" id="btn-next-${secId}">
                        <span>Перейти к ${data.nextTitle} →</span>
                    </button>
                </div>
            `;

            secEl.appendChild(card);

            const btnCheck = card.querySelector(`#btn-check-${secId}`);
            const btnNext = card.querySelector(`#btn-next-${secId}`);
            const feedback = card.querySelector(`#feedback_${secId}`);

            btnCheck.addEventListener('click', () => {
                const checkedRadio = card.querySelector(`input[name="quiz_choice_${secId}"]:checked`);
                if (!checkedRadio) {
                    feedback.className = 'quiz-feedback error';
                    feedback.innerHTML = '⚠️ Пожалуйста, выберите один из вариантов ответа выше.';
                    return;
                }

                const selectedIdx = parseInt(checkedRadio.value, 10);
                const allLabels = card.querySelectorAll('.quiz-option-label');

                allLabels.forEach(l => l.classList.remove('option-correct', 'option-wrong'));

                if (selectedIdx === data.correctIndex) {
                    allLabels[selectedIdx].classList.add('option-correct');
                    feedback.className = 'quiz-feedback success';
                    feedback.innerHTML = `
                        <strong>Абсолютно верно!</strong><br>
                        Следующий подмодуль разблокирован!
                    `;
                    btnNext.classList.add('visible');
                    renderAllMathIn(feedback);
                    unlockNextSection(secId, data.nextSectionId);
                } else {
                    allLabels[selectedIdx].classList.add('option-wrong');
                    feedback.className = 'quiz-feedback error';
                    feedback.innerHTML = `
                        <strong>Неверно.</strong> Подумайте ещё раз!<br>
                        <div class="quiz-hint-box"><b>Подсказка:</b> ${data.hint}</div>
                    `;
                    btnNext.classList.remove('visible');
                    renderAllMathIn(feedback);
                }
            });

            btnNext.addEventListener('click', () => {
                const targetNav = document.querySelector(`.nav-item[data-target="${data.nextSectionId}"]`);
                if (targetNav) {
                    targetNav.click();
                }
            });

            renderAllMathIn(card);
        }

        const feedback = card.querySelector(`#feedback_${secId}`);
        const btnNext = card.querySelector(`#btn-next-${secId}`);
        const correctRadio = card.querySelector(`input[value="${data.correctIndex}"]`);
        const allLabels = card.querySelectorAll('.quiz-option-label');

        if (isPassed) {
            if (correctRadio) correctRadio.checked = true;
            allLabels.forEach((l, idx) => {
                if (idx === data.correctIndex) l.classList.add('option-correct');
                else l.classList.remove('option-correct', 'option-wrong');
            });
            feedback.className = 'quiz-feedback success';
            feedback.innerHTML = `
                <strong>✓ Пройдено!</strong> Раздел <em>«${data.nextTitle}»</em> разблокирован.
            `;
            btnNext.classList.add('visible');
            renderAllMathIn(feedback);
        } else {
            btnNext.classList.remove('visible');
            if (!card.querySelector(`input[name="quiz_choice_${secId}"]:checked`)) {
                feedback.className = 'quiz-feedback';
                feedback.innerHTML = '';
            }
        }

        renderAllMathIn(card);
    }

    function refreshAllQuizWidgets() {
        const quizzes = getQuizData();
        if (!quizzes) return;
        Object.keys(quizzes).forEach(secId => {
            renderQuizForSection(secId);
        });
    }

    // --- 6. Защита кликов по заблокированным пунктам в меню ---

    function interceptNavigationClicks() {
        const mod1Group = document.getElementById('nav-group-mod1');
        if (!mod1Group) return;

        mod1Group.addEventListener('click', (e) => {
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
        setupIntroNextButton();
        updateNavigationLocks();
        updateProgressBar();
        refreshAllQuizWidgets();
        setTimeout(refreshAllQuizWidgets, 80);
        setTimeout(refreshAllQuizWidgets, 400);
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQuizSystem);
    } else {
        initQuizSystem();
    }

    window.PrikladQuizEngine = {
        unlockAll: () => {
            saveProgress([...ALL_MOD1_SECTIONS], Object.keys(getQuizData() || {}));
            updateNavigationLocks();
            updateProgressBar();
            refreshAllQuizWidgets();
        },
        reset: () => {
            saveProgress([...DEFAULT_UNLOCKED], []);
            updateNavigationLocks();
            updateProgressBar();
            refreshAllQuizWidgets();
        },
        renderAllMath: renderAllMathIn
    };
})();
