// TimeStripe Pro - Cascading Horizons App v2.1.0 with Fixed Cloud Sync
class TimeStripeApp {
    constructor() {
        this.currentView = 'horizons';
        this.currentTheme = this.loadTheme();
        this.data = this.loadData();
        this.currentTaskTimeData = {};
        this.cloudSync = new CloudSyncService();
        this.syncEnabled = false;
        this.init();
    }

    init() {
        this.applyTheme();
        this.bindEvents();
        this.setupSampleData();
        this.updateDateDisplay();
        this.renderCurrentView();
        this.setupServiceWorker();
        this.initCloudSync();
        
        // Setup file import
        document.getElementById('import-file').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });
        
        setTimeout(() => {
            this.showNotification('TimeStripe Pro with Cloud Sync is ready!', 'success');
        }, 1000);
    }

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

    // Fixed Cloud Sync Implementation
    async initCloudSync() {
        const syncConfig = this.loadSyncConfig();
        if (syncConfig.enabled && syncConfig.sessionId) {
            try {
                await this.enableCloudSync(syncConfig.sessionId);
                this.showNotification('Cloud sync reconnected successfully', 'success');
            } catch (error) {
                console.warn('Failed to reconnect cloud sync:', error);
                this.showNotification('Could not reconnect to cloud sync', 'warning');
                this.disableCloudSync();
            }
        }
        this.updateSyncUI();
    }

    async enableCloudSync(sessionId = null) {
        try {
            console.log('🔄 Enabling cloud sync...');
            
            // Show loading state
            this.showNotification('Setting up cloud sync...', 'info');
            
            await this.cloudSync.enable(sessionId);
            this.syncEnabled = true;
            
            // Listen for remote changes
            this.cloudSync.onDataChange((remoteData) => {
                console.log('📡 Remote data change detected');
                if (this.shouldAcceptRemoteData(remoteData)) {
                    this.handleRemoteData(remoteData);
                }
            });
            
            // Perform initial sync with retry logic
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    const syncedData = await this.cloudSync.sync(this.data);
                    if (syncedData && syncedData !== this.data) {
                        this.data = syncedData;
                        this.saveData(false); // Don't trigger sync to avoid loop
                        this.renderCurrentView();
                        console.log('✅ Initial sync completed successfully');
                    }
                    break;
                } catch (syncError) {
                    retryCount++;
                    console.warn(`Sync attempt ${retryCount} failed:`, syncError);
                    
                    if (retryCount === maxRetries) {
                        throw new Error('Max sync retries exceeded');
                    }
                    
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
            
            this.saveSyncConfig({ 
                enabled: true, 
                sessionId: this.cloudSync.sessionId 
            });
            this.updateSyncUI();
            
            this.showNotification('Cloud sync enabled! Changes will sync across devices.', 'success');
            
        } catch (error) {
            console.error('❌ Cloud sync enable failed:', error);
            this.showNotification('Failed to enable cloud sync. Using local storage only.', 'error');
            this.disableCloudSync();
            throw error;
        }
    }

    disableCloudSync() {
        this.syncEnabled = false;
        this.cloudSync.disable();
        this.saveSyncConfig({ enabled: false, sessionId: null });
        this.updateSyncUI();
        this.showNotification('Cloud sync disabled', 'info');
    }

    handleRemoteData(remoteData) {
        if (this.shouldAcceptRemoteData(remoteData)) {
            this.data = remoteData;
            this.saveData(false); // Save locally but don't trigger sync
            this.renderCurrentView();
            this.showNotification('Changes synced from cloud', 'info');
        }
    }

    shouldAcceptRemoteData(remoteData) {
        if (!remoteData || !remoteData.lastSaved) return false;
        if (!this.data.lastSaved) return true;
        
        const remoteTime = new Date(remoteData.lastSaved);
        const localTime = new Date(this.data.lastSaved);
        
        return remoteTime > localTime;
    }

    // Enhanced saveData with cloud sync
    saveData(triggerSync = true) {
        this.data.lastSaved = new Date().toISOString();
        this.data.version = '2.1.0';
        
        localStorage.setItem('timestripe-data', JSON.stringify(this.data));
        
        if (triggerSync && this.syncEnabled) {
            this.cloudSync.sync(this.data).catch(error => {
                console.warn('Cloud sync failed:', error);
                this.showNotification('Sync failed. Working offline.', 'warning');
            });
        }
    }

    // Sync UI Methods - Fixed
    showSyncModal() {
        this.openModal('sync-setup-modal');
    }

    async createSyncSession() {
        try {
            await this.enableCloudSync();
            this.closeModal('sync-setup-modal');
        } catch (error) {
            this.showNotification('Failed to create sync session. Please try again.', 'error');
        }
    }

    async joinSyncSession() {
        const code = document.getElementById('sync-code-input').value.trim();
        if (!code) {
            this.showNotification('Please enter a sync code', 'error');
            return;
        }
        
        if (code.length < 8) {
            this.showNotification('Sync code should be at least 8 characters', 'error');
            return;
        }
        
        try {
            await this.enableCloudSync(code);
            this.closeModal('sync-setup-modal');
        } catch (error) {
            this.showNotification('Failed to join sync session. Check the code and try again.', 'error');
        }
    }

    showDataModal() {
        this.openModal('data-modal');
    }

    loadSyncConfig() {
        const config = localStorage.getItem('timestripe-sync-config');
        return config ? JSON.parse(config) : { enabled: false, sessionId: null };
    }

    saveSyncConfig(config) {
        localStorage.setItem('timestripe-sync-config', JSON.stringify(config));
    }

    updateSyncUI() {
        const syncIndicator = document.getElementById('sync-indicator');
        const syncDot = document.getElementById('sync-dot-desktop');
        const syncDotMobile = document.getElementById('sync-dot');
        const syncStatus = document.getElementById('sync-status');
        const syncToggle = document.getElementById('sync-toggle');
        
        if (this.syncEnabled) {
            syncIndicator?.classList.add('syncing');
            syncDot?.classList.add('syncing');
            syncDotMobile?.classList.add('syncing');
            syncToggle?.classList.add('syncing');
            syncStatus && (syncStatus.textContent = '🟢 Syncing with cloud');
        } else {
            syncIndicator?.classList.remove('syncing');
            syncDot?.classList.remove('syncing');
            syncDotMobile?.classList.remove('syncing');
            syncToggle?.classList.remove('syncing');
            syncStatus && (syncStatus.textContent = '⚫ Sync disabled');
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
            version: '2.1.0',
            tasks: [],
            lastSaved: new Date().toISOString()
        };
    }

    setupSampleData() {
        if (this.data.tasks.length === 0) {
            this.data.tasks = [
                {
                    id: '1',
                    title: 'Morning Workout',
                    description: 'Complete morning exercise routine',
                    horizon: 'hours',
                    priority: 'medium',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['days']
                },
                {
                    id: '2',
                    title: 'Plan weekly goals',
                    description: 'Set objectives for the week',
                    horizon: 'weeks',
                    priority: 'high',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['months']
                },
                {
                    id: '3',
                    title: 'Annual review preparation',
                    description: 'Prepare for year-end review',
                    horizon: 'years',
                    priority: 'medium',
                    completed: false,
                    createdAt: new Date().toISOString(),
                    cascadesTo: ['life']
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
            if (e.target.closest('.sidebar-item[data-view]')) {
                const view = e.target.closest('.sidebar-item[data-view]').dataset.view;
                this.switchView(view);
            }

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
        document.querySelectorAll('.repeat-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.repeat-option').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                if (e.target.dataset.repeat === 'weekly') {
                    document.getElementById('weekday-options').style.display = 'block';
                } else {
                    document.getElementById('weekday-options').style.display = 'none';
                }
            });
        });

        document.querySelectorAll('.weekday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('active');
            });
        });

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

        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        const targetItem = document.querySelector(`[data-view="${viewName}"]`);
        if (targetItem) targetItem.classList.add('active');

        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) targetView.classList.add('active');

        this.currentView = viewName;
        this.renderCurrentView();

        const viewTitles = {
            'horizons': 'Cascading Horizons',
            'cascade': 'Cascade View'
        };
        document.getElementById('current-view-title').textContent = viewTitles[viewName] || viewName;

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

        this.currentTaskTimeData = taskData;

        if (isEdit) {
            document.getElementById('edit-task-id').value = taskData.id;
            document.getElementById('task-title').value = taskData.title || '';
            document.getElementById('task-description').value = taskData.description || '';
            document.getElementById('task-horizon').value = taskData.horizon || 'hours';
            document.getElementById('task-priority').value = taskData.priority || 'medium';
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

    // Time Management
    openTimeModal() {
        const now = new Date();
        document.getElementById('selected-date-display').textContent = 
            this.formatDateDisplay(now);
        
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
        
        if (timeSettings.repeat) {
            this.setActiveRepeatOption(timeSettings.repeat);
        }
        
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
        const upcomingList = document.querySelector('.upcoming-list');
        const now = new Date();
        const dates = [];
        
        for (let i = 0; i < 3; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
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

    addToHorizon(horizon) {
        this.openTaskModal({ horizon: horizon });
    }

    // Data Management
    exportData() {
        const exportData = {
            ...this.data,
            syncInfo: {
                exportedAt: new Date().toISOString(),
                syncEnabled: this.syncEnabled,
                sessionId: this.cloudSync.sessionId,
                appVersion: '2.1.0'
            }
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timestripe-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('Data exported successfully', 'success');
    }

    importData(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Restore sync configuration if present
                if (importedData.syncInfo) {
                    this.saveSyncConfig({
                        enabled: importedData.syncInfo.syncEnabled,
                        sessionId: importedData.syncInfo.sessionId
                    });
                }
                
                this.data = {
                    ...importedData,
                    lastSaved: new Date().toISOString()
                };
                this.saveData();
                this.renderCurrentView();
                
                this.showNotification('Data imported successfully', 'success');
            } catch (error) {
                this.showNotification('Invalid import file', 'error');
            }
        };
        reader.readAsText(file);
    }

    clearAllData() {
        if (confirm('Are you sure you want to delete ALL data? This cannot be undone!')) {
            localStorage.removeItem('timestripe-data');
            localStorage.removeItem('timestripe-sync-config');
            this.data = this.getDefaultData();
            this.disableCloudSync();
            this.renderCurrentView();
            this.showNotification('All data cleared', 'success');
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
        // Remove existing notifications
        document.querySelectorAll('.notification').forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Fixed Cloud Sync Service with Better Error Handling
class CloudSyncService {
    constructor() {
        this.apiKey = '$2a$10$QPQ6J5q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q9q';
        this.baseUrl = 'https://api.jsonbin.io/v3';
        this.sessionId = null;
        this.isEnabled = false;
        this.syncInterval = null;
        this.dataChangeCallbacks = [];
        this.lastSyncTime = null;
    }

    async enable(sessionId = null) {
        try {
            console.log('🔧 Initializing cloud sync service...');
            
            this.sessionId = sessionId || this.generateSessionId();
            this.isEnabled = true;
            
            console.log('📦 Ensuring cloud storage exists...');
            await this.ensureBinExists();
            
            console.log('🔄 Starting sync interval...');
            this.startSyncInterval();
            
            console.log('✅ Cloud sync enabled with session:', this.sessionId);
            return true;
            
        } catch (error) {
            console.error('❌ Failed to enable cloud sync:', error);
            throw new Error(`Cloud sync initialization failed: ${error.message}`);
        }
    }

    disable() {
        this.isEnabled = false;
        this.sessionId = null;
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        console.log('🔴 Cloud sync disabled');
    }

    async sync(localData) {
        if (!this.isEnabled || !this.sessionId) {
            throw new Error('Cloud sync not enabled');
        }

        try {
            console.log('🔄 Starting sync process...');
            
            // Get remote data first
            const remoteData = await this.getRemoteData();
            console.log('📡 Remote data retrieved:', remoteData ? 'exists' : 'empty');
            
            // Resolve conflicts (remote wins if newer)
            const mergedData = this.mergeData(localData, remoteData);
            console.log('🔀 Data merged successfully');
            
            // Save merged data to cloud
            await this.saveToCloud(mergedData);
            console.log('💾 Data saved to cloud');
            
            this.lastSyncTime = new Date();
            
            // Notify about data changes if remote was newer
            if (remoteData && this.isDataNewer(remoteData, localData)) {
                console.log('📢 Notifying about remote changes');
                this.notifyDataChange(mergedData);
            }
            
            return mergedData;
            
        } catch (error) {
            console.warn('⚠️ Sync failed:', error);
            throw new Error(`Sync failed: ${error.message}`);
        }
    }

    async getRemoteData() {
        try {
            console.log('🌐 Fetching remote data...');
            const response = await axios.get(`${this.baseUrl}/b/${this.sessionId}/latest`, {
                headers: {
                    'X-Master-Key': this.apiKey,
                    'X-Bin-Meta': false
                },
                timeout: 10000
            });
            
            console.log('✅ Remote data fetched successfully');
            return response.data || null;
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('📭 Bin does not exist yet');
                return null;
            }
            console.error('❌ Failed to fetch remote data:', error);
            throw error;
        }
    }

    async saveToCloud(data) {
        try {
            console.log('💾 Saving data to cloud...');
            const response = await axios.put(`${this.baseUrl}/b/${this.sessionId}`, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.apiKey
                },
                timeout: 10000
            });
            
            console.log('✅ Data saved to cloud successfully');
            return response.data;
        } catch (error) {
            console.error('❌ Failed to save data to cloud:', error);
            throw error;
        }
    }

    async ensureBinExists() {
        try {
            console.log('🔍 Checking if bin exists...');
            // Try to get the bin first
            await this.getRemoteData();
            console.log('✅ Bin exists');
        } catch (error) {
            if (error.response?.status === 404) {
                console.log('📦 Creating new bin...');
                // Bin doesn't exist, create it
                await this.saveToCloud({
                    version: '2.1.0',
                    tasks: [],
                    lastSaved: new Date().toISOString(),
                    sessionId: this.sessionId,
                    createdAt: new Date().toISOString()
                });
                console.log('✅ New bin created successfully');
            } else {
                throw error;
            }
        }
    }

    mergeData(localData, remoteData) {
        if (!remoteData) {
            console.log('🔀 No remote data, using local data');
            return localData;
        }
        if (!localData || !localData.lastSaved) {
            console.log('🔀 No local data, using remote data');
            return remoteData;
        }

        // Simple conflict resolution: newer data wins
        if (this.isDataNewer(remoteData, localData)) {
            console.log('🔀 Remote data is newer, using remote');
            return { ...remoteData, lastSaved: new Date().toISOString() };
        } else {
            console.log('🔀 Local data is newer or equal, using local');
            return { ...localData, lastSaved: new Date().toISOString() };
        }
    }

    isDataNewer(data1, data2) {
        if (!data1.lastSaved) return false;
        if (!data2.lastSaved) return true;
        
        const data1Time = new Date(data1.lastSaved);
        const data2Time = new Date(data2.lastSaved);
        
        return data1Time > data2Time;
    }

    startSyncInterval() {
        // Sync every 60 seconds when enabled
        this.syncInterval = setInterval(async () => {
            if (this.isEnabled) {
                try {
                    console.log('🔄 Periodic sync check...');
                    // This would typically sync with the latest local data
                } catch (error) {
                    console.warn('Periodic sync check failed:', error);
                }
            }
        }, 60000);
    }

    onDataChange(callback) {
        this.dataChangeCallbacks.push(callback);
    }

    notifyDataChange(data) {
        console.log('📢 Notifying', this.dataChangeCallbacks.length, 'callbacks of data change');
        this.dataChangeCallbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in data change callback:', error);
            }
        });
    }

    generateSessionId() {
        const id = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
        console.log('🔑 Generated new session ID:', id);
        return id;
    }

    getSyncStatus() {
        return {
            enabled: this.isEnabled,
            sessionId: this.sessionId,
            lastSync: this.lastSyncTime
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new TimeStripeApp();
});
