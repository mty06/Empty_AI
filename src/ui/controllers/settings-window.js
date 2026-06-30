document.addEventListener('DOMContentLoaded', () => {
    const codingLanguageSelect = document.getElementById('codingLanguage');
    const addFileBtn = document.getElementById('addFileBtn');
    const contextFilesList = document.getElementById('contextFilesList');
    const noContextFilesMsg = document.getElementById('noContextFilesMsg');
    const contextFooter = document.getElementById('contextFooter');
    const clearContextBtn = document.getElementById('clearContextBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');

    const closeSettings = () => window.api && window.api.send('close-settings');

    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

    if (!window.emptyAPI) {
        console.error('[Settings] window.emptyAPI not available');
        return;
    }

    // ── Language ──────────────────────────────────────────────────────────────

    const loadSettings = async () => {
        try {
            const settings = await window.emptyAPI.getSettings();
            if (settings && codingLanguageSelect) {
                codingLanguageSelect.value = settings.codingLanguage || 'none';
            }
        } catch (e) {
            console.error('[Settings] Failed to load settings:', e);
        }
    };

    if (codingLanguageSelect) {
        codingLanguageSelect.addEventListener('change', (e) => {
            window.emptyAPI.saveSettings({ codingLanguage: e.target.value });
        });
    }

    // Sync language when another window changes it
    window.emptyAPI.onCodingLanguageChanged((event, data) => {
        if (data && data.language && codingLanguageSelect) {
            codingLanguageSelect.value = data.language;
        }
    });

    // Reload when settings window is shown
    window.emptyAPI.receive('settings-window-shown', loadSettings);

    // ── Context Files ─────────────────────────────────────────────────────────

    const formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    };

    const renderContextFiles = (files) => {
        contextFilesList.innerHTML = '';

        if (!files || !files.length) {
            noContextFilesMsg.style.display = 'block';
            contextFooter.style.display = 'none';
            return;
        }

        noContextFilesMsg.style.display = 'none';
        contextFooter.style.display = 'flex';

        files.forEach((file) => {
            const item = document.createElement('div');
            item.className = 'context-file-item';

            const info = document.createElement('div');
            info.className = 'context-file-info';

            const name = document.createElement('span');
            name.className = 'context-file-name';
            name.textContent = file.name;
            name.title = file.path;

            const size = document.createElement('span');
            size.className = 'context-file-size';
            size.textContent = formatBytes(file.size);

            info.appendChild(name);
            info.appendChild(size);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn-danger';
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.title = 'Remove';
            removeBtn.addEventListener('click', async () => {
                const result = await window.emptyAPI.removeContextFile(file.path);
                renderContextFiles(result.files);
            });

            item.appendChild(info);
            item.appendChild(removeBtn);
            contextFilesList.appendChild(item);
        });
    };

    const refreshContextFiles = async () => {
        const result = await window.emptyAPI.getContextFiles();
        renderContextFiles(result.files);
    };

    // Add File
    if (addFileBtn) {
        addFileBtn.addEventListener('click', async () => {
            const result = await window.emptyAPI.selectContextFiles();
            if (result.success) {
                await refreshContextFiles();
            }
        });
    }

    // Clear All
    if (clearContextBtn) {
        clearContextBtn.addEventListener('click', async () => {
            await window.emptyAPI.clearContextFiles();
            renderContextFiles([]);
        });
    }

    // Listen for changes from other sources (e.g. another window)
    window.emptyAPI.onContextFilesChanged((event, data) => {
        renderContextFiles(data.files);
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSettings();
    });

    // ── Init ──────────────────────────────────────────────────────────────────

    loadSettings();
    refreshContextFiles();
});
