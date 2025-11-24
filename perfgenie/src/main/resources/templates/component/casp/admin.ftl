<style>
    /* Fix DataTable pagination overlap - use more aggressive spacing */
    #admin-podconfig-table_wrapper .dataTables_info {
        padding-top: 0.755em !important;
        padding-bottom: 0.755em !important;
        margin-right: 2em !important;
        float: left !important;
        clear: none !important;
        white-space: nowrap !important;
        min-width: 200px !important;
    }
    
    #admin-podconfig-table_wrapper .dataTables_paginate {
        padding-top: 0.755em !important;
        padding-bottom: 0.755em !important;
        float: right !important;
        text-align: right !important;
        clear: none !important;
        margin-left: 2em !important;
        min-width: 250px !important;
    }
    
    #admin-podconfig-table_wrapper .dataTables_length {
        float: left !important;
        padding-top: 0.755em !important;
        padding-bottom: 0.755em !important;
    }
    
    #admin-podconfig-table_wrapper .dataTables_filter {
        float: right !important;
        padding-top: 0.755em !important;
        padding-bottom: 0.755em !important;
    }
    
    /* Ensure bottom row has proper width and spacing */
    #admin-podconfig-table_wrapper .row {
        width: 100% !important;
        margin: 0 !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
    }
    
    #admin-podconfig-table_wrapper .row.bottom {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        flex-wrap: nowrap !important;
        gap: 2em !important;
        padding: 0.5em 0 !important;
        width: 100% !important;
        min-width: 600px !important;
    }
    
    /* Ensure proper spacing between info and pagination */
    #admin-podconfig-table_wrapper .dataTables_wrapper::after {
        content: "";
        display: table;
        clear: both;
    }
    
    /* Ensure wrapper has proper layout and width */
    #admin-podconfig-table_wrapper {
        overflow: visible !important;
        width: 100% !important;
    }
    
    /* Force bottom row to have enough space */
    #admin-podconfig-table_wrapper .dataTables_info,
    #admin-podconfig-table_wrapper .dataTables_paginate {
        box-sizing: border-box !important;
    }
    
    /* Ensure the bottom row container has full width */
    #admin-podconfig-table_wrapper .row.bottom {
        width: 100% !important;
        min-width: 600px !important;
    }
    
    /* Prevent text wrapping in info */
    #admin-podconfig-table_wrapper .dataTables_info {
        flex-shrink: 0 !important;
    }
    
    /* Prevent pagination from shrinking */
    #admin-podconfig-table_wrapper .dataTables_paginate {
        flex-shrink: 0 !important;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
        #admin-podconfig-table_wrapper .dataTables_info,
        #admin-podconfig-table_wrapper .dataTables_paginate {
            float: none !important;
            text-align: center !important;
            margin: 0.5em 0 !important;
            width: 100% !important;
        }
    }
    
    /* Editable cell styles */
    .editable-cell {
        padding: 4px !important;
    }
    
    .editable-cell input,
    .editable-cell select {
        width: 100%;
        padding: 4px 6px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
    }
    
    .editable-cell input:focus,
    .editable-cell select:focus {
        outline: none;
        border-color: #46a5e3;
        box-shadow: 0 0 0 2px rgba(70, 165, 227, 0.2);
    }
    
    .editable-cell input[type="checkbox"] {
        width: auto;
        margin: 0 auto;
        display: block;
    }
    
    /* Submit button container */
    #admin-submit-container {
        margin-top: 16px;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 4px;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
    }
    
    #admin-submit-message {
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        display: none;
    }
    
    #admin-submit-message.success {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    
    #admin-submit-message.error {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    
    .modern-button-gray {
        background-color: #6c757d;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
    }
    
    .modern-button-gray:hover {
        background-color: #5a6268;
    }
    
    .modern-button-gray:active {
        background-color: #545b62;
    }
    
    /* New row highlight */
    .new-row {
        background-color: #fff3cd !important;
    }
    
    .new-row td {
        border-top: 2px solid #ffc107 !important;
    }
</style>

<div id="admin-content" style="padding: 16px;">
    <label style="font-size: 14px; font-weight: 500; color: #666; margin-bottom: 12px; display: block;">Canary processing scheduled tasks (Type - SideBySide:2 WeekOverWeek:1)</label>
    <div id="admin-loading" style="text-align: center; padding: 20px;">
        <i class="fa fa-spinner fa-spin" style="font-size: 24px;"></i>
        <p>Loading configuration...</p>
    </div>
    <div id="admin-table-container" style="display: none; width: 100%; overflow-x: auto;">
        <div style="width: 100%; min-width: 600px;">
            <table id="admin-podconfig-table" class="display" style="width:100%">
                <thead>
                    <tr>
                        <th>Cell</th>
                        <th>Enabled</th>
                        <th>Type</th>
                        <th>End Hour</th>
                        <th>Duration (hrs)</th>
                    </tr>
                </thead>
                <tbody id="admin-table-body">
                    <!-- Data will be populated by JavaScript -->
                </tbody>
            </table>
        </div>
        <div id="admin-submit-container">
            <div id="admin-submit-message"></div>
            <button id="admin-add-row-btn" class="modern-button modern-button-green" onclick="addNewRow()" style="margin-right: 8px;">
                <i class="fa fa-plus"></i> Add Row
            </button>
            <button id="admin-download-btn" class="modern-button modern-button-gray" onclick="downloadPodConfig()" style="margin-right: 8px;">
                <i class="fa fa-download"></i> Download JSON
            </button>
            <button id="admin-submit-btn" class="modern-button modern-button-blue" onclick="submitPodConfig()">
                Save Changes
            </button>
        </div>
    </div>
    <div id="admin-error" style="display: none; color: red; padding: 20px;">
        <p>Error loading configuration. Please try again later.</p>
    </div>
</div>

<script>
    // Store original config to preserve unchanged rows when saving
    var originalPodConfig = null;
    
    // Check if user has permission to save (user=rpulle in URL)
    function hasSavePermission() {
        if (typeof window.urlParams !== 'undefined' && window.urlParams) {
            const user = window.urlParams.get('user');
            return user === 'rpulle';
        }
        // Fallback: check URL directly
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('user') === 'rpulle';
    }
    
    // Update save button state based on permission
    function updateSaveButtonState() {
        const saveBtn = $('#admin-submit-btn');
        if (hasSavePermission()) {
            saveBtn.prop('disabled', false);
            saveBtn.attr('title', '');
        } else {
            saveBtn.prop('disabled', true);
            saveBtn.attr('title', 'Save permission required: user=rpulle');
            saveBtn.css('opacity', '0.6');
            saveBtn.css('cursor', 'not-allowed');
        }
    }
    
    // Define loadAdminData in global scope
    function loadAdminData() {
        $('#admin-loading').show();
        $('#admin-table-container').hide();
        $('#admin-error').hide();
        
        $.ajax({
            url: '/v1/podconfig',
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                $('#admin-loading').hide();
                
                if (data && data.config) {
                    // Store original config for merging on save
                    originalPodConfig = JSON.parse(JSON.stringify(data.config));
                    
                    const tbody = $('#admin-table-body');
                    tbody.empty();
                    
                    // Sort by cell name
                    const cells = Object.keys(data.config).sort();
                    
                    cells.forEach(function(cell) {
                        const cellConfig = data.config[cell];
                        const enabled = cellConfig.enabled !== undefined ? cellConfig.enabled : false;
                        const type = cellConfig.type !== undefined ? cellConfig.type : '';
                        const peak = cellConfig.peak || [];
                        const endHour = peak.length > 0 ? peak[0] : '';
                        const durationHrs = peak.length > 1 ? peak[1] : '';
                        
                        const row = $('<tr>').attr('data-cell', cell);
                        
                        // Cell name (read-only)
                        row.append($('<td>').text(cell));
                        
                        // Enabled (checkbox)
                        const enabledCell = $('<td>').addClass('editable-cell text-center');
                        const enabledCheckbox = $('<input>').attr({
                            type: 'checkbox',
                            'data-field': 'enabled'
                        }).prop('checked', enabled);
                        enabledCell.append(enabledCheckbox);
                        row.append(enabledCell);
                        
                        // Type (number input)
                        const typeCell = $('<td>').addClass('editable-cell text-center');
                        const typeInput = $('<input>').attr({
                            type: 'number',
                            'data-field': 'type',
                            value: type,
                            min: '0'
                        });
                        typeCell.append(typeInput);
                        row.append(typeCell);
                        
                        // End Hour (number input)
                        const endHourCell = $('<td>').addClass('editable-cell text-center');
                        const endHourInput = $('<input>').attr({
                            type: 'number',
                            'data-field': 'endHour',
                            value: endHour,
                            min: '0',
                            max: '23'
                        });
                        endHourCell.append(endHourInput);
                        row.append(endHourCell);
                        
                        // Duration (hrs) (number input)
                        const durationCell = $('<td>').addClass('editable-cell text-center');
                        const durationInput = $('<input>').attr({
                            type: 'number',
                            'data-field': 'durationHrs',
                            value: durationHrs,
                            min: '0'
                        });
                        durationCell.append(durationInput);
                        row.append(durationCell);
                        
                        tbody.append(row);
                    });
                    
                    // Destroy existing DataTable if it exists
                    if ($.fn.DataTable.isDataTable('#admin-podconfig-table')) {
                        $('#admin-podconfig-table').DataTable().destroy();
                    }
                    
                    // Initialize DataTable with custom layout to prevent overlap
                    $('#admin-podconfig-table').DataTable({
                        pageLength: 25,
                        order: [[0, 'asc']],
                        columnDefs: [
                            { targets: [1, 2, 3, 4], className: 'text-center' }
                        ],
                        dom: '<"top"lf>rt<"bottom"ip><"clear">',
                        language: {
                            info: "Showing _START_ to _END_ of _TOTAL_ entries",
                            infoEmpty: "Showing 0 to 0 of 0 entries",
                            infoFiltered: "(filtered from _MAX_ total entries)"
                        },
                        drawCallback: function() {
                            // Ensure proper spacing after each draw
                            const info = $('#admin-podconfig-table_wrapper .dataTables_info');
                            const paginate = $('#admin-podconfig-table_wrapper .dataTables_paginate');
                            if (info.length && paginate.length) {
                                const infoWidth = info.outerWidth();
                                const paginateWidth = paginate.outerWidth();
                                const wrapperWidth = $('#admin-podconfig-table_wrapper').width();
                                if (infoWidth + paginateWidth + 100 > wrapperWidth) {
                                    info.css('margin-right', '2em');
                                    paginate.css('margin-left', '2em');
                                }
                            }
                        }
                    });
                    
                    $('#admin-table-container').show();
                } else {
                    $('#admin-error').show();
                }
            },
            error: function(xhr, status, error) {
                console.error('Error loading PodConfig:', error);
                $('#admin-loading').hide();
                $('#admin-error').show();
            }
        });
    }
    
    $(document).ready(function() {
        // Initialize save button state based on permission
        updateSaveButtonState();
        
        // Load data when admin tab becomes active
        // Use MutationObserver to detect when admin tab is shown
        const adminPanel = document.getElementById('admin');
        if (adminPanel) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const isActive = adminPanel.classList.contains('active');
                        if (isActive && $('#admin-table-body').children().length === 0) {
                            loadAdminData();
                        }
                    }
                });
            });
            
            observer.observe(adminPanel, {
                attributes: true,
                attributeFilter: ['class']
            });
            
            // Also check on initial load if admin tab is already active
            if (adminPanel.classList.contains('active')) {
                loadAdminData();
            }
        }
    });
    
    // Function to add a new row to the table
    function addNewRow() {
        const table = $('#admin-podconfig-table').DataTable();
        if (!table) {
            alert('Table not initialized. Please wait for the table to load.');
            return;
        }
        
        // Generate a unique cell name (use timestamp or prompt user)
        const cellName = prompt('Enter cell name:', '');
        if (!cellName || cellName.trim() === '') {
            return; // User cancelled or entered empty name
        }
        
        // Check if cell already exists
        const existingRow = $('#admin-table-body tr[data-cell="' + cellName + '"]');
        if (existingRow.length > 0) {
            alert('Cell "' + cellName + '" already exists. Please choose a different name.');
            return;
        }
        
        // Create new row
        const row = $('<tr>').attr('data-cell', cellName).addClass('new-row');
        
        // Cell name (read-only)
        row.append($('<td>').text(cellName));
        
        // Enabled (checkbox)
        const enabledCell = $('<td>').addClass('editable-cell text-center');
        const enabledCheckbox = $('<input>').attr({
            type: 'checkbox',
            'data-field': 'enabled'
        }).prop('checked', true); // Default to enabled
        enabledCell.append(enabledCheckbox);
        row.append(enabledCell);
        
        // Type (number input)
        const typeCell = $('<td>').addClass('editable-cell text-center');
        const typeInput = $('<input>').attr({
            type: 'number',
            'data-field': 'type',
            value: '1',
            min: '0'
        });
        typeCell.append(typeInput);
        row.append(typeCell);
        
        // End Hour (number input)
        const endHourCell = $('<td>').addClass('editable-cell text-center');
        const endHourInput = $('<input>').attr({
            type: 'number',
            'data-field': 'endHour',
            value: '0',
            min: '0',
            max: '23'
        });
        endHourCell.append(endHourInput);
        row.append(endHourCell);
        
        // Duration (hrs) (number input)
        const durationCell = $('<td>').addClass('editable-cell text-center');
        const durationInput = $('<input>').attr({
            type: 'number',
            'data-field': 'durationHrs',
            value: '0',
            min: '0'
        });
        durationCell.append(durationInput);
        row.append(durationCell);
        
        // Add row to table
        table.row.add(row).draw();
        
        // Scroll to the new row and highlight it
        const rowNode = row[0];
        if (rowNode) {
            rowNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Remove highlight after 3 seconds
            setTimeout(function() {
                row.removeClass('new-row');
            }, 3000);
        }
        
        // Update original config to include the new row
        if (originalPodConfig) {
            originalPodConfig[cellName] = {
                enabled: true,
                type: 1,
                peak: [0, 0]
            };
        }
    }
    
    // Function to submit PodConfig changes
    function submitPodConfig() {
        // Check permission before allowing save
        if (!hasSavePermission()) {
            alert('Save permission required. Please add user=rpulle to the URL.');
            return;
        }
        
        const submitBtn = $('#admin-submit-btn');
        const messageDiv = $('#admin-submit-message');
        
        // Disable button and show loading
        submitBtn.prop('disabled', true).text('Saving...');
        messageDiv.hide().removeClass('success error');
        
        if (!originalPodConfig) {
            messageDiv.text('Error: Original configuration not loaded. Please refresh the page.').addClass('error').show();
            submitBtn.prop('disabled', false).text('Save Changes');
            updateSaveButtonState(); // Restore permission-based state
            return;
        }
        
        // Start with a deep copy of original config to preserve all rows
        const config = JSON.parse(JSON.stringify(originalPodConfig));
        
        // Create a map of all row data from the table for quick lookup
        // Use DataTables API to get ALL rows (including filtered/hidden ones)
        const rowDataMap = {};
        const table = $('#admin-podconfig-table').DataTable();
        
        if (table) {
            // Use DataTables API with search: 'none' to get ALL rows regardless of filtering
            table.rows({ search: 'none' }).every(function() {
                const rowNode = this.node();
                const $row = $(rowNode);
                const cell = $row.attr('data-cell');
                if (!cell) return true; // Continue to next row
                
                const enabled = $row.find('input[data-field="enabled"]').is(':checked');
                const type = parseInt($row.find('input[data-field="type"]').val()) || 0;
                const endHour = parseInt($row.find('input[data-field="endHour"]').val()) || 0;
                const durationHrs = parseInt($row.find('input[data-field="durationHrs"]').val()) || 0;
                
                rowDataMap[cell] = {
                    enabled: enabled,
                    type: type,
                    peak: [endHour, durationHrs]
                };
            });
        } else {
            // Fallback: get all rows directly from tbody
            $('#admin-table-body tr').each(function() {
                const cell = $(this).attr('data-cell');
                if (!cell) return;
                
                const enabled = $(this).find('input[data-field="enabled"]').is(':checked');
                const type = parseInt($(this).find('input[data-field="type"]').val()) || 0;
                const endHour = parseInt($(this).find('input[data-field="endHour"]').val()) || 0;
                const durationHrs = parseInt($(this).find('input[data-field="durationHrs"]').val()) || 0;
                
                rowDataMap[cell] = {
                    enabled: enabled,
                    type: type,
                    peak: [endHour, durationHrs]
                };
            });
        }
        
        // Update config: merge edited values from table with original config
        // This ensures all original cells are preserved, and only edited ones are updated
        Object.keys(config).forEach(function(cell) {
            if (rowDataMap.hasOwnProperty(cell)) {
                // This cell was in the table, use the edited value
                config[cell] = rowDataMap[cell];
            }
            // If cell is not in rowDataMap, keep original value (already in config)
        });
        
        // Also add any new cells that might have been added (shouldn't happen, but just in case)
        Object.keys(rowDataMap).forEach(function(cell) {
            if (!config.hasOwnProperty(cell)) {
                config[cell] = rowDataMap[cell];
            }
        });
        
        // Send update request
        $.ajax({
            url: '/v1/podconfig',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ config: config }),
            success: function(response) {
                submitBtn.text('Save Changes');
                messageDiv.text('Configuration saved successfully!').addClass('success').show();
                updateSaveButtonState(); // Restore permission-based state
                
                // Hide message after 3 seconds
                setTimeout(function() {
                    messageDiv.fadeOut();
                }, 3000);
            },
            error: function(xhr, status, error) {
                console.error('Error saving PodConfig:', error);
                submitBtn.text('Save Changes');
                updateSaveButtonState(); // Restore permission-based state
                const errorMsg = xhr.responseJSON && xhr.responseJSON.error 
                    ? xhr.responseJSON.error 
                    : 'Failed to save configuration. Please try again.';
                messageDiv.text(errorMsg).addClass('error').show();
            }
        });
    }
    
    // Function to download PodConfig as JSON file
    function downloadPodConfig() {
        if (!originalPodConfig) {
            alert('No configuration data available to download. Please wait for the data to load.');
            return;
        }
        
        // Create a deep copy of the current config (including any edits)
        const config = JSON.parse(JSON.stringify(originalPodConfig));
        
        // Collect all data from ALL rows in the table (including filtered/hidden ones)
        const rowDataMap = {};
        const table = $('#admin-podconfig-table').DataTable();
        
        if (table) {
            // Use DataTables API with search: 'none' to get ALL rows regardless of filtering
            table.rows({ search: 'none' }).every(function() {
                const rowNode = this.node();
                const $row = $(rowNode);
                const cell = $row.attr('data-cell');
                if (!cell) return true; // Continue to next row
                
                const enabled = $row.find('input[data-field="enabled"]').is(':checked');
                const type = parseInt($row.find('input[data-field="type"]').val()) || 0;
                const endHour = parseInt($row.find('input[data-field="endHour"]').val()) || 0;
                const durationHrs = parseInt($row.find('input[data-field="durationHrs"]').val()) || 0;
                
                rowDataMap[cell] = {
                    enabled: enabled,
                    type: type,
                    peak: [endHour, durationHrs]
                };
            });
        } else {
            // Fallback: get all rows directly from tbody
            $('#admin-table-body tr').each(function() {
                const cell = $(this).attr('data-cell');
                if (!cell) return;
                
                const enabled = $(this).find('input[data-field="enabled"]').is(':checked');
                const type = parseInt($(this).find('input[data-field="type"]').val()) || 0;
                const endHour = parseInt($(this).find('input[data-field="endHour"]').val()) || 0;
                const durationHrs = parseInt($(this).find('input[data-field="durationHrs"]').val()) || 0;
                
                rowDataMap[cell] = {
                    enabled: enabled,
                    type: type,
                    peak: [endHour, durationHrs]
                };
            });
        }
        
        // Update config: merge edited values from table with original config
        Object.keys(config).forEach(function(cell) {
            if (rowDataMap.hasOwnProperty(cell)) {
                config[cell] = rowDataMap[cell];
            }
        });
        
        // Also add any new cells that might have been added
        Object.keys(rowDataMap).forEach(function(cell) {
            if (!config.hasOwnProperty(cell)) {
                config[cell] = rowDataMap[cell];
            }
        });
        
        // Create the JSON structure matching PodConfig format
        const podConfigJson = {
            config: config
        };
        
        // Convert to JSON string with pretty formatting
        const jsonString = JSON.stringify(podConfigJson, null, 2);
        
        // Create a data URI and download (more compatible approach)
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonString);
        const link = document.createElement('a');
        link.href = dataUri;
        link.download = 'podconfig.json';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
</script>

