// TimeStripe Pro - Enhanced Main Application Class
class TimeStripeApp {
    constructor() {
        this.currentView = 'horizons';
        this.currentTheme = this.loadTheme();
        this.data = this.loadData();
        this.isInitialized = false;
        this.pendingActions = [];
        
        // Bind methods to maintain context
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
        
        this.init();
    }

    // Enhanced Initialization with Error Handling
    init() {
        try {
            // Wait for DOM to be fully ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.initializeApp());
            } else {
                this.initializeApp();
            }
        } catch (error) {
            this.handleCriticalError('Initialization failed', error);
        }
    }

    initializeApp() {
        console.log('🚀 TimeStripe Pro initializing...');
        
        // Initialize core systems in proper order
        this.applyTheme();
        this.bindEvents();
        this.validateDataStructure();
        this.setupSampleData();
        this.updateDateDisplay();
        this.renderCurrentView();
        this.setupServiceWorker();
        
        // Process any pending actions
        this.processPendingActions();
        
        this.isInitialized = true;
        console.log('✅ TimeStripe Pro initialized successfully');
        
        // Show welcome notification
        setTimeout(() => {
            this.showNotification('TimeStripe Pro is ready! Use Ctrl+N to add tasks.', 'success', 4000);
        }, 1000);
    }

    // Enhanced Error Handling
    handleCriticalError(message, error) {
        console.error('❌ Critical Error:', message, error);
        
        // Show user-friendly error message
        this.showNotification('Application error occurred. Please refresh the page.', 'error', 5000);
        
        // Try to save current state
        try {
            this.saveData();
        } catch (e) {
            console.error('Failed to save data during error:', e);
        }
    }

    // Enhanced Theme Management
    loadTheme() {
        try {
            const saved = localStorage.getItem('timestripe-theme');
            if (saved && (saved === 'light' || saved === 'dark')) {
                return saved;
            }
            
            // Default to system preference
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (error) {
            console.warn('Failed to load theme, using light as default');
            return 'light';
        }
    }

    saveTheme() {
        try {
            localStorage.setItem('timestripe-theme', this.currentTheme);
        } catch (error) {
            console.warn('Failed to save theme preference:', error);
        }
    }

    applyTheme() {
        try {
            document.body.setAttribute('data-theme', this.currentTheme);
            this.updateThemeButton();
            
            // Update meta theme color for mobile browsers
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.setAttribute('content', this.currentTheme === 'dark' ? '#0f0f0f' : '#2563eb');
            }
        } catch (error) {
            console.warn('Failed to apply theme:', error);
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme();
        this.saveTheme();
        this.showNotification(`Switched to ${this.currentTheme} mode`, 'success');
    }

    updateThemeButton() {
        try {
            const themeBtn = document.querySelector('.theme-toggle');
            if (themeBtn) {
                const icon = themeBtn.querySelector('i');
                const text = themeBtn.querySelector('span');
                if (icon) {
                    icon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
                }
                if (text) {
                    text.textContent = this.currentTheme === 'light' ? 'Dark Mode' : 'Light Mode';
                }
            }
        } catch (error) {
            console.warn('Failed to update theme button:', error);
        }
    }

    // Enhanced Data Management with Validation
    loadData() {
        try {
            const saved = localStorage.getItem('timestripe-data');
            if (saved) {
                const data = JSON.parse(saved);
                return this.validateDataStructure(data) ? data : this.getDefaultData();
            }
            return this.getDefaultData();
        } catch (error) {
            console.warn('Failed to load data, using defaults:', error);
            return this.getDefaultData();
        }
    }

    getDefaultData() {
        return {
            version: '2.0.0',
            tasks: [],
            habits: [],
            goals: [],
            notes: [],
            lastSaved: new Date().toISOString(),
            settings: {
                notifications: true,
                autoSave: true,
                startOfWeek: 'monday',
                defaultHorizon: 'today'
            }
        };
    }

    validateDataStructure(data) {
        const requiredProps = ['version', 'tasks', 'lastSaved', 'settings'];
        return requiredProps.every(prop => prop in data) && 
               Array.isArray(data.tasks) &&
               typeof data.settings === 'object';
    }

    saveData() {
        if (!this.isInitialized) {
            this.pendingActions.push(() => this.saveData());
            return;
        }

        try {
            this.data.lastSaved = new Date().toISOString();
            localStorage.setItem('timestripe-data', JSON.stringify(this.data));
            
            if (this.data.settings.autoSave) {
                this.showNotification('Data saved automatically', 'info', 2000);
            }
        } catch (error) {
            console.error('Failed to save data:', error);
            this.showNotification('Failed to save data', 'error');
        }
    }

    // Enhanced Sample Data Setup
    setupSampleData() {
        if (this.data.tasks.length === 0) {
            this.data.tasks = this.getSampleTasks();
            this.saveData();
        }
    }

    getSampleTasks() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        return [
            {
                id: this.generateId(),
                title: 'Workout Chest, Back and Abs',
                description: 'Complete morning workout routine',
                meta: '$100 to $215',
                horizon: 'today',
                priority: 'medium',
                completed: false,
                createdAt: now.toISOString(),
                dueDate: now.toISOString().split('T')[0]
            },
            {
                id: this.generateId(),
                title: 'Target week to post all safe items',
                description: 'Set all safe items at home or FB Marketplace',
                horizon: 'week',
                priority: 'high',
                completed: false,
                createdAt: now.toISOString(),
                dueDate: nextWeek.toISOString().split('T')[0]
            },
            {
                id: this.generateId(),
                title: 'Start daily workout routines en route to 60 days',
                description: 'Create Ideal Body in 60 Days until October 30, 2025',
                horizon: 'month',
                priority: 'medium',
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Create Ideal Body in 60 Days until October 30, 2025',
                horizon: 'year',
                priority: 'high',
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Buy a 2023 Toyota Corolla Cross by December 31, 2025',
                horizon: 'year',
                priority: 'medium',
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Maintain Ideal Body',
                horizon: 'life',
                priority: 'low',
                completed: false,
                createdAt: now.toISOString()
            }
        ];
    }

    // Enhanced Event Binding with Delegation
    bindEvents() {
        try {
            // Use event delegation for better performance
            document.addEventListener('click', this.handleClick);
            document.addEventListener('keydown', this.handleKeyDown);
            window.addEventListener('beforeunload', this.handleBeforeUnload);
            
            // Form submissions
            const taskForm = document.getElementById('task-form');
            if (taskForm) {
                taskForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveTask();
                });
            }
            
            // Responsive behavior
            this.setupResponsiveBehavior();
            
            // Focus management for accessibility
            this.setupFocusManagement();
            
        } catch (error) {
            this.handleCriticalError('Event binding failed', error);
        }
    }

    handleClick(event) {
        try {
            const target = event.target;
            
            // Sidebar navigation
            if (target.closest('.sidebar-item[data-view]')) {
                const view = target.closest('.sidebar-item[data-view]').dataset.view;
                this.switchView(view);
                return;
            }
            
            // Task completion
            if (target.type === 'checkbox' && target.closest('.task-checkbox')) {
                this.toggleTaskCompletion(target);
                return;
            }
            
            // Modal backdrop close
            if (target.classList.contains('modal')) {
                this.closeModal(target.id);
                return;
            }
            
        } catch (error) {
            console.warn('Click handler error:', error);
        }
    }

    handleKeyDown(event) {
        try {
            this.handleKeyboardShortcuts(event);
        } catch (error) {
            console.warn('Keydown handler error:', error);
        }
    }

    handleBeforeUnload() {
        try {
            if (this.data.settings.autoSave) {
                this.saveData();
            }
        } catch (error) {
            console.warn('Beforeunload handler error:', error);
        }
    }

    // Enhanced View Management
    switchView(viewName) {
        if (!viewName || viewName === this.currentView) return;
        
        try {
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
            this.renderCurrentView();
            
            // Close mobile sidebar if open
            if (window.innerWidth <= 768) {
                this.toggleMobileMenu(false);
            }
            
        } catch (error) {
            this.handleCriticalError(`Failed to switch to view: ${viewName}`, error);
        }
    }

    formatViewName(viewName) {
        const viewNames = {
            horizons: 'Horizons',
            days: 'Days',
            weeks: 'Weeks',
            months: 'Months',
            years: 'Years',
            calendar: 'Calendar',
            habits: 'Habits',
            goals: 'Goals',
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

    renderCurrentView() {
        try {
            switch (this.currentView) {
                case 'horizons':
                    this.renderHorizonsView();
                    break;
                case 'habits':
                    this.renderHabitsView();
                    break;
                case 'goals':
                    this.renderGoalsView();
                    break;
                case 'calendar':
                    this.renderCalendarView();
                    break;
                default:
                    // For other views, ensure they have basic content
                    this.ensureViewContent(this.currentView);
            }
        } catch (error) {
            this.handleCriticalError(`Failed to render view: ${this.currentView}`, error);
        }
    }

    // Enhanced Horizons View Rendering
    renderHorizonsView() {
        const horizons = ['today', 'week', 'month', 'year', 'life'];
        
        horizons.forEach(horizon => {
            const container = document.getElementById(`${horizon}-tasks`);
            if (!container) {
                console.warn(`Container not found for horizon: ${horizon}`);
                return;
            }
            
            try {
                const tasks = this.data.tasks.filter(task => 
                    task.horizon === horizon && !task.completed
                );
                
                if (tasks.length === 0) {
                    container.innerHTML = '<div class="empty-state">No tasks yet. Click + to add one.</div>';
                } else {
                    container.innerHTML = tasks.map(task => this.renderTaskItem(task)).join('');
                }
                
                // Re-bind task actions
                this.bindTaskActions(container);
                
            } catch (error) {
                console.error(`Failed to render horizon: ${horizon}`, error);
                container.innerHTML = '<div class="empty-state">Error loading tasks</div>';
            }
        });
    }

    renderTaskItem(task) {
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
        const priorityClass = task.priority ? `priority-${task.priority}` : '';
        
        return `
            <div class="task-item ${task.completed ? 'completed' : ''} ${priorityClass}" data-id="${task.id}">
                <div class="task-checkbox">
                    <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
                    <label for="task-${task.id}" aria-label="Mark task as completed"></label>
                </div>
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-meta">${this.escapeHtml(task.description)}</div>` : ''}
                    ${task.meta ? `<div class="task-meta">${this.escapeHtml(task.meta)}</div>` : ''}
                    ${dueDate ? `<div class="task-meta"><i class="fas fa-calendar"></i> Due ${dueDate}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="task-btn" onclick="app.editTask('${task.id}')" aria-label="Edit task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-btn" onclick="app.deleteTask('${task.id}')" aria-label="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    bindTaskActions(container) {
        // Checkbox events are handled by event delegation
        // Additional actions can be bound here if needed
    }

    // Enhanced Task Management
    toggleTaskCompletion(checkbox) {
        const taskId = checkbox.id.replace('task-', '');
        const task = this.data.tasks.find(t => t.id === taskId);
        
        if (task) {
            task.completed = checkbox.checked;
            task.completedAt = checkbox.checked ? new Date().toISOString() : null;
            task.lastModified = new Date().toISOString();
            
            this.saveData();
            
            // Visual feedback
            const taskElement = checkbox.closest('.task-item');
            if (taskElement) {
                taskElement.classList.toggle('completed', checkbox.checked);
                
                if (checkbox.checked) {
                    this.showNotification(`Completed: ${task.title}`, 'success');
                    
                    // Animate and remove after delay
                    setTimeout(() => {
                        if (this.currentView === 'horizons') {
                            this.renderHorizonsView();
                        }
                    }, 1000);
                }
            }
        }
    }

    openTaskModal(taskData = {}) {
        try {
            const modal = document.getElementById('task-modal');
            if (!modal) {
                this.showNotification('Task modal not found', 'error');
                return;
            }
            
            // Set modal title and submit text
            const isEdit = !!taskData.id;
            document.getElementById('task-modal-title').textContent = 
                isEdit ? 'Edit Task' : 'Add Task';
            document.getElementById('task-submit-text').textContent = 
                isEdit ? 'Update Task' : 'Add Task';
            
            // Fill form data
            if (isEdit) {
                document.getElementById('edit-task-id').value = taskData.id;
                document.getElementById('task-title').value = taskData.title || '';
                document.getElementById('task-description').value = taskData.description || '';
                document.getElementById('task-horizon').value = taskData.horizon || 'today';
                document.getElementById('task-priority').value = taskData.priority || 'medium';
                
                if (taskData.dueDate) {
                    document.getElementById('task-date').value = taskData.dueDate;
                }
            } else {
                document.getElementById('edit-task-id').value = '';
                document.getElementById('task-form').reset();
                
                // Set default horizon if provided
                if (taskData.horizon) {
                    document.getElementById('task-horizon').value = taskData.horizon;
                }
                
                // Set today's date as default
                document.getElementById('task-date').value = new Date().toISOString().split('T')[0];
            }
            
            this.openModal('task-modal');
            document.getElementById('task-title').focus();
            
        } catch (error) {
            this.handleCriticalError('Failed to open task modal', error);
        }
    }

    saveTask() {
        try {
            const form = document.getElementById('task-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const isEdit = !!document.getElementById('edit-task-id').value;
            const taskId = isEdit ? document.getElementById('edit-task-id').value : this.generateId();
            
            const task = {
                id: taskId,
                title: document.getElementById('task-title').value.trim(),
                description: document.getElementById('task-description').value.trim(),
                horizon: document.getElementById('task-horizon').value,
                priority: document.getElementById('task-priority').value,
                completed: false,
                createdAt: isEdit ? this.data.tasks.find(t => t.id === taskId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
                lastModified: new Date().toISOString()
            };
            
            const dueDate = document.getElementById('task-date').value;
            if (dueDate) {
                task.dueDate = dueDate;
            }
            
            if (isEdit) {
                const index = this.data.tasks.findIndex(t => t.id === taskId);
                if (index !== -1) {
                    this.data.tasks[index] = { ...this.data.tasks[index], ...task };
                }
            } else {
                this.data.tasks.push(task);
            }
            
            this.saveData();
            this.closeModal('task-modal');
            
            if (this.currentView === 'horizons') {
                this.renderHorizonsView();
            }
            
            this.showNotification(`Task ${isEdit ? 'updated' : 'added'} successfully`, 'success');
            
        } catch (error) {
            this.handleCriticalError('Failed to save task', error);
        }
    }

    editTask(taskId) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (task) {
            this.openTaskModal(task);
        }
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
            this.saveData();
            
            if (this.currentView === 'horizons') {
                this.renderHorizonsView();
            }
            
            this.showNotification('Task deleted', 'success');
        }
    }

    // Enhanced Modal Management
    openModal(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden'; // Prevent background scrolling
            }
        } catch (error) {
            console.warn(`Failed to open modal: ${modalId}`, error);
        }
    }

    closeModal(modalId) {
        try {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = ''; // Restore scrolling
            }
        } catch (error) {
            console.warn(`Failed to close modal: ${modalId}`, error);
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = '';
    }

    // Enhanced Notification System
    showNotification(message, type = 'info', duration = 3000) {
        try {
            const notification = document.getElementById('notification');
            const messageEl = document.getElementById('notification-message');
            const iconEl = notification.querySelector('.notification-icon');
            
            if (notification && messageEl) {
                // Set icon based on type
                const icons = {
                    success: 'fas fa-check-circle',
                    error: 'fas fa-exclamation-circle',
                    warning: 'fas fa-exclamation-triangle',
                    info: 'fas fa-info-circle'
                };
                
                if (iconEl) {
                    iconEl.className = `notification-icon ${icons[type] || icons.info}`;
                }
                
                messageEl.textContent = message;
                notification.className = `notification ${type}`;
                notification.classList.remove('hidden');
                
                // Auto-hide after duration
                if (duration > 0) {
                    setTimeout(() => {
                        this.hideNotification();
                    }, duration);
                }
            }
        } catch (error) {
            console.warn('Failed to show notification:', error);
        }
    }

    hideNotification() {
        try {
            const notification = document.getElementById('notification');
            if (notification) {
                notification.classList.add('hidden');
            }
        } catch (error) {
            console.warn('Failed to hide notification:', error);
        }
    }

    // Enhanced Utility Functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateDateDisplay() {
        try {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dateElement = document.getElementById('current-date');
            
            if (dateElement) {
                dateElement.textContent = now.toLocaleDateString('en-US', options);
            }
        } catch (error) {
            console.warn('Failed to update date display:', error);
        }
    }

    // Enhanced Keyboard Shortcuts
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + N - New task
        if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
            event.preventDefault();
            this.openQuickAdd();
        }
        
        // Ctrl/Cmd + S - Save data
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.saveData();
            this.showNotification('Data saved manually', 'success');
        }
        
        // Ctrl/Cmd + D - Toggle theme
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            this.toggleTheme();
        }
        
        // Ctrl/Cmd + K - Search (placeholder)
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            this.showNotification('Search functionality coming soon!', 'info');
        }
        
        // Escape - Close modals
        if (event.key === 'Escape') {
            this.closeAllModals();
        }
        
        // Number keys 1-6 for quick navigation (placeholder)
        if ((event.ctrlKey || event.metaKey) && event.key >= '1' && event.key <= '6') {
            event.preventDefault();
            const views = ['horizons', 'days', 'weeks', 'months', 'years', 'goals'];
            const viewIndex = parseInt(event.key) - 1;
            if (views[viewIndex]) {
                this.switchView(views[viewIndex]);
            }
        }
    }

    // Enhanced Responsive Behavior
    setupResponsiveBehavior() {
        this.toggleMobileMenu = (show) => {
            const sidebar = document.getElementById('main-sidebar');
            if (sidebar) {
                if (typeof show === 'boolean') {
                    sidebar.classList.toggle('active', show);
                } else {
                    sidebar.classList.toggle('active');
                }
            }
        };

        // Close sidebar when clicking on main content on mobile
        document.querySelector('.main-content').addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && !event.target.closest('.mobile-menu-btn')) {
                this.toggleMobileMenu(false);
            }
        });

        // Handle window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth > 768) {
                    this.toggleMobileMenu(false);
                }
            }, 250);
        });
    }

    setupFocusManagement() {
        // Ensure focus is managed properly for accessibility
        document.addEventListener('focusin', (event) => {
            if (event.target.matches('button, input, select, textarea, [tabindex]')) {
                event.target.classList.add('focus-visible');
            }
        });
        
        document.addEventListener('focusout', (event) => {
            event.target.classList.remove('focus-visible');
        });
    }

    // Process pending actions after initialization
    processPendingActions() {
        while (this.pendingActions.length > 0) {
            const action = this.pendingActions.shift();
            try {
                action();
            } catch (error) {
                console.warn('Failed to execute pending action:', error);
            }
        }
    }

    // Enhanced Service Worker Setup
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(registration => {
                        console.log('SW registered: ', registration);
                        registration.update(); // Check for updates
                    })
                    .catch(registrationError => {
                        console.log('SW registration failed: ', registrationError);
                    });
            });
        }
    }

    // Placeholder methods for future features
    openQuickAdd() {
        this.openModal('quick-add-modal');
    }

    openHabitModal() {
        this.showNotification('Habit tracking coming soon!', 'info');
    }

    openGoalModal() {
        this.showNotification('Goal management coming soon!', 'info');
    }

    openNoteModal() {
        this.showNotification('Notes feature coming soon!', 'info');
    }

    openSettings() {
        this.openModal('settings-modal');
    }

    addToSection(section) {
        this.openTaskModal({ horizon: section });
    }

    ensureViewContent(viewName) {
        // Ensure all views have basic content
        const view = document.getElementById(`${viewName}-view`);
        if (view && view.children.length === 0) {
            view.innerHTML = `
                <div class="view-placeholder">
                    <i class="fas fa-cogs fa-3x"></i>
                    <h3>${this.formatViewName(viewName)}</h3>
                    <p>This view is under development. Check back soon!</p>
                </div>
            `;
        }
    }

    // Data management methods
    exportData() {
        try {
            const dataStr = JSON.stringify(this.data, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `timestripe-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification('Data exported successfully', 'success');
        } catch (error) {
            this.showNotification('Failed to export data', 'error');
        }
    }

    importData() {
        this.showNotification('Import functionality coming soon!', 'info');
    }

    clearData() {
        if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
            localStorage.removeItem('timestripe-data');
            localStorage.removeItem('timestripe-theme');
            this.showNotification('All data cleared. Page will reload.', 'warning');
            setTimeout(() => location.reload(), 2000);
        }
    }

    // View rendering placeholders
    renderHabitsView() {
        this.ensureViewContent('habits');
    }

    renderGoalsView() {
        this.ensureViewContent('goals');
    }

    renderCalendarView() {
        this.ensureViewContent('calendar');
    }
}

// Enhanced initialization with error boundary
function initializeAppWithErrorBoundary() {
    try {
        // Create global app instance
        window.app = new TimeStripeApp();
        
        // Expose app globally for debugging
        if (typeof window !== 'undefined') {
            window.TimeStripeApp = TimeStripeApp;
        }
        
    } catch (error) {
        console.error('💥 Critical application error:', error);
        
        // Show error UI
        document.body.innerHTML = `
            <div class="error-boundary">
                <h3>Application Error</h3>
                <p>TimeStripe Pro failed to load. Please refresh the page.</p>
                <button onclick="location.reload()" class="btn-primary">Reload Application</button>
                <details style="margin-top: 1rem; text-align: left;">
                    <summary>Technical Details</summary>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 0.5rem; margin-top: 0.5rem; overflow: auto; max-height: 200px;">${error.stack}</pre>
                </details>
            </div>
        `;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAppWithErrorBoundary);
} else {
    initializeAppWithErrorBoundary();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeStripeApp;
}
