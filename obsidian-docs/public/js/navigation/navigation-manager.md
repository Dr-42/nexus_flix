# `navigation-manager.js`

**Navigation and Page Management**

This module handles all aspects of navigation within the application, including switching between pages and managing the mobile menu.

## Table of Contents
- [[#Dependencies|Dependencies]]
- [[#Class|Class]]
  - [[#NavigationManager|NavigationManager]]
- [[#Methods|Methods]]
  - [[#constructor|constructor]]
  - [[#setupNavigationListeners|setupNavigationListeners]]
  - [[#navigateTo|navigateTo]]
  - [[#setupMobileMenu|setupMobileMenu]]
  - [[#getCurrentPage|getCurrentPage]]
- [[#Related Documentation|Related Documentation]]

---

## Dependencies

- None

---

## Class

### `NavigationManager`

A class that encapsulates all navigation-related logic.

---

## Methods

### `constructor`

Initializes the `NavigationManager` class.

- **Behavior**:
  - Gets references to all the necessary DOM elements.
  - Calls `setupNavigationListeners` and `setupMobileMenu` to set up the event listeners.

### `setupNavigationListeners`

Sets up event listeners for the navigation links.

- **Behavior**:
  - Adds a `click` listener to each navigation link that calls `navigateTo`.

### `navigateTo`

Navigates to the specified page.

- **Input**: `hash` - The hash of the page to navigate to (e.g., `"#dashboard"`).
- **Behavior**:
  - Adds the `active` class to the current navigation link and removes it from the others.
  - Shows the corresponding page and hides the others.
  - Dispatches a `pageChanged` event to notify other modules of the page change.
  - Hides the sidebar on mobile devices.

### `setupMobileMenu`

Sets up the event listener for the mobile menu toggle.

### `getCurrentPage`

Returns the ID of the currently active page.

---

## Related Documentation
- [[page-manager]]
- [[Frontend Overview]]
