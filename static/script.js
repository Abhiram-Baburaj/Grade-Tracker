const STORAGE_KEY = "gradePlannerState_v2";
let chartInstance = null;
let currentData = null;
let whatIfSimulations = {};
let plannerState = { courses: [], activeCourseId: null };
let newlyAddedCourseId = null;
let tabDragState = null;

function createId(prefix = "item") {
    if (window.crypto && crypto.randomUUID) {
        return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getActiveCourse() {
    if (!plannerState.courses.length) {
        plannerState.courses.push(createCourse("Course 1"));
    }
    const active = plannerState.courses.find(course => course.id === plannerState.activeCourseId);
    if (active) return active;
    plannerState.activeCourseId = plannerState.courses[0].id;
    return plannerState.courses[0];
}

function createCourse(name = "Course", target = 80, passTarget = 50, assignments = []) {
    const course = {
        id: createId("course"),
        name,
        target,
        passTarget,
        assignments: assignments.map(item => ({
            id: createId("assignment"),
            name: item.name || "",
            weight: item.weight ?? "",
            isCompleted: Boolean(item.isCompleted),
            score: item.score ?? "",
            maxScore: item.maxScore ?? "100"
        }))
    };
    plannerState.courses.push(course);
    plannerState.activeCourseId = course.id;
    return course;
}

function persistState() {
    if (window.gradePlannerState && typeof window.gradePlannerState.savePlannerState === "function") {
        window.gradePlannerState.savePlannerState(plannerState);
        return;
    }

    const state = {
        courses: plannerState.courses.map(course => ({
            id: course.id,
            name: course.name,
            target: course.target,
            passTarget: course.passTarget ?? 50,
            assignments: course.assignments.map(item => ({
                id: item.id,
                name: item.name,
                weight: item.weight,
                isCompleted: item.isCompleted,
                score: item.score,
                maxScore: item.maxScore
            }))
        })),
        activeCourseId: plannerState.activeCourseId
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readState() {
    if (window.gradePlannerState && typeof window.gradePlannerState.readPlannerState === "function") {
        const saved = window.gradePlannerState.readPlannerState();
        if (saved && saved.courses && saved.courses.length) {
            return saved;
        }
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
        return {
            courses: [createCourse("Course 1", 80, 50, [])],
            activeCourseId: plannerState.activeCourseId
        };
    }

    try {
        const parsed = JSON.parse(saved);
        if (!parsed.courses || !parsed.courses.length) {
            return {
                courses: [createCourse("Course 1", 80, 50, [])],
                activeCourseId: plannerState.activeCourseId
            };
        }
        return parsed;
    } catch (error) {
        return {
            courses: [createCourse("Course 1", 80, 50, [])],
            activeCourseId: plannerState.activeCourseId
        };
    }
}

function scrollToPlanner() {
    const planner = document.getElementById("planner");
    if (!planner) return;

    const startY = window.scrollY;
    const targetY = planner.getBoundingClientRect().top + window.scrollY - 30;
    const duration = 800;
    const startTime = performance.now();

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        window.scrollTo({ top: startY + (targetY - startY) * eased, behavior: "auto" });

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

function smoothScrollToElement(element, duration = 900, offset = 50) {
    if (!element) return;

    const startY = window.scrollY;
    const targetY = element.getBoundingClientRect().top + window.scrollY - offset;
    const startTime = performance.now();

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutQuart(progress);
        window.scrollTo({ top: startY + (targetY - startY) * eased, behavior: "auto" });

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

function setThemeMetaColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;

    const dark = document.documentElement.classList.contains("dark");
    meta.setAttribute("content", dark ? "#20201d" : "#fdfbf7");
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("gradePlannerDark", isDark ? "1" : "0");
    setThemeMetaColor();
    updateChartTheme();
}

function initTheme() {
    const saved = localStorage.getItem("gradePlannerDark");
    if (saved === "0") {
        document.documentElement.classList.remove("dark");
    } else {
        document.documentElement.classList.add("dark");
        if (saved === null) {
            localStorage.setItem("gradePlannerDark", "1");
        }
    }
    setThemeMetaColor();
}

function getCourseProgressPercent(course) {
    if (!course || !course.assignments || !course.assignments.length) {
        return 0;
    }

    const totalWeight = course.assignments.reduce((sum, item) => {
        const weight = parseFloat(item.weight);
        return Number.isNaN(weight) ? sum : sum + weight;
    }, 0);

    if (totalWeight <= 0) {
        return 0;
    }

    const completedWeight = course.assignments.reduce((sum, item) => {
        const weight = parseFloat(item.weight);
        if (Number.isNaN(weight) || !item.isCompleted) return sum;
        return sum + weight;
    }, 0);

    return Math.min(100, Math.max(0, (completedWeight / totalWeight) * 100));
}

function getCourseProgressColor(percent) {
    if (percent < 35) return "#ef4444";
    if (percent < 70) return "#facc15";
    return "#22c55e";
}

function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
}

function startTabDrag(courseId, event) {
    if (event.button !== undefined && event.button !== 0) return;

    const tabsContainer = document.getElementById("course-tabs");
    if (!tabsContainer) return;

    tabDragState = {
        courseId,
        pointerId: event.pointerId,
        offsetX: 0,
        offsetY: 0,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        velocityX: 0,
        velocityY: 0,
        dragX: 0,
        dragY: 0
    };

    tabsContainer.classList.add("dragging-tabs");
    document.querySelectorAll(".course-tab-wrapper").forEach((wrapper) => {
        wrapper.classList.add("is-jiggling");
    });

    const draggedWrapper = tabsContainer.querySelector(`[data-course-id="${courseId}"]`);
    if (draggedWrapper) {
        const rect = draggedWrapper.getBoundingClientRect();
        tabDragState.offsetX = event.clientX - rect.left;
        tabDragState.offsetY = event.clientY - rect.top;
        draggedWrapper.classList.add("is-dragging");
        draggedWrapper.style.transition = "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease";
        draggedWrapper.style.pointerEvents = "none";
    }

    event.preventDefault();
}

function handleTabPointerMove(event) {
    if (!tabDragState || event.pointerId !== tabDragState.pointerId) return;

    const tabsContainer = document.getElementById("course-tabs");
    if (!tabsContainer) return;

    const draggedWrapper = tabsContainer.querySelector(`[data-course-id="${tabDragState.courseId}"]`);
    if (!draggedWrapper) return;

    const dx = event.clientX - tabDragState.lastX;
    const dy = event.clientY - tabDragState.lastY;

    tabDragState.velocityX = dx * 0.32 + tabDragState.velocityX * 0.68;
    tabDragState.velocityY = dy * 0.32 + tabDragState.velocityY * 0.68;
    tabDragState.dragX += dx;
    tabDragState.dragY += dy;

    const easedX = tabDragState.dragX * 0.28 + tabDragState.velocityX * 0.12;
    const easedY = tabDragState.dragY * 0.28 + tabDragState.velocityY * 0.12;

    draggedWrapper.style.transform = `translate(${easedX}px, ${easedY}px)`;
    draggedWrapper.style.transition = "transform 130ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease";
    draggedWrapper.classList.add("is-dragging");

    tabDragState.lastX = event.clientX;
    tabDragState.lastY = event.clientY;

    const hitWrapper = document.elementFromPoint(event.clientX, event.clientY)?.closest(".course-tab-wrapper");
    if (!hitWrapper || hitWrapper === draggedWrapper) return;

    const sourceIndex = Array.from(tabsContainer.children).findIndex(node => node === draggedWrapper);
    const targetIndex = Array.from(tabsContainer.children).findIndex(node => node === hitWrapper);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const referenceNode = targetIndex > sourceIndex ? hitWrapper.nextElementSibling : hitWrapper;
    tabsContainer.insertBefore(draggedWrapper, referenceNode);

    const reorderedCourses = Array.from(tabsContainer.children)
        .map(node => plannerState.courses.find(course => course.id === node.dataset.courseId))
        .filter(Boolean);

    plannerState.courses = reorderedCourses;
    persistState();
}

function endTabDrag() {
    if (!tabDragState) return;

    const tabsContainer = document.getElementById("course-tabs");
    if (tabsContainer) {
        tabsContainer.classList.remove("dragging-tabs");
    }

    const draggedWrapper = tabsContainer ? tabsContainer.querySelector(`[data-course-id="${tabDragState.courseId}"]`) : null;
    if (draggedWrapper) {
        draggedWrapper.style.transition = "transform 300ms cubic-bezier(0.25, 1, 0.5, 1), box-shadow 300ms ease";
        draggedWrapper.style.transform = "translate(0px, 0px)";
    }

    document.querySelectorAll(".course-tab-wrapper").forEach((wrapper) => {
        wrapper.classList.remove("is-jiggling");
        wrapper.classList.remove("is-dragging");
        wrapper.style.transition = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 260ms ease";
        wrapper.style.pointerEvents = "";
    });

    tabDragState = null;
    renderCourseTabs();
    persistState();
}

function renderCourseTabs() {
    const tabsContainer = document.getElementById("course-tabs");
    if (!tabsContainer) return;

    tabsContainer.innerHTML = "";

    plannerState.courses.forEach((course) => {
        const progressPercent = getCourseProgressPercent(course);
        const progressColor = getCourseProgressColor(progressPercent);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `course-tab ${course.id === plannerState.activeCourseId ? "active" : ""}`;
        button.innerHTML = `
            <span class="course-tab-inner">
                <span class="flex items-center justify-between gap-2 w-full">
                    <span>${escapeHtml(course.name || "Untitled course")}</span>
                    <span class="text-base font-bold">×</span>
                </span>
                <span class="course-progress"><span class="course-progress-fill" style="width: ${progressPercent}%; background: ${progressColor};"></span></span>
            </span>
        `;
        button.onclick = () => {
            plannerState.activeCourseId = course.id;
            renderCourseView();
        };
        button.addEventListener("pointerdown", (event) => {
            if (event.target.closest("button") === button) {
                startTabDrag(course.id, event);
            }
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.textContent = "×";
        removeBtn.className = "ml-2 text-base font-bold opacity-80 hover:opacity-100";
        removeBtn.setAttribute("aria-label", `Remove ${course.name || "course"}`);
        removeBtn.onclick = (event) => {
            event.stopPropagation();
            if (plannerState.courses.length <= 1) {
                clearRows();
                return;
            }
            plannerState.courses = plannerState.courses.filter(item => item.id !== course.id);
            plannerState.activeCourseId = plannerState.courses[0].id;
            renderCourseView();
            persistState();
        };

        const item = document.createElement("div");
        item.className = "course-tab-wrapper";
        item.dataset.courseId = course.id;

        if (course.id === newlyAddedCourseId) {
            item.style.opacity = "0";
            item.style.transform = "translateX(44px) translateY(6px) scale(0.94)";
            item.style.animation = "courseTabIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both";
        }

        const row = document.createElement("div");
        row.className = "flex items-center gap-2";
        row.appendChild(button);
        row.appendChild(removeBtn);

        item.appendChild(row);
        tabsContainer.appendChild(item);
    });
}

function renderCourseView() {
    const activeCourse = getActiveCourse();
    const targetInput = document.getElementById("targetGrade");
    const passTargetInput = document.getElementById("passTarget");
    const courseNameInput = document.getElementById("course-name");
    const resultsContainer = document.getElementById("results-container");

    if (targetInput) {
        targetInput.value = activeCourse.target || 80;
    }

    if (passTargetInput) {
        passTargetInput.value = activeCourse.passTarget ?? 50;
    }

    if (courseNameInput) {
        courseNameInput.value = activeCourse.name || "Course";
    }

    renderCourseTabs();
    renderAssignments();
    updateWeightTotal();
    persistState();

    if (resultsContainer && !resultsContainer.classList.contains("hidden")) {
        calculateGrade(false);
    }
}

function updateCourseName(value) {
    const activeCourse = getActiveCourse();
    activeCourse.name = value.trim() || "Course";
    renderCourseTabs();
    persistState();
}

function addCourse() {
    const nextNumber = plannerState.courses.length + 1;
    const newCourse = createCourse(`Course ${nextNumber}`, 80, []);
    newlyAddedCourseId = newCourse.id;
    renderCourseView();
    persistState();
    setTimeout(() => {
        newlyAddedCourseId = null;
    }, 450);
    scrollToPlanner();
    return newCourse;
}

function setTargetValue(value) {
    const activeCourse = getActiveCourse();
    activeCourse.target = Number(value) || 80;
    persistState();
}

function setPassTargetValue(value) {
    const activeCourse = getActiveCourse();
    activeCourse.passTarget = Number(value) || 50;
    persistState();
}

function clampTarget(input) {
    if (input.value === "") return;
    input.value = Math.max(1, Math.min(100, Number(input.value)));
    setTargetValue(input.value);
    persistState();
}

function clampPassTarget(input) {
    if (input.value === "") return;
    input.value = Math.max(0, Math.min(100, Number(input.value)));
    setPassTargetValue(input.value);
    persistState();
}

function updateWeightTotal() {
    const activeCourse = getActiveCourse();
    let total = 0;
    activeCourse.assignments.forEach(item => {
        const value = parseFloat(item.weight);
        if (!Number.isNaN(value)) total += value;
    });

    const badge = document.getElementById("weight-total");
    if (!badge) return;

    badge.textContent = `${Number(total.toFixed(1))}% of course`;

    if (total > 100) {
        badge.style.background = "#ff4d4d";
        badge.style.color = "white";
    } else {
        badge.style.background = "";
        badge.style.color = "";
    }
}

function buildAssignmentRow(item) {
    const disabled = item.isCompleted ? "" : "disabled";
    return `
        <div class="assignment-row assignment-grid p-3 md:p-4" data-assignment-id="${item.id}">
            <div class="flex justify-center">
                <input
                    type="checkbox"
                    class="is-completed h-6 w-6 cursor-pointer accent-[#ff4d4d]"
                    ${item.isCompleted ? "checked" : ""}
                    onchange="toggleScoreInput(this); updateWeightTotal(); saveState();"
                    aria-label="Assignment completed"
                >
            </div>

            <div class="name-wrap">
                <label class="mobile-label mb-1 text-sm font-bold opacity-55">Assignment name</label>
                <input type="text" placeholder="e.g. Final Exam" value="${escapeHtml(item.name)}" class="sketch-input name" oninput="saveState()">
            </div>

            <div class="weight-wrap">
                <label class="mobile-label mb-1 text-sm font-bold opacity-55">Weight %</label>
                <input type="number" min="0" max="100" placeholder="10" value="${item.weight}" class="sketch-input weight" oninput="updateWeightTotal(); saveState()">
            </div>

            <div class="score-wrap">
                <label class="mobile-label mb-1 text-sm font-bold opacity-55">Your mark</label>
                <input type="number" min="0" placeholder="—" value="${item.score}" class="sketch-input score" ${disabled} oninput="saveState()">
            </div>

            <span class="slash text-center text-2xl font-bold opacity-50">/</span>

            <div class="max-wrap">
                <label class="mobile-label mb-1 text-sm font-bold opacity-55">Max mark</label>
                <input type="number" min="1" placeholder="100" value="${item.maxScore}" class="sketch-input max-score" oninput="saveState()">
            </div>

            <div class="delete-wrap flex justify-center items-center gap-1">
                <button
                    type="button"
                    onclick="duplicateRow(this)"
                    class="icon-circle !h-8 !w-8 text-sm hover:bg-[#2d5da1] hover:text-white"
                    aria-label="Duplicate assignment"
                    title="Duplicate assignment"
                >✦</button>
                <button
                    type="button"
                    onclick="deleteRow(this)"
                    class="icon-circle !h-8 !w-8 text-sm hover:bg-[#ff4d4d] hover:text-white"
                    aria-label="Delete assignment"
                    title="Delete assignment"
                >✕</button>
            </div>
        </div>
    `;
}

function renderAssignments() {
    const activeCourse = getActiveCourse();
    const list = document.getElementById("components-list");
    if (!list) return;

    list.innerHTML = activeCourse.assignments.map(buildAssignmentRow).join("");
    updateWeightTotal();
}

function addRow(name = "", weight = "", isCompleted = false, score = "", maxScore = "100") {
    const activeCourse = getActiveCourse();
    activeCourse.assignments.push({
        id: createId("assignment"),
        name,
        weight,
        isCompleted,
        score,
        maxScore
    });
    renderAssignments();
    persistState();
}

function toggleScoreInput(checkbox) {
    const row = checkbox.closest(".assignment-row");
    const assignment = getActiveCourse().assignments.find(item => item.id === row.dataset.assignmentId);
    if (!assignment) return;

    assignment.isCompleted = checkbox.checked;
    const scoreInput = row.querySelector(".score");
    scoreInput.disabled = !checkbox.checked;
    if (!checkbox.checked) scoreInput.value = "";
    assignment.score = scoreInput.value;
    persistState();
    renderCourseTabs();
}

function duplicateRow(button) {
    const row = button.closest(".assignment-row");
    const assignment = getActiveCourse().assignments.find(item => item.id === row.dataset.assignmentId);
    if (!assignment) return;

    getActiveCourse().assignments.push({
        ...assignment,
        id: createId("assignment"),
        name: `${assignment.name} (Copy)`
    });

    renderAssignments();
    persistState();
}

function deleteRow(button) {
    const row = button.closest(".assignment-row");
    const assignmentId = row.dataset.assignmentId;
    const activeCourse = getActiveCourse();
    activeCourse.assignments = activeCourse.assignments.filter(item => item.id !== assignmentId);
    renderAssignments();
    persistState();
    if (document.getElementById("results-container") && !document.getElementById("results-container").classList.contains("hidden")) {
        calculateGrade(false);
    }
}

function clearRows() {
    const activeCourse = getActiveCourse();
    activeCourse.assignments = [];
    renderAssignments();
    const resultsContainer = document.getElementById("results-container");
    if (resultsContainer) {
        resultsContainer.classList.add("hidden");
    }
    setExportButtonVisibility(false);
    hideError();

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }
    persistState();
}

function loadSampleData() {
    const activeCourse = getActiveCourse();
    activeCourse.name = "Sample Course";
    activeCourse.target = 85;
    activeCourse.passTarget = 50;
    activeCourse.assignments = [
        { id: createId("assignment"), name: "Assignment 1", weight: 10, isCompleted: true, score: 18, maxScore: 20 },
        { id: createId("assignment"), name: "Midterm Test", weight: 30, isCompleted: true, score: 42, maxScore: 50 },
        { id: createId("assignment"), name: "Lab Presentation", weight: 15, isCompleted: false, score: "", maxScore: 100 },
        { id: createId("assignment"), name: "Final Exam", weight: 45, isCompleted: false, score: "", maxScore: 100 }
    ];

    renderCourseView();
    persistState();
    calculateGrade();
    scrollToPlanner();
}

function saveState() {
    const activeCourse = getActiveCourse();
    if (!activeCourse) return;

    const rows = document.querySelectorAll("#components-list > .assignment-row");
    rows.forEach(row => {
        const assignment = activeCourse.assignments.find(item => item.id === row.dataset.assignmentId);
        if (!assignment) return;

        const nameInput = row.querySelector(".name");
        const weightInput = row.querySelector(".weight");
        const scoreInput = row.querySelector(".score");
        const maxScoreInput = row.querySelector(".max-score");
        const checkbox = row.querySelector(".is-completed");

        assignment.name = nameInput.value;
        assignment.weight = weightInput.value;
        assignment.isCompleted = checkbox.checked;
        assignment.score = scoreInput.value;
        assignment.maxScore = maxScoreInput.value;
    });

    const targetInput = document.getElementById("targetGrade");
    if (targetInput) {
        activeCourse.target = Number(targetInput.value) || 80;
    }

    const passTargetInput = document.getElementById("passTarget");
    if (passTargetInput) {
        activeCourse.passTarget = Number(passTargetInput.value) || 50;
    }

    const courseNameInput = document.getElementById("course-name");
    if (courseNameInput) {
        activeCourse.name = courseNameInput.value.trim() || "Course";
    }

    persistState();
    updateWeightTotal();
    renderCourseTabs();
}

function loadState() {
    const saved = readState();
    plannerState = saved;
    if (!plannerState.activeCourseId || !plannerState.courses.some(course => course.id === plannerState.activeCourseId)) {
        plannerState.activeCourseId = plannerState.courses[0].id;
    }
    renderCourseView();
    setExportButtonVisibility(false);
}

function setExportButtonVisibility(visible) {
    const exportBtn = document.getElementById("export-btn-bottom");
    if (!exportBtn) return;

    if (visible) {
        exportBtn.classList.remove("hidden");
        exportBtn.setAttribute("aria-hidden", "false");
    } else {
        exportBtn.classList.add("hidden");
        exportBtn.setAttribute("aria-hidden", "true");
    }
}

function showError(message) {
    const box = document.getElementById("error-msg");
    if (!box) return;
    box.textContent = message;
    box.classList.remove("hidden");
}

function hideError() {
    const box = document.getElementById("error-msg");
    if (box) box.classList.add("hidden");
}

function animateNumber(element, start, end, duration, formatFn = val => val) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        const current = start + (end - start) * ease;
        element.textContent = formatFn(current);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = formatFn(end);
        }
    };
    window.requestAnimationFrame(step);
}

async function calculateGrade(showErrorMessage = true) {
    hideError();
    const activeCourse = getActiveCourse();
    const rows = document.querySelectorAll("#components-list > .assignment-row");
    const components = [];
    const chartLabels = [];
    const chartData = [];
    const validRows = [];

    rows.forEach(row => {
        const assignment = activeCourse.assignments.find(item => item.id === row.dataset.assignmentId);
        if (!assignment) return;

        const done = row.querySelector(".is-completed").checked;
        const name = row.querySelector(".name").value.trim() || "Unnamed assignment";
        const weight = parseFloat(row.querySelector(".weight").value);
        const score = parseFloat(row.querySelector(".score").value);
        const maxScore = parseFloat(row.querySelector(".max-score").value);

        if (!Number.isNaN(weight) && !Number.isNaN(maxScore)) {
            components.push({
                name,
                weight,
                max_score: maxScore,
                is_completed: done,
                score: done ? (Number.isNaN(score) ? 0 : score) : 0
            });
            validRows.push({ name, weight });
        }
    });

    const target = parseFloat(document.getElementById("targetGrade").value);
    if (!components.length) {
        if (showErrorMessage) showError("Add at least one assignment first.");
        return;
    }

    try {
        const data = window.gradeCalculator.calculateGradeData({ target, components });

        currentData = data;
        validRows.sort((a, b) => a.weight - b.weight);
        validRows.forEach((item) => {
            chartLabels.push(item.name);
            chartData.push(item.weight);
        });

        const resultsContainer = document.getElementById("results-container");
        if (resultsContainer) {
            resultsContainer.classList.remove("hidden");
            resultsContainer.classList.remove("fade-up");
            void resultsContainer.offsetWidth;
            resultsContainer.classList.add("fade-up");
        }

        setExportButtonVisibility(true);

        animateNumber(document.getElementById("current-score"), 0, data.current_score, 1000, value => `${value.toFixed(2)}%`);
        animateNumber(document.getElementById("remaining-weight"), 0, data.remaining_weight, 1000, value => `${value.toFixed(2)}%`);

        const neededElement = document.getElementById("needed-percentage");
        animateNumber(neededElement, 0, data.already_reached ? 0 : data.needed_percentage, 1000, value => `${value.toFixed(2)}%`);

        document.getElementById("completed-weight-label").textContent = `${data.completed_weight}%`;
        document.getElementById("completed-progress").style.width = `${Math.min(100, data.completed_weight)}%`;
        document.getElementById("target-summary").textContent = `${data.target}%`;
        document.getElementById("maximum-summary").textContent = `${data.maximum_possible}%`;

        const statusCard = document.getElementById("status-card");
        const statusLabel = document.getElementById("status-label");
        const statusTitle = document.getElementById("status-title");
        const statusValue = document.getElementById("status-value");
        const statusDescription = document.getElementById("status-description");

        statusCard.classList.remove("result-good", "result-warning");

        if (data.already_reached) {
            statusCard.classList.add("result-good");
            statusLabel.textContent = "Target reached ✓";
            statusTitle.textContent = "You are already there!";
            statusValue.textContent = `${data.current_score}%`;
            statusDescription.textContent = "Your current earned score has already reached the target. Remaining marks can only improve your final result.";
        } else if (data.achievable) {
            statusCard.classList.add("result-good");
            statusLabel.textContent = "Target looks achievable";
            statusTitle.textContent = `Aim for ${data.needed_percentage}% from here.`;
            statusValue.textContent = `${data.target}%`;
            statusDescription.textContent = `You have ${data.remaining_weight}% of the course left. Keep this number in mind when you study.`;
        } else {
            statusCard.classList.add("result-warning");
            statusLabel.textContent = "Target is currently out of reach";
            statusTitle.textContent = "You would need more than 100%.";
            statusValue.textContent = `${data.maximum_possible}% max`;
            statusDescription.textContent = `Even with perfect marks on everything remaining, your final grade would be about ${data.maximum_possible}%.`;
        }

        renderBreakdown(data);
        renderWhatIfScenarios(data);
        updateChart(chartLabels, chartData);

        setTimeout(() => {
            const resultsContainerNode = document.getElementById("results-container");
            if (resultsContainerNode) {
                smoothScrollToElement(resultsContainerNode, 900, 80);
            }
        }, 100);
    } catch (error) {
        if (showErrorMessage) {
            showError(error && error.message ? error.message : "Unable to calculate your grade.");
        }
    }
}

function renderBreakdown(data) {
    const list = document.getElementById("breakdown-list");
    if (!list) return;
    list.innerHTML = "";

    data.breakdown.forEach((item, index) => {
        const percentage = item.needed_percentage;
        const impossible = percentage > 100;

        const card = document.createElement("div");
        card.className = "paper-card-soft flex flex-col gap-2 p-4 mb-3";
        card.innerHTML = `
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <p class="text-xl font-bold">${escapeHtml(item.name)}</p>
                    <p class="text-base opacity-60">${item.weight}% of final grade</p>
                </div>
                <div class="text-left md:text-right">
                    <p class="text-3xl font-bold ${impossible ? "text-[#ff4d4d]" : ""}">
                        <span id="whatif-marks-${index}">${item.needed_marks.toFixed(2)}</span> / ${item.max_score}
                    </p>
                    <p class="text-base opacity-60">
                        ${impossible ? "above the available maximum" : `${percentage}% target`}
                    </p>
                </div>
            </div>
            <div class="slider-container mt-2">
                <p class="text-sm font-bold opacity-75 mb-1">What if I get: <span id="whatif-pct-${index}">${percentage.toFixed(2)}</span>%</p>
                <input type="range" class="what-if-slider" min="0" max="100" value="${Math.min(100, Math.max(0, percentage))}" oninput="updateWhatIfSlider(this, ${index}, this.value, ${item.max_score}, ${item.weight})">
            </div>
        `;
        list.appendChild(card);
    });
}

function updateWhatIfSlider(slider, index, percentageVal, maxScore, weight) {
    const marks = (percentageVal / 100) * maxScore;
    const pctEl = document.getElementById(`whatif-pct-${index}`);
    const marksEl = document.getElementById(`whatif-marks-${index}`);
    const value = Math.min(100, Math.max(0, Number(percentageVal) || 0));

    if (pctEl) pctEl.textContent = Number(value).toFixed(2);
    if (marksEl) marksEl.textContent = marks.toFixed(2);

    if (slider) {
        slider.style.setProperty("--slider-thumb-color", "var(--pencil)");
        slider.style.background = "var(--muted)";
        slider.style.backgroundSize = "100% 100%";
        slider.style.backgroundRepeat = "no-repeat";
        slider.style.backgroundPosition = "left center";
    }

    whatIfSimulations[index] = { percentage: value, weight };
    recalculateWhatIfTotal();
}

function recalculateWhatIfTotal() {
    if (!currentData) return;

    let simulatedUncompleted = 0;
    currentData.breakdown.forEach((item, index) => {
        const pct = whatIfSimulations[index] ? whatIfSimulations[index].percentage : currentData.needed_percentage;
        simulatedUncompleted += (pct / 100) * item.weight;
    });

    const finalProj = currentData.current_score + simulatedUncompleted;
    const whatIfEl = document.getElementById("whatif-final-score");
    if (whatIfEl) {
        whatIfEl.textContent = `${finalProj.toFixed(2)}%`;

        const baseMin = 0;
        const baseMax = 100;
        const targetScore = Number(currentData.target ?? 80);
        const passScore = Number(getActiveCourse().passTarget ?? 50);

        const worstValue = Math.min(baseMin, passScore, targetScore);
        const bestValue = Math.max(baseMax, passScore, targetScore);
        const normalized = Math.max(0, Math.min(1, (finalProj - worstValue) / Math.max(1, bestValue - worstValue)));

        const hueStart = { r: 239, g: 68, b: 68 };
        const mid = { r: 250, g: 204, b: 21 };
        const hueEnd = { r: 34, g: 197, b: 94 };

        let r;
        let g;
        let b;

        if (normalized < 0.5) {
            const t = normalized / 0.5;
            r = Math.round(hueStart.r + (mid.r - hueStart.r) * t);
            g = Math.round(hueStart.g + (mid.g - hueStart.g) * t);
            b = Math.round(hueStart.b + (mid.b - hueStart.b) * t);
        } else {
            const t = (normalized - 0.5) / 0.5;
            r = Math.round(mid.r + (hueEnd.r - mid.r) * t);
            g = Math.round(mid.g + (hueEnd.g - mid.g) * t);
            b = Math.round(mid.b + (hueEnd.b - mid.b) * t);
        }

        whatIfEl.style.color = `rgb(${r}, ${g}, ${b})`;
    }
}

function renderWhatIfScenarios(data) {
    whatIfSimulations = {};
    const container = document.getElementById("whatif-scenarios-container");
    if (!container) return;

    if (data.remaining_weight <= 0) {
        container.innerHTML = "<p class='opacity-60'>All assignments completed.</p>";
        return;
    }

    const currentAvg = data.completed_weight > 0 ? (data.current_score / data.completed_weight) * 100 : 0;
    const bestCase = data.current_score + data.remaining_weight;
    const expectedCase = data.current_score + (currentAvg / 100) * data.remaining_weight;
    const worstCase = data.current_score;

    container.innerHTML = `
        <div class="flex flex-col gap-3">
            <div class="paper-card-soft p-3 result-good">
                <span class="font-bold">Best Case (100% on remaining):</span> ${bestCase.toFixed(2)}%
            </div>
            <div class="paper-card-soft p-3" style="border-color: var(--blue)">
                <span class="font-bold">Expected Case (~${currentAvg.toFixed(1)}% on remaining):</span> ${expectedCase.toFixed(2)}%
            </div>
            <div class="paper-card-soft p-3 result-warning">
                <span class="font-bold">Worst Case (0% on remaining):</span> ${worstCase.toFixed(2)}%
            </div>
            <div class="paper-card-soft p-3 sticky mt-2">
                <span class="font-bold">Simulated Final Grade (from sliders):</span>
                <span id="whatif-final-score" class="text-2xl font-bold">${data.target}%</span>
            </div>
        </div>
    `;
}

function updateChart(labels, data) {
    const canvas = document.getElementById("weightChart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (chartInstance) chartInstance.destroy();

    const dark = document.documentElement.classList.contains("dark");
    const pencil = dark ? "#f5f0e8" : "#2d2d2d";
    const paper = dark ? "#2c2b27" : "#ffffff";

    const colors = data.map((_, index) => {
        const max = data.length - 1 || 1;
        const ratio = max === 0 ? 1 : index / max;
        const lightness = 70 - (ratio * 40);
        return `hsl(0, 100%, ${lightness}%)`;
    });

    chartInstance = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderWidth: 3,
                borderColor: paper
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: 0,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: pencil,
                        font: {
                            family: "Patrick Hand",
                            size: 16
                        },
                        padding: 14,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

function updateChartTheme() {
    if (!chartInstance) return;

    const dark = document.documentElement.classList.contains("dark");
    chartInstance.options.plugins.legend.labels.color = dark ? "#f5f0e8" : "#2d2d2d";
    chartInstance.data.datasets[0].borderColor = dark ? "#2c2b27" : "#ffffff";
    chartInstance.update();
}

async function exportToPDF() {
    const exportBtn = document.getElementById("export-btn-bottom");
    const originalText = exportBtn ? exportBtn.innerHTML : "📄 Export Full Report as PDF";
    const isDark = document.documentElement.classList.contains("dark");
    const palette = {
        bg: isDark ? "#1f1e1c" : "#fdfbf7",
        panel: isDark ? "#2b2926" : "#ffffff",
        panelAlt: isDark ? "#1a1917" : "#f8f6f1",
        border: isDark ? "#f5f0e8" : "#2d2d2d",
        ink: isDark ? "#f5f0e8" : "#2d2d2d",
        muted: isDark ? "#d9d1c5" : "#555555",
        soft: isDark ? "#bfb5a7" : "#888888",
        gold: isDark ? "#4d4320" : "#fff9c4",
        red: isDark ? "#ff8a8a" : "#ff4d4d",
        blue: isDark ? "#8fb9ff" : "#2d5da1",
        green: isDark ? "#86d9a4" : "#28a745",
        successBg: isDark ? "#123a2c" : "#d4edda",
        successText: isDark ? "#dbf8e6" : "#155724",
        successBorder: isDark ? "#57b98b" : "#28a745",
        todoBg: isDark ? "#173559" : "#d6eaf8",
        todoText: isDark ? "#dfefff" : "#0d47a1",
        todoBorder: isDark ? "#7caef1" : "#2d5da1",
        divider: isDark ? "#564f46" : "#dddddd",
        contrast: isDark ? "#f8f0c6" : "#2d2d2d"
    };

    try {
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = "⏳ Generating PDF...";
        }

        if (!currentData) {
            await calculateGrade(true);
            if (!currentData) {
                if (exportBtn) {
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = originalText;
                }
                return;
            }
        }

        const activeCourse = getActiveCourse();
        const courseName = activeCourse && activeCourse.name ? activeCourse.name : "Course";
        const safeCourseName = courseName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "Course";
        const assignments = [];
        document.querySelectorAll("#components-list > .assignment-row").forEach(row => {
            const done = row.querySelector(".is-completed").checked;
            const name = row.querySelector(".name").value.trim() || "Unnamed";
            const weight = parseFloat(row.querySelector(".weight").value) || 0;
            const score = parseFloat(row.querySelector(".score").value);
            const maxScore = parseFloat(row.querySelector(".max-score").value) || 100;
            assignments.push({
                name,
                weight,
                done,
                score: done ? (Number.isNaN(score) ? 0 : score) : null,
                maxScore
            });
        });

        const chartImg = chartInstance ? chartInstance.toBase64Image() : null;
        const currentAvg = currentData.completed_weight > 0 ? (currentData.current_score / currentData.completed_weight) * 100 : 0;
        const bestCase = (currentData.current_score + currentData.remaining_weight).toFixed(1);
        const expectedCase = (currentData.current_score + (currentAvg / 100) * currentData.remaining_weight).toFixed(1);
        const worstCase = currentData.current_score.toFixed(1);
        const whatIfEl = document.getElementById("whatif-final-score");
        const simScore = whatIfEl ? whatIfEl.textContent : `${currentData.target}%`;
        const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

        const tRows = assignments.map((a, i) => {
            const bd = currentData.breakdown.find(item => item.name === a.name);
            const need = bd ? `${bd.needed_marks} / ${bd.max_score}` : "—";
            const needPct = bd ? `${bd.needed_percentage}%` : "";
            const rowBg = i % 2 === 0 ? palette.panel : palette.panelAlt;
            const statusBg = a.done ? palette.successBg : palette.todoBg;
            const statusClr = a.done ? palette.successText : palette.todoText;
            const statusBrd = a.done ? palette.successBorder : palette.todoBorder;
            const statusTxt = a.done ? "DONE ✓" : "TO DO";
            const scoreCol = a.done
                ? `<b>${a.score}</b> / ${a.maxScore} (${((a.score / a.maxScore) * 100).toFixed(0)}%)`
                : `<span style="color:${palette.red};font-weight:bold">${need}</span> (${needPct})`;

            return `<tr style="background:${rowBg}"><td style="padding:6px 8px;border-bottom:1px solid ${palette.divider}"><span style="display:inline-block;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:999px 18px 999px 18px / 18px 999px 18px 999px;background:${statusBg};color:${statusClr};border:2px solid ${statusBrd};letter-spacing:0.3px;">${statusTxt}</span></td><td style="padding:6px 8px;border-bottom:1px solid ${palette.divider};font-weight:bold;color:${palette.ink}">${escapeHtml(a.name)}</td><td style="padding:6px 8px;border-bottom:1px solid ${palette.divider};text-align:center;color:${palette.ink}">${a.weight}%</td><td style="padding:6px 8px;border-bottom:1px solid ${palette.divider};text-align:right;color:${palette.ink}">${scoreCol}</td></tr>`;
        }).join("");

        const overlay = document.createElement("div");
        overlay.id = "pdf-render-overlay";
        overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;background:${palette.bg};overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:0;`;

        const report = document.createElement("div");
        report.style.cssText = `width:210mm;min-height:297mm;padding:11mm 10mm 7mm;background:${palette.bg};color:${palette.ink};font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;`;

        report.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px dashed ${palette.border};padding-bottom:9px;gap:14px;">
                <div style="flex:1;min-width:0;">
                    <div style="display:inline-block;background:${palette.gold};border:2px solid ${palette.border};padding:3px 10px;font-weight:bold;font-size:12px;margin-bottom:5px;color:${palette.contrast};border-radius:18px 10px 16px 12px / 10px 18px 10px 18px;">STUDENT GRADE REPORT</div>
                    <div style="font-size:26px;font-weight:bold;color:${palette.ink};line-height:1.1;margin-top:2px">${escapeHtml(courseName)}</div>
                    <div style="font-size:13px;color:${palette.muted};margin-top:5px">Target: <b>${currentData.target}%</b> &nbsp;|&nbsp; Date: <b>${today}</b></div>
                </div>
                <div style="display:inline-block;background:${palette.panel};border:3px solid ${palette.border};border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:10px 14px;text-align:center;min-width:76px;">
                    <div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:${palette.blue}">TARGET</div>
                    <div style="font-size:25px;font-weight:bold;color:${palette.red};line-height:1">${currentData.target}%</div>
                </div>
            </div>

            <div style="background:${palette.panel};border:3px solid ${currentData.achievable ? palette.blue : palette.red};border-radius:18px 10px 16px 12px / 10px 18px 10px 18px;padding:11px 14px;">
                <div style="font-size:11px;font-weight:bold;text-transform:uppercase;color:${currentData.achievable ? palette.blue : palette.red}">${currentData.already_reached ? "TARGET REACHED ✓" : currentData.achievable ? "TARGET ACHIEVABLE ✓" : "OUT OF REACH ⚠"}</div>
                <div style="font-size:18px;font-weight:bold;margin:5px 0;color:${palette.ink}">${currentData.already_reached ? "You have already reached your goal!" : currentData.achievable ? "Aim for " + currentData.needed_percentage + "% average on remaining work." : "Target requires over 100% on remaining assignments."}</div>
                <div style="font-size:12px;color:${palette.muted}">${currentData.already_reached ? "Earned marks meet or exceed your target." : currentData.achievable ? "You have " + currentData.remaining_weight + "% of the course left." : "Maximum possible: " + currentData.maximum_possible + "%."}</div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,auto));gap:7px;">
                <div style="border:2px solid ${palette.border};border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:10px 8px;text-align:center;background:${palette.panel};">
                    <div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:${palette.soft}">Current</div>
                    <div style="font-size:23px;font-weight:bold;color:${palette.blue}">${currentData.current_score}%</div>
                    <div style="font-size:10px;color:${palette.soft}">earned</div>
                </div>
                <div style="border:2px solid ${palette.border};border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:10px 8px;text-align:center;background:${palette.panel};">
                    <div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:${palette.soft}">Remaining</div>
                    <div style="font-size:23px;font-weight:bold;color:${palette.ink}">${currentData.remaining_weight}%</div>
                    <div style="font-size:10px;color:${palette.soft}">weight left</div>
                </div>
                <div style="border:2px solid ${palette.border};border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:10px 8px;text-align:center;background:${palette.gold};">
                    <div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:${palette.soft}">Needed Avg</div>
                    <div style="font-size:23px;font-weight:bold;color:${palette.red}">${currentData.already_reached ? 0 : currentData.needed_percentage}%</div>
                    <div style="font-size:10px;color:${palette.soft}">on remaining</div>
                </div>
                <div style="border:2px solid ${palette.border};border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:10px 8px;text-align:center;background:${palette.panel};">
                    <div style="font-size:10px;font-weight:bold;text-transform:uppercase;color:${palette.soft}">Max Possible</div>
                    <div style="font-size:23px;font-weight:bold;color:${palette.ink}">${currentData.maximum_possible}%</div>
                    <div style="font-size:10px;color:${palette.soft}">if 100% rest</div>
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:12px;flex:1;">
                <div>
                    <div style="font-size:17px;font-weight:bold;margin:0 0 7px 0;color:${palette.ink}">Course Checklist</div>
                    <table style="width:100%;border-collapse:collapse;border:2px solid ${palette.border};background:${palette.panel};table-layout:fixed;border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;overflow:hidden;">
                        <thead><tr style="background:${palette.panelAlt}">
                            <th style="padding:6px 7px;border-bottom:2px solid ${palette.border};text-align:left;font-size:11px;color:${palette.ink};width:18%">Status</th>
                            <th style="padding:6px 7px;border-bottom:2px solid ${palette.border};text-align:left;font-size:11px;color:${palette.ink};width:42%">Assignment</th>
                            <th style="padding:6px 7px;border-bottom:2px solid ${palette.border};text-align:center;font-size:11px;color:${palette.ink};width:16%">Weight</th>
                            <th style="padding:6px 7px;border-bottom:2px solid ${palette.border};text-align:right;font-size:11px;color:${palette.ink};width:24%">Score / Target</th>
                        </tr></thead>
                        <tbody>${tRows}</tbody>
                    </table>
                </div>

                <div style="display:grid;grid-template-columns:1.15fr 0.85fr;gap:10px;align-items:start;">
                    ${chartImg ? '<div style="background:' + palette.panel + ';border:2px solid ' + palette.border + ';border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:9px;text-align:center;min-height:180px"><div style="font-size:14px;font-weight:bold;margin-bottom:5px;color:' + palette.ink + '">Weight Distribution</div><img src="' + chartImg + '" style="width:180px;height:auto;display:block;margin:0 auto;max-width:100%;" /></div>' : ""}
                    <div style="background:${palette.panel};border:2px solid ${palette.border};border-radius:18px 8px 16px 10px / 8px 18px 10px 18px;padding:11px;min-height:180px;">
                        <div style="font-size:14px;font-weight:bold;margin-bottom:7px;color:${palette.ink}">Forecast Scenarios</div>
                        <div style="font-size:12px;color:${palette.ink}">
                            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed ${palette.divider}"><span><b>Best</b> (100%):</span><b style="color:${palette.green}">${bestCase}%</b></div>
                            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed ${palette.divider}"><span><b>Expected</b>:</span><b style="color:${palette.blue}">${expectedCase}%</b></div>
                            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed ${palette.divider}"><span><b>Worst</b> (0%):</span><b style="color:${palette.red}">${worstCase}%</b></div>
                            <div style="display:flex;justify-content:space-between;padding:5px 6px;margin-top:7px;background:${palette.gold};border:2px solid ${palette.border};border-radius:999px 18px 999px 18px / 18px 999px 18px 999px;color:${palette.contrast}"><span><b>Simulated:</b></span><b style="color:${palette.red}">${simScore}</b></div>
                        </div>
                    </div>
                </div>
            </div>

            <div style="margin-top:auto;border-top:2px dashed ${palette.border};padding-top:8px;text-align:center;font-size:11px;color:${palette.soft}">
                Generated by Grade Tracker
            </div>`;

        overlay.appendChild(report);
        document.body.appendChild(overlay);

        await new Promise(resolve => setTimeout(resolve, 500));

        await html2pdf().set({
            margin: [5, 5, 5, 5],
            filename: `Grade_Plan_${safeCourseName}.pdf`,
            image: { type: "jpeg", quality: 0.95 },
            pagebreak: { mode: ['css', 'legacy'] },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: palette.bg,
                logging: false,
                width: 794,
                scrollX: 0,
                scrollY: 0
            },
            jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
        }).from(report).save();

        overlay.remove();
    } catch (error) {
        console.error("PDF Export Error:", error);
        showError("PDF export failed: " + error.message);
    } finally {
        const leftover = document.getElementById("pdf-render-overlay");
        if (leftover) leftover.remove();
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalText;
        }
    }
}

window.addEventListener("pointermove", handleTabPointerMove);
window.addEventListener("pointerup", endTabDrag);
window.addEventListener("pointercancel", endTabDrag);

window.onload = () => {
    initTheme();
    loadState();
};

