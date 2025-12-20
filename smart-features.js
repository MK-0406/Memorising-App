// ========== PHASE 4: SMART FEATURES & AI INTEGRATION ==========

/**
 * This module provides intelligent features to enhance the user experience:
 * - Auto-tagging based on content analysis
 * - Duplicate detection
 * - Related entries suggestions
 * - Bulk operations
 * - Entry templates
 * - Smart hints during practice
 */

// ===== AUTO-TAGGING =====

// Extract keywords from text using simple NLP
function extractKeywords(text) {
    if (!text) return [];

    // Common stop words to ignore
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
        'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
        'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
        'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 'just'
    ]);

    // Extract words
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word));

    // Count frequency
    const frequency = {};
    words.forEach(word => {
        frequency[word] = (frequency[word] || 0) + 1;
    });

    // Sort by frequency and get top 5
    const sorted = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);

    return sorted;
}

// Auto-suggest tags for an entry
function autoSuggestTags(title, content) {
    const combinedText = `${title} ${content}`;
    const keywords = extractKeywords(combinedText);

    // Also check for common patterns
    const patterns = {
        'math': /\b(equation|formula|calculate|solve|theorem|proof)\b/i,
        'science': /\b(experiment|hypothesis|theory|observation|data)\b/i,
        'history': /\b(century|war|revolution|empire|dynasty)\b/i,
        'language': /\b(grammar|vocabulary|pronunciation|conjugation)\b/i,
        'programming': /\b(function|variable|loop|array|class|method)\b/i,
        'geography': /\b(country|capital|continent|ocean|mountain)\b/i
    };

    const suggestedTags = [...keywords];

    // Add pattern-based tags
    for (const [tag, pattern] of Object.entries(patterns)) {
        if (pattern.test(combinedText) && !suggestedTags.includes(tag)) {
            suggestedTags.push(tag);
        }
    }

    return suggestedTags.slice(0, 5);
}

// ===== DUPLICATE DETECTION =====

// Calculate similarity between two strings (Levenshtein distance)
function calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

// Find potential duplicates
function findDuplicates(entry, threshold = 0.8) {
    const duplicates = [];

    savedEntries.forEach((existing, index) => {
        if (existing === entry) return;

        const titleSim = calculateSimilarity(
            entry.title.toLowerCase(),
            existing.title.toLowerCase()
        );

        const contentSim = calculateSimilarity(
            entry.content.toLowerCase().substring(0, 100),
            existing.content.toLowerCase().substring(0, 100)
        );

        const avgSim = (titleSim + contentSim) / 2;

        if (avgSim >= threshold) {
            duplicates.push({
                entry: existing,
                index: index,
                similarity: Math.round(avgSim * 100)
            });
        }
    });

    return duplicates.sort((a, b) => b.similarity - a.similarity);
}

// Check for duplicates when adding new entry
function checkDuplicateBeforeSave(title, content) {
    const tempEntry = { title, content };
    const duplicates = findDuplicates(tempEntry, 0.7);

    if (duplicates.length > 0) {
        const messages = duplicates.map(d =>
            `• "${d.entry.title}" (${d.similarity}% similar)`
        ).join('\n');

        return confirm(
            `⚠️ Potential duplicate(s) found:\n\n${messages}\n\nDo you still want to add this entry?`
        );
    }

    return true;
}

// ===== RELATED ENTRIES =====

// Find related entries based on tags and content
function findRelatedEntries(entry, limit = 5) {
    const related = [];

    savedEntries.forEach((other, index) => {
        if (other === entry) return;

        let score = 0;

        // Tag overlap
        if (entry.tags && other.tags) {
            const commonTags = entry.tags.filter(tag =>
                other.tags.some(t => t.toLowerCase() === tag.toLowerCase())
            );
            score += commonTags.length * 10;
        }

        // Content similarity (using keywords)
        const keywords1 = extractKeywords(entry.content);
        const keywords2 = extractKeywords(other.content);
        const commonKeywords = keywords1.filter(k => keywords2.includes(k));
        score += commonKeywords.length * 5;

        // Title similarity
        const titleSim = calculateSimilarity(
            entry.title.toLowerCase(),
            other.title.toLowerCase()
        );
        score += titleSim * 20;

        if (score > 0) {
            related.push({
                entry: other,
                index: index,
                score: score
            });
        }
    });

    return related
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

// ===== BULK OPERATIONS =====

// Select multiple entries
let selectedEntries = new Set();

function toggleEntrySelection(index) {
    if (selectedEntries.has(index)) {
        selectedEntries.delete(index);
    } else {
        selectedEntries.add(index);
    }
    updateSelectionUI();
}

function selectAllEntries() {
    selectedEntries.clear();
    savedEntries.forEach((_, index) => selectedEntries.add(index));
    updateSelectionUI();
}

function deselectAllEntries() {
    selectedEntries.clear();
    updateSelectionUI();
}

function updateSelectionUI() {
    // Update UI to show selected state
    const containers = document.querySelectorAll('.entry-container');
    containers.forEach((container, index) => {
        if (selectedEntries.has(index)) {
            container.classList.add('selected');
        } else {
            container.classList.remove('selected');
        }
    });

    // Update bulk action buttons
    const bulkActions = document.getElementById('bulkActions');
    if (bulkActions) {
        bulkActions.style.display = selectedEntries.size > 0 ? 'flex' : 'none';
        const countEl = document.getElementById('selectedCount');
        if (countEl) {
            countEl.textContent = selectedEntries.size;
        }
    }
}

// Bulk delete
function bulkDelete() {
    if (selectedEntries.size === 0) return;

    if (!confirm(`Delete ${selectedEntries.size} selected entries?`)) return;

    // Sort indices in descending order to avoid index shifting
    const indices = Array.from(selectedEntries).sort((a, b) => b - a);

    indices.forEach(index => {
        savedEntries.splice(index, 1);
    });

    selectedEntries.clear();
    saveToStorage();
    showSavedEntries();
    showEntriesInInputTab();
    alert(`Deleted ${indices.length} entries.`);
}

// Bulk tag
function bulkAddTag() {
    if (selectedEntries.size === 0) return;

    const tag = prompt('Enter tag to add to selected entries:');
    if (!tag || !tag.trim()) return;

    selectedEntries.forEach(index => {
        const entry = savedEntries[index];
        if (!entry.tags) entry.tags = [];
        if (!entry.tags.includes(tag.trim())) {
            entry.tags.push(tag.trim());
        }
    });

    saveToStorage();
    showSavedEntries();
    alert(`Added tag "${tag}" to ${selectedEntries.size} entries.`);
}

// Bulk export
function bulkExport() {
    if (selectedEntries.size === 0) return;

    const selected = Array.from(selectedEntries).map(i => savedEntries[i]);
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `selected-entries-${Date.now()}.json`;
    link.click();
}

// ===== ENTRY TEMPLATES =====

const templates = {
    'vocabulary': {
        name: 'Vocabulary Word',
        titlePlaceholder: 'Word',
        contentPlaceholder: 'Definition:\n\nExample sentence:\n\nSynonyms:\n\nAntonyms:',
        tags: ['vocabulary', 'language']
    },
    'formula': {
        name: 'Math Formula',
        titlePlaceholder: 'Formula Name',
        contentPlaceholder: 'Formula:\n\nWhen to use:\n\nExample:',
        tags: ['math', 'formula']
    },
    'concept': {
        name: 'Concept/Theory',
        titlePlaceholder: 'Concept Name',
        contentPlaceholder: 'Definition:\n\nKey points:\n- \n- \n\nExample:',
        tags: ['concept']
    },
    'date': {
        name: 'Historical Date',
        titlePlaceholder: 'Event Name',
        contentPlaceholder: 'Date:\n\nWhat happened:\n\nSignificance:',
        tags: ['history', 'dates']
    },
    'qa': {
        name: 'Q&A',
        titlePlaceholder: 'Question',
        contentPlaceholder: 'Answer:',
        tags: ['qa']
    }
};

function applyTemplate(templateId) {
    const template = templates[templateId];
    if (!template) return;

    // Add new entry with template
    addNewEntry();

    // Fill in template
    const containers = document.querySelectorAll('.entry-container');
    const lastContainer = containers[containers.length - 1];

    if (lastContainer) {
        const titleInput = lastContainer.querySelector('.title-input');
        const contentInput = lastContainer.querySelector('.content-input');
        const tagsInput = lastContainer.querySelector('.tags-input');

        if (titleInput) titleInput.placeholder = template.titlePlaceholder;
        if (contentInput) contentInput.placeholder = template.contentPlaceholder;
        if (tagsInput && template.tags) {
            tagsInput.value = template.tags.join(', ');
        }
    }
}

// ===== SMART HINTS =====

// Generate hints based on entry content
function generateSmartHints(entry) {
    const hints = [];

    // First letter hints (already implemented)
    const words = entry.content.trim().split(/\s+/);
    const firstLetters = words.map(w => w[0] ? w[0].toUpperCase() : '').join(' ');
    hints.push({
        type: 'first-letters',
        text: firstLetters,
        label: 'First letters'
    });

    // Word count hint
    hints.push({
        type: 'word-count',
        text: `${words.length} words`,
        label: 'Word count'
    });

    // Keywords hint
    const keywords = extractKeywords(entry.content);
    if (keywords.length > 0) {
        hints.push({
            type: 'keywords',
            text: keywords.join(', '),
            label: 'Key terms'
        });
    }

    // Structure hint (if content has bullet points or numbers)
    if (/^[\d\-•]/.test(entry.content)) {
        const lines = entry.content.split('\n').filter(l => l.trim());
        hints.push({
            type: 'structure',
            text: `${lines.length} points`,
            label: 'Structure'
        });
    }

    return hints;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractKeywords,
        autoSuggestTags,
        calculateSimilarity,
        findDuplicates,
        checkDuplicateBeforeSave,
        findRelatedEntries,
        toggleEntrySelection,
        selectAllEntries,
        deselectAllEntries,
        bulkDelete,
        bulkAddTag,
        bulkExport,
        templates,
        applyTemplate,
        generateSmartHints
    };
}
