(function () {
    'use strict';

    const STORAGE_KEY = 'gradePlannerState_v2';

    function createId(prefix = 'item') {
        if (window.crypto && crypto.randomUUID) {
            return `${prefix}-${crypto.randomUUID()}`;
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function createCourse(name = 'Course', target = 80, passTarget = 50, assignments = []) {
        return {
            id: createId('course'),
            name,
            target,
            passTarget,
            assignments: assignments.map(item => ({
                id: createId('assignment'),
                name: item.name || '',
                weight: item.weight ?? '',
                isCompleted: Boolean(item.isCompleted),
                score: item.score ?? '',
                maxScore: item.maxScore ?? '100'
            }))
        };
    }

    function savePlannerState(plannerState) {
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

    function readPlannerState() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return {
                courses: [createCourse('Course 1', 80, 50, [])],
                activeCourseId: null
            };
        }

        try {
            const parsed = JSON.parse(saved);
            if (!parsed.courses || !parsed.courses.length) {
                return {
                    courses: [createCourse('Course 1', 80, 50, [])],
                    activeCourseId: null
                };
            }
            return parsed;
        } catch (error) {
            return {
                courses: [createCourse('Course 1', 80, 50, [])],
                activeCourseId: null
            };
        }
    }

    window.gradePlannerState = {
        STORAGE_KEY,
        createId,
        escapeHtml,
        createCourse,
        savePlannerState,
        readPlannerState
    };
})();
