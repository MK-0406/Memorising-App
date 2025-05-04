let entryCount = 0;
const savedEntries = [];

function switchTab(index) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));
    tabs[index].classList.add('active');
    contents[index].classList.add('active');

    if (index === 1) showSavedEntries();
    if (index === 2) loadPracticeEntry();
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

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.classList.add("delete-button");
    deleteButton.onclick = () => {
        container.remove();
        updateEntryNumbers();
    };

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
    container.appendChild(deleteButton);
    container.appendChild(moveUpButton);
    container.appendChild(moveDownButton);

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

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.classList.add("delete-button");
        deleteButton.onclick = () => {
        container.remove();
        updateEntryNumbers();
        };

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
        container.appendChild(deleteButton);
        container.appendChild(moveUpButton);
        container.appendChild(moveDownButton);

        entriesContainer.appendChild(container);
    });

    updateEntryNumbers();
}

function saveAllEntries() {
    const titles = document.querySelectorAll(".title-input");
    const contents = document.querySelectorAll(".content-input");

    savedEntries.length = 0;

    for (let i = 0; i < titles.length; i++) {
        savedEntries.push({
            title: titles[i].value.trim(),
            content: contents[i].value.trim()
        });
    }

    alert("Entries have been saved!");
}

function showSavedEntries() {
    const savedContainer = document.getElementById("savedContainer");
    savedContainer.innerHTML = "";

    if (savedEntries.length === 0) {
    savedContainer.innerHTML = "<p>No entries saved yet.</p>";
    return;
    }

    savedEntries.forEach((entry, index) => {
    const box = document.createElement("div");
    box.className = "entry-container";

    const title = document.createElement("p");
    title.innerHTML = `<strong>Title ${index + 1}:</strong> ${entry.title}`;

    const content = document.createElement("p");
    content.innerHTML = `<strong>Content ${index + 1}:</strong> <br/> ${entry.content.replace(/\r?\n/g, '<br>')}`;

    box.appendChild(title);
    box.appendChild(content);
    savedContainer.appendChild(box);
    });
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
            // Clear and replace contents without reassigning the const variable
            savedEntries.length = 0;
            savedEntries.push(...loadedEntries);
            showSavedEntries(); // Refresh UI
            showEntriesInInputTab();
            loadPracticeEntry();
            } else {
            alert("Invalid JSON format: expected an array of entries.");
            }
        } catch (err) {
            alert("Error loading JSON: " + err.message);
        }
    };
    reader.readAsText(file);
});

function loadPracticeEntry() {
    const practiceContainer = document.getElementById("practiceContainer");
    practiceContainer.innerHTML = "";
    const practiceArea = document.getElementById("practiceContent");
    practiceArea.innerHTML = "";

    if (savedEntries.length === 0) {
        practiceContainer.innerHTML = "<p>No entries saved yet.</p>";
        return;
    }

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
        checkButton.textContent = "Check";
        checkButton.onclick = () => compareText(input.value, entry.content, result);

        // Create the result div to show correct/wrong text
        const result = document.createElement("div");
        result.className = "result";

        // Append all elements to the entry container
        entryContainer.appendChild(title);
        entryContainer.appendChild(input);
        entryContainer.appendChild(checkButton);
        entryContainer.appendChild(result);

        // Append the entry container to the practice area
        practiceArea.appendChild(entryContainer);
    });
}

function compareText(userInput, expectedText, resultDiv) {
    resultDiv.innerHTML = ""; // Clear previous results

    // Split both user input and expected content by spaces to compare words
    const userWords = userInput.trim().split(/\s+/);
    const expectedWords = expectedText.trim().split(/\s+/);

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

    // If all words are correct, show success message
    if (userWords.length > expectedWords.length){
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Incorrect since there are extra words. Try Again!";
        resultDiv.appendChild(errorMessage);
    }
    else if (correctWords === expectedWords.length) {
        const successMessage = document.createElement("p");
        successMessage.textContent = "Great job! All words are correct!";
        resultDiv.appendChild(successMessage);
    } else {
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Some words are incorrect. Try again!";
        resultDiv.appendChild(errorMessage);
    }
    const formattedText1 = document.createElement("h4");
    formattedText1.textContent = "Correct answer:";
    resultDiv.appendChild(formattedText1);
    const answerTest = document.createElement("p");
    answerTest.innerHTML = expectedText.replace(/\n/g, '<br>');
    resultDiv.appendChild(answerTest);
}

// Get the button
const backToTopBtn = document.getElementById('backToTopBtn');

// Show/hide the button based on scroll position
window.addEventListener('scroll', () => {
  if (window.pageYOffset > 300) {
    backToTopBtn.classList.add('visible');
  } else {
    backToTopBtn.classList.remove('visible');
  }
});

// Smooth scroll to top when clicked
backToTopBtn.addEventListener('click', () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});