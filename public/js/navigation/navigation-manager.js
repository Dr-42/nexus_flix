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

  getCurrentPage() {
    const activePage = document.querySelector(".page-content:not(.hidden)");
    return activePage ? activePage.id : "dashboard";
  }
}

