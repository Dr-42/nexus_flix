# `global-settings-modal.js`

**Global Settings Modal**

This module creates and manages the global settings modal, which allows the user to change the application and video player themes.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#GlobalSettingsModal|GlobalSettingsModal]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#createModal|createModal]]
  - [[#generateCategoryTabs|generateCategoryTabs]]
  - [[#getCategoryIcon|getCategoryIcon]]
  - [[#getCategoryName|getCategoryName]]
  - [[#generateGlobalThemeGrid|generateGlobalThemeGrid]]
  - [[#generateVideoThemeGrid|generateVideoThemeGrid]]
  - [[#setupEventListeners|setupEventListeners]]
  - [[#switchTab|switchTab]]
  - [[#switchCategory|switchCategory]]
  - [[#applyGlobalTheme|applyGlobalTheme]]
  - [[#applyVideoTheme|applyVideoTheme]]
  - [[#showFeedback|showFeedback]]
  - [[#show|show]]
  - [[#hide|hide]]
  - [[#updateActiveStates|updateActiveStates]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- `themeManager`: To apply and manage themes.
- `globalThemes`, `videoPlayerThemes`: To get the list of available themes.

---

## Class

### `GlobalSettingsModal`

A class that encapsulates all the logic for the global settings modal.

---

## Methods

### `constructor`

Initializes the `GlobalSettingsModal` class.

### `createModal`

Creates the HTML for the settings modal.

### `generateCategoryTabs`

Generates the HTML for the theme category tabs.

### `getCategoryIcon`

Returns the SVG icon for a given theme category.

### `getCategoryName`

Returns the name of a given theme category.

### `generateGlobalThemeGrid`

Generates the HTML for the global theme selection grid.

### `generateVideoThemeGrid`

Generates the HTML for the video player theme selection grid.

### `setupEventListeners`

Sets up event listeners for the modal.

### `switchTab`

Switches between the global and video player theme tabs.

### `switchCategory`

Switches between theme categories.

### `applyGlobalTheme`

Applies the selected global theme.

### `applyVideoTheme`

Applies the selected video player theme.

### `showFeedback`

Shows a feedback message to the user.

### `show`

Shows the settings modal.

### `hide`

Hides the settings modal.

### `updateActiveStates`

Updates the active state of the theme selection grids.

---

## Related Documentation
- [[theme-manager]]
- [[Frontend Overview]]
