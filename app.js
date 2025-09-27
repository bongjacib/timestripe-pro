// TimeStripe Pro - Horizons View App
class TimeStripeApp {
    constructor() {
        this.currentView = 'horizons'; // Horizons is default view
        this.currentTheme = this.loadTheme();
        this.data = this.loadData();
        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
        this.setupServiceWorker();
        this.updateDateDisplay();
        
        // Horizons view is automatically shown as default
        console.log('✅ TimeStripe Pro initialized with Horizons view');
    }

    // Theme Management
    loadTheme() {
        const saved = localStorage.getItem('timestripe-theme');
        return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }

    applyTheme() {
        document.body.setAttribute('data-theme', this.currentTheme);
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        localStorage.setItem('timestripe-theme', this.currentTheme);
    }

    // View Management
    switchView(viewName) {
        if (!viewName || viewName === this.currentView) return;

        // Update sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const targetNav = document.querySelector(`[data-view="${viewName}"]`);
        if (targetNav) {
            targetNav.classList.add('active');
        }

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Update header
        const viewTitle = document.getElementById('current-view-title');
        if (viewTitle) {
            viewTitle.textContent = this.formatViewName(viewName);
        }

        this.currentView = viewName;
    }

    formatViewName(viewName) {
        const viewNames = {
            horizons: 'Horizons',
            hours: 'Hours',
            days: 'Days',
            weeks: 'Weeks',
            months: 'Months',
            years: 'Years',
            pinned: 'Pinned Items',
            notes: 'Notes',
            boards: 'Boards',
            docs: 'Documents',
            tasks: 'Tasks',
            workouts: 'Workout Routines',
            okr: 'OKR 101'
        };
        return viewNames[viewName] || viewName.charAt(0).toUpperCase() + viewName.slice(1);
    }

    // Event Binding
    bindEvents() {
        // Task form
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // Sidebar navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.sidebar-item[data-view]')) {
                const view = e.target.closest('.sidebar-item[data-view]').dataset.view;
                this.switchView(view);
            }

            // Modal close
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.openTaskModal();
            }
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    // Task Management
    openTaskModal(taskData = {}) {
        const isEdit = !!taskData.id;
        document.getElementById('task-modal-title').textContent = isEdit ? 'Edit Task' : 'Add Task';
        document.getElementById('task-submit-text').textContent = isEdit ? 'Update Task' : 'Add Task';

        if (isEdit) {
            document.getElementById('edit-task-id').value = taskData.id;
            document.getElementById('task-title').value = taskData.title || '';
            document.getElementById('task-description').value = taskData.description || '';
            document.getElementById('task-horizon').value = taskData.horizon || 'today';
            document.getElementById('task-priority').value = taskData.priority || 'medium';
        } else {
            document.getElementById('edit-task-id').value = '';
            document.getElementById('task-form').reset();
            
            // Set default horizon if provided
            if (taskData.horizon) {
                document.getElementById('task-horizon').value = taskData.horizon;
            }
        }

        this.openModal('task-modal');
    }

    saveTask() {
        // Basic task saving functionality
        this.closeModal('task-modal');
        this.showNotification('Task saved successfully', 'success');
    }

    addToHorizon(horizon) {
        this.openTaskModal({ horizon: horizon });
    }

    // Modal Management
    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        document.body.style.overflow = '';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
    }

    // Mobile Menu
    toggleMobileMenu(show) {
        const sidebar = document.getElementById('main-sidebar');
        if (typeof show === 'boolean') {
            sidebar.classList.toggle('active', show);
        } else {
            sidebar.classList.toggle('active');
        }
    }

    // Utility Functions
    updateDateDisplay() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            dateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Simple console notification
    }

    exportData() {
        this.showNotification('Export functionality coming soon!', 'info');
    }

    // Service Worker Setup
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('✅ Service Worker registered successfully');
                    })
                    .catch(registrationError => {
                        console.log('❌ Service Worker registration failed: ', registrationError);
                    });
            });
        }
    }

    // Data Management (basic)
    loadData() {
        const saved = localStorage.getItem('timestripe-data');
        return saved ? JSON.parse(saved) : { tasks: [], lastSaved: new Date().toISOString() };
    }

    saveData() {
        localStorage.setItem('timestripe-data', JSON.stringify(this.data));
    }
}

// Initialize the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new TimeStripeApp();
    });
} else {
    window.app = new TimeStripeApp();
}
