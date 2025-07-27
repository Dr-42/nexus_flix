import { BackendTMDBApi } from "./api/backend-tmdb-api.js";
import { MediaCardRenderer } from "./ui/media-cards.js";
import { SearchHandler } from "./ui/search-handler.js";
import { ModalManager } from "./ui/modal-manager.js";
import { LocalLibraryManager } from "./library/local-library-manager.js";
import { PageManager } from "./pages/page-manager.js";
import { NavigationManager } from "./navigation/navigation-manager.js";
import { EventHandler } from "./events/event-handler.js";
import { GlobalSettingsModal } from "./ui/global-settings-modal.js";
import { themeManager } from "./themes/theme-manager.js";

// Global variables for backward compatibility (if needed by legacy code)
let localMovies = [];
let localSeries = [];
let localFileDatabase = {};

// Make nexusPlayer available globally for video player functionality
window.nexusPlayer = null;

export class MediaStreamingApp {
  constructor() {
    this.tmdbApi = null;
    this.mediaCardRenderer = null;
    this.searchHandler = null;
    this.modalManager = null;
    this.localLibraryManager = null;
    this.pageManager = null;
    this.navigationManager = null;
    this.eventHandler = null;
    this.globalSettingsModal = null;
  }

  async initialize() {
    try {
      // Initialize API services
      this.tmdbApi = new BackendTMDBApi();

      // Initialize local library manager first (needed by other components)
      this.localLibraryManager = new LocalLibraryManager(this.tmdbApi);
      await this.localLibraryManager.loadFromServer();

      // Update global variables for backward compatibility
      localMovies = this.localLibraryManager.getLocalMovies();
      localSeries = this.localLibraryManager.getLocalSeries();
      localFileDatabase = this.localLibraryManager.getLocalFileDatabase();

      // Initialize UI components
      this.mediaCardRenderer = new MediaCardRenderer(
        this.tmdbApi,
        this.localLibraryManager.getLocalFileDatabase(),
      );

      // Update local library manager with media card renderer
      this.localLibraryManager.mediaCardRenderer = this.mediaCardRenderer;

      this.searchHandler = new SearchHandler(
        this.tmdbApi,
        this.mediaCardRenderer,
        this.localLibraryManager.getLocalMovies(),
        this.localLibraryManager.getLocalSeries(),
      );

      this.modalManager = new ModalManager(
        this.tmdbApi,
        this.localLibraryManager.getLocalFileDatabase(),
      );

      this.pageManager = new PageManager(
        this.tmdbApi,
        this.mediaCardRenderer,
        this.localLibraryManager,
      );

      this.navigationManager = new NavigationManager();

      // Initialize global settings modal
      this.globalSettingsModal = new GlobalSettingsModal();

      // Initialize event handling (must be last)
      this.eventHandler = new EventHandler(
        this.modalManager,
        this.localLibraryManager,
        this.tmdbApi,
      );

      // Setup cross-component communication
      this.setupEventListeners();

      // Setup global settings button
      this.setupGlobalSettings();

      // Setup sidebar toggle
      this.setupSidebarToggle();

      // Initialize page content
      await this.pageManager.initialize();

      // Initialize icons and navigate to current page
      lucide.createIcons();
      this.navigationManager.navigateTo(window.location.hash || "#dashboard");

      console.log("Media Streaming App initialized successfully");
    } catch (error) {
      console.error("Failed to initialize application:", error);
      this.showInitializationError(error);
    }
  }

  setupSidebarToggle() {
    const menuToggle = document.getElementById("menu-toggle");
    const sidebar = document.getElementById("sidebar");
    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", (event) => {
        event.stopPropagation(); // Prevent this click from immediately closing the sidebar
        sidebar.classList.toggle("open");
      });

      document.addEventListener("click", (event) => {
        // Close sidebar if click is outside sidebar and not on the menu toggle
        if (
          !sidebar.contains(event.target) &&
          !menuToggle.contains(event.target) &&
          sidebar.classList.contains("open")
        ) {
          sidebar.classList.remove("open");
        }
      });
    }
  }

  setupEventListeners() {
    // Listen for content reload events
    document.addEventListener("contentReload", () => {
      this.pageManager.loadAllContent();
    });

    // Update search handler when local library changes
    document.addEventListener("localLibraryUpdated", () => {
      this.searchHandler.updateLocalData(
        this.localLibraryManager.getLocalMovies(),
        this.localLibraryManager.getLocalSeries(),
      );
    });

    // Update media card renderer when file database changes
    document.addEventListener("filesDatabaseUpdated", () => {
      this.mediaCardRenderer.localFileDatabase =
        this.localLibraryManager.getLocalFileDatabase();
    });
  }

  setupGlobalSettings() {
    const settingsBtn = document.getElementById("global-settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        this.globalSettingsModal.show();
      });
    }

    // Add keyboard shortcut for global settings
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === ",") {
        // Ctrl+, (common settings shortcut)
        e.preventDefault();
        this.globalSettingsModal.show();
      }
    });
  }

  showInitializationError(error) {
    const appContainer = document.getElementById("app-container");
    if (appContainer) {
      appContainer.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-900 text-white">
          <div class="text-center p-8 max-w-md">
            <h1 class="text-2xl font-bold mb-4 text-red-400">Application Failed to Load</h1>
            <p class="text-gray-300 mb-4">${error.message}</p>
            <button onclick="location.reload()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
              Reload Application
            </button>
          </div>
        </div>
      `;
    }
  }
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  const app = new MediaStreamingApp();
  await app.initialize();
});
