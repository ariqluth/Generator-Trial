document.addEventListener('DOMContentLoaded', function () {
    // Hapus semua draft controller di localStorage saat halaman di-refresh
    Object.keys(localStorage).forEach(function (key) {
        if (key.startsWith('controllerDraft_')) {
            localStorage.removeItem(key);
        }
        if (key.startsWith('hookDraft_')) {
            localStorage.removeItem(key);
        }
        if (key.startsWith('helperDraft')) {
            localStorage.removeItem(key);
        }
    });

    const container = document.querySelector('#hot-table');
    const dataTypes = [
        'STRING', 'TEXT', 'INTEGER', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL',
        'DATE', 'DATEONLY', 'TIME', 'BOOLEAN', 'ENUM', 'JSON', 'JSONB',
        'UUID', 'UUIDV4', 'ARRAY', 'CITEXT',
    ];
    const nullableOptions = ['YES', 'NO']; const constraintsList = [
        'unique',
        'autoIncrement'
    ];
    const srcFkOptions = ['SRC', 'FK'];// These variables will be populated from the EJS template
    const modelsList = window.modelsList;
    const modelStructures = window.modelStructures;
    let tables = modelStructures;

    // Store original structures for comparison
    let originalTables = JSON.parse(JSON.stringify(modelStructures));

    console.log('Initial modelsList:', modelsList);
    console.log('Initial tables:', tables);
    console.log('Original tables backup:', originalTables); Object.keys(tables).forEach(table => {
        if (!tables[table] || tables[table].length === 0) {
            tables[table] = [['', '', '', 'SRC', '', '', 'true', '']];
            originalTables[table] = [['', '', '', 'SRC', '', '', 'true', '']];
        }
    });

    console.log('Processed tables:', tables);

    let currentTable = localStorage.getItem('currentTable') || modelsList[0] || 'New Table';
    if (!tables[currentTable] || !modelsList.includes(currentTable)) {
        currentTable = modelsList[0] || 'New Table'; if (!tables[currentTable]) {
            tables[currentTable] = [['', '', '', 'SRC', '', '', 'true', '']];
        }
    }

    document.getElementById('currentTableName').textContent = currentTable; const hot = new Handsontable(container, {
        data: tables[currentTable],
        colHeaders: [
            'Column Name <span style="color: red">*</span>',
            'Data Type <span style="color: red">*</span>',
            'Constraints',
            'SRC/FK',
            'Identity/Attribute',
            'Default Value',
            'allowNull <span style="color: red">*</span>',
            'Description'
        ],
        columns: [
            { type: 'text' },
            { type: 'dropdown', source: dataTypes, dropdownHeight: 300 },
            { type: 'dropdown', source: constraintsList, multiple: true, dropdownHeight: 300 },
            { type: 'dropdown', source: srcFkOptions, dropdownHeight: 300, defaultValue: 'SRC' },
            { type: 'text', placeholder: 'TableName.id|alias' },
            { type: 'text', placeholder: 'defaultValue' },
            { type: 'dropdown', source: nullableOptions, dropdownHeight: 300, renderer: function (instance, td, row, col, prop, value, cellProperties) { Handsontable.renderers.DropdownRenderer.apply(this, arguments); td.textContent = value === 'YES' ? 'YES' : 'NO'; return td; } },
            { type: 'text', placeholder: 'comment' }
        ],
        allowHtml: true,
        rowHeaders: true,
        selectionMode: 'row',
        outsideClickDeselects: false,
        currentHeaderClassName: 'bg-blue-100',
        headerTooltips: {
            rows: true,
            columns: true,
            onlyTrimmed: false
        }, cells(row, col) {
            const cellProperties = {};

            // Disable editing for the first row (row 0)
            if (row === 0) {
                cellProperties.readOnly = true;
            }

            // Column Name styling
            if (col === 0) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    if (value) {
                        td.style.fontWeight = '600';
                        td.style.color = '#1E293B';
                    }
                    return td;
                };
            }
            // Data Type styling
            else if (col === 1) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.DropdownRenderer.apply(this, arguments);
                    if (value) {
                        td.style.backgroundColor = '#F8FAFC';
                        td.style.fontFamily = 'monospace';
                        td.style.color = '#0F766E';
                    }
                    return td;
                };
            }
            // Constraints styling
            else if (col === 2) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.DropdownRenderer.apply(this, arguments);
                    if (value && value.includes('PRIMARY KEY')) {
                        td.style.backgroundColor = '#EDE9FE';
                        td.style.color = '#5B21B6';
                        td.style.fontWeight = '500';
                    } else if (value && value.includes('UNIQUE')) {
                        td.style.backgroundColor = '#E0F2FE';
                        td.style.color = '#075985';
                        td.style.fontWeight = '500';
                    } else if (value && value.includes('foreignKey')) {
                        td.style.backgroundColor = '#FEF9C3';
                        td.style.color = '#854D0E';
                        td.style.fontWeight = '500';
                    }
                    return td;
                };
            }
            // SRC/FK styling
            else if (col === 3) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.DropdownRenderer.apply(this, arguments);
                    if (value === 'SRC') {
                        td.style.backgroundColor = '#DBEAFE';
                        td.style.color = '#1D4ED8';
                        td.style.fontWeight = '600';
                    } else if (value === 'FK') {
                        td.style.backgroundColor = '#FDF4FF';
                        td.style.color = '#A21CAF';
                        td.style.fontWeight = '600';
                    }
                    return td;
                };
            }
            // Identity/Attribute styling
            else if (col === 4) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    if (value && value.includes('.')) {
                        td.style.backgroundColor = '#FEF9C3';
                        td.style.color = '#854D0E';
                        td.style.fontFamily = 'monospace';
                    }
                    return td;
                };
            }
            // Default Value styling
            else if (col === 5) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    if (value) {
                        td.style.backgroundColor = '#F1F5F9';
                        td.style.fontFamily = 'monospace';
                        td.style.color = '#475569';
                    }
                    return td;
                };
            }
            // allowNull styling
            else if (col === 6) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.DropdownRenderer.apply(this, arguments);
                    td.style.backgroundColor = value === 'NO' ? '#FEE2E2' : '#DCFCE7';
                    td.style.color = value === 'NO' ? '#991B1B' : '#166534';
                    td.style.fontWeight = '500';
                    return td;
                };
            }
            // Description styling
            else if (col === 7) {
                cellProperties.renderer = function (instance, td, row, col, prop, value) {
                    Handsontable.renderers.TextRenderer.apply(this, arguments);
                    if (value) {
                        td.style.color = '#6B7280';
                        td.style.fontStyle = 'italic';
                    }
                    return td;
                };
            }

            return cellProperties;
        }, columns: [
            { type: 'text' },
            {
                type: 'dropdown',
                source: dataTypes,
                dropdownHeight: 300
            },
            {
                type: 'dropdown',
                source: constraintsList,
                multiple: true,
                dropdownHeight: 300
            }, {
                type: 'dropdown',
                source: srcFkOptions,
                dropdownHeight: 300,
                defaultValue: 'SRC'
            },
            { type: 'text', placeholder: 'TableName.id|alias' },
            { type: 'text', placeholder: 'defaultValue' },
            {
                type: 'dropdown',
                source: nullableOptions,
                dropdownHeight: 300,
                renderer: function (instance, td, row, col, prop, value, cellProperties) {
                    Handsontable.renderers.DropdownRenderer.apply(this, arguments);
                    td.textContent = value === 'YES' ? 'YES' : 'NO';
                    return td;
                }
            },
            { type: 'text', placeholder: 'comment' }
        ],
        width: '100%',
        height: 'auto',
        rowHeights: 28,
        colWidths: 120,
        stretchH: 'all',
        manualRowResize: true,
        manualColumnResize: true,
        contextMenu: true,
        minRows: 4,
        minSpareRows: 1,
        enterMoves: { row: 1, col: 0 },
        outsideClickDeselects: true,
        autoColumnSize: true,
        headerTooltips: true,
        className: 'htCenter',
        licenseKey: 'non-commercial-and-evaluation'
    }); function updateTablesList() {
        const tablesList = document.getElementById('tablesList');
        const searchInput = document.getElementById('searchTableInput');
        const filteredTables = Object.keys(tables)
            .filter(tableName => !tableSearchQuery || tableName.toLowerCase().includes(tableSearchQuery));
        tablesList.innerHTML = '';
        // Update placeholder input search dengan jumlah table
        if (searchInput) {
            searchInput.placeholder = `Search ${filteredTables.length} total table`;
        }
        filteredTables.forEach(tableName => {
            const div = document.createElement('div');
            div.className = `table-list-item px-2 py-1.5 rounded cursor-pointer transition-colors flex items-center gap-1.5 text-xs ${tableName === currentTable
                ? 'bg-white text-slate-900 font-medium shadow-sm border border-slate-200/75'
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`;

            const icon = document.createElement('svg');
            icon.className = 'w-3 h-3';
            icon.setAttribute('fill', 'none');
            icon.setAttribute('stroke', 'currentColor');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18"></path>';

            div.insertBefore(icon, div.firstChild);
            // Table name text
            const nameSpan = document.createElement('span');
            nameSpan.textContent = tableName;
            div.appendChild(nameSpan);
            div.onclick = () => switchTable(tableName);
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-table-btn ml-auto text-red-400 hover:text-red-600 px-1 rounded';
            deleteBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;
            deleteBtn.title = 'Delete table';
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm(`Delete table & all files for '${tableName}'? This cannot be undone!`)) return;
                showLoading();
                try {
                    const res = await fetch(`/api/generator/delete/${tableName}`, { method: 'DELETE' });
                    const data = await res.json();
                    if (data.status === 'success') {
                        showSuccessNotification(`Deleted ${tableName} and related files.`);
                        // Remove from UI
                        delete tables[tableName];
                        delete originalTables[tableName];
                        const idx = window.modelsList.indexOf(tableName);
                        if (idx !== -1) window.modelsList.splice(idx, 1);
                        if (currentTable === tableName) {
                            // Switch to another table if possible
                            const next = window.modelsList[0] || Object.keys(tables)[0];
                            if (next) switchTable(next);
                        }
                        updateTablesList();
                    } else {
                        showErrorNotification(data.message || 'Failed to delete table');
                    }
                } catch (err) {
                    showErrorNotification('Error deleting table: ' + err.message);
                } finally {
                    hideLoading();
                }

            });
            div.appendChild(deleteBtn);
            tablesList.appendChild(div);
            // Auto scroll to active table
            if (tableName === currentTable) {
                setTimeout(() => {
                    div.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        });

        console.log(`Tables list updated. Current active table: ${currentTable}`);
    } function switchTable(tableName) {
        // Save current table data before switching
        tables[currentTable] = hot.getData();
        currentTable = tableName;
        localStorage.setItem('currentTable', currentTable);
        document.getElementById('currentTableName').textContent = tableName;
        hot.loadData(tables[tableName]);
        updateTablesList();

        // Show visual feedback for table switch
        const tableNameElement = document.getElementById('currentTableName');
        tableNameElement.style.transform = 'scale(1.05)';
        tableNameElement.style.transition = 'transform 0.2s ease';
        setTimeout(() => {
            tableNameElement.style.transform = 'scale(1)';
        }, 200);
    }

    // Function to update original structure when needed
    function updateOriginalStructure(tableName) {
        if (tables[tableName]) {
            originalTables[tableName] = JSON.parse(JSON.stringify(tables[tableName]));
            console.log(`Updated original structure for ${tableName}:`, originalTables[tableName]);
        }
    }    // Function to show success notification
    function showSuccessNotification(message) {
        showNotification(message, 'success');
    }

    // Function to show error notification  
    function showErrorNotification(message) {
        showNotification(message, 'error');
    }

    // Function to show info notification
    function showInfoNotification(message) {
        showNotification(message, 'info');
    }    // Main notification function with different types
    function showNotification(message, type = 'success') {        // Get existing notifications and adjust their positions
        const existingNotifications = document.querySelectorAll('.custom-notification');
        existingNotifications.forEach((notif, index) => {
            const currentTop = 24 + (index * 50); // Reduced from 120px to 50px for smaller notifications
            const newTop = currentTop + 50; // Move down by smaller notification height
            notif.style.top = `${newTop}px`;
            notif.style.transition = 'all 0.3s ease-out';
        });
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'custom-notification fixed right-4 max-w-xs w-auto transform translate-x-full transition-all duration-300 ease-out z-[9999]';
        notification.style.top = '24px'; // Always appear at top
        notification.style.right = '30px'; // Always appear at right

        // Different styles for different types
        let bgColor, iconColor, icon;
        switch (type) {
            case 'success':
                bgColor = 'bg-green-50';
                iconColor = 'text-green-600';
                icon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>`;
                break;
            case 'error':
                bgColor = 'bg-red-50';
                iconColor = 'text-red-600';
                icon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>`;
                break;
            case 'info':
                bgColor = 'bg-blue-50';
                iconColor = 'text-blue-600';
                icon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01"></path>
                </svg>`;
                break;
        }

        // Format error message agar lebih readable
        let formattedMessage = message;
        if (type === 'error') {
            // Pisahkan baris pertama (judul/error utama) dan sisanya (stack trace)
            const lines = message.split(/\r?\n/);
            const firstLine = lines[0] || '';
            const rest = lines.slice(1).join('\n');
            formattedMessage = `<span class='font-bold text-red-700'>${firstLine}</span>`;
            if (rest.trim()) {
                formattedMessage += `<pre class='block text-xs text-red-800 whitespace-pre-wrap font-mono mt-1'>${rest.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
            }
        } else {
            formattedMessage = message.replace(/\n/g, '<br>');
        }

        notification.innerHTML = `
            <div class="${bgColor} rounded-md shadow-sm border border-gray-200/50 overflow-hidden">
                <div class="px-3 py-2">
                    <div class="flex items-center gap-2">
                        <div class="flex-shrink-0 ${iconColor}">
                            ${icon}
                        </div>
                        <div class="flex-1 text-xs text-gray-700 font-medium">
                            ${formattedMessage}
                        </div>
                        <button onclick="removeNotification(this)" 
                                class="flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
            notification.classList.add('translate-x-0');
        }, 100);
        // Auto remove after 3 seconds, except for error type
        if (type !== 'error') {
            setTimeout(() => {
                removeNotification(notification.querySelector('button'));
            }, 3000);
        }

        // Add click to dismiss (except on close button)
        notification.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // Don't close if clicking close button
            removeNotification(notification.querySelector('button'));
        });
    }

    // Function to remove notification and restack others
    function removeNotification(button) {
        const notification = button.closest('.custom-notification');
        if (!notification) return;

        // Animate out
        notification.classList.remove('translate-x-0');
        notification.classList.add('translate-x-full');        // Remove from DOM after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);// Restack remaining notifications
                const remainingNotifications = document.querySelectorAll('.custom-notification');
                remainingNotifications.forEach((notif, index) => {
                    const newTop = 24 + (index * 50); // Reduced spacing for smaller notifications
                    notif.style.top = `${newTop}px`;
                    notif.style.transition = 'all 0.3s ease-out';
                });
            }
        }, 300);
    }

    // Make removeNotification available globally for onclick handlers
    window.removeNotification = removeNotification;

    // Function to refresh model structures from server with retry mechanism
    async function refreshModelStructures(maxRetries = 5, initialDelay = 1000) {
        try {
            console.log(`Refreshing model structures...`);
            const response = await fetch('/api/wireframe/structures');
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON - server may be restarting`);
            }
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    Object.keys(tables).forEach(key => delete tables[key]);
                    Object.keys(originalTables).forEach(key => delete originalTables[key]);
                    Object.assign(tables, data.modelStructures);
                    Object.assign(originalTables, JSON.parse(JSON.stringify(data.modelStructures)));
                    window.modelsList.length = 0;
                    window.modelsList.push(...data.models);
                    console.log('Model structures refreshed from server successfully');
                    return true;
                } else {
                    throw new Error(data.message || 'Server returned success: false');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Failed to refresh model structures:', error);
            return false;
        }
    }

    // Helper function to detect if server is restarting (returns HTML instead of JSON)
    function isServerRestarting(response, error) {
        if (!response && error) {
            // Network errors during restart
            return error.message.includes('fetch') ||
                error.message.includes('NetworkError') ||
                error.message.includes('Failed to fetch');
        }

        if (response) {
            // Check for common restart response patterns
            const contentType = response.headers.get('content-type');
            return response.status === 502 || // Bad Gateway
                response.status === 503 || // Service Unavailable  
                response.status === 504 || // Gateway Timeout
                (contentType && contentType.includes('text/html')) || // HTML instead of JSON
                !contentType; // Missing content type
        }

        return false;
    }

    // Event Listeners
    document.getElementById('addRow').addEventListener('click', () => {
        hot.alter('insert_row_below');
    });

    // Simpan baris terakhir yang terseleksi
    let lastSelectedRows = [];
    hot.addHook('afterSelection', function (row, col, row2, col2) {
        // Simpan semua baris yang terseleksi (support multi select)
        const start = Math.min(row, row2);
        const end = Math.max(row, row2);
        lastSelectedRows = [];
        for (let r = start; r <= end; r++) {
            if (r > 0) lastSelectedRows.push(r); // skip row 0 jika ingin
        }
    });

    document.getElementById('removeRow').addEventListener('click', () => {
        // Gunakan lastSelectedRows, bukan hot.getSelected()
        if (lastSelectedRows.length > 0) {
            // Hapus dari baris terbesar agar index tidak bergeser
            lastSelectedRows = [...new Set(lastSelectedRows)].sort((a, b) => b - a);
            lastSelectedRows.forEach(rowIndex => {
                hot.alter('remove_row', rowIndex);
            });
            lastSelectedRows = [];
        } else {
            showErrorNotification('Please select a row to remove.');
        }
    });



    document.getElementById('syncModel').addEventListener('click', async () => {
        const syncButton = document.getElementById('syncModel');
        const originalButtonHTML = syncButton.innerHTML;

        // Show loading state
        syncButton.innerHTML = `
            <svg class="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Syncing...
        `;
        syncButton.disabled = true;
        showLoading();
        // Bersihkan default value lalu filter 'id' (kecuali create table baru)
        let tableData = hot.getData()
            .filter(row => row.some(cell => cell !== null && cell !== ''))
            .map(row => {
                const defaultValueIndex = 6;
                if (row[defaultValueIndex]) {
                    row[defaultValueIndex] = row[defaultValueIndex].replace(/^\["']|["']$/g, '');
                }
                return row;
            })
            .filter(row => row[0] !== 'id');
        // Get original structure for comparison, juga filter 'id'
        const originalStructure = originalTables[currentTable] || [];
        const filteredOriginalStructure = originalStructure
            .filter(row => row.some(cell => cell !== null && cell !== ''))
            .map(row => {
                const defaultValueIndex = 6;
                if (row[defaultValueIndex]) {
                    row[defaultValueIndex] = row[defaultValueIndex].replace(/^\["']|["']$/g, '');
                }
                return row;
            })
            .filter(row => row[0] !== 'id');

        console.log('=== SYNC DEBUG INFO ===');
        console.log('Current table:', currentTable);
        console.log('New fields:', tableData);
        console.log('Original fields:', filteredOriginalStructure);
        console.log('========================');

        try {
            const response = await fetch('/api/wireframe/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelName: currentTable,
                    fields: tableData,
                    originalFields: filteredOriginalStructure
                })
            });
            const result = await response.json();
            if (!response.ok) {
                // Tampilkan pesan error validasi dari backend
                let msg = result.message || 'Sync failed';
                if (result.fields && Array.isArray(result.fields) && result.fields.length > 0) {
                    msg += '\nField bermasalah: ' + result.fields.map(f => f[0]).join(', ');
                }
                showErrorNotification(msg);
                return;
            }

            if (result.success) {
                let successMessage = 'Model successfully synchronized!';
                if (result.changes) {
                    const changes = result.changes;
                    console.log('=== STRUCTURE CHANGES ===');
                    console.log('Added fields:', changes.added);
                    console.log('Removed fields:', changes.removed);
                    console.log('Modified fields:', changes.modified);
                    console.log('Unchanged fields:', changes.unchanged);
                    console.log('========================');

                    successMessage += '\n\nChanges detected:';

                    if (changes.added.length > 0) {
                        successMessage += `\n• Added fields: ${changes.added.map(f => f.fieldName).join(', ')}`;
                    }

                    if (changes.removed.length > 0) {
                        successMessage += `\n• Removed fields: ${changes.removed.map(f => f.fieldName).join(', ')}`;
                    }

                    if (changes.modified.length > 0) {
                        successMessage += `\n• Modified fields: ${changes.modified.map(f => f.fieldName).join(', ')}`;
                    }

                    if (changes.unchanged.length > 0) {
                        successMessage += `\n• Unchanged fields: ${changes.unchanged.length}`;
                    }
                }

                // ALWAYS refresh from server after successful sync to ensure UI matches actual database
                console.log('Waiting for server to stabilize after sync...');
                // Add a small delay to give server time to restart/reload
                await new Promise(resolve => setTimeout(resolve, 2000));

                console.log('Fetching fresh model structures from server with retry mechanism...');
                try {
                    // Use the improved refresh function with retry mechanism
                    const refreshSuccess = await refreshModelStructures();

                    if (refreshSuccess) {
                        console.log('Successfully refreshed structures from server');

                        // Update original structures as well (important for next comparison)
                        console.log('Updating original structures with fresh data...');
                        updateOriginalStructure(currentTable);

                        // Force refresh the current table display
                        if (tables[currentTable]) {
                            hot.loadData(tables[currentTable]);
                            console.log(`Force reloaded fresh data for table: ${currentTable}`);
                        } else {
                            // If current table doesn't exist, switch to first available table
                            const firstTable = Object.keys(tables)[0];
                            if (firstTable) {
                                switchTable(firstTable);
                                console.log(`Switched to first available table: ${firstTable}`);
                            }
                        }

                        // Update the tables list in sidebar
                        updateTablesList();

                    } else {
                        console.error('Failed to refresh structures with retry mechanism');
                        showInfoNotification('Sync completed but failed to refresh UI. Please refresh the page manually.');

                        // Fallback to result data if available
                        if (result.updatedModels && result.updatedModelStructures) {
                            Object.keys(tables).forEach(key => delete tables[key]);
                            Object.keys(originalTables).forEach(key => delete originalTables[key]);
                            Object.assign(tables, result.updatedModelStructures);
                            Object.assign(originalTables, JSON.parse(JSON.stringify(result.updatedModelStructures)));
                            window.modelsList.length = 0;
                            window.modelsList.push(...result.updatedModels);
                            if (tables[currentTable]) {
                                hot.loadData(tables[currentTable]);
                            }
                            updateTablesList();
                            console.log('Used fallback: updated structures from sync result');
                        }
                    }
                } catch (refreshError) {
                    console.error('Error in refresh mechanism:', refreshError);
                    showInfoNotification('Sync completed but failed to refresh UI. Please refresh the page manually.');

                    // Fallback to result data if refresh fails
                    if (result.updatedModels && result.updatedModelStructures) {
                        Object.keys(tables).forEach(key => delete tables[key]);
                        Object.keys(originalTables).forEach(key => delete originalTables[key]);
                        Object.assign(tables, result.updatedModelStructures);
                        Object.assign(originalTables, JSON.parse(JSON.stringify(result.updatedModelStructures)));
                        window.modelsList.length = 0;
                        window.modelsList.push(...result.updatedModels);
                        if (tables[currentTable]) {
                            hot.loadData(tables[currentTable]);
                        }
                        updateTablesList();
                        console.log('Used refresh error fallback: updated structures from sync result');
                    }
                }

                // Show success notification
                showSuccessNotification(successMessage);
                // Auto migrate setelah sync sukses
                try {
                    const migrateResponse = await fetch(`/api/migrate-model/${currentTable}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    if (migrateResponse.ok) {
                        showSuccessNotification(`Auto migrate berhasil untuk model: ${currentTable}`);
                    } else {
                        const errorText = await migrateResponse.text();
                        showErrorNotification(`Auto migrate gagal: ${errorText}`);
                    }
                } catch (err) {
                    showErrorNotification('Auto migrate error: ' + err.message);
                }
            } else {
                let msg = 'Error synchronizing model: ' + result.message;
                if (result.errors) {
                    msg += '\n' + result.errors;
                } showErrorNotification(msg);

                // Always try to refresh structures even after sync error to get the most current state
                console.log('Attempting to refresh structures after sync error using retry mechanism...');
                try {
                    const refreshSuccess = await refreshModelStructures();
                    if (refreshSuccess) {
                        console.log('Successfully refreshed structures after sync error');
                        updateTablesList();
                        if (tables[currentTable]) {
                            hot.loadData(tables[currentTable]);
                            console.log('Reloaded current table data after error refresh');
                        } else {
                            const firstTable = Object.keys(tables)[0];
                            if (firstTable) {
                                switchTable(firstTable);
                                console.log('Switched to first available table after error refresh');
                            }
                        }
                    } else {
                        console.error('Failed to refresh structures after sync error');
                        showInfoNotification('Sync failed and unable to refresh UI. Please refresh the page manually.');
                    }
                } catch (refreshError) {
                    console.error('Error during post-error refresh:', refreshError);
                    showInfoNotification('Sync failed and unable to refresh UI. Please refresh the page manually.');
                }
            }
        } catch (error) {
            showErrorNotification('Error synchronizing model: ' + error.message);
        } finally {
            // Restore button state
            syncButton.innerHTML = originalButtonHTML;
            syncButton.disabled = false;
            hideLoading();
        }
    }); document.getElementById('addTable').addEventListener('click', async () => {
        const tableName = prompt('Enter table name:');
        if (tableName && !tables[tableName]) {
            showLoading(); // Tampilkan loading sebelum mulai proses
            try {
                const response = await fetch(`/api/generator/generate/${tableName}`, {
                    method: 'POST'
                }); if (!response.ok) {
                    throw new Error(`Failed to generate table: ${response.statusText}`);
                }

                // Fetch fresh model structures from server after generation
                try {
                    const structuresResponse = await fetch('/api/wireframe/structures');
                    if (structuresResponse.ok) {
                        const structuresData = await structuresResponse.json();
                        if (structuresData.success) {
                            // Update local data with fresh server data
                            Object.keys(tables).forEach(key => delete tables[key]);
                            Object.keys(originalTables).forEach(key => delete originalTables[key]);

                            Object.assign(tables, structuresData.modelStructures);
                            Object.assign(originalTables, JSON.parse(JSON.stringify(structuresData.modelStructures)));

                            // Update global models list
                            window.modelsList.length = 0;
                            window.modelsList.push(...structuresData.models);

                            console.log('Fresh structures loaded from server:', structuresData.modelStructures);
                        }
                    } else {
                        throw new Error('Failed to fetch structures');
                    }
                } catch (fetchError) {
                    console.warn('Could not fetch fresh structures, using fallback:', fetchError);                    // Fallback: Add new table with default ID field
                    tables[tableName] = [
                        ['id', 'UUID', 'primaryKey', 'SRC', '', 'DataTypes.UUIDV4', 'NO', 'Primary key'],
                        ['', '', '', 'SRC', '', '', 'YES', '']
                    ];
                    originalTables[tableName] = [
                        ['id', 'UUID', 'primaryKey', 'SRC', '', 'DataTypes.UUIDV4', 'NO', 'Primary key'],
                        ['', '', '', 'SRC', '', '', 'YES', '']
                    ];

                    // Update global models list
                    if (!window.modelsList.includes(tableName)) {
                        window.modelsList.push(tableName);
                    }
                }
                // Auto redirect to new table and refresh UI
                switchTable(tableName);
                updateTablesList(); console.log(`New table '${tableName}' created and activated`);
                showSuccessNotification(`Table '${tableName}' created successfully! You are now editing this table.`);
            } catch (error) {
                showErrorNotification('Error generating table: ' + error.message);
            } finally {
                hideLoading(); // Sembunyikan loading setelah proses selesai
            }
        }
    });



    // Reset to original structure button
    document.getElementById('resetToOriginal').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset current table to original structure? All unsaved changes will be lost.')) {
            const originalData = originalTables[currentTable] || [];
            tables[currentTable] = JSON.parse(JSON.stringify(originalData));
            hot.loadData(tables[currentTable]);
            showSuccessNotification('Table structure has been reset to original.');
        }
    });

    // Refresh structures button
    document.getElementById('refreshStructures').addEventListener('click', async () => {
        const refreshButton = document.getElementById('refreshStructures');
        const originalHTML = refreshButton.innerHTML;

        // Hapus semua draft controller di localStorage
        if (window.modelsList && Array.isArray(window.modelsList)) {
            window.modelsList.forEach(tableName => {
                removeControllerDraft(tableName);
            });
        } else if (typeof currentTable === 'string') {
            removeControllerDraft(currentTable);
        }

        // Show loading state
        refreshButton.innerHTML = `
            <svg class="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
            Refreshing...
        `;
        refreshButton.disabled = true;
        showLoading();
        try {
            const success = await refreshModelStructures();
            if (success) {
                // Refresh UI
                updateTablesList();

                // Reload current table if it still exists
                if (tables[currentTable]) {
                    hot.loadData(tables[currentTable]);
                } else {
                    // Switch to first available table if current doesn't exist
                    const firstTable = Object.keys(tables)[0];
                    if (firstTable) {
                        switchTable(firstTable);
                    }
                } showSuccessNotification('Model structures refreshed successfully!');
            } else {
                showErrorNotification('Failed to refresh model structures. Please try again.');
            }
        } catch (error) {
            showErrorNotification('Error refreshing structures: ' + error.message);
        } finally {
            // Restore button state
            refreshButton.innerHTML = originalHTML;
            refreshButton.disabled = false;
            hideLoading();
        }
    });

    // Monaco Editor initialization
    let editor;
    let editorInitialized = false;
    let editorChangeListener = null;

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

    // Helper: get/set/remove draft dari localStorage
    function getControllerDraft(tableName) {
        return localStorage.getItem('controllerDraft_' + tableName);
    }
    function setControllerDraft(tableName, code) {
        localStorage.setItem('controllerDraft_' + tableName, code);
    }
    function removeControllerDraft(tableName) {
        localStorage.removeItem('controllerDraft_' + tableName);
    }
    // Helper: get/set/remove draft dari localStorage untuk Hook dan Helper
    function getHookDraft(tableName) {
        return localStorage.getItem('hookDraft_' + tableName);
    }
    function setHookDraft(tableName, code) {
        localStorage.setItem('hookDraft_' + tableName, code);
    }
    function removeHookDraft(tableName) {
        localStorage.removeItem('hookDraft_' + tableName);
    }
    function getHelperDraft() {
        return localStorage.getItem('helperDraft');
    }
    function setHelperDraft(code) {
        localStorage.setItem('helperDraft', code);
    }
    function removeHelperDraft() {
        localStorage.removeItem('helperDraft');
    }

    // Function to update editor content
    async function updateEditorContent(tableName, forceFetch = false) {
        try {
            // Jika forceFetch true, abaikan draft
            const draft = !forceFetch ? getControllerDraft(tableName) : null;
            if (draft !== null) {
                if (!editorInitialized) {
                    require(['vs/editor/editor.main'], function () {
                        editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                            value: draft,
                            language: 'javascript',
                            theme: 'vs',
                            automaticLayout: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 12,
                            lineHeight: 20,
                        });
                        editorInitialized = true;
                        if (editorChangeListener) editorChangeListener.dispose();
                        editorChangeListener = editor.onDidChangeModelContent(() => {
                            setControllerDraft(tableName, editor.getValue());
                        });
                    });
                } else {
                    if (editor) {
                        editor.setValue(draft);
                        if (editorChangeListener) editorChangeListener.dispose();
                        editorChangeListener = editor.onDidChangeModelContent(() => {
                            setControllerDraft(tableName, editor.getValue());
                        });
                    }
                }
                showInfoNotification('Draft lokal untuk ' + tableName + ' dipulihkan.');
                return;
            }
            // Jika tidak ada draft, ambil dari server
            const response = await fetch(`/api/wireframe/controller/${tableName}`);
            const data = await response.text();
            if (!editorInitialized) {
                require(['vs/editor/editor.main'], function () {
                    editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                        value: data,
                        language: 'javascript',
                        theme: 'vs',
                        automaticLayout: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 12,
                        lineHeight: 20,
                    });
                    editorInitialized = true;
                    if (editorChangeListener) editorChangeListener.dispose();
                    editorChangeListener = editor.onDidChangeModelContent(() => {
                        setControllerDraft(tableName, editor.getValue());
                    });
                });
            } else {
                if (editor) {
                    editor.setValue(data);
                    if (editorChangeListener) editorChangeListener.dispose();
                    editorChangeListener = editor.onDidChangeModelContent(() => {
                        setControllerDraft(tableName, editor.getValue());
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching controller code:', error);
            showErrorNotification('Failed to load controller code');
        }
    }

    // Initialize Monaco Editor
    require(['vs/editor/editor.main'], function () {
        updateEditorContent(currentTable);
    });

    // Tab switching functionality
    const wireframeTab = document.getElementById('wireframeTab');
    const customFunctionTab = document.getElementById('customFunctionTab');
    const customHookTab = document.getElementById('customHookTab'); // dipindah ke atas
    const wireframeContent = document.getElementById('wireframeContent');
    const editorContent = document.getElementById('editorContent');
    const hookEditorContent = document.getElementById('hookEditorContent'); // dipindah ke atas
    wireframeTab.addEventListener('click', () => {
        wireframeTab.classList.add('tab-active');
        customFunctionTab.classList.remove('tab-active');
        customHookTab.classList.remove('tab-active');
        if (document.getElementById('helperTab')) document.getElementById('helperTab').classList.remove('tab-active');
        logTab.classList.remove('tab-active'); // pastikan underline log hilang
        wireframeContent.classList.remove('hidden');
        editorContent.classList.add('hidden');
        hookEditorContent.classList.add('hidden');
        if (document.getElementById('helperEditorContent')) document.getElementById('helperEditorContent').classList.add('hidden');
        if (hot) hot.render();
        logContent.classList.add('hidden');
    });

    customFunctionTab.addEventListener('click', async () => {
        wireframeTab.classList.remove('tab-active');
        customFunctionTab.classList.add('tab-active');
        customHookTab.classList.remove('tab-active');
        if (document.getElementById('helperTab')) document.getElementById('helperTab').classList.remove('tab-active');
        logTab.classList.remove('tab-active'); // pastikan underline log hilang
        wireframeContent.classList.add('hidden');
        editorContent.classList.remove('hidden');
        hookEditorContent.classList.add('hidden');
        if (document.getElementById('helperEditorContent')) document.getElementById('helperEditorContent').classList.add('hidden');
        if (editor) {
            editor.layout();
            updateEditorContent(currentTable);
        }
    });

    // Extend switchTable to handle editor content
    const originalSwitchTable = switchTable;
    switchTable = function (tableName) {
        // Hapus draft controller & hook untuk model sebelumnya
        removeControllerDraft(currentTable);
        removeHookDraft(currentTable);
        originalSwitchTable(tableName);
        if (!editorContent.classList.contains('hidden') && editorInitialized && editor) {
            updateEditorContent(tableName, true); // force fetch
        }
        if (!hookEditorContent.classList.contains('hidden') && hookEditorInitialized && hookEditor) {
            updateHookEditorContent(tableName, true); // force fetch
        }
    };

    // Add save controller event listener
    document.getElementById('saveController').addEventListener('click', async () => {
        if (!editor || !editorInitialized) return;
        try {
            const code = editor.getValue();
            const response = await fetch(`/api/wireframe/controller/${currentTable}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            const result = await response.json();
            if (result.success) {
                // Hapus draft setelah berhasil save
                removeControllerDraft(currentTable);
                showSuccessNotification(`Controller for ${currentTable} saved successfully!`);

                // Show temporary success state on button
                const saveButton = document.getElementById('saveController');
                const originalText = saveButton.innerHTML;
                saveButton.innerHTML = `
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Saved!
                `;
                saveButton.classList.remove('bg-indigo-50', 'text-indigo-600', 'hover:bg-indigo-100');
                saveButton.classList.add('bg-green-50', 'text-green-600');

                setTimeout(() => {
                    saveButton.innerHTML = originalText;
                    saveButton.classList.remove('bg-green-50', 'text-green-600');
                    saveButton.classList.add('bg-indigo-50', 'text-indigo-600', 'hover:bg-indigo-100');
                }, 2000);
            } else {
                showErrorNotification(result.message || 'Failed to save controller');
            }
        } catch (error) {
            console.error('Error saving controller:', error);
            showErrorNotification('Error saving controller: ' + error.message);
        }
    });

    // Monaco Editor initialization for Hook
    let hookEditor;
    let hookEditorInitialized = false;
    let hookEditorChangeListener = null; // Tambahan: listener autosave draft

    // Function to update hook editor content
    async function updateHookEditorContent(tableName, forceFetch = false) {
        const draft = !forceFetch ? getHookDraft(tableName) : null;
        if (draft !== null) {
            if (hookEditorInitialized && hookEditor) {
                hookEditor.setValue(draft);
                if (hookEditorChangeListener) hookEditorChangeListener.dispose();
                hookEditorChangeListener = hookEditor.onDidChangeModelContent(() => {
                    setHookDraft(tableName, hookEditor.getValue());
                });
            }
            // Notifikasi hanya sekali per session per table
            showInfoNotification('Draft lokal Hook untuk ' + tableName + ' dipulihkan.');
            return;
        }
        if (!hookEditorInitialized || !hookEditor) return;
        try {
            const response = await fetch(`/api/wireframe/hook/${tableName}`);
            if (response.ok) {
                const code = await response.text();
                hookEditor.setValue(code);
            } else {
                hookEditor.setValue(`// Hook for ${tableName} not found\n// Create your custom hooks here`);
            }
            if (hookEditorChangeListener) hookEditorChangeListener.dispose();
            hookEditorChangeListener = hookEditor.onDidChangeModelContent(() => {
                setHookDraft(tableName, hookEditor.getValue());
            });
        } catch (error) {
            console.error('Error loading hook code:', error);
            hookEditor.setValue('// Error loading hook code');
        }
    }

    require(['vs/editor/editor.main'], function () {
        const editorElement = document.getElementById('monaco-editor');
        if (!editorElement) {
            console.error('Editor element not found');
            return;
        }

        editor = monaco.editor.create(editorElement, {
            value: '// Custom function code will appear here',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            roundedSelection: false,
            selectOnLineNumbers: true,
            find: { addExtraSpaceOnTop: false },
            suggestOnTriggerCharacters: true
        });

        editorInitialized = true;

        // Set GitHub theme
        monaco.editor.defineTheme('github-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: 'comment', foreground: '6A737D' },
                { token: 'keyword', foreground: 'F97583' },
                { token: 'string', foreground: '9ECBFF' },
                { token: 'number', foreground: 'B392F0' }
            ],
            colors: {
                'editor.background': '#24292E',
                'editor.foreground': '#E1E4E8'
            }
        });

        monaco.editor.setTheme('github-dark');

        // If we're already on the custom function tab, load the content
        if (!document.getElementById('editorContent').classList.contains('hidden')) {
            updateEditorContent(currentTable);
        }

        // Hook Editor
        const hookEditorElement = document.getElementById('monaco-hook-editor');
        if (hookEditorElement) {
            hookEditor = monaco.editor.create(hookEditorElement, {
                value: '// Custom hook code will appear here',
                language: 'javascript',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                roundedSelection: false,
                selectOnLineNumbers: true,
                find: { addExtraSpaceOnTop: false },
                suggestOnTriggerCharacters: true
            });
            hookEditorInitialized = true;
            monaco.editor.setTheme('github-dark');
            // Restore draft jika tab Hook aktif saat load
            if (!document.getElementById('hookEditorContent').classList.contains('hidden')) {
                updateHookEditorContent(currentTable);
            }
        }
    });

    // Tab switching functionality
    // const customHookTab = document.getElementById('customHookTab');
    // const hookEditorContent = document.getElementById('hookEditorContent');

    customHookTab.addEventListener('click', () => {
        customHookTab.classList.add('tab-active');
        wireframeTab.classList.remove('tab-active');
        customFunctionTab.classList.remove('tab-active');
        if (document.getElementById('helperTab')) document.getElementById('helperTab').classList.remove('tab-active');
        logTab.classList.remove('tab-active'); // pastikan underline log hilang
        hookEditorContent.classList.remove('hidden');
        wireframeContent.classList.add('hidden');
        editorContent.classList.add('hidden');
        if (helperEditorContent) helperEditorContent.classList.add('hidden');
        if (hookEditorInitialized && hookEditor) {
            updateHookEditorContent(currentTable);
        }
    });

    // Extend switchTable to handle hook editor content
    const originalSwitchTable2 = switchTable;
    switchTable = function (tableName) {
        originalSwitchTable2(tableName);
        if (!editorContent.classList.contains('hidden') && editorInitialized && editor) {
            updateEditorContent(tableName);
        }
        if (!hookEditorContent.classList.contains('hidden') && hookEditorInitialized && hookEditor) {
            updateHookEditorContent(tableName);
        }
    };

    // Add save hook event listener
    document.getElementById('saveHook').addEventListener('click', async () => {
        if (!hookEditor || !hookEditorInitialized) return;
        try {
            const code = hookEditor.getValue();
            const response = await fetch(`/api/wireframe/hook/${currentTable}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code })
            });
            const result = await response.json();
            if (result.success) {
                // Hapus draft setelah berhasil save
                removeHookDraft(currentTable);
                showSuccessNotification(`Hook for ${currentTable} saved successfully!`);
                const saveButton = document.getElementById('saveHook');
                const originalText = saveButton.innerHTML;
                saveButton.innerHTML = `
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Saved!`;
                saveButton.classList.remove('bg-indigo-50', 'text-indigo-600', 'hover:bg-indigo-100');
                saveButton.classList.add('bg-green-50', 'text-green-600');
                setTimeout(() => {
                    saveButton.innerHTML = originalText;
                    saveButton.classList.remove('bg-green-50', 'text-green-600');
                    saveButton.classList.add('bg-indigo-50', 'text-indigo-600', 'hover:bg-indigo-100');
                }, 2000);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error saving hook:', error);
            showErrorNotification('Error saving hook: ' + error.message);
        }
    });

    // Monaco Editor initialization for Helper
    let helperEditor;
    let helperEditorInitialized = false;

    // Function to update helper editor content
    async function updateHelperEditorContent() {
        // Cek draft dulu
        const draft = getHelperDraft();
        if (draft !== null && helperEditorInitialized && helperEditor) {
            helperEditor.setValue(draft);
            // Tampilkan notifikasi setiap kali draft helper dipulihkan
            showInfoNotification('Draft lokal Helper dipulihkan.');
            // Autosave listener
            if (helperEditor._helperDraftListener) helperEditor._helperDraftListener.dispose();
            helperEditor._helperDraftListener = helperEditor.onDidChangeModelContent(() => {
                setHelperDraft(helperEditor.getValue());
            });
            return;
        }
        if (!helperEditorInitialized || !helperEditor) return;
        try {
            const response = await fetch('/api/wireframe/helper');
            if (response.ok) {
                const code = await response.text();
                helperEditor.setValue(code);
            } else {
                // Load the actual helper file content
                const helperResponse = await fetch('/helpers/helper.js');
                if (helperResponse.ok) {
                    const helperCode = await helperResponse.text();
                    helperEditor.setValue(helperCode);
                } else {
                    helperEditor.setValue('// Error loading helper file');
                }
            }
            // Autosave listener
            if (helperEditor._helperDraftListener) helperEditor._helperDraftListener.dispose();
            helperEditor._helperDraftListener = helperEditor.onDidChangeModelContent(() => {
                setHelperDraft(helperEditor.getValue());
            });
        } catch (error) {
            console.error('Error loading helper code:', error);
            helperEditor.setValue('// Error loading helper code');
        }
    }

    require(['vs/editor/editor.main'], function () {
        const helperEditorElement = document.getElementById('monaco-helper-editor');
        if (helperEditorElement) {
            helperEditor = monaco.editor.create(helperEditorElement, {
                value: '// Loading helper functions...',
                language: 'javascript',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                fontSize: 13,
                lineHeight: 20,
                folding: true,
                lineNumbers: 'on',
                selectOnLineNumbers: true,
                find: { addExtraSpaceOnTop: false },
                suggestOnTriggerCharacters: true
            });
            helperEditorInitialized = true;
            monaco.editor.setTheme('github-dark');
            // Selalu panggil updateHelperEditorContent setelah inisialisasi
            updateHelperEditorContent();
        }
    });

    // Tab switching functionality for Helper
    const helperTab = document.getElementById('helperTab');
    const helperEditorContent = document.getElementById('helperEditorContent');

    if (helperTab && helperEditorContent) {
        helperTab.addEventListener('click', () => {
            helperTab.classList.add('tab-active');
            wireframeTab.classList.remove('tab-active');
            customFunctionTab.classList.remove('tab-active');
            customHookTab.classList.remove('tab-active');
            logTab.classList.remove('tab-active'); // pastikan underline log hilang
            helperEditorContent.classList.remove('hidden');
            wireframeContent.classList.add('hidden');
            editorContent.classList.add('hidden');
            hookEditorContent.classList.add('hidden');
            // Selalu panggil updateHelperEditorContent saat tab dibuka
            updateHelperEditorContent();
        });
    }

    // Search/filter for table list
    const searchTableInput = document.getElementById('searchTableInput');
    let tableSearchQuery = '';

    if (searchTableInput) {
        searchTableInput.addEventListener('input', function () {
            tableSearchQuery = this.value.trim().toLowerCase();
            updateTablesList();
        });
    }

    updateTablesList();

    // === LOG SEARCH FEATURE ===
    let originalLogContent = '';
    const logSearchInput = document.getElementById('logSearchInput');
    // gunakan logArea yang sudah ada di atas
    // Simpan log asli setiap kali fetchLog dipanggil
    const originalFetchLog = fetchLog;
    fetchLog = async function () {
        await originalFetchLog();
        originalLogContent = logArea.textContent;
        filterLogArea();
    };

    function filterLogArea() {
        if (!logSearchInput || !logArea) return;
        const query = logSearchInput.value.trim().toLowerCase();
        if (!query) {
            logArea.textContent = originalLogContent;
            return;
        }
        // Filter baris log yang mengandung query
        const lines = originalLogContent.split('\n');
        const filtered = lines.filter(line => line.toLowerCase().includes(query));
        logArea.textContent = filtered.join('\n');
    }

    if (logSearchInput) {
        logSearchInput.addEventListener('input', filterLogArea);
    }

    // Konfirmasi sebelum reload jika ada draft controller
    window.addEventListener('beforeunload', function (e) {
        let hasDraft = false;
        Object.keys(localStorage).forEach(function (key) {
            if (key.startsWith('controllerDraft_') || key.startsWith('hookDraft_') || key === 'helperDraft') {
                hasDraft = true;
            }
        });
        if (hasDraft) {
            const confirmationMessage = 'Ada draft codingan (Controller/Hook/Helper) yang belum disimpan. Yakin ingin reload/keluar? Draft akan hilang.';
            e.preventDefault();
            e.returnValue = confirmationMessage;
            return confirmationMessage;
        }
    });

    // Tambahkan loading overlay ke body
    (function addGlobalLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'global-loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(255,255,255,0.6)';
        overlay.style.zIndex = 99999;
        overlay.style.display = 'none';
        overlay.innerHTML = `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);">
        <svg class="animate-spin" width="40" height="40" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" stroke="#2563eb" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 31.4"/>
        </svg>
        <div style="margin-top:8px;text-align:center;color:#2563eb;font-size:13px;font-weight:500;">Loading...</div>
      </div>
    `;
        document.body.appendChild(overlay);
    })();

    let loadingStartTime = 0;
    let loadingTimeout = null;
    const MIN_LOADING_TIME = 500; // ms

    function showLoading() {
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) {
            overlay.style.display = 'block';
            loadingStartTime = Date.now();
            if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                loadingTimeout = null;
            }
        }
    }
    function hideLoading() {
        const overlay = document.getElementById('global-loading-overlay');
        if (!overlay) return;
        const elapsed = Date.now() - loadingStartTime;
        if (elapsed < MIN_LOADING_TIME) {
            // Tunda hide sampai waktu minimal tercapai
            loadingTimeout = setTimeout(() => {
                overlay.style.display = 'none';
                loadingTimeout = null;
            }, MIN_LOADING_TIME - elapsed);
        } else {
            overlay.style.display = 'none';
        }
    }

    // Tab Log
    const logTab = document.getElementById('logTab');
    const logContent = document.getElementById('logContent');
    const logArea = document.getElementById('logArea');
    const refreshLog = document.getElementById('refreshLog');

    logTab.addEventListener('click', () => {
        wireframeTab.classList.remove('tab-active');
        customFunctionTab.classList.remove('tab-active');
        customHookTab.classList.remove('tab-active');
        if (helperTab) helperTab.classList.remove('tab-active');
        logTab.classList.add('tab-active');
        wireframeContent.classList.add('hidden');
        editorContent.classList.add('hidden');
        hookEditorContent.classList.add('hidden');
        if (helperEditorContent) helperEditorContent.classList.add('hidden');
        logContent.classList.remove('hidden');
        fetchLog();
        ensureResetLogButton();
    });

    if (refreshLog) {
        refreshLog.addEventListener('click', fetchLog);
    }

    function showWelcomeAzzuratorLog() {
        logArea.innerHTML = `\
<span style=\"color:#22d3ee;font-weight:bold;\">┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓</span>\n\
<span style=\"color:#22d3ee;font-weight:bold;\">┃</span> <span style=\"color:#2563eb;font-weight:bold;\">WELCOME TO</span> <span style=\"color:#22d3ee;font-weight:bold;\">AZZURATOR</span> <span style=\"color:#22d3ee;font-weight:bold;\">┃</span>\n\
<span style=\"color:#22d3ee;font-weight:bold;\">┃</span> <span style=\"color:#64748b;\">No activity log yet. All your CLI logs will appear here.</span> <span style=\"color:#22d3ee;font-weight:bold;\">┃</span>\n\
<span style=\"color:#22d3ee;font-weight:bold;\">┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛</span>`;
    }

    // Reset log button: pastikan hanya dibuat sekali dan selalu di pojok kanan
    function ensureResetLogButton() {
        // Hanya buat jika belum ada
        if (document.getElementById('resetLog')) return;
        const resetLogBtn = document.createElement('button');
        resetLogBtn.id = 'resetLog';
        resetLogBtn.className = 'inline-flex items-center px-3 py-1.5 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors';
        resetLogBtn.innerHTML = `
          <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Reset Log`;
        // Cari container tombol di header log
        const logHeader = logContent.querySelector('.flex.items-center.gap-2, .flex.items-center.gap-2.ml-auto');
        if (logHeader) logHeader.appendChild(resetLogBtn);
        resetLogBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to reset the log?')) return;
            resetLogBtn.disabled = true;
            resetLogBtn.textContent = 'Resetting...';
            try {
                const res = await fetch('/api/logs/reset', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showWelcomeAzzuratorLog();
                    alert('Log has been reset.');
                } else {
                    alert('Failed to reset log.');
                }
            } catch (e) {
                alert('Error resetting log.');
            } finally {
                resetLogBtn.disabled = false;
                resetLogBtn.innerHTML = `
                  <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reset Log`;
            }
        });
    }

    async function fetchLog() {
        logArea.textContent = 'Loading...';
        try {
            const res = await fetch('/api/logs/activity');
            const data = await res.json();
            if (data.success) {
                if (!data.log || data.log.trim() === '') {
                    showWelcomeAzzuratorLog();
                } else {
                    logArea.textContent = data.log;
                }
            } else {
                logArea.textContent = 'Failed to load log';
            }
        } catch (e) {
            logArea.textContent = 'Error loading log';
        }
    }

    // Keyboard shortcut: Ctrl+Enter untuk Sync
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const syncBtn = document.getElementById('syncModel');
            if (syncBtn && !syncBtn.disabled) {
                syncBtn.click();
                e.preventDefault();
            }
        }
        // Shortcut SyncDB: Shift+Enter
        if (e.shiftKey && e.key === 'Enter') {
            const syncDBBtn = document.getElementById('syncDB');
            if (syncDBBtn && !syncDBBtn.disabled) {
                syncDBBtn.click();
                e.preventDefault();
            }
        }
    });

    // Keyboard shortcut: Ctrl+F untuk fokus ke search bar
    // document.addEventListener('keydown', function (e) {
    //     if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    //         const searchInput = document.getElementById('searchTableInput');
    //         if (searchInput) {
    //             searchInput.focus();
    //             searchInput.select();
    //             e.preventDefault();
    //         }
    //     }
    // });

    // Shortcut Ctrl+S untuk save editor aktif
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            const editorContent = document.getElementById('editorContent');
            const hookEditorContent = document.getElementById('hookEditorContent');
            const helperEditorContent = document.getElementById('helperEditorContent');
            if (editorContent && !editorContent.classList.contains('hidden')) {
                document.getElementById('saveController').click();
                e.preventDefault();
            } else if (hookEditorContent && !hookEditorContent.classList.contains('hidden')) {
                document.getElementById('saveHook').click();
                e.preventDefault();
            } else if (helperEditorContent && !helperEditorContent.classList.contains('hidden')) {
                document.getElementById('saveHelper').click();
                e.preventDefault();
            }
        }
    });

    // Add save helper event listener
    if (document.getElementById('saveHelper')) {
        document.getElementById('saveHelper').addEventListener('click', async () => {
            if (!helperEditor || !helperEditorInitialized) return;
            try {
                const code = helperEditor.getValue();
                const response = await fetch('/api/wireframe/helper', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                const result = await response.json();
                if (result.success) {
                    removeHelperDraft();
                    showSuccessNotification('Helper functions saved successfully!');
                    const saveButton = document.getElementById('saveHelper');
                    const originalText = saveButton.innerHTML;
                    saveButton.innerHTML = `
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Saved!`;
                    saveButton.classList.remove('bg-green-50', 'text-green-600', 'hover:bg-green-100');
                    saveButton.classList.add('bg-indigo-50', 'text-indigo-600');
                    setTimeout(() => {
                        saveButton.innerHTML = originalText;
                        saveButton.classList.remove('bg-indigo-50', 'text-indigo-600');
                        saveButton.classList.add('bg-green-50', 'text-green-600', 'hover:bg-green-100');
                    }, 2000);
                } else {
                    showErrorNotification(result.message || 'Failed to save helper');
                }
            } catch (error) {
                showErrorNotification('Error saving helper: ' + error.message);
            }
        });
    }

    // Event listener untuk tombol SyncDB
    if (document.getElementById('syncDB')) {
        document.getElementById('syncDB').addEventListener('click', async () => {
            const syncDBButton = document.getElementById('syncDB');
            const originalButtonHTML = syncDBButton.innerHTML;
            syncDBButton.innerHTML = `<svg class="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg> Syncing...`;
            syncDBButton.disabled = true;
            showLoading();
            try {
                const tableName = currentTable;
                const response = await fetch(`/api/migrate-model/${tableName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (response.ok) {
                    showSuccessNotification(`SyncDB berhasil untuk model: ${tableName}`);
                } else {
                    const errorText = await response.text();
                    showErrorNotification(`SyncDB gagal: ${errorText}`);
                }
            } catch (err) {
                showErrorNotification('SyncDB error: ' + err.message);
            } finally {
                syncDBButton.innerHTML = originalButtonHTML;
                syncDBButton.disabled = false;
                hideLoading();
            }
        });
    }
});
