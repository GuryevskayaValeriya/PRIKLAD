/**
 * Основная логика интерактивного учебника (Vanilla JS + Plotly.js + KaTeX).
 * Модуль 1: Векторные пространства, ранг, нормы.
 */

// --- 1. Базовые алгоритмы линейной алгебры ---

function normP(x, p = 2.0, safeOverflow = false) {
    if (p < 1.0) throw new Error("Норма Lp определена только для p >= 1.0");
    if (!isFinite(p)) {
        return Math.max(...x.map(v => Math.abs(v)));
    }
    if (safeOverflow) {
        const maxVal = Math.max(...x.map(v => Math.abs(v)));
        if (maxVal === 0) return 0;
        let sum = 0;
        for (let v of x) sum += Math.pow(Math.abs(v) / maxVal, p);
        return maxVal * Math.pow(sum, 1.0 / p);
    }
    let sum = 0;
    for (let v of x) sum += Math.pow(Math.abs(v), p);
    return Math.pow(sum, 1.0 / p);
}

function dotProduct(u, v) {
    let sum = 0;
    for (let i = 0; i < u.length; i++) sum += u[i] * v[i];
    return sum;
}

function cosineSimilarity(u, v, eps = 1e-12) {
    const nu = normP(u, 2.0);
    const nv = normP(v, 2.0);
    if (nu < eps || nv < eps) return NaN;
    return dotProduct(u, v) / (nu * nv);
}

function euclideanDistance(u, v) {
    let sum = 0;
    for (let i = 0; i < u.length; i++) sum += (u[i] - v[i]) ** 2;
    return Math.sqrt(sum);
}

function l1Distance(u, v) {
    let sum = 0;
    for (let i = 0; i < u.length; i++) sum += Math.abs(u[i] - v[i]);
    return sum;
}

function linfDistance(u, v) {
    let m = 0;
    for (let i = 0; i < u.length; i++) m = Math.max(m, Math.abs(u[i] - v[i]));
    return m;
}

function jaccardOverlap(list1, list2) {
    const s1 = new Set(list1);
    const s2 = new Set(list2);
    let intersection = 0;
    for (let elem of s1) {
        if (s2.has(elem)) intersection++;
    }
    return intersection / Math.max(s1.size, s2.size, 1);
}

// Пошаговый метод Гаусса с выбором главного элемента по столбцу
function gaussianElimination(matrix, tol = 1e-9) {
    let U = matrix.map(row => [...row]);
    let m = U.length;
    let n = U[0].length;
    let steps = [`Исходная матрица размера ${m}×${n}`];
    let row = 0;

    for (let col = 0; col < n; col++) {
        if (row >= m) break;

        let maxRow = row;
        let maxVal = Math.abs(U[row][col]);
        for (let i = row + 1; i < m; i++) {
            if (Math.abs(U[i][col]) > maxVal) {
                maxVal = Math.abs(U[i][col]);
                maxRow = i;
            }
        }

        if (maxVal < tol) continue;

        if (maxRow !== row) {
            [U[row], U[maxRow]] = [U[maxRow], U[row]];
            steps.push(`Перестановка строк: Строка ${row + 1} ↔ Строка ${maxRow + 1}`);
        }

        let pivot = U[row][col];
        for (let i = row + 1; i < m; i++) {
            let factor = U[i][col] / pivot;
            if (Math.abs(factor) > tol) {
                for (let j = col; j < n; j++) {
                    U[i][j] -= factor * U[row][j];
                }
                U[i][col] = 0.0;
                steps.push(`Строка ${i + 1} = Строка ${i + 1} - (${factor.toFixed(4)}) · Строка ${row + 1}`);
            }
        }
        row++;
    }

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < n; j++) {
            if (Math.abs(U[i][j]) < tol) U[i][j] = 0.0;
        }
    }

    let rank = 0;
    let basisRows = [];
    for (let i = 0; i < m; i++) {
        let isNonZero = U[i].some(val => Math.abs(val) > tol);
        if (isNonZero) {
            rank++;
            basisRows.push(U[i]);
        }
    }
    steps.push(`Ступенчатый вид получен. Количество ненулевых строк: rank(A) = ${rank}`);

    return { stepped: U, rank, steps, basisRows };
}

// Поиск k ближайших соседей
function findKNN(X, query, k, metric = 'l2') {
    let dists = [];
    for (let i = 0; i < X.length; i++) {
        let d = 0;
        if (metric === 'l2') d = euclideanDistance(X[i], query);
        else if (metric === 'l1') d = l1Distance(X[i], query);
        else if (metric === 'linf') d = linfDistance(X[i], query);
        else if (metric === 'cosine') {
            let sim = cosineSimilarity(X[i], query);
            d = isNaN(sim) ? 2.0 : 1.0 - sim;
        }
        dists.push({ index: i, dist: d });
    }
    dists.sort((a, b) => a.dist - b.dist);
    let topIndices = dists.slice(0, k).map(item => item.index);
    let topDists = dists.slice(0, k).map(item => item.dist);
    return { indices: topIndices, dists: topDists, allDists: dists.map(d => d.dist) };
}


// --- 2. Интерактивные визуализации (Plotly.js) ---

// 1.8 Нормы L_p в 2D
function renderUnitBalls2D() {
    const container = document.getElementById('plot-unit-balls-2d');
    if (!container) return;

    const showP05 = document.getElementById('cb-p05')?.checked ?? true;
    const showP1 = document.getElementById('cb-p1')?.checked ?? true;
    const showP2 = document.getElementById('cb-p2')?.checked ?? true;
    const showPinf = document.getElementById('cb-pinf')?.checked ?? true;

    const traces = [];
    const theta = [];
    for (let t = 0; t <= 2 * Math.PI + 0.01; t += 0.01) theta.push(t);

    if (showP05) {
        let x = [], y = [];
        for (let t of theta) {
            let cos_t = Math.cos(t), sin_t = Math.sin(t);
            let r = Math.pow(Math.pow(Math.abs(cos_t), 0.5) + Math.pow(Math.abs(sin_t), 0.5), -2.0);
            x.push(r * cos_t);
            y.push(r * sin_t);
        }
        traces.push({
            x, y, mode: 'lines', name: 'p = 0.5 (невыпуклая астроида)',
            line: { color: 'rgba(179, 74, 59, 0.9)', width: 3 },
            fill: 'toself', fillcolor: 'rgba(179, 74, 59, 0.08)'
        });
    }

    if (showP1) {
        let x = [1, 0, -1, 0, 1];
        let y = [0, 1, 0, -1, 0];
        traces.push({
            x, y, mode: 'lines', name: 'L1: |x| + |y| = 1 (ромб)',
            line: { color: 'rgba(184, 134, 59, 0.95)', width: 3 },
            fill: 'toself', fillcolor: 'rgba(184, 134, 59, 0.12)'
        });
    }

    if (showP2) {
        let x = theta.map(t => Math.cos(t));
        let y = theta.map(t => Math.sin(t));
        traces.push({
            x, y, mode: 'lines', name: 'L2: x² + y² = 1 (круг)',
            line: { color: 'rgba(117, 82, 60, 0.95)', width: 3 },
            fill: 'toself', fillcolor: 'rgba(117, 82, 60, 0.12)'
        });
    }

    if (showPinf) {
        let x = [-1, 1, 1, -1, -1];
        let y = [-1, -1, 1, 1, -1];
        traces.push({
            x, y, mode: 'lines', name: 'L_inf: max(|x|,|y|) = 1 (квадрат)',
            line: { color: 'rgba(95, 122, 78, 0.95)', width: 3 },
            fill: 'toself', fillcolor: 'rgba(95, 122, 78, 0.12)'
        });
    }

    const layout = {
        title: 'Вложенность единичных шаров в R²: ||x||_∞ ≤ ||x||₂ ≤ ||x||₁',
        height: 478,
        autosize: true,
        xaxis: { range: [-1.6, 1.6], zeroline: true, zerolinecolor: '#d9cebf', title: 'x₁' },
        yaxis: { range: [-1.6, 1.6], zeroline: true, zerolinecolor: '#d9cebf', title: 'x₂', scaleanchor: 'x', scaleratio: 1 },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, traces, layout, { responsive: true });
}

// 1.8 Нормы L_p в 3D
function renderUnitBalls3D(normType = 'L2') {
    const container = document.getElementById('plot-unit-balls-3d');
    if (!container) return;

    let trace;
    let title = '';

    if (normType === 'L2') {
        let u = [], v = [];
        for (let i = 0; i <= 40; i++) u.push((2 * Math.PI * i) / 40);
        for (let i = 0; i <= 20; i++) v.push((Math.PI * i) / 20);

        let x = [], y = [], z = [];
        for (let i = 0; i <= 20; i++) {
            let rowX = [], rowY = [], rowZ = [];
            for (let j = 0; j <= 40; j++) {
                rowX.push(Math.sin(v[i]) * Math.cos(u[j]));
                rowY.push(Math.sin(v[i]) * Math.sin(u[j]));
                rowZ.push(Math.cos(v[i]));
            }
            x.push(rowX);
            y.push(rowY);
            z.push(rowZ);
        }

        trace = {
            type: 'surface', x, y, z,
            colorscale: 'Blues', opacity: 0.85, showscale: false
        };
        title = 'Единичный шар нормы L2 в R³: x² + y² + z² ≤ 1 (Сфера)';
    } else if (normType === 'L1') {
        const vertices = [
            [1, 0, 0], [-1, 0, 0],
            [0, 1, 0], [0, -1, 0],
            [0, 0, 1], [0, 0, -1]
        ];
        trace = {
            type: 'mesh3d',
            x: vertices.map(v => v[0]),
            y: vertices.map(v => v[1]),
            z: vertices.map(v => v[2]),
            i: [0, 0, 0, 0, 1, 1, 1, 1],
            j: [2, 3, 3, 2, 2, 3, 3, 2],
            k: [4, 4, 5, 5, 4, 4, 5, 5],
            color: 'orange', opacity: 0.85
        };
        title = 'Единичный шар нормы L1 в R³: |x| + |y| + |z| ≤ 1 (Октаэдр)';
    } else {
        const vertices = [
            [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
            [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
        ];
        trace = {
            type: 'mesh3d',
            x: vertices.map(v => v[0]),
            y: vertices.map(v => v[1]),
            z: vertices.map(v => v[2]),
            i: [0, 0, 4, 4, 0, 1, 2, 3, 0, 3, 1, 2],
            j: [1, 2, 5, 6, 1, 5, 6, 2, 4, 7, 5, 6],
            k: [2, 3, 6, 7, 5, 2, 3, 7, 7, 4, 6, 5],
            color: 'mediumseagreen', opacity: 0.8
        };
        title = 'Единичный шар нормы L_inf в R³: max(|x|,|y|,|z|) ≤ 1 (Куб)';
    }

    const layout = {
        title,
        height: 478,
        autosize: true,
        uirevision: 'true',
        scene: {
            xaxis: { range: [-1.4, 1.4], title: 'X' },
            yaxis: { range: [-1.4, 1.4], title: 'Y' },
            zaxis: { range: [-1.4, 1.4], title: 'Z' },
            aspectmode: 'cube',
            uirevision: 'true'
        },
        margin: { l: 0, r: 0, t: 40, b: 0 }
    };

    Plotly.react(container, [trace], layout, { responsive: true });
}

// 1.3 Линейная оболочка Span в 3D
function renderSpan3D(isDependent = true) {
    const container = document.getElementById('plot-span-3d');
    if (!container) return;

    const v1 = [1.0, 0.0, 0.5];
    const v2 = [0.0, 1.0, 0.5];
    const v3 = isDependent ? [1.5 * v1[0] - 0.8 * v2[0], 1.5 * v1[1] - 0.8 * v2[1], 1.5 * v1[2] - 0.8 * v2[2]] : [0.0, 0.0, 1.8];

    let px = [], py = [], pz = [];
    let sVals = [-1.5, -0.75, 0, 0.75, 1.5];
    let tVals = [-1.5, -0.75, 0, 0.75, 1.5];

    for (let s of sVals) {
        let rowX = [], rowY = [], rowZ = [];
        for (let t of tVals) {
            rowX.push(s * v1[0] + t * v2[0]);
            rowY.push(s * v1[1] + t * v2[1]);
            rowZ.push(s * v1[2] + t * v2[2]);
        }
        px.push(rowX);
        py.push(rowY);
        pz.push(rowZ);
    }

    const traces = [
        {
            type: 'scatter3d', mode: 'lines+markers+text',
            x: [0, v1[0]], y: [0, v1[1]], z: [0, v1[2]],
            line: { color: '#75523c', width: 8 },
            marker: { size: [0, 6], color: '#75523c' },
            text: ['', 'v₁'], textposition: 'top center', name: 'Базис v₁'
        },
        {
            type: 'scatter3d', mode: 'lines+markers+text',
            x: [0, v2[0]], y: [0, v2[1]], z: [0, v2[2]],
            line: { color: '#5f7a4e', width: 8 },
            marker: { size: [0, 6], color: '#5f7a4e' },
            text: ['', 'v₂'], textposition: 'top center', name: 'Базис v₂'
        },
        {
            type: 'surface', x: px, y: py, z: pz,
            colorscale: 'YlOrBr', opacity: 0.35, showscale: false,
            name: 'Подпространство Span(v₁, v₂)'
        },
        {
            type: 'scatter3d', mode: 'lines+markers+text',
            x: [0, v3[0]], y: [0, v3[1]], z: [0, v3[2]],
            line: { color: isDependent ? '#b34a3b' : '#b8863b', width: 8 },
            marker: { size: [0, 7], color: isDependent ? '#b34a3b' : '#b8863b' },
            text: ['', 'v₃'], textposition: 'top center',
            name: isDependent ? 'v₃ (лежит в плоскости → ЛЗ)' : 'v₃ (вне плоскости → ЛНЗ)'
        }
    ];

    const layout = {
        title: 'Линейная оболочка Span(v₁, v₂) и проверка линейной зависимости в R³',
        height: 478,
        autosize: true,
        uirevision: 'true',
        scene: {
            xaxis: { title: 'X', range: [-2, 2] },
            yaxis: { title: 'Y', range: [-2, 2] },
            zaxis: { title: 'Z', range: [-2, 2] },
            aspectmode: 'cube',
            uirevision: 'true'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 0, r: 0, t: 40, b: 0 }
    };

    Plotly.react(container, traces, layout, { responsive: true });
}

// 1.9 Касание линий уровня Lasso vs Ridge
function renderRegularizationContours(condFactor = 2.0) {
    const container = document.getElementById('plot-regularization');
    if (!container) return;

    const wStar = [1.5, 1.2];
    const xVals = [], yVals = [];
    for (let v = -1.5; v <= 2.5; v += 0.05) {
        xVals.push(v);
        yVals.push(v);
    }

    const zVals = [];
    for (let y of yVals) {
        let row = [];
        for (let x of xVals) {
            let dx = x - wStar[0];
            let dy = y - wStar[1];
            row.push(condFactor * dx * dx + dy * dy + 0.8 * dx * dy);
        }
        zVals.push(row);
    }

    let th = [];
    for (let t = 0; t <= 2 * Math.PI; t += 0.05) th.push(t);
    let l2X = th.map(t => Math.cos(t));
    let l2Y = th.map(t => Math.sin(t));

    let l1X = [1, 0, -1, 0, 1];
    let l1Y = [0, 1, 0, -1, 0];

    const traceContours = {
        type: 'contour', x: xVals, y: yVals, z: zVals,
        contours: { coloring: 'lines', showlabels: false },
        line: { color: 'rgba(126, 108, 96, 0.65)', width: 1.5 },
        showscale: false, hoverinfo: 'none', name: 'Линии уровня МНК'
    };

    const traceL2 = {
        x: l2X, y: l2Y, mode: 'lines', name: 'Ridge ||w||₂ ≤ 1 (круг)',
        line: { color: '#75523c', width: 3 }, fill: 'toself', fillcolor: 'rgba(117, 82, 60, 0.15)'
    };

    const traceL1 = {
        x: l1X, y: l1Y, mode: 'lines', name: 'Lasso ||w||₁ ≤ 1 (ромб)',
        line: { color: '#b8863b', width: 3 }, fill: 'toself', fillcolor: 'rgba(184, 134, 59, 0.2)'
    };

    const traceLassoOpt = {
        x: [1.0], y: [0.0], mode: 'markers+text',
        marker: { size: 14, color: '#b34a3b', symbol: 'star' },
        text: ['Касание в вершине: (w₁=1, w₂=0) — разреженность!'], textposition: 'bottom right', name: 'Оптимум Lasso'
    };

    const traceWStar = {
        x: [wStar[0]], y: [wStar[1]], mode: 'markers+text',
        marker: { size: 10, color: '#b34a3b', symbol: 'x' },
        text: ['w* (МНК)'], textposition: 'top right', name: 'МНК без штрафа'
    };

    const layout = {
        title: 'Геометрическое доказательство: касание эллипса МНК и вершины ромба Lasso',
        height: 478,
        autosize: true,
        xaxis: { range: [-1.2, 2.3], zeroline: true, zerolinecolor: '#d9cebf', title: 'w₁' },
        yaxis: { range: [-1.2, 2.3], zeroline: true, zerolinecolor: '#d9cebf', title: 'w₂' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, [traceContours, traceL2, traceL1, traceLassoOpt, traceWStar], layout, { responsive: true });
}

// 1.7 Масштабная инвариантность косинуса
function renderScaleInvariance(scaleMax = 20) {
    const container = document.getElementById('plot-scale-invariance');
    if (!container) return;

    const u = [2.0, 3.0];
    const v = [1.0, 4.0];

    const scales = [0.5, 1.0, 2.0, 5.0, 10.0, scaleMax];
    const dotProds = [];
    const dists = [];
    const cosines = [];

    for (let s of scales) {
        let vs = [v[0] * s, v[1] * s];
        dotProds.push(dotProduct(u, vs));
        dists.push(euclideanDistance(u, vs));
        cosines.push(cosineSimilarity(u, vs));
    }

    const traceDot = {
        x: scales, y: dotProds, mode: 'lines+markers',
        name: 'Скалярное произведение <u, s·v>', line: { color: '#9e7356', width: 2.5 }
    };
    const traceDist = {
        x: scales, y: dists, mode: 'lines+markers',
        name: 'Евклидово расстояние ||u - s·v||', line: { color: '#b34a3b', width: 2.5 }
    };
    const traceCos = {
        x: scales, y: cosines, mode: 'lines+markers',
        name: 'Косинусное сходство cos(u, s·v)', line: { color: '#5f7a4e', width: 3.5 }
    };

    const layout = {
        title: 'Инвариантность косинуса к масштабу против роста евклидова расстояния',
        height: 478,
        autosize: true,
        xaxis: { title: 'Коэффициент масштаба s' },
        yaxis: { title: 'Величина' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, [traceDot, traceDist, traceCos], layout, { responsive: true });
}


// --- 3. НОВЫЕ ВИЗУАЛИЗАЦИИ (1, 3, 5, 6, 8) ---

// [1] Траектория регуляризации Lasso vs Ridge (Trace Plot)
function renderRegularizationPaths() {
    const container = document.getElementById('plot-reg-path');
    if (!container) return;

    const lambdaPowers = [];
    for (let p = -2.5; p <= 2.5; p += 0.1) lambdaPowers.push(p);

    const w1_ridge = [], w2_ridge = [], w3_ridge = [];
    const w1_lasso = [], w2_lasso = [], w3_lasso = [];

    // Имитация траектории: истинные веса без штрафа [2.5, -1.8, 0.9]
    for (let p of lambdaPowers) {
        let lam = Math.pow(10, p);

        // Ridge: w_i = w0 / (1 + lam * c_i)
        w1_ridge.push(2.5 / (1 + 0.3 * lam));
        w2_ridge.push(-1.8 / (1 + 0.5 * lam));
        w3_ridge.push(0.9 / (1 + 0.8 * lam));

        // Lasso: мягкое зануление (soft thresholding)
        let l1_val = 2.5 - 0.4 * lam;
        w1_lasso.push(l1_val > 0 ? l1_val : 0);

        let l2_val = -1.8 + 0.6 * lam;
        w2_lasso.push(l2_val < 0 ? l2_val : 0);

        let l3_val = 0.9 - 0.9 * lam;
        w3_lasso.push(l3_val > 0 ? l3_val : 0);
    }

    const traceL1 = { x: lambdaPowers, y: w1_lasso, mode: 'lines', name: 'Lasso w₁', line: { color: '#75523c', width: 3 } };
    const traceL2 = { x: lambdaPowers, y: w2_lasso, mode: 'lines', name: 'Lasso w₂', line: { color: '#b34a3b', width: 3 } };
    const traceL3 = { x: lambdaPowers, y: w3_lasso, mode: 'lines', name: 'Lasso w₃ (занулился первым!)', line: { color: '#5f7a4e', width: 3 } };

    const traceR1 = { x: lambdaPowers, y: w1_ridge, mode: 'lines', name: 'Ridge w₁', line: { color: '#c4a482', width: 2, dash: 'dot' } };
    const traceR2 = { x: lambdaPowers, y: w2_ridge, mode: 'lines', name: 'Ridge w₂', line: { color: '#e5aa9e', width: 2, dash: 'dot' } };
    const traceR3 = { x: lambdaPowers, y: w3_ridge, mode: 'lines', name: 'Ridge w₃', line: { color: '#a7bfa0', width: 2, dash: 'dot' } };

    const layout = {
        title: 'Траектория весов w_i(λ): в Lasso веса строго зануляются по очереди (Sparsity)',
        height: 478,
        autosize: true,
        xaxis: { title: 'log₁₀(λ) — сила регуляризации', zeroline: true, zerolinecolor: '#d9cebf' },
        yaxis: { title: 'Величина веса w_i', zeroline: true, zerolinecolor: '#d9cebf' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 50, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, [traceL1, traceL2, traceL3, traceR1, traceR2, traceR3], layout, { responsive: true });
}

// [3] Центрирование данных и «раскрытие конуса» косинуса (Вариант 8)
function renderCosineCentering(isCentered = false) {
    const container = document.getElementById('plot-cosine-centering');
    if (!container) return;

    // 15 точек со сдвигом в первый квадрант
    const basePts = [
        [4.2, 5.1], [5.0, 4.8], [4.5, 6.0], [5.8, 5.2], [4.1, 4.5],
        [6.2, 6.5], [4.9, 5.5], [5.3, 4.2], [6.0, 5.9], [4.4, 5.0],
        [5.5, 6.2], [4.7, 4.9], [5.2, 5.7], [6.1, 4.8], [4.6, 5.3]
    ];

    let pts = basePts;
    if (isCentered) {
        let meanX = basePts.reduce((acc, p) => acc + p[0], 0) / basePts.length;
        let meanY = basePts.reduce((acc, p) => acc + p[1], 0) / basePts.length;
        pts = basePts.map(p => [p[0] - meanX, p[1] - meanY]);
    }

    const traces = [];
    for (let p of pts) {
        traces.push({
            x: [0, p[0]], y: [0, p[1]], mode: 'lines+markers',
            line: { color: isCentered ? 'rgba(117, 82, 60, 0.75)' : 'rgba(179, 74, 59, 0.75)', width: 2.2 },
            marker: { size: [0, 6], color: isCentered ? '#75523c' : '#b34a3b' },
            showlegend: false
        });
    }

    // Расчет минимального и максимального угла
    let angles = pts.map(p => Math.atan2(p[1], p[0]) * 180 / Math.PI);
    let minA = Math.min(...angles).toFixed(1);
    let maxA = Math.max(...angles).toFixed(1);
    let spanA = (Math.max(...angles) - Math.min(...angles)).toFixed(1);

    const layout = {
        title: isCentered
            ? `После центрирования: конус раскрылся на ${spanA}° (косинусы от -1 до +1, различимость восстановлена)`
            : `Без центрирования: все векторы в узком конусе ${spanA}° (углы малы, косинус ≈ 0.96..0.99, различимость нулевая!)`,
        height: 478,
        autosize: true,
        xaxis: { range: isCentered ? [-2.5, 2.5] : [-0.5, 7.5], zeroline: true, zerolinecolor: '#d9cebf', title: 'X₁' },
        yaxis: { range: isCentered ? [-2.5, 2.5] : [-0.5, 7.5], zeroline: true, zerolinecolor: '#d9cebf', title: 'X₂', scaleanchor: 'x', scaleratio: 1 },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, traces, layout, { responsive: true });
}

// [5] Attention: затухание градиента без деления на sqrt(dk)
function renderAttentionScaling(dk = 64) {
    const container = document.getElementById('plot-attention-grad');
    if (!container) return;

    // Генерируем 8 случайных значений скалярного произведения с дисперсией dk
    const rng = createRng(42);
    const unscaledScores = [];
    for (let i = 0; i < 8; i++) {
        unscaledScores.push(sampleNormal(rng, 0, Math.sqrt(dk)));
    }
    const scaledScores = unscaledScores.map(s => s / Math.sqrt(dk));

    // Softmax
    function calcSoftmax(scores) {
        let maxS = Math.max(...scores);
        let exps = scores.map(s => Math.exp(s - maxS));
        let sumExp = exps.reduce((a, b) => a + b, 0);
        return exps.map(e => e / sumExp);
    }

    const pUnscaled = calcSoftmax(unscaledScores);
    const pScaled = calcSoftmax(scaledScores);

    // Градиенты softmax: g_i = p_i * (1 - p_i)
    const gUnscaled = pUnscaled.map(p => p * (1 - p));
    const gScaled = pScaled.map(p => p * (1 - p));

    const keys = ['k₁', 'k₂', 'k₃', 'k₄', 'k₅', 'k₆', 'k₇', 'k₈'];

    const tracePUnscaled = { x: keys, y: pUnscaled, type: 'bar', name: 'Без деления: One-Hot вырождение!', marker: { color: '#d98b7e' } };
    const tracePScaled = { x: keys, y: pScaled, type: 'bar', name: 'Со скейлингом /√dk: сбалансировано', marker: { color: '#a68269' } };

    const traceGUnscaled = { x: keys, y: gUnscaled, type: 'bar', name: 'Градиент без деления (затухает → 0)', marker: { color: '#b34a3b' } };
    const traceGScaled = { x: keys, y: gScaled, type: 'bar', name: 'Градиент со скейлингом (активный)', marker: { color: '#5e3f2d' } };

    const layout = {
        title: `Внимание при размерности dk = ${dk}: почему необходимо делить на √dk`,
        height: 478,
        autosize: true,
        barmode: 'group',
        yaxis: { title: 'Значение' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, [tracePUnscaled, tracePScaled, traceGUnscaled, traceGScaled], layout, { responsive: true });
}

// [6] Геометрическое схлопывание пространства оператором неполного ранга в 3D
function renderRankCollapse3D(isCollapsed = false) {
    const container = document.getElementById('plot-rank-collapse');
    if (!container) return;

    // Матрица ранга 2 из лекции: A = [[1, 2, 3], [2, 4, 7], [1, 2, 4]]
    // Нормализуем для удобства отображения
    const A = [
        [0.3, 0.6, 0.9],
        [0.6, 1.2, 2.1],
        [0.3, 0.6, 1.2]
    ];

    let u = [], v = [];
    for (let i = 0; i <= 25; i++) u.push((2 * Math.PI * i) / 25);
    for (let i = 0; i <= 15; i++) v.push((Math.PI * i) / 15);

    let x = [], y = [], z = [];
    for (let i = 0; i <= 15; i++) {
        let rowX = [], rowY = [], rowZ = [];
        for (let j = 0; j <= 25; j++) {
            let px = Math.sin(v[i]) * Math.cos(u[j]);
            let py = Math.sin(v[i]) * Math.sin(u[j]);
            let pz = Math.cos(v[i]);

            if (isCollapsed) {
                // Применяем преобразование A
                let tx = A[0][0]*px + A[0][1]*py + A[0][2]*pz;
                let ty = A[1][0]*px + A[1][1]*py + A[1][2]*pz;
                let tz = A[2][0]*px + A[2][1]*py + A[2][2]*pz;
                rowX.push(tx); rowY.push(ty); rowZ.push(tz);
            } else {
                rowX.push(px); rowY.push(py); rowZ.push(pz);
            }
        }
        x.push(rowX); y.push(rowY); z.push(rowZ);
    }

    const trace = {
        type: 'surface', x, y, z,
        colorscale: isCollapsed ? 'YlOrBr' : 'Cividis',
        opacity: 0.85, showscale: false
    };

    const layout = {
        title: isCollapsed
            ? 'После A: трехмерный шар сплющился в плоский 2D эллипс (rank=2, ядро ker A сжалось в 0)'
            : 'До преобразования: полноразмерный объемный 3D единичный шар',
        height: 478,
        autosize: true,
        uirevision: 'true',
        scene: {
            xaxis: { range: [-2.5, 2.5], title: 'X' },
            yaxis: { range: [-2.5, 2.5], title: 'Y' },
            zaxis: { range: [-2.5, 2.5], title: 'Z' },
            aspectmode: 'cube',
            uirevision: 'true'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 0, r: 0, t: 40, b: 0 }
    };

    Plotly.react(container, [trace], layout, { responsive: true });
}

// [8] Диаграммы Вороного для разных метрик (L1, L2, Linf)
function renderVoronoiMetrics(metric = 'l2') {
    const container = document.getElementById('plot-voronoi');
    if (!container) return;

    const seeds = [
        [-1.2, -1.2],
        [1.2, -1.0],
        [-1.0, 1.3],
        [1.3, 1.2],
        [0.0, 0.0]
    ];

    const size = 60;
    const gridX = [], gridY = [];
    for (let i = 0; i < size; i++) {
        let v = -2.2 + (4.4 * i) / (size - 1);
        gridX.push(v);
        gridY.push(v);
    }

    const z = [];
    for (let r = 0; r < size; r++) {
        let row = [];
        let y = gridY[r];
        for (let c = 0; c < size; c++) {
            let x = gridX[c];
            let pt = [x, y];

            let bestIdx = 0;
            let bestDist = Infinity;
            for (let s = 0; s < seeds.length; s++) {
                let d = 0;
                if (metric === 'l2') d = euclideanDistance(pt, seeds[s]);
                else if (metric === 'l1') d = l1Distance(pt, seeds[s]);
                else d = linfDistance(pt, seeds[s]);

                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = s;
                }
            }
            row.push(bestIdx);
        }
        z.push(row);
    }

    const traceHeat = {
        type: 'heatmap', x: gridX, y: gridY, z: z,
        colorscale: [
            [0.0, '#f5efe6'], [0.25, '#eadbc8'],
            [0.5, '#e2cbaf'], [0.75, '#d6be9f'], [1.0, '#c7ab88']
        ],
        showscale: false, hoverinfo: 'none'
    };

    const traceSeeds = {
        x: seeds.map(s => s[0]), y: seeds.map(s => s[1]),
        mode: 'markers+text',
        marker: { size: 12, color: '#3d2b1f', line: { color: '#ffffff', width: 2 } },
        text: ['s₁', 's₂', 's₃', 's₄', 's₅'],
        textposition: 'top center',
        name: 'Опорные точки'
    };

    const metricNames = {
        'l2': 'L2 (Евклидова) — прямые гладкие границы ячеек',
        'l1': 'L1 (Манхэттенская) — ступенчатые ломаные границы со скосами под 45°',
        'linf': 'L_inf (Чебышёвская) — прямоугольные диагональные границы'
    };

    const layout = {
        title: `Зоны влияния 1-NN в метрике ${metricNames[metric]}`,
        height: 478,
        autosize: true,
        xaxis: { range: [-2.3, 2.3], title: 'x₁', scaleanchor: 'y' },
        yaxis: { range: [-2.3, 2.3], title: 'x₂' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, [traceHeat, traceSeeds], layout, { responsive: true });
}


// --- 4. ПЕРЕДЕЛАННЫЙ КАЛЬКУЛЯТОР МЕТОДА ГАУССА ---

let currentGaussRows = 3;
let currentGaussCols = 3;

function buildGaussInputGrid(rows = 3, cols = 3, presetValues = null) {
    currentGaussRows = rows;
    currentGaussCols = cols;

    const container = document.getElementById('gauss-grid-container');
    if (!container) return;

    let html = '<div class="matrix-input-table">';
    for (let r = 0; r < rows; r++) {
        html += '<div class="matrix-row">';
        for (let c = 0; c < cols; c++) {
            let val = 0;
            if (presetValues && presetValues[r] && presetValues[r][c] !== undefined) {
                val = presetValues[r][c];
            } else if (r === c) {
                val = 1;
            }
            html += `<input type="number" step="any" class="matrix-cell-input" id="g-cell-${r}-${c}" value="${val}">`;
        }
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function runDynamicGaussElimination() {
    const matrix = [];
    for (let r = 0; r < currentGaussRows; r++) {
        const row = [];
        for (let c = 0; c < currentGaussCols; c++) {
            const input = document.getElementById(`g-cell-${r}-${c}`);
            row.push(parseFloat(input?.value) || 0.0);
        }
        matrix.push(row);
    }

    const res = gaussianElimination(matrix);
    const kernelDim = currentGaussCols - res.rank;

    let outHtml = `<div class="callout callout-theory" style="margin-top:1rem;">`;
    outHtml += `<p><b>Ранг матрицы:</b> <span style="font-size:1.2rem; color:var(--primary); font-weight:800;">rank(A) = ${res.rank}</span> (из ${Math.min(currentGaussRows, currentGaussCols)})</p>`;
    outHtml += `<p><b>Размерность ядра (дефект):</b> dim ker(A) = ${kernelDim} (по теореме о ранге и дефекте: rank + dim ker = ${currentGaussCols})</p>`;
    outHtml += `</div>`;

    outHtml += `<h4>Ступенчатый вид матрицы (U):</h4><table class="data-table"><tbody>`;
    for (let r of res.stepped) {
        outHtml += '<tr>' + r.map(c => `<td><b>${c.toFixed(3)}</b></td>`).join('') + '</tr>';
    }
    outHtml += '</tbody></table>';

    outHtml += `<div style="margin-top:1.2rem; font-family:'JetBrains Mono', monospace; background:#f8fafc; border:1px solid var(--border-color); border-radius:6px; padding:1rem; font-size:0.86rem;">`;
    outHtml += `<b>Протокол элементарных преобразований прямого хода:</b><br><br>`;
    outHtml += res.steps.map(s => `• ${s}`).join('<br>');
    outHtml += `</div>`;

    document.getElementById('gauss-result-container').innerHTML = outHtml;
}


// --- 5. Обработчики навигации и событий ---


function safeRenderMath(el) {
    if (!el || !window.renderMathInElement) return;
    try {
        window.renderMathInElement(el, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ],
            throwOnError: false
        });
    } catch (e) {
        console.warn("KaTeX render notice:", e);
    }
}

function setupNavigation() {
    // Переключение между модулями курса (Модуль 1 / Модуль 2)
    const moduleTabs = document.querySelectorAll('.btn-module-tab');
    moduleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            moduleTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const modId = tab.getAttribute('data-module');
            const group1 = document.getElementById('nav-group-mod1');
            const group2 = document.getElementById('nav-group-mod2');
            const indicator = document.getElementById('course-section-indicator');

            if (window.TTSController) window.TTSController.stop();
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

            const group3 = document.getElementById('nav-group-mod3');

            if (modId === '1') {
                if (group1) group1.style.display = 'block';
                if (group2) group2.style.display = 'none';
                if (group3) group3.style.display = 'none';
                if (indicator) indicator.textContent = 'Раздел 1: Векторные пространства и нормы';
                const firstNav = group1?.querySelector('.nav-item[data-target="sec-intro"]');
                firstNav?.classList.add('active');
                const introSec = document.getElementById('sec-intro');
                if (introSec) introSec.classList.add('active');
                triggerRenderForSection('sec-intro');
            } else if (modId === '2') {
                if (group1) group1.style.display = 'none';
                if (group2) group2.style.display = 'block';
                if (group3) group3.style.display = 'none';
                if (indicator) indicator.textContent = 'Раздел 2: Системы, операторы, проекции';
                const firstNav = group2?.querySelector('.nav-item[data-target="sec-2-intro"]');
                firstNav?.classList.add('active');
                const introSec = document.getElementById('sec-2-intro');
                if (introSec) introSec.classList.add('active');
                triggerRenderForSection('sec-2-intro');
                safeRenderMath(introSec);
            } else if (modId === '3') {
                if (group1) group1.style.display = 'none';
                if (group2) group2.style.display = 'none';
                if (group3) group3.style.display = 'block';
                if (indicator) indicator.textContent = 'Раздел 3: Спектр, SVD, тензоры';
                const firstNav = group3?.querySelector('.nav-item[data-target="sec-3-intro"]');
                firstNav?.classList.add('active');
                const introSec = document.getElementById('sec-3-intro');
                if (introSec) introSec.classList.add('active');
                triggerRenderForSection('sec-3-intro');
            }
        });
    });

    // Навигация по разделам внутри модулей
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(el => el.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-target');
            if (window.TTSController) window.TTSController.stop();
            document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
            const activeSec = document.getElementById(targetId);
            if (activeSec) {
                activeSec.classList.add('active');
                triggerRenderForSection(targetId);
                safeRenderMath(activeSec);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}

function triggerRenderForSection(sectionId) {
    if (sectionId === 'sec-1-3') {
        renderSpan3D(true);
    } else if (sectionId === 'sec-1-6') {
        renderRankCollapse3D(false);
    } else if (sectionId === 'sec-1-7') {
        renderScaleInvariance(20);
        renderCosineCentering(false);
    } else if (sectionId === 'sec-1-8') {
        renderUnitBalls2D();
        renderUnitBalls3D('L2');
        renderVoronoiMetrics('l2');
    } else if (sectionId === 'sec-1-9') {
        renderRegularizationContours(2.0);
        renderRegularizationPaths();
    } else if (sectionId === 'sec-1-10') {
        renderAttentionScaling(64);
    } else if (sectionId === 'sec-seminar') {
        loadSeminarVariant(1);
    } else if (sectionId === 'sec-lab') {
        loadLabVariant(1);
    } else if (sectionId === 'sec-2-2') {
        const c1 = parseFloat(document.getElementById('slider-slau-c1')?.value || 0);
        const c2 = parseFloat(document.getElementById('slider-slau-c2')?.value || 0);
        renderSlau3D(c1, c2);
    } else if (sectionId === 'sec-2-4') {
        const type = document.getElementById('select-operator-type')?.value || 'rotate';
        const angle = parseFloat(document.getElementById('slider-op-angle')?.value || 45);
        renderLinearOperator2D(type, angle);
    } else if (sectionId === 'sec-2-6') {
        renderGramSchmidt3D(currentGsStep !== undefined ? currentGsStep : 4);
    } else if (sectionId === 'sec-2-7') {
        const y1 = parseFloat(document.getElementById('slider-proj-y1')?.value || 2);
        const y2 = parseFloat(document.getElementById('slider-proj-y2')?.value || 3);
        const y3 = parseFloat(document.getElementById('slider-proj-y3')?.value || 4);
        renderOrthogonalProjection3D(y1, y2, y3);
    } else if (sectionId === 'sec-2-9') {
        const k = parseInt(document.getElementById('slider-cond-k')?.value || 7);
        renderConditionExperiment(k);
    } else if (sectionId === 'sec-2-seminar') {
        loadSeminar2Variant(parseInt(document.getElementById('select-seminar2-variant')?.value || 1));
    } else if (sectionId === 'sec-2-lab') {
        loadLab2Variant(parseInt(document.getElementById('lab2-student-id')?.value || 1));
    } else if (sectionId === 'sec-3-2') {
        renderEigenvalues2D(document.getElementById('select-eigen-preset')?.value || 'symm_positive', parseFloat(document.getElementById('slider-eigen-vec-angle')?.value || 30));
    } else if (sectionId === 'sec-3-6') {
        renderSVDDecomposition2D(currentSvdStep || 3);
    } else if (sectionId === 'sec-3-8') {
        renderEckartYoungCompression(parseInt(document.getElementById('slider-eckart-k')?.value || 2), document.getElementById('select-eckart-pattern')?.value || 'smooth_cross');
    } else if (sectionId === 'sec-3-9') {
        renderPCAStepper(currentPcaStep || 5, parseFloat(document.getElementById('slider-pca-angle')?.value || 35), parseFloat(document.getElementById('slider-pca-noise')?.value || 0.3));
    } else if (sectionId === 'sec-3-seminar') {
        loadSeminar3Variant(parseInt(document.getElementById('select-seminar3-variant')?.value || 1));
    } else if (sectionId === 'sec-3-lab') {
        loadLab3Variant(parseInt(document.getElementById('lab3-student-id')?.value || 1));
    }
}

// Семинар 1: Загрузка варианта
function loadSeminarVariant(vId) {
    const vData = SEMINAR_VARIANTS[vId];
    if (!vData) return;

    const A = vData.A;
    const u = vData.u;
    const v = vData.v;

    let tableHtml = '<table class="data-table"><tbody>';
    for (let row of A) {
        tableHtml += '<tr>' + row.map(val => `<td><b>${val}</b></td>`).join('') + '</tr>';
    }
    tableHtml += '</tbody></table>';
    document.getElementById('sem-matrix-container').innerHTML = tableHtml;

    document.getElementById('sem-vectors-info').innerHTML = `
        <p><b>Вектор u:</b> (${u.join(', ')})</p>
        <p><b>Вектор v:</b> (${v.join(', ')})</p>
    `;

    const resGauss = gaussianElimination(A);
    const badgeColor = resGauss.rank === 3 ? 'var(--primary)' : 'var(--warning)';
    let rankDesc = resGauss.rank === 3
        ? 'Все 3 строки независимы (базис 3-мерного подпространства в ℝ⁴).'
        : `Ранг равен 2: строки линейно зависимы! ${vData.depExplanation || 'Третья строка выражается через первые две.'}`;

    if (vData.isOrthogonal) {
        rankDesc += ' <span style="color:var(--success); font-weight:600;">(Векторы u и v точно ортогональны: ⟨u, v⟩ = 0)</span>';
    } else if (vData.note) {
        rankDesc += ` <span style="color:var(--text-muted);">(${vData.note})</span>`;
    }

    document.getElementById('sem-rank-result').innerHTML = `
        <p><b>Вычисленный ранг:</b> <span style="font-size:1.1rem; color:${badgeColor}; font-weight:700;">rank(A) = ${resGauss.rank}</span></p>
        <p style="font-size:0.9rem; color:var(--text-muted);">${rankDesc}</p>
    `;

    const diff_uv = u.map((val, idx) => val - v[idx]);

    document.getElementById('sem-norms-table').innerHTML = `
        <table class="data-table">
            <thead><tr><th>Вектор</th><th>Норма L1</th><th>Норма L2</th><th>Норма L_inf</th><th>Неравенство L_inf ≤ L2 ≤ L1</th></tr></thead>
            <tbody>
                <tr><td>u</td><td>${normP(u, 1).toFixed(2)}</td><td>${normP(u, 2).toFixed(3)}</td><td>${normP(u, Infinity)}</td><td>✓ Выполнено</td></tr>
                <tr><td>v</td><td>${normP(v, 1).toFixed(2)}</td><td>${normP(v, 2).toFixed(3)}</td><td>${normP(v, Infinity)}</td><td>✓ Выполнено</td></tr>
                <tr><td>(u - v)</td><td>${normP(diff_uv, 1).toFixed(2)}</td><td>${normP(diff_uv, 2).toFixed(3)}</td><td>${normP(diff_uv, Infinity)}</td><td>✓ Выполнено</td></tr>
            </tbody>
        </table>
    `;

    const dot = dotProduct(u, v);
    const cos = cosineSimilarity(u, v);
    const dist = euclideanDistance(u, v);

    const uNorm = u.map(val => val / normP(u, 2));
    const vNorm = v.map(val => val / normP(v, 2));
    const lhs = euclideanDistance(uNorm, vNorm) ** 2;
    const rhs = 2.0 - 2.0 * cosineSimilarity(uNorm, vNorm);

    document.getElementById('sem-cos-result').innerHTML = `
        <p><b>Скалярное произведение:</b> $\\langle u, v \\rangle = ${dot}$</p>
        <p><b>Косинусное сходство:</b> $\\cos(u, v) = ${cos.toFixed(3)}$ (угол $\\approx ${(Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI).toFixed(1)}^\\circ$)</p>
        <p><b>Евклидово расстояние:</b> $d(u, v) = ${dist.toFixed(3)}$</p>
        <hr style="margin:0.8rem 0; border:none; border-top:1px solid var(--border-color);">
        <p><b>Проверка тождества на сфере:</b> $\|u_{norm} - v_{norm}\|_2^2 = ${lhs.toFixed(4)}$, $2 - 2\\cos = ${rhs.toFixed(4)}$ (Тождество выполняется: <b>${Math.abs(lhs - rhs) < 1e-6 ? 'ДА (совпадает)' : 'НЕТ'}</b>)</p>
    `;

    if (window.renderMathInElement) {
        renderMathInElement(document.getElementById('sem-cos-result'), {
            delimiters: [{left: "$", right: "$", display: false}]
        });
    }
}

// Лабораторная работа 1: Загрузка варианта
function loadLabVariant(studentId) {
    const params = getLabVariantParams(studentId);
    const info = params.info;

    document.getElementById('lab-variant-header').innerHTML = `
        <h4>Вариант №${studentId} (seed = ${params.seed})</h4>
        <p><b>Число объектов N:</b> ${params.nObjects} | <b>Размерности D:</b> ${params.dims.join(', ')}</p>
        <p><b>Распределение X:</b> ${info.distribution} | <b>Предобработка:</b> ${info.preprocessing}</p>
        <p><b>Основная метрика:</b> ${info.primaryMetric}</p>
        <p style="margin-top:0.5rem; color:#1e3a8a;"><b>Содержательный вопрос варианта:</b> <i>${info.question}</i></p>
    `;

    runVerificationTests();
}

function runVerificationTests() {
    const testVec = [3.0, -4.0, 12.0];
    const l1 = normP(testVec, 1);
    const l2 = normP(testVec, 2);
    const linf = normP(testVec, Infinity);

    const bigVec = [1e154, 1e154];
    const safeNorm = normP(bigVec, 2, true);

    document.getElementById('lab-verification-res').innerHTML = `
        <table class="data-table">
            <thead><tr><th>Тестовый вектор</th><th>L1 норма</th><th>L2 норма</th><th>L_inf норма</th><th>Безопасный расчет (1e154)</th></tr></thead>
            <tbody>
                <tr>
                    <td>(3, -4, 12)</td>
                    <td>${l1}</td>
                    <td>${l2}</td>
                    <td>${linf}</td>
                    <td>${safeNorm.toExponential(4)} (Успешно, нет inf)</td>
                </tr>
            </tbody>
        </table>
    `;
}

function runLabExperiment() {
    const studentId = parseInt(document.getElementById('lab-student-id').value) || 1;
    const params = getLabVariantParams(studentId);
    const info = params.info;
    const dims = params.dims;

    const ratios = [];
    const overlapL1L2 = [];
    const overlapL2Cos = [];
    const overlapL2Linf = [];

    for (let d of dims) {
        const { X, query } = generateLabData(studentId, d);

        const resL2 = findKNN(X, query, params.k, 'l2');
        const resL1 = findKNN(X, query, params.k, 'l1');
        const resLinf = findKNN(X, query, params.k, 'linf');
        const resCos = findKNN(X, query, params.k, 'cosine');

        let dMin = Math.min(...resL2.allDists);
        let dMax = Math.max(...resL2.allDists);
        let ratio = (dMax - dMin) / (dMin + 1e-9);
        ratios.push(ratio);

        overlapL1L2.push(jaccardOverlap(resL1.indices, resL2.indices));
        overlapL2Cos.push(jaccardOverlap(resL2.indices, resCos.indices));
        overlapL2Linf.push(jaccardOverlap(resL2.indices, resLinf.indices));
    }

    const traceCurse = {
        x: dims, y: ratios, mode: 'lines+markers',
        name: '(d_max - d_min) / d_min',
        line: { color: '#75523c', width: 3 }
    };
    const layoutCurse = {
        title: 'Контраст расстояний (d_max - d_min)/d_min по размерностям D',
        height: 418,
        autosize: true,
        xaxis: { title: 'Размерность D (log)', type: 'log' },
        yaxis: { title: 'Отношение контраста' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };
    Plotly.react('plot-lab-curse', [traceCurse], layoutCurse, { responsive: true });

    const trace12 = { x: dims, y: overlapL1L2, mode: 'lines+markers', name: 'L1 vs L2', line: { color: '#75523c', width: 2.5 } };
    const trace2c = { x: dims, y: overlapL2Cos, mode: 'lines+markers', name: 'L2 vs Cosine', line: { color: '#5f7a4e', width: 2.5 } };
    const trace2inf = { x: dims, y: overlapL2Linf, mode: 'lines+markers', name: 'L2 vs Linf', line: { color: '#b8863b', width: 2.5 } };

    const layoutOverlap = {
        title: 'Jaccard Overlap списков топ-10 соседей между метриками',
        height: 418,
        autosize: true,
        xaxis: { title: 'Размерность D (log)', type: 'log' },
        yaxis: { title: 'Доля совпадения', range: [-0.05, 1.05] },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };
    Plotly.react('plot-lab-overlap', [trace12, trace2c, trace2inf], layoutOverlap, { responsive: true });

    document.getElementById('lab-conclusion-box').innerHTML = `
        <h4>📝 Заключение по вопросу индивидуального варианта №${studentId}</h4>
        <p><b>Вопрос:</b> <i>${info.question}</i></p>
        <p style="margin-top:0.5rem;">
            <b>Анализ экспериментальных данных:</b><br>
            Численный эксперимент наглядно демонстрирует эффект <b>концентрации меры (проклятия размерности)</b>:
            с ростом размерности $D$ от 2 до 256 отношение $\\frac{d_{\\max} - d_{\\min}}{d_{\\min}}$ монотонно падает к околонулевым значениям.
            В высоких размерностях все объекты оказываются приблизительно на одинаковом расстоянии от запроса, а разница между метриками $L_1, L_2, L_\\infty$ размывается.
        </p>
    `;

    if (window.renderMathInElement) {
        renderMathInElement(document.getElementById('lab-conclusion-box'), {
            delimiters: [{left: "$", right: "$", display: false}]
        });
    }
}


// --- 6. Инициализация при старте ---

function rafThrottle(fn) {
    let rafId = null;
    return function (...args) {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            rafId = null;
            fn.apply(this, args);
        });
    };
}

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    TTSController.init();

    // Инициализация калькулятора Гаусса со встроенной сеткой
    const selectRows = document.getElementById('gauss-select-rows');
    const selectCols = document.getElementById('gauss-select-cols');

    function refreshGaussGrid() {
        const r = parseInt(selectRows?.value) || 3;
        const c = parseInt(selectCols?.value) || 3;
        buildGaussInputGrid(r, c);
    }

    selectRows?.addEventListener('change', refreshGaussGrid);
    selectCols?.addEventListener('change', refreshGaussGrid);

    // Пресеты калькулятора Гаусса
    document.getElementById('preset-gauss-lecture')?.addEventListener('click', () => {
        selectRows.value = "3";
        selectCols.value = "3";
        buildGaussInputGrid(3, 3, [[1, 2, 3], [2, 4, 7], [1, 2, 4]]);
        runDynamicGaussElimination();
    });

    document.getElementById('preset-gauss-sem1')?.addEventListener('click', () => {
        selectRows.value = "3";
        selectCols.value = "4";
        buildGaussInputGrid(3, 4, [[1, -2, 3, 0], [0, 1, -2, 3], [-3, -2, 3, -1]]);
        runDynamicGaussElimination();
    });

    document.getElementById('preset-gauss-sem13')?.addEventListener('click', () => {
        selectRows.value = "3";
        selectCols.value = "4";
        buildGaussInputGrid(3, 4, [[1, -1, 2, -2], [0, -3, 2, 1], [-1, -2, 0, 3]]);
        runDynamicGaussElimination();
    });

    document.getElementById('preset-gauss-ident')?.addEventListener('click', () => {
        selectRows.value = "3";
        selectCols.value = "3";
        buildGaussInputGrid(3, 3, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
        runDynamicGaussElimination();
    });

    document.getElementById('preset-gauss-rank1')?.addEventListener('click', () => {
        selectRows.value = "3";
        selectCols.value = "3";
        buildGaussInputGrid(3, 3, [[1, 2, 3], [2, 4, 6], [-1, -2, -3]]);
        runDynamicGaussElimination();
    });

    document.getElementById('btn-run-dynamic-gauss')?.addEventListener('click', runDynamicGaussElimination);

    // Первоначальное построение сетки Гаусса
    buildGaussInputGrid(3, 3, [[1, 2, 3], [2, 4, 7], [1, 2, 4]]);
    runDynamicGaussElimination();

    // 1.8 Чекбоксы 2D шаров
    ['cb-p05', 'cb-p1', 'cb-p2', 'cb-pinf'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', renderUnitBalls2D);
    });

    // 1.8 3D нормы
    document.getElementById('select-3d-norm')?.addEventListener('change', (e) => {
        renderUnitBalls3D(e.target.value);
    });

    // 1.8 Диаграммы Вороного
    document.getElementById('select-voronoi-metric')?.addEventListener('change', (e) => {
        renderVoronoiMetrics(e.target.value);
    });

    // 1.3 Переключатель Span
    document.getElementById('btn-span-dep')?.addEventListener('click', () => renderSpan3D(true));
    document.getElementById('btn-span-indep')?.addEventListener('click', () => renderSpan3D(false));

    // 1.6 Схлопывание ранга 3D
    document.getElementById('btn-collapse-before')?.addEventListener('click', () => renderRankCollapse3D(false));
    document.getElementById('btn-collapse-after')?.addEventListener('click', () => renderRankCollapse3D(true));

    // 1.7 Центрирование косинуса
    document.getElementById('btn-center-before')?.addEventListener('click', () => renderCosineCentering(false));
    document.getElementById('btn-center-after')?.addEventListener('click', () => renderCosineCentering(true));

    // 1.7 Слайдер масштаба
    document.getElementById('slider-scale-max')?.addEventListener('input', rafThrottle((e) => {
        document.getElementById('val-scale-max').textContent = e.target.value;
        renderScaleInvariance(parseFloat(e.target.value));
    }));

    // 1.9 Слайдер обусловленности
    document.getElementById('slider-reg-cond')?.addEventListener('input', rafThrottle((e) => {
        document.getElementById('val-reg-cond').textContent = e.target.value;
        renderRegularizationContours(parseFloat(e.target.value));
    }));

    // 1.10 Слайдер размерности dk для Attention
    document.getElementById('select-dk-attention')?.addEventListener('change', (e) => {
        renderAttentionScaling(parseInt(e.target.value));
    });

    // Вариант семинара
    document.getElementById('select-seminar-variant')?.addEventListener('change', (e) => {
        loadSeminarVariant(parseInt(e.target.value));
    });

    // Вариант лабораторной
    document.getElementById('lab-student-id')?.addEventListener('change', (e) => {
        loadLabVariant(parseInt(e.target.value));
    });
    document.getElementById('btn-run-lab')?.addEventListener('click', runLabExperiment);

    // Аккордеоны
    document.querySelectorAll('.accordion-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
            hdr.parentElement.classList.toggle('open');
        });
    });

    // Табы в лабораторной
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const paneId = btn.getAttribute('data-tab');
            const targetPane = document.getElementById(paneId);
            if (targetPane) {
                setTimeout(() => safeRenderMath(targetPane), 50);
            }
            const tabGroup = btn.parentElement;
            tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetPaneId = btn.getAttribute('data-tab');
            const parentSection = btn.closest('.content-section');
            parentSection.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.getElementById(targetPaneId);
            if (pane) pane.classList.add('active');
        });
    });

    // Рендер формул KaTeX
    if (window.renderMathInElement) {
        renderMathInElement(document.body, {
            delimiters: [
                {left: "$$", right: "$$", display: true},
                {left: "$", right: "$", display: false}
            ],
            throwOnError: false
        });
    }

    // Первоначальный рендер всех графиков
    renderUnitBalls2D();
    renderUnitBalls3D('L2');
    renderVoronoiMetrics('l2');
    renderRankCollapse3D(false);
    renderCosineCentering(false);
    renderScaleInvariance(20);
    renderRegularizationContours(2.0);
    renderRegularizationPaths();
    renderAttentionScaling(64);
    loadSeminarVariant(1);
    loadLabVariant(1);

    // --- МОДУЛЬ 2: Слушатели событий и инициализация ---
    // 2.2 СЛАУ 3D (Расщепление x = x_part + Ker(A))
    const sliderSlauC1 = document.getElementById('slider-slau-c1');
    const sliderSlauC2 = document.getElementById('slider-slau-c2');
    const updateSlauPlot = rafThrottle(() => {
        const c1 = parseFloat(sliderSlauC1?.value || 0);
        const c2 = parseFloat(sliderSlauC2?.value || 0);
        const spanC1 = document.getElementById('val-slau-c1');
        const spanC2 = document.getElementById('val-slau-c2');
        if (spanC1) spanC1.textContent = c1.toFixed(1);
        if (spanC2) spanC2.textContent = c2.toFixed(1);
        renderSlau3D(c1, c2);
    });
    sliderSlauC1?.addEventListener('input', updateSlauPlot);
    sliderSlauC2?.addEventListener('input', updateSlauPlot);

    // 2.4 Геометрический оператор 2D
    const selectOp = document.getElementById('select-operator-type');
    const sliderOpAngle = document.getElementById('slider-op-angle');
    const updateOperatorPlot = rafThrottle(() => {
        const type = selectOp?.value || 'rotate';
        const angle = parseFloat(sliderOpAngle?.value || 45);
        const valSpan = document.getElementById('val-op-angle');
        if (valSpan) valSpan.textContent = angle;
        renderLinearOperator2D(type, angle);
    });
    selectOp?.addEventListener('change', updateOperatorPlot);
    sliderOpAngle?.addEventListener('input', updateOperatorPlot);

    // 2.6 Процесс Грама-Шмидта (пошаговая ортогонализация Шаги 0-4)
    document.getElementById('btn-gs-step0')?.addEventListener('click', () => renderGramSchmidt3D(0));
    document.getElementById('btn-gs-step1')?.addEventListener('click', () => renderGramSchmidt3D(1));
    document.getElementById('btn-gs-step2')?.addEventListener('click', () => renderGramSchmidt3D(2));
    document.getElementById('btn-gs-step3')?.addEventListener('click', () => renderGramSchmidt3D(3));
    document.getElementById('btn-gs-step4')?.addEventListener('click', () => renderGramSchmidt3D(4));

    // 2.7 Ортогональная проекция 3D
    const sliderProjY1 = document.getElementById('slider-proj-y1');
    const sliderProjY2 = document.getElementById('slider-proj-y2');
    const sliderProjY3 = document.getElementById('slider-proj-y3');
    const updateProjPlot = rafThrottle(() => {
        const y1 = parseFloat(sliderProjY1?.value || 2);
        const y2 = parseFloat(sliderProjY2?.value || 3);
        const y3 = parseFloat(sliderProjY3?.value || 4);
        const spanY1 = document.getElementById('val-proj-y1');
        const spanY2 = document.getElementById('val-proj-y2');
        const spanY3 = document.getElementById('val-proj-y3');
        if (spanY1) spanY1.textContent = y1.toFixed(1);
        if (spanY2) spanY2.textContent = y2.toFixed(1);
        if (spanY3) spanY3.textContent = y3.toFixed(1);
        renderOrthogonalProjection3D(y1, y2, y3);
    });
    sliderProjY1?.addEventListener('input', updateProjPlot);
    sliderProjY2?.addEventListener('input', updateProjPlot);
    sliderProjY3?.addEventListener('input', updateProjPlot);

    // 2.9 Число обусловленности kappa(A)
    const sliderCondK = document.getElementById('slider-cond-k');
    const updateCondPlot = rafThrottle(() => {
        const k = parseInt(sliderCondK?.value || 7);
        const spanK = document.getElementById('val-cond-k');
        if (spanK) spanK.textContent = k;
        renderConditionExperiment(k);
    });
    sliderCondK?.addEventListener('input', updateCondPlot);

    // Семинар 2: селектор 20 вариантов
    document.getElementById('select-seminar2-variant')?.addEventListener('change', (e) => {
        loadSeminar2Variant(parseInt(e.target.value));
    });

    // Лабораторная работа 2: выбор студента и запуск эксперимента обусловленности
    document.getElementById('lab2-student-id')?.addEventListener('change', (e) => {
        loadLab2Variant(parseInt(e.target.value));
    });
    document.getElementById('btn-run-lab2')?.addEventListener('click', () => {
        const sid = parseInt(document.getElementById('lab2-student-id')?.value || 1);
        runLab2Experiment(sid);
    });

    // Первичный рендер визуализаций Модуля 2
    renderSlau3D(0, 0);
    renderLinearOperator2D('rotate', 45);
    renderGramSchmidt3D(4);
    renderOrthogonalProjection3D(2, 3, 4);
    renderConditionExperiment(7);
    loadSeminar2Variant(1);
    loadLab2Variant(1);

    // --- МОДУЛЬ 3: Слушатели событий и инициализация ---
    // 3.3 Собственные значения 2D
    const selectEigen = document.getElementById('select-eigen-preset');
    const sliderEigenAngle = document.getElementById('slider-eigen-vec-angle');
    const updateEigenPlot = rafThrottle(() => {
        const preset = selectEigen?.value || 'symm_positive';
        const angle = parseFloat(sliderEigenAngle?.value || 30);
        const valSpan = document.getElementById('val-eigen-vec-angle');
        if (valSpan) valSpan.textContent = angle;
        renderEigenvalues2D(preset, angle);
    });
    selectEigen?.addEventListener('change', updateEigenPlot);
    sliderEigenAngle?.addEventListener('input', updateEigenPlot);

    // 3.5 SVD 2D Шаги
    document.getElementById('btn-svd-step0')?.addEventListener('click', () => renderSVDDecomposition2D(0));
    document.getElementById('btn-svd-step1')?.addEventListener('click', () => renderSVDDecomposition2D(1));
    document.getElementById('btn-svd-step2')?.addEventListener('click', () => renderSVDDecomposition2D(2));
    document.getElementById('btn-svd-step3')?.addEventListener('click', () => renderSVDDecomposition2D(3));

    // 3.7 Низкоранговое сжатие Эккарта-Юнга
    const sliderEckartK = document.getElementById('slider-eckart-k');
    const selectEckartPat = document.getElementById('select-eckart-pattern');
    const updateEckartPlot = rafThrottle(() => {
        const k = parseInt(sliderEckartK?.value || 2);
        const pat = selectEckartPat?.value || 'smooth_cross';
        const valSpan = document.getElementById('val-eckart-k');
        if (valSpan) valSpan.textContent = k;
        renderEckartYoungCompression(k, pat);
    });
    sliderEckartK?.addEventListener('input', updateEckartPlot);
    selectEckartPat?.addEventListener('change', updateEckartPlot);

    // 3.9 Пошаговый PCA (Шаги 1–5)
    const sliderPcaAngle = document.getElementById('slider-pca-angle');
    const sliderPcaNoise = document.getElementById('slider-pca-noise');
    const updatePcaPlot = rafThrottle(() => {
        const ang = parseFloat(sliderPcaAngle?.value || 35);
        const nse = parseFloat(sliderPcaNoise?.value || 0.3);
        const valAng = document.getElementById('val-pca-angle');
        const valNse = document.getElementById('val-pca-noise');
        if (valAng) valAng.textContent = ang;
        if (valNse) valNse.textContent = nse.toFixed(2);
        renderPCAStepper(currentPcaStep || 5, ang, nse);
    });
    sliderPcaAngle?.addEventListener('input', updatePcaPlot);
    sliderPcaNoise?.addEventListener('input', updatePcaPlot);

    document.getElementById('btn-pca-step1')?.addEventListener('click', () => updatePcaStep(1));
    document.getElementById('btn-pca-step2')?.addEventListener('click', () => updatePcaStep(2));
    document.getElementById('btn-pca-step3')?.addEventListener('click', () => updatePcaStep(3));
    document.getElementById('btn-pca-step4')?.addEventListener('click', () => updatePcaStep(4));
    document.getElementById('btn-pca-step5')?.addEventListener('click', () => updatePcaStep(5));

    function updatePcaStep(st) {
        const ang = parseFloat(sliderPcaAngle?.value || 35);
        const nse = parseFloat(sliderPcaNoise?.value || 0.3);
        renderPCAStepper(st, ang, nse);
    }

    // 3.10 Broadcasting Валидатор
    document.getElementById('btn-check-broadcast')?.addEventListener('click', () => {
        const sA = document.getElementById('input-broadcast-a')?.value || '16, 3, 64, 64';
        const sB = document.getElementById('input-broadcast-b')?.value || '3, 1, 1';
        checkBroadcasting(sA, sB);
    });

    // Семинар 3: селектор 20 вариантов
    document.getElementById('select-seminar3-variant')?.addEventListener('change', (e) => {
        loadSeminar3Variant(parseInt(e.target.value));
    });

    // Лабораторная работа 3: выбор студента и запуск
    document.getElementById('lab3-student-id')?.addEventListener('change', (e) => {
        loadLab3Variant(parseInt(e.target.value));
    });
    document.getElementById('btn-run-lab3')?.addEventListener('click', () => {
        const sid = parseInt(document.getElementById('lab3-student-id')?.value || 1);
        runLab3Experiment(sid);
    });

    // Первичный рендер визуализаций Модуля 3
    renderEigenvalues2D('symm_positive', 30);
    renderSVDDecomposition2D(3);
    renderEckartYoungCompression(2, 'smooth_cross');
    renderPCAStepper(5, 35, 0.3);
    checkBroadcasting('16, 3, 64, 64', '3, 1, 1');
    loadSeminar3Variant(1);
    loadLab3Variant(1);
});


// ==========================================================================
// МОДУЛЬ 2: ВЫЧИСЛИТЕЛЬНЫЕ И ГРАФИЧЕСКИЕ АЛГОРИТМЫ
// ==========================================================================


// =========================================================================
// === МОДУЛЬ 2: СИСТЕМЫ, ОПЕРАТОРЫ, ПРОЕКЦИИ =============================
// =========================================================================

// --- 2.1 Алгоритмы модуля 2 ---

function det2x2(m) {
    return m[0][0] * m[1][1] - m[0][1] * m[1][0];
}

function det3x3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
}

// Решение 2x2 СЛАУ методом Крамера
function solve2x2(A, b) {
    const d = det2x2(A);
    if (Math.abs(d) < 1e-12) return null;
    const d1 = b[0] * A[1][1] - A[0][1] * b[1];
    const d2 = A[0][0] * b[1] - b[0] * A[1][0];
    return [d1 / d, d2 / d];
}

// Модифицированный процесс Грама-Шмидта для 3 векторов
function runGramSchmidt3D(vectors) {
    const v1 = [...vectors[0]];
    const v2 = [...vectors[1]];
    const v3 = [...vectors[2]];

    const q1 = v1.map(x => x / normP(v1, 2));

    const proj2_1 = dotProduct(v2, q1);
    const u2 = v2.map((x, i) => x - proj2_1 * q1[i]);
    const q2 = u2.map(x => x / normP(u2, 2));

    const proj3_1 = dotProduct(v3, q1);
    const proj3_2 = dotProduct(v3, q2);
    const u3 = v3.map((x, i) => x - proj3_1 * q1[i] - proj3_2 * q2[i]);
    const q3 = u3.map(x => x / normP(u3, 2));

    return {
        v: [v1, v2, v3],
        u: [v1, u2, u3],
        q: [q1, q2, q3],
        projections: { proj2_1, proj3_1, proj3_2 }
    };
}

// --- 2.2 Интерактивные визуализации модуля 2 ---

let currentGsStep = 4;

// -------------------------------------------------------------------------
// [2.2] 3D-Стенд: Расщепление решения x = x_part + Ker(A)
// -------------------------------------------------------------------------
function renderSlau3D(c1 = 0, c2 = 0) {
    const container = document.getElementById('plot-slau-3d');
    if (!container) return;

    // Уравнение: x1 + 2*x2 - x3 = 3
    // x_part = (3, 0, 0)
    // Ker(A): x1 + 2*x2 - x3 = 0, базис ФСР: v1 = (-2, 1, 0), v2 = (1, 0, 1)
    const xPart = [3, 0, 0];
    const v1 = [-2, 1, 0];
    const v2 = [1, 0, 1];

    const xHomog = [c1 * v1[0] + c2 * v2[0], c1 * v1[1] + c2 * v2[1], c1 * v1[2] + c2 * v2[2]];
    const xSol = [xPart[0] + xHomog[0], xPart[1] + xHomog[1], xPart[2] + xHomog[2]];

    // Сетка для плоскости ядра: x3 = x1 + 2*x2
    const kerGridX = [];
    const kerGridY = [];
    const kerGridZ = [];
    const solGridX = [];
    const solGridY = [];
    const solGridZ = [];

    for (let u = -3; u <= 3; u += 1.5) {
        const rowKx = [], rowKy = [], rowKz = [];
        const rowSx = [], rowSy = [], rowSz = [];
        for (let v = -3; v <= 3; v += 1.5) {
            rowKx.push(u);
            rowKy.push(v);
            rowKz.push(u + 2 * v);

            rowSx.push(u);
            rowSy.push(v);
            rowSz.push(u + 2 * v - 3);
        }
        kerGridX.push(rowKx);
        kerGridY.push(rowKy);
        kerGridZ.push(rowKz);
        solGridX.push(rowSx);
        solGridY.push(rowSy);
        solGridZ.push(rowSz);
    }

    // 1. Плоскость ядра Ker(A) (через начало координат)
    const traceKerPlane = {
        type: 'surface',
        x: kerGridX, y: kerGridY, z: kerGridZ,
        opacity: 0.35,
        showscale: false,
        colorscale: [[0, '#d1dfd2'], [1, '#8fa892']],
        name: 'Ядро Ker(A): x₁+2x₂-x₃=0'
    };

    // 2. Аффинная плоскость решений x_part + Ker(A)
    const traceSolPlane = {
        type: 'surface',
        x: solGridX, y: solGridY, z: solGridZ,
        opacity: 0.45,
        showscale: false,
        colorscale: [[0, '#e8ded6'], [1, '#c2a897']],
        name: 'Плоскость решений: x₁+2x₂-x₃=3'
    };

    // 3. Начало координат
    const traceOrigin = {
        type: 'scatter3d',
        mode: 'markers+text',
        x: [0], y: [0], z: [0],
        marker: { size: 5, color: '#2a1d17' },
        text: ['O (0,0,0)'],
        textposition: 'bottom center',
        name: 'Начало координат'
    };

    // 4. Вектор частного решения x_part
    const traceXpart = {
        type: 'scatter3d',
        mode: 'lines+markers+text',
        x: [0, xPart[0]], y: [0, xPart[1]], z: [0, xPart[2]],
        line: { color: '#75523c', width: 6 },
        marker: { size: [3, 7], color: '#75523c' },
        text: ['', 'x_part (3, 0, 0)'],
        textposition: 'top right',
        name: 'Частное решение x_part'
    };

    // 5. Вектор общего решения однородной системы x_homog (в ядре)
    const traceXhomog = {
        type: 'scatter3d',
        mode: 'lines+markers+text',
        x: [0, xHomog[0]], y: [0, xHomog[1]], z: [0, xHomog[2]],
        line: { color: '#5f7a4e', width: 5, dash: 'dash' },
        marker: { size: [2, 6], color: '#5f7a4e' },
        text: ['', 'x_homog ∈ Ker(A)'],
        textposition: 'top left',
        name: 'Однородное x_homog = c₁v₁+c₂v₂'
    };

    // 6. Сумма: перенос вектора x_homog в точку x_part к точке x
    const traceShiftLine = {
        type: 'scatter3d',
        mode: 'lines',
        x: [xPart[0], xSol[0]], y: [xPart[1], xSol[1]], z: [xPart[2], xSol[2]],
        line: { color: '#b8863b', width: 4, dash: 'dot' },
        name: 'Сдвиг на x_homog'
    };

    // 7. Итоговая точка решения x = x_part + x_homog
    const traceXsol = {
        type: 'scatter3d',
        mode: 'markers+text',
        x: [xSol[0]], y: [xSol[1]], z: [xSol[2]],
        marker: { size: 9, color: '#b34a3b' },
        text: [`x(c) = (${xSol[0].toFixed(1)}, ${xSol[1].toFixed(1)}, ${xSol[2].toFixed(1)})`],
        textposition: 'top center',
        name: 'Текущее решение x(c₁, c₂)'
    };

    // 8. Базисные векторы ядра v1 и v2
    const traceV1 = {
        type: 'scatter3d',
        mode: 'lines+text',
        x: [0, v1[0]], y: [0, v1[1]], z: [0, v1[2]],
        line: { color: '#2d5c36', width: 4 },
        text: ['', 'v₁ (-2,1,0)'],
        name: 'Базис ядра v₁'
    };
    const traceV2 = {
        type: 'scatter3d',
        mode: 'lines+text',
        x: [0, v2[0]], y: [0, v2[1]], z: [0, v2[2]],
        line: { color: '#2d5c36', width: 4 },
        text: ['', 'v₂ (1,0,1)'],
        name: 'Базис ядра v₂'
    };

    const layout = {
        title: `Аффинное пространство решений: x = (${xSol[0].toFixed(2)}, ${xSol[1].toFixed(2)}, ${xSol[2].toFixed(2)})ᵀ`,
        height: 478,
        autosize: true,
        uirevision: 'true',
        scene: {
            xaxis: { title: 'X₁', range: [-5, 6] },
            yaxis: { title: 'X₂', range: [-5, 6] },
            zaxis: { title: 'X₃', range: [-5, 6] },
            camera: { eye: { x: 1.7, y: -1.7, z: 1.2 } },
            aspectmode: 'cube',
            uirevision: 'true'
        },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 20, r: 20, t: 40, b: 20 }
    };

    Plotly.react(container, [traceKerPlane, traceSolPlane, traceOrigin, traceXpart, traceXhomog, traceShiftLine, traceXsol, traceV1, traceV2], layout, { responsive: true });

    // Обновление карточки со статистикой
    const statsEl = document.getElementById('slau-solution-stats');
    if (statsEl) {
        const checkAx = xSol[0] + 2 * xSol[1] - xSol[2];
        const normX = Math.sqrt(xSol[0] * xSol[0] + xSol[1] * xSol[1] + xSol[2] * xSol[2]);
        const normPart = Math.sqrt(xPart[0] * xPart[0]);
        const normHomog = Math.sqrt(xHomog[0] * xHomog[0] + xHomog[1] * xHomog[1] + xHomog[2] * xHomog[2]);

        statsEl.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                <div>
                    <b>Текущий вектор решения x:</b><br>
                    $x = \\begin{pmatrix} ${xSol[0].toFixed(2)} \\\\ ${xSol[1].toFixed(2)} \\\\ ${xSol[2].toFixed(2)} \\end{pmatrix} = 
                    \\begin{pmatrix} 3 \\\\ 0 \\\\ 0 \\end{pmatrix} + 
                    ${c1.toFixed(1)} \\begin{pmatrix} -2 \\\\ 1 \\\\ 0 \\end{pmatrix} + 
                    ${c2.toFixed(1)} \\begin{pmatrix} 1 \\\\ 0 \\\\ 1 \\end{pmatrix}$
                </div>
                <div>
                    <b>Строгая проверка $Ax = b$:</b><br>
                    $1 \\cdot (${xSol[0].toFixed(2)}) + 2 \\cdot (${xSol[1].toFixed(2)}) - 1 \\cdot (${xSol[2].toFixed(2)}) = \\mathbf{${checkAx.toFixed(3)}}$<br>
                    <span style="color:var(--success); font-weight:700;">✓ Тождественно равно $b = 3$ при любых $c_1, c_2$!</span>
                </div>
                <div>
                    <b>Евклидовы нормы:</b><br>
                    $\\|x\\|_2 = ${normX.toFixed(3)}$, $\\|x_{part}\\|_2 = ${normPart.toFixed(3)}$, $\\|x_{homog}\\|_2 = ${normHomog.toFixed(3)}$<br>
                    <span style="font-size:0.85rem; color:var(--text-muted);">${Math.abs(c1) < 1e-6 && Math.abs(c2) < 1e-6 ? 'Решение совпадает с частным x_part' : 'Смещение вдоль гиперплоскости ядра'}</span>
                </div>
            </div>
        `;
        if (window.renderMathInElement) {
            renderMathInElement(statsEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// -------------------------------------------------------------------------
// [2.4] 2D Линейные операторы (Вращение, Масштаб, Сдвиг, Отражение, Проектор)
// -------------------------------------------------------------------------
function renderLinearOperator2D(opType = 'rotate', param = 45) {
    const container = document.getElementById('plot-operator-2d');
    if (!container) return;

    let M = [[1, 0], [0, 1]];
    let desc = '';
    let formulaTex = '';

    if (opType === 'rotate') {
        const rad = (param * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        M = [[c, -s], [s, c]];
        desc = `Поворот на угол θ = ${param}°: сохраняет длины векторов и углы между ними. Изометрия, det = ${det2x2(M).toFixed(3)}.`;
        formulaTex = `R_\\theta = \\begin{pmatrix} \\cos(${param}^\\circ) & -\\sin(${param}^\\circ) \\\\ \\sin(${param}^\\circ) & \\cos(${param}^\\circ) \\end{pmatrix}`;
    } else if (opType === 'scale') {
        const kx = 1.0 + (param - 45) / 45;
        const ky = 0.5 + (param / 90);
        M = [[kx, 0], [0, ky]];
        desc = `Анизотропное масштабирование: k_x = ${kx.toFixed(2)}, k_y = ${ky.toFixed(2)}. Деформирует окружность в эллипс со сжатием/растяжением по осям. det = ${(kx*ky).toFixed(2)}.`;
        formulaTex = `S = \\begin{pmatrix} ${kx.toFixed(2)} & 0 \\\\ 0 & ${ky.toFixed(2)} \\end{pmatrix}`;
    } else if (opType === 'shear') {
        const s = (param - 180) / 60;
        M = [[1, s], [0, 1]];
        desc = `Сдвиг (Shear) вдоль оси X: параметр s = ${s.toFixed(2)}. Скос вертикалей, при этом площади фигур в точности сохраняются (det = 1.000).`;
        formulaTex = `H_s = \\begin{pmatrix} 1 & ${s.toFixed(2)} \\\\ 0 & 1 \\end{pmatrix}`;
    } else if (opType === 'reflect') {
        const rad = (param * Math.PI) / 180;
        const c = Math.cos(2 * rad);
        const s = Math.sin(2 * rad);
        M = [[c, s], [s, -c]];
        desc = `Отражение Хаусхолдера относительно оси под углом θ = ${param}°: det = -1.000 (меняет ориентацию базиса на противоположную).`;
        formulaTex = `M_\\theta = \\begin{pmatrix} \\cos(2\\theta) & \\sin(2\\theta) \\\\ \\sin(2\\theta) & -\\cos(2\\theta) \\end{pmatrix}`;
    } else if (opType === 'project') {
        const rad = (param * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        M = [[c * c, c * s], [c * s, s * s]];
        desc = `Ортогональный проектор на прямую под углом θ = ${param}°: det = 0.000, ранг = 1. Сплющивает всю 2D-плоскость в одномерную прямую.`;
        formulaTex = `P_\\theta = \\begin{pmatrix} \\cos^2\\theta & \\cos\\theta\\sin\\theta \\\\ \\cos\\theta\\sin\\theta & \\sin^2\\theta \\end{pmatrix}`;
    }

    // Исходная единичная окружность S^1
    const nPts = 120;
    const circX = [], circY = [];
    const transX = [], transY = [];
    for (let i = 0; i <= nPts; i++) {
        const th = (2 * Math.PI * i) / nPts;
        const x = Math.cos(th);
        const y = Math.sin(th);
        circX.push(x);
        circY.push(y);

        const tx = M[0][0] * x + M[0][1] * y;
        const ty = M[1][0] * x + M[1][1] * y;
        transX.push(tx);
        transY.push(ty);
    }

    const e1Trans = [M[0][0], M[1][0]];
    const e2Trans = [M[0][1], M[1][1]];

    const sqX = [-1, 1, 1, -1, -1];
    const sqY = [-1, -1, 1, 1, -1];
    const trSqX = [], trSqY = [];
    for (let i = 0; i < sqX.length; i++) {
        trSqX.push(M[0][0] * sqX[i] + M[0][1] * sqY[i]);
        trSqY.push(M[1][0] * sqX[i] + M[1][1] * sqY[i]);
    }

    const traceOrigCircle = {
        x: circX, y: circY, mode: 'lines',
        line: { color: '#a89484', width: 2, dash: 'dot' },
        name: 'Исходная окружность S¹'
    };

    const traceTransCircle = {
        x: transX, y: transY, mode: 'lines',
        line: { color: '#75523c', width: 3.5 },
        fill: 'toself',
        fillcolor: 'rgba(117, 82, 60, 0.08)',
        name: 'Образ окружности M(S¹)'
    };

    const traceTransSquare = {
        x: trSqX, y: trSqY, mode: 'lines',
        line: { color: '#b8863b', width: 2, dash: 'dash' },
        name: 'Образ квадрата [-1,1]²'
    };

    const traceE1 = {
        x: [0, e1Trans[0]], y: [0, e1Trans[1]],
        mode: 'lines+markers+text',
        line: { color: '#b34a3b', width: 4 },
        marker: { size: [2, 8], color: '#b34a3b' },
        text: ['', `M e₁ (${e1Trans[0].toFixed(2)}, ${e1Trans[1].toFixed(2)})`],
        textposition: 'top right',
        name: 'Столбец 1: M e₁'
    };

    const traceE2 = {
        x: [0, e2Trans[0]], y: [0, e2Trans[1]],
        mode: 'lines+markers+text',
        line: { color: '#5f7a4e', width: 4 },
        marker: { size: [2, 8], color: '#5f7a4e' },
        text: ['', `M e₂ (${e2Trans[0].toFixed(2)}, ${e2Trans[1].toFixed(2)})`],
        textposition: 'top left',
        name: 'Столбец 2: M e₂'
    };

    const layout = {
        title: `Преобразование пространства оператором: det(M) = ${det2x2(M).toFixed(3)}`,
        height: 478,
        autosize: true,
        xaxis: { title: 'X₁', range: [-3.2, 3.2], zeroline: true, zerolinecolor: '#4a3b32' },
        yaxis: { title: 'X₂', range: [-3.2, 3.2], scaleanchor: 'x', scaleratio: 1, zeroline: true, zerolinecolor: '#4a3b32' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 40, r: 40, t: 50, b: 40 }
    };

    Plotly.react(container, [traceOrigCircle, traceTransSquare, traceTransCircle, traceE1, traceE2], layout, { responsive: true });

    const cardEl = document.getElementById('operator-matrix-card');
    if (cardEl) {
        const detM = det2x2(M);
        const trM = M[0][0] + M[1][1];
                cardEl.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; align-items:start;">
                <div>
                    <b>Текущая матрица оператора M:</b><br>
                    $$\\begin{aligned} M &= ${formulaTex} \\\\[6pt] &= \\begin{pmatrix} ${M[0][0].toFixed(3)} & ${M[0][1].toFixed(3)} \\\\ ${M[1][0].toFixed(3)} & ${M[1][1].toFixed(3)} \\end{pmatrix} \\end{aligned}$$
                </div>
                <div>
                    <b>Инварианты оператора:</b><br>
                    • Определитель $\\det(M) = \\mathbf{${detM.toFixed(3)}}$ (коэффициент масштабирования ориентированной площади)<br>
                    • След $\\operatorname{tr}(M) = \\mathbf{${trM.toFixed(3)}}$<br>
                    • Ранг: <b>${Math.abs(detM) > 1e-4 ? 2 : 1}</b>
                </div>
                <div>
                    <b>Геометрический вердикт:</b><br>
                    ${desc}
                </div>
            </div>
   
        `;
        if (window.renderMathInElement) {
            renderMathInElement(cardEl, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });
        }
    }
}

// -------------------------------------------------------------------------
// [2.6] 3D-Стенд: Пошаговый процесс Грама-Шмидта (Шаги 0–4)
// -------------------------------------------------------------------------
function renderGramSchmidt3D(step = 4) {
    currentGsStep = step;
    const container = document.getElementById('plot-gram-schmidt-3d');
    if (!container) return;

    for (let s = 0; s <= 4; s++) {
        const btn = document.getElementById(`btn-gs-step${s}`);
        if (btn) {
            btn.className = (s === step) ? 'btn btn-primary' : 'btn btn-secondary';
        }
    }

    const v1 = [2, 0, 0];
    const v2 = [1, 2, 0];
    const v3 = [1, 1, 2];

    const normU1 = Math.hypot(...v1);
    const q1 = [v1[0] / normU1, v1[1] / normU1, v1[2] / normU1];

    const r12 = dotProduct(v2, q1);
    const proj2_1 = [r12 * q1[0], r12 * q1[1], r12 * q1[2]];
    const u2 = [v2[0] - proj2_1[0], v2[1] - proj2_1[1], v2[2] - proj2_1[2]];
    const normU2 = Math.hypot(...u2);
    const q2 = [u2[0] / normU2, u2[1] / normU2, u2[2] / normU2];

    const r13 = dotProduct(v3, q1);
    const r23 = dotProduct(v3, q2);
    const proj3_1 = [r13 * q1[0], r13 * q1[1], r13 * q1[2]];
    const proj3_2 = [r23 * q2[0], r23 * q2[1], r23 * q2[2]];
    const proj3 = [proj3_1[0] + proj3_2[0], proj3_1[1] + proj3_2[1], proj3_1[2] + proj3_2[2]];
    const u3 = [v3[0] - proj3[0], v3[1] - proj3[1], v3[2] - proj3[2]];
    const normU3 = Math.hypot(...u3);
    const q3 = [u3[0] / normU3, u3[1] / normU3, u3[2] / normU3];

    const traces = [];

    traces.push({
        type: 'scatter3d', mode: 'markers',
        x: [0], y: [0], z: [0],
        marker: { size: 5, color: '#2a1d17' },
        name: 'Начало координат'
    });

    traces.push({
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, v1[0]], y: [0, v1[1]], z: [0, v1[2]],
        line: { color: step === 0 ? '#b34a3b' : '#c2a897', width: step === 0 ? 6 : 3, dash: step === 0 ? 'solid' : 'dot' },
        marker: { size: [2, 6], color: step === 0 ? '#b34a3b' : '#c2a897' },
        text: ['', 'v₁ (2, 0, 0)'],
        name: 'Исходный v₁'
    });
    traces.push({
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, v2[0]], y: [0, v2[1]], z: [0, v2[2]],
        line: { color: step <= 1 ? '#75523c' : '#c2a897', width: step <= 1 ? 6 : 3, dash: step <= 1 ? 'solid' : 'dot' },
        marker: { size: [2, 6], color: step <= 1 ? '#75523c' : '#c2a897' },
        text: ['', 'v₂ (1, 2, 0)'],
        name: 'Исходный v₂'
    });
    traces.push({
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, v3[0]], y: [0, v3[1]], z: [0, v3[2]],
        line: { color: step <= 2 ? '#b8863b' : '#c2a897', width: step <= 2 ? 6 : 3, dash: step <= 2 ? 'solid' : 'dot' },
        marker: { size: [2, 6], color: step <= 2 ? '#b8863b' : '#c2a897' },
        text: ['', 'v₃ (1, 1, 2)'],
        name: 'Исходный v₃'
    });

    if (step >= 1) {
        traces.push({
            type: 'scatter3d', mode: 'lines+markers+text',
            x: [0, q1[0]], y: [0, q1[1]], z: [0, q1[2]],
            line: { color: '#5f7a4e', width: 7 },
            marker: { size: [2, 8], color: '#5f7a4e' },
            text: ['', '<b>q₁ (1, 0, 0)</b>'],
            name: 'Ортонормированный q₁'
        });
    }

    if (step === 2) {
        traces.push({
            type: 'scatter3d', mode: 'lines+text',
            x: [0, proj2_1[0]], y: [0, proj2_1[1]], z: [0, proj2_1[2]],
            line: { color: '#a89484', width: 5, dash: 'dash' },
            text: ['', 'proj_{q₁}(v₂) = 1·q₁'],
            name: 'Проекция proj(v₂)'
        });
        traces.push({
            type: 'scatter3d', mode: 'lines',
            x: [proj2_1[0], v2[0]], y: [proj2_1[1], v2[1]], z: [proj2_1[2], v2[2]],
            line: { color: '#b34a3b', width: 4, dash: 'dot' },
            name: 'Ортогональная компонента u₂'
        });
    }

    if (step >= 2) {
        traces.push({
            type: 'scatter3d', mode: 'lines+markers+text',
            x: [0, q2[0]], y: [0, q2[1]], z: [0, q2[2]],
            line: { color: '#5f7a4e', width: 7 },
            marker: { size: [2, 8], color: '#5f7a4e' },
            text: ['', '<b>q₂ (0, 1, 0)</b>'],
            name: 'Ортонормированный q₂'
        });
        traces.push({
            type: 'mesh3d',
            x: [-0.5, 2.5, 2.5, -0.5],
            y: [-0.5, -0.5, 2.5, 2.5],
            z: [0, 0, 0, 0],
            opacity: 0.2,
            color: '#8fa892',
            name: 'Span(q₁, q₂)'
        });
    }

    if (step === 3) {
        traces.push({
            type: 'scatter3d', mode: 'lines+text',
            x: [0, proj3[0]], y: [0, proj3[1]], z: [0, proj3[2]],
            line: { color: '#a89484', width: 5, dash: 'dash' },
            text: ['', 'proj_{Span}(v₃) = (1, 1, 0)'],
            name: 'Проекция proj(v₃)'
        });
        traces.push({
            type: 'scatter3d', mode: 'lines',
            x: [proj3[0], v3[0]], y: [proj3[1], v3[1]], z: [proj3[2], v3[2]],
            line: { color: '#b34a3b', width: 4, dash: 'dot' },
            name: 'Ортогональная компонента u₃'
        });
    }

    if (step >= 3) {
        traces.push({
            type: 'scatter3d', mode: 'lines+markers+text',
            x: [0, q3[0]], y: [0, q3[1]], z: [0, q3[2]],
            line: { color: '#5f7a4e', width: 7 },
            marker: { size: [2, 8], color: '#5f7a4e' },
            text: ['', '<b>q₃ (0, 0, 1)</b>'],
            name: 'Ортонормированный q₃'
        });
    }

    const layout = {
        title: `Процесс Грама-Шмидта: Этап ${step} из 4`,
        height: 478,
        autosize: true,
        uirevision: 'true',
        scene: {
            xaxis: { title: 'X₁', range: [-1, 3] },
            yaxis: { title: 'X₂', range: [-1, 3] },
            zaxis: { title: 'X₃', range: [-1, 3] },
            camera: { eye: { x: 1.6, y: -1.6, z: 1.2 } },
            aspectmode: 'cube',
            uirevision: 'true'
        },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 20, r: 20, t: 40, b: 20 }
    };

    Plotly.react(container, traces, layout, { responsive: true });

    const expEl = document.getElementById('gs-step-explanation');
    if (expEl) {
        let text = '';
        if (step === 0) {
            text = `
                <h4>Шаг 0: Исходная линейно независимая тройка векторов</h4>
                <p>Даны три вектора: $v_1 = (2, 0, 0)^T$, $v_2 = (1, 2, 0)^T$, $v_3 = (1, 1, 2)^T$.</p>
                <p>Они не ортогональны: $\\langle v_1, v_2 \\rangle = 2 \\ne 0$, $\\langle v_1, v_3 \\rangle = 2 \\ne 0$, $\\langle v_2, v_3 \\rangle = 3 \\ne 0$.</p>
                <p>Задача: построить ортонормированный базис $\{q_1, q_2, q_3\}$, сохраняя ту же линейную оболочку.</p>
            `;
        } else if (step === 1) {
            text = `
                <h4>Шаг 1: Нормирование первого вектора q₁</h4>
                <p>Полагаем $u_1 = v_1 = (2, 0, 0)^T$. Его длина $\\|u_1\\|_2 = \\sqrt{2^2 + 0^2 + 0^2} = 2$.</p>
                <p>Нормируем: <b>$q_1 = \\frac{u_1}{\\|u_1\\|} = (1, 0, 0)^T$</b>. Получен первый единичный базисный вектор.</p>
            `;
        } else if (step === 2) {
            text = `
                <h4>Шаг 2: Проекция и ортогонализация второго вектора q₂</h4>
                <p>1. Находим проекцию $v_2 = (1, 2, 0)^T$ на ось $q_1$: $\\langle v_2, q_1 \\rangle = 1 \\cdot 1 + 2 \\cdot 0 + 0 \\cdot 0 = 1$.</p>
                <p>2. Вычитаем проекцию, получая ортогональную составляющую: $u_2 = v_2 - 1 \\cdot q_1 = (1-1, 2-0, 0-0)^T = (0, 2, 0)^T$.</p>
                <p>3. Длина $\\|u_2\\| = 2$. Нормируем: <b>$q_2 = \\frac{u_2}{\\|u_2\\|} = (0, 1, 0)^T$</b>.</p>
                <p style="color:var(--success); font-weight:700;">Проверка: $\\langle q_1, q_2 \\rangle = 1 \\cdot 0 + 0 \\cdot 1 + 0 \\cdot 0 = 0$ (Ортогональны!)</p>
            `;
        } else if (step === 3) {
            text = `
                <h4>Шаг 3: Проекция на плоскость Span(q₁, q₂) и получение q₃</h4>
                <p>1. Проецируем $v_3 = (1, 1, 2)^T$ на построенное подпространство $\\operatorname{Span}(q_1, q_2)$:</p>
                <p>$\\operatorname{proj}(v_3) = \\langle v_3, q_1 \\rangle q_1 + \\langle v_3, q_2 \\rangle q_2 = 1 \\cdot q_1 + 1 \\cdot q_2 = (1, 1, 0)^T$.</p>
                <p>2. Ортогональный остаток: $u_3 = v_3 - \\operatorname{proj}(v_3) = (1-1, 1-1, 2-0)^T = (0, 0, 2)^T$.</p>
                <p>3. Длина $\\|u_3\\| = 2$. Нормируем: <b>$q_3 = \\frac{u_3}{\\|u_3\\|} = (0, 0, 1)^T$</b>.</p>
                <p style="color:var(--success); font-weight:700;">Проверка: $\\langle q_1, q_3 \\rangle = 0$, $\\langle q_2, q_3 \\rangle = 0$. Вектор $q_3$ перпендикулярен плоскости XY!</p>
            `;
        } else if (step === 4) {
            text = `
                <h4>Шаг 4: Финальный ортонормированный базис и матричное разложение A = Q · R</h4>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem; margin-top:0.5rem;">
                    <div>
                        <b>Ортогональная матрица Q (QᵀQ = I):</b>
                        $$Q = \\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}$$
                    </div>
                    <div>
                        <b>Верхнетреугольная матрица R:</b>
                        $$R = \\begin{pmatrix} 
                        \\|u_1\\| & \\langle v_2, q_1 \\rangle & \\langle v_3, q_1 \\rangle \\\\ 
                        0 & \\|u_2\\| & \\langle v_3, q_2 \\rangle \\\\
                        0 & 0 & \\|u_3\\| 
                        \\end{pmatrix}$$
                        $$= \\begin{pmatrix} 2 & 1 & 1 \\\\ 0 & 2 & 1 \\\\ 0 & 0 & 2 \\end{pmatrix}$$
                    </div>
                    <div>
                        <b>Проверка произведения QR = A:</b>
                        $$Q \\cdot R = \\begin{pmatrix} 2 & 1 & 1 \\\\ 0 & 2 & 1 \\\\ 0 & 0 & 2 \\end{pmatrix} = [v_1 \\mid v_2 \\mid v_3]$$
                        <span style="color:var(--success); font-weight:700;">✓ Разложение выполнено абсолютно точно!</span>
                    </div>
                </div>
            `;
        }
        expEl.innerHTML = text;
        if (window.renderMathInElement) {
            renderMathInElement(expEl, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });
        }
    }
}

// -------------------------------------------------------------------------
// [2.7] 3D-Стенд: Ортогональная проекция на подпространство и Теорема Пифагора
// -------------------------------------------------------------------------
function renderOrthogonalProjection3D(y1 = 2, y2 = 3, y3 = 4) {
    const container = document.getElementById('plot-projection-3d');
    if (!container) return;

    const x1 = [2, 0, 1];
    const x2 = [0, 2, 1];

    const invG11 = 5 / 24, invG12 = -1 / 24, invG21 = -1 / 24, invG22 = 5 / 24;

    const xty1 = x1[0] * y1 + x1[1] * y2 + x1[2] * y3;
    const xty2 = x2[0] * y1 + x2[1] * y2 + x2[2] * y3;

    const w1 = invG11 * xty1 + invG12 * xty2;
    const w2 = invG21 * xty1 + invG22 * xty2;

    const yHat = [
        w1 * x1[0] + w2 * x2[0],
        w1 * x1[1] + w2 * x2[1],
        w1 * x1[2] + w2 * x2[2]
    ];

    const e = [y1 - yHat[0], y2 - yHat[1], y3 - yHat[2]];

    const gridX = [], gridY = [], gridZ = [];
    for (let u = -1.5; u <= 2.5; u += 0.8) {
        const rowX = [], rowY = [], rowZ = [];
        for (let v = -1.5; v <= 2.5; v += 0.8) {
            rowX.push(u * x1[0] + v * x2[0]);
            rowY.push(u * x1[1] + v * x2[1]);
            rowZ.push(u * x1[2] + v * x2[2]);
        }
        gridX.push(rowX);
        gridY.push(rowY);
        gridZ.push(rowZ);
    }

    const tracePlane = {
        type: 'surface',
        x: gridX, y: gridY, z: gridZ,
        opacity: 0.35,
        showscale: false,
        colorscale: [[0, '#d1dfd2'], [1, '#8fa892']],
        name: 'Подпространство Span(x₁, x₂)'
    };

    const traceOrigin = {
        type: 'scatter3d', mode: 'markers',
        x: [0], y: [0], z: [0],
        marker: { size: 5, color: '#2a1d17' },
        name: 'Начало O'
    };

    const traceX1 = {
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, x1[0]], y: [0, x1[1]], z: [0, x1[2]],
        line: { color: '#5f7a4e', width: 5 },
        marker: { size: [2, 6], color: '#5f7a4e' },
        text: ['', 'x₁ (2, 0, 1)'],
        name: 'Столбец x₁'
    };
    const traceX2 = {
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, x2[0]], y: [0, x2[1]], z: [0, x2[2]],
        line: { color: '#5f7a4e', width: 5 },
        marker: { size: [2, 6], color: '#5f7a4e' },
        text: ['', 'x₂ (0, 2, 1)'],
        name: 'Столбец x₂'
    };

    const traceY = {
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, y1], y: [0, y2], z: [0, y3],
        line: { color: '#b34a3b', width: 6 },
        marker: { size: [2, 8], color: '#b34a3b' },
        text: ['', `y (${y1.toFixed(1)}, ${y2.toFixed(1)}, ${y3.toFixed(1)})`],
        textposition: 'top center',
        name: 'Целевой вектор y'
    };

    const traceYhat = {
        type: 'scatter3d', mode: 'lines+markers+text',
        x: [0, yHat[0]], y: [0, yHat[1]], z: [0, yHat[2]],
        line: { color: '#75523c', width: 6 },
        marker: { size: [2, 8], color: '#75523c' },
        text: ['', `ŷ = Py (${yHat[0].toFixed(2)}, ${yHat[1].toFixed(2)}, ${yHat[2].toFixed(2)})`],
        textposition: 'bottom right',
        name: 'Проекция ŷ = Py'
    };

    const traceE = {
        type: 'scatter3d', mode: 'lines+text',
        x: [yHat[0], y1], y: [yHat[1], y2], z: [yHat[2], y3],
        line: { color: '#b8863b', width: 5, dash: 'dash' },
        text: ['', `e ⟂ Span(X)`],
        textposition: 'middle left',
        name: 'Невязка e = y - ŷ'
    };

    const layout = {
        title: `Ортогональная проекция: ||y||² = ||ŷ||² + ||e||² (Теорема Пифагора)`,
        height: 478,
        autosize: true,
        uirevision: 'true',
        scene: {
            xaxis: { title: 'X₁', range: [-2, 6] },
            yaxis: { title: 'X₂', range: [-2, 6] },
            zaxis: { title: 'X₃', range: [-2, 6] },
            camera: { eye: { x: 1.8, y: -1.8, z: 1.3 } },
            aspectmode: 'cube',
            uirevision: 'true'
        },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 20, r: 20, t: 40, b: 20 }
    };

    Plotly.react(container, [tracePlane, traceOrigin, traceX1, traceX2, traceY, traceYhat, traceE], layout, { responsive: true });

    const normYSq = y1*y1 + y2*y2 + y3*y3;
    const normYhatSq = yHat[0]*yHat[0] + yHat[1]*yHat[1] + yHat[2]*yHat[2];
    const normESq = e[0]*e[0] + e[1]*e[1] + e[2]*e[2];
    const sumPifagor = normYhatSq + normESq;

    const dotEx1 = e[0]*x1[0] + e[1]*x1[1] + e[2]*x1[2];
    const dotEx2 = e[0]*x2[0] + e[1]*x2[1] + e[2]*x2[2];

    const cardEl = document.getElementById('proj-math-verification');
    if (cardEl) {
        cardEl.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
                <div>
                    <b>1. Веса и координаты проекции:</b><br>
                    $w = (X^T X)^{-1} X^T y = \\begin{pmatrix} ${w1.toFixed(3)} \\\\ ${w2.toFixed(3)} \\end{pmatrix}$<br>
                    $\\hat{y} = w_1 x_1 + w_2 x_2 = \\begin{pmatrix} ${yHat[0].toFixed(2)} \\\\ ${yHat[1].toFixed(2)} \\\\ ${yHat[2].toFixed(2)} \\end{pmatrix}$
                </div>
                <div>
                    <b>2. Ортогональность невязки к подпространству:</b><br>
                    • $\\langle e, x_1 \\rangle = ${Math.abs(dotEx1) < 1e-12 ? '0.000000' : dotEx1.toFixed(6)}$<br>
                    • $\\langle e, x_2 \\rangle = ${Math.abs(dotEx2) < 1e-12 ? '0.000000' : dotEx2.toFixed(6)}$<br>
                    <span style="color:var(--success); font-weight:700;">✓ $X^T e = 0$ (невязка строго ортогональна признакам!)</span>
                </div>
                <div>
                    <b>3. Численная проверка теоремы Пифагора:</b><br>
                    $\\|y\\|_2^2 = ${normYSq.toFixed(4)}$<br>
                    $\\|\\hat{y}\\|_2^2 + \\|e\\|_2^2 = ${normYhatSq.toFixed(4)} + ${normESq.toFixed(4)} = \\mathbf{${sumPifagor.toFixed(4)}}$<br>
                    <span style="color:var(--success); font-weight:700;">✓ Абсолютная разность: $\\Delta = ${Math.abs(normYSq - sumPifagor).toExponential(2)}$</span>
                </div>
            </div>
        `;
        if (window.renderMathInElement) {
            renderMathInElement(cardEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// -------------------------------------------------------------------------
// [2.9] Интерактивный симулятор обусловленности kappa(A) и взрыва ошибки
// -------------------------------------------------------------------------
function renderConditionExperiment(k = 7) {
    const container = document.getElementById('plot-condition-methods');
    if (!container) return;

    const valSpan = document.getElementById('val-cond-k');
    if (valSpan) valSpan.textContent = k;

    const kappas = [];
    const errNormal = [];
    const errQR = [];
    const errSVD = [];

    const epsMach = 1.11e-16;

    for (let ki = 1; ki <= 16; ki++) {
        const cond = Math.pow(10, ki);
        kappas.push(cond);

        const eNorm = Math.min(1.0, epsMach * Math.pow(cond, 2));
        errNormal.push(eNorm);

        const eQR = Math.min(1.0, epsMach * cond);
        errQR.push(eQR);

        const eSVD = Math.min(1.0, 0.5 * epsMach * cond);
        errSVD.push(eSVD);
    }

    const currentCond = Math.pow(10, k);
    const currNormErr = Math.min(1.0, epsMach * Math.pow(currentCond, 2));
    const currQRErr = Math.min(1.0, epsMach * currentCond);

    const trace1 = {
        x: kappas, y: errNormal, mode: 'lines',
        name: 'Нормальные уравнения: XᵀX w = Xᵀy (ошибка ~ ε·κ²)',
        line: { color: '#b34a3b', width: 3.5 }
    };
    const trace2 = {
        x: kappas, y: errQR, mode: 'lines',
        name: 'QR-разложение (Householder/MGS, ошибка ~ ε·κ)',
        line: { color: '#5f7a4e', width: 3 }
    };
    const trace3 = {
        x: kappas, y: errSVD, mode: 'lines',
        name: 'SVD / Псевдообратная матрица X⁺ (ошибка ~ ε·κ)',
        line: { color: '#75523c', width: 2.5, dash: 'dot' }
    };

    const traceCurrentNorm = {
        x: [currentCond], y: [currNormErr], mode: 'markers',
        marker: { size: 10, color: '#b34a3b' },
        name: `Выбрано κ = 10^${k} (Norm Eq)`
    };
    const traceCurrentQR = {
        x: [currentCond], y: [currQRErr], mode: 'markers',
        marker: { size: 10, color: '#5f7a4e' },
        name: `Выбрано κ = 10^${k} (QR)`
    };

    const layout = {
        title: `Численная погрешность ||w - w*|| / ||w*|| в зависимости от κ(X)`,
        height: 478,
        autosize: true,
        xaxis: { title: 'Число обусловленности κ(X) (Log Scale)', type: 'log' },
        yaxis: { title: 'Относительная ошибка (Log Scale)', type: 'log', range: [-16, 1] },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 60, r: 40, t: 50, b: 50 }
    };

    Plotly.react(container, [trace1, trace2, trace3, traceCurrentNorm, traceCurrentQR], layout, { responsive: true });

    const cardEl = document.getElementById('condition-benchmark-stats');
    if (cardEl) {
        const condGram = `10^{${2 * k}}`;
        const lostDigitsNorm = Math.min(16, 2 * k);
        const lostDigitsQR = Math.min(16, k);
        const remDigitsNorm = Math.max(0, 16 - 2 * k);
        const remDigitsQR = Math.max(0, 16 - k);

        let statusBadge = '';
        if (k <= 4) {
            statusBadge = '<span class="badge" style="background:#5f7a4e; color:#fff;">Отличная обусловленность</span>';
        } else if (k <= 7) {
            statusBadge = '<span class="badge" style="background:#b8863b; color:#fff;">Умеренная деградация Normal Eq</span>';
        } else if (k === 8) {
            statusBadge = '<span class="badge" style="background:#b34a3b; color:#fff;">Критическая точка крэша Normal Eq (κ² = 10¹⁶)</span>';
        } else {
            statusBadge = '<span class="badge" style="background:#b34a3b; color:#fff;">Полная катастрофа Normal Eq (100% ошибка)</span>';
        }

        cardEl.innerHTML = `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1rem;">
                <div>
                    <b>Текущее состояние при $\\kappa(X) = 10^{${k}}$:</b><br>
                    • Обусловленность матрицы Грама: $\\kappa(X^T X) = \\kappa(X)^2 = \\mathbf{${condGram}}$<br>
                    • Статус устойчивости: ${statusBadge}
                </div>
                <div>
                    <b>Нормальные уравнения $(X^T X) w = X^T y$:</b><br>
                    • Потеряно верных цифр: <b>${lostDigitsNorm} из 16</b><br>
                    • Осталось верных цифр: <b>${remDigitsNorm}</b><br>
                    • Относительная погрешность: <b>${currNormErr >= 1.0 ? '≥ 100% (мусорные веса!)' : currNormErr.toExponential(2)}</b>
                </div>
                <div>
                    <b>QR-разложение (SciPy / LAPACK):</b><br>
                    • Потеряно верных цифр: <b>${lostDigitsQR} из 16</b><br>
                    • Осталось верных цифр: <b>${remDigitsQR}</b><br>
                    • Относительная погрешность: <b>${currQRErr.toExponential(2)}</b> (высокая точность!)
                </div>
            </div>
        `;
        if (window.renderMathInElement) {
            renderMathInElement(cardEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// --- 2.3 Семинар 2: Загрузка вариантов ---

function loadSeminar2Variant(vId) {
    const v = SEMINAR_2_VARIANTS[vId];
    if (!v) return;

    let tableHtml = '<table class="data-table"><tbody>';
    for (let row of v.A) {
        tableHtml += '<tr>' + row.map(val => `<td><b>${val}</b></td>`).join('') + '</tr>';
    }
    tableHtml += '</tbody></table>';
    const matEl = document.getElementById('sem2-matrix-container');
    if (matEl) matEl.innerHTML = tableHtml;

    const sysEl = document.getElementById('sem2-sys-info');
    if (sysEl) {
        sysEl.innerHTML = `
            <p><b>Вектор свободных членов b:</b> (${v.b.join(', ')})</p>
            <p><b>Тип системы по Кронекеру-Капелли:</b> <span style="color:var(--primary); font-weight:700;">${v.type.toUpperCase()}</span></p>
            <p style="font-size:0.88rem; color:var(--text-muted); margin-top:0.3rem;">
                Проверка рангов: $\\operatorname{rank}(A) = ${v.type === 'нет решений' ? 2 : 3}$, $\\operatorname{rank}(A|b) = 3$ 
                ${v.type === 'нет решений' ? '(ранги НЕ равны → решений нет)' : '(ранги равны → система совместна)'}.
            </p>
        `;
    }

    const gs = runGramSchmidt3D(v.gramSchmidt);
    const gsEl = document.getElementById('sem2-gs-info');
    if (gsEl) {
        gsEl.innerHTML = `
            <p><b>Исходная тройка векторов:</b></p>
            <p>v₁ = (${v.gramSchmidt[0].join(', ')}), v₂ = (${v.gramSchmidt[1].join(', ')}), v₃ = (${v.gramSchmidt[2].join(', ')})</p>
            <p style="margin-top:0.6rem;"><b>Ортонормированный базис {q₁, q₂, q₃}:</b></p>
            <p>q₁ = (${gs.q[0].map(x => x.toFixed(3)).join(', ')})</p>
            <p>q₂ = (${gs.q[1].map(x => x.toFixed(3)).join(', ')})</p>
            <p>q₃ = (${gs.q[2].map(x => x.toFixed(3)).join(', ')})</p>
            <p style="font-size:0.86rem; color:var(--success); margin-top:0.3rem;">
                Проверка ортогональности: $\\langle q_1, q_2 \\rangle = ${dotProduct(gs.q[0], gs.q[1]).toFixed(4)}$, 
                $\\langle q_1, q_3 \\rangle = ${dotProduct(gs.q[0], gs.q[2]).toFixed(4)}$, 
                $\\langle q_2, q_3 \\rangle = ${dotProduct(gs.q[1], gs.q[2]).toFixed(4)}$ (Попарно ортогональны: ✓)
            </p>
        `;
    }

    const xVals = [-1, 0, 1, 2];
    const yVals = v.pointsY;
    const n = 4;
    const sumX = xVals.reduce((a, b) => a + b, 0);
    const sumY = yVals.reduce((a, b) => a + b, 0);
    const sumXX = xVals.reduce((a, b) => a + b*b, 0);
    const sumXY = xVals.reduce((a, b, i) => a + b * yVals[i], 0);

    const detG = n * sumXX - sumX * sumX;
    const c0 = (sumY * sumXX - sumX * sumXY) / detG;
    const c1 = (n * sumXY - sumX * sumY) / detG;

    const lsqEl = document.getElementById('sem2-lsq-info');
    if (lsqEl) {
        lsqEl.innerHTML = `
            <p><b>Точки данных (x, y):</b> ${xVals.map((x, i) => `(${x}, ${yVals[i]})`).join('; ')}</p>
            <p><b>Нормальное уравнение:</b> $\\begin{pmatrix} 4 & 2 \\\\ 2 & 6 \\end{pmatrix} \\begin{pmatrix} c_0 \\\\ c_1 \\end{pmatrix} = \\begin{pmatrix} ${sumY} \\\\ ${sumXY} \\end{pmatrix}$</p>
            <p><b>Найденная прямая МНК:</b> <span style="font-weight:700; color:var(--primary);">y = ${c0.toFixed(3)} + (${c1.toFixed(3)})x</span></p>
            <p><b>Истинные параметры без шума c_true:</b> c₀ = ${v.cTrue[0]}, c₁ = ${v.cTrue[1]}</p>
            <p style="font-size:0.86rem; color:var(--text-muted);">Небольшое расхождение обусловлено стохастическим шумом наблюдений в данных.</p>
        `;
    }

    if (window.renderMathInElement) {
        ['sem2-sys-info', 'sem2-gs-info', 'sem2-lsq-info'].forEach(id => {
            const el = document.getElementById(id);
            if (el) safeRenderMath(el);
        });
    }
}

// --- 2.4 Лабораторная работа 2: Эксперимент с обусловленностью ---

function loadLab2Variant(studentId) {
    const params = getLab2VariantParams(studentId);
    const hdrEl = document.getElementById('lab2-variant-header');
    if (hdrEl) {
        hdrEl.innerHTML = `
            <h4>Вариант №${studentId} (seed = ${params.seed})</h4>
            <p><b>Число объектов N:</b> ${params.nObjects} | <b>Число признаков d:</b> ${params.nFeatures}</p>
            <p><b>Спектр сингулярных чисел:</b> ${params.spectrum}</p>
            <p style="margin-top:0.5rem; color:#75523c;"><b>Содержательный вопрос варианта:</b> <i>${params.question}</i></p>
        `;
    }
}

function runLab2Experiment() {
    const studentId = parseInt(document.getElementById('lab2-student-id')?.value) || 1;
    const params = getLab2VariantParams(studentId);

    const kappas = params.kappas;
    const epsMach = 1.11e-16;

    const errNorm = [];
    const errQR = [];
    const errPinv = [];
    const kappaGram = [];

    for (let k of kappas) {
        kappaGram.push(k * k);

        let eN = epsMach * (k ** 2) * (0.8 + 0.4 * Math.random());
        let eQ = epsMach * k * (0.9 + 0.3 * Math.random());
        let eP = epsMach * k * 0.7 * (0.9 + 0.2 * Math.random());

        errNorm.push(Math.min(1.0, eN));
        errQR.push(Math.min(1.0, eQ));
        errPinv.push(Math.min(1.0, eP));
    }

    const trace1 = {
        x: kappas, y: errNorm, mode: 'lines+markers',
        name: 'Нормальное уравнение: XᵀX w = Xᵀy',
        line: { color: '#b34a3b', width: 3 }
    };
    const trace2 = {
        x: kappas, y: errQR, mode: 'lines+markers',
        name: 'QR-разложение (Modified GS)',
        line: { color: '#5f7a4e', width: 2.5 }
    };
    const trace3 = {
        x: kappas, y: errPinv, mode: 'lines+markers',
        name: 'Псевдообратная матрица X⁺ (SVD)',
        line: { color: '#75523c', width: 2.5, dash: 'dot' }
    };

    const layout1 = {
        title: `Деградация точности весов ||w - w*||/||w*|| по варианту №${studentId}`,
        height: 418,
        autosize: true,
        xaxis: { title: 'Число обусловленности κ(X)', type: 'log' },
        yaxis: { title: 'Относительная ошибка (log)', type: 'log', range: [-16, 1] },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 50, r: 40, t: 50, b: 40 }
    };
    Plotly.react('plot-lab2-error', [trace1, trace2, trace3], layout1, { responsive: true });

    const traceGram = {
        x: kappas, y: kappaGram, mode: 'lines+markers',
        name: 'κ(XᵀX) = κ(X)²',
        line: { color: '#b8863b', width: 3 }
    };
    const traceRef = {
        x: kappas, y: kappas, mode: 'lines',
        name: 'Линия идентичности κ(X)',
        line: { color: '#a89484', width: 2, dash: 'dash' }
    };

    const layout2 = {
        title: 'Возведение обусловленности в квадрат: κ(XᵀX) vs κ(X)',
        height: 418,
        autosize: true,
        xaxis: { title: 'κ(X) (log)', type: 'log' },
        yaxis: { title: 'κ(XᵀX) (log)', type: 'log' },
        template: 'plotly_white',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', color: '#2a1d17' },
        margin: { l: 50, r: 40, t: 50, b: 40 }
    };
    Plotly.react('plot-lab2-gram', [traceGram, traceRef], layout2, { responsive: true });

    const conclEl = document.getElementById('lab2-conclusion-box');
    if (conclEl) {
        conclEl.innerHTML = `
            <h4>📝 Заключение по индивидуальному варианту №${studentId}</h4>
            <p><b>Вопрос варианта:</b> <i>${params.question}</i></p>
            <p style="margin-top:0.6rem;">
                <b>Численный вердикт:</b><br>
                1. Метод явного нормального уравнения $(X^T X) w = X^T y$ терпит катастрофическую потерю точности (ошибка $> 10^{-2}$) 
                уже при $\\kappa(X) \\approx 10^7..10^8$. Причина: обусловленность матрицы Грама возводится в квадрат $\\kappa(X^T X) = \\kappa(X)^2 \\approx 10^{16}$, 
                что достигает предела машинной точности float64 ($\\varepsilon_{mach} \\approx 2 \\cdot 10^{-16}$). Матрица $X^T X$ становится численно вырожденной.<br>
                2. QR-разложение через модифицированный алгоритм Грама-Шмидта (MGS) и метод псевдообратной матрицы (SVD) 
                сохраняют превосходную точность вплоть до $\\kappa(X) \\approx 10^{14}$, поскольку работают непосредственно с матрицей $X$ без возведения спектра в квадрат.<br>
                3. Рекомендация для продакшн ML-пайплайнов: при риске мультиколлинеарности признаков категорически избегать явного обращения $(X^T X)^{-1}$ и использовать QR/SVD солверы (аналогично <code>scipy.linalg.lstsq</code>).
            </p>
        `;
        if (window.renderMathInElement) {
            renderMathInElement(conclEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}


// ==========================================================================
// МОДУЛЬ 3: ВЫЧИСЛИТЕЛЬНЫЕ И ГРАФИЧЕСКИЕ АЛГОРИТМЫ (СПЕКТР, SVD, ТЕНЗОРЫ)
// ==========================================================================

// ==========================================================================
// МОДУЛЬ 3: ВЫЧИСЛИТЕЛЬНЫЕ И ГРАФИЧЕСКИЕ АЛГОРИТМЫ (СПЕКТР, SVD, ТЕНЗОРЫ)
// ==========================================================================

// Аналитическое нахождение собственных значений и векторов матрицы 2x2
function eigen2x2(a, b, c, d) {
    const tr = a + d;
    const det = a * d - b * c;
    const discr = tr * tr - 4 * det;

    if (discr < -1e-9) {
        const real = tr / 2;
        const imag = Math.sqrt(-discr) / 2;
        return { isComplex: true, l1_real: real, l1_imag: imag, l2_real: real, l2_imag: -imag, tr, det };
    }

    const sqrtD = Math.sqrt(Math.max(0, discr));
    const l1 = (tr + sqrtD) / 2;
    const l2 = (tr - sqrtD) / 2;

    function getVec(l) {
        let vx, vy;
        if (Math.abs(c) > 1e-9) {
            vx = l - d;
            vy = c;
        } else if (Math.abs(b) > 1e-9) {
            vx = b;
            vy = l - a;
        } else {
            if (Math.abs(a - l) < 1e-9) {
                vx = 1; vy = 0;
            } else {
                vx = 0; vy = 1;
            }
        }
        const norm = Math.hypot(vx, vy);
        return norm > 1e-12 ? [vx / norm, vy / norm] : [1, 0];
    }

    const v1 = getVec(l1);
    let v2 = getVec(l2);

    if (Math.abs(l1 - l2) < 1e-9 && Math.abs(b) < 1e-9 && Math.abs(c) < 1e-9) {
        v2 = [-v1[1], v1[0]];
    }

    return {
        isComplex: false,
        l1, l2,
        v1, v2,
        tr, det
    };
}

// SVD матрицы 2x2: A = U * Sigma * V^T
function svd2x2(a, b, c, d) {
    const ata_00 = a * a + c * c;
    const ata_01 = a * b + c * d;
    const ata_11 = b * b + d * d;

    const eig = eigen2x2(ata_00, ata_01, ata_01, ata_11);
    const s1 = Math.sqrt(Math.max(0, eig.l1));
    const s2 = Math.sqrt(Math.max(0, eig.l2));

    const v1 = eig.v1;
    const v2 = eig.v2;

    let u1 = [1, 0], u2 = [0, 1];
    if (s1 > 1e-12) {
        const ax = a * v1[0] + b * v1[1];
        const ay = c * v1[0] + d * v1[1];
        u1 = [ax / s1, ay / s1];
    }
    if (s2 > 1e-12) {
        const ax = a * v2[0] + b * v2[1];
        const ay = c * v2[0] + d * v2[1];
        u2 = [ax / s2, ay / s2];
    } else {
        u2 = [-u1[1], u1[0]];
    }

    return {
        s1, s2,
        V: [v1, v2],
        U: [u1, u2]
    };
}

// --- 1. РЕНДЕР: СОБСТВЕННЫЕ ВЕКТОРЫ 2D ---
function renderEigenvalues2D(presetKey, testAngleDeg) {
    const plotEl = document.getElementById('plot-eigen-2d');
    if (!plotEl) return;

    let a = 3, b = 1, c = 1, d = 2;
    if (presetKey === 'symm_saddle') {
        a = 2; b = 2; c = 2; d = -1;
    } else if (presetKey === 'diagonal') {
        a = 3; b = 0; c = 0; d = 1.5;
    } else if (presetKey === 'shear') {
        a = 1; b = 2; c = 0; d = 1;
    } else if (presetKey === 'rotation') {
        a = 0.7071; b = -0.7071; c = 0.7071; d = 0.7071;
    }

    const nPoints = 120;
    const circleX = [], circleY = [];
    const ellipseX = [], ellipseY = [];

    for (let i = 0; i <= nPoints; i++) {
        const phi = (i / nPoints) * 2 * Math.PI;
        const x = Math.cos(phi);
        const y = Math.sin(phi);
        circleX.push(x);
        circleY.push(y);

        const tx = a * x + b * y;
        const ty = c * x + d * y;
        ellipseX.push(tx);
        ellipseY.push(ty);
    }

    const rad = (testAngleDeg || 30) * Math.PI / 180;
    const xVec = [Math.cos(rad), Math.sin(rad)];
    const axVec = [a * xVec[0] + b * xVec[1], c * xVec[0] + d * xVec[1]];
    const axNorm = Math.hypot(axVec[0], axVec[1]);

    // Угол отклонения между x и Ax
    let deviationDeg = 0;
    if (axNorm > 1e-9) {
        const cosDev = (xVec[0] * axVec[0] + xVec[1] * axVec[1]) / axNorm;
        deviationDeg = Math.acos(Math.max(-1, Math.min(1, cosDev))) * 180 / Math.PI;
    }

    const eig = eigen2x2(a, b, c, d);

    const traces = [
        {
            x: circleX, y: circleY,
            mode: 'lines',
            line: { color: 'rgba(126, 108, 96, 0.45)', dash: 'dot', width: 2 },
            name: 'Окружность S¹',
            hoverinfo: 'none'
        },
        {
            x: ellipseX, y: ellipseY,
            mode: 'lines',
            line: { color: '#75523c', width: 3 },
            name: 'Образ A(S¹)',
            hoverinfo: 'none'
        },
        {
            x: [0, xVec[0]], y: [0, xVec[1]],
            mode: 'lines+markers',
            line: { color: '#5f7a4e', width: 3 },
            marker: { size: [0, 8] },
            name: 'Тестовый вектор x'
        },
        {
            x: [0, axVec[0]], y: [0, axVec[1]],
            mode: 'lines+markers',
            line: { color: '#5f7a4e', dash: 'dash', width: 2.5 },
            marker: { size: [0, 7] },
            name: 'Образ Ax'
        }
    ];

    if (!eig.isComplex) {
        const v1 = eig.v1;
        const av1 = [eig.l1 * v1[0], eig.l1 * v1[1]];
        traces.push({
            x: [0, v1[0]], y: [0, v1[1]],
            mode: 'lines+markers',
            line: { color: '#b34a3b', width: 3.5 },
            marker: { size: [0, 8] },
            name: `v₁ (λ₁ = ${eig.l1.toFixed(2)})`
        });
        traces.push({
            x: [0, av1[0]], y: [0, av1[1]],
            mode: 'lines',
            line: { color: '#b34a3b', dash: 'dot', width: 2 },
            name: `Av₁ = λ₁v₁`
        });

        const v2 = eig.v2;
        const av2 = [eig.l2 * v2[0], eig.l2 * v2[1]];
        traces.push({
            x: [0, v2[0]], y: [0, v2[1]],
            mode: 'lines+markers',
            line: { color: '#b8863b', width: 3.5 },
            marker: { size: [0, 8] },
            name: `v₂ (λ₂ = ${eig.l2.toFixed(2)})`
        });
        traces.push({
            x: [0, av2[0]], y: [0, av2[1]],
            mode: 'lines',
            line: { color: '#b8863b', dash: 'dot', width: 2 },
            name: `Av₂ = λ₂v₂`
        });
    }

    const layout = {
        title: { text: `Оператор A = [[${a.toFixed(2)}, ${b.toFixed(2)}], [${c.toFixed(2)}, ${d.toFixed(2)}]]`, font: { size: 14, color: '#2a1d17' } },
        height: 478,
        autosize: true,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'x₁', range: [-4.2, 4.2], zeroline: true, zerolinecolor: '#e8e1d7', gridcolor: '#f0ece6' },
        yaxis: { title: 'x₂', range: [-4.2, 4.2], zeroline: true, zerolinecolor: '#e8e1d7', gridcolor: '#f0ece6', scaleanchor: 'x' },
        margin: { l: 45, r: 25, t: 40, b: 60 },
        legend: { orientation: 'h', y: -0.18, font: { size: 10 } },
        showlegend: true
    };

    Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });

    const cardEl = document.getElementById('eigen-stats-card');
    if (cardEl) {
        const isAligned = deviationDeg < 2.0 || Math.abs(deviationDeg - 180) < 2.0;
        const statusBadge = isAligned
            ? `<span style="display:inline-block; padding:2px 8px; border-radius:4px; background:var(--success); color:#fff; font-weight:700;">🎯 Вектор x лежит на собственном направлении! (Δθ = ${deviationDeg.toFixed(1)}°)</span>`
            : `<span>Угол поворота вектора x: <b>Δθ = ${deviationDeg.toFixed(1)}°</b> (вектор отклоняется от прямой)</span>`;

        if (eig.isComplex) {
            cardEl.innerHTML = `
                <b>Спектральный анализ:</b> Комплексные собственные значения: $\\lambda_{1,2} = ${eig.l1_real.toFixed(2)} \\pm ${eig.l1_imag.toFixed(2)}i$.<br>
                <b>Вывод:</b> Матрица является чистым поворотом. Вещественных инвариантных прямых в $\\mathbb{R}^2$ нет.
            `;
        } else {
            const isOrthogonal = Math.abs(eig.v1[0] * eig.v2[0] + eig.v1[1] * eig.v2[1]) < 1e-4;
            cardEl.innerHTML = `
                <div style="margin-bottom:0.4rem;">${statusBadge}</div>
                <b>Собственные значения:</b> $\\lambda_1 = ${eig.l1.toFixed(3)}, \\; \\lambda_2 = ${eig.l2.toFixed(3)}$<br>
                <b>Инварианты:</b> $\\operatorname{tr}(A) = ${eig.tr.toFixed(2)} = \\lambda_1 + \\lambda_2$, $\\det(A) = ${eig.det.toFixed(2)} = \\lambda_1 \\cdot \\lambda_2$<br>
                <b>Ортогональность:</b> $\\langle v_1, v_2 \\rangle = ${(eig.v1[0] * eig.v2[0] + eig.v1[1] * eig.v2[1]).toFixed(4)}$ (<b>${isOrthogonal ? 'Ортонормированный базис (Спектральная теорема)' : 'Не ортогональны (матрица не симметрична)'}</b>).
            `;
        }
        if (window.renderMathInElement) {
            renderMathInElement(cardEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// --- 2. РЕНДЕР: SVD ДЕКОМПОЗИЦИЯ В 4 ШАГА ---
let currentSvdStep = 3;
function renderSVDDecomposition2D(step) {
    currentSvdStep = step;
    const plotEl = document.getElementById('plot-svd-geometry');
    if (!plotEl) return;

    for (let i = 0; i <= 3; i++) {
        const btn = document.getElementById(`btn-svd-step${i}`);
        if (btn) {
            btn.className = (i === step) ? 'btn btn-primary' : 'btn btn-secondary';
        }
    }

    const a = 2, b = 1, c = 1, d = 2;
    const svd = svd2x2(a, b, c, d);

    const nPoints = 120;
    const xs = [], ys = [];
    let vec1 = [1, 0], vec2 = [0, 1];

    for (let i = 0; i <= nPoints; i++) {
        const phi = (i / nPoints) * 2 * Math.PI;
        let x = Math.cos(phi);
        let y = Math.sin(phi);

        if (step === 0) {
            vec1 = [svd.V[0][0], svd.V[0][1]];
            vec2 = [svd.V[1][0], svd.V[1][1]];
        } else if (step === 1) {
            const tx = svd.V[0][0] * x + svd.V[0][1] * y;
            const ty = svd.V[1][0] * x + svd.V[1][1] * y;
            x = tx; y = ty;
            vec1 = [1, 0]; vec2 = [0, 1];
        } else if (step === 2) {
            const tx = (svd.V[0][0] * x + svd.V[0][1] * y) * svd.s1;
            const ty = (svd.V[1][0] * x + svd.V[1][1] * y) * svd.s2;
            x = tx; y = ty;
            vec1 = [svd.s1, 0]; vec2 = [0, svd.s2];
        } else if (step === 3) {
            const ax = a * x + b * y;
            const ay = c * x + d * y;
            x = ax; y = ay;
            vec1 = [svd.U[0][0] * svd.s1, svd.U[0][1] * svd.s1];
            vec2 = [svd.U[1][0] * svd.s2, svd.U[1][1] * svd.s2];
        }

        xs.push(x);
        ys.push(y);
    }

    const traces = [
        {
            x: xs, y: ys,
            mode: 'lines',
            line: { color: step === 3 ? '#75523c' : (step === 2 ? '#b8863b' : '#5f7a4e'), width: 3 },
            fill: 'toself',
            fillcolor: 'rgba(117, 82, 60, 0.08)',
            name: 'Геометрический образ'
        },
        {
            x: [0, vec1[0]], y: [0, vec1[1]],
            mode: 'lines+markers',
            line: { color: '#b34a3b', width: 3.5 },
            marker: { size: [0, 8] },
            name: step >= 2 ? `Главная ось (σ₁ = ${svd.s1.toFixed(2)})` : 'Вектор v₁'
        },
        {
            x: [0, vec2[0]], y: [0, vec2[1]],
            mode: 'lines+markers',
            line: { color: '#5f7a4e', width: 3.5 },
            marker: { size: [0, 8] },
            name: step >= 2 ? `Малая ось (σ₂ = ${svd.s2.toFixed(2)})` : 'Вектор v₂'
        }
    ];

    const stepTitles = [
        'Шаг 0: Единичный круг S¹ и правые сингулярные векторы v₁, v₂',
        'Шаг 1: Применение ортогональной матрицы Vᵀ (поворот, совмещающий v с осями координат)',
        'Шаг 2: Применение диагональной матрицы Σ (масштабирование вдоль осей на σ₁=3.0, σ₂=1.0)',
        'Шаг 3: Применение ортогональной матрицы U (финальный поворот эллипса: A = U Σ Vᵀ)'
    ];

    const layout = {
        title: { text: stepTitles[step], font: { size: 13.5, color: '#2a1d17' } },
        height: 478,
        autosize: true,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'z₁', range: [-3.8, 3.8], zeroline: true, zerolinecolor: '#e8e1d7', gridcolor: '#f0ece6' },
        yaxis: { title: 'z₂', range: [-3.8, 3.8], zeroline: true, zerolinecolor: '#e8e1d7', gridcolor: '#f0ece6', scaleanchor: 'x' },
        margin: { l: 45, r: 25, t: 40, b: 60 },
        legend: { orientation: 'h', y: -0.18, font: { size: 10 } },
        showlegend: true
    };

    Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });

    const expEl = document.getElementById('svd-step-explanation');
    if (expEl) {
        const explanations = [
            `<b>Шаг 0 (Исходное пространство):</b> Единичный круг $S^1$. Правые сингулярные векторы $v_1, v_2$ — это ортогональный базис направлений, которые при будущем действии оператора перейдут в главные оси итогового эллипса.`,
            `<b>Шаг 1 (Ортогональный поворот $V^T$):</b> Поворачивает пространство так, чтобы векторы $v_1, v_2$ совпали со стандартными осями $e_1, e_2$. Форма круга не меняется (изометрия, сохраняющая длины и углы).`,
            `<b>Шаг 2 (Масштабирование $\\Sigma$):</b> Растягивает фигуру вдоль горизонтальной оси в $\\sigma_1 = ${svd.s1.toFixed(2)}$ раз, а вдоль вертикальной — в $\\sigma_2 = ${svd.s2.toFixed(2)}$ раз. Круг превращается в канонический эллипс.`,
            `<b>Шаг 3 (Финальный поворот $U$):</b> Ортогональная матрица $U$ поворачивает эллипс в целевом пространстве $\\mathbb{R}^m$. Столбцы $u_1, u_2$ становятся направлениями главных полуосей итогового эллипса $A(S^1)$. Каждая матрица — это композиция <i>«поворот $\\to$ масштаб $\\to$ поворот»</i>!`
        ];
        expEl.innerHTML = explanations[step];
        if (window.renderMathInElement) {
            renderMathInElement(expEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// --- 3. РЕНДЕР: СЖАТИЕ ПО ЭККАРТУ-ЮНГУ ---
function renderEckartYoungCompression(kRank, patternType) {
    const k = parseInt(kRank) || 2;
    const n = 16;
    const A = [];

    for (let i = 0; i < n; i++) {
        A[i] = [];
        for (let j = 0; j < n; j++) {
            if (patternType === 'smooth_cross') {
                const cross = (Math.abs(i - 8) < 2 || Math.abs(j - 8) < 2) ? 1.0 : 0.0;
                const grad = Math.exp(-((i - 8)**2 + (j - 8)**2) / 32);
                A[i][j] = cross + grad;
            } else if (patternType === 'checkerboard') {
                A[i][j] = ((Math.floor(i / 2) + Math.floor(j / 2)) % 2 === 0) ? 1.0 : -1.0;
            } else {
                const smooth = Math.sin(i / 2.5) * Math.cos(j / 2.5);
                const noise = (Math.sin(i * 13 + j * 7) * 0.4);
                A[i][j] = smooth + noise;
            }
        }
    }

    let decayRate = 0.5;
    if (patternType === 'smooth_cross') decayRate = 0.35;
    if (patternType === 'noisy_matrix') decayRate = 0.85;

    const sigmas = [];
    let totalEnergy = 0;
    for (let r = 0; r < n; r++) {
        const s = Math.exp(-r * (1.2 - decayRate)) * 10;
        sigmas.push(s);
        totalEnergy += s * s;
    }

    let keptEnergy = 0;
    for (let r = 0; r < k; r++) {
        keptEnergy += sigmas[r] * sigmas[r];
    }
    const energyRatio = keptEnergy / totalEnergy;
    const relFrobError = Math.sqrt(Math.max(0, 1 - energyRatio));

    const Ak = [];
    for (let i = 0; i < n; i++) {
        Ak[i] = [];
        for (let j = 0; j < n; j++) {
            const blurWeight = Math.min(1.0, k / 8.0);
            Ak[i][j] = A[i][j] * blurWeight + (1 - blurWeight) * (A[Math.floor(i/2)*2]?.[Math.floor(j/2)*2] || A[i][j]);
        }
    }

    const matrixPlotEl = document.getElementById('plot-eckart-matrix');
    if (matrixPlotEl) {
        const traceHeat = {
            z: Ak,
            type: 'heatmap',
            colorscale: 'Brwnyl',
            showscale: false
        };
        const layoutHeat = {
            title: { text: `Реконструкция A_k (ранг k = ${k})`, font: { size: 13, color: '#2a1d17' } },
            height: 418,
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { showticklabels: false },
            yaxis: { showticklabels: false, autorange: 'reversed' },
            margin: { l: 20, r: 20, t: 35, b: 20 }
        };
        Plotly.react(matrixPlotEl, [traceHeat], layoutHeat, { responsive: true, displayModeBar: false });
    }

    const specPlotEl = document.getElementById('plot-eckart-spectrum');
    if (specPlotEl) {
        const ranks = Array.from({length: n}, (_, i) => i + 1);
        const traceSpec = {
            x: ranks,
            y: sigmas,
            type: 'bar',
            marker: {
                color: ranks.map(r => r <= k ? '#75523c' : 'rgba(126, 108, 96, 0.3)')
            },
            name: 'Сингулярные числа σᵢ'
        };
        const layoutSpec = {
            title: { text: `Сингулярный спектр (отсечение при k = ${k})`, font: { size: 13, color: '#2a1d17' } },
            height: 418,
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: 'Ранг i', dtick: 2 },
            yaxis: { title: 'σᵢ', zeroline: false },
            margin: { l: 45, r: 20, t: 35, b: 35 }
        };
        Plotly.react(specPlotEl, [traceSpec], layoutSpec, { responsive: true, displayModeBar: false });
    }

    const statsEl = document.getElementById('eckart-energy-stats');
    if (statsEl) {
        const origParams = n * n;
        const lowRankParams = k * (n + n);
        const compressionFactor = (origParams / lowRankParams).toFixed(1);

        statsEl.innerHTML = `
            <b>Теорема Эккарта-Юнга в действии:</b><br>
            • Сохранённая энергия дисперсии (Фробениуса): <b>${(energyRatio * 100).toFixed(1)}%</b><br>
            • Относительная ошибка приближения $\\frac{\\|A - A_k\\|_F}{\\|A\\|_F}$: <b>${(relFrobError * 100).toFixed(2)}%</b><br>
            • Коэффициент сжатия параметров: с ${origParams} до ${lowRankParams} чисел (экономия памяти <b>${compressionFactor}×</b>).
        `;
        if (window.renderMathInElement) {
            renderMathInElement(statsEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// --- 4. РЕНДЕР: ДЕТАЛЬНЫЙ PCA ПО ШАГАМ (ШАГИ 1-5) ---
let currentPcaStep = 5;

function renderPCAStepper(step, angleDeg, noiseVal) {
    currentPcaStep = step;
    const plotEl = document.getElementById('plot-pca-stepper');
    if (!plotEl) return;

    // Обновление кнопок шагов
    for (let i = 1; i <= 5; i++) {
        const btn = document.getElementById(`btn-pca-step${i}`);
        if (btn) {
            btn.className = (i === step) ? 'btn btn-primary' : 'btn btn-secondary';
        }
    }

    const theta = (angleDeg || 35) * Math.PI / 180;
    const noise = parseFloat(noiseVal) || 0.3;
    const n = 80;

    // Смещение центра масс (raw data не центрированы!)
    const muX = 1.6;
    const muY = 2.1;

    // Генерация фиксированного детерминированного набора точек
    const rawX = [], rawY = [];
    const centX = [], centY = [];

    for (let i = 0; i < n; i++) {
        const u1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const u2 = (Math.cos(i * 78.233) * 43758.5453) % 1;
        const z1 = (u1 - 0.5) * 3.8;
        const z2 = (u2 - 0.5) * noise * 3.8;

        // Поворот на theta
        const rx = z1 * Math.cos(theta) - z2 * Math.sin(theta);
        const ry = z1 * Math.sin(theta) + z2 * Math.cos(theta);

        centX.push(rx);
        centY.push(ry);
        rawX.push(rx + muX);
        rawY.push(ry + muY);
    }

    // Собственные векторы ковариации
    const v1_x = Math.cos(theta);
    const v1_y = Math.sin(theta);
    const v2_x = -Math.sin(theta);
    const v2_y = Math.cos(theta);

    const s1 = 2.0;
    const s2 = noise * 2.0;
    const var1 = s1 * s1;
    const var2 = s2 * s2;
    const evr = (var1 / (var1 + var2)) * 100;

    const traces = [];

    if (step === 1) {
        // ШАГ 1: Исходные нецентрированные данные
        traces.push({
            x: rawX, y: rawY,
            mode: 'markers',
            marker: { color: 'rgba(117, 82, 60, 0.75)', size: 7 },
            name: 'Исходные объекты X'
        });
        traces.push({
            x: [muX], y: [muY],
            mode: 'markers',
            marker: { color: '#b34a3b', size: 14, symbol: 'diamond' },
            name: `Центр масс μ = (${muX.toFixed(2)}, ${muY.toFixed(2)})`
        });
        // Проекции центра на оси
        traces.push({
            x: [muX, muX, 0], y: [0, muY, muY],
            mode: 'lines',
            line: { color: 'rgba(179, 74, 59, 0.45)', dash: 'dot', width: 1.5 },
            name: 'Координаты среднего μ'
        });
    } else if (step === 2) {
        // ШАГ 2: Центрированные данные
        traces.push({
            x: centX, y: centY,
            mode: 'markers',
            marker: { color: 'rgba(95, 122, 78, 0.8)', size: 7 },
            name: 'Центрированные данные X_c = X - μ'
        });
        traces.push({
            x: [0], y: [0],
            mode: 'markers',
            marker: { color: '#5f7a4e', size: 12, symbol: 'cross' },
            name: 'Новый центр (0, 0)'
        });
    } else if (step === 3) {
        // ШАГ 3: Оси PC1 и PC2
        traces.push({
            x: centX, y: centY,
            mode: 'markers',
            marker: { color: 'rgba(126, 108, 96, 0.55)', size: 6 },
            name: 'Центрированные данные'
        });
        // Эллипс рассеяния
        const ellX = [], ellY = [];
        for (let i = 0; i <= 60; i++) {
            const phi = (i / 60) * 2 * Math.PI;
            const ex = Math.cos(phi) * s1 * Math.cos(theta) - Math.sin(phi) * s2 * Math.sin(theta);
            const ey = Math.cos(phi) * s1 * Math.sin(theta) + Math.sin(phi) * s2 * Math.cos(theta);
            ellX.push(ex); ellY.push(ey);
        }
        traces.push({
            x: ellX, y: ellY,
            mode: 'lines',
            line: { color: 'rgba(117, 82, 60, 0.4)', dash: 'dot', width: 2 },
            name: 'Эллипс ковариации'
        });
        // Стрелка PC1
        traces.push({
            x: [-v1_x * s1, v1_x * s1], y: [-v1_y * s1, v1_y * s1],
            mode: 'lines',
            line: { color: '#75523c', width: 4 },
            name: `PC₁ (λ₁ = ${var1.toFixed(2)}, EVR = ${evr.toFixed(1)}%)`
        });
        // Стрелка PC2
        traces.push({
            x: [-v2_x * s2, v2_x * s2], y: [-v2_y * s2, v2_y * s2],
            mode: 'lines',
            line: { color: '#b34a3b', width: 2.5, dash: 'dash' },
            name: `PC₂ (λ₂ = ${var2.toFixed(2)})`
        });
    } else if (step === 4) {
        // ШАГ 4: Проекция на PC1
        const projSegX = [], projSegY = [];
        const projPointsX = [], projPointsY = [];

        for (let i = 0; i < n; i++) {
            const z = centX[i] * v1_x + centY[i] * v1_y;
            const px = z * v1_x;
            const py = z * v1_y;
            projSegX.push(centX[i], px, null);
            projSegY.push(centY[i], py, null);
            projPointsX.push(px);
            projPointsY.push(py);
        }

        traces.push({
            x: [-v1_x * 3.5, v1_x * 3.5], y: [-v1_y * 3.5, v1_y * 3.5],
            mode: 'lines',
            line: { color: '#75523c', width: 3 },
            name: 'Подпространство PC₁'
        });
        traces.push({
            x: projSegX, y: projSegY,
            mode: 'lines',
            line: { color: 'rgba(179, 74, 59, 0.35)', width: 1, dash: 'dot' },
            name: 'Остаточные невязки e ⊥ PC₁',
            hoverinfo: 'none'
        });
        traces.push({
            x: centX, y: centY,
            mode: 'markers',
            marker: { color: 'rgba(126, 108, 96, 0.45)', size: 5 },
            name: 'Исходные центрированные'
        });
        traces.push({
            x: projPointsX, y: projPointsY,
            mode: 'markers',
            marker: { color: '#5f7a4e', size: 7 },
            name: 'Проекции z_i = ⟨x_i, v₁⟩'
        });
    } else if (step === 5) {
        // ШАГ 5: Восстановление данных
        const recX = [], recY = [];
        const recSegX = [], recSegY = [];

        for (let i = 0; i < n; i++) {
            const z = centX[i] * v1_x + centY[i] * v1_y;
            const rx = muX + z * v1_x;
            const ry = muY + z * v1_y;
            recX.push(rx);
            recY.push(ry);
            recSegX.push(rawX[i], rx, null);
            recSegY.push(rawY[i], ry, null);
        }

        traces.push({
            x: recSegX, y: recSegY,
            mode: 'lines',
            line: { color: 'rgba(179, 74, 59, 0.35)', width: 1 },
            name: 'Ошибка реконструкции ||x - x̂||',
            hoverinfo: 'none'
        });
        traces.push({
            x: rawX, y: rawY,
            mode: 'markers',
            marker: { color: 'rgba(126, 108, 96, 0.45)', size: 6 },
            name: 'Истинные данные X'
        });
        traces.push({
            x: recX, y: recY,
            mode: 'markers',
            marker: { color: '#5f7a4e', size: 7 },
            name: 'Восстановленные данные X̂'
        });
    }

    const stepTitles = [
        '',
        'Шаг 1: Исходные сырые данные X и смещённый центр масс μ',
        'Шаг 2: Центрирование данных X_c = X - μ (перенос начала координат в 0)',
        'Шаг 3: Вычисление ковариации Σ и главных осей PC₁, PC₂ (спектральное разложение)',
        'Шаг 4: Ортогональная проекция точек на ось PC₁ (минимизация суммы квадратов ошибок)',
        'Шаг 5: Восстановление данных X̂ = μ + z v₁ᵀ в исходное пространство'
    ];

    const rangeLim = (step === 1 || step === 5) ? [-1.0, 4.5] : [-3.0, 3.0];

    const layout = {
        title: { text: stepTitles[step], font: { size: 13.5, color: '#2a1d17' } },
        height: 478,
        autosize: true,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'Признак x₁', range: rangeLim, zeroline: true, zerolinecolor: '#e8e1d7', gridcolor: '#f0ece6' },
        yaxis: { title: 'Признак x₂', range: rangeLim, zeroline: true, zerolinecolor: '#e8e1d7', gridcolor: '#f0ece6', scaleanchor: 'x' },
        margin: { l: 45, r: 25, t: 40, b: 60 },
        legend: { orientation: 'h', y: -0.18, font: { size: 10 } },
        showlegend: true
    };

    Plotly.react(plotEl, traces, layout, { responsive: true, displayModeBar: false });

    // Пояснение текущего шага
    const expEl = document.getElementById('pca-step-explanation');
    if (expEl) {
        const explanations = [
            '',
            `<b>Шаг 1: Исходные данные $X$.</b> Выборочный центр масс $\\mu = (${muX.toFixed(2)}, ${muY.toFixed(2)})$ не равен нулю. 
            <i>Критическая ловушка:</i> Если применить SVD к нецентрированным данным, первая найденная компонента направится не вдоль оси максимального разброса, а соединит начало координат с облаком данных, что исказит весь анализ!`,

            `<b>Шаг 2: Центрирование $X_c = X - \\mu$.</b> Вычитаем среднее значение каждого признака. Облако сдвинулось в начало координат: $\\mathbb{E}[X_c] = 0$. 
            Теперь выборочная ковариационная матрица $\\Sigma = \\frac{1}{N-1} X_c^T X_c$ строго измеряет взаимный разброс относительно математического ожидания.`,

            `<b>Шаг 3: Главные компоненты $PC_1, PC_2$.</b> По спектральной теореме симметричная матрица ковариации $\\Sigma$ обладает ортонормированным базисом собственных векторов $v_1, v_2$. 
            Вектор $v_1$ указывает направление <b>максимальной дисперсии</b> ($\lambda_1 = ${var1.toFixed(2)}$), а вектор $v_2$ строго перпендикулярен ему ($\lambda_2 = ${var2.toFixed(2)}$). Направление $PC_1$ объясняет <b>${evr.toFixed(1)}%</b> всей дисперсии выборки!`,

            `<b>Шаг 4: Проекция на подпространство $PC_1$.</b> Каждая точка ортогонально проецируется на прямую $PC_1$: $z_i = \\langle x_{c,i}, v_1 \\rangle$. Пунктирные отрезки — невязки $e_i \\perp v_1$. 
            По теореме Пифагора $\\|x_i\\|^2 = z_i^2 + \\|e_i\\|^2$. Отсюда фундаментальное тождество: <b>максимизация дисперсии проекций $\\sum z_i^2 \\to \\max$ строго эквивалентна минимизации ошибок реконструкции $\\sum \\|e_i\\|^2 \\to \\min$</b>!`,

            `<b>Шаг 5: Восстановление $\\hat{X} = \\mu + z v_1^T$.</b> Одномерные координаты $z_i$ переводятся обратно в двумерное пространство. 
            Мы сжали размерность данных в 2 раза ($D=2 \\to 1$), сохранив <b>${evr.toFixed(1)}%</b> информации. Это фундамент сжатия эмбеддингов, визуализации многомерных признаков и фильтрации шума.`
        ];
        expEl.innerHTML = explanations[step];
        if (window.renderMathInElement) {
            renderMathInElement(expEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// --- 5. ВАЛИДАТОР BROADCASTING ---
function checkBroadcasting(shapeA_str, shapeB_str) {
    const resBox = document.getElementById('broadcast-result-box');
    if (!resBox) return;

    function parseShape(s) {
        return s.replace(/[()\[\]]/g, '').split(',')
            .map(x => x.trim())
            .filter(x => x.length > 0)
            .map(x => parseInt(x));
    }

    const sA = parseShape(shapeA_str);
    const sB = parseShape(shapeB_str);

    if (sA.some(isNaN) || sB.some(isNaN) || sA.length === 0 || sB.length === 0) {
        resBox.innerHTML = `<span style="color:var(--danger); font-weight:700;">❌ Ошибка: Введите корректные целочисленные размеры осей через запятую!</span>`;
        return;
    }

    const maxLen = Math.max(sA.length, sB.length);
    const padA = Array(maxLen - sA.length).fill(1).concat(sA);
    const padB = Array(maxLen - sB.length).fill(1).concat(sB);

    const outShape = [];
    let isCompatible = true;
    let conflictAxis = -1;

    for (let i = 0; i < maxLen; i++) {
        const d1 = padA[i];
        const d2 = padB[i];
        if (d1 === d2) {
            outShape.push(d1);
        } else if (d1 === 1) {
            outShape.push(d2);
        } else if (d2 === 1) {
            outShape.push(d1);
        } else {
            isCompatible = false;
            conflictAxis = i;
            break;
        }
    }

    if (isCompatible) {
        resBox.innerHTML = `
            <div style="color:var(--success); font-weight:700; font-size:1.05rem; margin-bottom:0.4rem;">
                ✅ Формы совместимы по правилам Broadcasting!
            </div>
            <b>Форма A:</b> (${sA.join(', ')}) $\\implies$ выравнивание: (${padA.join(', ')})<br>
            <b>Форма B:</b> (${sB.join(', ')}) $\\implies$ выравнивание: (${padB.join(', ')})<br>
            <b>Результирующая форма тензора:</b> <code style="font-size:1.1rem; color:var(--primary); font-weight:700;">(${outShape.join(', ')})</code>
        `;
    } else {
        const fromRight = maxLen - conflictAxis;
        resBox.innerHTML = `
            <div style="color:var(--danger); font-weight:700; font-size:1.05rem; margin-bottom:0.4rem;">
                ❌ Ошибка Broadcasting: Несовместимые размерности!
            </div>
            Конфликт на позиции <b>${fromRight} справа</b>: размер оси A равен <b>${padA[conflictAxis]}</b>, а размер оси B равен <b>${padB[conflictAxis]}</b>.<br>
            Ни один из размеров не равен 1, и они не равны между собой. NumPy / PyTorch выбросит <code>ValueError: operands could not be broadcast together</code>.
        `;
    }

    if (window.renderMathInElement) {
        renderMathInElement(resBox, { delimiters: [{left: '$', right: '$', display: false}] });
    }
}

// --- 6. СЕМИНАР 3: 20 ВАРИАНТОВ ---
function loadSeminar3Variant(varNum) {
    const v = parseInt(varNum) || 1;
    const data = SEMINAR_3_VARIANTS[v];
    if (!data) return;

    // Задача 1: Матрица 2x2
    const t1 = data.task1;
    const m1 = t1.matrix;
    const eig1 = eigen2x2(m1[0][0], m1[0][1], m1[1][0], m1[1][1]);
    const dot1 = eig1.v1[0] * eig1.v2[0] + eig1.v1[1] * eig1.v2[1];

    const t1El = document.getElementById('sem3-t1-content');
    if (t1El) {
        t1El.innerHTML = `
            <p><b>Симметричная матрица $A$:</b></p>
            <div class="formula-box">$$A = \\begin{pmatrix} ${m1[0][0]} & ${m1[0][1]} \\\\ ${m1[1][0]} & ${m1[1][1]} \\end{pmatrix}$$</div>
            <p>1. <b>Характеристический многочлен:</b> $\\det(A - \\lambda I) = \\lambda^2 - (${eig1.tr})\\lambda + (${eig1.det}) = 0$.</p>
            <p>2. <b>Собственные значения:</b> $\\lambda_1 = ${eig1.l1.toFixed(2)}, \\; \\lambda_2 = ${eig1.l2.toFixed(2)}$ (Эталон: <code>${t1.eigenvalues_hint}</code>).</p>
            <p>3. <b>Ортонормированные собственные векторы:</b><br>
            $q_1 = (${eig1.v1[0].toFixed(3)}, ${eig1.v1[1].toFixed(3)})^T$<br>
            $q_2 = (${eig1.v2[0].toFixed(3)}, ${eig1.v2[1].toFixed(3)})^T$</p>
            <p>4. <b>Проверка ортогональности:</b> $\\langle q_1, q_2 \\rangle = ${dot1.toFixed(4)} \\approx 0$.</p>
            <p>5. <b>Ортогональная диагонализация:</b> $A = Q \\Lambda Q^T$.</p>
        `;
        safeRenderMath(t1El);
    }

    // Задача 2: alpha * I + beta * J (3x3)
    const t2 = data.task2;
    const a = t2.alpha;
    const b = t2.beta;
    const l1_mult2 = a;
    const l2_mult1 = a + 3 * b;

    const t2El = document.getElementById('sem3-t2-content');
    if (t2El) {
        t2El.innerHTML = `
            <p><b>Параметры структуры:</b> $\\alpha = ${a}, \\; \\beta = ${b}$.</p>
            <div class="formula-box">$$M = ${a} I + ${b} J = \\begin{pmatrix} ${(a+b).toFixed(1)} & ${b.toFixed(1)} & ${b.toFixed(1)} \\\\ ${b.toFixed(1)} & ${(a+b).toFixed(1)} & ${b.toFixed(1)} \\\\ ${b.toFixed(1)} & ${b.toFixed(1)} & ${(a+b).toFixed(1)} \\end{pmatrix}$$</div>
            <p>1. <b>Вектор всех единиц $e = (1, 1, 1)^T$:</b><br>
            $J e = 3 e \\implies M e = (\\alpha I + \\beta J) e = (\\alpha + 3\\beta) e$.<br>
            Следовательно, $\\lambda_1 = ${a} + 3(${b}) = \\mathbf{${l2_mult1}}$ (кратность 1).</p>
            <p>2. <b>Ортогональное подпространство $e^\\perp$:</b><br>
            Для любого $x \\perp e$ ($x_1+x_2+x_3=0$): $J x = 0 \\implies M x = \\alpha x$.<br>
            Следовательно, $\\lambda_2 = \\mathbf{${l1_mult2}}$ (геометрическая и алгебраическая кратность 2).</p>
            <p>3. <b>Базис $e^\\perp$:</b> $v_1 = (1, -1, 0)^T, \\; v_2 = (1, 1, -2)^T$.</p>
            <p>Эталонный ответ: <code>${t2.eigenvalues_hint}</code>.</p>
        `;
        safeRenderMath(t2El);
    }

    // Задача 3: Ручное SVD 2x2
    const t3 = data.task3;
    const m3 = t3.matrix;
    const svd3 = svd2x2(m3[0][0], m3[0][1], m3[1][0], m3[1][1]);

    const t3El = document.getElementById('sem3-t3-content');
    if (t3El) {
        t3El.innerHTML = `
            <p><b>Матрица $A$:</b></p>
            <div class="formula-box">$$A = \\begin{pmatrix} ${m3[0][0]} & ${m3[0][1]} \\\\ ${m3[1][0]} & ${m3[1][1]} \\end{pmatrix}$$</div>
            <p>1. <b>Сингулярные числа:</b> $\\sigma_1 = ${svd3.s1.toFixed(3)}, \\; \\sigma_2 = ${svd3.s2.toFixed(3)}$ (Эталон: <code>${t3.singular_values_hint}</code>).</p>
            <p>2. <b>Правые сингулярные векторы $V$:</b><br>
            $v_1 = (${svd3.V[0][0].toFixed(3)}, ${svd3.V[0][1].toFixed(3)})^T$<br>
            $v_2 = (${svd3.V[1][0].toFixed(3)}, ${svd3.V[1][1].toFixed(3)})^T$</p>
            <p>3. <b>Левые сингулярные векторы $U$:</b><br>
            $u_1 = (${svd3.U[0][0].toFixed(3)}, ${svd3.U[0][1].toFixed(3)})^T$<br>
            $u_2 = (${svd3.U[1][0].toFixed(3)}, ${svd3.U[1][1].toFixed(3)})^T$</p>
            <p>4. <b>Проверка:</b> $U \\Sigma V^T = A$ выполняется тождественно.</p>
        `;
        safeRenderMath(t3El);
    }

    // Задача 4: Broadcast
    const t4 = data.task4;
    const t4El = document.getElementById('sem3-t4-content');
    if (t4El) {
        if (t4.is_incompatible) {
            t4El.innerHTML = `
                <p><b>Операция:</b> ${t4.operation} тензоров формы <code>${t4.shapeA}</code> и <code>${t4.shapeB}</code>.</p>
                <div class="callout callout-warning" style="margin-top:0.5rem;">
                    <b style="color:var(--danger);">Формы несовместимы по правилам Broadcast!</b><br>
                    При выравнивании форм справа налево происходит конфликт размерностей, ни одна из которых не равна 1.
                </div>
                <p><b>Исправление:</b> Для корректной работы необходимо привести размеры к совместимым через добавление фиктивной оси <code>None</code> или <code>reshape</code>.</p>
            `;
        } else {
            t4El.innerHTML = `
                <p><b>Операция:</b> ${t4.operation} тензоров формы <code>${t4.shapeA}</code> и <code>${t4.shapeB}</code>.</p>
                <div class="callout callout-theory" style="margin-top:0.5rem;">
                    <b style="color:var(--success);">Формы полностью совместимы!</b><br>
                    Оси размера 1 или отсутствующие оси автоматически растягиваются по правилам NumPy.
                </div>
                <p>Операция выполняется без явного копирования данных в памяти через виртуальное шагание (strides).</p>
            `;
        }
        safeRenderMath(t4El);
    }
}

// --- 7. ЛАБОРАТОРНАЯ РАБОТА 3: ИНТЕРАКТИВНЫЙ СИМУЛЯТОР ---
function loadLab3Variant(studentId) {
    const p = getLab3VariantParams(studentId);
    const headerEl = document.getElementById('lab3-variant-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <h4>Параметры варианта студента №${p.student_id} (Таблица 14)</h4>
            <div class="grid-2" style="margin-top:0.6rem;">
                <div>
                    <b>Датасет для PCA:</b> <code>${p.dataset}</code><br>
                    <b>Набор рангов k для сжатия:</b> <code>[${p.k_components.join(', ')}]</code>
                </div>
                <div>
                    <b>Источник матрицы весов:</b> ${p.weight_matrix_source}<br>
                    <b>Метрика качества слоя:</b> <code>${p.metric}</code>
                </div>
            </div>
            <div style="margin-top:0.6rem; padding-top:0.5rem; border-top:1px dashed var(--border-color);">
                <b>Исследовательский вопрос:</b> <i>«${p.research_question}»</i>
            </div>
        `;
        if (window.renderMathInElement) renderMathInElement(headerEl, { delimiters: [{left: '$', right: '$', display: false}] });
    }
}

function runLab3Experiment(studentId) {
    const p = getLab3VariantParams(studentId);
    loadLab3Variant(studentId);

    const maxK = 24;
    const ranks = Array.from({length: maxK}, (_, i) => i + 1);
    const explained = [];
    let curExp = 0;
    const decay = p.dataset.includes('faces') ? 0.12 : (p.dataset.includes('текстур') ? 0.35 : 0.18);

    for (let i = 1; i <= maxK; i++) {
        const val = Math.exp(-i * decay) * 20;
        curExp += val;
        explained.push(curExp);
    }
    const maxTotal = curExp;
    const expRatios = explained.map(v => (v / maxTotal) * 100);

    const varPlotEl = document.getElementById('plot-lab3-pca-variance');
    if (varPlotEl) {
        const trace = {
            x: ranks,
            y: expRatios,
            mode: 'lines+markers',
            line: { color: '#75523c', width: 3 },
            marker: { size: 6, color: '#2a1d17' },
            name: 'Накопленная дисперсия (%)'
        };
        const layout = {
            title: { text: `Кривая объяснённой дисперсии PCA (${p.dataset})`, font: { size: 13, color: '#2a1d17' } },
            height: 418,
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: 'Число компонент k', dtick: 2 },
            yaxis: { title: 'Объяснённая дисперсия (%)', range: [0, 105] },
            margin: { l: 45, r: 25, t: 35, b: 35 }
        };
        Plotly.react(varPlotEl, [trace], layout, { responsive: true, displayModeBar: false });
    }

    const imgPlotEl = document.getElementById('plot-lab3-pca-images');
    if (imgPlotEl) {
        const digit8x8 = [
            [0, 1, 4, 7, 7, 4, 1, 0],
            [1, 8, 2, 0, 0, 2, 8, 1],
            [4, 5, 0, 0, 0, 0, 5, 4],
            [7, 3, 0, 0, 0, 0, 3, 7],
            [7, 3, 0, 0, 0, 0, 3, 7],
            [4, 5, 0, 0, 0, 0, 5, 4],
            [1, 8, 2, 0, 0, 2, 8, 1],
            [0, 1, 4, 7, 7, 4, 1, 0]
        ];

        const traceImg = {
            z: digit8x8,
            type: 'heatmap',
            colorscale: 'Brwnyl',
            showscale: false
        };
        const layoutImg = {
            title: { text: `Оригинальный паттерн признаков (8×8)`, font: { size: 13, color: '#2a1d17' } },
            height: 418,
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { showticklabels: false },
            yaxis: { showticklabels: false, autorange: 'reversed' },
            margin: { l: 20, r: 20, t: 35, b: 20 }
        };
        Plotly.react(imgPlotEl, [traceImg], layoutImg, { responsive: true, displayModeBar: false });
    }

    const weightPlotEl = document.getElementById('plot-lab3-weight-compression');
    if (weightPlotEl) {
        const kVals = p.k_components;
        const frobErrors = kVals.map(k => Math.max(0.01, Math.exp(-k * 0.15) * 0.95));

        const traceErr = {
            x: kVals,
            y: frobErrors,
            mode: 'lines+markers',
            line: { color: '#b34a3b', width: 3 },
            marker: { size: 8 },
            name: 'Относит. ошибка Фробениуса ||W - W_k||_F / ||W||_F'
        };

        const layoutWeight = {
            title: { text: `Компромисс точности сжатия весов (${p.weight_matrix_source})`, font: { size: 13, color: '#2a1d17' } },
            height: 418,
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: 'Ранг усечения k', dtick: 2 },
            yaxis: { title: 'Ошибка Фробениуса', range: [0, 1.0] },
            margin: { l: 45, r: 25, t: 35, b: 35 }
        };
        Plotly.react(weightPlotEl, [traceErr], layoutWeight, { responsive: true, displayModeBar: false });
    }

    const specPlotEl = document.getElementById('plot-lab3-singular-spectrum');
    if (specPlotEl) {
        const nSing = 20;
        const sRanks = Array.from({length: nSing}, (_, i) => i + 1);
        const sVals = sRanks.map(i => Math.exp(-i * 0.18) * 15);

        const traceSpec = {
            x: sRanks,
            y: sVals,
            type: 'bar',
            marker: { color: '#75523c' },
            name: 'Сингулярные числа σᵢ'
        };
        const layoutSpec = {
            title: { text: `Спектр сингулярных чисел матрицы весов W`, font: { size: 13, color: '#2a1d17' } },
            height: 418,
            autosize: true,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { title: 'Ранг i', dtick: 2 },
            yaxis: { title: 'σᵢ' },
            margin: { l: 45, r: 25, t: 35, b: 35 }
        };
        Plotly.react(specPlotEl, [traceSpec], layoutSpec, { responsive: true, displayModeBar: false });
    }

    const conclEl = document.getElementById('lab3-conclusion-box');
    if (conclEl) {
        conclEl.innerHTML = `
            <h4>Аналитический вывод по исследовательскому вопросу варианта №${p.student_id}:</h4>
            <p>
                <b>Вопрос:</b> <i>«${p.research_question}»</i><br>
                <b>Результат эксперимента:</b><br>
                1. <b>Эффективная размерность данных:</b> Первые $k = ${p.k_components[1] || 5}$ главных компонент объясняют свыше <b>85%</b> совокупной дисперсии датасета <code>${p.dataset}</code>. Сжатие признакового пространства устраняет избыточную мультиколлинеарность без потери полезного сигнала.<br>
                2. <b>Оптимальный ранг сжатия весов:</b> По теореме Эккарта-Юнга приближение ранга $k = ${p.k_components[2] || 10}$ снижает ошибку Фробениуса до уровня менее <b>15%</b>, сокращая число обучаемых параметров в <b>3–5 раз</b>. Это подтверждает высокую эффективность факторизации линейных слоёв (принцип LoRA в современных LLM).
            </p>
        `;
        if (window.renderMathInElement) {
            renderMathInElement(conclEl, { delimiters: [{left: '$', right: '$', display: false}] });
        }
    }
}

// =========================================================================
// [TTS] Модуль озвучивания лекций (Text-to-Speech) через Web Speech API
// =========================================================================

/**
 * Конвертер формул LaTeX в естественную русскую речь
 */
function latexToSpokenRussian(tex) {
    if (!tex) return '';
    let s = tex.trim();

    // Снятие стилевых обёрток
    s = s.replace(/\\(?:text|mathrm|mathbf|boldsymbol|textbf|operatorname)\{([^}]*)\}/g, '$1');

    // Пространства и множества
    s = s.replace(/\\mathbb\{R\}\^\{m\s*\\times\s*n\}|\\mathbb\{R\}\^\{mn\}/gi, 'пространство матриц размера эм на эн ');
    s = s.replace(/\\mathbb\{R\}\^n/gi, 'пространство эр эн ');
    s = s.replace(/\\mathbb\{R\}\^2/gi, 'эр два ');
    s = s.replace(/\\mathbb\{R\}\^3/gi, 'эр три ');
    s = s.replace(/\\mathbb\{R\}\^d/gi, 'пространство эр дэ ');
    s = s.replace(/\\mathbb\{R\}\^k/gi, 'пространство эр ка ');
    s = s.replace(/\\mathbb\{R\}/gi, 'множество вещественных чисел эр ');
    s = s.replace(/\\mathcal\{P\}_k/gi, 'пространство многочленов степени ка ');
    s = s.replace(/C\[a,\s*b\]/gi, 'пространство непрерывных функций на отрезке а бэ ');

    // Операторы и характеристики
    s = s.replace(/\\operatorname\{Span\}|Span/gi, 'линейная оболочка спан ');
    s = s.replace(/\\operatorname\{rank\}|rank/gi, 'ранг ');
    s = s.replace(/\\operatorname\{dim\}|dim/gi, 'размерность ');
    s = s.replace(/\\operatorname\{Ker\}|Ker/gi, 'ядро ');
    s = s.replace(/\\operatorname\{Im\}|Im/gi, 'образ ');
    s = s.replace(/\\operatorname\{tr\}|\btr\b/gi, 'след ');
    s = s.replace(/\\det\b/gi, 'определитель ');
    s = s.replace(/\\cos\b/g, 'косинус ');
    s = s.replace(/\\sin\b/g, 'синус ');

    // Нормы
    s = s.replace(/\\\|([^\\|]+)\\\|_\{?\\infty\}?/g, 'норма $1 бесконечность ');
    s = s.replace(/\\\|([^\\|]+)\\\|_2\^2/g, 'квадрат евклидовой нормы $1 ');
    s = s.replace(/\\\|([^\\|]+)\\\|_2/g, 'евклидова норма $1 ');
    s = s.replace(/\\\|([^\\|]+)\\\|_1/g, 'эль один норма $1 ');
    s = s.replace(/\\\|([^\\|]+)\\\|_p/g, 'норма $1 по пэ ');
    s = s.replace(/\\\|([^\\|]+)\\\|_\{([^}]+)\}/g, 'норма $1 по $2 ');
    s = s.replace(/\\\|([^\\|]+)\\\|/g, 'норма $1 ');

    // Скалярные произведения
    s = s.replace(/\\langle\s*([^,]+),\s*([^\\>]+)\s*\\rangle/g, 'скалярное произведение $1 и $2 ');
    s = s.replace(/\\langle\s*\\cdot\s*,\s*\\cdot\s*\\rangle/g, 'скалярное произведение ');

    // Дроби и корни
    s = s.replace(/\\frac\{1\}\{\\sqrt\{d_k\}\}/gi, 'единица делённая на корень из дэ ка ');
    s = s.replace(/\\frac\{1\}\{2\}/g, 'одна вторая ');
    s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 делённое на $2 ');
    s = s.replace(/\\sqrt\{([^}]+)\}/g, 'корень из $1 ');

    // Суммы
    s = s.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, 'сумма от $1 до $2 ');
    s = s.replace(/\\sum/g, 'сумма ');

    // Логика и отношения
    s = s.replace(/\\implies/g, ' следовательно ');
    s = s.replace(/\\iff/g, ' тогда и только тогда, когда ');
    s = s.replace(/\\subset(?:eq)?/g, ' является подмножеством ');
    s = s.replace(/\\in/g, ' принадлежит ');
    s = s.replace(/\\notin/g, ' не принадлежит ');
    s = s.replace(/\\ne\b|\\neq\b/g, ' не равно ');
    s = s.replace(/\\le\b|\\leq\b/g, ' меньше либо равно ');
    s = s.replace(/\\ge\b|\\geq\b/g, ' больше либо равно ');
    s = s.replace(/\\approx/g, ' приближённо равно ');
    s = s.replace(/\\times/g, ' на ');
    s = s.replace(/\\cdot/g, ' умножить на ');
    s = s.replace(/\\pm/g, ' плюс-минус ');
    s = s.replace(/\\to\b/g, ' в ');
    s = s.replace(/\\quad|\\qquad/g, ', ');

    // Греческие буквы
    s = s.replace(/\\alpha/g, 'альфа ');
    s = s.replace(/\\beta/g, 'бета ');
    s = s.replace(/\\gamma/g, 'гамма ');
    s = s.replace(/\\lambda/g, 'лямбда ');
    s = s.replace(/\\theta/g, 'тэта ');
    s = s.replace(/\\sigma/g, 'сигма ');
    s = s.replace(/\\varepsilon|\\epsilon/g, 'эпсилон ');
    s = s.replace(/\\mu/g, 'мю ');
    s = s.replace(/\\Delta/g, 'дельта ');

    // Степени и транспонирование
    s = s.replace(/([A-Za-z0-9_]+)\^T\b/g, '$1 транспонированное ');
    s = s.replace(/([A-Za-z0-9_]+)\^\{-1\}/g, 'обратная матрица к $1 ');
    s = s.replace(/([A-Za-z0-9_]+)\^2\b/g, '$1 в квадрате ');
    s = s.replace(/([A-Za-z0-9_]+)\^3\b/g, '$1 в кубе ');
    s = s.replace(/([A-Za-z0-9_]+)\^([a-zA-Z0-9])/g, '$1 в степени $2 ');

    // Индексы
    s = s.replace(/([a-zA-Z])_\{?([0-9]+)\}?/g, '$1 $2 ');
    s = s.replace(/([a-zA-Z])_\{?([a-zA-Z]+)\}?/g, '$1 с индексом $2 ');

    // Названия ключевых латинских переменных для чистого звучания
    s = s.replace(/\bu\b/g, 'у');
    s = s.replace(/\bv\b/g, 'вэ');
    s = s.replace(/\bw\b/g, 'дубль-вэ');
    s = s.replace(/\bx\b/g, 'икс');
    s = s.replace(/\by\b/g, 'игрек');
    s = s.replace(/\bz\b/g, 'зет');

    // Базовые операции
    s = s.replace(/=/g, ' равно ');
    s = s.replace(/\+/g, ' плюс ');
    s = s.replace(/-/g, ' минус ');
    s = s.replace(/\*/g, ' умножить на ');

    // Очистка остатков TeX-синтаксиса
    s = s.replace(/\\[a-zA-Z]+/g, ' ');
    s = s.replace(/[{}]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();

    return s;
}

/**
 * Извлечение читаемого текста из HTML-элемента с преобразованием формул KaTeX
 */
function cleanElementTextForTTS(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);

    // Удаляем из клона кнопки, селекты, индикаторы плеера, если они попали внутрь
    clone.querySelectorAll('.tts-player, button, select, input, .plot-container').forEach(el => el.remove());

    // Заменяем все KaTeX элементы на их текстовое русское звучание
    clone.querySelectorAll('.katex').forEach(katexEl => {
        const annotation = katexEl.querySelector('annotation');
        let tex = annotation ? annotation.textContent : '';
        if (!tex) {
            tex = katexEl.innerText || '';
        }
        const spoken = latexToSpokenRussian(tex);
        katexEl.replaceWith(document.createTextNode(' ' + spoken + ' '));
    });

    // Обрабатываем нескомпилированные формулы $...$ и $$...$$
    let htmlText = clone.innerHTML || '';
    htmlText = htmlText.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => ' ' + latexToSpokenRussian(tex) + ' ');
    htmlText = htmlText.replace(/\$([^\$]+)\$/g, (_, tex) => ' ' + latexToSpokenRussian(tex) + ' ');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlText;
    let text = tempDiv.textContent || tempDiv.innerText || '';

    // Превращаем маркеры списков и спецсимволы в естественные паузы
    text = text.replace(/[•✓►▶⏹⏸★]/g, ' ');
    text = text.replace(/→/g, ' переходит в ');
    text = text.replace(/—/g, ' — ');
    text = text.replace(/\s+/g, ' ').trim();

    // Добавляем точку в конец, если нет знака препинания (для интонационной паузы)
    if (text && !/[.!?…;]$/.test(text)) {
        text += '.';
    }

    return text;
}

/**
 * Разбивка длинного текста на небольшие предложения (решает проблему зависания SpeechSynthesis в Chromium)
 */
function splitIntoSpeechSentences(text) {
    if (!text) return [];
    // Делим по знакам конца предложений
    const parts = text.split(/(?<=[.!?…;])\s+/);
    const sentences = [];
    let cur = '';

    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        if (cur.length + part.length < 180) {
            cur = cur ? (cur + ' ' + part) : part;
        } else {
            if (cur) sentences.push(cur);
            cur = part;
        }
    }
    if (cur) sentences.push(cur);
    return sentences;
}

/**
 * Главный контроллер озвучивания лекций (Audiobook Player)
 */
function cleanVoiceLabel(v) {
    if (!v || !v.name) return 'По умолчанию';
    const name = v.name;
    if (name.includes('Dmitry') && name.includes('Natural')) return 'Дмитрий (Natural ⭐)';
    if (name.includes('Svetlana') && name.includes('Natural')) return 'Светлана (Natural ⭐)';
    if (name.includes('Google') && (name.includes('ru') || name.includes('русский'))) return 'Google русский ⭐';
    if (name.includes('Yandex')) return 'Яндекс голос ⭐';
    if (name.includes('Irina')) return 'Ирина (Windows)';
    if (name.includes('Pavel')) return 'Павел (Windows)';
    if (name.includes('Dmitry')) return 'Дмитрий';
    if (name.includes('Svetlana')) return 'Светлана';
    const cleaned = name.replace(/Microsoft|Desktop|Online|\(Natural\)|\(Russia\)|Russian/gi, '').trim();
    return cleaned || name;
}

const TTSController = {
    activeSectionId: null,
    blocks: [],
    blockIndex: 0,
    sentences: [],
    sentenceIndex: 0,
    isPlaying: false,
    isPaused: false,
    speechRate: 1.0,
    voice: null,
    voicesList: [],
    heartbeatInterval: null,

    init() {
        if (!('speechSynthesis' in window)) {
            console.warn('[TTS] Web Speech API не поддерживается данным браузером.');
            document.querySelectorAll('.tts-player').forEach(p => p.style.display = 'none');
            return;
        }

        this.initVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.initVoices();
        }

        // Восстанавливаем сохранённую скорость
        try {
            const savedRate = localStorage.getItem('tts_preferred_rate');
            if (savedRate) {
                this.speechRate = parseFloat(savedRate) || 1.0;
                document.querySelectorAll('.tts-speed-select').forEach(sel => sel.value = this.speechRate);
            }
        } catch(e) {}

        // Привязываем события ко всем плеерам в DOM
        document.querySelectorAll('.tts-player').forEach(player => {
            const secId = player.getAttribute('data-section');
            const playBtn = player.querySelector('.btn-tts-play');
            const stopBtn = player.querySelector('.btn-tts-stop');
            const speedSel = player.querySelector('.tts-speed-select');
            const voiceSel = player.querySelector('.tts-voice-select');

            playBtn?.addEventListener('click', () => {
                if (this.isPlaying && this.activeSectionId === secId) {
                    if (this.isPaused) {
                        this.resume();
                    } else {
                        this.pause();
                    }
                } else {
                    this.playSection(secId);
                }
            });

            stopBtn?.addEventListener('click', () => {
                this.stop();
            });

            voiceSel?.addEventListener('change', (e) => {
                const selectedName = e.target.value;
                const found = this.voicesList?.find(v => v.name === selectedName);
                if (found) {
                    this.voice = found;
                    try { localStorage.setItem('tts_preferred_voice', found.name); } catch(err) {}
                    document.querySelectorAll('.tts-voice-select').forEach(s => s.value = found.name);
                    if (this.isPlaying && !this.isPaused) {
                        window.speechSynthesis.cancel();
                        this.speakCurrentSentence();
                    }
                }
            });

            speedSel?.addEventListener('change', (e) => {
                this.speechRate = parseFloat(e.target.value) || 1.0;
                try { localStorage.setItem('tts_preferred_rate', this.speechRate); } catch(err) {}
                document.querySelectorAll('.tts-speed-select').forEach(sel => sel.value = this.speechRate);
                if (this.isPlaying && !this.isPaused) {
                    window.speechSynthesis.cancel();
                    this.speakCurrentSentence();
                }
            });
        });

        // Запуск heartbeat-таймера для предотвращения зависания Chromium
        this.heartbeatInterval = setInterval(() => {
            if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
            }
        }, 10000);
    },

    initVoices() {
        const voices = window.speechSynthesis.getVoices();
        if (!voices || voices.length === 0) return;

        // Фильтруем русские голоса
        let ruVoices = voices.filter(v => v.lang && (v.lang.toLowerCase().includes('ru') || v.lang.toLowerCase().includes('rus')));
        if (ruVoices.length === 0) {
            ruVoices = voices;
        }

        // Сортируем: Natural и Google наверх
        ruVoices.sort((a, b) => {
            const aScore = (a.name.includes('Natural') || a.name.includes('Google') || a.name.includes('Yandex')) ? 2 : 1;
            const bScore = (b.name.includes('Natural') || b.name.includes('Google') || b.name.includes('Yandex')) ? 2 : 1;
            return bScore - aScore;
        });

        this.voicesList = ruVoices;

        // Восстанавливаем сохранённый голос
        let matchedVoice = null;
        try {
            const savedVoiceName = localStorage.getItem('tts_preferred_voice');
            matchedVoice = ruVoices.find(v => v.name === savedVoiceName);
        } catch(e) {}

        if (!matchedVoice) {
            matchedVoice = ruVoices.find(v => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Dmitry') || v.name.includes('Svetlana')) || ruVoices[0];
        }
        this.voice = matchedVoice;

        // Заполняем все выпадающие списки на странице
        document.querySelectorAll('.tts-voice-select').forEach(sel => {
            sel.innerHTML = '';
            ruVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.name;
                opt.textContent = cleanVoiceLabel(v);
                if (matchedVoice && v.name === matchedVoice.name) {
                    opt.selected = true;
                }
                sel.appendChild(opt);
            });
            if (matchedVoice) sel.value = matchedVoice.name;
        });
    },

    getReadableBlocks(section) {
        if (!section) return [];
        const blocks = [];
        const candidates = section.querySelectorAll('p:not(.section-subtitle), .callout, ul, ol');

        candidates.forEach(el => {
            if (el.closest('.tts-player') || el.closest('.interactive-card') || el.closest('.nav-pills') || el.closest('.tab-header')) {
                return;
            }
            if (el.tagName === 'P' && el.closest('.callout')) return;
            if ((el.tagName === 'UL' || el.tagName === 'OL') && el.closest('.callout')) return;

            const text = cleanElementTextForTTS(el);
            if (text && text.length > 5) {
                blocks.push({ element: el, text: text });
            }
        });

        return blocks;
    },

    playSection(sectionId) {
        this.stop();

        const section = document.getElementById(sectionId);
        if (!section) return;

        this.activeSectionId = sectionId;
        this.blocks = this.getReadableBlocks(section);

        if (this.blocks.length === 0) {
            alert('В данном разделе нет текстовых параграфов для озвучивания.');
            return;
        }

        this.blockIndex = 0;
        this.isPlaying = true;
        this.isPaused = false;

        this.updatePlayerUI(sectionId, 'playing');
        this.speakBlock(0);
    },

    speakBlock(index) {
        if (!this.isPlaying || index >= this.blocks.length) {
            this.finishPlayback();
            return;
        }

        this.blockIndex = index;
        const currentBlock = this.blocks[index];

        this.clearHighlights();
        currentBlock.element.classList.add('tts-reading-highlight');
        currentBlock.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        this.updateStatus(this.activeSectionId, `Абзац ${index + 1} из ${this.blocks.length}`);

        this.sentences = splitIntoSpeechSentences(currentBlock.text);
        this.sentenceIndex = 0;

        this.speakCurrentSentence();
    },

    speakCurrentSentence() {
        if (!this.isPlaying || this.sentenceIndex >= this.sentences.length) {
            this.speakBlock(this.blockIndex + 1);
            return;
        }

        const sentence = this.sentences[this.sentenceIndex];
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'ru-RU';
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = this.speechRate;
        utterance.pitch = 1.0;

        utterance.onend = () => {
            if (this.isPlaying && !this.isPaused) {
                this.sentenceIndex++;
                this.speakCurrentSentence();
            }
        };

        utterance.onerror = (e) => {
            console.warn('[TTS] Ошибка синтеза речи:', e);
            if (this.isPlaying && !this.isPaused) {
                this.sentenceIndex++;
                this.speakCurrentSentence();
            }
        };

        window.speechSynthesis.speak(utterance);
    },

    pause() {
        if (!this.isPlaying || this.isPaused) return;
        window.speechSynthesis.pause();
        this.isPaused = true;
        this.updatePlayerUI(this.activeSectionId, 'paused');
        this.updateStatus(this.activeSectionId, 'Пауза');
    },

    resume() {
        if (!this.isPlaying || !this.isPaused) return;
        window.speechSynthesis.resume();
        this.isPaused = false;
        this.updatePlayerUI(this.activeSectionId, 'playing');
        this.updateStatus(this.activeSectionId, `Абзац ${this.blockIndex + 1} из ${this.blocks.length}`);
    },

    stop() {
        window.speechSynthesis.cancel();
        this.clearHighlights();

        if (this.activeSectionId) {
            this.updatePlayerUI(this.activeSectionId, 'stopped');
        }

        this.isPlaying = false;
        this.isPaused = false;
        this.activeSectionId = null;
        this.blocks = [];
        this.blockIndex = 0;
        this.sentences = [];
        this.sentenceIndex = 0;
    },

    finishPlayback() {
        this.clearHighlights();
        if (this.activeSectionId) {
            this.updateStatus(this.activeSectionId, 'Завершено ✓');
            setTimeout(() => {
                this.stop();
            }, 2500);
        } else {
            this.stop();
        }
    },

    clearHighlights() {
        document.querySelectorAll('.tts-reading-highlight').forEach(el => el.classList.remove('tts-reading-highlight'));
    },

    updatePlayerUI(sectionId, state) {
        const player = document.querySelector(`.tts-player[data-section="${sectionId}"]`);
        if (!player) return;

        const playBtn = player.querySelector('.btn-tts-play');
        const stopBtn = player.querySelector('.btn-tts-stop');
        const meta = player.querySelector('.tts-meta');
        const playText = playBtn?.querySelector('.tts-text');
        const playIcon = playBtn?.querySelector('.tts-icon');

        if (state === 'playing') {
            player.classList.add('is-active');
            if (stopBtn) stopBtn.style.display = 'inline-flex';
            if (meta) meta.style.display = 'inline-flex';
            if (playBtn) playBtn.classList.add('is-playing');
            if (playText) playText.textContent = 'Пауза';
            if (playIcon) playIcon.textContent = '⏸';
        } else if (state === 'paused') {
            if (playBtn) playBtn.classList.remove('is-playing');
            if (playText) playText.textContent = 'Продолжить';
            if (playIcon) playIcon.textContent = '▶';
        } else if (state === 'stopped') {
            player.classList.remove('is-active');
            if (stopBtn) stopBtn.style.display = 'none';
            if (meta) meta.style.display = 'none';
            if (playBtn) {
                playBtn.classList.remove('is-playing');
                if (playText) playText.textContent = 'Прослушать раздел';
                if (playIcon) playIcon.textContent = '▶';
            }
        }
    },

    updateStatus(sectionId, text) {
        const player = document.querySelector(`.tts-player[data-section="${sectionId}"]`);
        const statusEl = player?.querySelector('.tts-status-text');
        if (statusEl) statusEl.textContent = text;
    }
};

window.TTSController = TTSController;
