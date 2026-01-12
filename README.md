# 📚 FM APP - Advanced Memory & Study Application

**Version 4.0** | **40% Complete** | **50+ Features**

A powerful, scientifically-backed study application with spaced repetition, analytics, and AI-powered features.

---

## 🎯 **What is FM APP?**

FM APP is a comprehensive memory and study tool that helps you:
- 📝 Create and organize study materials
- 🧠 Practice with scientifically-proven spaced repetition
- 📊 Track your progress with detailed analytics
- 💡 Get AI-powered suggestions and insights
- 🎯 Identify and focus on weak areas

---

## ✨ **Key Features**

### 🧠 **Spaced Repetition System (SRS)**
- SM-2 algorithm (same as Anki)
- Intelligent scheduling based on performance
- 4 difficulty ratings (Again/Hard/Good/Easy)
- Automatic interval calculation

### 📊 **Analytics Dashboard**
- Progress charts with Chart.js
- 30-day study heatmap
- Weak spots identification
- Per-folder statistics
- Study time tracking

### 💡 **Smart Features**
- Auto-tagging with NLP
- Duplicate detection
- Entry templates
- Bulk operations
- Related entries discovery

### 🎨 **Beautiful UI**
- Modern gradient design
- Dark mode support
- Responsive layout
- Smooth animations
- Accessibility-friendly

---

## 📁 **Project Structure**

```
FM APP/
├── index.html              # Main application
├── style.css               # Core styles
├── script.js               # Main application logic
├── srs.js                  # Spaced repetition algorithm
├── analytics.js            # Analytics & charts
├── analytics.css           # Analytics styling
├── smart-features.js       # AI-powered features
├── smart-features.css      # Smart features styling
└── README.md               # User guide (this file)
```

---

## 🚀 **Getting Started**

### Quick Start
1. Open `index.html` in your browser
2. Click "Add Entry" to create your first study card
3. Fill in title and content
4. Click "Save All"
5. Start practicing!

### First-Time Setup
1. **Choose a folder** (or use Default)
2. **Add entries** using the Input tab
3. **Practice** to build your streak
4. **Review** with SRS for optimal retention
5. **Track progress** in Analytics

---

## 📖 **How to Use**

### Creating Entries
1. Go to **📝 Memory Input** tab
2. Click **Add Entry** (or use template)
3. Enter title and content
4. Add tags (or use auto-suggest)
5. Click **Save All** (Ctrl+S)

### Practicing
1. Go to **🎯 Practice** tab
2. Choose mode (Full Typing / Fill-in-Blanks)
3. Type your answer
4. Press Enter or click Check
5. Review feedback

### SRS Review
1. Go to **🧠 Review (SRS)** tab
2. Click **Start Review Session**
3. Practice due entries
4. Rate difficulty (Again/Hard/Good/Easy)
5. Build long-term retention

### Analytics
1. Go to **📊 Analytics** tab
2. View quick stats
3. Check progress charts
4. Identify weak spots
5. Review folder performance

---

## ⌨️ **Keyboard Shortcuts**

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save all entries |
| `Ctrl/Cmd + N` | Add new entry |
| `Ctrl/Cmd + E` | Export JSON |
| `Ctrl/Cmd + D` | Toggle dark mode |
| `Ctrl/Cmd + 1-6` | Switch tabs |
| `Enter` | Check answer |
| `Escape` | Clear/Cancel |

**See QUICK-REFERENCE.md for complete list**

---

## 🎓 **Study Methods Supported**

### 1. **Active Recall**
- Type answers from memory
- Immediate feedback
- Word-by-word comparison

### 2. **Spaced Repetition**
- SM-2 algorithm
- Optimal review timing
- Long-term retention

### 3. **Fill-in-the-Blanks**
- Adjustable difficulty
- Focused practice
- Pattern recognition

### 4. **Reverse Practice**
- Content → Title
- Multiple perspectives
- Deeper understanding

---

## 📊 **Phases Completed**

### ✅ Phase 1: Foundation (100%)
- Keyboard shortcuts
- Entry counter badges
- Reverse practice mode
- CSV import/export
- UI enhancements

### ✅ Phase 2: SRS (100%)
- SM-2 algorithm
- Review sessions
- Difficulty ratings
- Due date tracking
- Maturity badges

### ✅ Phase 3: Analytics (100%)
- Quick stats dashboard
- Progress charts
- Study heatmap
- Weak spots
- Folder statistics

### ✅ Phase 4: Smart Features (100%)
- Auto-tagging (NLP)
- Duplicate detection
- Entry templates
- Bulk operations
- Smart hints

### 🔄 Phase 5: Collaboration (0%)
- Share folders
- Public library
- Collaborative editing

### 🔄 Phase 6: Import/Export (0%)
- Anki compatibility
- Quizlet import
- Google Sheets sync

### 🔄 Phase 7: Gamification (0%)
- Badges & achievements
- XP system
- Leaderboards

### 🔄 Phase 8: Mobile & PWA (0%)
- Offline mode
- Push notifications
- Install as app

### 🔄 Phase 9: Advanced Tools (0%)
- Pomodoro timer
- Focus mode
- Custom themes

### 🔄 Phase 10: Polish (0%)
- Performance optimization
- Testing & QA
- Bug fixes

---

## 🛠️ **Technologies Used**

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling (Vanilla CSS)
- **JavaScript (ES6+)** - Logic

### Libraries
- **Chart.js** - Data visualization
- **Tesseract.js** - OCR for images
- **PDF.js** - PDF text extraction
- **jsPDF** - PDF generation

### Backend (Optional)
- **Firebase** - Authentication & Firestore
- **Google Drive** - File storage

### Algorithms
- **SM-2** - Spaced repetition
- **Levenshtein Distance** - Similarity detection
- **NLP** - Keyword extraction

---

## 📱 **Browser Support**

| Browser | Support |
|---------|---------|
| Chrome | ✅ Full |
| Edge | ✅ Full |
| Firefox | ✅ Full |
| Safari | ✅ Full |
| Mobile | ⚠️ Partial |

**Requirements:**
- JavaScript enabled
- LocalStorage enabled
- Internet (for CDN libraries)

---

## 💾 **Data Storage**

### LocalStorage
- Automatic saving
- Per-folder storage
- Settings persistence
- Practice history

### Firebase (Optional)
- Cloud sync
- Multi-device access
- Backup & restore
- Collaborative features

---

## 🧪 **Testing**

### Manual Testing
See `TESTING-GUIDE.md` for complete checklist

### Quick Test
1. Open `index.html`
2. Add an entry
3. Save and practice
4. Check analytics
5. Try SRS review

### Browser Console
Press F12 to check for errors

---

## 🐛 **Known Issues**

### Current Limitations
1. Bulk operations UI needs selection checkboxes
2. Related entries not displayed in UI yet
3. Smart hints only available in code
4. Templates don't save custom versions
5. No mobile app (PWA coming in Phase 8)

### Workarounds
- Use keyboard shortcuts for faster workflow
- Export backups regularly
- Clear localStorage if data corrupts

---

## 🔮 **Roadmap**

### Next Up (Phase 5)
- [ ] Share folders via link
- [ ] Public deck library
- [ ] Import shared decks
- [ ] User profiles
- [ ] Comments system

### Future Plans
- [ ] Anki import/export
- [ ] Mobile app (PWA)
- [ ] Gamification
- [ ] AI question generation
- [ ] Voice input
- [ ] Image flashcards

---

## 📈 **Stats**

- **Total Lines of Code**: ~2,500+
- **Files**: 20
- **Features**: 50+
- **Keyboard Shortcuts**: 15+
- **Supported Formats**: JSON, CSV, PDF, Images
- **Chart Types**: 2 (Line, Bar)
- **Practice Modes**: 4
- **Templates**: 5

---

## 🤝 **Contributing**

### How to Contribute
1. Test the app thoroughly
2. Report bugs with details
3. Suggest new features
4. Improve documentation
5. Optimize performance

### Feature Requests
- Open an issue
- Describe use case
- Explain benefits
- Provide examples

---

## 📄 **License**

This project is for personal/educational use.

---

## 🙏 **Credits**

### Algorithms
- **SM-2**: Piotr Woźniak (SuperMemo)
- **Levenshtein Distance**: Vladimir Levenshtein

### Libraries
- Chart.js
- Firebase
- Tesseract.js
- PDF.js
- jsPDF

### Design Inspiration
- Anki
- Quizlet
- Notion
- Linear

---

## 📞 **Support**

### Documentation
- `TESTING-GUIDE.md` - Testing checklist
- `QUICK-REFERENCE.md` - Feature reference
- `PHASE*.md` - Detailed feature docs

### Troubleshooting
1. Check browser console (F12)
2. Clear browser cache
3. Verify Firebase connection
4. Ensure JavaScript is enabled

---

---

**Built with ❤️ for effective learning**

**Version**: 4.1 (Folder Sync & Note-Taking)
**Last Updated**: 2025-12-20
**Status**: Fully Functional

---

## 🚀 **Get Started Now!**

1. Open `index.html` in your browser
2. Follow the welcome guide
3. Create your first entry
4. Start learning smarter!

**Happy Studying! 📚✨**
