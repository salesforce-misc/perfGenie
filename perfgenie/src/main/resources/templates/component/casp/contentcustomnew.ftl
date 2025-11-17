<table class='ui-widget' style="border: hidden;">
    <tr style="border: hidden;">
        <td style="border: none;"><label class="fieldlable">Time range UTC from: </label></td>
        <td style="border: none;"><input style="height:30px;text-align: center;" class="filterinput" id="startpicker3"
                                         type="text"></td>
        <td style="border: none;"><label class="fieldlable">to: </label></td>
        <td style="border: none;"><input style="height:30px;text-align: center;" class="filterinput" id="endpicker3"
                                         type="text"></td>
        <td style="border: none;"><label for="cell-input1" id="cell-label1" class="fieldlable">Cell: </label></td>
        <td style="border: none;">
            <input style="width:60px;height:30px;text-align: center;" class="filterinput" id="cell-input1" name="cell1"
                   type="text"
                   value=""/>
        </td>

        <td style="padding: 10px;border: none;align-items:center;">
            <button onclick="processCanary()" id="submit-canary-input"
                    class="modern-button modern-button-green" disabled>Process
            </button>
        </td>
    </tr>

</table>

<div id="canary-input-info" class="ui-state-highlight ui-widget-header ui-corner-all"
     style="float: left !important;display:none">
    <span id="canary-input-info-text"></span>
</div>
<div id="spinnerzingcustom" class="spinner"></div>
<div style="padding:0px !important; overflow: scroll;font-size: 95%" class="col-lg-12">
    <div id="canarycustomview"></div>
</div>


<script type="text/javascript" class="init">

    /**
     * Check if all required canary custom form fields are filled
     */
    function validateCanaryCustomForm() {
        const start = $("#startpicker3").val();
        const end = $("#endpicker3").val();
        const cell = $("#cell-input1").val();
        
        const isValid = start && start.trim() !== '' && 
                       end && end.trim() !== '' && 
                       cell && cell.trim() !== '';
        
        const submitButton = document.getElementById('submit-canary-input');
        if (submitButton) {
            submitButton.disabled = !isValid;
        }
        
        return isValid;
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
        
        // Add event listeners to input fields
        const startPicker = $("#startpicker3");
        const endPicker = $("#endpicker3");
        const cellInput = $("#cell-input1");
        
        // Listen for input changes
        if (startPicker.length) {
            startPicker.on('change blur', validateCanaryCustomForm);
            startPicker.on('dp.change', validateCanaryCustomForm);
        }
        if (endPicker.length) {
            endPicker.on('change blur', validateCanaryCustomForm);
            endPicker.on('dp.change', validateCanaryCustomForm);
        }
        if (cellInput.length) {
            cellInput.on('input change blur', validateCanaryCustomForm);
        }
        
        // Initial validation
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
        let info = " start: " + moment.utc($("#startpicker3").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " end: " + moment.utc($("#endpicker3").val()).format('ddd, MMM D YYYY HH:mm:ss [UTC]') + " cell: '" + $('#cell-input1').val()  + "'";

        if ($("#startpicker3").val() != "" && $("#endpicker3").val() != "" && $('#cell-input1').val() != undefined && $('#cell-input1').val() != "" ) {
            let duration = (moment.utc($("#endpicker3").val()).valueOf() - moment.utc($("#startpicker3").val()).valueOf());
            $("#canary-input-info").css("display", "block");
            if (duration <= 4 * 60 * 60 * 1000) {
                $("#submit-canary-input").attr("disabled", true);
                $('#canary-input-info-text').html("Processing " + info + " This may take couple of munutes ...");
                processCustomCanaryData(moment.utc($("#startpicker3").val()).valueOf(), moment.utc($("#endpicker3").val()).valueOf(), $('#cell-input1').val());
            } else {
                $('#canary-input-info-text').html("Invalid input: time range " + duration / (60 * 1000) + " min is more than 4 hours");
            }
            //process and remove message
        } else {
            $("#canary-input-info").css("display", "block");
            $('#canary-input-info-text').html("Invalid input " + info);
        }
    }

    function processCustomCanaryData(start, end, cell) {
        URL = "v1/processcustomcanary/" + dataHost + "/?start=" + start + "&end=" + end + "&cell=" + cell;
        showSpinner("spinnerzingcustom");
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner("spinnerzingcustom");
                toastMessage(toastType.INFO, "Processing Done");
                $("#canary-input-info").css("display", "none");
                // Re-enable button and validate form state
                validateCanaryCustomForm();
                if (result[0] != undefined && result[0].length > 0) {
                    canaryContextArray.push({"record": result[0]});
                    updateCanaryView($(".modern-tabs-nav-button.active").attr("data-tab-target"));
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                $("#canary-input-info").css("display", "none");
                // Re-enable button and validate form state
                validateCanaryCustomForm();
                hideSpinner("spinnerzingcustom");
            }
        });
    }

</script>