# `event-handler.js`

**Global Event Handling and Delegation**

This module is responsible for handling all user interactions within the application. It uses a global event listener on the `document.body` to delegate events, which is an efficient way to manage events for dynamically created elements.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#EventHandler|EventHandler]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#setupGlobalEventListeners|setupGlobalEventListeners]]
  - [[#handleGlobalClick|handleGlobalClick]]
  - [[#handleChangeTmdbMatch|handleChangeTmdbMatch]]
  - [[#performTmdbChangeSearch|performTmdbChangeSearch]]
  - [[#cancelTmdbChange|cancelTmdbChange]]
  - [[#handleSelectNewTmdb|handleSelectNewTmdb]]
  - [[#toggleAccordion|toggleAccordion]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `modalManager`: To show and hide modals.
- `localLibraryManager`: To interact with the local media library.
- `tmdbApi`: To make requests to the TMDB API.

---

## Class

### `EventHandler`

A class that encapsulates all event handling logic.

---

## Methods

### `constructor`

Initializes the `EventHandler` class.

```javascript
constructor(modalManager, localLibraryManager, tmdbApi) {
    this.modalManager = modalManager;
    this.localLibraryManager = localLibraryManager;
    this.tmdbApi = tmdbApi;
    
    this.setupGlobalEventListeners();
}
```

- **Behavior**:
  - Stores references to the `modalManager`, `localLibraryManager`, and `tmdbApi`.
  - Calls `setupGlobalEventListeners` to set up the global event listener.

### `setupGlobalEventListeners`

Sets up the global event listeners.

```javascript
setupGlobalEventListeners() {
    document.body.addEventListener("click", (e) => this.handleGlobalClick(e));
    
    document.addEventListener('pageChanged', (e) => {
        if (e.detail.page === 'local-library') {
            this.localLibraryManager.renderLocalMedia();
        }
    });
}
```

- **Behavior**:
  - Adds a `click` listener to `document.body` that calls `handleGlobalClick`.
  - Adds a `pageChanged` listener to the `document` that re-renders the local media when the page changes to the local library.

### `handleGlobalClick`

Handles all click events on the page.

```javascript
async handleGlobalClick(e) {
    // ... implementation ...
}
```

- **Behavior**:
  - Uses `e.target.closest()` to determine which element was clicked.
  - Based on the element, it calls the appropriate handler function.
  - This includes handling clicks on:
    - Details buttons on media cards
    - The AI Synopsis button in the modal
    - The "Change TMDB Match" button
    - The search button in the "Change TMDB Match" interface
    - The cancel button in the "Change TMDB Match" interface
    - The select button for a new TMDB entry
    - Accordion toggles for TV show seasons
    - Play buttons for movies and episodes

### `handleChangeTmdbMatch`

Shows the interface for changing the TMDB match for a media item.

### `performTmdbChangeSearch`

Performs a search for a new TMDB match.

### `cancelTmdbChange`

Hides the "Change TMDB Match" interface.

### `handleSelectNewTmdb`

Replaces the old TMDB match with a new one.

### `toggleAccordion`

Toggles the visibility of the episode list for a TV show season.

---

## Related Documentation
- [[modal-manager]]
- [[local-library-manager]]
- [[tmdb-api]]
- [[Frontend Overview]]
