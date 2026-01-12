// ========== PHASE 3: ANALYTICS & STATISTICS ==========

let progressChart = null;
let accuracyChart = null;
let studyTimeTracker = {
    startTime: null,
    totalMinutes: 0
};

// Initialize analytics when tab is opened
function initAnalytics() {
    updateQuickStats();
    renderProgressChart();
    renderAccuracyChart();
    renderStudyHeatmap();
    renderWeakSpots();
    renderFolderStats();
    startStudyTimeTracking();
}

// Update quick stats cards
function updateQuickStats() {
    // Total entries
    const totalEl = document.getElementById("totalEntriesCount");
    if (totalEl) totalEl.textContent = savedEntries.length;

    // Total practiced (sum of all attempts)
    let totalPracticed = 0;
    savedEntries.forEach(entry => {
        if (entry.stats && entry.stats.attempts) {
            totalPracticed += entry.stats.attempts;
        }
    });
    const practicedEl = document.getElementById("totalPracticed");
    if (practicedEl) practicedEl.textContent = totalPracticed;

    // Average accuracy
    let totalCorrect = 0;
    let totalWords = 0;
    savedEntries.forEach(entry => {
        if (entry.stats) {
            totalCorrect += entry.stats.correctWords || 0;
            totalWords += entry.stats.totalWords || 0;
        }
    });
    const avgAccuracy = totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0;
    const accuracyEl = document.getElementById("avgAccuracy");
    if (accuracyEl) accuracyEl.textContent = avgAccuracy + "%";

    // Current streak
    const streak = calculateStreak();
    const streakEl = document.getElementById("currentStreak");
    if (streakEl) streakEl.textContent = streak;

    // Study time
    const studyTime = getStudyTime();
    const timeEl = document.getElementById("totalStudyTime");
    if (timeEl) timeEl.textContent = formatStudyTime(studyTime);
}

// Render progress over time chart
function renderProgressChart() {
    const ctx = document.getElementById("progressChart");
    if (!ctx) return;

    // Get practice history from localStorage
    const history = getPracticeHistory();

    // Prepare data
    const labels = history.map(h => h.date);
    const practiceData = history.map(h => h.practiced);
    const accuracyData = history.map(h => h.accuracy);

    // Destroy existing chart
    if (progressChart) {
        progressChart.destroy();
    }

    // Create new chart
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Entries Practiced',
                    data: practiceData,
                    borderColor: 'rgb(99, 102, 241)',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Accuracy %',
                    data: accuracyData,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.datasetIndex === 1 ? context.parsed.y + '%' : context.parsed.y;
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
        }
    });
}

// Render accuracy by entry chart
function renderAccuracyChart() {
    const ctx = document.getElementById("accuracyChart");
    if (!ctx) return;

    // Get top 10 entries by practice count
    const sortedEntries = [...savedEntries]
        .filter(e => e.stats && e.stats.attempts > 0)
        .sort((a, b) => (b.stats.attempts || 0) - (a.stats.attempts || 0))
        .slice(0, 10);

    const labels = sortedEntries.map(e => e.title.substring(0, 20) + (e.title.length > 20 ? '...' : ''));
    const accuracies = sortedEntries.map(e => {
        if (!e.stats || e.stats.totalWords === 0) return 0;
        return Math.round((e.stats.correctWords / e.stats.totalWords) * 100);
    });

    // Destroy existing chart
    if (accuracyChart) {
        accuracyChart.destroy();
    }

    // Create new chart
    accuracyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Accuracy %',
                data: accuracies,
                backgroundColor: accuracies.map(acc => {
                    if (acc >= 90) return 'rgba(16, 185, 129, 0.8)';
                    if (acc >= 70) return 'rgba(59, 130, 246, 0.8)';
                    if (acc >= 50) return 'rgba(245, 158, 11, 0.8)';
                    return 'rgba(239, 68, 68, 0.8)';
                }),
                borderColor: accuracies.map(acc => {
                    if (acc >= 90) return 'rgb(16, 185, 129)';
                    if (acc >= 70) return 'rgb(59, 130, 246)';
                    if (acc >= 50) return 'rgb(245, 158, 11)';
                    return 'rgb(239, 68, 68)';
                }),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Render study heatmap (last 30 days)
function renderStudyHeatmap() {
    const container = document.getElementById("studyHeatmap");
    if (!container) return;

    container.innerHTML = "";

    const history = getPracticeHistory();
    const today = new Date();

    // Generate last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // Find practice count for this date
        const dayData = history.find(h => h.date === dateStr);
        const practiced = dayData ? dayData.practiced : 0;

        // Determine level (0-4)
        let level = 0;
        if (practiced > 0) level = 1;
        if (practiced >= 3) level = 2;
        if (practiced >= 5) level = 3;
        if (practiced >= 10) level = 4;

        const dayEl = document.createElement("div");
        dayEl.className = `heatmap-day level-${level}`;
        dayEl.title = `${dateStr}: ${practiced} practiced`;
        dayEl.dataset.date = dateStr;
        dayEl.dataset.count = practiced;

        // Add hover tooltip
        dayEl.addEventListener("mouseenter", (e) => {
            const tooltip = document.createElement("div");
            tooltip.className = "heatmap-tooltip";
            tooltip.textContent = `${dateStr}: ${practiced} practiced`;
            tooltip.style.left = e.pageX + 10 + "px";
            tooltip.style.top = e.pageY + 10 + "px";
            document.body.appendChild(tooltip);
            dayEl.dataset.tooltipId = Date.now();
        });

        dayEl.addEventListener("mouseleave", () => {
            const tooltips = document.querySelectorAll(".heatmap-tooltip");
            tooltips.forEach(t => t.remove());
        });

        container.appendChild(dayEl);
    }
}

// Render weak spots (entries with low accuracy)
function renderWeakSpots() {
    const container = document.getElementById("weakSpotsList");
    if (!container) return;

    // Find entries with accuracy < 70% and at least 2 attempts
    const weakSpots = savedEntries
        .filter(e => {
            if (!e.stats || e.stats.attempts < 2) return false;
            if (e.stats.totalWords === 0) return false;
            const accuracy = (e.stats.correctWords / e.stats.totalWords) * 100;
            return accuracy < 70;
        })
        .sort((a, b) => {
            const accA = (a.stats.correctWords / a.stats.totalWords) * 100;
            const accB = (b.stats.correctWords / b.stats.totalWords) * 100;
            return accA - accB;
        })
        .slice(0, 5);

    if (weakSpots.length === 0) {
        container.innerHTML = "<p>🎉 No weak spots! You're doing great!</p>";
        return;
    }

    container.innerHTML = "";
    weakSpots.forEach(entry => {
        const accuracy = Math.round((entry.stats.correctWords / entry.stats.totalWords) * 100);

        const item = document.createElement("div");
        item.className = "weak-spot-item";
        item.innerHTML = `
            <div class="weak-spot-title">${entry.title}</div>
            <div class="weak-spot-stats">
                <div class="weak-spot-stat">
                    <i class="ph ph-target"></i>
                    <span>${accuracy}% accuracy</span>
                </div>
                <div class="weak-spot-stat">
                    <i class="ph ph-repeat"></i>
                    <span>${entry.stats.attempts} attempts</span>
                </div>
                <div class="weak-spot-stat">
                    <i class="ph ph-check"></i>
                    <span>${entry.stats.correctWords}/${entry.stats.totalWords} words</span>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Render per-folder statistics
function renderFolderStats() {
    const container = document.getElementById("folderStatsList");
    if (!container) return;

    container.innerHTML = "";

    folders.forEach(folderId => {
        // Load entries for this folder
        let folderEntries = [];
        try {
            const key = getStorageKeyForFolder(folderId);
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    folderEntries = parsed.map(normalizeEntry);
                }
            }
        } catch (e) {
            // ignore
        }

        if (folderEntries.length === 0) return;

        // Calculate stats
        let totalCorrect = 0;
        let totalWords = 0;
        let totalAttempts = 0;

        folderEntries.forEach(entry => {
            if (entry.stats) {
                totalCorrect += entry.stats.correctWords || 0;
                totalWords += entry.stats.totalWords || 0;
                totalAttempts += entry.stats.attempts || 0;
            }
        });

        const accuracy = totalWords > 0 ? Math.round((totalCorrect / totalWords) * 100) : 0;

        const item = document.createElement("div");
        item.className = "folder-stat-item";
        item.innerHTML = `
            <div class="folder-stat-name">📁 ${folderId === 'default' ? 'Default' : folderId}</div>
            <div class="folder-stat-metrics">
                <div class="folder-metric">
                    <div class="folder-metric-value">${folderEntries.length}</div>
                    <div class="folder-metric-label">Entries</div>
                </div>
                <div class="folder-metric">
                    <div class="folder-metric-value">${totalAttempts}</div>
                    <div class="folder-metric-label">Practiced</div>
                </div>
                <div class="folder-metric">
                    <div class="folder-metric-value">${accuracy}%</div>
                    <div class="folder-metric-label">Accuracy</div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Get practice history from localStorage
function getPracticeHistory() {
    try {
        const stored = localStorage.getItem("fmapp_practice_history_v1");
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        // ignore
    }

    // Generate dummy data for last 7 days if no history
    const history = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        history.push({
            date: date.toISOString().split('T')[0],
            practiced: 0,
            accuracy: 0
        });
    }
    return history;
}

// Save practice history
function savePracticeHistory(practiced, accuracy) {
    try {
        const history = getPracticeHistory();
        const today = new Date().toISOString().split('T')[0];

        // Find or create today's entry
        let todayEntry = history.find(h => h.date === today);
        if (todayEntry) {
            todayEntry.practiced += practiced;
            todayEntry.accuracy = accuracy; // Use latest accuracy
        } else {
            history.push({
                date: today,
                practiced: practiced,
                accuracy: accuracy
            });
        }

        // Keep only last 30 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const filtered = history.filter(h => h.date >= cutoffStr);

        localStorage.setItem("fmapp_practice_history_v1", JSON.stringify(filtered));
    } catch (e) {
        console.error("Failed to save practice history", e);
    }
}

// Study time tracking
function startStudyTimeTracking() {
    studyTimeTracker.startTime = Date.now();
}

function stopStudyTimeTracking() {
    if (studyTimeTracker.startTime) {
        const elapsed = Date.now() - studyTimeTracker.startTime;
        const minutes = Math.floor(elapsed / 60000);
        studyTimeTracker.totalMinutes += minutes;

        // Save to localStorage
        try {
            const stored = localStorage.getItem("fmapp_study_time_v1");
            const total = stored ? parseInt(stored) : 0;
            localStorage.setItem("fmapp_study_time_v1", String(total + minutes));
        } catch (e) {
            // ignore
        }

        studyTimeTracker.startTime = null;
    }
}

function getStudyTime() {
    try {
        const stored = localStorage.getItem("fmapp_study_time_v1");
        return stored ? parseInt(stored) : 0;
    } catch (e) {
        return 0;
    }
}

function formatStudyTime(minutes) {
    if (minutes < 60) return minutes + "m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return hours + "h " + mins + "m";
    const days = Math.floor(hours / 24);
    const hrs = hours % 24;
    return days + "d " + hrs + "h";
}

// Hook into practice completion to track history
const originalCompareText = compareText;
compareText = function (userInput, expectedText, resultDiv, mode) {
    originalCompareText(userInput, expectedText, resultDiv, mode);

    // Calculate accuracy
    const normalized = normalizeForComparison(userInput, expectedText);
    const userWords = normalized.userWords;
    const expectedWords = normalized.expectedWords;

    let correctWords = 0;
    for (let i = 0; i < userWords.length; i++) {
        const expectedWord = expectedWords[i] || "";
        const userWord = userWords[i] || "";
        if (userWord.toLowerCase() === expectedWord.toLowerCase()) {
            correctWords++;
        }
    }

    const accuracy = expectedWords.length > 0 ? Math.round((correctWords / expectedWords.length) * 100) : 0;

    // Save to history
    savePracticeHistory(1, accuracy);
};

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initAnalytics,
        updateQuickStats,
        renderProgressChart,
        renderAccuracyChart,
        renderStudyHeatmap,
        renderWeakSpots,
        renderFolderStats
    };
}
