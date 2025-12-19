let entryCount = 0;
// Each entry: { title, content, tags: string[], pinned: boolean, stats: { correctWords, totalWords, attempts } }
const savedEntries = [];
let checkMode = "strict";
let firstLetterHintsEnabled = false;
let practiceSessionStats = { attempts: 0, correctWords: 0, totalWords: 0 };
let shuffledSessionStats = { attempts: 0, correctWords: 0, totalWords: 0 };
let currentUser = null;

// --- Persistence helpers ---
const STORAGE_KEY = "fmapp_savedEntries_v1";
const SETTINGS_KEY = "fmapp_settings_v1";

function normalizeEntry(raw) {
    return {
        title: raw.title || "",
        content: raw.content || "",
        tags: Array.isArray(raw.tags)
            ? raw.tags
            : (typeof raw.tags === "string" && raw.tags.trim() ? raw.tags.split(",").map(t => t.trim()) : []),
        pinned: !!raw.pinned,
        stats: raw.stats || { correctWords: 0, totalWords: 0, attempts: 0 }
    };
}

function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                savedEntries.length = 0;
                parsed.forEach(e => savedEntries.push(normalizeEntry(e)));
            }
        }
        const settingsRaw = localStorage.getItem(SETTINGS_KEY);
        if (settingsRaw) {
            const settings = JSON.parse(settingsRaw);
            if (settings.darkMode) {
                document.body.classList.add("dark-mode");
            }
            if (settings.fontSize) {
                changeFontSize(settings.fontSize, false);
                const selector = document.getElementById("fontSizeSelector");
                if (selector) selector.value = settings.fontSize;
            }
        }
    } catch (e) {
        console.error("Failed to load from storage", e);
    }
}

function saveToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedEntries));
    } catch (e) {
        console.error("Failed to save to storage", e);
    }
}

function saveSettings() {
    const isDark = document.body.classList.contains("dark-mode");
    const fontSelector = document.getElementById("fontSizeSelector");
    const fontSize = fontSelector ? fontSelector.value : "normal";
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ darkMode: isDark, fontSize }));
    } catch (e) {
        console.error("Failed to save settings", e);
    }
}

function resetAllData() {
    if (!confirm("This will remove all entries and reset settings. Continue?")) return;
    savedEntries.length = 0;
    entryCount = 0;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    document.body.classList.remove("dark-mode");
    const fontSelector = document.getElementById("fontSizeSelector");
    if (fontSelector) fontSelector.value = "normal";
    document.documentElement.style.fontSize = "";
    document.getElementById("entriesContainer").innerHTML = "";
    showSavedEntries();
    loadPracticeEntry();
    loadShuffledEntry();
}

// --- UI settings controls ---
function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    saveSettings();
}

function changeFontSize(size, persist = true) {
    let base = "";
    if (size === "large") base = "18px";
    else if (size === "xlarge") base = "20px";
    else base = "";
    document.documentElement.style.fontSize = base;
    if (persist) saveSettings();
}

// --- Helpers to create/fill entries programmatically ---
function createAndFillEntry(title, content) {
    addNewEntry();
    const containers = document.querySelectorAll(".entry-container");
    if (!containers.length) return;
    const last = containers[containers.length - 1];
    const titleInput = last.querySelector(".title-input");
    const contentInput = last.querySelector(".content-input");
    if (titleInput) titleInput.value = title || "";
    if (contentInput) contentInput.value = content || "";
}

// --- Firebase auth + Firestore helpers ---
async function initFirebaseAuth() {
    const api = window.firebaseApi;
    if (!api) {
        // Fallback: local-only
        loadFromStorage();
        showSavedEntries();
        showEntriesInInputTab();
        loadPracticeEntry();
        loadShuffledEntry();
        updatePracticeStatsDisplay();
        updateShuffledStatsDisplay();
        return;
    }

    const { auth, GoogleAuthProvider, onAuthStateChanged } = api;

    onAuthStateChanged(auth, async (user) => {
        currentUser = user || null;
        const userInfo = document.getElementById("userInfo");
        const loginBtn = document.getElementById("loginBtn");
        const logoutBtn = document.getElementById("logoutBtn");

        if (userInfo && loginBtn && logoutBtn) {
            if (user) {
                userInfo.textContent = `Signed in as ${user.email || user.uid}`;
                loginBtn.style.display = "none";
                logoutBtn.style.display = "inline-block";
            } else {
                userInfo.textContent = "Not signed in";
                loginBtn.style.display = "inline-block";
                logoutBtn.style.display = "none";
            }
        }

        if (currentUser) {
            await loadFromFirestore();
        } else {
            loadFromStorage();
            showSavedEntries();
            showEntriesInInputTab();
            loadPracticeEntry();
            loadShuffledEntry();
        }
        updatePracticeStatsDisplay();
        updateShuffledStatsDisplay();
    });
}

function signInWithGoogle() {
    const api = window.firebaseApi;
    if (!api) {
        alert("Firebase not ready – please check your internet connection.");
        return;
    }
    const { auth, GoogleAuthProvider, signInWithPopup } = api;
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => {
        console.error(err);
        if (err.code === "auth/configuration-not-found" || err.code === "auth/operation-not-allowed") {
            alert("Firebase Authentication is not enabled.\n\nPlease:\n1. Go to Firebase Console (console.firebase.google.com)\n2. Select your project\n3. Go to 'Authentication' → 'Sign-in method'\n4. Enable 'Google' provider\n5. Refresh this page and try again.");
        } else {
            alert("Sign-in failed: " + err.message + "\n\nError code: " + (err.code || "unknown"));
        }
    });
}

function logout() {
    const api = window.firebaseApi;
    if (!api) return;
    const { auth, signOut } = api;
    signOut(auth).catch(err => {
        console.error(err);
        alert("Logout failed: " + err.message);
    });
}

async function saveToFirestore() {
    const api = window.firebaseApi;
    if (!api || !currentUser) return;
    const { db, collection, doc, setDoc } = api;
    const colRef = collection(db, "users", currentUser.uid, "entries");

    const writes = savedEntries.map((entry, index) => {
        const docRef = doc(colRef, String(index));
        return setDoc(docRef, entry);
    });

    try {
        await Promise.all(writes);
    } catch (e) {
        console.error("Failed to save to Firestore", e);
    }
}

async function loadFromFirestore() {
    const api = window.firebaseApi;
    if (!api || !currentUser) return;
    const { db, collection, getDocs } = api;
    const colRef = collection(db, "users", currentUser.uid, "entries");

    try {
        const snap = await getDocs(colRef);
        savedEntries.length = 0;
        snap.forEach(docSnap => {
            savedEntries.push(normalizeEntry(docSnap.data()));
        });
        saveToStorage(); // keep local cache
        showSavedEntries();
        showEntriesInInputTab();
        loadPracticeEntry();
        loadShuffledEntry();
    } catch (e) {
        console.error("Failed to load from Firestore", e);
    }
}

function switchTab(index) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    tabs[index].classList.add('active');
    contents[index].classList.add('active');
}

function addNewEntry() {
    entryCount++;

    const container = document.createElement("div");
    container.className = "entry-container";

    const titleLabel = document.createElement("label");
    titleLabel.classList.add("title-label");

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.classList.add("title-input");
    const contentLabel = document.createElement("label");
    contentLabel.classList.add("content-label");

    const contentInput = document.createElement("textarea");
    contentInput.classList.add("content-input");

    const tagsLabel = document.createElement("label");
    tagsLabel.textContent = "Tags (comma separated):";
    const tagsInput = document.createElement("input");
    tagsInput.type = "text";
    tagsInput.classList.add("tags-input");

    const pinButton = document.createElement("button");
    pinButton.textContent = "📌 Pin";
    pinButton.classList.add("pin-button");
    pinButton.onclick = () => {
        pinButton.classList.toggle("pinned");
    };

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "X";
    deleteButton.classList.add("delete-button");
    deleteButton.onclick = () => {
        container.remove();
        updateEntryNumbers();
    };

    const clearTitleButton = document.createElement("button");
    clearTitleButton.textContent = "Clr Title";
    clearTitleButton.classList.add("clear-title-button");
    clearTitleButton.onclick = () => {
        titleInput.value = "";
    }

    const clearContentButton = document.createElement("button");
    clearContentButton.textContent = "Clr Content";
    clearContentButton.classList.add("clear-content-button");
    clearContentButton.onclick = () => {
        contentInput.value = "";
    }

    const moveUpButton = document.createElement("button");
    moveUpButton.textContent = "↑";
    moveUpButton.classList.add("move-up-button");
    moveUpButton.onclick = () => {
        const prev = container.previousElementSibling;
        if (prev && prev.classList.contains("entry-container")) {
        container.parentNode.insertBefore(container, prev);
        updateEntryNumbers();
        }
    };

    const moveDownButton = document.createElement("button");
    moveDownButton.textContent = "↓";
    moveDownButton.classList.add("move-down-button");
    moveDownButton.onclick = () => {
        const next = container.nextElementSibling;
        if (next && next.classList.contains("entry-container")) {
        container.parentNode.insertBefore(next, container);
        updateEntryNumbers();
        }
    };

    container.appendChild(titleLabel);
    container.appendChild(titleInput);
    container.appendChild(contentLabel);
    container.appendChild(contentInput);
    container.appendChild(tagsLabel);
    container.appendChild(tagsInput);
    container.appendChild(deleteButton);
    container.appendChild(clearTitleButton);
    container.appendChild(clearContentButton);
    container.appendChild(moveUpButton);
    container.appendChild(moveDownButton);
    container.appendChild(pinButton);

    document.getElementById("entriesContainer").appendChild(container);

    updateEntryNumbers();
}

function updateEntryNumbers() {
    const titleLabels = document.querySelectorAll(".title-label");
    const contentLabels = document.querySelectorAll(".content-label");

    titleLabels.forEach((label, index) => {
        label.textContent = `Title ${index + 1}:`;
    });

    contentLabels.forEach((label, index) => {
        label.textContent = `Content ${index + 1}:`;
    });

    entryCount = titleLabels.length;
}

function showEntriesInInputTab() {
    const entriesContainer = document.getElementById("entriesContainer");
    entriesContainer.innerHTML = "";

    savedEntries.forEach(entry => {
        const container = document.createElement("div");
        container.className = "entry-container";

        const titleLabel = document.createElement("label");
        titleLabel.classList.add("title-label");

        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.classList.add("title-input");
        titleInput.value = entry.title;

        const contentLabel = document.createElement("label");
        contentLabel.classList.add("content-label");

        const contentInput = document.createElement("textarea");
        contentInput.classList.add("content-input");
        contentInput.value = entry.content;

        const tagsLabel = document.createElement("label");
        tagsLabel.textContent = "Tags (comma separated):";
        const tagsInput = document.createElement("input");
        tagsInput.type = "text";
        tagsInput.classList.add("tags-input");
        tagsInput.value = (entry.tags || []).join(", ");

        const pinButton = document.createElement("button");
        pinButton.textContent = "📌 Pin";
        pinButton.classList.add("pin-button");
        if (entry.pinned) pinButton.classList.add("pinned");
        pinButton.onclick = () => {
            pinButton.classList.toggle("pinned");
        };

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "X";
        deleteButton.classList.add("delete-button");
        deleteButton.onclick = () => {
        container.remove();
        updateEntryNumbers();
        };

        const clearTitleButton = document.createElement("button");
        clearTitleButton.textContent = "Clr Title";
        clearTitleButton.classList.add("clear-title-button");
        clearTitleButton.onclick = () => {
            titleInput.value = "";
        }

        const clearContentButton = document.createElement("button");
        clearContentButton.textContent = "Clr Content";
        clearContentButton.classList.add("clear-content-button");
        clearContentButton.onclick = () => {
            contentInput.value = "";
        }

        const moveUpButton = document.createElement("button");
        moveUpButton.textContent = "↑";
        moveUpButton.classList.add("move-up-button");
        moveUpButton.onclick = () => {
        const prev = container.previousElementSibling;
        if (prev && prev.classList.contains("entry-container")) {
            container.parentNode.insertBefore(container, prev);
            updateEntryNumbers();
        }
        };

        const moveDownButton = document.createElement("button");
        moveDownButton.textContent = "↓";
        moveDownButton.classList.add("move-down-button");
        moveDownButton.onclick = () => {
        const next = container.nextElementSibling;
        if (next && next.classList.contains("entry-container")) {
            container.parentNode.insertBefore(next, container);
            updateEntryNumbers();
        }
        };

        container.appendChild(titleLabel);
        container.appendChild(titleInput);
        container.appendChild(contentLabel);
        container.appendChild(contentInput);
        container.appendChild(tagsLabel);
        container.appendChild(tagsInput);
        container.appendChild(deleteButton);
        container.appendChild(clearTitleButton);
        container.appendChild(clearContentButton);
        container.appendChild(moveUpButton);
        container.appendChild(moveDownButton);
        container.appendChild(pinButton);

        entriesContainer.appendChild(container);
    });

    updateEntryNumbers();
}

function saveAllEntries() {
    const titles = document.querySelectorAll(".title-input");
    const contents = document.querySelectorAll(".content-input");
    const tagsInputs = document.querySelectorAll(".tags-input");
    const pinButtons = document.querySelectorAll(".pin-button");

    savedEntries.length = 0;
    for (let i = 0; i < titles.length; i++) {
        if (titles[i].value != "" || contents[i].value != "") {
            const tagsRaw = (tagsInputs[i] && tagsInputs[i].value) || "";
            const tags = tagsRaw
                .split(",")
                .map(t => t.trim())
                .filter(Boolean);
            const pinned = pinButtons[i] && pinButtons[i].classList.contains("pinned");
            savedEntries.push({
                title: titles[i].value.trim(),
                content: contents[i].value.trim(),
                tags,
                pinned,
                stats: { correctWords: 0, totalWords: 0, attempts: 0 }
            });
        }
    }

    saveToStorage();
    saveToFirestore();
    showSavedEntries();
    loadPracticeEntry();
    loadShuffledEntry();
    alert("Entries have been saved!");
}

function showSavedEntries() {
    const savedContainer = document.getElementById("savedContainer");
    savedContainer.innerHTML = "";

    if (savedEntries.length === 0) {
        savedContainer.innerHTML = "<p>No entries saved yet.</p>";
        return;
    }

    const filtered = getFilteredEntriesWithIndex();

    if (filtered.length === 0) {
        savedContainer.innerHTML = "<p>No entries match the current filters.</p>";
        return;
    }

    filtered.forEach(({ entry, index }) => {
        const box = document.createElement("div");
        box.className = "entry-container";

        const header = document.createElement("div");
        header.className = "flex gap-10";

        const title = document.createElement("p");
        title.innerHTML = `<strong>Title ${index + 1}:</strong> ${entry.title}`;

        const pin = document.createElement("button");
        pin.textContent = "📌";
        pin.className = "pin-button" + (entry.pinned ? " pinned" : "");
        pin.onclick = () => {
            entry.pinned = !entry.pinned;
            saveToStorage();
            showSavedEntries();
        };

        header.appendChild(title);
        header.appendChild(pin);

        const content = document.createElement("p");
        content.innerHTML = `<strong>Content ${index + 1}:</strong> <br/> ${entry.content.replace(/\r?\n/g, '<br>')}`;

        const tags = document.createElement("p");
        tags.innerHTML = `<strong>Tags:</strong> ${(entry.tags || []).join(", ") || "—"}`;

        box.appendChild(header);
        box.appendChild(content);
        box.appendChild(tags);
        savedContainer.appendChild(box);
    });
}

function getFilteredEntriesWithIndex() {
    const searchInput = document.getElementById("searchInput");
    const tagFilterInput = document.getElementById("tagFilterInput");
    const showPinnedOnly = document.getElementById("showPinnedOnly");
    const q = (searchInput && searchInput.value.toLowerCase()) || "";
    const tagsRaw = (tagFilterInput && tagFilterInput.value) || "";
    const filterTags = tagsRaw
        .split(",")
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
    const onlyPinned = showPinnedOnly && showPinnedOnly.checked;

    const withIndex = savedEntries.map((entry, index) => ({ entry, index }));

    return withIndex
        .filter(({ entry }) => {
            if (onlyPinned && !entry.pinned) return false;
            if (q) {
                const haystack = (entry.title + " " + entry.content).toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (filterTags.length) {
                const entryTags = (entry.tags || []).map(t => t.toLowerCase());
                const matchesAll = filterTags.every(t => entryTags.includes(t));
                if (!matchesAll) return false;
            }
            return true;
        })
        .sort((a, b) => {
            // pinned first, then original index
            if (a.entry.pinned && !b.entry.pinned) return -1;
            if (!a.entry.pinned && b.entry.pinned) return 1;
            return a.index - b.index;
        });
}

function applySearchAndFilters() {
    showSavedEntries();
}

function downloadJson() {
    const filename = prompt("Enter a filename for your JSON (without .json):");
    if (!filename) return; // User cancelled

    const blob = new Blob([JSON.stringify(savedEntries, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.json`; // Specify the file name
    link.click();
}

async function downloadPdf() {
    const filename = prompt("Enter a filename for your PDF (without .pdf):");
    if (!filename) return; // User cancelled

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 10;

    savedEntries.forEach((entry, index) => {
        // Title (bold)
        doc.setFont('times', 'bold');
        doc.text(entry.title, 10, y);
        y += 10;

        // Content (normal)
        doc.setFont('times', 'normal');
        const lines = doc.splitTextToSize(entry.content, 180);
        doc.text(lines, 10, y);
        y += lines.length * 10;

        // Add spacing between entries
        y += 10;

        // Add new page if needed
        if (y > 270 && index !== savedEntries.length - 1) {
        doc.addPage();
        y = 10;
        }
    });

    doc.save(`${filename}.pdf`);
}

function loadFromJson() {
    document.getElementById("jsonLoader").click();
}

document.getElementById("jsonLoader").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const loadedEntries = JSON.parse(e.target.result);
            if (Array.isArray(loadedEntries)) {
                const mode = confirm("Click OK to REPLACE existing entries, or Cancel to MERGE with them.\n(OK = Replace, Cancel = Merge)") ? "replace" : "merge";
                if (mode === "replace") {
                    savedEntries.length = 0;
                }
                loadedEntries.forEach(e => savedEntries.push(normalizeEntry(e)));
                saveToStorage();
                showSavedEntries(); // Refresh UI
                showEntriesInInputTab();
                loadPracticeEntry();
                loadShuffledEntry();
            } else {
                alert("Invalid JSON format: expected an array of entries.");
            }
        } catch (err) {
            alert("Error loading JSON: " + err.message);
        }
    };
    reader.readAsText(file);
});

// --- Import from image (OCR via Tesseract.js) ---
function importFromImage() {
    const input = document.getElementById("imageLoader");
    if (input) input.click();
}

const imageLoaderEl = document.getElementById("imageLoader");
if (imageLoaderEl) {
    imageLoaderEl.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!window.Tesseract) {
            alert("Tesseract.js failed to load. Please check your internet connection.");
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            Tesseract.recognize(e.target.result, "eng")
                .then(({ data }) => {
                    const rawText = data.text || "";
                    const { title, content } = splitTitleAndContent(rawText);
                    createAndFillEntry(title, content);
                    alert("Text extracted from image and added as a new entry.");
                })
                .catch(err => {
                    console.error(err);
                    alert("Error extracting text from image: " + err.message);
                })
                .finally(() => {
                    event.target.value = "";
                });
        };
        reader.readAsDataURL(file);
    });
}

// --- Import from PDF (using PDF.js, text-based PDFs only) ---
function importFromPdf() {
    const input = document.getElementById("pdfLoader");
    if (input) input.click();
}

const pdfLoaderEl = document.getElementById("pdfLoader");
if (pdfLoaderEl) {
    pdfLoaderEl.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (!file) return;
        const pdfjs = window.pdfjsLib || (window["pdfjs-dist/build/pdf"] || null);
        if (!pdfjs) {
            alert("PDF.js failed to load. Please check your internet connection.");
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            const typedArray = new Uint8Array(e.target.result);
            pdfjs.getDocument({ data: typedArray }).promise
                .then(pdf => pdf.getPage(1))
                .then(page => page.getTextContent())
                .then(textContent => {
                    const strings = textContent.items.map(i => i.str);
                    const rawText = strings.join("\n");
                    const { title, content } = splitTitleAndContent(rawText);
                    createAndFillEntry(title, content);
                    alert("Text extracted from PDF (first page) and added as a new entry.");
                })
                .catch(err => {
                    console.error(err);
                    alert("Error extracting text from PDF: " + err.message);
                })
                .finally(() => {
                    event.target.value = "";
                });
        };
        reader.readAsArrayBuffer(file);
    });
}

// Simple heuristic to split title and content from a big text block
function splitTitleAndContent(text) {
    const lines = (text || "")
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length);
    if (!lines.length) return { title: "", content: "" };

    let title = lines[0];
    let contentLines = lines.slice(1);

    // If first line is very long, treat whole text as content
    if (title.length > 80 && lines.length > 1) {
        title = lines[0].slice(0, 80) + "...";
        contentLines = lines;
    }

    return {
        title,
        content: contentLines.join("\n")
    };
}

function loadPracticeEntry() {
    const practiceContainer = document.getElementById("practiceContainer");
    practiceContainer.innerHTML = "";
    const practiceArea = document.getElementById("practiceContent");
    practiceArea.innerHTML = "";

    if (savedEntries.length === 0) {
        practiceContainer.innerHTML = "<p>No entries saved yet.</p>";
        updatePracticeStatsDisplay();
        return;
    }

    practiceSessionStats = { attempts: 0, correctWords: 0, totalWords: 0 };
    updatePracticeStatsDisplay();

    // Loop through each saved entry and display its title with input field, check button, and result space
    savedEntries.forEach((entry, index) => {

        // Create a container for each entry's practice area
        const entryContainer = document.createElement("div");
        entryContainer.classList.add("entry-container");

        // Create the title
        const title = document.createElement("h3");
        title.textContent = `Title: ${entry.title}`;

        // Create the input field
        const input = document.createElement("textarea");
        input.rows = 3;
        input.placeholder = "Type the content from memory...";

        // Create the check button
        const checkButton = document.createElement("button");
        checkButton.textContent = "Check (Enter)";
        checkButton.onclick = () => compareText(input.value, entry.content, result, "practice");

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                checkButton.click();
            } else if (e.key === "Escape") {
                input.value = "";
            }
        });

        const clearAnswerButton = document.createElement("button");
        clearAnswerButton.textContent = "Clr Answer";
        clearAnswerButton.classList.add("clear-answer-button");
        clearAnswerButton.onclick = () => {
            input.value = "";
        }

        // Create the result div to show correct/wrong text
        const result = document.createElement("div");
        result.className = "result";

        // Append all elements to the entry container
        entryContainer.appendChild(title);
        entryContainer.appendChild(input);
        entryContainer.appendChild(checkButton);
        entryContainer.appendChild(clearAnswerButton);
        entryContainer.appendChild(result);

        // Append the entry container to the practice area
        practiceArea.appendChild(entryContainer);
    });
}

function loadShuffledEntry() {
    const practiceContainer = document.getElementById("shuffledContainer");
    practiceContainer.innerHTML = "";
    const practiceArea = document.getElementById("shuffledContent");
    practiceArea.innerHTML = "";

    if (savedEntries.length === 0) {
        practiceContainer.innerHTML = "<p>No entries saved yet.</p>";
        updateShuffledStatsDisplay();
        return;
    }

    shuffledSessionStats = { attempts: 0, correctWords: 0, totalWords: 0 };
    updateShuffledStatsDisplay();

    // Shuffle the savedEntries array using Fisher-Yates shuffle
    const shuffledEntries = [...savedEntries]; // Create a copy
    for (let i = shuffledEntries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledEntries[i], shuffledEntries[j]] = [shuffledEntries[j], shuffledEntries[i]];
    }

    // Loop through each saved entry and display its title with input field, check button, and result space
    shuffledEntries.forEach((entry, index) => {

        // Create a container for each entry's practice area
        const entryContainer = document.createElement("div");
        entryContainer.classList.add("entry-container");

        // Create the title
        const title = document.createElement("h3");
        title.textContent = `Title: ${entry.title}`;

        // Create the input field
        const input = document.createElement("textarea");
        input.rows = 3;
        input.placeholder = "Type the content from memory...";

        // Create the check button
        const checkButton = document.createElement("button");
        checkButton.textContent = "Check (Enter)";
        checkButton.onclick = () => compareText(input.value, entry.content, result, "shuffled");

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                checkButton.click();
            } else if (e.key === "Escape") {
                input.value = "";
            }
        });

        const clearAnswerButton = document.createElement("button");
        clearAnswerButton.textContent = "Clr Answer";
        clearAnswerButton.classList.add("clear-answer-button");
        clearAnswerButton.onclick = () => {
            input.value = "";
        }

        // Create the result div to show correct/wrong text
        const result = document.createElement("div");
        result.className = "result";

        // Append all elements to the entry container
        entryContainer.appendChild(title);
        entryContainer.appendChild(input);
        entryContainer.appendChild(checkButton);
        entryContainer.appendChild(clearAnswerButton);
        entryContainer.appendChild(result);

        // Append the entry container to the practice area
        practiceArea.appendChild(entryContainer);
    });
}

function compareText(userInput, expectedText, resultDiv, mode) {
    resultDiv.innerHTML = ""; // Clear previous results
    const normalized = normalizeForComparison(userInput, expectedText);
    const userWords = normalized.userWords;
    const expectedWords = normalized.expectedWords;

    const wordResults = [];
    let correctWords = 0;

    // Compare words
    for (let i = 0; i < userWords.length; i++) {
        const expectedWord = expectedWords[i] || "";
        const userWord = userWords[i] || "";  // Handle case when user input is shorter

        const wordSpan = document.createElement("span");

        if (userWord.toLowerCase() === expectedWord.toLowerCase()) {
            wordSpan.textContent = userWord + " ";
            wordSpan.className = "correct"; // Green for correct word
            correctWords++;
        } else {
            wordSpan.textContent = userWord + " ";
            wordSpan.className = "wrong"; // Red for incorrect word
        }

        wordResults.push(wordSpan);
    }

    // Append all word results first
    wordResults.forEach(wordSpan => resultDiv.appendChild(wordSpan));

    // Provide feedback based on the number of correct words
    const resultMessage = document.createElement("p");
    resultMessage.textContent = `${correctWords} out of ${expectedWords.length} words are correct.`;
    resultDiv.appendChild(resultMessage);

    if (userWords.length > expectedWords.length) {
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Incorrect since there are extra words. Try Again!";
        resultDiv.appendChild(errorMessage);
    } else if (correctWords === expectedWords.length && expectedWords.length > 0) {
        const successMessage = document.createElement("p");
        successMessage.textContent = "Great job! All words are correct!";
        resultDiv.appendChild(successMessage);
    } else {
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Some words are incorrect. Try again!";
        resultDiv.appendChild(errorMessage);
    }

    // update session stats
    if (mode === "practice") {
        practiceSessionStats.attempts += 1;
        practiceSessionStats.correctWords += correctWords;
        practiceSessionStats.totalWords += expectedWords.length;
        updatePracticeStatsDisplay();
    } else if (mode === "shuffled") {
        shuffledSessionStats.attempts += 1;
        shuffledSessionStats.correctWords += correctWords;
        shuffledSessionStats.totalWords += expectedWords.length;
        updateShuffledStatsDisplay();
    }

    // update streak
    markPracticeForToday();

    const formattedText1 = document.createElement("h4");
    formattedText1.textContent = "Correct answer:";
    resultDiv.appendChild(formattedText1);

    if (firstLetterHintsEnabled) {
        const hintLabel = document.createElement("h4");
        hintLabel.textContent = "Hint (first letters):";
        resultDiv.appendChild(hintLabel);

        const normalizedExpected = normalizeForComparison("", expectedText).expectedWords;
        const hintLine = normalizedExpected.map(w => (w[0] ? w[0].toUpperCase() : "")).join(" ");
        const hintP = document.createElement("p");
        hintP.textContent = hintLine;
        resultDiv.appendChild(hintP);
    }

    const answerTest = document.createElement("p");
    answerTest.innerHTML = expectedText.replace(/\n/g, '<br>');
    resultDiv.appendChild(answerTest);
}

function normalizeForComparison(userInput, expectedText) {
    if (checkMode === "lenient") {
        const strip = (t) =>
            t
                .toLowerCase()
                .replace(/[.,!?;:()[\]"'“”‘’]/g, "")
                .replace(/\s+/g, " ")
                .trim();
        const user = strip(userInput);
        const expected = strip(expectedText);
        return {
            userWords: user ? user.split(" ") : [],
            expectedWords: expected ? expected.split(" ") : []
        };
    }
    // strict mode: as before
    return {
        userWords: userInput.trim() ? userInput.trim().split(/\s+/) : [],
        expectedWords: expectedText.trim() ? expectedText.trim().split(/\s+/) : []
    };
}

function updateCheckMode(mode) {
    checkMode = mode || "strict";
}

function toggleFirstLetterHints(enabled) {
    firstLetterHintsEnabled = !!enabled;
    // Only affects how user wants to practice; hints shown with correct answer header
}

function updatePracticeStatsDisplay() {
    const progressEl = document.getElementById("practiceProgressText");
    const accuracyEl = document.getElementById("practiceAccuracyText");
    const streakEl = document.getElementById("practiceStreakText");
    const totalEntries = savedEntries.length;
    if (progressEl) {
        progressEl.textContent = `${Math.min(practiceSessionStats.attempts, totalEntries)} / ${totalEntries} practiced`;
    }
    const accuracy =
        practiceSessionStats.totalWords > 0
            ? Math.round((practiceSessionStats.correctWords / practiceSessionStats.totalWords) * 100)
            : 0;
    if (accuracyEl) {
        accuracyEl.textContent = `Accuracy: ${accuracy}%`;
    }
    if (streakEl) {
        const streak = calculateStreak();
        streakEl.textContent = `Streak: ${streak} days`;
    }
}

function updateShuffledStatsDisplay() {
    const progressEl = document.getElementById("shuffledProgressText");
    const totalEntries = savedEntries.length;
    if (progressEl) {
        progressEl.textContent = `${Math.min(shuffledSessionStats.attempts, totalEntries)} / ${totalEntries} practiced`;
    }
}

const STREAK_KEY = "fmapp_streak_v1";
function calculateStreak() {
    try {
        const raw = localStorage.getItem(STREAK_KEY);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!raw) {
            return 0;
        }
        const data = JSON.parse(raw);
        return data.count || 0;
    } catch {
        return 0;
    }
}

function markPracticeForToday() {
    try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const raw = localStorage.getItem(STREAK_KEY);
        if (!raw) {
            localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: todayStr, count: 1 }));
            return;
        }
        const data = JSON.parse(raw);
        if (data.lastDate === todayStr) {
            return;
        }
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().slice(0, 10);
        const nextCount = data.lastDate === yStr ? (data.count || 0) + 1 : 1;
        localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate: todayStr, count: nextCount }));
    } catch {
        // ignore
    }
}

// Get the button
const backToTopBtn = document.getElementById('backToTopBtn');
const smallAddBtn = document.getElementById('smallAddBtn');
const smallSaveBtn = document.getElementById('smallSaveBtn');

// Show/hide the button based on scroll position
window.addEventListener('scroll', () => {
    if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
        smallAddBtn.classList.add('visible');
        smallSaveBtn.classList.add('visible');
    } else {
        backToTopBtn.classList.remove('visible');
        smallAddBtn.classList.remove('visible');
        smallSaveBtn.classList.remove('visible');
    }
});

// Smooth scroll to top when clicked
backToTopBtn.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

// Smooth scroll to top when clicked
smallAddBtn.addEventListener('click', () => { addNewEntry(); });

// Smooth scroll to top when clicked
smallSaveBtn.addEventListener('click', () => { saveAllEntries(); });

function showTabs() {
    if (document.getElementById("TabsDropdown").classList.contains('dropdown-content')) {
        document.getElementById("TabsDropdown").classList.remove('dropdown-content')
        document.getElementById("TabsDropdown").classList.toggle("dropdown-content-show");
    }
    else if (document.getElementById("TabsDropdown").classList.contains('dropdown-content-show')) {
        document.getElementById("TabsDropdown").classList.remove('dropdown-content-show');
        document.getElementById("TabsDropdown").classList.toggle("dropdown-content");
    }
}
  
  // Close the dropdown if the user clicks outside of it
window.onclick = function(event) {
    if (!event.target.matches('#menu-tab')) {
      var dropdowns = document.getElementsByClassName("dropdown-content-show");
      var i;
      for (i = 0; i < dropdowns.length; i++) {
        var openDropdown = dropdowns[i];
        if (openDropdown.classList.contains('dropdown-content-show')) {
          openDropdown.classList.remove('dropdown-content-show');
          openDropdown.classList.toggle("dropdown-content");
        }
      }
    }
}

// Initial load
document.addEventListener("DOMContentLoaded", () => {
    initFirebaseAuth();
});
