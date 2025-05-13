<div id="spinner" class="spinner"></div>
<div style="overflow: scroll;font-size: 95%">
    <div id="canaryview"></div>
</div>

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
        <label class="color-option" style="color: black;">
            <input type="radio" name="color" value="black"> Black
        </label>
    </div>

    <!-- Textarea for the comment -->
    <textarea id="commentText" placeholder="Your name: Type your comment here..."></textarea>

    <!-- Button container for submit/cancel buttons aligned to the right -->
    <div class="button-container">
        <button id="submitComment">Submit</button>
        <button id="cancelComment">Cancel</button>
    </div>
</div>
<script type="text/javascript" class="init">
    const urlParams = new URLSearchParams(window.location.search);
    let dataHost = urlParams.get('host') || "perf-genie-tracker";

    function onComment(resulttime, cell) {
        getCanaryComments(resulttime, cell);
    }


    $(document).ready(function () {
        // Apply jQuery UI button widget to both submit and cancel buttons
        $("#submitComment").button();
        $("#cancelComment").button();
        $("#submitBtn").button();


        // Close the popup when the cancel button is clicked
        $("#cancelComment").click(function () {
            $("#overlay").fadeOut();
            $("#commentPopup").fadeOut();
        });

        // Submit the comment and selected color
        $("#submitComment").click(function () {
            let comment = $("#commentText").val();
            comment = comment.replaceAll('\n', "<br>");
            let selectedColor = $("input[name='color']:checked").val();
            let cell = $('#cell').val();
            let timestamp = $('#resulttime').val();
            // If comment and color are selected, close popup
            if (!selectedColor) {
                selectedColor = "black";
            }
            if (comment.trim() !== "") {
                //alert("Comment submitted: " + comment + "\nSelected Color: " + selectedColor);

                postComment(comment, selectedColor, cell, timestamp);
                $("#overlay").fadeOut();
                $("#commentPopup").fadeOut();
            } else {
                toastMessage(toastType.INFO, "Please enter a comment");
            }
        });

        // Close the popup when clicking the overlay
        $("#overlay").click(function () {
            $(this).fadeOut();
            $("#commentPopup").fadeOut();
        });
    });

    function processCanaryData() {
        URL = "v1/canary/" + dataHost + "/?start=1&end=1";
        showSpinner();
        $.ajax({
            url: URL, success: function (result) {
                hideSpinner();
                toastMessage(toastType.INFO, "Done");
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                hideSpinner();
            }
        });
    }

    function viewCanaryData() {
        URL = "v1/canaryview/" + dataHost + "/?start=1&end=1";
        showSpinner();
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined && result.entry != undefined && result.entry.records != undefined && result.entry.records.canary != undefined && result.entry.records.canary[1] != undefined) {
                    canaryContextArray = result.entry.records.canary[1];
                    canaryContextHeader = result.entry.header.canary;
                    canaryCommentCounts = result.counts;
                    showCanaryTable(canaryContextArray);
                }
                hideSpinner();
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to process canary data");
                hideSpinner();
            }
        });
    }

    function getCanaryComments(resulttime, cell) {
        URL = "v1/canarycomments/"+dataHost+"/?start=" + resulttime + "&end=" + resulttime + "&metadata_query=" + encodeURIComponent("cell=" + cell);
        showSpinner("spinner1");
        $.ajax({
            url: URL, success: function (result) {
                if (result != undefined) {
                    canaryComments = result;
                    $('#resulttime').val(resulttime);
                    $('#cell').val(cell);
                    $("#commentText").val("");
                    $("#overlay").fadeIn();
                    $("#commentPopup").fadeIn();
                    let text = "";
                    let arr = [];
                    for (let timestamp in canaryComments) {
                        arr.push(timestamp);
                    }
                    arr.sort((a, b) => a - b);
                    for (let i = 0; i < arr.length; i++) {
                        if (canaryComments[arr.at(i)] != null && canaryComments[arr.at(i)].color != undefined) {
                            text = text + "<span style='color:" + canaryComments[arr.at(i)].color + "'>" + canaryComments[arr.at(i)].comment + "</span><br>";
                        }
                    }
                    $('#comments').html(text);
                    $('#comments').scrollTop($('#comments')[0].scrollHeight);
                }
                hideSpinner("spinner1");
            },
            error: function (xhr, status, error) {
                toastMessage(toastType.ERROR, "Failed to get comments");
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
    let canaryContextHeader = undefined;
    let canaryCommentCounts = undefined;
    let canaryComments = undefined;

    function showCanaryTable(result) {
        let rowIndex = -1;
        tableHeader = [];
        tableRows = [];

        let indexOrder = [];
        let indexType = [];

        canaryviewtable.addContextTableHeader(tableHeader, "timestamp", -1, "");
        canaryviewtable.addContextTableHeader(tableHeader, "Cell", -1, "");
        canaryviewtable.addContextTableHeader(tableHeader, "Cmt", -1, "");
        indexOrder.push(0);
        indexType.push("timestamp");
        indexOrder.push(1);
        indexType.push("text");
        indexOrder.push(1);
        indexType.push("text");

        for (let i = 3; i < canaryContextHeader.length; i++) {
            let tokens = canaryContextHeader[i].split(":");
            if (tokens[0].includes("%") || tokens[1] == "url") {
                if (tokens[1] == "url") {
                    indexType.push(tokens[1]);
                    canaryviewtable.addContextTableHeader(tableHeader, tokens[0], -1, "");
                } else {
                    indexType.push(tokens[1] + "c");
                    canaryviewtable.addContextTableHeader(tableHeader, tokens[0], 1, "");
                }
                indexOrder.push(i);

            }
        }

        for (let i = 3; i < canaryContextHeader.length; i++) {
            let tokens = canaryContextHeader[i].split(":");
            if (!(tokens[0].includes("%") || tokens[1] == "url")) {
                if (tokens[1] == "number") {
                    canaryviewtable.addContextTableHeader(tableHeader, tokens[0], 1, "");
                } else if (tokens[1] != "data") {
                    canaryviewtable.addContextTableHeader(tableHeader, tokens[0], -1, "");
                }
                indexOrder.push(i);
                indexType.push(tokens[1])
            }
        }

        for (let i = 0; i < canaryContextArray.length; i++) {
            if (canaryContextArray[i].record.length < 10) {
                continue;
            }
            console.log(canaryContextArray[i].record[0]);
            rowIndex++;
            tableRows[rowIndex] = [];
            canaryviewtable.addContextTableRow(tableRows[rowIndex], moment.utc(canaryContextArray[i].record[0]).format('YYYY-MM-DD'));
            //canaryviewtable.addContextTableRow(tableRows[rowIndex], canaryContextArray[i].record[1]);//tid
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<b>" + canaryContextArray[i].record[2] + "</b>");//cell

            let color = "black";
            let count = "";
            let key = canaryContextArray[i].record[0] + canaryContextArray[i].record[2];
            if (canaryCommentCounts[key] != undefined) {
                let arr = canaryCommentCounts[key].split(":");
                count = arr[0]
                color = arr[1];
            }
            canaryviewtable.addContextTableRow(tableRows[rowIndex], "<span onclick='onComment(\"" + canaryContextArray[i].record[0] + "\",\"" + canaryContextArray[i].record[2] + "\")' style='cursor: pointer; color: " + color + ";'>" + count + " <i class=\"fa fa-comment-o\" aria-hidden=\"true\"></i></span>", "id='" + canaryContextArray[i].record[0] + canaryContextArray[i].record[2] + "'");

            for (let k = 3; k < indexOrder.length; k++) {
                let val = canaryContextArray[i].record[indexOrder.at(k)];
                if (val != undefined) {
                    if (indexType.at(k) == "numberc") {
                        val = parseFloat(val).toFixed(3);
                        if (val >= 0) {
                            canaryviewtable.addContextTableOrderRow(tableRows[rowIndex], "<span style='color:green;'>" + val + "</span>", val, "style='text-align:right'");
                        } else {
                            canaryviewtable.addContextTableOrderRow(tableRows[rowIndex], "<span style='color:red;'>" + val + "</span>", val, "style='text-align:right'");
                        }
                    } else if (indexType.at(k) == "int") {
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], val, "style='text-align:right'");
                    } else if (indexType.at(k) == "number") {
                        val = parseFloat(val).toFixed(3);
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], val, "style='text-align:right'");
                    } else if (indexType.at(k) == "url") {
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], "<a href='" + val + "' target='_blank'> link</a>", "style='text-align:center'");//url
                    } else if (indexType.at(k) != "data") {
                        canaryviewtable.addContextTableRow(tableRows[rowIndex], val);
                    }
                } else {
                    canaryviewtable.addContextTableRow(tableRows[rowIndex], "na", "style='text-align:right'");
                }
            }
        }
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
            url: 'v1/comment/'+ dataHost,
            type: 'POST',
            contentType: 'application/json',  // Tells the server the request body will be in JSON format
            data: JSON.stringify(requestData),  // Convert the data object to a JSON string
            success: function (response) {
                //TODO update cell content and count map
                let count = 1;
                if (canaryCommentCounts[timestamp + cell] != undefined) {
                    let arr = canaryCommentCounts[timestamp + cell].split(":");
                    console.log(canaryCommentCounts[timestamp + cell]);
                    canaryCommentCounts[timestamp + cell] = (parseInt(arr[0]) + 1) + ":" + color;
                    console.log(canaryCommentCounts[timestamp + cell]);
                    count = (parseInt(arr[0]) + 1);
                } else {
                    canaryCommentCounts[timestamp + cell] = 1 + ":" + color;
                }
                $("#" + timestamp + cell).html("<span onclick='onComment(\"" + timestamp + "\",\"" + cell + "\")' style='cursor: pointer; color: " + color + ";'>" + count + " <i class=\"fa fa-comment-o\" aria-hidden=\"true\"></i></span>");
                console.log('Comment posted successfully:', response);
            },
            error: function (xhr, status, error) {
                console.error('Error posting comment:', error);
            }
        });
    }

</script>