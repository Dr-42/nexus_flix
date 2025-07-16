# `settings-modal.js`

**Video Player Settings Modal**

This module creates and manages the settings modal for the video player, which allows the user to change the theme of the video player.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#SettingsModal|SettingsModal]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#createModal|createModal]]
  - [[#setupEventListeners|setupEventListeners]]
  - [[#updateActiveState|updateActiveState]]
  - [[#updateLivePreview|updateLivePreview]]
  - [[#applyLayout|applyLayout]]
  - [[#saveThemePreference|saveThemePreference]]
  - [[#loadThemePreference|loadThemePreference]]
  - [[#show|show]]
  - [[#initializeLivePreview|initializeLivePreview]]
  - [[#highlightCurrentTheme|highlightCurrentTheme]]
  - [[#hide|hide]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `VideoPlayer`: To interact with the video player.
- `themeManager`, `videoPlayerThemes`: To manage and get the list of video player themes.

---

## Class

### `SettingsModal`

A class that encapsulates all the logic for the video player settings modal.

---

## Methods

### `constructor`

Initializes the `SettingsModal` class.

### `createModal`

Creates the HTML for the settings modal.

### `setupEventListeners`

Sets up event listeners for the modal.

### `updateActiveState`

Updates the active state of the theme selection grid.

### `updateLivePreview`

Updates the live preview to show the selected theme.

### `applyLayout`

Applies the selected theme to the video player.

### `saveThemePreference`

Saves the selected theme to local storage.

### `loadThemePreference`

Loads the saved theme from local storage.

### `show`

Shows the settings modal.

### `initializeLivePreview`

Initializes the live preview to show the current theme.

### `highlightCurrentTheme`

Highlights the currently applied theme in the theme selection grid.

### `hide`

Hides the settings modal.

---

## Related Documentation
- [[video-player]]
- [[theme-manager]]
- [[Frontend Overview]]
