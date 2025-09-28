// NOTE: This file keeps all existing features.
// Changes related to the Time modal:
//   - Added date support (task-date input) and save it in timeSettings.date
//   - Implemented Repeat preview + next occurrences
//   - Hooked repeat buttons + weekday buttons to recompute preview
//   - Reschedule button now opens the native date picker
// CloudSyncService (GetPantry + JSONBin and kvdb migration shim) kept from previous step.

//////////////////////// HTTP helper (same as before) ////////////////////////
const http = {
  async get(url, { headers = {}, timeout = 12000, responseType = 'json' } = {}) {
    if (typeof axios !== 'undefined') {
      const res = await axios.get(url, { headers, timeout, responseType: responseType === 'text' ? 'text' : 'json' });
      return { status: res.status, data: res.data, headers: res.headers };
    }
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout);
    const res = await fetch(url, { headers, signal: ctl.signal });
    clearTimeout(id);
    const data = responseType === 'text' ? await res.text() : await res.json().catch(() => ({}));
    return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
  },
  async post(url, body, { headers = {}, timeout = 12000 } = {}) {
    if (typeof axios !== 'undefined') {
      const res = await axios.post(url, body, { headers: { 'Content-Type': 'application/json', ...headers }, timeout });
      return { status: res.status, data: res.data, headers: res.headers };
    }
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(id);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
  },
  async put(url, body, { headers = {}, timeout = 12000 } = {}) {
    if (typeof axios !== 'undefined') {
      const res = await axios.put(url, body, { headers: { 'Content-Type': 'application/json', ...headers }, timeout });
      return { status: res.status, data: res.data, headers: res.headers };
    }
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout);
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(id);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
  }
};

//////////////////////// CloudSyncService (unchanged from last step) ////////////////////////
class CloudSyncService {
  constructor() {
    this.pantry = { base: 'https://getpantry.cloud/apiv1', pantryId: null, basket: 'timestripe' };
    this.jsonbin = { base: 'https://api.jsonbin.io/v3', binId: null };
    this.backend = null;
    this.isEnabled = false;
    this.syncInterval = null;
    this.dataChangeCallbacks = [];
    this.lastSyncTime = null;
    this._lastRemoteStamp = null;
  }

  async enable(sessionCode = null) {
    if (!sessionCode) {
      const saved = this._loadSession();
      if (saved) sessionCode = saved;
    }
    if (sessionCode && this._isLegacyKvdbCode(sessionCode)) {
      await this._migrateFromKvdb(sessionCode);
      sessionCode = this._loadSession();
    }
    if (sessionCode) {
      await this._parseAndSetSession(sessionCode);
    } else {
      await this._createPantrySession();
    }

    try {
      const current = await this._getRemote();
      if (!current) await this._saveRemote(this._initDoc());
    } catch (e) {
      if (this.backend === 'pantry') {
        try {
          await this._createJsonBinSession();
          await this._saveRemote(this._initDoc());
        } catch {}
      }
    }

    this.isEnabled = true;
    this._startPolling();
    return true;
  }

  disable() {
    this.isEnabled = false;
    this._lastRemoteStamp = null;
    if (this.syncInterval) clearInterval(this.syncInterval);
  }

  async sync(localData) {
    if (!this.isEnabled) return localData;
    try {
      const remote = await this._getRemote();
      const merged = this._merge(localData, remote);
      await this._saveRemote(merged);
      this.lastSyncTime = new Date();
      this._lastRemoteStamp = merged?.lastSaved || null;
      return merged;
    } catch (e) {
      if (this.backend === 'pantry') {
        try {
          await this._createJsonBinSession();
          const remote = await this._getRemote();
          const merged = this._merge(localData, remote);
          await this._saveRemote(merged);
          this.lastSyncTime = new Date();
          this._lastRemoteStamp = merged?.lastSaved || null;
          return merged;
        } catch {}
      }
      return localData;
    }
  }

  onDataChange(cb) { if (typeof cb === 'function') this.dataChangeCallbacks.push(cb); }
  get sessionId() {
    if (this.backend === 'pantry' && this.pantry.pantryId) return `pantry:${this.pantry.pantryId}`;
    if (this.backend === 'jsonbin' && this.jsonbin.binId) return `jsonbin:${this.jsonbin.binId}`;
    return null;
  }
  getSyncStatus() { return { enabled: this.isEnabled, backend: this.backend, sessionId: this.sessionId, lastSync: this.lastSyncTime }; }

  async _parseAndSetSession(code) {
    if (code.startsWith('pantry:')) { this.backend = 'pantry'; this.pantry.pantryId = code.split(':')[1]; this._saveSession(); return; }
    if (code.startsWith('jsonbin:')) { this.backend = 'jsonbin'; this.jsonbin.binId = code.split(':')[1]; this._saveSession(); return; }
    this.backend = 'pantry'; this.pantry.pantryId = code; this._saveSession();
  }
  async _createPantrySession() {
    const res = await http.post(`${this.pantry.base}/pantry`, { description: 'TimeStripe Pro Sync' });
    const pid = res?.data?.pantryId || res?.data?.id || res?.pantryId || res?.id;
    if (!pid) throw new Error('GetPantry: failed to create pantry');
    this.pantry.pantryId = pid; this.backend = 'pantry'; this._saveSession();
    await http.put(`${this.pantry.base}/pantry/${this.pantry.pantryId}/basket/${this.pantry.basket}`, this._initDoc());
  }
  async _createJsonBinSession() {
    const init = this._initDoc();
    const res = await http.post(`${this.jsonbin.base}/b`, { record: init });
    const id = res?.data?.metadata?.id || res?.data?.id || res?.metadata?.id || res?.id;
    if (!id) throw new Error('JSONBin: failed to create bin');
    this.jsonbin.binId = id; this.backend = 'jsonbin'; this._saveSession();
  }
  async _getRemote() {
    if (this.backend === 'pantry') {
      const res = await http.get(`${this.pantry.base}/pantry/${this.pantry.pantryId}/basket/${this.pantry.basket}`);
      if (res.status === 404) return null;
      return (res && typeof res.data === 'object') ? res.data : null;
    }
    if (this.backend === 'jsonbin') {
      const res = await http.get(`${this.jsonbin.base}/b/${this.jsonbin.binId}/latest`, { headers: { 'X-Bin-Meta': 'false' } });
      if (res.status === 404) return null;
      return res?.data?.record ?? res?.record ?? null;
    }
    return null;
  }
  async _saveRemote(data) {
    if (this.backend === 'pantry') {
      await http.put(`${this.pantry.base}/pantry/${this.pantry.pantryId}/basket/${this.pantry.basket}`, data);
      return;
    }
    if (this.backend === 'jsonbin') {
      await http.put(`${this.jsonbin.base}/b/${this.jsonbin.binId}`, { record: data });
      return;
    }
    throw new Error('No backend selected');
  }
  _merge(localData, remoteData) {
    if (!remoteData) return localData;
    if (!localData?.lastSaved) return remoteData;
    return new Date(remoteData.lastSaved) > new Date(localData.lastSaved) ? remoteData : localData;
  }
  _startPolling() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(async () => {
      if (!this.isEnabled) return;
      try {
        const remote = await this._getRemote();
        const stamp = remote?.lastSaved || null;
        if (stamp && stamp !== this._lastRemoteStamp) {
          this._lastRemoteStamp = stamp;
          this.dataChangeCallbacks.forEach(cb => cb(remote));
        }
      } catch {}
    }, 12000);
  }
  _initDoc() { return { version: '2.1.0', tasks: [], lastSaved: new Date().toISOString(), createdAt: new Date().toISOString() }; }
  _saveSession() { const code = this.sessionId; if (code) localStorage.setItem('timestripe-sync-session', code); }
  _loadSession() {
    const direct = localStorage.getItem('timestripe-sync-session'); if (direct) return direct;
    const cfg = localStorage.getItem('timestripe-sync-config'); if (cfg) { try { return JSON.parse(cfg)?.sessionId || null; } catch {} }
    return null;
  }
  _isLegacyKvdbCode(code) { if (!code) return false; if (code.startsWith('kvdb:')) return true; return !code.includes(':') && /^[a-z0-9]{10,}$/i.test(code); }
  async _migrateFromKvdb(code) {
    try {
      const bucketId = code.startsWith('kvdb:') ? code.split(':')[1] : code;
      let legacyData = null;
      try {
        const res = await http.get(`https://kvdb.io/${bucketId}/timestripe`, { responseType: 'text' });
        if (res && res.status >= 200 && res.status < 300) { try { legacyData = JSON.parse(res.data); } catch {} }
      } catch {}
      await this._createPantrySession();
      await this._saveRemote(legacyData && typeof legacyData === 'object' ? legacyData : this._initDoc());
      const cfg = localStorage.getItem('timestripe-sync-config');
      if (cfg) { try { const p = JSON.parse(cfg); p.sessionId = this.sessionId; p.enabled = true; localStorage.setItem('timestripe-sync-config', JSON.stringify(p)); } catch {} }
    } catch {}
  }
}

//////////////////////// App ////////////////////////
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

    document.getElementById('import-file').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    setTimeout(() => this.showNotification('TimeStripe Pro is ready!', 'success'), 1000);
  }

  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(() => console.log('✅ Service Worker registered successfully'))
          .catch(err => console.log('❌ Service Worker registration failed: ', err));
      });
    }
  }

  // ---- Cloud Sync (same behavior) ----
  async initCloudSync() {
    const syncConfig = this.loadSyncConfig();
    this.updateSyncUI();

    try {
      if (syncConfig.enabled && syncConfig.sessionId) {
        this.showNotification('Reconnecting to cloud sync...', 'info');
        await this.enableCloudSync(syncConfig.sessionId);
      } else {
        await this.enableCloudSync(); // auto-create session so indicator is on
      }
    } catch (error) {
      console.warn('Failed to initialize cloud sync:', error);
      this.disableCloudSync();
    }
  }

  async enableCloudSync(sessionId = null) {
    try {
      this.syncEnabled = true;
      this.updateSyncUI();
      this.showNotification('Setting up cloud sync...', 'info');

      await this.cloudSync.enable(sessionId);

      this.cloudSync.onDataChange((remoteData) => {
        if (this.shouldAcceptRemoteData(remoteData)) this.handleRemoteData(remoteData);
      });

      const merged = await this.cloudSync.sync(this.data);
      if (merged) { this.data = merged; this.saveData(false); this.renderCurrentView(); }

      this.saveSyncConfig({ enabled: true, sessionId: this.cloudSync.sessionId });
      this.updateSyncUI();
      this.showNotification('Cloud sync enabled!', 'success');
    } catch (error) {
      console.error('Cloud sync enable failed:', error);
      this.showNotification('Cloud sync unavailable. Using local storage.', 'warning');
      this.disableCloudSync();
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
      this.saveData(false);
      this.renderCurrentView();
      this.showNotification('Changes synced from cloud', 'info');
    }
  }

  shouldAcceptRemoteData(remoteData) {
    if (!remoteData || !remoteData.lastSaved) return false;
    if (!this.data.lastSaved) return true;
    return new Date(remoteData.lastSaved) > new Date(this.data.lastSaved);
  }

  saveData(triggerSync = true) {
    this.data.lastSaved = new Date().toISOString();
    this.data.version = '2.1.0';
    localStorage.setItem('timestripe-data', JSON.stringify(this.data));
    if (triggerSync && this.syncEnabled) {
      this.cloudSync.sync(this.data).catch(err => console.warn('Cloud sync failed:', err));
    }
  }

  showSyncModal() { this.openModal('sync-setup-modal'); }
  async createSyncSession() { try { await this.enableCloudSync(); this.closeModal('sync-setup-modal'); } catch { this.showNotification('Failed to create sync session', 'error'); } }
  async joinSyncSession() {
    const code = document.getElementById('sync-code-input').value.trim();
    if (!code) return this.showNotification('Please enter a sync code', 'error');
    try { await this.enableCloudSync(code); this.closeModal('sync-setup-modal'); } catch { this.showNotification('Failed to join sync session', 'error'); }
  }

  showDataModal() { this.openModal('data-modal'); }
  loadSyncConfig() { const c = localStorage.getItem('timestripe-sync-config'); return c ? JSON.parse(c) : { enabled: false, sessionId: null }; }
  saveSyncConfig(config) { localStorage.setItem('timestripe-sync-config', JSON.stringify(config)); }
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
      if (syncStatus) syncStatus.textContent = '🟢 Syncing with cloud';
    } else {
      syncIndicator?.classList.remove('syncing');
      syncDot?.classList.remove('syncing');
      syncDotMobile?.classList.remove('syncing');
      syncToggle?.classList.remove('syncing');
      if (syncStatus) syncStatus.textContent = '⚫ Sync disabled';
    }
  }

  // ---- Theme (unchanged) ----
  loadTheme() { const saved = localStorage.getItem('timestripe-theme'); return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
  applyTheme() { document.body.setAttribute('data-theme', this.currentTheme); }
  toggleTheme() { this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light'; this.applyTheme(); localStorage.setItem('timestripe-theme', this.currentTheme); this.showNotification(`${this.currentTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'success'); }

  // ---- Data model (unchanged) ----
  loadData() { const saved = localStorage.getItem('timestripe-data'); return saved ? JSON.parse(saved) : this.getDefaultData(); }
  getDefaultData() { return { version: '2.1.0', tasks: [], lastSaved: new Date().toISOString() }; }
  setupSampleData() {
    if (this.data.tasks.length === 0) {
      this.data.tasks = [
        { id: '1', title: 'Morning Workout', description: 'Complete morning exercise routine', horizon: 'hours', priority: 'medium', completed: false, createdAt: new Date().toISOString(), cascadesTo: ['days'] },
        { id: '2', title: 'Plan weekly goals', description: 'Set objectives for the week', horizon: 'weeks', priority: 'high', completed: false, createdAt: new Date().toISOString(), cascadesTo: ['months'] },
        { id: '3', title: 'Annual review preparation', description: 'Prepare for year-end review', horizon: 'years', priority: 'medium', completed: false, createdAt: new Date().toISOString(), cascadesTo: ['life'] }
      ];
      this.saveData();
    }
  }

  // ---- Events / UI ----
  bindEvents() {
    document.getElementById('task-form').addEventListener('submit', (e) => { e.preventDefault(); this.saveTask(); });

    document.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-item[data-view]')) {
        const view = e.target.closest('.sidebar-item[data-view]').dataset.view;
        this.switchView(view);
      }
      if (e.target.classList.contains('modal')) this.closeModal(e.target.id);
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); this.openTaskModal(); }
      if (e.key === 'Escape') this.closeAllModals();
    });

    this.setupTimeModalEvents();
  }

  setupTimeModalEvents() {
    // repeat buttons
    document.querySelectorAll('.repeat-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.repeat-option').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const type = e.target.dataset.repeat;
        document.getElementById('weekday-options').style.display = type === 'weekly' ? 'block' : 'none';
        this.updateUpcomingDates(); // recalc preview
      });
    });

    // weekday toggles
    document.querySelectorAll('.weekday-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.target.classList.toggle('active'); this.updateUpcomingDates(); });
    });

    // time and date changes
    document.getElementById('task-start-time').addEventListener('change', () => this.updateUpcomingDates());
    document.getElementById('task-end-time').addEventListener('change', () => this.updateUpcomingDates());
    const dateEl = document.getElementById('task-date');
    if (dateEl) {
      dateEl.addEventListener('change', () => {
        const d = dateEl.value ? new Date(dateEl.value) : new Date();
        document.getElementById('selected-date-display').textContent = this.formatDateDisplay(d);
        this.updateUpcomingDates();
      });
    }
  }

  // ---- Views (unchanged) ----
  switchView(viewName) {
    if (!viewName || viewName === this.currentView) return;

    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    const item = document.querySelector(`[data-view="${viewName}"]`);
    if (item) item.classList.add('active');

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const v = document.getElementById(`${viewName}-view`);
    if (v) v.classList.add('active');

    this.currentView = viewName;
    this.renderCurrentView();

    const titles = { 'horizons': 'Cascading Horizons', 'cascade': 'Cascade View' };
    document.getElementById('current-view-title').textContent = titles[viewName] || viewName;

    if (window.innerWidth <= 768) this.toggleMobileMenu(false);
  }

  renderCurrentView() {
    if (this.currentView === 'horizons') this.renderHorizonsView();
    else if (this.currentView === 'cascade') this.renderCascadeView();
  }

  renderHorizonsView() {
    const horizons = ['hours', 'days', 'weeks', 'months', 'years', 'life'];
    horizons.forEach(h => {
      const container = document.getElementById(`${h}-tasks`);
      const tasks = this.data.tasks.filter(t => t.horizon === h && !t.completed);
      container.innerHTML = tasks.length === 0
        ? '<div class="empty-state">No tasks yet. Click + to add one.</div>'
        : tasks.map(t => this.renderTaskItem(t)).join('');
    });
  }

  renderTaskItem(task) {
    const timeInfo = task.timeSettings ? `
      <div class="task-time-info">
        <i class="fas fa-clock"></i> ${task.timeSettings.startTime} - ${task.timeSettings.endTime}
        ${task.timeSettings.date ? ` • ${new Date(task.timeSettings.date).toLocaleDateString()}` : ''}
        ${task.timeSettings.repeat && task.timeSettings.repeat !== 'none' ? `<span class="repeat-badge">${task.timeSettings.repeat}</span>` : ''}
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
          <button class="task-btn" onclick="app.editTask('${task.id}')" title="Edit Task"><i class="fas fa-edit"></i></button>
          <button class="task-btn" onclick="app.deleteTask('${task.id}')" title="Delete Task"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }

  renderCascadeView() {
    const horizons = ['life', 'years', 'months', 'weeks', 'days', 'hours'];
    horizons.forEach(h => {
      const container = document.getElementById(`cascade-${h}`);
      const tasks = this.data.tasks.filter(t => t.horizon === h && !t.completed);
      container.innerHTML = tasks.map(t => `
        <div class="cascade-task">
          <strong>${this.escapeHtml(t.title)}</strong>
          ${t.description ? `<div>${this.escapeHtml(t.description)}</div>` : ''}
          ${t.cascadesTo ? `<div><small>→ ${t.cascadesTo.join(' → ')}</small></div>` : ''}
        </div>`).join('') || '<div class="empty-state">No tasks</div>';
    });
  }

  // ---- Time modal ----
  openTimeModal() {
    const now = new Date();
    const dateEl = document.getElementById('task-date');

    // populate date
    const existingDate = this.currentTaskTimeData?.timeSettings?.date;
    const initDate = existingDate ? new Date(existingDate) : now;
    if (dateEl) dateEl.value = this.toInputDate(initDate);
    document.getElementById('selected-date-display').textContent = this.formatDateDisplay(initDate);

    if (this.currentTaskTimeData.timeSettings) {
      this.populateTimeModal(this.currentTaskTimeData.timeSettings);
    } else {
      this.setDefaultTimeSettings();
    }

    this.updateUpcomingDates();
    this.openModal('time-modal');
  }

  populateTimeModal(timeSettings) {
    if (timeSettings.startTime) document.getElementById('task-start-time').value = timeSettings.startTime;
    if (timeSettings.endTime) document.getElementById('task-end-time').value = timeSettings.endTime;
    if (timeSettings.date) {
      const d = new Date(timeSettings.date);
      document.getElementById('task-date').value = this.toInputDate(d);
      document.getElementById('selected-date-display').textContent = this.formatDateDisplay(d);
    }
    if (timeSettings.repeat) this.setActiveRepeatOption(timeSettings.repeat);
    if (timeSettings.weekdays) this.setActiveWeekdays(timeSettings.weekdays);
    this.updateUpcomingDates();
  }

  setDefaultTimeSettings() {
    const now = new Date();
    const startTime = this.formatTime(now.getHours(), (Math.floor(now.getMinutes() / 30) * 30 + 30) % 60);
    const endTime = this.formatTime((now.getHours() + 1) % 24, now.getMinutes());
    document.getElementById('task-start-time').value = startTime;
    document.getElementById('task-end-time').value = endTime;
    document.getElementById('task-date').value = this.toInputDate(now);
    this.setActiveRepeatOption('none');
  }

  formatTime(h, m) { return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`; }
  toInputDate(d) { const y = d.getFullYear(); const m = `${d.getMonth()+1}`.padStart(2,'0'); const day = `${d.getDate()}`.padStart(2,'0'); return `${y}-${m}-${day}`; }
  formatDateDisplay(date) {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', opts);
  }

  setActiveRepeatOption(type) {
    document.querySelectorAll('.repeat-option').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.repeat === type) btn.classList.add('active');
    });
    document.getElementById('weekday-options').style.display = type === 'weekly' ? 'block' : 'none';
  }
  setActiveWeekdays(days) {
    document.querySelectorAll('.weekday-btn').forEach(btn => {
      btn.classList.remove('active');
      if (days.includes(btn.dataset.day)) btn.classList.add('active');
    });
  }
  toggleRepeatOptions() { document.getElementById('repeat-section').style.display = 'block'; }

  showRescheduleOptions() { /* replaced by native date picker button in HTML */ }

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
      date: document.getElementById('task-date').value, // yyyy-mm-dd
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

  getSelectedRepeatOption() { const active = document.querySelector('.repeat-option.active'); return active ? active.dataset.repeat : 'none'; }
  getSelectedWeekdays() { return Array.from(document.querySelectorAll('.weekday-btn.active')).map(b => b.dataset.day); }

  updateTimeSummary() {
    const summary = document.getElementById('time-summary');
    const s = this.currentTaskTimeData.timeSettings;
    if (!s) { summary.textContent = 'No time set'; return; }
    let text = `${s.startTime} - ${s.endTime}`;
    if (s.date) {
      try { text += ` • ${new Date(s.date).toLocaleDateString()}`; } catch {}
    }
    if (s.repeat && s.repeat !== 'none') {
      text += ` • ${s.repeat}`;
      if (s.repeat === 'weekly' && s.weekdays.length > 0) text += ` (${s.weekdays.map(d => d.substring(0,3)).join(', ')})`;
    }
    summary.textContent = text;
  }

  // Compute preview of next 3 occurrences based on date + repeat choice
  updateUpcomingDates() {
    const list = document.querySelector('.upcoming-list');
    const baseDateStr = document.getElementById('task-date').value;
    const repeat = this.getSelectedRepeatOption();
    const weekdays = this.getSelectedWeekdays();

    let startDate = baseDateStr ? new Date(baseDateStr) : new Date();
    startDate.setHours(0,0,0,0);

    const items = [];
    const pushDate = (d) => items.push(`<div class="upcoming-item"><strong>${this.formatDateDisplay(d)}</strong></div>`);

    const weekdayIndex = (day) => ({sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6}[day]);

    if (repeat === 'none') {
      pushDate(startDate);
    } else if (repeat === 'daily') {
      for (let i=0;i<3;i++) { const d = new Date(startDate); d.setDate(d.getDate()+i); pushDate(d); }
    } else if (repeat === 'weekly') {
      // produce next 3 matching weekdays from the chosen set, starting at (or after) base date
      const chosen = weekdays.map(weekdayIndex).filter(v => v!==undefined).sort((a,b)=>a-b);
      if (chosen.length === 0) {
        // default to the base date’s weekday
        chosen.push(startDate.getDay());
      }
      let d = new Date(startDate);
      while (items.length < 3) {
        for (const w of chosen) {
          const next = new Date(d);
          const delta = (w - next.getDay() + 7) % 7;
          next.setDate(next.getDate() + delta);
          if (next >= startDate) pushDate(next);
          if (items.length >= 3) break;
        }
        d.setDate(d.getDate() + 7);
      }
    } else if (repeat === 'monthly') {
      for (let i=0;i<3;i++) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth()+i);
        // keep day if possible; clamp to month length
        const day = startDate.getDate();
        const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
        d.setDate(Math.min(day, last));
        pushDate(d);
      }
    } else if (repeat === 'yearly') {
      for (let i=0;i<3;i++) {
        const d = new Date(startDate);
        d.setFullYear(d.getFullYear()+i);
        pushDate(d);
      }
    }

    list.innerHTML = items.join('');
  }

  // ---- Task CRUD (unchanged except it will carry new timeSettings.date field) ----
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

      document.querySelectorAll('input[name="cascade"]').forEach(cb => {
        const targetIndex = horizons.indexOf(cb.value);
        cb.disabled = targetIndex <= currentIndex;
        if (targetIndex > currentIndex && !cb.disabled) cb.checked = true;
      });
    } else {
      cascadeGroup.style.display = 'none';
    }
  }

  // ---- Helpers ----
  getSelectedRepeatOption() { const active = document.querySelector('.repeat-option.active'); return active ? active.dataset.repeat : 'none'; }
  getSelectedWeekdays() { return Array.from(document.querySelectorAll('.weekday-btn.active')).map(b => b.dataset.day); }

  saveTask() {
    const form = document.getElementById('task-form');
    if (!form.checkValidity()) { form.reportValidity(); return; }

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
      const idx = this.data.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) this.data.tasks[idx] = task;
    } else {
      this.data.tasks.push(task);
    }

    this.saveData();
    this.closeModal('task-modal');
    this.renderCurrentView();
    this.showNotification(`Task ${isEdit ? 'updated' : 'added'} successfully`, 'success');
  }

  getCascadeSelections() { return Array.from(document.querySelectorAll('input[name="cascade"]:checked')).map(cb => cb.value); }
  editTask(taskId) { const t = this.data.tasks.find(tt => tt.id === taskId); if (t) this.openTaskModal(t); }
  deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
      this.saveData();
      this.renderCurrentView();
      this.showNotification('Task deleted', 'success');
    }
  }
  addToHorizon(h) { this.openTaskModal({ horizon: h }); }

  exportData() {
    const exportData = {
      ...this.data,
      syncInfo: { exportedAt: new Date().toISOString(), syncEnabled: this.syncEnabled, sessionId: this.cloudSync.sessionId, appVersion: '2.1.0' }
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `timestripe-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    this.showNotification('Data exported successfully', 'success');
  }

  importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.syncInfo) this.saveSyncConfig({ enabled: imported.syncInfo.syncEnabled, sessionId: imported.syncInfo.sessionId });
        this.data = { ...imported, lastSaved: new Date().toISOString() };
        this.saveData();
        this.renderCurrentView();
        this.showNotification('Data imported successfully', 'success');
      } catch { this.showNotification('Invalid import file', 'error'); }
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

  openModal(id) { document.getElementById(id).style.display = 'block'; document.body.style.overflow = 'hidden'; }
  closeModal(id) { document.getElementById(id).style.display = 'none'; document.body.style.overflow = ''; }
  closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); document.body.style.overflow = ''; }
  toggleMobileMenu(show) { const sidebar = document.getElementById('main-sidebar'); if (typeof show === 'boolean') sidebar.classList.toggle('active', show); else sidebar.classList.toggle('active'); }
  generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }
  escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  updateDateDisplay() { const now = new Date(); const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; document.getElementById('current-date').textContent = now.toLocaleDateString('en-US', opts); }
  showNotification(msg, type='info') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    const el = document.createElement('div'); el.className = `notification notification-${type}`;
    el.innerHTML = `<div class="notification-content"><i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i><span>${msg}</span></div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.animation = 'slideOut 0.3s ease'; setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 300); }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new TimeStripeApp(); });
