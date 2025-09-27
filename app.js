// TimeStripe Pro - Cascading Horizons App
class TimeStripeApp {
    constructor() {
        this.currentView = 'horizons';
        this.currentTheme = this.loadTheme();
        this.data = this.loadData();
        this.init();
    }

   init() {
    this.applyTheme();
    this.bindEvents();
    this.setupSampleData();
    this.updateDateDisplay();
    this.renderCurrentView();
    
    // Add this line
    this.setupServiceWorker();
    
    // Show welcome message
    setTimeout(() => {
        this.showNotification('TimeStripe Pro with Cascading Horizons is ready!', 'success');
    }, 1000);
    // Service Worker Setup
setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('✅ Service Worker registered successfully: ', registration);
                    
                    // Check for updates every hour
                    setInterval(() => {
                        registration.update();
                    }, 60 * 60 * 1000);
                    
                })
                .catch(registrationError => {
                    console.log('❌ Service Worker registration failed: ', registrationError);
                });
        });
    } else {
        console.log('❌ Service Worker not supported in this browser');
    }
}

// ... make sure this is the last method before the closing brace
} // This closes the TimeStripeApp class   
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

    // Data Management
    loadData() {
        const saved = localStorage.getItem('timestripe-data');
        return saved ? JSON.parse(saved) : this.getDefaultData();
    }

    getDefaultData() {
        return {
            version: '2.0.0',
            tasks: [],
            lastSaved: new Date().toISOString()
        };
    }

    saveData() {
        this.data.lastSaved = new Date().toISOString();
        localStorage.setItem('timestripe-data', JSON.stringify(this.data));
    }

    setupSampleData() {
        if (this.data.tasks.length === 0) {
            this.data.tasks = [
                {
                    id: '1',
                    title: 'Workout Chest, Back and Abs',
                    description: 'Complete morning workout routine',
                    meta: '$100 to $215',
                    horizon: 'hours',
                    priority: 'medium',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['days']
                },
                {
                    id: '2',
                    title: 'Target week to post all safe items',
                    description: 'Set all safe items at home or FB Marketplace',
                    horizon: 'weeks',
                    priority: 'high',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['months']
                },
                {
                    id: '3',
                    title: 'Start daily workout routines en route to 60 days',
                    description: 'Create Ideal Body in 60 Days until October 30, 2025',
                    horizon: 'months',
                    priority: 'medium',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['years']
                },
                {
                    id: '4',
                    title: 'Create Ideal Body in 60 Days until October 30, 2025',
                    horizon: 'years',
                    priority: 'high',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['life']
                },
                {
                    id: '5',
                    title: 'Buy a 2023 Toyota Corolla Cross by December 31, 2025',
                    horizon: 'years',
                    priority: 'medium',
                    completed: false,
                    createdAt: new Date().toISOString()
                },
                {
                    id: '6',
                    title: 'Maintain Ideal Body',
                    horizon: 'life',
                    priority: 'low',
                    completed: false,
                    createdAt: new Date().toISOString()
                }
            ];
            this.saveData();
        }
    }

    // Event Binding
    bindEvents() {
        // Task form
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTask();
        });

        // Click handlers
        document.addEventListener('click', (e) => {
            // Sidebar navigation
            if (e.target.closest('.sidebar-item[data-view]')) {
                const view = e.target.closest('.sidebar-item[data-view]').dataset.view;
                this.switchView(view);
            }

            // Task completion
            if (e.target.type === 'checkbox' && e.target.closest('.task-checkbox')) {
                this.toggleTaskCompletion(e.target);
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

    // View Management
    switchView(viewName) {
        if (!viewName || viewName === this.currentView) return;

        // Update sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`${viewName}-view`).classList.add('active');

        this.currentView = viewName;
        this.renderCurrentView();

        // Close mobile sidebar
        if (window.innerWidth <= 768) {
            this.toggleMobileMenu(false);
        }
    }

    renderCurrentView() {
        if (this.currentView === 'horizons') {
            this.renderHorizonsView();
        } else if (this.currentView === 'cascade') {
            this.renderCascadeView();
        }
    }

    renderHorizonsView() {
        const horizons = ['hours', 'days', 'weeks', 'months', 'years', 'life'];
        
        horizons.forEach(horizon => {
            const container = document.getElementById(`${horizon}-tasks`);
            const tasks = this.data.tasks.filter(task => 
                task.horizon === horizon && !task.completed
            );
            
            if (tasks.length === 0) {
                container.innerHTML = '<div class="empty-state">No tasks yet. Click + to add one.</div>';
            } else {
                container.innerHTML = tasks.map(task => this.renderTaskItem(task)).join('');
            }
        });
    }

    renderTaskItem(task) {
        return `
            <div class="task-item" data-id="${task.id}">
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-meta">${this.escapeHtml(task.description)}</div>` : ''}
                    ${task.meta ? `<div class="task-meta">${this.escapeHtml(task.meta)}</div>` : ''}
                    ${task.cascadesTo ? `<div class="task-meta"><small>Cascades to: ${task.cascadesTo.join(', ')}</small></div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="task-btn" onclick="app.editTask('${task.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-btn" onclick="app.deleteTask('${task.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderCascadeView() {
        const horizons = ['life', 'years', 'months', 'weeks', 'days', 'hours'];
        
        horizons.forEach(horizon => {
            const container = document.getElementById(`cascade-${horizon}`);
            const tasks = this.data.tasks.filter(task => 
                task.horizon === horizon && !task.completed
            );
            
            container.innerHTML = tasks.map(task => `
                <div class="cascade-task">
                    <strong>${this.escapeHtml(task.title)}</strong>
                    ${task.description ? `<div>${this.escapeHtml(task.description)}</div>` : ''}
                    ${task.cascadesTo ? `<div><small>→ ${task.cascadesTo.join(' → ')}</small></div>` : ''}
                </div>
            `).join('') || '<div class="empty-state">No tasks</div>';
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
            document.getElementById('task-horizon').value = taskData.horizon || 'hours';
            document.getElementById('task-priority').value = taskData.priority || 'medium';
        } else {
            document.getElementById('edit-task-id').value = '';
            document.getElementById('task-form').reset();
        }

        this.openModal('task-modal');
    }

    updateCascadeOptions() {
        const horizon = document.getElementById('task-horizon').value;
        const cascadeGroup = document.getElementById('cascade-group');
        
        if (horizon) {
            cascadeGroup.style.display = 'block';
            // Enable only higher-level horizons for cascading
            const horizons = ['hours', 'days', 'weeks', 'months', 'years', 'life'];
            const currentIndex = horizons.indexOf(horizon);
            
            document.querySelectorAll('input[name="cascade"]').forEach(checkbox => {
                const targetIndex = horizons.indexOf(checkbox.value);
                checkbox.disabled = targetIndex <= currentIndex;
                checkbox.checked = targetIndex > currentIndex && !checkbox.disabled;
            });
        } else {
            cascadeGroup.style.display = 'none';
        }
    }

    saveTask() {
        const form = document.getElementById('task-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const isEdit = !!document.getElementById('edit-task-id').value;
        const taskId = isEdit ? document.getElementById('edit-task-id').value : this.generateId();

        // Get cascade options
        const cascadeCheckboxes = document.querySelectorAll('input[name="cascade"]:checked');
        const cascadesTo = Array.from(cascadeCheckboxes).map(cb => cb.value);

        const task = {
            id: taskId,
            title: document.getElementById('task-title').value.trim(),
            description: document.getElementById('task-description').value.trim(),
            horizon: document.getElementById('task-horizon').value,
            priority: document.getElementById('task-priority').value,
            completed: false,
            createdAt: isEdit ? this.data.tasks.find(t => t.id === taskId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
            lastModified: new Date().toISOString(),
            cascadesTo: cascadesTo.length > 0 ? cascadesTo : undefined
        };

        if (isEdit) {
            const index = this.data.tasks.findIndex(t => t.id === taskId);
            if (index !== -1) {
                this.data.tasks[index] = task;
            }
        } else {
            this.data.tasks.push(task);
        }

        this.saveData();
        this.closeModal('task-modal');
        this.renderCurrentView();
        this.showNotification(`Task ${isEdit ? 'updated' : 'added'} successfully`, 'success');
    }

    editTask(taskId) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (task) this.openTaskModal(task);
    }

    deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
            this.saveData();
            this.renderCurrentView();
            this.showNotification('Task deleted', 'success');
        }
    }

    toggleTaskCompletion(checkbox) {
        const taskId = checkbox.id.replace('task-', '');
        const task = this.data.tasks.find(t => t.id === taskId);
        
        if (task) {
            task.completed = checkbox.checked;
            task.completedAt = checkbox.checked ? new Date().toISOString() : null;
            this.saveData();
            this.renderCurrentView();
        }
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
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateDateDisplay() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', options);
    }

    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // Simple console notification - you can enhance this with a proper UI
    }

    addToHorizon(horizon) {
        this.openTaskModal({ horizon: horizon });
    }

    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timestripe-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('Data exported successfully', 'success');
    }
}

// Initialize the app
window.app = new TimeStripeApp();
