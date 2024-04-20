<script>
    /*
* Copyright (c) 2022, Salesforce.com, Inc.
* All rights reserved.
* SPDX-License-Identifier: BSD-3-Clause
* For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
*/
</script>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Title</title>

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

    <#--    https://github.com/twbs/bootstrap/releases/download/v4.2.1/bootstrap-4.2.1-dist.zip-->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.0.4/popper.js"></script>
    <link rel="stylesheet" href="/plugins/bootstrap-4.2.1/css/bootstrap.min.css">
    <script src="/plugins/bootstrap-4.2.1/js/bootstrap.min.js"></script>

    <link rel="stylesheet" href="/css/profiler.css">
    <script src="/js/input.js"></script>
    <script src="/js/utils.js"></script>
    <script src="/js/SFlameGraph.js"></script>
    <script src="/js/SFDataTable.js"></script>
    <link rel="stylesheet" href="/css/SFlameGraph.css">

    <link rel="stylesheet" type="text/css" href="/plugins/dataTables.jqueryui.min.css"/>
    <script type="text/javascript" src="/plugins/jquery.dataTables.min.js"></script>
    <script type="text/javascript" src="/plugins/dataTables.jqueryui.min.js"></script>


    <script type="text/javascript" src="/plugins/d3/d3-4.10.0.min.js"></script>
    <script type="text/javascript" src="/plugins/d3/d3-tip.min.js"></script>
    <script type="text/javascript" src="/plugins/d3/d3.flameGraph.min.js"></script>
    <link rel="stylesheet" href="/plugins/d3/d3.flameGraph.min.css">
    <script type="text/javascript" src="/plugins/c3/c3-0.7.14.min.js"></script>
    <link rel="stylesheet" href="/plugins/c3/c3.min.css">
    <script src="/plugins/jquery.contextMenu.min.js"></script>
    <script src="/plugins/jquery.ui.position.js"></script>
    <link rel="stylesheet" href="/plugins/jquery.contextMenu.min.css">

    <script type="text/javascript" src="/plugins/toastify/toastify.js"></script>
    <link rel="stylesheet" href="/plugins/toastify/toastify.css">

    <link rel="stylesheet" href="/plugins/bootstrap-toggle.min.css">
    <script src="/plugins/bootstrap-toggle.min.js"></script>
    <script type="text/javascript" src="/plugins/plotly.min.js"></script>

    <script src="/plugins/bootstrap-multiselect.js"></script>
    <link rel="stylesheet" href="/plugins/bootstrap-multiselect.css">

    <link href="/plugins/font-awesome-4.7.0/css/font-awesome.min.css" rel="stylesheet">


</head>
<body>
<div id="header" style=" background-color: #429CD6">
    <h3  style="display:table-cell;vertical-align:middle;padding-left: 10px;color: white;">PerfGenie</h3>
</div>
<#include "input.ftl">
<#include "filter-panel.ftl">
<#include "tabs.ftl">
</body>
</html>