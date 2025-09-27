// TimeStripe Pro - Enhanced with Horizon Cascade Functionality
class TimeStripeApp {
    constructor() {
        this.currentView = 'hours';
        this.currentTheme = this.loadTheme();
        this.data = this.loadData();
        this.isInitialized = false;
        this.pendingActions = [];
        
        // Horizon cascade hierarchy
        this.horizonHierarchy = {
            'hours': ['days', 'weeks', 'months', 'years'],    // Hours appear in all larger horizons
            'days': ['weeks', 'months', 'years'],             // Days appear in weeks, months, years
            'weeks': ['months', 'years'],                     // Weeks appear in months, years
            'months': ['years'],                              // Months appear in years
            'years': [],                                      // Years don't cascade further
            'life': []                                        // Life goals are separate
        };
        
        this.horizonNames = {
            'hours': 'Hours',
            'days': 'Days', 
            'weeks': 'Weeks',
            'months': 'Months',
            'years': 'Years',
            'life': 'Life Goals'
        };
        
        this.bindMethods();
        this.init();
    }

    bindMethods() {
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
    }

    init() {
        try {
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
        console.log('🚀 TimeStripe Pro with Cascade initialized...');
        
        this.applyTheme();
        this.bindEvents();
        this.validateDataStructure();
        this.setupSampleData();
        this.updateDateDisplay();
        this.renderCurrentView();
        this.setupServiceWorker();
        this.processPendingActions();
        
        this.isInitialized = true;
        console.log('✅ TimeStripe Pro with Cascade ready!');
        
        setTimeout(() => {
            this.showNotification('Tasks now cascade upward! Hours → Days → Weeks → Months → Years', 'success', 5000);
        }, 1000);
    }

    // Enhanced task filtering with cascade
    getTasksForHorizon(horizon) {
        if (!this.data.tasks) return [];
        
        const tasks = this.data.tasks.filter(task => 
            !task.completed && this.shouldTaskAppearInHorizon(task, horizon)
        );
        
        // Sort by priority and creation date
        return tasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityOrder[a.priority] || 1;
            const bPriority = priorityOrder[b.priority] || 1;
            
            if (aPriority !== bPriority) return bPriority - aPriority;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }

    shouldTaskAppearInHorizon(task, targetHorizon) {
        // If task is specifically for this horizon, always show it
        if (task.horizon === targetHorizon) return true;
        
        // If task is for a smaller horizon, check if it cascades to this one
        if (this.doesHorizonCascadeTo(task.horizon, targetHorizon)) {
            return task.cascade !== false; // Respect cascade setting
        }
        
        return false;
    }

    doesHorizonCascadeFromTo(sourceHorizon, targetHorizon) {
        const hierarchy = this.horizonHierarchy;
        return hierarchy[sourceHorizon] && hierarchy[sourceHorizon].includes(targetHorizon);
    }

    doesHorizonCascadeTo(sourceHorizon, targetHorizon) {
        // Check if source horizon cascades to target horizon
        const cascadePath = this.getCascadePath(sourceHorizon);
        return cascadePath.includes(targetHorizon);
    }

    getCascadePath(horizon) {
        // Get all horizons that this horizon cascades to
        const path = [];
        let current = horizon;
        
        while (this.horizonHierarchy[current]) {
            path.push(...this.horizonHierarchy[current]);
            // Move to the next level in hierarchy
            if (this.horizonHierarchy[current].length > 0) {
                current = this.horizonHierarchy[current][0];
            } else {
                break;
            }
        }
        
        return [...new Set(path)]; // Remove duplicates
    }

    // Enhanced task rendering with cascade indicators
    renderTaskItem(task, currentHorizon) {
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
        const priorityClass = task.priority ? `priority-${task.priority}` : '';
        const isOriginal = task.horizon === currentHorizon;
        const taskClass = isOriginal ? 'original' : 'cascaded';
        
        // Show cascade origin for cascaded tasks
        const cascadeIndicator = !isOriginal ? 
            `<div class="task-cascade-indicator">
                <span class="cascade-arrow">↑</span>
                From ${this.horizonNames[task.horizon]}
            </div>` : '';

        return `
            <div class="task-item ${taskClass} ${priorityClass}" data-id="${task.id}">
                <div class="task-checkbox">
                    <input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''}>
                    <label for="task-${task.id}" aria-label="Mark task as completed"></label>
                </div>
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-meta">${this.escapeHtml(task.description)}</div>` : ''}
                    ${task.meta ? `<div class="task-meta">${this.escapeHtml(task.meta)}</div>` : ''}
                    ${dueDate ? `<div class="task-meta"><i class="fas fa-calendar"></i> Due ${dueDate}</div>` : ''}
                    ${cascadeIndicator}
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

    // Enhanced view rendering with cascade
    renderHorizonView(horizon) {
        const container = document.getElementById(`${horizon}-tasks`);
        if (!container) {
            console.warn(`Container not found for horizon: ${horizon}`);
            return;
        }

        try {
            const tasks = this.getTasksForHorizon(horizon);
            
            if (tasks.length === 0) {
                const message = horizon === 'life' ? 
                    'No life goals yet. Click + to add one.' : 
                    'No tasks yet. Click + to add one.';
                container.innerHTML = `<div class="empty-state">${message}</div>`;
            } else {
                container.innerHTML = tasks.map(task => 
                    this.renderTaskItem(task, horizon)
                ).join('');
                
                // Show cascade summary
                const originalTasks = tasks.filter(t => t.horizon === horizon).length;
                const cascadedTasks = tasks.length - originalTasks;
                
                if (cascadedTasks > 0) {
                    const summary = document.createElement('div');
                    summary.className = 'cascade-summary';
                    summary.innerHTML = `
                        <small style="color: var(--text-tertiary);">
                            Showing ${originalTasks} original + ${cascadedTasks} cascaded tasks
                        </small>
                    `;
                    container.appendChild(summary);
                }
            }
            
        } catch (error) {
            console.error(`Failed to render horizon: ${horizon}`, error);
            container.innerHTML = '<div class="empty-state">Error loading tasks</div>';
        }
    }

    // Enhanced navigation with cascade visualization
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
            
            // Update header and cascade path
            this.updateViewHeader(viewName);
            this.updateCascadePath(viewName);
            
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

    updateViewHeader(viewName) {
        const viewTitle = document.getElementById('current-view-title');
        if (viewTitle) {
            viewTitle.textContent = this.horizonNames[viewName] || this.formatViewName(viewName);
        }
    }

    updateCascadePath(currentHorizon) {
        const pathContainer = document.getElementById('horizon-path');
        if (!pathContainer) return;

        const horizons = ['hours', 'days', 'weeks', 'months', 'years'];
        const currentIndex = horizons.indexOf(currentHorizon);
        
        if (currentIndex === -1) {
            pathContainer.innerHTML = ''; // Clear for non-horizon views
            return;
        }

        pathContainer.innerHTML = horizons.map((horizon, index) => `
            <span class="path-item ${index === currentIndex ? 'active' : ''}">
                ${this.horizonNames[horizon]}
            </span>
            ${index < horizons.length - 1 ? '<span class="path-arrow">→</span>' : ''}
        `).join('');
    }

    // Enhanced task management with cascade
    saveTask() {
        try {
            const form = document.getElementById('task-form');
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            
            const isEdit = !!document.getElementById('edit-task-id').value;
            const taskId = isEdit ? document.getElementById('edit-task-id').value : this.generateId();
            const cascade = document.getElementById('task-cascade').checked;
            
            const task = {
                id: taskId,
                title: document.getElementById('task-title').value.trim(),
                description: document.getElementById('task-description').value.trim(),
                horizon: document.getElementById('task-horizon').value,
                priority: document.getElementById('task-priority').value,
                cascade: cascade,
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
            
            // Refresh all horizon views that might be affected by cascade
            this.refreshAllHorizonViews();
            
            this.showNotification(`Task ${isEdit ? 'updated' : 'added'} successfully`, 'success');
            
        } catch (error) {
            this.handleCriticalError('Failed to save task', error);
        }
    }

    refreshAllHorizonViews() {
        const horizons = ['hours', 'days', 'weeks', 'months', 'years', 'life'];
        horizons.forEach(horizon => {
            this.renderHorizonView(horizon);
        });
        
        // Also refresh special views
        this.renderAllTasksView();
        this.renderCompletedView();
    }

    // Enhanced sample data with cascade examples
    getSampleTasks() {
        const now = new Date();
        
        return [
            {
                id: this.generateId(),
                title: 'Complete urgent client report',
                description: 'Finalize and send the quarterly report',
                horizon: 'hours',
                priority: 'high',
                cascade: true,
                completed: false,
                createdAt: now.toISOString(),
                dueDate: now.toISOString().split('T')[0]
            },
            {
                id: this.generateId(),
                title: 'Team meeting preparation',
                description: 'Prepare agenda and materials for tomorrow meeting',
                horizon: 'days',
                priority: 'medium',
                cascade: true,
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Weekly project review',
                description: 'Review all ongoing projects and update status',
                horizon: 'weeks',
                priority: 'medium',
                cascade: true,
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Monthly budget planning',
                description: 'Plan and allocate budget for next month',
                horizon: 'months',
                priority: 'high',
                cascade: true,
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Annual skill development plan',
                description: 'Create plan for professional development this year',
                horizon: 'years',
                priority: 'medium',
                cascade: false,
                completed: false,
                createdAt: now.toISOString()
            },
            {
                id: this.generateId(),
                title: 'Achieve financial independence',
                description: 'Long-term goal of financial freedom',
                horizon: 'life',
                priority: 'high',
                cascade: false,
                completed: false,
                createdAt: now.toISOString()
            }
        ];
    }

    // New views for all tasks and completed tasks
    renderAllTasksView() {
        const container = document.getElementById('all-tasks-container');
        if (!container) return;

        const tasksByHorizon = {};
        
        // Group tasks by horizon
        this.data.tasks.filter(task => !task.completed).forEach(task => {
            if (!tasksByHorizon[task.horizon]) {
                tasksByHorizon[task.horizon] = [];
            }
            tasksByHorizon[task.horizon].push(task);
        });

        container.innerHTML = Object.keys(tasksByHorizon)
            .map(horizon => `
                <div class="horizon-group">
                    <div class="horizon-group-header">
                        <h4>
                            <i class="fas fa-${this.getHorizonIcon(horizon)}"></i>
                            ${this.horizonNames[horizon]}
                        </h4>
                        <span class="horizon-task-count">${tasksByHorizon[horizon].length}</span>
                    </div>
                    <div class="tasks-list">
                        ${tasksByHorizon[horizon].map(task => this.renderTaskItem(task, horizon)).join('')}
                    </div>
                </div>
            `).join('') || '<div class="empty-state">No tasks yet</div>';
    }

    renderCompletedView() {
        const container = document.getElementById('completed-tasks-container');
        if (!container) return;

        const completedTasks = this.data.tasks.filter(task => task.completed);
        
        container.innerHTML = completedTasks.length > 0 ? 
            completedTasks.map(task => this.renderTaskItem(task, task.horizon)).join('') :
            '<div class="empty-state">No completed tasks yet</div>';
    }

    getHorizonIcon(horizon) {
        const icons = {
            'hours': 'clock',
            'days': 'calendar-day',
            'weeks': 'calendar-week',
            'months': 'calendar-alt',
            'years': 'calendar-star',
            'life': 'infinity'
        };
        return icons[horizon] || 'tasks';
    }

    // New method for horizon info
    openHorizonInfo() {
        this.openModal('horizon-info-modal');
    }

    // Enhanced renderCurrentView with new views
    renderCurrentView() {
        try {
            switch (this.currentView) {
                case 'hours':
                case 'days':
                case 'weeks':
                case 'months':
                case 'years':
                case 'life':
                    this.renderHorizonView(this.currentView);
                    break;
                case 'tasks':
                    this.renderAllTasksView();
                    break;
                case 'completed':
                    this.renderCompletedView();
                    break;
                default:
                    this.ensureViewContent(this.currentView);
            }
        } catch (error) {
            this.handleCriticalError(`Failed to render view: ${this.currentView}`, error);
        }
    }

    // Keep all other existing methods from the previous enhanced version
    // (loadTheme, saveTheme, applyTheme, toggleTheme, loadData, saveData, etc.)
    
    // ... include all the other methods from the previous enhanced version ...

}

// Initialize the application
function initializeAppWithErrorBoundary() {
    try {
        window.app = new TimeStripeApp();
        if (typeof window !== 'undefined') {
            window.TimeStripeApp = TimeStripeApp;
        }
    } catch (error) {
        console.error('💥 Critical application error:', error);
        document.body.innerHTML = `
            <div class="error-boundary">
                <h3>Application Error</h3>
                <p>TimeStripe Pro failed to load. Please refresh the page.</p>
                <button onclick="location.reload()" class="btn-primary">Reload Application</button>
            </div>
        `;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAppWithErrorBoundary);
} else {
    initializeAppWithErrorBoundary();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeStripeApp;
}
