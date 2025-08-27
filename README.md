# BetterDB – Chrome Extension (Demo)

> **⚠️ This is an early demo version for educational and research purposes only.**

**BetterDB** is a Chrome/Edge extension that automatically extracts **Deutsche Bahn (DB)** connections, including **intermediate stops**, directly from the DB search results page without any user interaction.  

This proof-of-concept demonstrates how to efficiently extract travel data from complex web applications and makes hidden travel opportunities more accessible – for example, spotting cheaper prices by splitting a long journey into multiple smaller segments.

---

## How It Works

The extension uses a sophisticated multi-layer data extraction approach:

### 1. **Primary Data Source: SessionStorage**
- **Vuex Store Analysis**: Accesses DB's internal Vuex state management (`sessionStorage.vuex`)
- **Direct API Data**: Reads connection details, intermediate stops, and metadata directly from the internal data structures
- **Real-time Updates**: Captures data as soon as it's loaded by the DB website
- **No DOM Interaction**: Bypasses the need to click "Show stops" buttons or interact with UI elements

### 2. **Secondary Sources & Fallbacks**
- **DigitalData Analytics**: Extracts trip metadata from `window.digitalData` analytics tracking
- **Network Hook**: Intercepts API responses using injected page scripts (`pagehook.js`)
- **DOM Parsing**: Falls back to parsing visible HTML elements when other methods fail
- **Multiple Attempts**: Runs extraction at different intervals to catch late-loaded content

### 3. **Data Processing Pipeline**
```
DB Website Load → Vuex Store Detection → Connection Extraction → Stop Mapping → Data Merging → Storage → Popup Display
```

### 4. **Smart Data Merging**
- **Intelligent Matching**: Combines data from multiple sources using trip IDs, times, and route matching
- **Deduplication**: Removes duplicate stops and connections
- **Data Enrichment**: Fills missing information from alternative sources
- **Quality Assurance**: Validates and cleans extracted data

---

## Key Features

- **Automatic Data Extraction**
  - Reads **start station**, **destination**, **departure/arrival times**, **ticket price**, **number of transfers**, and **vehicle types**
  - Extracts **all intermediate stops** (Zwischenhalte) including arrival/departure times and platform numbers
  - Works completely **without manual interaction** – no need to click "Show stops" buttons
  - Fetches additional metadata like transfer durations and capacity information

- **Multiple Data Sources**
  - **`sessionStorage.vuex`** – Primary source with complete connection details and intermediate stops
  - **`window.digitalData`** – Analytics object with trip metadata and fallback information
  - **Network Interception** – Captures API responses for additional data validation
  - **DOM Parsing** – Fallback method when SessionStorage data is incomplete
  - **Intelligent Prioritization** – Uses SessionStorage data when available, falls back gracefully

- **User-Friendly Interface**
  - **Clean Card Layout** – Each connection displayed as an expandable card
  - **Comprehensive Details** – Shows route, times, transfers, vehicle types, and pricing
  - **Interactive Segments** – Expandable view of each journey leg with detailed information
  - **Complete Stop Lists** – All intermediate stops with times and platform information
  - **Debug Tools** – Built-in debugging features for development and troubleshooting
  - **Data Export** – Copy complete datasets as JSON for external analysis

- **Technical Reliability**
  - **Multi-pass Extraction** – Runs multiple extraction attempts to catch all data
  - **Error Handling** – Graceful fallbacks when primary extraction methods fail
  - **Performance Optimized** – Minimal impact on DB website performance
  - **Cross-browser Compatible** – Works with Chrome and Edge (Manifest V3)

---

## Installation (Development Mode)

1. **Download**: Clone this repository or download as ZIP and extract
   ```bash
   git clone https://github.com/Friedjof/BetterDB.git
   cd BetterDB
   ```

2. **Load Extension**:
   - Open **Chrome** or **Microsoft Edge**
   - Navigate to `chrome://extensions` (or `edge://extensions`)
   - Enable **Developer Mode** (toggle in top-right corner)
   - Click **Load unpacked** and select the BetterDB folder

3. **Verify Installation**:
   - The BetterDB icon should appear in your browser toolbar
   - Visit any DB search results page (e.g., [bahn.de](https://bahn.de))

---

## How to Use

### Basic Usage
1. **Search for Connections**: Perform a route search on the DB website ([bahn.de](https://bahn.de))
2. **Wait for Page Load**: Allow the search results to fully load
3. **Open Extension**: Click the BetterDB icon in your browser toolbar
4. **Extract Data**: Click **"Aktualisieren" (Refresh)** to extract current connections
5. **Explore Results**: Click on connection cards to view detailed information

### Advanced Features
- **Debug Mode**: Click **"Debug"** button to view detailed extraction logs in browser console (F12)
- **Data Export**: Use **"Copy JSON"** to export all connection data for external analysis
- **Real-time Updates**: Extension automatically updates when you navigate to new search results

### Debugging & Development
- **Console Logs**: Open browser DevTools (F12) → Console to see detailed extraction process
- **Storage Inspection**: Use the Debug button to inspect all stored data
- **Manual Extraction**: Use the Refresh button to trigger manual data extraction

---

## Technical Architecture

### Extension Components

- **Manifest V3** compliant for modern browser security standards
- **Content Script (`content.js`)**:
  - Injected automatically on all DB search pages (`*.bahn.de`)
  - Multi-source data extraction with intelligent fallbacks
  - Real-time monitoring of page changes and data updates
  - Stores extracted results in `chrome.storage.local` for persistence

- **Background Service Worker (`background.js`)**:
  - Handles cross-tab communication and coordination
  - Manages extension lifecycle and message routing
  - Provides future extensibility for features like notifications

- **Popup Interface (`popup.html`, `popup.css`, `popup.js`)**:
  - Clean, responsive design optimized for quick data review
  - Interactive cards with expandable sections for detailed information
  - Real-time data loading from extension storage
  - Export functionality and debugging tools

- **Page Hook (`pagehook.js`)**:
  - Injected into page context for network interception
  - Captures API responses that aren't accessible from content script
  - Provides additional data validation and completeness checking

### Data Flow

```
1. User visits DB search results page
2. Content script automatically injects and begins monitoring
3. Vuex store detection and primary data extraction
4. Fallback data sources queried if needed
5. Data processing, merging, and validation
6. Storage in chrome.storage.local
7. Popup interface displays processed results
8. User can interact, debug, or export data
```

---

## File Structure

```
betterdb/
│
├── manifest.json          # Extension manifest (Manifest V3)
├── background.js          # Service worker for extension coordination
├── content.js             # Main data extraction engine
├── pagehook.js           # Network interception and page context access
├── popup.html             # User interface layout
├── popup.css              # Interface styling and responsive design
├── popup.js               # Interface logic and user interactions
├── .gitignore             # Development artifact exclusions
└── README.md              # This documentation
```

---

## Demo Limitations

This is a **proof-of-concept demonstration** with the following limitations:

- **Educational Purpose**: Designed for learning about web scraping and browser extension development
- **Research Use**: Intended for understanding travel data structures and extraction techniques  
- **No Production Support**: Not intended for commercial use or heavy production workloads
- **DB Website Changes**: May break if Deutsche Bahn updates their internal data structures
- **Limited Error Handling**: Basic error handling suitable for demonstration purposes
- **No Data Persistence**: Data is only stored temporarily in browser storage

---

## Technical Notes

### Browser Compatibility
- **Chrome**: Fully supported (Manifest V3)
- **Microsoft Edge**: Compatible with Chromium-based versions
- **Firefox**: Not currently supported (different extension API)

### Performance Considerations
- **Minimal Impact**: Designed to have negligible effect on DB website performance
- **Efficient Extraction**: Uses direct data access methods rather than DOM manipulation
- **Memory Conscious**: Cleans up resources and limits data retention
- **Background Processing**: Extraction happens asynchronously without blocking UI

### Privacy & Security
- **Local Processing**: All data extraction and processing happens locally in the browser
- **No External Servers**: Extension doesn't communicate with any external services
- **Temporary Storage**: Data is stored only temporarily in browser's local storage
- **No User Tracking**: Extension doesn't track or log user behavior

---

## Future Development Possibilities

### Data Analysis Features
- **Price Trend Analysis** – Track and visualize ticket price changes over time
- **Route Optimization** – Suggest alternative routes and transfer combinations
- **Multi-City Planning** – Advanced journey planning for complex itineraries
- **Statistical Analysis** – Connection reliability and delay pattern analysis

### User Experience Enhancements
- **Sorting & Filtering** – Advanced filtering by price, duration, transfers, time of day
- **Saved Searches** – Bookmark and monitor frequently searched routes
- **Notifications** – Alert users to price drops or schedule changes
- **Calendar Integration** – Export journeys to calendar applications

### Export & Integration
- **Multiple Formats** – Export to CSV, PDF, iCal, and other standard formats
- **API Integration** – Connect with external travel planning and booking services
- **Data Visualization** – Charts and graphs for route and pricing analysis
- **Sharing Features** – Share connection details with others

---

## License & Legal

This project is licensed under the **GNU General Public License v3.0** – free for personal, educational, and non-commercial use.

### Important Disclaimers
- **Educational Use Only**: This extension is created for educational and research purposes
- **No Warranty**: Provided "as-is" without any guarantees of accuracy or reliability  
- **Respect Terms of Service**: Users should ensure compliance with Deutsche Bahn's terms of service
- **No Liability**: Authors assume no responsibility for any issues arising from usage

### Contributing
- **Open Source**: Contributions welcome for educational improvements
- **Bug Reports**: Issues and suggestions can be reported via GitHub
- **Documentation**: Help improve documentation and usage examples
- **Testing**: Assist with testing across different browsers and DB website changes

---

*This extension serves as a technical demonstration of advanced web scraping techniques and browser extension development. It showcases how to extract data from complex single-page applications using multiple complementary approaches for maximum reliability and completeness.*
