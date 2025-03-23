<div id="spinner" class="spinner"></div>
<div id="canaryview"></div>

<div id="overlay" class="overlay"></div>

<div id="commentPopup">
    <input type="hidden" id="cell" name="commentId" value="">
    <input type="hidden" id="resulttime" name="resulttime" value="">
    <div id="spinner1" class="spinner"></div>
    <div id="comments" style="max-height: 300px;overflow: auto;border: 1px solid #ccc;"></div>
    <!-- Radio buttons for colors -->
    <div class="color-options">
        <label class="color-option" style="color: red;">
            <input type="radio" name="color" value="red"> Red
        </label>
        <label class="color-option" style="color: orange;">
            <input type="radio" name="color" value="orange"> Orange
        </label>
        <label class="color-option" style="color: green;">
            <input type="radio" name="color" value="green"> Green
        </label>
    </div>

    <!-- Textarea for the comment -->
    <textarea id="commentText" placeholder="Type your comment here..."></textarea>

    <!-- Button container for submit/cancel buttons aligned to the right -->
    <div class="button-container">
        <button id="submitComment">Submit</button>
        <button id="cancelComment">Cancel</button>
    </div>
</div>
<script type="text/javascript" class="init">

    function onComment(resulttime, cell){
        getCanaryComments(resulttime, cell);
    }


    $(document).ready(function() {
        // Apply jQuery UI button widget to both submit and cancel buttons
        $("#submitComment").button();
        $("#cancelComment").button();
        $("#submitBtn").button();


        // Close the popup when the cancel button is clicked
        $("#cancelComment").click(function() {
            $("#overlay").fadeOut();
            $("#commentPopup").fadeOut();
        });

        // Submit the comment and selected color
        $("#submitComment").click(function() {
            const comment = $("#commentText").val();
            const selectedColor = $("input[name='color']:checked").val();
            let cell = $('#cell').val();
            let timestamp = $('#resulttime').val();
            // If comment and color are selected, close popup
            if (comment.trim() !== "" && selectedColor) {
                //alert("Comment submitted: " + comment + "\nSelected Color: " + selectedColor);

                postComment(window.location.hostname+":"+comment, selectedColor, cell, timestamp);
                $("#overlay").fadeOut();
                $("#commentPopup").fadeOut();
            } else {
                alert("Please enter a comment and select a color.");
            }
        });

        // Close the popup when clicking the overlay
        $("#overlay").click(function() {
            $(this).fadeOut();
            $("#commentPopup").fadeOut();
        });
    });

    function processCanaryData() {
        URL = "v1/canary?start=1&end=1";
        showSpinner();
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner();
                toastMessage(toastType.INFO,"Done");
            },
            error: function(xhr, status, error) {
                toastMessage(toastType.ERROR,"Failed to process canary data");
                hideSpinner();
            }
        });
    }

    function viewCanaryData() {
        URL = "v1/canaryview?start=1&end=1";
        showSpinner();
        $.ajax({
            url: URL, success: function (result) {
                if(result != undefined && result.records != undefined && result.records.canary != undefined && result.records.canary[1] != undefined) {
                    canaryContextArray = result.records.canary[1];
                    showCanaryTable(canaryContextArray);
                }
                hideSpinner();
            },
            error: function(xhr, status, error) {
                toastMessage(toastType.ERROR,"Failed to process canary data");
                hideSpinner();
            }
        });
    }

    function getCanaryComments(resulttime, cell) {
        URL = "v1/canarycomments?start="+resulttime+"&end=" +resulttime+ "&metadata_query=" + encodeURIComponent("cell=" + cell);
        showSpinner("spinner1");
        $.ajax({
            url: URL, success: function (result) {
                if(result != undefined) {
                    canaryComments = result;
                    $('#resulttime').val(resulttime);
                    $('#cell').val(cell);
                    $("#commentText").val("");
                    $("#overlay").fadeIn();
                    $("#commentPopup").fadeIn();
                    let text = "";
                    let arr = [];
                    for (let timestamp in canaryComments){
                        arr.push(timestamp);
                    }
                    arr.sort((a, b) => a - b);
                    for (let i =0; i<arr.length;i++) {
                        text = text + "<span style='color:"+canaryComments[arr.at(i)].color+"'>" + canaryComments[arr.at(i)].comment + "</span><br>";
                    }
                    $('#comments').html(text);
                }
                hideSpinner("spinner1");
            },
            error: function(xhr, status, error) {
                toastMessage(toastType.ERROR,"Failed to get comments");
                hideSpinner("spinner1");
            }
        });
    }

$(document).ready(function () {
    viewCanaryData();
});

    const canaryviewtable = new SFDataTable("canaryviewtable");
    canaryviewtable.SFDataTableSetPageSize(25);
    Object.freeze(canaryviewtable);
    let canaryContextArray = undefined;
    let canaryComments = undefined;
    function showCanaryTable(result){
        let rowIndex = -1;
        tableHeader = [];
        tableRows = [];
        for(let i=0;i<canaryContextArray.length;i++){
            if(canaryContextArray[i].record.length < 10){
                continue;
            }
            console.log(canaryContextArray[i].record[0]);
            rowIndex++;
            tableRows[rowIndex] = [];
            canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(canaryContextArray[i].record[0]).format('YYYY-MM-DD HH:mm:ss'));
            //canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[1]);//tid
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<b>"+canaryContextArray[i].record[2]+"</b>");//cell
            let apt = canaryContextArray[i].record[3];
            try {
                apt = parseFloat(apt.toFixed(3))
            } catch(err) {}
            if(apt > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +apt+"</span>");//apt
            }else {
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +apt+"</span>");//apt
            }
            let jcpu = canaryContextArray[i].record[4];
            try {
                jcpu = parseFloat(jcpu.toFixed(3))
            } catch(err) {}
            if(jcpu > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +jcpu+"</span>");//apt
            }else {
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +jcpu+"</span>");//apt
            }
            let ccpu = canaryContextArray[i].record[5];
            try {
                ccpu = parseFloat(ccpu.toFixed(3))
            } catch(err) {}
            if(ccpu > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +ccpu+"</span>");//apt
            }else {
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +ccpu+"</span>");//apt
            }
            let avgs = canaryContextArray[i].record[10];
            try {
                avgs = parseFloat(avgs.toFixed(3))
            } catch(err) {}

            if(avgs > 0){
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:green'>" +avgs+"</span>");//apt
            }else {
                if(avgs < -1000){
                    avgs = NaN;
                }
                canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span style='color:red'>" +avgs+"</span>");//apt
            }
            // <a href="url">link text</a>
            canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[7]);//zic
            canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[8]);//zuc
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<a href='" + canaryContextArray[i].record[6] + "' target='_blank'> link</a>");//url
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<a href='" + canaryContextArray[i].record[9] + "' target='_blank'> link</a>");
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span onclick='onComment(\""+canaryContextArray[i].record[0]+"\",\""+canaryContextArray[i].record[2]+"\")' style='cursor: pointer; color: black;'> <i class=\"fa fa-comment-o\" aria-hidden=\"true\"></i></span>");

        }
        canaryviewtable.addContextTableHeader(tableHeader,"timestamp",-1, "");
        //canaryviewtable.addContextTableHeader(tableHeader,"tid",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Cell",-1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg APT %chng",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg JVMCpu/req %chng",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg containerCPU/req %chng",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Avg Startup %chng",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"zingCount",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"zuluCount",1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Dashboard",-1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Metrics",-1, "");
        canaryviewtable.addContextTableHeader(tableHeader,"Comment",-1, "class='context-menu-comment'");


        canaryviewtable.SFDataTable(tableRows, tableHeader, "canaryview");
    }
    $.contextMenu({
        selector: '.context-menu-comment',
        callback: function (key, options) {
            if (key == "add") {
                alert("check");
            }
        },
        items: {
            "add": {name: "add comment"}
        }
    });

    function postComment(commentText, color, cell, timestamp) {
        // Create the data to send in the request body
        const requestData = {
            comment: commentText,
            color: color,
            cell: cell,
            timestamp: timestamp
        };

        // Make the AJAX request using jQuery
        $.ajax({
            url: 'v1/comment',  // Replace with your API endpoint
            type: 'POST',
            contentType: 'application/json',  // Tells the server the request body will be in JSON format
            data: JSON.stringify(requestData),  // Convert the data object to a JSON string
            success: function(response) {
                console.log('Comment posted successfully:', response);
            },
            error: function(xhr, status, error) {
                console.error('Error posting comment:', error);
            }
        });
    }

</script>