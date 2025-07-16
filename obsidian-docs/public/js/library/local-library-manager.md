# `local-library-manager.js`

**Local Media Library Management**

This module is the core of the local library functionality. It handles importing, categorizing, and managing local media files.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#LocalLibraryManager|LocalLibraryManager]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#initializeElements|initializeElements]]
  - [[#setupEventListeners|setupEventListeners]]
  - [[#handleTabClick|handleTabClick]]
  - [[#importLibrary|importLibrary]]
  - [[#handleLibrarySelection|handleLibrarySelection]]
  - [[#categorizeFiles|categorizeFiles]]
  - [[#processMovie|processMovie]]
  - [[#processSeries|processSeries]]
  - [[#searchAndFetchFirstResult|searchAndFetchFirstResult]]
  - [[#saveToServer|saveToServer]]
  - [[#loadFromServer|loadFromServer]]
  - [[#renderLocalMedia|renderLocalMedia]]
  - [[#sortLocalMedia|sortLocalMedia]]
  - [[#showStatus|showStatus]]
  - [[#Getters and Setters|Getters and Setters]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `tmdbApi`: To search for and fetch media information from TMDB.
- `mediaCardRenderer`: To render the media cards for the local library.
- `FileData`: A data class for representing file information.

---

## Class

### `LocalLibraryManager`

A class that encapsulates all the logic for managing the local media library.

---

## Methods

### `constructor`

Initializes the `LocalLibraryManager` class.

### `initializeElements`

Gets references to the DOM elements used by the library manager.

### `setupEventListeners`

Sets up event listeners for the import button, library tabs, and sort dropdown.

### `handleTabClick`

Handles clicks on the library tabs (All, Movies, TV Shows) and re-renders the media grid.

### `importLibrary`

Fetches the list of local files from the backend and starts the import process.

### `handleLibrarySelection`

Orchestrates the process of categorizing and processing the imported files.

### `categorizeFiles`

Categorizes files into movies and TV shows based on their directory structure.

### `processMovie`

Processes a movie file by searching for it on TMDB and adding it to the local library.

### `processSeries`

Processes a TV show's files by searching for the show on TMDB and mapping the episode files to season and episode numbers.

### `searchAndFetchFirstResult`

Searches for a media item on TMDB and returns the first result.

### `saveToServer`

Saves the local library data to the backend.

### `loadFromServer`

Loads the local library data from the backend.

### `renderLocalMedia`

Renders the local media grid based on the selected tab and sort order.

### `sortLocalMedia`

Sorts the media array based on the selected sort order.

### `showStatus`

Displays a status message to the user.

### Getters and Setters

The class provides getters and setters for external access to the local library data.

---

## Related Documentation
- [[tmdb-api]]
- [[media-cards]]
- [[Frontend Overview]]
