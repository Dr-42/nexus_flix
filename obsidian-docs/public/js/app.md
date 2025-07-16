# `app.js`

**Main Frontend Application Entry Point**

`app.js` serves as the central orchestrator for the NexusFlix frontend application. It initializes all core modules, establishes communication between them, and sets up global event listeners and configurations.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Global Variables|Global Variables]]
- [[#Class|Class]]
  - [[#MediaStreamingApp|MediaStreamingApp]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#initialize|initialize]]
  - [[#setupSidebarToggle|setupSidebarToggle]]
  - [[#setupEventListeners|setupEventListeners]]
  - [[#setupGlobalSettings|setupGlobalSettings]]
  - [[#showInitializationError|showInitializationError]]
- [[#Initialization|Initialization]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

This module imports and initializes instances of almost all other frontend modules:

- `TMDBApi`: For interacting with The Movie Database.
- `GeminiApi`: For AI-powered content generation.
- `MediaCardRenderer`: For rendering media content in grids.
- `SearchHandler`: For managing search functionality.
- `ModalManager`: For controlling modal dialogs (details, video player).
- `LocalLibraryManager`: For managing the user's local media library.
- `PageManager`: For loading and displaying content on different application pages.
- `NavigationManager`: For handling application navigation and the sidebar.
- `EventHandler`: For centralizing global DOM event handling.
- `GlobalSettingsModal`: For managing application-wide settings.
- `themeManager`: For applying and managing themes.

---

## Global Variables

For backward compatibility or potential external access, some core data structures are exposed globally:

- `localMovies`: An array of movie objects from the local library.
- `localSeries`: An array of TV series objects from the local library.
- `localFileDatabase`: A map linking media IDs to local file paths.
- `window.nexusPlayer`: A global reference to the active `VideoPlayer` instance when a video is playing.

---

## Class

### `MediaStreamingApp`

The main application class that encapsulates the initialization and coordination logic.

---

## Methods

### `constructor`

Initializes all module properties to `null`.

### `initialize`

Asynchronously initializes all application components in a specific order to ensure dependencies are met.

- **Initialization Flow**:
  1.  **API Services**: `TMDBApi` and `GeminiApi` are created.
  2.  **Local Library**: `LocalLibraryManager` is initialized and `loadFromServer()` is called to fetch existing library data. This data then populates the global `localMovies`, `localSeries`, and `localFileDatabase` variables.
  3.  **UI Components**: `MediaCardRenderer`, `SearchHandler`, `ModalManager`, `PageManager`, and `NavigationManager` are initialized, often receiving references to other managers they depend on.
  4.  **Global Settings**: `GlobalSettingsModal` is initialized.
  5.  **Event Handling**: `EventHandler` is initialized last, as it often depends on other managers being ready to handle their respective events.
  6.  **Event Listeners**: `setupEventListeners()` is called to establish cross-module communication.
  7.  **UI Setup**: `setupGlobalSettings()` and `setupSidebarToggle()` configure UI elements.
  8.  **Page Content**: `pageManager.initialize()` loads the initial content for the application pages.
  9.  **Final Touches**: `lucide.createIcons()` renders icons, and `navigationManager.navigateTo()` sets the initial view based on the URL hash.
- **Error Handling**: Includes a `try-catch` block to display a user-friendly error message if initialization fails.

### `setupSidebarToggle`

Configures the behavior of the mobile sidebar toggle, allowing it to open and close.

### `setupEventListeners`

Sets up custom event listeners for inter-module communication:

- `contentReload`: Triggers `pageManager.loadAllContent()` when the local library is updated (e.g., after changing a TMDB match).
- `localLibraryUpdated`: Updates the `SearchHandler`'s internal local data when the `LocalLibraryManager`'s data changes.
- `filesDatabaseUpdated`: Updates the `MediaCardRenderer`'s reference to the `localFileDatabase`.

### `setupGlobalSettings`

Attaches an event listener to the global settings button and sets up a keyboard shortcut (Ctrl+,) to open the `GlobalSettingsModal`.

### `showInitializationError`

Displays a user-friendly error message on the screen if the application fails to initialize, with an option to reload.

---

## Initialization

The application is initialized once the DOM is fully loaded:

```javascript
document.addEventListener("DOMContentLoaded", async () => {
  const app = new MediaStreamingApp();
  await app.initialize();
});
```

This ensures that all necessary DOM elements are available before the JavaScript attempts to interact with them.

---

## Related Documentation
- [[TMDBApi]]
- [[GeminiApi]]
- [[MediaCardRenderer]]
- [[SearchHandler]]
- [[ModalManager]]
- [[LocalLibraryManager]]
- [[PageManager]]
- [[NavigationManager]]
- [[EventHandler]]
- [[GlobalSettingsModal]]
- [[theme-manager]]
- [[Frontend Overview]]
