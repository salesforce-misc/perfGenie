<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>
<style>
table.alternate_color tr:nth-of-type(even) {
background-color:#F9F9F9;
}

table.alternate_color th, td {
border: 1px solid #E8EAEC;
border-collapse: collapse;
}

.spinner {
    display: none;
    width: 25px;
    height: 25px;
    margin: 0px auto;
    border-radius: 50%;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-top-color: #333;
    animation: spin 1s infinite linear;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.ui-tabs .ui-tabs-nav li {
    height: 25px; /* Adjust to desired height */
}
.ui-tabs .ui-tabs-nav li a {
    padding-top: 1px; /* Adjust top padding */
    padding-bottom: 1px; /* Adjust bottom padding */
}
#tabs ul li a {
    height: 24px; /* Adjust to your desired height */
    line-height: 24px; /* If you want the text vertically centered */
    padding-top: 0px; /* Remove padding if it affects height */
    padding-bottom: 1px; /* Remove padding if it affects height */
    display: block; /* Ensure the height property is respected */
}

.overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
}

/* Popup window style with reduced outer spacing */
#commentPopup {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: white;
    padding: 15px; /* Reduced padding */
    border: 1px solid #ccc;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    min-width: 800px; /* Increased window width */
    min-height: 300px; /* Increased window height */
    width: 60%; /* Adjusted width */
    box-sizing: border-box;
    overflow: hidden;
}

/* Input area */
#commentText {
    width: 100%;
    height: 200px; /* Increased height */
    margin-bottom: 0px; /* Reduced space between textarea and buttons */
    resize: none; /* Prevent resizing */
    padding:  0px;
    box-sizing: border-box;
}

/* Button styling */
.button-container button {
    padding: 5px 5px;
    margin-left: 10px; /* Space between buttons */
    cursor: pointer;
}

/* Right-aligned button container */
.button-container {
    display: flex;
    justify-content: flex-end; /* Align buttons to the right */
    margin-top: 5px; /* Reduced space above the buttons */
    margin-bottom: 0; /* Reduced bottom spacing below buttons */
}

/* Color radio buttons styling */
.color-options {
    margin-bottom: 5px;
}

.color-option {
    margin-right: 15px;
}

/* Radio button labels with color */
.color-option input[type="radio"] {
    margin-right: 5px;
}
</style>




<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Perf genie</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="alternate icon" href="/favicon.ico">
    <link rel="stylesheet" type="text/css" href="//fonts.googleapis.com/css?family=Tangerine" />

    <#--    https://momentjs.com-->
    <script src="/plugins/moment.min.js"></script>

    <#--    https://code.jquery.com/jquery-3.6.1.min.js-->
    <script src="/plugins/jquery-3.6.1.min.js"></script>
    
    <#--    https://github.com/twbs/bootstrap/releases/download/v4.2.1/bootstrap-4.2.1-dist.zip-->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.0.4/popper.js"></script>
    <link rel="stylesheet" href="/plugins/bootstrap-4.2.1/css/bootstrap.min.css">
    <script src="/plugins/bootstrap-4.2.1/js/bootstrap.min.js"></script>

    <#--    https://blog.jqueryui.com/2022/07/jquery-ui-1-13-2-released-->
    <script src="/plugins/jquery-ui-1.13.2/jquery-ui.js"></script>
    <link rel="stylesheet" href="/plugins/jquery-ui-1.13.2/jquery-ui.css">

    <#--    https://github.com/xdan/datetimepicker-->
    <script src="/plugins/jquery.datetimepicker.full.min.js"></script>
    <link rel="stylesheet" href="/plugins/jquery.datetimepicker.min.css">
    <script src="/js/SFDataTable.js"></script>
    <script src="/js/timeseries-component.js"></script>
    <script src="/js/time-range-filter.js"></script>
    <script src="/js/progressbar.js"></script>
    <script src="/js/utils.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <!-- Load genieDashboard.js - browser will handle duplicate script tags with same src by only executing once -->
    <script src="/js/genieDashboard.js"></script>
    <script type="text/javascript" src="/plugins/toastify/toastify.js"></script>
    <link rel="stylesheet" href="/plugins/toastify/toastify.css">
    <link href="/plugins/font-awesome-4.7.0/css/font-awesome.min.css" rel="stylesheet">

    <script src="/plugins/jquery.contextMenu.min.js"></script>
    <script src="/plugins/jquery.ui.position.js"></script>
    <link rel="stylesheet" href="/plugins/jquery.contextMenu.min.css">

</head>
<body>

<!--<#include "../../header.ftl">-->
<#include "component/casp/tabsnew.ftl">
</html>