# BetterDB – Chrome Extension

**BetterDB** is a Chrome/Edge extension that automatically extracts **Deutsche Bahn (DB)** connections, including **intermediate stops**, directly from the DB search results page.  
It is designed to make hidden travel opportunities easier to find – for example, spotting cheaper prices by splitting a long journey into multiple smaller segments.

---

## Key Features

- **Automatic Data Extraction**
  - Reads **start station**, **destination**, **departure/arrival times**, **ticket price**, **number of transfers**, and **vehicle types**.
  - Extracts **all intermediate stops** (Zwischenhalte) even when they are normally only visible after manually expanding “Show stops” buttons.
  - Fetches additional information like track numbers and transfer durations.

- **Multiple Data Sources**
  - **`sessionStorage.vuex`** – DB's internal state containing connection details **and all intermediate stops**.
  - **`window.digitalData`** – internal analytics object with trip metadata.
  - **DOM parsing** – fallback for stops when SessionStorage data is incomplete.
  - Prioritizes SessionStorage data over DOM extraction for better performance and reliability.

- **User-Friendly Popup Interface**
  - Each DB connection is shown as a **card** in the popup.
  - Cards contain **basic details**: start, destination, times, transfers, price.
  - **Segments dropdown** – see details for each leg of the journey.
  - **Stops list** – expandable list of all intermediate stops with arrival/departure and platform.
  - **Copy to Clipboard** button to export the full dataset as JSON.

- **Optimized for Reliability**
  - Data extraction happens in multiple passes to catch late-loaded content.
  - Can run without pressing any toggle buttons on the page.
  - Handles both regular and special trains (ICE, IC, RE, buses, trams).

---

## Installation (Development Mode)

1. Clone the repository or download it as a ZIP and extract it.
2. Open **Chrome** or **Microsoft Edge**.
3. Go to `chrome://extensions` (or `edge://extensions`).
4. Enable **Developer Mode**.
5. Click **Load unpacked** and select the extension’s root folder (must contain `manifest.json`).
6. Open a DB search results page (e.g., [bahn.de](https://bahn.de)).

---

## How to Use

1. Perform a search on the DB website for your desired route.
2. Open the **BetterDB** extension popup:
   - Click **Refresh** to extract the latest connections from the active tab.
   - Click **Copy JSON** to export all extracted results to the clipboard.
3. Browse the results:
   - **Click a card** to expand and see all journey segments.
   - View **detailed intermediate stops** with track numbers and times.
   - Compare prices between different connections.

---

## Technical Overview

- **Manifest V3** compliant.
- **Content Script (`content.js`)**:
  - Injected on matching DB search pages.
  - Reads trip data from `sessionStorage.vuex` and `window.digitalData`.
  - Parses intermediate stops directly from the DOM.
  - Stores extracted results in `chrome.storage.local`.

- **Popup (`popup.html`, `popup.css`, `popup.js`)**:
  - Fetches stored trip data from `chrome.storage.local`.
  - Displays each connection in a collapsible card layout.
  - Implements expandable stop lists for each journey segment.
  - Provides JSON export functionality.

- **No Manual Interaction Required**:
  - The script automatically “virtually expands” stop lists without triggering UI events.
  - Intermediate stops are fetched even if hidden behind a toggle button.

---

## File Structure

```
betterdb/
│
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for downloads and commands
├── content.js             # Extracts DB trip and stop data
├── pagehook.js           # Network hook for additional data capture
├── popup.html             # Popup layout
├── popup.css              # Popup styling
├── popup.js               # Popup logic for rendering and interaction
├── .gitignore             # Git ignore patterns
└── README.md              # Project documentation
```

---

## Possible Future Enhancements

- **Sorting and Filtering** – by price, duration, or number of transfers.
- **Price Tracking** – monitor changes in ticket prices over time.
- **Multi-Ticket Suggestions** – automatically find cheapest splits for a journey.
- **Export Options** – CSV, PDF, or direct sharing.
- **Offline Storage** – save search results locally for later reference.

---

## License

This project is licensed under the GNU General Public License v3.0 – free for personal and commercial use with attribution.