<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>

<style>
    table, th, td {
        padding: 5px;
        align-content: center;
    }
    table {
        border-spacing: 25px;
    }

    /* Form Layout Container - replaces table - uses CSS Grid for column alignment */
    /* Layout: label input label input label input label input label input submit backup/checkbox */
    /* Total: 12 columns - 5 fields (2 cols each) = 10, submit = 1, backup/checkbox = 1 */
    .form-layout-wrapper {
        display: grid;
        grid-template-columns: auto auto auto auto auto auto auto auto auto auto auto auto;
        grid-template-rows: auto auto; /* 2 rows */
        align-items: center;
        gap: 5px 0px; /* row-gap column-gap - no column gap */
    }

    /* Form Field Label - separate grid item */
    .form-field-label {
        white-space: nowrap; /* Prevent label wrapping */
        padding-right: 3px; /* Very small gap between label and its input */
    }

    /* Form Field Input - separate grid item */
    .form-field-input {
        display: flex;
        align-items: center;
        margin-right: 10px; /* Space between field groups (after each input) */
    }
    
    /* Remove margin from last input in each row group */
    .form-field-input:nth-child(10),
    .form-field-input:nth-child(22) {
        margin-right: 0; /* No margin needed before submit button */
    }

    /* Submit Button Container - spans both rows */
    .submit-button-container {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }

    /* Backup Icon Container - first row, last column */
    .backup-icon-container {
        display: flex;
        align-items: center;
        padding: 0;
    }

    /* Checkbox container in second row */
    .checkbox-container {
        display: flex;
        align-items: center;
        padding-left: 9px;
    }

    /* Modern Label Styling */
    .fieldlable {
        font-weight: 500;
        color: #495057;
    }

    /* Modern Input Styling - all dimensions preserved */
    .filterinput {
        border: 1px solid #dee2e6 !important;
        border-radius: 4px;
        background: #ffffff;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .filterinput:hover {
        border-color: #adb5bd !important;
    }

    .filterinput:focus {
        outline: none;
        border-color: #46a5e3 !important;
        box-shadow: 0 0 0 3px rgba(70, 165, 227, 0.1);
    }

    .filterinput::placeholder {
        color: #adb5bd;
    }

    /* Fix datalist dropdown arrow alignment and remove right edge gap */
    .filterinput[list] {
        padding-right: 0px !important;
        padding-left: 10px !important;
        text-align: center !important;
        box-sizing: border-box;
    }

    /* Submit Button - uses modern-button.css with custom height and blue variant */
    #submit-input {
        /* Use modern-button base styles - override only what's unique to this button */
        height: 70px !important;
        min-height: 70px !important;
        /* Blue color is already set by modern-button-blue class */
    }

    /* Modern Backup Icon - font-size preserved (20px) */
    #backup-gold {
        color: #46a5e3;
        transition: color 0.2s ease, background 0.2s ease;
        padding: 4px;
        border-radius: 4px;
    }

    #backup-gold:hover {
        color: #3773b3;
        background: #e9ecef;
    }

    /* Modern Checkbox - dimensions preserved (17px x 17px) */
    #usegold {
        accent-color: #46a5e3;
        cursor: pointer;
    }

    /* Modern Spinner - dimensions preserved (25px x 25px) */
    .spinner {
        display: none;
        width: 25px;
        height: 25px;
        margin: 0px auto;
        border-radius: 50%;
        border: 4px solid rgba(70, 165, 227, 0.2);
        border-top-color: #46a5e3;
        animation: spin 1s infinite linear;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Input Info - toast-style yellow warning with glassmorphism */
    #input-info {
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
    
    /* Don't force display - let inline style and jQuery control it for slide animation */
    /* The inline style="display:none" will handle initial hidden state */
    /* jQuery's .toggle("slide") will override display during animation */

    /* Ensure jQuery UI classes don't override our toast styling */
    #input-info.ui-state-highlight,
    #input-info.ui-widget-header {
        background: rgba(255, 183, 77, 0.35) !important;
        background-image: 
            linear-gradient(135deg, rgba(255, 183, 77, 0.45) 0%, rgba(255, 152, 0, 0.3) 50%, rgba(255, 183, 77, 0.45) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.1) 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.4) !important;
        color: #ffffff !important;
        padding: 0 !important;
    }
    
    /* No padding on inner content to minimize height */
    #input-info-text {
        padding: 0 !important;
        display: inline-block !important;
    }
    
    /* Icon styling - no padding */
    #input-info .ui-icon {
        display: inline-block;
        margin-right: 4px;
        vertical-align: middle;
        padding: 0 !important;
        margin: 0 4px 0 0 !important;
    }

    /* Add top padding to the form */
    #compare-context-selector-form {
        padding-top: 16px;
    }
    
    /* Make center 50% of accordion header non-clickable (input.ftl page specific) */
    #accordion-header {
        position: relative;
        cursor: pointer;
    }
    
    /* Visual indicator for non-clickable center area - shows default cursor */
    #accordion-header::after {
        content: '';
        position: absolute;
        left: 25%;
        right: 25%;
        top: 0;
        bottom: 0;
        pointer-events: none; /* Allow clicks to pass through to check position in JS */
        z-index: 1;
        cursor: default !important; /* Show default cursor over center area */
    }
    
    /* Make center portion (span text) show default cursor instead of pointer */
    #accordion-header span {
        cursor: default !important;
        position: relative;
        z-index: 2;
    }
    
    /* Ensure icon remains clickable with pointer cursor */
    #accordion-header .modern-accordion-icon {
        cursor: pointer !important;
        position: relative;
        z-index: 2;
    }
</style>
<link rel="stylesheet" href="/css/modern-accordion.css">
<link rel="stylesheet" href="/css/modern-button.css">
<script src="/js/modern-accordion.js"></script>


<div id="accordion" class="modern-accordion">
    <div class="modern-accordion-header" id="accordion-header">
        <i class="fa fa-chevron-down modern-accordion-icon"></i>
        <span>Data source selector</span>
    </div>
    <div class="modern-accordion-content" id="accordion-content">
        <div style="padding-left:4px; padding-bottom: 0px; " class="col-lg-12">
            <form  id="compare-context-selector-form" action="javascript:submitTo()" method="get"
                   content="application/x-www-form-urlencoded">
            <span style="float:right;" class="spinner" id="spinner"></span>

        <div class="form-layout-wrapper">
            <!-- Row 1: Field 1 - Time range UTC from -->
            <label class="fieldlable form-field-label" style="grid-column: 1; grid-row: 1;">Time range UTC from: </label>
            <div class="form-field-input" style="grid-column: 2; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput" id="startpicker1" type="text">
            </div>
            
            <!-- Row 1: Field 2 - to -->
            <label class="fieldlable form-field-label" style="grid-column: 3; grid-row: 1;">to: </label>
            <div class="form-field-input" style="grid-column: 4; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput" id="endpicker1" type="text">
            </div>
            
            <!-- Row 1: Field 3 - Tenant -->
            <label for="tenant-input1" id="tenant-label1" class="fieldlable form-field-label" style="grid-column: 5; grid-row: 1;">Tenant: </label>
            <div id="tenant-field-div1" class="form-field-input" style="grid-column: 6; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="tenant-input1" name="tenant1"
                       placeholder="Choose a tenant ..." list="tenants1"
                       value=""/>
                <datalist id="tenants1">
                </datalist>
            </div>
            
            <!-- Row 1: Field 4 - Host -->
            <label title="Click to see host selection hints" for="host-input1" id="host-label1" class="fieldlable form-field-label" style="cursor: pointer; grid-column: 7; grid-row: 1;">Host: </label>
            <div id="host-field-div1" class="form-field-input" style="grid-column: 8; grid-row: 1;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="host-input1" name="host1"
                       placeholder="Choose a host..."
                       list="hosts1"
                       value=""/>
                <datalist id="hosts1">
                </datalist>
            </div>
            
            <!-- Row 1: Field 5 - Profile -->
            <label title="profiles collected during selected time range" for="bases1" id="base-label1" class="fieldlable form-field-label" style="grid-column: 9; grid-row: 1;">Profile: </label>
            <div id="profile-field-div1" class="form-field-input" style="grid-column: 10; grid-row: 1;">
                <span id="filter-profile-note1" style="color:#F0B778; display: none">Retry by providing time range > 10 min</span>
                <select style="height:30px;text-align: center;width: 200px" class="filterinput" id="bases1" name="base1" value="" placeholder="Choose a profile...">
                </select>
            </div>
            
            <!-- Row 2: Field 1 - Compare with -->
            <label class="fieldlable form-field-label" style="grid-column: 1; grid-row: 2;">Compare with (Optional): </label>
            <div class="form-field-input" style="grid-column: 2; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput" id="startpicker2" type="text">
            </div>
            
            <!-- Row 2: Field 2 - to -->
            <label class="fieldlable form-field-label" style="grid-column: 3; grid-row: 2;">to: </label>
            <div class="form-field-input" style="grid-column: 4; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput" id="endpicker2" type="text">
            </div>
            
            <!-- Row 2: Field 3 - Tenant -->
            <label for="tenant-input2" id="tenant-label2" class="fieldlable form-field-label" style="grid-column: 5; grid-row: 2;">Tenant: </label>
            <div id="tenant-field-div2" class="form-field-input" style="grid-column: 6; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="tenant-input2" name="tenant2"
                       placeholder="Choose a tenant ..." list="tenants2"
                       value=""/>
                <datalist id="tenants2">
                </datalist>
            </div>
            
            <!-- Row 2: Field 4 - Host -->
            <label for="host-input2" id="host-label2" class="fieldlable form-field-label" style="grid-column: 7; grid-row: 2;">Host: </label>
            <div id="host-field-div2" class="form-field-input" style="grid-column: 8; grid-row: 2;">
                <input style="height:30px;text-align: center;" class="filterinput form-control send-ga" id="host-input2" name="host2"
                       placeholder="Choose a host..."
                       list="hosts2"
                       value=""/>
                <datalist id="hosts2">
                </datalist>
            </div>
            
            <!-- Row 2: Field 5 - Profile -->
            <label title="profiles collected during selected time range" for="bases2" id="base-label2" class="fieldlable form-field-label" style="grid-column: 9; grid-row: 2;">Profile: </label>
            <div id="profile-field-div2" class="form-field-input" style="grid-column: 10; grid-row: 2;">
                <span id="filter-profile-note2" style="color:#F0B778; display: none">Retry by providing time range > 10 min</span>
                <select style="height:30px;text-align: center;width: 200px" class="filterinput" id="bases2" name="base2" value="" placeholder="Choose a profile...">
                </select>
            </div>
            
            <!-- Submit button spans both rows -->
            <div class="submit-button-container" style="grid-column: 11; grid-row: 1 / 3;">
                <button id="submit-input" class="modern-button modern-button-green" disabled>Submit</button>
            </div>
            
            <!-- Backup icon - row 1 -->
            <div class="backup-icon-container" style="grid-column: 12; grid-row: 1;">
                <i id="backup-gold" title="backup data to GOLD namespace which has higher TTL" style="font-size:20px; cursor: pointer;" class="fa fa-floppy-o" onclick="backupAsGold()"></i>
            </div>
            
            <!-- Checkbox - row 2 -->
            <div class="checkbox-container" style="padding-left:4px; grid-column: 12; grid-row: 2;">
                <input title="use GOLD namespace backup data source" style="width:17px; height:17px; cursor: pointer;" type="checkbox" id="usegold" onclick="handleGoldCheck()">
            </div>
        </div>
            <div id="input-info" class="ui-state-highlight ui-widget-header ui-corner-all" style="float: left !important;display:none">
                <span class="ui-icon ui-icon-info"></span> <span id="input-info-text"></span>
            </div>
            <div id="dashboard-container"></div>
            </form>
        </div>
    </div>
</div>

<script>

    /**
     * Validate required form fields (Row 1 only - Row 2 is optional)
     * @returns {boolean} true if all Row 1 fields are filled, false otherwise
     */
    function validateInputForm() {
        // Only validate Row 1 fields (Row 2 is optional)
        const start1 = $("#startpicker1").val();
        const end1 = $("#endpicker1").val();
        const tenant1 = $("#tenant-input1").val();
        const host1 = $("#host-input1").val();
        const bases1 = $("#bases1").val();
        
        // Check if all Row 1 fields are filled
        const isValid = start1 && start1.trim() !== '' && 
                       end1 && end1.trim() !== '' && 
                       tenant1 && tenant1.trim() !== '' && 
                       host1 && host1.trim() !== '' && 
                       bases1 && bases1.trim() !== '';
        
        const submitButton = document.getElementById('submit-input');
        if (submitButton) {
            submitButton.disabled = !isValid;
        }
        
        return isValid;
    }
    
    /**
     * Initialize form validation - hooks into existing onChange listeners in input.js
     * Uses debouncing to prevent multiple rapid validations
     */
    let validationTimeout = null;
    function debouncedValidateInputForm() {
        // Clear any pending validation
        if (validationTimeout) {
            clearTimeout(validationTimeout);
        }
        // Debounce validation to prevent multiple rapid calls
        // Use a shorter delay (50ms) to ensure validation happens quickly
        validationTimeout = setTimeout(function() {
            validateInputForm();
        }, 50);
    }
    
    function initInputFormValidation() {
        // Disable button initially
        const submitButton = document.getElementById('submit-input');
        if (submitButton) {
            submitButton.disabled = true;
        }
        
        // Add validation as additional handler to existing change listeners
        // Use debounced validation to prevent multiple rapid calls
        // Only listen to 'change' events, not 'input' or 'blur' to avoid excessive triggers
        
        // Required Row 1 fields - add validation to existing change events only
        // Use 'one' event listener with namespace to avoid duplicate handlers if initInputFormValidation is called multiple times
        $("#startpicker1").off('change.validation').on('change.validation', debouncedValidateInputForm);
        $("#endpicker1").off('change.validation').on('change.validation', debouncedValidateInputForm);
        $("#tenant-input1").off('change.validation').on('change.validation', debouncedValidateInputForm);
        $("#host-input1").off('change.validation').on('change.validation', debouncedValidateInputForm);
        $("#bases1").off('change.validation').on('change.validation', debouncedValidateInputForm);
        
        // Also listen for datetimepicker dp.change events (input.js uses datetimepicker)
        // But use debouncing to prevent multiple calls
        $("#startpicker1").off('dp.change.validation').on('dp.change.validation', debouncedValidateInputForm);
        $("#endpicker1").off('dp.change.validation').on('dp.change.validation', debouncedValidateInputForm);
        
        // Optional Row 2 fields - also add validation (doesn't affect validation but keeps consistency)
        $("#startpicker2, #endpicker2, #tenant-input2, #host-input2, #bases2").on('change', debouncedValidateInputForm);
        $("#startpicker2, #endpicker2").on('dp.change', debouncedValidateInputForm);
        
        // Initial validation
        validateInputForm();
    }

    // Make validation function available globally so it can be called from input.js
    window.validateInputForm = validateInputForm;
    
    // Track if initialization is complete to avoid triggering change events during page load
    let initializationComplete = false;
    
    // Override jQuery's val() method to trigger validation when values are set programmatically
    // This ensures validation runs when fields are populated from URL parameters or API responses
    (function() {
        const originalVal = $.fn.val;
        
        $.fn.val = function(value) {
            if (arguments.length === 0) {
                // Getting value - use original behavior
                return originalVal.call(this);
            } else {
                // Setting value - check if value actually changed
                const $this = $(this);
                const oldValue = originalVal.call($this);
                const result = originalVal.call(this, value);
                const newValue = originalVal.call($this);
                
                // Trigger validation immediately when any field value is set programmatically
                // This ensures submit button enables even with slow API responses
                if (oldValue !== newValue) {
                    const fieldId = $this.attr('id');
                    // Trigger validation for all required fields
                    const requiredFields = ['startpicker1', 'endpicker1', 'tenant-input1', 'host-input1', 'bases1'];
                    if (requiredFields.indexOf(fieldId) !== -1) {
                        // Use setTimeout to trigger validation asynchronously
                        // This allows the field value to be fully set before validation
                        setTimeout(function() {
                            validateInputForm();
                        }, 0);
                    }
                    
                    // Also trigger change events for date pickers (for input.js compatibility)
                    const datePickerFields = ['startpicker1', 'endpicker1'];
                    if (datePickerFields.indexOf(fieldId) !== -1 && initializationComplete) {
                        setTimeout(function() {
                            $this.trigger('change');
                        }, 0);
                    }
                }
                
                return result;
            }
        };
    })();
    
    // Use MutationObserver to watch for field value changes (catches programmatic updates)
    // This ensures validation runs even if $.fn.val override doesn't catch everything
    function setupFieldValueObserver() {
        const requiredFields = ['startpicker1', 'endpicker1', 'tenant-input1', 'host-input1', 'bases1'];
        
        requiredFields.forEach(function(fieldId) {
            const field = document.getElementById(fieldId);
            if (field) {
                // Watch for value attribute changes and input events
                const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                            setTimeout(function() {
                                validateInputForm();
                            }, 50);
                        }
                    });
                });
                
                observer.observe(field, {
                    attributes: true,
                    attributeFilter: ['value']
                });
                
                // Also listen for input events (catches programmatic changes that don't use $.fn.val)
                field.addEventListener('input', function() {
                    setTimeout(function() {
                        validateInputForm();
                    }, 50);
                }, { passive: true });
            }
        });
    }
    
    /**
     * Initialize input accordion - uses shared modern accordion component
     * Makes center 50% of header non-clickable (input.ftl page specific)
     */
    function initInputAccordion() {
        // Use shared accordion component, start expanded (true)
        initModernAccordion('accordion-header', 'accordion-content', true);
        
        // Make center 50% non-clickable (input.ftl page specific)
        const accordionHeader = document.getElementById('accordion-header');
        if (accordionHeader) {
            // Remove the default click handler added by initModernAccordion
            const newHeader = accordionHeader.cloneNode(true);
            accordionHeader.parentNode.replaceChild(newHeader, accordionHeader);
            
            const accordionContent = document.getElementById('accordion-content');
            
            // Handle cursor change based on mouse position
            newHeader.addEventListener('mousemove', function(e) {
                const rect = newHeader.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const headerWidth = rect.width;
                const mousePercent = (mouseX / headerWidth) * 100;
                
                // Change cursor to default in center 50% (25% to 75%)
                if (mousePercent >= 25 && mousePercent <= 75) {
                    newHeader.style.cursor = 'default';
                } else {
                    newHeader.style.cursor = 'pointer';
                }
            });
            
            // Reset cursor when mouse leaves
            newHeader.addEventListener('mouseleave', function(e) {
                newHeader.style.cursor = 'pointer';
            });
            
            // Add custom click handler that checks click position
            newHeader.addEventListener('click', function(e) {
                const rect = newHeader.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const headerWidth = rect.width;
                const clickPercent = (clickX / headerWidth) * 100;
                
                // Block clicks in center 50% (25% to 75%)
                if (clickPercent >= 25 && clickPercent <= 75) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
                
                // Allow clicks on left 25% or right 25% - proceed with normal accordion toggle
                e.preventDefault();
                e.stopPropagation();
                
                const isActive = accordionContent.classList.contains('active');
                
                if (isActive) {
                    // Collapsing - smooth slide up (jQuery UI style)
                    const startHeight = accordionContent.scrollHeight;
                    accordionContent.style.height = startHeight + 'px';
                    accordionContent.style.overflow = 'hidden';
                    
                    // Force reflow
                    accordionContent.offsetHeight;
                    
                    // Remove active class and animate to 0
                    accordionContent.classList.remove('active');
                    newHeader.classList.remove('active');
                    accordionContent.style.height = '0px';
                    
                    // Clean up after animation
                    setTimeout(function() {
                        if (!accordionContent.classList.contains('active')) {
                            accordionContent.style.height = '';
                            accordionContent.style.overflow = '';
                        }
                    }, 350);
                    
                    // Remove inline styles when closing
                    newHeader.style.removeProperty('background');
                    newHeader.style.removeProperty('background-image');
                    newHeader.style.removeProperty('background-color');
                    newHeader.style.removeProperty('color');
                    newHeader.style.removeProperty('border');
                    newHeader.style.removeProperty('border-radius');
                    newHeader.style.removeProperty('box-shadow');
                    newHeader.style.removeProperty('backdrop-filter');
                    newHeader.style.removeProperty('-webkit-backdrop-filter');
                    newHeader.style.removeProperty('text-shadow');
                    newHeader.style.removeProperty('font-weight');
                    newHeader.style.removeProperty('transform');
                } else {
                    // Expanding - smooth slide down (jQuery UI style)
                    accordionContent.style.display = 'block';
                    accordionContent.style.overflow = 'hidden';
                    accordionContent.style.height = '0px';
                    accordionContent.classList.add('active');
                    newHeader.classList.add('active');
                    
                    // Force reflow to ensure active class is applied
                    accordionContent.offsetHeight;
                    
                    // Measure height with active class applied (padding included)
                    const targetHeight = accordionContent.scrollHeight;
                    
                    // Animate smoothly to measured height
                    accordionContent.style.height = targetHeight + 'px';
                    
                    // Clean up after animation completes
                    setTimeout(function() {
                        if (accordionContent.classList.contains('active')) {
                            accordionContent.style.height = 'auto';
                            accordionContent.style.overflow = '';
                        }
                    }, 350);
                }
            });
        }
    }

    $(document).ready(function () {
        if(dataSource == "gold"){
            $("#usegold").prop("checked", true);
            $("#backup-gold").hide();
        }
        
        // Initialize accordion - script is loaded via script tag
        // Small delay to ensure DOM is fully ready
        setTimeout(function() {
            initInputAccordion();
        }, 50);
        
        // Initialize form validation - onChange events will handle validation
        // Wait a bit to ensure fields exist in DOM and initial values are set
        setTimeout(function() {
            initInputFormValidation();
            
            // Set up MutationObserver to watch for field value changes
            setupFieldValueObserver();
            
            // Periodically validate during initialization to catch async field population
            // This ensures validation runs when fields are populated from URL parameters
            let validationAttempts = 0;
            const maxAttempts = 50; // Check for up to 10 seconds (50 * 200ms) - increased for slow API responses
            const validationInterval = setInterval(function() {
                validationAttempts++;
                validateInputForm();
                
                // Stop checking once all required fields are filled or max attempts reached
                const start1 = $("#startpicker1").val();
                const end1 = $("#endpicker1").val();
                const tenant1 = $("#tenant-input1").val();
                const host1 = $("#host-input1").val();
                const bases1 = $("#bases1").val();
                
                const allFieldsFilled = start1 && start1.trim() !== '' && 
                    end1 && end1.trim() !== '' && 
                    tenant1 && tenant1.trim() !== '' && 
                    host1 && host1.trim() !== '' && 
                    bases1 && bases1.trim() !== '';
                
                if (allFieldsFilled) {
                    clearInterval(validationInterval);
                    // Mark initialization as complete
                    initializationComplete = true;
                    // Final validation to ensure button is enabled
                    validateInputForm();
                } else if (validationAttempts >= maxAttempts) {
                    clearInterval(validationInterval);
                    // Mark initialization as complete even if fields aren't filled
                    initializationComplete = true;
                    // Final validation attempt
                    validateInputForm();
                }
            }, 200);
        }, 100);
    });

    function onClickNoop(event){
        event.stopPropagation();
    }



</script>