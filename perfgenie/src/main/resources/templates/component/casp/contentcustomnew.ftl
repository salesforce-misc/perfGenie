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
            <button onclick="processCanary()" id="submit-canary-input" style="alignment:center;height:30px"
                    class="ui-button ui-widget ui-corner-all">Process
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
                $("#submit-canary-input").attr("disabled", false);
                if (result[0] != undefined && result[0].length > 0) {
                    canaryContextArray.push({"record": result[0]});
                    updateCanaryView($(".modern-tabs-nav-button.active").attr("data-tab-target"));
                }
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                $("#canary-input-info").css("display", "none");
                $("#submit-canary-input").attr("disabled", false);
                hideSpinner("spinnerzingcustom");
            }
        });
    }

</script>