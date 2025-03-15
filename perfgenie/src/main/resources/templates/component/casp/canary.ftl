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

</style>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>New page title</title>
    <link rel="stylesheet" type="text/css" href="//fonts.googleapis.com/css?family=Tangerine" />

    <#--    https://github.com/twbs/bootstrap/releases/download/v4.2.1/bootstrap-4.2.1-dist.zip-->
    <link rel="stylesheet" href="/plugins/bootstrap-4.2.1/css/bootstrap.min.css">
    <script src="/plugins/bootstrap-4.2.1/js/bootstrap.min.js"></script>
    <#--    https://momentjs.com-->
    <script src="/plugins/moment.min.js"></script>

    <#--    https://code.jquery.com/jquery-3.6.1.min.js-->
    <script src="/plugins/jquery-3.6.1.min.js"></script>

    <#--    https://blog.jqueryui.com/2022/07/jquery-ui-1-13-2-released-->
    <script src="/plugins/jquery-ui-1.13.2/jquery-ui.js"></script>
    <link rel="stylesheet" href="/plugins/jquery-ui-1.13.2/jquery-ui.css">

    <#--    https://github.com/xdan/datetimepicker-->
    <script src="/plugins/jquery.datetimepicker.full.min.js"></script>
    <link rel="stylesheet" href="/plugins/jquery.datetimepicker.min.css">
    <script src="/js/SFDataTable.js"></script>
    <script src="/js/utils.js"></script>
    <script type="text/javascript" src="/plugins/toastify/toastify.js"></script>
    <link rel="stylesheet" href="/plugins/toastify/toastify.css">
    <link href="/plugins/font-awesome-4.7.0/css/font-awesome.min.css" rel="stylesheet">

</head>
<body>
<#include "../../header.ftl">
<#include "tabs.ftl">
</html>