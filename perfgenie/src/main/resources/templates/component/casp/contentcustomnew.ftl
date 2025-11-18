<style>
    /* Ensure input fields maintain their color after datetimepicker selection or autocomplete */
    #startpicker3.filterinput,
    #endpicker3.filterinput,
    #cell-input1.filterinput,
    #startpicker3.filterinput.hasDatepicker,
    #endpicker3.filterinput.hasDatepicker,
    #cell-input1.filterinput.hasDatepicker {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #343a40 !important;
    }
    
    #startpicker3.filterinput:focus,
    #endpicker3.filterinput:focus,
    #cell-input1.filterinput:focus,
    #startpicker3.filterinput.hasDatepicker:focus,
    #endpicker3.filterinput.hasDatepicker:focus,
    #cell-input1.filterinput.hasDatepicker:focus {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #343a40 !important;
    }
    
    /* Override browser autocomplete background color */
    #startpicker3.filterinput:-webkit-autofill,
    #endpicker3.filterinput:-webkit-autofill,
    #cell-input1.filterinput:-webkit-autofill,
    #startpicker3.filterinput:-webkit-autofill:hover,
    #endpicker3.filterinput:-webkit-autofill:hover,
    #cell-input1.filterinput:-webkit-autofill:hover,
    #startpicker3.filterinput:-webkit-autofill:focus,
    #endpicker3.filterinput:-webkit-autofill:focus,
    #cell-input1.filterinput:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 30px #ffffff inset !important;
        -webkit-text-fill-color: #343a40 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #343a40 !important;
    }
    
    /* Canary Input Info - toast-style yellow warning with glassmorphism (matching input.ftl) */
    #canary-input-info {
        padding: 0 !important; /* No padding to minimize height */
        color: #ffffff !important; /* White text for toast style */
        /* Don't set display here - let inline style and jQuery control it */
        /* Toast-style glassmorphism with darker yellow warning tint for better text visibility */
        background: rgba(255, 183, 77, 0.35) !important; /* Darker yellow/orange warning tint */
        background-image: 
            linear-gradient(135deg, rgba(255, 183, 77, 0.45) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 183, 77, 0.45) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
        backdrop-filter: blur(20px) saturate(180%) !important;
        -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
        /* Toast-style border */
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        border-radius: 8px !important; /* Toast-style rounded corners */
        /* Toast-style shadows */
        box-shadow: 
            0 4px 16px rgba(255, 183, 77, 0.3),
            0 2px 8px rgba(255, 183, 77, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.5),
            inset 0 -1px 0 rgba(0, 0, 0, 0.08),
            0 8px 32px rgba(255, 152, 0, 0.18) !important;
        /* Toast-style text shadow for white text on yellow background */
        text-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.4),
            0 0 8px rgba(255, 183, 77, 0.6),
            0 2px 4px rgba(0, 0, 0, 0.3) !important;
        font-weight: 500 !important;
        font-size: 0.85em !important; /* Smaller font */
        margin: 0 !important;
        float: left !important;
        line-height: 1.1 !important; /* Very tight line height */
        /* Don't set display or transition - let jQuery slide animation handle it */
    }
    
    /* Ensure jQuery UI classes don't override our toast styling */
    #canary-input-info.ui-state-highlight,
    #canary-input-info.ui-widget-header {
        background: rgba(255, 183, 77, 0.35) !important;
        background-image: 
            linear-gradient(135deg, rgba(255, 183, 77, 0.45) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 183, 77, 0.45) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        color: #ffffff !important;
        padding: 0 !important;
    }
    
    /* No padding on inner content to minimize height */
    #canary-input-info-text {
        padding: 0 !important;
        display: inline-block !important;
    }
    
    /* Icon styling - no padding */
    #canary-input-info .ui-icon {
        display: inline-block;
        margin-right: 4px;
        vertical-align: middle;
        padding: 0 !important;
        margin: 0 4px 0 0 !important;
    }
</style>

<div class='ui-widget'>
    <!-- Single grid container for both rows to ensure column alignment -->
    <div style="display: grid; grid-template-columns: max-content max-content max-content max-content max-content max-content max-content; align-items: start; column-gap: 8px; row-gap: 0px;">
        <!-- Column 1: Time range UTC from -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label class="fieldlable" style="white-space: nowrap;">Time range UTC from:</label>
            <input style="height:30px;text-align: center; width: 160px; max-width: 160px; box-sizing: border-box;" class="filterinput" id="startpicker3" type="text">
        </div>
        
        <!-- Column 2: to -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label class="fieldlable" style="white-space: nowrap;">to:</label>
            <input style="height:30px;text-align: center; width: 160px; max-width: 160px; box-sizing: border-box;" class="filterinput" id="endpicker3" type="text">
        </div>
        
        <!-- Column 3: Cell -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label for="cell-input1" id="cell-label1" class="fieldlable" style="white-space: nowrap;">Cell:</label>
            <input style="height:30px;text-align: center; width: 60px; max-width: 60px; box-sizing: border-box;" class="filterinput" id="cell-input1" name="cell1" type="text" value=""/>
        </div>
        
        <!-- Column 4: Scope -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label for="scope-input1" id="scope-label1" class="fieldlable" style="white-space: nowrap;">Scope:</label>
            <select style="height:30px;text-align: center; width: 300px; max-width: 300px; box-sizing: border-box;" class="filterinput" id="scope-input1" name="scope1">
                <option value="">-- Select Scope --</option>
            </select>
        </div>
        
        <!-- Column 5: Base KPods -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label for="basekpods-input" id="basekpods-label" class="fieldlable" style="white-space: nowrap;" title="coma separated kpod list">Base KPods:</label>
            <input style="height:30px;text-align: center; width: 180px; max-width: 180px; box-sizing: border-box;" class="filterinput" id="basekpods-input" name="basekpods" type="text" value="*" title="coma separated kpod list">
        </div>
        
        <!-- Column 6: Canary KPods -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label for="canarykpods-input" id="canarykpods-label" class="fieldlable" style="white-space: nowrap;" title="coma separated kpod list">Canary KPods:</label>
            <input style="height:30px;text-align: center; width: 180px; max-width: 180px; box-sizing: border-box;" class="filterinput" id="canarykpods-input" name="canarykpods" type="text" value="*" title="coma separated kpod list">
        </div>
        
        <!-- Column 7: Process button -->
        <div style="display: flex; flex-direction: column; gap: 0px; width: fit-content;">
            <label class="fieldlable" style="white-space: nowrap; color: transparent; visibility: hidden; height: auto;">Process:</label>
            <button onclick="processCanary()" id="submit-canary-input" class="modern-button modern-button-green" disabled>Process</button>
        </div>
    </div>
</div>

<div id="canary-input-info" class="ui-state-highlight ui-widget-header ui-corner-all"
     style="float: left !important;display:none">
    <span class="ui-icon ui-icon-info"></span> <span id="canary-input-info-text"></span>
</div>
<div id="spinnerzingcustom" class="spinner"></div>
<div style="padding:0px !important; overflow: scroll;font-size: 95%" class="col-lg-12">
    <div id="canarycustomview"></div>
</div>


<script type="text/javascript" class="init">

    // Track previous validation state to prevent duplicate toasts
    var lastValidationState = {
        isValid: false,
        errorMessage: null
    };
    
    // Debounce timer for validation
    var validationTimer = null;

    /**
     * Check if all required canary custom form fields are filled
     */
    function validateCanaryCustomForm() {
        const start = $("#startpicker3").val();
        const end = $("#endpicker3").val();
        const cell = $("#cell-input1").val();
        const scope = $("#scope-input1").val();
        
        // Check if required fields are filled
        const fieldsFilled = start && start.trim() !== '' && 
                       end && end.trim() !== '' && 
                            cell && cell.trim() !== '' &&
                            scope && scope.trim() !== '';
        
        let isValid = fieldsFilled;
        let errorMessage = null;
        
        // Check time range if both dates are filled (independent of other fields)
        if (start && end && start.trim() !== '' && end.trim() !== '') {
            try {
                const startMoment = moment.utc(start);
                const endMoment = moment.utc(end);
                
                if (startMoment.isValid() && endMoment.isValid()) {
                    const duration = endMoment.valueOf() - startMoment.valueOf();
                    const oneHourInMs = 60 * 60 * 1000;
                    const twelveHoursInMs = 12 * 60 * 60 * 1000;
                    
                    if (duration <= 0) {
                        isValid = false;
                        errorMessage = "End time must be after start time";
                    } else if (duration < oneHourInMs) {
                        isValid = false;
                        const durationMinutes = (duration / (60 * 1000)).toFixed(0);
                        errorMessage = "Time range must be at least 1 hour. Current range: " + durationMinutes + " minutes";
                    } else if (duration > twelveHoursInMs) {
                        isValid = false;
                        const durationHours = (duration / (60 * 60 * 1000)).toFixed(2);
                        errorMessage = "Time range exceeds 12 hours. Current range: " + durationHours + " hours";
                    }
                }
            } catch (e) {
                // If date parsing fails, let the field validation handle it
                console.error("Error parsing dates:", e);
            }
        }
        
        // Only show toast if error state changed (transitioned from valid to invalid, or error message changed)
        if (!isValid && errorMessage && 
            (lastValidationState.isValid || lastValidationState.errorMessage !== errorMessage)) {
            toastMessage(toastType.ERROR, errorMessage);
        }
        
        // Update last validation state
        lastValidationState.isValid = isValid;
        lastValidationState.errorMessage = errorMessage;
        
        const submitButton = document.getElementById('submit-canary-input');
        if (submitButton) {
            submitButton.disabled = !isValid;
        }
        
        return isValid;
    }
    
    /**
     * Debounced validation function to prevent excessive calls
     */
    function debouncedValidateCanaryCustomForm() {
        if (validationTimer) {
            clearTimeout(validationTimer);
        }
        validationTimer = setTimeout(function() {
            validateCanaryCustomForm();
        }, 150); // 150ms debounce delay - shorter for more responsive validation
    }
    
    /**
     * Update scope dropdown status message
     */
    function updateScopeDropdownStatus(status) {
        const scopeSelect = $("#scope-input1");
        scopeSelect.empty();
        
        switch(status) {
            case 'fill_cell':
                scopeSelect.append('<option value="">Fill cell input</option>');
                break;
            case 'fetching':
                scopeSelect.append('<option value="">Fetching ...</option>');
                scopeSelect.prop('disabled', true);
                break;
            case 'failed':
                scopeSelect.append('<option value="">Failed</option>');
                scopeSelect.prop('disabled', false);
                break;
            case 'select_scope':
            default:
                scopeSelect.append('<option value="">Select scope</option>');
                scopeSelect.prop('disabled', false);
                break;
        }
    }
    
    /**
     * Fetch and populate scope dropdown based on cell value
     * Requires time range to be filled
     */
    function fetchScopes() {
        const start = $("#startpicker3").val();
        const end = $("#endpicker3").val();
        const cell = $("#cell-input1").val();
        const scopeSelect = $("#scope-input1");
        
        // Check if cell is empty
        if (!cell || cell.trim() === '') {
            updateScopeDropdownStatus('fill_cell');
            return;
        }
        
        // Check if time range is provided
        if (!start || !end || start.trim() === '' || end.trim() === '') {
            updateScopeDropdownStatus('fill_cell');
            toastMessage(toastType.ERROR, "Time range is required to fetch scope");
            return;
        }
        
        try {
            const startMoment = moment.utc(start);
            const endMoment = moment.utc(end);
            
            if (!startMoment.isValid() || !endMoment.isValid()) {
                updateScopeDropdownStatus('fill_cell');
                toastMessage(toastType.ERROR, "Invalid time range. Please provide valid start and end times");
                return;
            }
            
            const startTimestamp = startMoment.valueOf();
            const endTimestamp = endMoment.valueOf();
            
            // Show fetching status
            updateScopeDropdownStatus('fetching');
            
            // Build API URL - match the pattern used in processCustomCanaryData
            const hostPart = (typeof dataHost !== 'undefined' && dataHost) ? dataHost + "/" : "";
            const URL = "v1/getscope/" + hostPart + "?start=" + startTimestamp + "&end=" + endTimestamp + "&cell=" + encodeURIComponent(cell);
            
            $.ajax({
                url: URL,
                method: 'GET',
                success: function(result) {
                    try {
                        // Parse the result - it should be a JSON array of strings
                        let scopes = [];
                        if (typeof result === 'string') {
                            scopes = JSON.parse(result);
                        } else if (Array.isArray(result)) {
                            scopes = result;
                        } else {
                            console.error("Unexpected scope response format:", result);
                            updateScopeDropdownStatus('failed');
                            return;
                        }
                        
                        // Populate dropdown with scopes
                        updateScopeDropdownStatus('select_scope');
                        if (scopes && scopes.length > 0) {
                            scopes.forEach(function(scope) {
                                if (scope && scope.trim() !== '') {
                                    scopeSelect.append('<option value="' + scope + '">' + scope + '</option>');
                                }
                            });
                        }
                        
                        // Trigger validation after populating
                        validateCanaryCustomForm();
                    } catch (e) {
                        console.error("Error parsing scope response:", e);
                        updateScopeDropdownStatus('failed');
                    }
                },
                error: function(xhr, status, error) {
                    console.error("Failed to fetch scopes:", error);
                    updateScopeDropdownStatus('failed');
                    toastMessage(toastType.ERROR, "Failed to fetch scopes for cell: " + cell);
                }
            });
        } catch (e) {
            console.error("Error in fetchScopes:", e);
            updateScopeDropdownStatus('failed');
        }
    }
    
    /**
     * Debounced function to fetch scopes
     */
    var scopeFetchTimer = null;
    function debouncedFetchScopes() {
        if (scopeFetchTimer) {
            clearTimeout(scopeFetchTimer);
        }
        scopeFetchTimer = setTimeout(function() {
            fetchScopes();
        }, 300); // 300ms debounce for scope fetching
    }
    
    /**
     * Check if scope should be fetched when time range changes
     * Only fetches if cell is already filled and time range is valid
     */
    function checkAndFetchScopeOnTimeChange() {
        const start = $("#startpicker3").val();
        const end = $("#endpicker3").val();
        const cell = $("#cell-input1").val();
        
        // Only fetch if cell is filled and both times are provided
        if (cell && cell.trim() !== '' && start && end && start.trim() !== '' && end.trim() !== '') {
            try {
                const startMoment = moment.utc(start);
                const endMoment = moment.utc(end);
                
                // Only fetch if times are valid and range is valid (1-12 hours)
                if (startMoment.isValid() && endMoment.isValid()) {
                    const duration = endMoment.valueOf() - startMoment.valueOf();
                    const oneHourInMs = 60 * 60 * 1000;
                    const twelveHoursInMs = 12 * 60 * 60 * 1000;
                    
                    // Only fetch if time range is valid (between 1 and 12 hours)
                    if (duration > 0 && duration >= oneHourInMs && duration <= twelveHoursInMs) {
                        debouncedFetchScopes();
                    }
                }
            } catch (e) {
                // Ignore errors, validation will handle it
            }
        }
    }
    
    /**
     * Initialize canary custom form validation
     */
    function initCanaryCustomFormValidation() {
        // Disable button initially
        const submitButton = document.getElementById('submit-canary-input');
        if (submitButton) {
            submitButton.disabled = true;
        }
        
        // Check if fields are already filled and restore scope state accordingly
        const start = $("#startpicker3").val();
        const end = $("#endpicker3").val();
        const cell = $("#cell-input1").val();
        const scope = $("#scope-input1").val();
        const scopeSelect = $("#scope-input1");
        
        // Check if scope dropdown already has actual scope options (not just status messages)
        // Status messages have empty values, actual scopes have non-empty values
        const hasActualScopeOptions = scopeSelect.find('option[value!=""]').length > 0;
        
        // If scope already has a selected value and dropdown has actual scope options, preserve it (don't reset)
        if (scope && scope.trim() !== '' && hasActualScopeOptions) {
            // Scope is already selected and dropdown has actual scope options - keep it as is
            // Just ensure dropdown is enabled
            scopeSelect.prop('disabled', false);
        } else if (cell && cell.trim() !== '' && start && end && start.trim() !== '' && end.trim() !== '') {
            // Cell and time range are filled but scope is not selected or dropdown was reset - fetch scopes
            setTimeout(function() {
                checkAndFetchScopeOnTimeChange();
            }, 300);
        } else if (cell && cell.trim() !== '') {
            // Only cell is filled - show appropriate status
            updateScopeDropdownStatus('fill_cell');
        } else {
            // Nothing is filled - show fill cell status
            updateScopeDropdownStatus('fill_cell');
        }
        
        // Add event listeners to input fields - validate when any field changes
        const startPicker = $("#startpicker3");
        const endPicker = $("#endpicker3");
        const cellInput = $("#cell-input1");
        const scopeInput = $("#scope-input1");
        
        // For datetime pickers, listen to both dp.change and change events to catch all value changes
        if (startPicker.length) {
            startPicker.off('dp.change change'); // Remove any existing listeners to prevent duplicates
            startPicker.on('dp.change', function() {
                debouncedValidateCanaryCustomForm();
                // Check if we should fetch scope after time change (if cell is already filled)
                setTimeout(checkAndFetchScopeOnTimeChange, 200); // Small delay to ensure validation completes
            });
            startPicker.on('change', function() {
                debouncedValidateCanaryCustomForm();
                // Check if we should fetch scope after time change (if cell is already filled)
                setTimeout(checkAndFetchScopeOnTimeChange, 200); // Small delay to ensure validation completes
            });
        }
        if (endPicker.length) {
            endPicker.off('dp.change change'); // Remove any existing listeners to prevent duplicates
            endPicker.on('dp.change', function() {
                debouncedValidateCanaryCustomForm();
                // Check if we should fetch scope after time change (if cell is already filled)
                setTimeout(checkAndFetchScopeOnTimeChange, 200); // Small delay to ensure validation completes
            });
            endPicker.on('change', function() {
                debouncedValidateCanaryCustomForm();
                // Check if we should fetch scope after time change (if cell is already filled)
                setTimeout(checkAndFetchScopeOnTimeChange, 200); // Small delay to ensure validation completes
            });
        }
        // For text input, listen to both input and change events
        if (cellInput.length) {
            cellInput.off('input change'); // Remove any existing listeners to prevent duplicates
            cellInput.on('input', function() {
                debouncedValidateCanaryCustomForm();
                debouncedFetchScopes(); // Fetch scopes when cell changes
            });
            cellInput.on('change', function() {
                debouncedValidateCanaryCustomForm();
                debouncedFetchScopes(); // Fetch scopes when cell changes
            });
        }
        // For scope dropdown, listen to change events
        if (scopeInput.length) {
            scopeInput.off('change'); // Remove any existing listeners to prevent duplicates
            scopeInput.on('change', debouncedValidateCanaryCustomForm);
        }
        
        // Initial validation (call directly, no debounce needed)
        validateCanaryCustomForm();
    }
    
    // Initialize validation when document is ready
    // Also ensure button is disabled by default
    $(document).ready(function() {
        // Disable button immediately on page load
        const submitButton = document.getElementById('submit-canary-input');
        if (submitButton) {
            submitButton.disabled = true;
        }
        
        // Wait a bit for datetime pickers to be initialized
        setTimeout(function() {
            initCanaryCustomFormValidation();
        }, 200);
    });
    
    // Also initialize validation when tab becomes visible (for dynamically loaded content)
    // This ensures validation runs even if the tab content is loaded after page load
    if (typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function(mutations) {
            var shouldInit = false;
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // Check if submit-canary-input button was added
                        if (node.id === 'submit-canary-input' || 
                            (node.querySelector && node.querySelector('#submit-canary-input'))) {
                            shouldInit = true;
                        }
                    }
                });
            });
            if (shouldInit) {
                setTimeout(function() {
                    const submitButton = document.getElementById('submit-canary-input');
                    if (submitButton && submitButton.disabled === false) {
                        // Only disable if it's not already disabled (to avoid overriding user input)
                        submitButton.disabled = true;
                    }
                    if (typeof initCanaryCustomFormValidation === 'function') {
                        initCanaryCustomFormValidation();
                    }
                }, 100);
            }
        });
        
        // Start observing when DOM is ready
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                if (document.body) {
                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }
            });
        }
    }

    function processCanary() {
        const basekpods = $('#basekpods-input').val() || '*';
        const canarykpods = $('#canarykpods-input').val() || '*';
        let info = " start: " + moment.utc($("#startpicker3").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " end: " + moment.utc($("#endpicker3").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " cell: '" + $('#cell-input1').val()  + "' basekpods: '" + basekpods + "' canarykpods: '" + canarykpods + "'";

        if ($("#startpicker3").val() != "" && $("#endpicker3").val() != "" && $('#cell-input1').val() != undefined && $('#cell-input1').val() != "" ) {
            let duration = (moment.utc($("#endpicker3").val()).valueOf() - moment.utc($("#startpicker3").val()).valueOf());
            if (duration <= 12 * 60 * 60 * 1000) {
                $("#submit-canary-input").attr("disabled", true);
                $('#canary-input-info-text').html("Processing " + info + " This may take couple of munutes ...");
                $("#canary-input-info").toggle("slide");
                processCustomCanaryData(moment.utc($("#startpicker3").val()).valueOf(), moment.utc($("#endpicker3").val()).valueOf(), $('#cell-input1').val(), basekpods, canarykpods);
            } else {
                $('#canary-input-info-text').html("Invalid input " + info);
                $("#canary-input-info").toggle("slide");
            }
            //process and remove message
        } else {
            $('#canary-input-info-text').html("Invalid input " + info);
            $("#canary-input-info").toggle("slide");
        }
    }

    function processCustomCanaryData(start, end, cell, basekpods, canarykpods) {
        basekpods = basekpods || '*';
        canarykpods = canarykpods || '*';
        URL = "v1/processcustomcanary/" + dataHost + "/?start=" + start + "&end=" + end + "&cell=" + cell + "&basekpods=" + encodeURIComponent(basekpods) + "&canarykpods=" + encodeURIComponent(canarykpods);
        showSpinner("spinnerzingcustom");
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner("spinnerzingcustom");
                toastMessage(toastType.INFO, "Processing Done");
                $("#canary-input-info").toggle("slide");
                // Re-enable button and validate form state
                validateCanaryCustomForm();
                if (result[0] != undefined && result[0].length > 0) {
                    if(canaryContextArray == undefined){
                        canaryContextArray = [];
                    }
                    canaryContextArray.push({"record": result[0]});
                    updateCanaryView($("#canary-tabs .modern-tabs-nav-button.active").attr("data-tab-target"));
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                $("#canary-input-info").toggle("slide");
                // Re-enable button and validate form state
                validateCanaryCustomForm();
                hideSpinner("spinnerzingcustom");
            }
        });
    }

</script>