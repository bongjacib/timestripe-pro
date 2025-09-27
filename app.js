// TimeStripe Pro - Cascading Horizons App v2.0.0
class TimeStripeApp {
    constructor() {
        this.currentView = 'horizons';
        this.currentTheme = this.loadTheme();
        this.data = this.loadData();
        this.currentTaskTimeData = {};
        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
        this.setupSampleData();
        this.updateDateDisplay();
        this.renderCurrentView();
        this.setupServiceWorker();
        
        // Show welcome message
        setTimeout(() => {
            this.showNotification('TimeStripe Pro with Cascading Horizons is ready!', 'success');
        }, 1000);
    }

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
        this.showNotification(`${this.currentTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'success');
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
                    cascadesTo: ['days'],
                    timeSettings: {
                        startTime: '07:00',
                        endTime: '08:00',
                        repeat: 'daily',
                        weekdays: ['monday', 'wednesday', 'friday'],
                        createdAt: new Date().toISOString()
                    }
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

        // Time modal event listeners
        this.setupTimeModalEvents();
    }

    setupTimeModalEvents() {
        // Repeat option click handlers
        document.querySelectorAll('.repeat-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.repeat-option').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Show/hide weekday options based on selection
                if (e.target.dataset.repeat === 'weekly') {
                    document.getElementById('weekday-options').style.display = 'block';
                } else {
                    document.getElementById('weekday-options').style.display = 'none';
                }
            });
        });

        // Weekday button click handlers
        document.querySelectorAll('.weekday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('active');
            });
        });

        // Time input changes
        document.getElementById('task-start-time').addEventListener('change', () => {
            this.updateUpcomingDates();
        });
        
        document.getElementById('task-end-time').addEventListener('change', () => {
            this.updateUpcomingDates();
        });
    }

    // View Management
    switchView(viewName) {
        if (!viewName || viewName === this.currentView) return;

        // Update sidebar
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        const targetItem = document.querySelector(`[data-view="${viewName}"]`);
        if (targetItem) {
            targetItem.classList.add('active');
        }

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }

        this.currentView = viewName;
        this.renderCurrentView();

        // Update view title
        const viewTitles = {
            'horizons': 'Cascading Horizons',
            'cascade': 'Cascade View',
            'pinned': 'Pinned Tasks'
        };
        document.getElementById('current-view-title').textContent = viewTitles[viewName] || viewName;

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
        const timeInfo = task.timeSettings ? 
            `<div class="task-time-info">
                <i class="fas fa-clock"></i> ${task.timeSettings.startTime} - ${task.timeSettings.endTime}
                ${task.timeSettings.repeat && task.timeSettings.repeat !== 'none' ? 
                    `<span class="repeat-badge">${task.timeSettings.repeat}</span>` : ''}
            </div>` : '';

        return `
            <div class="task-item" data-id="${task.id}">
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-meta">${this.escapeHtml(task.description)}</div>` : ''}
                    ${task.meta ? `<div class="task-meta">${this.escapeHtml(task.meta)}</div>` : ''}
                    ${timeInfo}
                    ${task.cascadesTo ? `<div class="task-meta"><small>Cascades to: ${task.cascadesTo.join(', ')}</small></div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="task-btn" onclick="app.editTask('${task.id}')" title="Edit Task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-btn" onclick="app.deleteTask('${task.id}')" title="Delete Task">
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
                    ${task.timeSettings ? `<div><small>🕒 ${task.timeSettings.startTime} - ${task.timeSettings.endTime}</small></div>` : ''}
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

        // Store current task data for time modal
        this.currentTaskTimeData = taskData;

        if (isEdit) {
            document.getElementById('edit-task-id').value = taskData.id;
            document.getElementById('task-title').value = taskData.title || '';
            document.getElementById('task-description').value = taskData.description || '';
            document.getElementById('task-horizon').value = taskData.horizon || 'hours';
            document.getElementById('task-priority').value = taskData.priority || 'medium';
            
            // Update time summary
            this.updateTimeSummary();
        } else {
            document.getElementById('edit-task-id').value = '';
            document.getElementById('task-form').reset();
            document.getElementById('time-summary').textContent = 'No time set';
        }

        this.updateCascadeOptions();
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
                if (targetIndex > currentIndex && !checkbox.disabled) {
                    checkbox.checked = true;
                }
            });
        } else {
            cascadeGroup.style.display = 'none';
        }
    }

    // Time Management Methods
    openTimeModal() {
        // Set default date to tomorrow
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        document.getElementById('selected-date-display').textContent = 
            this.formatDateDisplay(tomorrow);
        
        // Set existing time data if editing
        if (this.currentTaskTimeData.timeSettings) {
            this.populateTimeModal(this.currentTaskTimeData.timeSettings);
        } else {
            this.setDefaultTimeSettings();
        }
        
        this.openModal('time-modal');
    }

    populateTimeModal(timeSettings) {
        if (timeSettings.startTime) {
            document.getElementById('task-start-time').value = timeSettings.startTime;
        }
        if (timeSettings.endTime) {
            document.getElementById('task-end-time').value = timeSettings.endTime;
        }
        
        // Set repeat options
        if (timeSettings.repeat) {
            this.setActiveRepeatOption(timeSettings.repeat);
        }
        
        // Set weekdays if weekly repeat
        if (timeSettings.weekdays) {
            this.setActiveWeekdays(timeSettings.weekdays);
        }
        
        this.updateUpcomingDates();
    }

    setDefaultTimeSettings() {
        const now = new Date();
        const startTime = this.formatTime(now.getHours(), (Math.floor(now.getMinutes() / 30) * 30 + 30) % 60);
        const endTime = this.formatTime((now.getHours() + 1) % 24, now.getMinutes());
        
        document.getElementById('task-start-time').value = startTime;
        document.getElementById('task-end-time').value = endTime;
        
        // Set default to "Do not repeat"
        this.setActiveRepeatOption('none');
    }

    formatTime(hours, minutes) {
        const h = hours.toString().padStart(2, '0');
        const m = minutes.toString().padStart(2, '0');
        return `${h}:${m}`;
    }

    formatDateDisplay(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    setActiveRepeatOption(repeatType) {
        document.querySelectorAll('.repeat-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.repeat === repeatType) {
                btn.classList.add('active');
            }
        });
        
        // Show/hide weekday options
        if (repeatType === 'weekly') {
            document.getElementById('weekday-options').style.display = 'block';
        } else {
            document.getElementById('weekday-options').style.display = 'none';
        }
    }

    setActiveWeekdays(weekdays) {
        document.querySelectorAll('.weekday-btn').forEach(btn => {
            btn.classList.remove('active');
            if (weekdays.includes(btn.dataset.day)) {
                btn.classList.add('active');
            }
        });
    }

    toggleRepeatOptions() {
        const repeatSection = document.getElementById('repeat-section');
        repeatSection.style.display = repeatSection.style.display === 'none' ? 'block' : 'block';
    }

    showRescheduleOptions() {
        this.showNotification('Reschedule feature coming soon!', 'info');
    }

    removeDateTime() {
        if (confirm('Remove all time settings for this task?')) {
            this.currentTaskTimeData.timeSettings = null;
            document.getElementById('time-summary').textContent = 'No time set';
            this.closeModal('time-modal');
            this.showNotification('Time settings removed', 'success');
        }
    }

    saveTimeSettings() {
        const timeSettings = {
            startTime: document.getElementById('task-start-time').value,
            endTime: document.getElementById('task-end-time').value,
            repeat: this.getSelectedRepeatOption(),
            weekdays: this.getSelectedWeekdays(),
            createdAt: new Date().toISOString()
        };

        this.currentTaskTimeData.timeSettings = timeSettings;
        this.updateTimeSummary();
        this.closeModal('time-modal');
        
        this.showNotification('Time settings saved!', 'success');
    }

    getSelectedRepeatOption() {
        const activeBtn = document.querySelector('.repeat-option.active');
        return activeBtn ? activeBtn.dataset.repeat : 'none';
    }

    getSelectedWeekdays() {
        const activeBtns = document.querySelectorAll('.weekday-btn.active');
        return Array.from(activeBtns).map(btn => btn.dataset.day);
    }

    updateTimeSummary() {
        const summary = document.getElementById('time-summary');
        const settings = this.currentTaskTimeData.timeSettings;
        
        if (!settings) {
            summary.textContent = 'No time set';
            return;
        }

        let summaryText = `${settings.startTime} - ${settings.endTime}`;
        if (settings.repeat && settings.repeat !== 'none') {
            summaryText += ` • ${settings.repeat}`;
            if (settings.repeat === 'weekly' && settings.weekdays.length > 0) {
                summaryText += ` (${settings.weekdays.map(day => day.substring(0, 3)).join(', ')})`;
            }
        }
        
        summary.textContent = summaryText;
    }

    updateUpcomingDates() {
        // Simple implementation - in a real app, this would calculate actual dates
        const upcomingList = document.querySelector('.upcoming-list');
        const now = new Date();
        const dates = [];
        
        for (let i = 1; i <= 3; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i * 2);
            dates.push(date);
        }
        
        upcomingList.innerHTML = dates.map(date => `
            <div class="upcoming-item">
                <strong>${this.formatDateDisplay(date)}</strong>
            </div>
        `).join('');
    }

    saveTask() {
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
            lastModified: new Date().toISOString(),
            cascadesTo: this.getCascadeSelections(),
            timeSettings: this.currentTaskTimeData?.timeSettings || null
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

    getCascadeSelections() {
        const cascadeCheckboxes = document.querySelectorAll('input[name="cascade"]:checked');
        return Array.from(cascadeCheckboxes).map(cb => cb.value);
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
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: var(--space-md);
                    box-shadow: 0 4px 6px var(--shadow-color);
                    z-index: 1060;
                    max-width: 300px;
                    animation: slideIn 0.3s ease;
                }
                .notification-success { border-left: 4px solid var(--accent-success); }
                .notification-error { border-left: 4px solid var(--accent-danger); }
                .notification-info { border-left: 4px solid var(--accent-primary); }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: var(--space-sm);
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new TimeStripeApp();
});
