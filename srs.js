// ========== PHASE 2: SPACED REPETITION SYSTEM (SRS) ==========

/**
 * SM-2 Algorithm Implementation
 * 
 * Each entry will have SRS data:
 * {
 *   easeFactor: 2.5,        // How easy the card is (1.3 - 2.5+)
 *   interval: 0,            // Days until next review
 *   repetitions: 0,         // Number of successful reviews
 *   dueDate: null,          // ISO date string when next review is due
 *   lastReviewed: null      // ISO date string of last review
 * }
 */

// Initialize SRS data for an entry if it doesn't exist
function initSrsData(entry) {
    if (!entry.srs) {
        entry.srs = {
            easeFactor: 2.5,
            interval: 0,
            repetitions: 0,
            dueDate: null,
            lastReviewed: null
        };
    }
    return entry.srs;
}

// Calculate next review using SM-2 algorithm
function calculateNextReview(srs, quality) {
    /**
     * quality: 0-5 rating
     * 0 - Complete blackout
     * 1 - Incorrect, but recognized
     * 2 - Incorrect, but easy to recall
     * 3 - Correct, but difficult
     * 4 - Correct, with hesitation
     * 5 - Perfect recall
     */

    const newSrs = { ...srs };

    // Update ease factor
    newSrs.easeFactor = Math.max(1.3,
        srs.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    // If quality < 3, reset repetitions
    if (quality < 3) {
        newSrs.repetitions = 0;
        newSrs.interval = 1; // Review again tomorrow
    } else {
        newSrs.repetitions += 1;

        // Calculate interval
        if (newSrs.repetitions === 1) {
            newSrs.interval = 1; // 1 day
        } else if (newSrs.repetitions === 2) {
            newSrs.interval = 6; // 6 days
        } else {
            newSrs.interval = Math.round(srs.interval * newSrs.easeFactor);
        }
    }

    // Set due date
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + newSrs.interval);
    newSrs.dueDate = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
    newSrs.lastReviewed = now.toISOString().split('T')[0];

    return newSrs;
}

// Check if an entry is due for review
function isDue(entry) {
    if (!entry.srs || !entry.srs.dueDate) return true; // New cards are always due

    const today = new Date().toISOString().split('T')[0];
    return entry.srs.dueDate <= today;
}

// Get entries that are due for review
function getDueEntries() {
    return savedEntries.filter(isDue);
}

// Get entries by maturity level
function getEntriesByMaturity() {
    const mature = []; // interval >= 21 days
    const young = [];  // interval 1-20 days
    const learning = []; // repetitions = 0

    savedEntries.forEach(entry => {
        const srs = initSrsData(entry);
        if (srs.repetitions === 0) {
            learning.push(entry);
        } else if (srs.interval >= 21) {
            mature.push(entry);
        } else {
            young.push(entry);
        }
    });

    return { mature, young, learning };
}

// Rate a practice attempt and update SRS
function ratePracticeAttempt(entry, quality) {
    const srs = initSrsData(entry);
    const newSrs = calculateNextReview(srs, quality);
    entry.srs = newSrs;
    saveToStorage();
    saveToFirestore();
}

// Auto-calculate quality from accuracy
function calculateQualityFromAccuracy(correctWords, totalWords) {
    if (totalWords === 0) return 0;

    const accuracy = correctWords / totalWords;

    if (accuracy === 1.0) return 5; // Perfect
    if (accuracy >= 0.9) return 4;  // Good
    if (accuracy >= 0.7) return 3;  // Okay
    if (accuracy >= 0.5) return 2;  // Hard
    if (accuracy > 0) return 1;     // Very hard
    return 0; // Failed
}

// Get SRS statistics
function getSrsStats() {
    const { mature, young, learning } = getEntriesByMaturity();
    const due = getDueEntries();

    return {
        total: savedEntries.length,
        due: due.length,
        learning: learning.length,
        young: young.length,
        mature: mature.length
    };
}

// Format interval for display
function formatInterval(days) {
    if (days === 0) return "New";
    if (days === 1) return "1 day";
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
}

// Get next review date display
function getNextReviewDisplay(entry) {
    const srs = initSrsData(entry);
    if (!srs.dueDate) return "Not reviewed yet";

    const today = new Date().toISOString().split('T')[0];
    const due = srs.dueDate;

    if (due < today) return "Overdue!";
    if (due === today) return "Due today";

    const dueDate = new Date(due);
    const todayDate = new Date(today);
    const diffTime = dueDate - todayDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
}

// Export for use in main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initSrsData,
        calculateNextReview,
        isDue,
        getDueEntries,
        getEntriesByMaturity,
        ratePracticeAttempt,
        calculateQualityFromAccuracy,
        getSrsStats,
        formatInterval,
        getNextReviewDisplay
    };
}
