(function () {
    'use strict';

    function round(value) {
        return Number(value.toFixed(2));
    }

    function calculateGradeData({ target, components }) {
        const numericTarget = Number(target);

        if (!Number.isFinite(numericTarget) || numericTarget <= 0 || numericTarget > 100) {
            throw new Error('Target grade must be between 1 and 100.');
        }

        let currentScore = 0;
        let completedWeight = 0;
        let uncompletedWeight = 0;
        const uncompletedItems = [];

        for (const comp of components || []) {
            const weight = Number(comp.weight || 0);
            const maxScore = Number(comp.max_score || 0);
            const isCompleted = Boolean(comp.is_completed);

            if (weight < 0 || maxScore <= 0) {
                throw new Error('Weights must be 0 or more and maximum marks must be greater than 0.');
            }

            if (isCompleted) {
                const score = Number(comp.score || 0);
                if (score < 0 || score > maxScore) {
                    throw new Error(`Score for ${comp.name || 'an assignment'} must be between 0 and its maximum mark.`);
                }

                currentScore += (score / maxScore) * weight;
                completedWeight += weight;
            } else {
                uncompletedWeight += weight;
                uncompletedItems.push({
                    name: comp.name || 'Unnamed',
                    max_score: maxScore,
                    weight
                });
            }
        }

        const totalWeight = completedWeight + uncompletedWeight;
        if (totalWeight > 100.0001) {
            throw new Error('Total assignment weight cannot exceed 100%.');
        }

        if (uncompletedWeight <= 0) {
            throw new Error('Add at least one uncompleted assignment to calculate the marks you need.');
        }

        const neededWeightedScore = numericTarget - currentScore;
        const neededPercentage = neededWeightedScore / uncompletedWeight;
        const achievable = neededPercentage <= 1;
        const alreadyReached = neededWeightedScore <= 0;

        const breakdown = uncompletedItems.map((item) => ({
            name: item.name,
            needed_marks: round(Math.max(0, neededPercentage) * item.max_score),
            max_score: item.max_score,
            weight: item.weight,
            needed_percentage: round(Math.max(0, neededPercentage) * 100, 2)
        }));

        return {
            current_score: round(currentScore),
            completed_weight: round(completedWeight),
            remaining_weight: round(uncompletedWeight),
            needed_percentage: round(Math.max(0, neededPercentage) * 100, 2),
            target: round(numericTarget, 2),
            achievable,
            already_reached: alreadyReached,
            maximum_possible: round(currentScore + uncompletedWeight),
            breakdown
        };
    }

    window.gradeCalculator = {
        calculateGradeData
    };
})();
