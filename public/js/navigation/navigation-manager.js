/**
 * Navigation and theme management
 */
export class NavigationManager {
  constructor() {
    this.navLinks = document.querySelectorAll(".nav-link");
    this.pages = document.querySelectorAll(".page-content");
    this.sidebar = document.getElementById("sidebar");
    this.menuToggle = document.getElementById("menu-toggle");
    this.searchInput = document.getElementById("search-input");
    this.pageContentWrapper = document.getElementById("page-content-wrapper");
    this.searchResultsContainer = document.getElementById("search-results");
    
    this.setupNavigationListeners();
    this.setupMobileMenu();
    this.setupThemeSwitcher();
  }

  setupNavigationListeners() {
    this.navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigateTo(e.currentTarget.hash);
      });
    });
  }

  navigateTo(hash) {
    const targetHash = hash || "#dashboard";
    
    this.navLinks.forEach((link) =>
      link.classList.toggle("active", link.hash === targetHash),
    );
    
    this.pages.forEach((page) =>
      page.classList.toggle("hidden", `#${page.id}` !== targetHash),
    );

    if (this.searchInput.value.trim().length < 3) {
      this.pageContentWrapper.classList.remove("hidden");
      this.searchResultsContainer.classList.add("hidden");
    }

    // Trigger specific page actions
    if (targetHash === "#local-library") {
      // This would be handled by the LocalLibraryManager
      const event = new CustomEvent('pageChanged', { detail: { page: 'local-library' } });
      document.dispatchEvent(event);
    }

    if (window.innerWidth < 768) {
      this.sidebar.classList.add("-translate-x-full");
    }
  }

  setupMobileMenu() {
    this.menuToggle.addEventListener("click", () => {
      this.sidebar.classList.toggle("-translate-x-full");
    });
  }

  setupThemeSwitcher() {
    const themeSwitcher = document.getElementById("theme-switcher");
    const themeButtons = themeSwitcher.querySelectorAll(".theme-switch-btn");
    const appContainer = document.getElementById("app-container");
    const glassBg = document.getElementById("glass-bg-element");
    const themes = ["theme-base", "theme-material", "theme-glass"];

    themeSwitcher.addEventListener("click", (e) => {
      if (e.target.matches("[data-theme]")) {
        const selectedTheme = e.target.dataset.theme;
        themes.forEach((theme) => appContainer.classList.remove(theme));
        appContainer.classList.add(selectedTheme);
        themeButtons.forEach((btn) => btn.classList.remove("active"));
        e.target.classList.add("active");
        glassBg.classList.toggle("hidden", selectedTheme !== "theme-glass");
        
        if (selectedTheme === "theme-glass") {
          const randomImageUrl = `https://source.unsplash.com/random/1920x1080/?abstract,gradient,${Date.now()}`;
          glassBg.style.backgroundImage = `url('${randomImageUrl}')`;
        }
      }
    });

    // Set default theme
    themeButtons[0]?.classList.add("active");
  }

  getCurrentPage() {
    const activePage = document.querySelector(".page-content:not(.hidden)");
    return activePage ? activePage.id : "dashboard";
  }
}

