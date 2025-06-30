import { themeManager, globalThemes, videoPlayerThemes } from '../themes/theme-manager.js';

export class GlobalSettingsModal {
    constructor() {
        this.modal = this.createModal();
        document.body.appendChild(this.modal);
        this.setupEventListeners();
        this.currentTab = 'global';
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'global-settings-modal';
        modal.innerHTML = `
            <div class="global-settings-modal-content">
                <div class="settings-header">
                    <h2>Application Settings</h2>
                    <button class="global-close-button">&times;</button>
                </div>
                
                <div class="settings-tabs">
                    <button class="settings-tab active" data-tab="global">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m11-7a4 4 0 0 0-8 0m8 0a4 4 0 0 0 8 0m-8 14a4 4 0 0 0-8 0m8 0a4 4 0 0 0 8 0"/>
                        </svg>
                        Global Themes
                    </button>
                    <button class="settings-tab" data-tab="video">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="23 7 16 12 23 17 23 7"/>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                        Video Player
                    </button>
                </div>

                <div class="settings-content">
                    <div class="settings-panel active" data-panel="global">
                        <p class="settings-subtitle">Choose your preferred application appearance</p>
                        <div class="theme-categories">
                            ${this.generateCategoryTabs()}
                        </div>
                        <div class="theme-grid" id="global-theme-grid">
                            ${this.generateGlobalThemeGrid()}
                        </div>
                    </div>
                    
                    <div class="settings-panel" data-panel="video">
                        <p class="settings-subtitle">Choose your preferred video player appearance</p>
                        <div class="theme-grid" id="video-theme-grid">
                            ${this.generateVideoThemeGrid()}
                        </div>
                    </div>
                </div>
            </div>
        `;
        return modal;
    }

    generateCategoryTabs() {
        const categories = themeManager.getCategories();
        return categories.map(category => `
            <button class="category-tab ${category === 'base' ? 'active' : ''}" data-category="${category}">
                ${this.getCategoryIcon(category)}
                ${this.getCategoryName(category)}
            </button>
        `).join('');
    }

    getCategoryIcon(category) {
        const icons = {
            base: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>',
            color: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20 10 10 0 0 1 0-20z"/></svg>',
            nature: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20m8-10H4"/></svg>'
        };
        return icons[category] || icons.base;
    }

    getCategoryName(category) {
        const names = {
            base: 'Base',
            color: 'Colors',
            nature: 'Nature'
        };
        return names[category] || category;
    }

    generateGlobalThemeGrid() {
        return globalThemes.map(theme => `
            <div class="theme-item ${theme.class === themeManager.getCurrentGlobalTheme() ? 'active' : ''}" 
                 data-theme="${theme.class}" data-category="${theme.category}">
                <div class="theme-preview global-theme-preview ${theme.class}">
                    <div class="preview-header"></div>
                    <div class="preview-content">
                        <div class="preview-card"></div>
                        <div class="preview-card"></div>
                    </div>
                </div>
                <div class="theme-info">
                    <span class="theme-name">${theme.name}</span>
                    <span class="theme-description">${theme.description}</span>
                </div>
            </div>
        `).join('');
    }

    generateVideoThemeGrid() {
        return videoPlayerThemes.map(theme => `
            <div class="theme-item ${theme.class === themeManager.getCurrentVideoTheme() ? 'active' : ''}" 
                 data-theme="${theme.class}">
                <div class="theme-preview video-theme-preview ${theme.class}">
                    <div class="vjs-preview-controls">
                        <div class="vjs-preview-play-btn"></div>
                        <div class="vjs-preview-progress">
                            <div class="vjs-preview-progress-bar"></div>
                        </div>
                        <div class="vjs-preview-volume"></div>
                    </div>
                </div>
                <div class="theme-info">
                    <span class="theme-name">${theme.name}</span>
                    <span class="theme-description">${theme.description}</span>
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        // Close button
        this.modal.querySelector('.global-close-button').addEventListener('click', () => this.hide());
        
        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hide();
        });

        // Tab switching
        this.modal.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Category switching
        this.modal.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                this.switchCategory(category);
            });
        });

        // Global theme selection
        this.modal.querySelectorAll('[data-panel="global"] .theme-item').forEach(item => {
            item.addEventListener('click', () => {
                const themeClass = item.getAttribute('data-theme');
                this.applyGlobalTheme(themeClass, item);
            });
        });

        // Video theme selection
        this.modal.querySelectorAll('[data-panel="video"] .theme-item').forEach(item => {
            item.addEventListener('click', () => {
                const themeClass = item.getAttribute('data-theme');
                this.applyVideoTheme(themeClass, item);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.hide();
            }
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Update tab buttons
        this.modal.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });
        
        // Update panels
        this.modal.querySelectorAll('.settings-panel').forEach(panel => {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === tabName);
        });
    }

    switchCategory(category) {
        // Update category tabs
        this.modal.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-category') === category);
        });
        
        // Show/hide themes based on category
        this.modal.querySelectorAll('[data-panel="global"] .theme-item').forEach(item => {
            const itemCategory = item.getAttribute('data-category');
            item.style.display = itemCategory === category ? 'block' : 'none';
        });
    }

    applyGlobalTheme(themeClass, selectedItem) {
        // Update active state
        this.modal.querySelectorAll('[data-panel="global"] .theme-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedItem.classList.add('active');
        
        // Apply theme
        themeManager.applyGlobalTheme(themeClass);
        
        // Visual feedback
        this.showFeedback('Global theme applied!');
    }

    applyVideoTheme(themeClass, selectedItem) {
        // Update active state
        this.modal.querySelectorAll('[data-panel="video"] .theme-item').forEach(item => {
            item.classList.remove('active');
        });
        selectedItem.classList.add('active');
        
        // Apply theme
        themeManager.applyVideoTheme(themeClass, window.nexusPlayer?.player);
        
        // Visual feedback
        this.showFeedback('Video player theme applied!');
    }

    showFeedback(message) {
        // Create temporary feedback element
        const feedback = document.createElement('div');
        feedback.className = 'theme-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-primary);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
    }

    show() {
        this.modal.style.display = 'block';
        this.updateActiveStates();
    }

    hide() {
        this.modal.style.display = 'none';
    }

    updateActiveStates() {
        // Update global theme active state
        const currentGlobalTheme = themeManager.getCurrentGlobalTheme();
        this.modal.querySelectorAll('[data-panel="global"] .theme-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-theme') === currentGlobalTheme);
        });
        
        // Update video theme active state
        const currentVideoTheme = themeManager.getCurrentVideoTheme();
        this.modal.querySelectorAll('[data-panel="video"] .theme-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-theme') === currentVideoTheme);
        });
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
}
`;
document.head.appendChild(style);