// Each entry: { title, content, tags: string[], pinned: boolean, stats: { correctWords, totalWords, attempts } }
const savedEntries = [];
let subjectNotes = ""; // Subject-specific notes content
let checkMode = "strict";
let practiceMode = "full"; // "full" or "cloze"
let clozeDifficulty = 30; // percentage hidden
let firstLetterHintsEnabled = false;
let practiceSessionStats = { attempts: 0, correctWords: 0, totalWords: 0 };
let shuffledSessionStats = { attempts: 0, correctWords: 0, totalWords: 0 };
let currentUser = null;

// --- Folder Management ---
let currentFolder = "default";
let folders = ["default"]; // list of folder IDs
const FOLDER_LIST_KEY = "fmapp_folder_list_v1";

function getStorageKeyForFolder(folderId) {
    if (folderId === "default") return "fmapp_savedEntries_v1"; // Legacy compatibility
    return `fmapp_entries_${folderId}`;
}

function getNotesStorageKey(folderId) {
    return `fmapp_notes_${folderId}`;
}

// --- Persistence helpers ---
// --- Persistence helpers ---
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
        // Load folder list
        const folderListRaw = localStorage.getItem(FOLDER_LIST_KEY);
        if (folderListRaw) {
            folders = JSON.parse(folderListRaw);
        } else {
            folders = ["default"];
        }
        updateFolderSelect();

        // Load current folder entries
        const currentKey = getStorageKeyForFolder(currentFolder);
        const stored = localStorage.getItem(currentKey);
        savedEntries.length = 0; // Clear array ref
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                parsed.forEach(e => savedEntries.push(normalizeEntry(e)));
            }
        }

        // Load current folder notes
        const notesKey = getNotesStorageKey(currentFolder);
        subjectNotes = localStorage.getItem(notesKey) || "";
        loadNotesUI();

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
            // Restore last folder if saved in settings could be a nice touch, but optional
        }
    } catch (e) {
        console.error("Failed to load from storage", e);
    }
}

function saveToStorage() {
    try {
        const currentKey = getStorageKeyForFolder(currentFolder);
        localStorage.setItem(currentKey, JSON.stringify(savedEntries));

        // Also save folder list
        localStorage.setItem(FOLDER_LIST_KEY, JSON.stringify(folders));

        // Save notes
        const notesKey = getNotesStorageKey(currentFolder);
        localStorage.setItem(notesKey, subjectNotes);
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

// --- Folder Management Functions ---
async function switchFolder(folderId) {
    if (folderId === currentFolder) return;

    currentFolder = folderId;

    // Load data for the new folder
    if (currentUser) {
        await loadFromFirestore(true); // true = preserve current folder
    } else {
        loadFromStorage();
    }

    // Refresh views immediately for all tabs
    showEntriesInInputTab();     // Input Tab
    showSavedEntries();          // Saved DB Tab

    // Practice & Shuffled Tabs
    loadPracticeEntry();
    loadShuffledEntry();
    updatePracticeStatsDisplay();
    updateShuffledStatsDisplay();

    // Analytics Tab
    if (typeof initAnalytics === 'function') {
        initAnalytics();
    }

    // SRS Tab
    if (typeof updateSrsStatsDisplay === 'function') {
        updateSrsStatsDisplay();
    }
    if (typeof loadReviewSession === 'function') {
        loadReviewSession();
    }
}

async function createNewFolder() {
    const name = prompt("Enter new subject/folder name:");
    if (!name || !name.trim()) return;

    const id = name.trim();
    if (folders.includes(id)) {
        alert("Folder already exists!");
        switchFolder(id);
        return;
    }

    folders.push(id);
    saveToStorage();

    if (currentUser) {
        console.log("Saving new folder list to cloud...");
        const api = window.firebaseApi;
        const { db, doc, setDoc } = api;

        try {
            // 1. Update folder list metadata
            const metaDocRef = doc(db, "users", currentUser.uid, "metadata", "folders");
            await setDoc(metaDocRef, {
                folders: folders,
                currentFolder: id,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            // 2. Create placeholder document soScanner finds it
            const folderDocRef = doc(db, "users", currentUser.uid, "folders", id);
            await setDoc(folderDocRef, {
                entries: [],
                notes: "", // Initialize notes
                folderId: id,
                lastUpdated: new Date().toISOString()
            });

            console.log(`Folder "${id}" successfully created in cloud.`);
        } catch (e) {
            console.error("Cloud error during folder creation:", e);
        }
    }

    await switchFolder(id);
}

async function renameCurrentFolder() {
    if (currentFolder === "default") {
        alert("Cannot rename the default folder.");
        return;
    }

    const newName = prompt("Enter new name for this subject:", currentFolder);
    if (!newName || !newName.trim() || newName.trim() === currentFolder) return;

    const newId = newName.trim();
    if (folders.includes(newId)) {
        alert("A folder with this name already exists!");
        return;
    }

    const oldFolderId = currentFolder;
    const oldKey = getStorageKeyForFolder(oldFolderId);
    const newKey = getStorageKeyForFolder(newId);

    // 1. Sync Cloud if logged in
    const api = window.firebaseApi;
    if (api && currentUser) {
        const { db, doc, setDoc, deleteDoc, getDoc } = api;
        try {
            console.log(`Renaming cloud folder "${oldFolderId}" to "${newId}"...`);

            // Get data from old folder
            const oldDocRef = doc(db, "users", currentUser.uid, "folders", oldFolderId);
            const oldSnap = await getDoc(oldDocRef);

            let entriesToMove = savedEntries;
            let notesToMove = subjectNotes;

            if (oldSnap.exists()) {
                const cloudData = oldSnap.data();
                if (cloudData.entries) entriesToMove = cloudData.entries;
                if (cloudData.notes) notesToMove = cloudData.notes;
            }

            // Create new doc
            const newDocRef = doc(db, "users", currentUser.uid, "folders", newId);
            await setDoc(newDocRef, {
                entries: entriesToMove,
                notes: notesToMove,
                folderId: newId,
                lastUpdated: new Date().toISOString()
            });

            // Delete old doc
            await deleteDoc(oldDocRef);

            // Update metadata list
            const updatedFolders = folders.map(f => f === oldFolderId ? newId : f);
            const metaDocRef = doc(db, "users", currentUser.uid, "metadata", "folders");
            await setDoc(metaDocRef, {
                folders: updatedFolders,
                currentFolder: newId,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            console.log("Cloud rename complete.");
        } catch (e) {
            console.error("Failed to rename in cloud", e);
            alert("Error syncing rename to cloud. Please check connection.");
            return; // Don't proceed locally if cloud failed and we are online
        }
    }

    // 2. Local Storage Update
    const data = localStorage.getItem(oldKey);
    if (data) {
        localStorage.setItem(newKey, data);
        localStorage.removeItem(oldKey);
    }

    // Also move local notes
    const oldNotesKey = getNotesStorageKey(oldFolderId);
    const newNotesKey = getNotesStorageKey(newId);
    const notesData = localStorage.getItem(oldNotesKey);
    if (notesData) {
        localStorage.setItem(newNotesKey, notesData);
        localStorage.removeItem(oldNotesKey);
    }

    // 3. Update Global State
    const index = folders.indexOf(oldFolderId);
    if (index !== -1) {
        folders[index] = newId;
    }
    currentFolder = newId;

    saveToStorage(); // Updates folder list in localStorage
    updateFolderSelect();

    alert(`Subject renamed to "${newId}".`);
}

async function deleteCurrentFolder() {
    if (currentFolder === "default") {
        alert("Cannot delete the default folder.");
        return;
    }

    if (!confirm(`Are you sure you want to delete folder "${currentFolder}" and all its entries?`)) return;

    const api = window.firebaseApi;
    if (api && currentUser) {
        const { db, doc, deleteDoc, setDoc } = api;
        try {
            // 1. Delete the specific folder document in Firestore
            const folderDocRef = doc(db, "users", currentUser.uid, "folders", currentFolder);
            await deleteDoc(folderDocRef);

            // 2. Update folder list in metadata
            const otherFolders = folders.filter(f => f !== currentFolder);
            const metaDocRef = doc(db, "users", currentUser.uid, "metadata", "folders");
            await setDoc(metaDocRef, {
                folders: otherFolders,
                currentFolder: "default",
                lastUpdated: new Date().toISOString()
            });
            console.log(`Deleted folder "${currentFolder}" from Firestore.`);
        } catch (e) {
            console.error("Failed to delete from Firestore", e);
        }
    }

    // Remove from localStorage
    const key = getStorageKeyForFolder(currentFolder);
    localStorage.removeItem(key);

    // Remove from local list
    folders = folders.filter(f => f !== currentFolder);

    // Switch back to "default"
    currentFolder = "default";
    saveToStorage(); // updates local folder list
    updateFolderSelect(); // CRITICAL: Refresh the UI dropdown

    loadFromStorage();
    showEntriesInInputTab();
    showSavedEntries();

    alert("Folder deleted successfully.");
}

function updateFolderSelect() {
    const select = document.getElementById("folderSelect");
    if (!select) return;

    select.innerHTML = "";
    folders.forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;

        const displayName = f === "default" ? "Default" : f;
        opt.textContent = displayName;
        if (f === currentFolder) opt.selected = true;
        select.appendChild(opt);
    });
}

function addNewEntry() {
    // Collect user input
    // ... rest of checking logic
    const titleVal = document.getElementById("newTitle").value.trim();
    const contentVal = document.getElementById("newContent").value.trim();
    const tagsVal = document.getElementById("newTags").value.trim();
    const tags = tagsVal.split(",").map(t => t.trim()).filter(t => t.length > 0);

    if (!titleVal) {
        alert("Please enter a title.");
        return;
    }
    if (!contentVal) {
        alert("Please enter the content to memorize.");
        return;
    }

    // Add to our in-memory array
    savedEntries.unshift({
        title: titleVal,
        content: contentVal,
        tags: tags,
        pinned: false,
        stats: { correctWords: 0, totalWords: 0, attempts: 0 }
    });

    // Clear inputs
    document.getElementById("newTitle").value = "";
    document.getElementById("newContent").value = "";
    document.getElementById("newTags").value = "";

    // Show updated list
    showEntriesInInputTab();

    // Auto-save to persist changes immediately
    saveToStorage();

    alert("Entry added & saved!");
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

async function logout() {
    const api = window.firebaseApi;
    if (!api) return;
    const { auth, signOut } = api;

    try {
        await signOut(auth);

        // CLEAR APP DATA ONLY - Do not use localStorage.clear() 
        // as it wipes Firebase's own session data!
        savedEntries.length = 0;
        folders.length = 0;
        folders.push("default");
        currentFolder = "default";

        // Remove only our specific keys
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fmapp_')) {
                localStorage.removeItem(key);
            }
        });

        updateFolderSelect();
        showSavedEntries();
        showEntriesInInputTab();
        loadPracticeEntry();
        loadShuffledEntry();
        updatePracticeStatsDisplay();
        updateShuffledStatsDisplay();

        console.log("Logout successful. Local app data cleared.");
    } catch (err) {
        console.error("Logout error:", err);
        alert("Logout failed: " + err.message);
    }
}

async function saveToFirestore() {
    const api = window.firebaseApi;
    if (!api) {
        console.error("Debug: Firebase API not found!");
        return;
    }
    if (!currentUser) {
        console.error("Debug: No current user logged in!");
        return;
    }
    const { db, doc, setDoc } = api;

    try {
        console.log(`Debug: Saving folder "${currentFolder}" to path: users/${currentUser.uid}/folders/${currentFolder}`);

        // Path: users/{uid}/folders/{folderId}
        const folderDocRef = doc(db, "users", currentUser.uid, "folders", currentFolder);

        await setDoc(folderDocRef, {
            entries: savedEntries,
            notes: subjectNotes, // Save notes here
            lastUpdated: new Date().toISOString(),
            folderId: currentFolder
        }, { merge: true }); // Use merge to be safe

        // Save metadata (folder list)
        const metaDocRef = doc(db, "users", currentUser.uid, "metadata", "folders");
        await setDoc(metaDocRef, {
            folders: folders,
            currentFolder: currentFolder,
            lastUpdated: new Date().toISOString()
        }, { merge: true });

        console.log(`Saved successfully to Firestore!`);
    } catch (e) {
        console.error("Failed to save to Firestore", e);
        alert("Firestore Error: " + e.message);
    }
}

async function loadFromFirestore(preserveCurrentFolder = false) {
    const api = window.firebaseApi;
    if (!api || !currentUser) return;

    // API Check
    if (typeof api.getDoc !== 'function') {
        console.error("❌ Firebase getDoc is missing from the bridge! Data cannot be loaded.");
        return;
    }

    const { db, doc, getDoc, collection, getDocs } = api;

    try {
        console.log("🔥 Syncing with Firestore for user:", currentUser.uid);

        // 1. Load folder list metadata first
        const metaDocRef = doc(db, "users", currentUser.uid, "metadata", "folders");
        const metaSnap = await getDoc(metaDocRef);

        let discoveredFolders = [];

        if (metaSnap.exists()) {
            const metadata = metaSnap.data();
            if (metadata.folders && Array.isArray(metadata.folders)) {
                discoveredFolders = metadata.folders;
            }
            // Restore last active folder preference
            if (!preserveCurrentFolder && metadata.currentFolder && discoveredFolders.includes(metadata.currentFolder)) {
                currentFolder = metadata.currentFolder;
            }
        }

        // FOLDER DISCOVERY: Scan the collection to ensure no folders are hidden
        console.log("🔍 Scanning for available folders...");
        const foldersColRef = collection(db, "users", currentUser.uid, "folders");
        const foldersSnap = await getDocs(foldersColRef);

        foldersSnap.forEach(docSnap => {
            const fid = docSnap.id;
            if (!discoveredFolders.includes(fid)) {
                discoveredFolders.push(fid);
            }
        });

        if (!discoveredFolders.includes("default")) {
            discoveredFolders.unshift("default");
        }

        // Apply as authority
        folders.length = 0;
        discoveredFolders.forEach(f => folders.push(f));
        console.log("✅ Final folder list synced:", folders);
        updateFolderSelect();

        // 2. Load entries for the specific current folder
        console.log(`📂 Loading entries for folder: "${currentFolder}"`);
        const folderDocRef = doc(db, "users", currentUser.uid, "folders", currentFolder);
        const folderSnap = await getDoc(folderDocRef);

        savedEntries.length = 0;

        if (folderSnap.exists()) {
            const data = folderSnap.data();
            if (data.entries && Array.isArray(data.entries)) {
                data.entries.forEach(e => savedEntries.push(normalizeEntry(e)));
                console.log(`⭐ Loaded ${savedEntries.length} entries for "${currentFolder}"`);
            }
            subjectNotes = data.notes || ""; // Load notes
            console.log("📓 Notes synced from cloud.");
        } else {
            console.log(`ℹ️ No entries for "${currentFolder}" in cloud.`);

            // LEGACY MIGRATION: 
            if (currentFolder === "default") {
                console.log("Checking for legacy data in 'entries' collection...");
                const legacyColRef = collection(db, "users", currentUser.uid, "entries");
                const legacySnap = await getDocs(legacyColRef);

                if (!legacySnap.empty) {
                    console.log("Found legacy data! Migrating to 'default' folder...");
                    legacySnap.forEach(docSnap => {
                        savedEntries.push(normalizeEntry(docSnap.data()));
                    });
                    await saveToFirestore();
                }
            }
        }

        saveToStorage(); // Update local cache
        showSavedEntries();
        showEntriesInInputTab();
        loadPracticeEntry();
        loadShuffledEntry();
        updatePracticeStatsDisplay();
        updateShuffledStatsDisplay();
        loadNotesUI(); // Refresh the textarea if visible
    } catch (e) {
        console.error("❌ Firestore Sync Error:", e);
        loadFromStorage();
    }
}

function switchTab(index) {
    console.log("switchTab called with index:", index);

    // 1. Force close mobile dropdown IMMEDIATELY
    const dropdown = document.getElementById("TabsDropdown");
    if (dropdown) {
        if (dropdown.classList.contains('dropdown-content-show')) {
            console.log("Closing dropdown menu");
            dropdown.classList.remove('dropdown-content-show');
            dropdown.classList.add('dropdown-content');
        }
    }

    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    // Deactivate all tabs and contents
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    // Activate content
    if (contents[index]) {
        contents[index].classList.add('active');
    }

    // Activate Desktop Tab (0-5)
    if (tabs[index]) {
        tabs[index].classList.add('active');
    }

    // Activate Mobile Tab (6-13) - assuming sequential order in DOM
    // There are 6 tabs per set. Mobile set starts at index 7.
    if (tabs[index + 6]) {
        tabs[index + 6].classList.add('active');
    }

    // Review (SRS)
    if (index === 4 && typeof updateSrsStatsDisplay === 'function') {
        updateSrsStatsDisplay();
    }

    // Notes
    if (index === 5) {
        loadNotesUI();
    }

    // Hide floating buttons if not input tab
    const smallAddBtn = document.getElementById('smallAddBtn');
    const smallSaveBtn = document.getElementById('smallSaveBtn');
    if (index !== 0) {
        if (smallAddBtn) smallAddBtn.classList.remove('visible');
        if (smallSaveBtn) smallSaveBtn.classList.remove('visible');
    }
}

// ========== SUBJECT NOTES LOGIC ==========

function loadNotesUI() {
    const area = document.getElementById("subjectNotesArea");
    if (area) {
        area.innerHTML = subjectNotes || "";
        updateNotesCounter();
    }
}

function updateNotesCounter() {
    const area = document.getElementById("subjectNotesArea");
    const counter = document.getElementById("notesCounter");
    if (!area || !counter) return;

    const text = area.innerText.trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).length : 0;
    counter.textContent = `${words} words | ${chars} chars`;
}

function formatDoc(cmd, value = null) {
    document.execCommand(cmd, false, value);
    const area = document.getElementById("subjectNotesArea");
    if (area) area.focus();
    autoSaveNotes();
}

/**
 * NEW: Convert notes content into Memory Entries (Flashcards)
 */
function convertNotesToEntries() {
    const area = document.getElementById("subjectNotesArea");
    if (!area) return;

    // We extract paragraphs or bold sections as potential flashcards
    // For now, let's split by double newlines or div/p tags
    const text = area.innerText.trim();
    if (!text) {
        alert("No text to convert!");
        return;
    }

    const lines = text.split(/\n\n+/).filter(l => l.trim().length > 5);

    if (lines.length === 0) {
        alert("Could not find any long paragraphs to convert.");
        return;
    }

    if (!confirm(`Found ${lines.length} potential entries. Would you like to import them into your current subject?`)) return;

    lines.forEach(line => {
        // Simple heuristic: First sentence is title, rest is content
        const parts = line.split(/[.!?]\s/);
        const title = parts[0].substring(0, 50).trim();
        const content = line.trim();

        savedEntries.push({
            title: title + "...",
            content: content,
            tags: ["imported-from-notes"],
            pinned: false,
            stats: { correctWords: 0, totalWords: 0, attempts: 0 }
        });
    });

    saveToStorage();
    if (currentUser) saveToFirestore();

    showSavedEntries();
    alert(`Success! Imported ${lines.length} entries. Check the 'Saved Entries' tab.`);
}

function copyNotes() {
    const area = document.getElementById("subjectNotesArea");
    if (!area) return;

    const range = document.createRange();
    range.selectNode(area);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('copy');
    window.getSelection().removeAllRanges();

    const status = document.getElementById("notesStatus");
    if (status) {
        const original = status.textContent;
        status.textContent = "📋 Copied!";
        status.style.color = "var(--primary-color)";
        setTimeout(() => {
            status.textContent = original;
            status.style.color = "";
        }, 2000);
    }
}

function downloadNotes() {
    if (!subjectNotes) return;
    // Strip HTML for .txt download
    const area = document.getElementById("subjectNotesArea");
    const plainText = area ? area.innerText : subjectNotes.replace(/<[^>]*>/g, '');

    const blob = new Blob([plainText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFolder}_notes.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}

function exportNotesToPDF() {
    if (!subjectNotes) {
        alert("Notes are empty!");
        return;
    }

    try {
        // Fix for jsPDF UMD version
        const { jsPDF } = window.jspdf || window;
        if (!jsPDF) {
            alert("PDF engine not loaded yet. Please wait a moment.");
            return;
        }

        const doc = new jsPDF();

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235); // Blue primary color
        doc.text(`${currentFolder.toUpperCase()} NOTES`, 20, 25);

        // Line break
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 30, 190, 30);

        // Content
        const area = document.getElementById("subjectNotesArea");
        const plainText = area ? area.innerText : subjectNotes.replace(/<[^>]*>/g, '');

        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const splitText = doc.splitTextToSize(plainText, 170);
        doc.text(splitText, 20, 45);

        doc.save(`${currentFolder}_notes.pdf`);
    } catch (e) {
        console.error("PDF Export failed:", e);
        alert("PDF Export failed. Check console for details.");
    }
}

function toggleNotesFullscreen() {
    const container = document.querySelector(".notes-container");
    if (!container) return;

    container.classList.toggle("fullscreen");
    const btn = document.querySelector('[onclick="toggleNotesFullscreen()"]');
    if (btn) {
        const isFull = container.classList.contains("fullscreen");
        btn.innerHTML = isFull ? '<i class="ph ph-arrows-in"></i> Shrink' : '<i class="ph ph-arrows-out"></i> Expand';
    }
}

function clearNotes() {
    if (!confirm("Are you sure you want to clear ALL notes for this subject? This cannot be undone.")) return;

    const area = document.getElementById("subjectNotesArea");
    if (area) {
        area.innerHTML = "";
        autoSaveNotes();
        updateNotesCounter();
    }
}

let autoSaveTimeout = null;
function autoSaveNotes() {
    const area = document.getElementById("subjectNotesArea");
    const status = document.getElementById("notesStatus");
    if (!area) return;

    subjectNotes = area.innerHTML; // Store HTML
    updateNotesCounter(); // Update counter on input

    if (status) status.textContent = "Saving...";

    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

    autoSaveTimeout = setTimeout(async () => {
        // 1. Save locally
        const key = getNotesStorageKey(currentFolder);
        localStorage.setItem(key, subjectNotes);

        // 2. Save to cloud if logged in
        if (currentUser) {
            await saveToFirestore();
        }

        if (status) status.textContent = "Saved to cloud & local";
    }, 1000); // 1 second debounce
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
    tagsLabel.textContent = "Tags:";
    const tagsInput = document.createElement("input");
    tagsInput.type = "text";
    tagsInput.classList.add("tags-input");

    // Action buttons toolbar
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "entry-actions";

    const pinButton = document.createElement("button");
    pinButton.innerHTML = '<i class="ph ph-push-pin"></i>';
    pinButton.title = "Pin Entry";
    pinButton.classList.add("pin-button", "icon-btn");
    pinButton.onclick = () => {
        pinButton.classList.toggle("pinned");
        if (pinButton.classList.contains("pinned")) {
            pinButton.innerHTML = '<i class="ph-fill ph-push-pin"></i>';
        } else {
            pinButton.innerHTML = '<i class="ph ph-push-pin"></i>';
        }
    };

    const deleteButton = document.createElement("button");
    deleteButton.innerHTML = '<i class="ph ph-trash"></i>';
    deleteButton.title = "Delete Entry";
    deleteButton.classList.add("delete-button", "icon-btn");
    deleteButton.onclick = () => {
        container.remove();
        updateEntryNumbers();
    };

    const clearTitleButton = document.createElement("button");
    clearTitleButton.innerHTML = '<i class="ph ph-eraser"></i> Title';
    clearTitleButton.title = "Clear Title";
    clearTitleButton.classList.add("clear-title-button", "icon-btn-text");
    clearTitleButton.onclick = () => {
        titleInput.value = "";
    }

    const clearContentButton = document.createElement("button");
    clearContentButton.innerHTML = '<i class="ph ph-eraser"></i> Content';
    clearContentButton.title = "Clear Content";
    clearContentButton.classList.add("clear-content-button", "icon-btn-text");
    clearContentButton.onclick = () => {
        contentInput.value = "";
    }

    const moveUpButton = document.createElement("button");
    moveUpButton.innerHTML = '<i class="ph ph-caret-up"></i>';
    moveUpButton.title = "Move Up";
    moveUpButton.classList.add("move-up-button", "icon-btn");
    moveUpButton.onclick = () => {
        const prev = container.previousElementSibling;
        if (prev && prev.classList.contains("entry-container")) {
            container.parentNode.insertBefore(container, prev);
            updateEntryNumbers();
        }
    };

    const moveDownButton = document.createElement("button");
    moveDownButton.innerHTML = '<i class="ph ph-caret-down"></i>';
    moveDownButton.title = "Move Down";
    moveDownButton.classList.add("move-down-button", "icon-btn");
    moveDownButton.onclick = () => {
        const next = container.nextElementSibling;
        if (next && next.classList.contains("entry-container")) {
            container.parentNode.insertBefore(next, container);
            updateEntryNumbers();
        }
    };

    actionsDiv.appendChild(moveUpButton);
    actionsDiv.appendChild(moveDownButton);
    actionsDiv.appendChild(pinButton);
    actionsDiv.appendChild(clearTitleButton);
    actionsDiv.appendChild(clearContentButton);
    actionsDiv.appendChild(deleteButton);

    container.appendChild(titleLabel);
    container.appendChild(titleInput);
    container.appendChild(contentLabel);
    container.appendChild(contentInput);
    container.appendChild(tagsLabel);
    container.appendChild(tagsInput);
    container.appendChild(actionsDiv);

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

        // Action buttons toolbar
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "entry-actions";

        const pinButton = document.createElement("button");
        pinButton.innerHTML = entry.pinned ? '<i class="ph-fill ph-push-pin"></i>' : '<i class="ph ph-push-pin"></i>';
        pinButton.title = "Pin Entry";
        pinButton.classList.add("pin-button", "icon-btn");
        if (entry.pinned) pinButton.classList.add("pinned");
        pinButton.onclick = () => {
            pinButton.classList.toggle("pinned");
            if (pinButton.classList.contains("pinned")) {
                pinButton.innerHTML = '<i class="ph-fill ph-push-pin"></i>';
            } else {
                pinButton.innerHTML = '<i class="ph ph-push-pin"></i>';
            }
        };

        const deleteButton = document.createElement("button");
        deleteButton.innerHTML = '<i class="ph ph-trash"></i>';
        deleteButton.title = "Delete Entry";
        deleteButton.classList.add("delete-button", "icon-btn");
        deleteButton.onclick = () => {
            container.remove();
            updateEntryNumbers();
        };

        const clearTitleButton = document.createElement("button");
        clearTitleButton.innerHTML = '<i class="ph ph-eraser"></i> Title';
        clearTitleButton.title = "Clear Title";
        clearTitleButton.classList.add("clear-title-button", "icon-btn-text");
        clearTitleButton.onclick = () => {
            titleInput.value = "";
        }

        const clearContentButton = document.createElement("button");
        clearContentButton.innerHTML = '<i class="ph ph-eraser"></i> Content';
        clearContentButton.title = "Clear Content";
        clearContentButton.classList.add("clear-content-button", "icon-btn-text");
        clearContentButton.onclick = () => {
            contentInput.value = "";
        }

        const moveUpButton = document.createElement("button");
        moveUpButton.innerHTML = '<i class="ph ph-caret-up"></i>';
        moveUpButton.title = "Move Up";
        moveUpButton.classList.add("move-up-button", "icon-btn");
        moveUpButton.onclick = () => {
            const prev = container.previousElementSibling;
            if (prev && prev.classList.contains("entry-container")) {
                container.parentNode.insertBefore(container, prev);
                updateEntryNumbers();
            }
        };

        const moveDownButton = document.createElement("button");
        moveDownButton.innerHTML = '<i class="ph ph-caret-down"></i>';
        moveDownButton.title = "Move Down";
        moveDownButton.classList.add("move-down-button", "icon-btn");
        moveDownButton.onclick = () => {
            const next = container.nextElementSibling;
            if (next && next.classList.contains("entry-container")) {
                container.parentNode.insertBefore(next, container);
                updateEntryNumbers();
            }
        };

        actionsDiv.appendChild(moveUpButton);
        actionsDiv.appendChild(moveDownButton);
        actionsDiv.appendChild(pinButton);
        actionsDiv.appendChild(clearTitleButton);
        actionsDiv.appendChild(clearContentButton);
        actionsDiv.appendChild(deleteButton);

        container.appendChild(titleLabel);
        container.appendChild(titleInput);
        container.appendChild(contentLabel);
        container.appendChild(contentInput);
        container.appendChild(tagsLabel);
        container.appendChild(tagsInput);
        container.appendChild(actionsDiv);

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

    savedEntries.forEach((entry, index) => {
        // Create a container for each entry's practice area
        const entryContainer = document.createElement("div");
        entryContainer.classList.add("entry-container");

        // Create the title
        const title = document.createElement("h3");
        title.textContent = `Title: ${entry.title}`;
        entryContainer.appendChild(title);

        if (practiceMode === "cloze") {
            renderClozeEntry(entry, entryContainer);
        } else {
            renderFullTypingEntry(entry, entryContainer);
        }

        // Append to the practice area
        practiceArea.appendChild(entryContainer);
    });
}

function renderFullTypingEntry(entry, container) {
    const input = document.createElement("textarea");
    input.rows = 3;
    input.placeholder = "Type the content from memory...";

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "10px";

    const checkButton = document.createElement("button");
    checkButton.innerHTML = '<i class="ph ph-check"></i> Check';

    // Create the result div
    const result = document.createElement("div");
    result.className = "result";

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
    clearAnswerButton.innerHTML = '<i class="ph ph-eraser"></i> Clear';
    clearAnswerButton.classList.add("secondary-btn");
    clearAnswerButton.onclick = () => {
        input.value = "";
    }

    buttonContainer.appendChild(checkButton);
    buttonContainer.appendChild(clearAnswerButton);

    container.appendChild(input);
    container.appendChild(buttonContainer);
    container.appendChild(result);
}

function renderClozeEntry(entry, container) {
    const text = entry.content;
    const words = text.split(/\s+/);
    const clozeContainer = document.createElement("div");
    clozeContainer.className = "cloze-container";

    // Deterministic random seeding based on text length + difficulty to keep it stable during a session if needed
    // But for practice, random is good. We'll store the indices of hidden words on the container.
    const hiddenIndices = new Set();
    const totalWords = words.length;
    const numToHide = Math.max(1, Math.floor(totalWords * (clozeDifficulty / 100)));

    while (hiddenIndices.size < numToHide) {
        hiddenIndices.add(Math.floor(Math.random() * totalWords));
    }

    const inputs = [];

    words.forEach((word, i) => {
        if (hiddenIndices.has(i)) {
            // Keep punctuation if possible, simple heuristic
            const match = word.match(/^([a-zA-Z0-9'’-]+)(.*)$/);
            if (match) {
                const hiddenPart = match[1];
                const punctuation = match[2];

                const input = document.createElement("input");
                input.type = "text";
                input.className = "cloze-input";
                input.dataset.answer = hiddenPart;
                // Auto-adjust width roughly
                input.style.width = Math.max(60, hiddenPart.length * 12) + "px";

                clozeContainer.appendChild(input);
                inputs.push(input);

                if (punctuation) {
                    const span = document.createElement("span");
                    span.textContent = punctuation + " ";
                    clozeContainer.appendChild(span);
                } else {
                    // spacing if no punctuation
                    const span = document.createElement("span");
                    span.textContent = " ";
                    clozeContainer.appendChild(span);
                }
            } else {
                // Symbols or weird formatting, just show it
                const span = document.createElement("span");
                span.textContent = word + " ";
                clozeContainer.appendChild(span);
            }
        } else {
            const span = document.createElement("span");
            span.textContent = word + " ";
            clozeContainer.appendChild(span);
        }
    });

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "10px";

    const checkButton = document.createElement("button");
    checkButton.innerHTML = '<i class="ph ph-check"></i> Check Words';
    checkButton.onclick = () => {
        let correctCount = 0;
        inputs.forEach(input => {
            const val = input.value.trim();
            const ans = input.dataset.answer;
            // Case insensitive check
            if (val.toLowerCase() === ans.toLowerCase()) {
                input.classList.add("correct");
                input.classList.remove("wrong");
                correctCount++;
            } else {
                input.classList.add("wrong");
                input.classList.remove("correct");
            }
        });

        // Update stats slightly differently for cloze?
        // For simplicity, we just count "correct words" as the hidden ones filled correctly.
        practiceSessionStats.attempts++;
        practiceSessionStats.correctWords += correctCount;
        practiceSessionStats.totalWords += inputs.length;
        updatePracticeStatsDisplay();

        if (correctCount === inputs.length) {
            markPracticeForToday();
            // maybe visual flair?
        }
    };

    const resetButton = document.createElement("button");
    resetButton.innerHTML = '<i class="ph ph-arrows-clockwise"></i> New Blanks';
    resetButton.className = "secondary-btn";
    resetButton.onclick = () => {
        // re-render this specific entry container? 
        // Simpler to just re-call renderClozeEntry but we need to clear container.
        // For now, simpler to reload efficienty:
        loadPracticeEntry();
    };

    buttonContainer.appendChild(checkButton);
    buttonContainer.appendChild(resetButton);

    container.appendChild(clozeContainer);
    container.appendChild(buttonContainer);
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

        // Create a container for buttons
        const buttonContainer = document.createElement("div");
        buttonContainer.style.display = "flex";
        buttonContainer.style.gap = "10px";
        buttonContainer.style.marginTop = "10px";

        // Create the check button
        const checkButton = document.createElement("button");
        checkButton.innerHTML = '<i class="ph ph-check"></i> Check';
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
        clearAnswerButton.innerHTML = '<i class="ph ph-eraser"></i> Clear';
        clearAnswerButton.classList.add("secondary-btn");
        clearAnswerButton.onclick = () => {
            input.value = "";
        }

        buttonContainer.appendChild(checkButton);
        buttonContainer.appendChild(clearAnswerButton);

        // Create the result div to show correct/wrong text
        const result = document.createElement("div");
        result.className = "result";

        // Append all elements to the entry container
        entryContainer.appendChild(title);
        entryContainer.appendChild(input);
        entryContainer.appendChild(buttonContainer);
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

function updatePracticeMode(mode) {
    practiceMode = mode;
    const settings = document.getElementById("clozeSettings");
    if (settings) {
        settings.style.display = (mode === "cloze") ? "flex" : "none";
    }
    loadPracticeEntry();
}

function reloadPractice() {
    const slider = document.getElementById("clozeDifficulty");
    const display = document.getElementById("clozeDifficultyVal");
    if (slider && display) {
        clozeDifficulty = parseInt(slider.value, 10);
        display.textContent = clozeDifficulty + "%";
    }
    loadPracticeEntry();
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

// Show/hide the button based on scroll position AND active tab
window.addEventListener('scroll', () => {
    const activeTab = document.querySelector('.tab-content.active');
    const isInputTab = activeTab && activeTab.id === 'inputTab';

    if (window.pageYOffset > 300) {
        backToTopBtn.classList.add('visible');
        // Only show Add/Save buttons on Input tab
        if (isInputTab) {
            smallAddBtn.classList.add('visible');
            smallSaveBtn.classList.add('visible');
        }
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
window.onclick = function (event) {
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

// ========== PHASE 1 FEATURES ==========

// --- CSV Export/Import ---
function downloadCsv() {
    const filename = prompt("Enter a filename for your CSV (without .csv):");
    if (!filename) return;

    // CSV Header
    let csv = "Title,Content,Tags,Pinned\n";

    // CSV Rows
    savedEntries.forEach(entry => {
        const title = escapeCsv(entry.title);
        const content = escapeCsv(entry.content);
        const tags = escapeCsv((entry.tags || []).join("; "));
        const pinned = entry.pinned ? "Yes" : "No";
        csv += `${title},${content},${tags},${pinned}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
}

function escapeCsv(str) {
    if (!str) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
}

function loadFromCsv() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const csv = event.target.result;
                const lines = csv.split("\n");
                const entries = [];

                // Skip header
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const parsed = parseCsvLine(line);
                    if (parsed.length >= 2) {
                        entries.push({
                            title: parsed[0] || "",
                            content: parsed[1] || "",
                            tags: parsed[2] ? parsed[2].split(";").map(t => t.trim()).filter(Boolean) : [],
                            pinned: parsed[3] === "Yes",
                            stats: { correctWords: 0, totalWords: 0, attempts: 0 }
                        });
                    }
                }

                if (entries.length === 0) {
                    alert("No valid entries found in CSV");
                    return;
                }

                const mode = confirm(`Found ${entries.length} entries.\n\nClick OK to REPLACE existing entries, or Cancel to MERGE with them.`) ? "replace" : "merge";

                if (mode === "replace") {
                    savedEntries.length = 0;
                }

                entries.forEach(e => savedEntries.push(e));
                saveToStorage();
                showSavedEntries();
                showEntriesInInputTab();
                loadPracticeEntry();
                loadShuffledEntry();
                alert(`Successfully imported ${entries.length} entries!`);
            } catch (err) {
                console.error(err);
                alert("Error loading CSV: " + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// --- Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + S: Save all entries
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveAllEntries();
        return;
    }

    // Ctrl/Cmd + N: Add new entry (only on input tab)
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        const activeTab = document.querySelector(".tab-content.active");
        if (activeTab && activeTab.id === "inputTab") {
            e.preventDefault();
            addNewEntry();
            return;
        }
    }

    // Ctrl/Cmd + E: Export JSON
    if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        downloadJson();
        return;
    }

    // Ctrl/Cmd + Shift + E: Export CSV
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        downloadCsv();
        return;
    }

    // Ctrl/Cmd + I: Import JSON
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        loadFromJson();
        return;
    }

    // Ctrl/Cmd + Shift + I: Import CSV
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "I") {
        e.preventDefault();
        loadFromCsv();
        return;
    }

    // Ctrl/Cmd + D: Toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        toggleDarkMode();
        return;
    }

    // Ctrl/Cmd + 1-4: Switch tabs
    if ((e.ctrlKey || e.metaKey) && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        switchTab(tabIndex);
        return;
    }

    // Escape: Clear search/filters
    if (e.key === "Escape") {
        const activeTab = document.querySelector(".tab-content.active");
        if (activeTab && activeTab.id === "savedTab") {
            const searchInput = document.getElementById("searchInput");
            const tagFilterInput = document.getElementById("tagFilterInput");
            const showPinnedOnly = document.getElementById("showPinnedOnly");

            if (searchInput) searchInput.value = "";
            if (tagFilterInput) tagFilterInput.value = "";
            if (showPinnedOnly) showPinnedOnly.checked = false;
            applySearchAndFilters();
        }
    }
});

// Show keyboard shortcuts help
function showKeyboardShortcuts() {
    const shortcuts = `
📋 KEYBOARD SHORTCUTS

Navigation:
  Ctrl/Cmd + 1-4    Switch between tabs
  
Input Tab:
  Ctrl/Cmd + N      Add new entry
  Ctrl/Cmd + S      Save all entries
  
Export/Import:
  Ctrl/Cmd + E      Export as JSON
  Ctrl/Cmd + Shift + E    Export as CSV
  Ctrl/Cmd + I      Import JSON
  Ctrl/Cmd + Shift + I    Import CSV
  
Practice:
  Enter             Check answer (in textarea)
  Escape            Clear input
  
Other:
  Ctrl/Cmd + D      Toggle dark mode
  Escape            Clear filters (Saved tab)
    `.trim();

    alert(shortcuts);
}

// --- Reverse Practice Mode ---
let reversePracticeMode = false;

function toggleReversePractice() {
    reversePracticeMode = !reversePracticeMode;
    const btn = document.getElementById("reversePracticeToggle");
    if (btn) {
        btn.textContent = reversePracticeMode ? "🔄 Reverse: ON" : "🔄 Reverse: OFF";
        btn.classList.toggle("active", reversePracticeMode);
    }
    loadPracticeEntry();
}

// Update loadPracticeEntry to support reverse mode
const originalLoadPracticeEntry = loadPracticeEntry;
loadPracticeEntry = function () {
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

    savedEntries.forEach((entry, index) => {
        const entryContainer = document.createElement("div");
        entryContainer.classList.add("entry-container");

        // Swap title and content if reverse mode is on
        const displayTitle = reversePracticeMode ? entry.content : entry.title;
        const expectedAnswer = reversePracticeMode ? entry.title : entry.content;

        const title = document.createElement("h3");
        title.textContent = `${reversePracticeMode ? 'Content' : 'Title'}: ${displayTitle}`;
        entryContainer.appendChild(title);

        if (practiceMode === "cloze" && !reversePracticeMode) {
            // Cloze mode doesn't work well in reverse, skip
            renderClozeEntry(entry, entryContainer);
        } else {
            renderFullTypingEntryCustom(entry, entryContainer, displayTitle, expectedAnswer);
        }

        practiceArea.appendChild(entryContainer);
    });
};

function renderFullTypingEntryCustom(entry, container, displayTitle, expectedAnswer) {
    const input = document.createElement("textarea");
    input.rows = 3;
    input.placeholder = `Type the ${reversePracticeMode ? 'title' : 'content'} from memory...`;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.gap = "10px";
    buttonContainer.style.marginTop = "10px";

    const checkButton = document.createElement("button");
    checkButton.innerHTML = '<i class="ph ph-check"></i> Check';

    const result = document.createElement("div");
    result.className = "result";

    checkButton.onclick = () => compareText(input.value, expectedAnswer, result, "practice");

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            checkButton.click();
        } else if (e.key === "Escape") {
            input.value = "";
        }
    });

    const clearAnswerButton = document.createElement("button");
    clearAnswerButton.innerHTML = '<i class="ph ph-eraser"></i> Clear';
    clearAnswerButton.classList.add("secondary-btn");
    clearAnswerButton.onclick = () => {
        input.value = "";
    };

    buttonContainer.appendChild(checkButton);
    buttonContainer.appendChild(clearAnswerButton);

    container.appendChild(input);
    container.appendChild(buttonContainer);
    container.appendChild(result);
}

// ========== PHASE 2: SRS INTEGRATION ==========

let currentReviewSession = [];
let currentReviewIndex = 0;

// Update SRS stats display
function updateSrsStatsDisplay() {
    const stats = getSrsStats();

    const dueEl = document.getElementById("srsDueCount");
    const learningEl = document.getElementById("srsLearningCount");
    const youngEl = document.getElementById("srsYoungCount");
    const matureEl = document.getElementById("srsMatureCount");

    if (dueEl) dueEl.textContent = stats.due;
    if (learningEl) learningEl.textContent = stats.learning;
    if (youngEl) youngEl.textContent = stats.young;
    if (matureEl) matureEl.textContent = stats.mature;
}

// Load review session
function loadReviewSession(mode = 'due') {
    const reviewContainer = document.getElementById("reviewContainer");
    const reviewContent = document.getElementById("reviewContent");

    if (!reviewContainer || !reviewContent) return;

    // Get entries to review
    if (mode === 'all') {
        currentReviewSession = [...savedEntries];
    } else {
        currentReviewSession = getDueEntries();
    }

    if (currentReviewSession.length === 0) {
        reviewContainer.innerHTML = "<p>🎉 No entries due for review! Come back later.</p>";
        reviewContent.innerHTML = "";
        return;
    }

    currentReviewIndex = 0;
    reviewContainer.innerHTML = "";
    showCurrentReviewCard();
}

// Show current review card
function showCurrentReviewCard() {
    const reviewContent = document.getElementById("reviewContent");
    if (!reviewContent) return;

    if (currentReviewIndex >= currentReviewSession.length) {
        // Session complete!
        reviewContent.innerHTML = `
            <div class="entry-container" style="text-align: center; padding: 40px;">
                <h2>🎉 Review Session Complete!</h2>
                <p>You reviewed ${currentReviewSession.length} ${currentReviewSession.length === 1 ? 'entry' : 'entries'}.</p>
                <button onclick="loadReviewSession()" style="margin-top: 20px;">
                    <i class="ph ph-arrow-clockwise"></i> Start New Session
                </button>
            </div>
        `;
        updateSrsStatsDisplay();
        return;
    }

    const entry = currentReviewSession[currentReviewIndex];
    const srs = initSrsData(entry);

    reviewContent.innerHTML = "";

    const container = document.createElement("div");
    container.className = "entry-container";

    // Progress indicator
    const progress = document.createElement("div");
    progress.style.marginBottom = "16px";
    progress.style.fontSize = "14px";
    progress.style.color = "var(--text-muted)";
    progress.innerHTML = `
        <strong>Progress:</strong> ${currentReviewIndex + 1} / ${currentReviewSession.length}
        <span class="srs-info ${getSrsClass(entry)}">${getSrsLabel(entry)}</span>
    `;
    container.appendChild(progress);

    // Title
    const title = document.createElement("h3");
    title.textContent = `Title: ${entry.title}`;
    container.appendChild(title);

    // Input area
    const input = document.createElement("textarea");
    input.rows = 4;
    input.placeholder = "Type the content from memory...";
    input.id = "reviewInput";
    container.appendChild(input);

    // Show answer button
    const showAnswerBtn = document.createElement("button");
    showAnswerBtn.innerHTML = '<i class="ph ph-eye"></i> Show Answer';
    showAnswerBtn.className = "secondary-btn";
    showAnswerBtn.style.marginTop = "12px";
    showAnswerBtn.onclick = () => showReviewAnswer(entry, input.value);
    container.appendChild(showAnswerBtn);

    // Result area (hidden initially)
    const resultDiv = document.createElement("div");
    resultDiv.id = "reviewResult";
    resultDiv.className = "result";
    resultDiv.style.display = "none";
    container.appendChild(resultDiv);

    // Difficulty buttons (hidden initially)
    const difficultyDiv = document.createElement("div");
    difficultyDiv.id = "difficultyButtons";
    difficultyDiv.className = "difficulty-buttons";
    difficultyDiv.style.display = "none";
    difficultyDiv.innerHTML = `
        <button class="difficulty-btn again" onclick="rateReview(0)">
            <div>Again</div>
            <small>${formatInterval(1)}</small>
        </button>
        <button class="difficulty-btn hard" onclick="rateReview(2)">
            <div>Hard</div>
            <small>${formatInterval(Math.max(1, Math.round(srs.interval * 1.2)))}</small>
        </button>
        <button class="difficulty-btn good" onclick="rateReview(4)">
            <div>Good</div>
            <small>${formatInterval(getNextInterval(srs, 4))}</small>
        </button>
        <button class="difficulty-btn easy" onclick="rateReview(5)">
            <div>Easy</div>
            <small>${formatInterval(getNextInterval(srs, 5))}</small>
        </button>
    `;
    container.appendChild(difficultyDiv);

    reviewContent.appendChild(container);

    // Focus input
    input.focus();

    // Enter to show answer
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            showAnswerBtn.click();
        }
    });
}

// Get next interval for preview
function getNextInterval(srs, quality) {
    const tempSrs = calculateNextReview(srs, quality);
    return tempSrs.interval;
}

// Show answer and enable rating
function showReviewAnswer(entry, userInput) {
    const resultDiv = document.getElementById("reviewResult");
    const difficultyDiv = document.getElementById("difficultyButtons");

    if (!resultDiv || !difficultyDiv) return;

    // Show comparison
    resultDiv.innerHTML = "";
    resultDiv.style.display = "block";

    const normalized = normalizeForComparison(userInput, entry.content);
    const userWords = normalized.userWords;
    const expectedWords = normalized.expectedWords;

    let correctWords = 0;
    const wordResults = [];

    for (let i = 0; i < Math.max(userWords.length, expectedWords.length); i++) {
        const expectedWord = expectedWords[i] || "";
        const userWord = userWords[i] || "";

        if (i < userWords.length) {
            const wordSpan = document.createElement("span");
            if (userWord.toLowerCase() === expectedWord.toLowerCase()) {
                wordSpan.textContent = userWord + " ";
                wordSpan.className = "correct";
                correctWords++;
            } else {
                wordSpan.textContent = userWord + " ";
                wordSpan.className = "wrong";
            }
            wordResults.push(wordSpan);
        }
    }

    wordResults.forEach(span => resultDiv.appendChild(span));

    const stats = document.createElement("p");
    stats.innerHTML = `<strong>${correctWords} / ${expectedWords.length} words correct</strong>`;
    resultDiv.appendChild(stats);

    const correctAnswer = document.createElement("div");
    correctAnswer.innerHTML = `<h4>Correct Answer:</h4><p>${entry.content.replace(/\n/g, '<br>')}</p>`;
    resultDiv.appendChild(correctAnswer);

    // Show difficulty buttons
    difficultyDiv.style.display = "flex";

    // Auto-suggest quality based on accuracy
    const accuracy = expectedWords.length > 0 ? correctWords / expectedWords.length : 0;
    const suggestedQuality = calculateQualityFromAccuracy(correctWords, expectedWords.length);

    // Highlight suggested button
    const buttons = difficultyDiv.querySelectorAll(".difficulty-btn");
    buttons.forEach((btn, idx) => {
        const qualities = [0, 2, 4, 5];
        if (qualities[idx] === suggestedQuality) {
            btn.style.opacity = "1";
            btn.style.fontWeight = "700";
        } else {
            btn.style.opacity = "0.7";
        }
    });
}

// Rate the review
function rateReview(quality) {
    const entry = currentReviewSession[currentReviewIndex];
    ratePracticeAttempt(entry, quality);

    // Move to next card
    currentReviewIndex++;
    showCurrentReviewCard();
}

// Get SRS class for styling
function getSrsClass(entry) {
    const srs = initSrsData(entry);
    if (isDue(entry)) return "due";
    if (srs.repetitions === 0) return "learning";
    if (srs.interval >= 21) return "mature";
    return "young";
}

// Get SRS label
function getSrsLabel(entry) {
    const srs = initSrsData(entry);
    if (isDue(entry)) return "Due";
    if (srs.repetitions === 0) return "New";
    return getNextReviewDisplay(entry);
}

// Reset all SRS data
function resetAllSrsData() {
    if (!confirm("This will reset all spaced repetition progress. Are you sure?")) return;

    savedEntries.forEach(entry => {
        delete entry.srs;
    });

    saveToStorage();
    saveToFirestore();
    updateSrsStatsDisplay();
    loadReviewSession();
    alert("SRS data has been reset.");
}

// Call updateSrsStatsDisplay when switching to review tab


// ========== PHASE 4: SMART FEATURES INTEGRATION ==========

// Show duplicate checker
function showDuplicateChecker() {
    const allDuplicates = [];

    savedEntries.forEach((entry, index) => {
        const dups = findDuplicates(entry, 0.7);
        if (dups.length > 0) {
            allDuplicates.push({
                entry: entry,
                index: index,
                duplicates: dups
            });
        }
    });

    if (allDuplicates.length === 0) {
        alert("✅ No duplicates found! All entries are unique.");
        return;
    }

    let message = `Found ${allDuplicates.length} entries with potential duplicates:\n\n`;
    allDuplicates.slice(0, 5).forEach(item => {
        message += `"${item.entry.title}"\n`;
        item.duplicates.slice(0, 2).forEach(dup => {
            message += `  → ${dup.similarity}% similar to "${dup.entry.title}"\n`;
        });
        message += '\n';
    });

    if (allDuplicates.length > 5) {
        message += `... and ${allDuplicates.length - 5} more`;
    }

    alert(message);
}

// Auto-suggest tags when saving
function showAutoTagSuggestions(container, title, content) {
    const suggestions = autoSuggestTags(title, content);

    if (suggestions.length === 0) return;

    // Check if suggestions already exist
    let suggestionsDiv = container.querySelector('.tag-suggestions');
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'tag-suggestions';
        suggestionsDiv.innerHTML = '<strong style="margin-right: 8px;">💡 Suggested tags:</strong>';

        const tagsInput = container.querySelector('.tags-input');
        if (tagsInput) {
            tagsInput.parentNode.insertBefore(suggestionsDiv, tagsInput.nextSibling);
        }
    }

    // Clear existing suggestions
    const existingTags = suggestionsDiv.querySelectorAll('.tag-suggestion');
    existingTags.forEach(tag => tag.remove());

    // Add new suggestions
    suggestions.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag-suggestion';
        tagEl.innerHTML = `<i class="ph ph-plus"></i> ${tag}`;
        tagEl.onclick = () => {
            const tagsInput = container.querySelector('.tags-input');
            if (tagsInput) {
                const currentTags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
                if (!currentTags.includes(tag)) {
                    currentTags.push(tag);
                    tagsInput.value = currentTags.join(', ');
                }
                tagEl.remove();
            }
        };
        suggestionsDiv.appendChild(tagEl);
    });
}

// Enhanced save with duplicate check
const originalSaveAllEntries = saveAllEntries;
saveAllEntries = function () {
    // Check for duplicates before saving
    const titles = document.querySelectorAll(".title-input");
    const contents = document.querySelectorAll(".content-input");

    let hasDuplicates = false;
    for (let i = 0; i < titles.length; i++) {
        const title = titles[i].value.trim();
        const content = contents[i].value.trim();

        if (title && content) {
            const tempEntry = { title, content };
            const dups = findDuplicates(tempEntry, 0.8);
            if (dups.length > 0) {
                hasDuplicates = true;
                break;
            }
        }
    }

    if (hasDuplicates) {
        if (!confirm("⚠️ Potential duplicates detected. Save anyway?")) {
            return;
        }
    }

    // Proceed with original save
    originalSaveAllEntries();
};

// Add auto-tag button to each entry
function addAutoTagButtons() {
    const containers = document.querySelectorAll('.entry-container');
    containers.forEach(container => {
        // Check if button already exists
        if (container.querySelector('.auto-tag-btn')) return;

        const tagsInput = container.querySelector('.tags-input');
        if (!tagsInput) return;

        const autoTagBtn = document.createElement('button');
        autoTagBtn.className = 'auto-tag-btn icon-btn-text';
        autoTagBtn.innerHTML = '<i class="ph ph-sparkle"></i> Suggest Tags';
        autoTagBtn.type = 'button';
        autoTagBtn.onclick = () => {
            const titleInput = container.querySelector('.title-input');
            const contentInput = container.querySelector('.content-input');

            if (titleInput && contentInput) {
                showAutoTagSuggestions(container, titleInput.value, contentInput.value);
            }
        };

        tagsInput.parentNode.insertBefore(autoTagBtn, tagsInput.nextSibling);
    });
}

// Call addAutoTagButtons when entries are shown
const originalShowEntriesInInputTab = showEntriesInInputTab;
showEntriesInInputTab = function () {
    originalShowEntriesInInputTab();
    setTimeout(() => addAutoTagButtons(), 100);
};

const originalAddNewEntry = addNewEntry;
addNewEntry = function () {
    originalAddNewEntry();
    setTimeout(() => addAutoTagButtons(), 100);
};

// Initial load
document.addEventListener("DOMContentLoaded", () => {
    initFirebaseAuth();

    // Show welcome message with keyboard shortcuts hint
    const hasSeenWelcome = localStorage.getItem("fmapp_seen_welcome");
    if (!hasSeenWelcome) {
        setTimeout(() => {
            if (confirm("Welcome to FM APP! 🎉\n\nWould you like to see keyboard shortcuts?")) {
                showKeyboardShortcuts();
            }
            localStorage.setItem("fmapp_seen_welcome", "true");
        }, 1000);
    }
});