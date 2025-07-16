# Frontend Overview

**A modern, modular, and responsive web interface for NexusFlix.**

## Core Philosophy

The NexusFlix frontend is built with modern JavaScript (ES6+ modules) and a component-based architecture. It emphasizes a direct browser execution model, meaning there is **no complex build process** (like Webpack or Babel) involved. This simplifies development and deployment, allowing for faster iteration.

## Key Technologies

- **Modern JavaScript (ES6+)**: Utilizes native ES modules for code organization and direct browser execution.
- **Tailwind CSS**: A utility-first CSS framework for rapid UI development and responsive design.
- **Video.js**: An extensible web video player for handling media playback.
- **MediaSource API**: For advanced video streaming capabilities, including dynamic buffering and track switching.
- **Lucide Icons**: A collection of open-source icons for a clean visual aesthetic.

## Architecture and Module Organization

The frontend is structured into several distinct modules, each responsible for a specific area of functionality. This modularity promotes code reusability, maintainability, and a clear separation of concerns.

### `app.js`

- **Role**: The main entry point of the frontend application. It initializes all other modules, establishes their interconnections, and sets up global event listeners.
- **Key Responsibilities**: Application bootstrapping, dependency injection for modules, and overall application flow management.

### `api/`

- **Role**: Contains modules for interacting with external APIs.
- **Modules**:
  - [[gemini-api]]: Handles communication with the Google Gemini AI for content generation (e.g., synopses).
  - [[tmdb-api]]: Manages requests to The Movie Database (TMDB) API for movie and TV show metadata, including rate limiting and error handling.

### `events/`

- **Role**: Centralized event handling and delegation.
- **Modules**:
  - [[event-handler]]: Implements a global click listener on the `document.body` to delegate events to specific handlers based on the clicked element. This is crucial for handling events on dynamically created DOM elements.

### `library/`

- **Role**: Manages the user's local media library.
- **Modules**:
  - [[local-library-manager]]: Handles importing local media files, categorizing them (movies/series), matching them with TMDB entries, and persisting the library data to the backend.

### `navigation/`

- **Role**: Controls application navigation and UI state related to page views.
- **Modules**:
  - [[navigation-manager]]: Manages switching between different content pages (Dashboard, Movies, Series, Local Library) and handles the responsive sidebar menu.

### `pages/`

- **Role**: Manages the content displayed on each main application page.
- **Modules**:
  - [[page-manager]]: Responsible for fetching and populating the content grids for the dashboard, movies, and series pages, including applying filters and sorting options.

### `themes/`

- **Role**: Manages application-wide and video player specific themes.
- **Modules**:
  - [[theme-manager]]: Provides functionality to apply and persist different visual themes, utilizing CSS custom properties for dynamic styling.

### `ui/`

- **Role**: Contains reusable UI components and modal management logic.
- **Modules**:
  - [[global-settings-modal]]: Manages the application's global settings modal, primarily for theme selection.
  - [[media-cards]]: Generates the HTML structure for media display cards (standard and featured).
  - [[modal-manager]]: Controls the display and content of the main details modal (for movie/series information) and the video player modal.
  - [[search-handler]]: Implements the search functionality, querying both TMDB and the local library.
  - [[settings-modal]]: Manages the video player's specific settings modal, allowing users to customize the player's theme.

### `video-player/`

- **Role**: Implements the core video playback functionality.
- **Modules**:
  - [[video-metadata]]: Defines data structures for representing video track information and metadata.
  - [[video-player]]: The main video player implementation, leveraging MediaSource API for efficient streaming, handling audio/subtitle track switching, and integrating with Video.js for controls.
  - [[video-response-parser]]: Parses the custom binary video data format received from the Rust backend.
  - [[webvtt-parser]]: Parses WebVTT subtitle files into a format usable by the video player.

## Frontend-Backend Interaction

The frontend communicates with the Rust backend primarily through RESTful API calls:

- **API Key Retrieval**: The frontend fetches API keys (TMDB, Gemini) from the backend's `/api/keys` endpoint.
- **Media Library Management**: The `local-library-manager.js` module sends and receives media library data (metadata and file paths) via `/api/add-media` (POST) and `/api/get-media` (GET) endpoints.
- **Video Streaming**: The `video-player.js` module requests video metadata from `/video-data` and streams video chunks from `/video`. The backend dynamically transcodes and serves these chunks.
- **File Listing**: The `local-library-manager.js` initiates a request to `/file_list` to get a list of available local media files from the server.

This clear separation of concerns allows for independent development and scaling of both the frontend and backend components, while ensuring seamless data flow and user experience.

## Related Documentation
- [[app]]
- [[public/js/api/gemini-api]]
- [[public/js/api/tmdb-api]]
- [[public/js/events/event-handler]]
- [[public/js/library/local-library-manager]]
- [[public/js/navigation/navigation-manager]]
- [[public/js/pages/page-manager]]
- [[public/js/themes/theme-manager]]
- [[public/js/ui/global-settings-modal]]
- [[public/js/ui/media-cards]]
- [[public/js/ui/modal-manager]]
- [[public/js/ui/search-handler]]
- [[public/js/ui/settings-modal]]
- [[public/js/video-player/video-metadata]]
- [[public/js/video-player/video-player]]
- [[public/js/video-player/video-response-parser]]
- [[public/js/video-player/webvtt-parser]]