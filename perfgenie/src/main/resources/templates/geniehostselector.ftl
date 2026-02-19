<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="/js/tooltipLegend.js"></script>
<!-- Load input fields managers -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<!-- Load autocomplete-dropdown.js before genieDashboard.js since genieDashboard uses AutocompleteDropdown class -->
<script src="/js/autocomplete-dropdown.js"></script>
<!-- Load tooltipLegend.js before genieDashboard.js since genieDashboard uses TooltipLegend module -->
<script src="/js/tooltipLegend.js"></script>
<!-- Load input fields managers before genieDashboard.js since genieDashboard uses updateInputFields function -->
<!-- Load data manager first (no dependencies) -->
<script src="/js/inputFieldsDataManager.js"></script>
<!-- Load UI manager second (depends on data manager) -->
<script src="/js/inputFieldsUIManager.js"></script>
<!-- Load coordinator last (depends on both) -->
<script src="/js/inputFieldsManager.js"></script>
<!-- Load PanelRegistry.js before genieDashboard.js since genieDashboard uses PanelRegistry class -->
<script src="/js/modules/core/PanelRegistry.js"></script>
<!-- Load DataCache.js before genieDashboard.js since genieDashboard uses DataCache module -->
<script src="/js/modules/data/DataCache.js"></script>
<!-- Load Styles.js before genieDashboard.js since genieDashboard uses Styles module -->
<script src="/js/modules/utils/Styles.js"></script>
<!-- Load ConfigParser.js before genieDashboard.js since genieDashboard uses ConfigParser module -->
<script src="/js/modules/utils/ConfigParser.js"></script>
<!-- Load DashboardChatAssistant.js before genieDashboard.js since genieDashboard uses DashboardChatAssistant module -->
<script src="/js/modules/dashboard/DashboardChatAssistant.js"></script>
<!-- Load PanelLayout.js before genieDashboard.js since genieDashboard uses PanelLayout module -->
<script src="/js/modules/layout/PanelLayout.js"></script>
<!-- Load LayoutUtils.js before genieDashboard.js since genieDashboard uses LayoutUtils module -->
<script src="/js/modules/layout/LayoutUtils.js"></script>
<!-- Load Helpers.js before genieDashboard.js since genieDashboard uses Helpers module -->
<script src="/js/modules/utils/Helpers.js"></script>
<!-- Load QueryProcessor.js before genieDashboard.js since genieDashboard uses QueryProcessor module -->
<script src="/js/modules/data/QueryProcessor.js"></script>
<!-- Load TemplateVariables.js before genieDashboard.js since genieDashboard uses TemplateVariables module -->
<script src="/js/modules/utils/TemplateVariables.js"></script>
<!-- Load DataFetcher.js before genieDashboard.js since genieDashboard uses DataFetcher module -->
<script src="/js/modules/data/DataFetcher.js"></script>
<!-- Load DataProcessor.js before genieDashboard.js since genieDashboard uses DataProcessor module -->
<script src="/js/modules/data/DataProcessor.js"></script>
<!-- Load DataUtils.js before genieDashboard.js since genieDashboard uses DataUtils module -->
<script src="/js/modules/data/DataUtils.js"></script>
<!-- Load PanelUtils.js before genieDashboard.js since genieDashboard uses PanelUtils module -->
<script src="/js/modules/panels/PanelUtils.js"></script>
<!-- Load PanelRenderer.js before genieDashboard.js since genieDashboard uses PanelRenderer module -->
<script src="/js/modules/panels/PanelRenderer.js"></script>
<!-- Load PositionCalculator.js before PanelStateManager.js since PanelStateManager uses PositionCalculator -->
<script src="/js/modules/panels/PositionCalculator.js"></script>
<!-- Load PanelStateManager.js before genieDashboard.js since genieDashboard uses PanelStateManager module -->
<script src="/js/modules/panels/PanelStateManager.js"></script>
<!-- Load PanelPositioning.js before genieDashboard.js since genieDashboard uses PanelPositioning module -->
<script src="/js/modules/layout/PanelPositioning.js"></script>
<!-- Load ChartRenderer.js before genieDashboard.js since genieDashboard uses ChartRenderer module -->
<script src="/js/modules/charts/ChartRenderer.js"></script>
<!-- Load ChartInteractions.js before genieDashboard.js since genieDashboard uses ChartInteractions module -->
<script src="/js/modules/charts/ChartInteractions.js"></script>
<!-- Load ChartActions.js before genieDashboard.js since genieDashboard uses ChartActions module -->
<script src="/js/modules/charts/ChartActions.js"></script>
<!-- Load ChartUtils.js before genieDashboard.js since genieDashboard uses ChartUtils module -->
<script src="/js/modules/utils/ChartUtils.js"></script>
<!-- Load Validator.js before genieDashboard.js since genieDashboard uses Validator module -->
<script src="/js/modules/utils/Validator.js"></script>
<!-- Load IdGenerator.js before genieDashboard.js since genieDashboard uses IdGenerator module -->
<script src="/js/modules/utils/IdGenerator.js"></script>
<!-- Load ConfigUtils.js before genieDashboard.js since genieDashboard uses ConfigUtils module -->
<script src="/js/modules/utils/ConfigUtils.js"></script>
<!-- Load FileUtils.js before genieDashboard.js since genieDashboard uses FileUtils module -->
<script src="/js/modules/utils/FileUtils.js"></script>
<!-- Load EventBus.js before genieDashboard.js since genieDashboard uses EventBus module -->
<script src="/js/modules/core/EventBus.js"></script>
<!-- Load ChartConfigBuilder.js before genieDashboard.js since genieDashboard uses ChartConfigBuilder module -->
<script src="/js/modules/charts/ChartConfigBuilder.js"></script>
<!-- Load LegendManager.js before genieDashboard.js since genieDashboard uses LegendManager module -->
<script src="/js/modules/charts/LegendManager.js"></script>
<!-- Load PanelSettings.js before genieDashboard.js since genieDashboard uses PanelSettings module -->
<script src="/js/modules/features/PanelSettings.js"></script>
<!-- Load genieCheckHandler.js before genieDashboard.js since genieDashboard uses genie check functionality -->
<script src="/js/genieCheckHandler.js"></script>
<!-- Load genieDashboard.js - browser will handle duplicate script tags with same src by only executing once -->
<script src="/js/genieDashboard.js"></script>


<script>
    $("#host-label1").on("click", function (e) {
    $("#dashboard-container-collapse-bar").trigger("click");
});

    function getHostHintDashboardJson(substrate,cell,fi,domain){
    const dashboardJson = {
    toolbar: {
    enabled: false,  // Set to false to hide toolbar
    showTimeRange: true,  // Show time range selector (clock icon)
    showInterval: true,  // Show interval input
    showAggregation: true,  // Show aggregation dropdown
    showRefresh: true,  // Show refresh button
    collapse: true,
    edit: false
},
    "panels": [
{
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "fieldConfig": {
    "defaults": {
    "color": {
    "mode": "palette-classic"
},
    "custom": {
    "axisCenteredZero": false,
    "axisColorMode": "text",
    "axisLabel": "",
    "axisPlacement": "auto",
    "barAlignment": 0,
    "drawStyle": "line",
    "fillOpacity": 0,
    "gradientMode": "none",
    "hideFrom": {
    "legend": false,
    "tooltip": false,
    "viz": false
},
    "lineInterpolation": "linear",
    "lineWidth": 1,
    "pointSize": 5,
    "scaleDistribution": {
    "type": "linear"
},
    "showPoints": "auto",
    "spanNulls": false,
    "stacking": {
    "group": "A",
    "mode": "none"
},
    "thresholdsStyle": {
    "mode": "off"
}
},
    "mappings": [],
    "thresholds": {
    "mode": "absolute",
    "steps": [
{
    "color": "green",
    "value": null
},
{
    "color": "red",
    "value": 80
}
    ]
}
},
    "overrides": []
},
    "gridPos": {
    "h": 8,
    "w": 24,
    "x": 0,
    "y": 0
},
    stats: ['avg'],
    "id": 10,
    "options": {
    "legend": {
    "calcs": [
    "mean",
    "max"
    ],
    "displayMode": "tooltip",
    "placement": "bottom",
    "showLegend": true
},
    "tooltip": {
    "mode": "single",
    "sort": "desc"
},
    seriesContextMenu: [
{
    label: 'Select host',
    handler: function (key) {
    //avg:fra44-casam-app-blue-6bd4848db4-bzkgf:result
    let tokens = key.split(":");
    $("#host-input1").val(tokens[1]);
    $("#host-input1").trigger('change');
    $("#dashboard-container-collapse-bar").click();
}
}
    ],
    aggregation: {
    tag: 'k8s_pod_name',           // Tag name to use as aggregation key
    type: 'avg',           // Default aggregation type (optional)
    span: '1m',            // Optional: span duration for time window aggregation
    spanAggregation: 'avg' // Optional: aggregation type for span (sum or avg)
},
    statsTable: {
    "defaultSort": "avg:walltime",
    transpose: false,  // Table will be transposed by default
    base_series: 'walltime',
    'previous': 'none',
    //'displayName': "metric",
    'percentBase': "walltime",
    'percentTargets': ["cputime","dbtime","oradbtime","trcache","caching","redis","search","phoenix","safepoint","callout"]
},
},
    "targets": [
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-WALL_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#/(^.*$)/walltime/#,#regex#)",
    "refId": "A",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(SCALE(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-DB_TOTAL_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#0.000001#),#/(^.*$)/dbtime/#,#regex#)",
    "refId": "C",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#/(^.*$)/cputime/#,#regex#)",
    "refId": "B",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.OracleStat-DB_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#/(^.*$)/oradbtime/#,#regex#)",
    "refId": "D",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(SCALE(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-TRANSACTIONAL_CACHE{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#0.000001#),#/(^.*$)/trcache/#,#regex#)",
    "refId": "E",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(SCALE(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-MEMCACHED{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#0.000001#),#/(^.*$)/caching/#,#regex#)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.ApexLogMetric-CALLOUT_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#/(^.*$)/callout/#,#regex#)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(SCALE(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-REDIS{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#0.000001#),#/(^.*$)/redis/#,#regex#)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(SCALE(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-PHOENIX_EXEC_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#0.000001#),#/(^.*$)/phoenix/#,#regex#)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-SEARCH_QUERY_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#/(^.*$)/search/#,#regex#)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(GROUPBYTAG(PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-SAFEPOINT_TIME{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#0#,#value#),#1m#),PROPAGATE(CULL_BELOW(RATE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:avg:$interval-avg),#1#,#value#),#1m#),#k8s_pod_name#,#DIVIDE#),#/(^.*$)/safepoint/#,#regex#)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
}

    ],
    "title": "Host selector hints, right click on series name to select a host",
    "type": "timeseries",
    tab: 'Statistics',
    tabs: true,
    transpose: false,
},
{
    statsTable: {
    'previous': '-7d'
},
    stats: ['avg'],
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "description": "Overall APT broken down by time spent in different subsystems.",
    "fieldConfig": {
    "defaults": {
    "color": {
    "mode": "palette-classic"
},
    "custom": {
    "axisCenteredZero": false,
    "axisColorMode": "text",
    "axisLabel": "",
    "axisPlacement": "auto",
    "axisSoftMin": 0,
    "barAlignment": 0,
    "drawStyle": "line",
    "fillOpacity": 0,
    "gradientMode": "none",
    "hideFrom": {
    "legend": false,
    "tooltip": false,
    "viz": false
},
    "lineInterpolation": "linear",
    "lineWidth": 1,
    "pointSize": 5,
    "scaleDistribution": {
    "type": "linear"
},
    "showPoints": "never",
    "spanNulls": false,
    "stacking": {
    "group": "A",
    "mode": "none"
},
    "thresholdsStyle": {
    "mode": "area"
}
},
    "mappings": [],
    "thresholds": {
    "mode": "absolute",
    "steps": [
{
    "color": "transparent",
    "value": null
},
{
    "color": "orange",
    "value": 500
},
{
    "color": "red",
    "value": 3000
}
    ]
},
    "unit": "ms"
},
    "overrides": [
{
    "matcher": {
    "id": "byRegexp",
    "options": "/wall_time/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Wall Clock Time"
},
{
    "id": "color",
    "value": {
    "fixedColor": "dark-green",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/app_cpu_time/"
},
    "properties": [
{
    "id": "displayName",
    "value": "App CPU Time"
},
{
    "id": "color",
    "value": {
    "fixedColor": "dark-orange",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/db_total_time/"
},
    "properties": [
{
    "id": "displayName",
    "value": "DB Total Time"
},
{
    "id": "color",
    "value": {
    "fixedColor": "dark-red",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/ora_db_time/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Oracle DB Time"
},
{
    "id": "color",
    "value": {
    "fixedColor": "super-light-red",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/transactional_cache/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Transactional Cache"
},
{
    "id": "color",
    "value": {
    "fixedColor": "semi-dark-blue",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/memcached/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Memcached / Redis / CaaS"
},
{
    "id": "color",
    "value": {
    "fixedColor": "light-blue",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/apex_callout/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Apex Callout"
},
{
    "id": "color",
    "value": {
    "fixedColor": "#0c867c",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/redis/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Redis (Unused)"
},
{
    "id": "color",
    "value": {
    "fixedColor": "light-green",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/phoenix_hbase_query/"
},
    "properties": [
{
    "id": "displayName",
    "value": "HBase / Phoenix"
},
{
    "id": "color",
    "value": {
    "fixedColor": "light-yellow",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/search_query/"
},
    "properties": [
{
    "id": "displayName",
    "value": "Search Query"
},
{
    "id": "color",
    "value": {
    "fixedColor": "light-red",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/safepoint/"
},
    "properties": [
{
    "id": "displayName",
    "value": "JVM Safepoint"
},
{
    "id": "color",
    "value": {
    "fixedColor": "#7a3913ba",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/gc_pause/"
},
    "properties": [
{
    "id": "displayName",
    "value": "GC Pause"
},
{
    "id": "color",
    "value": {
    "fixedColor": "#510e72",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/ora_db_time/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "#FFA6B0",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/transactional_cache/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "#1F60C4",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/memcached/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "rgb(78, 155, 166)",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/apex_callout/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "rgb(89, 77, 77)",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/redis/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "#96D98D",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/phoenix_hbase_query/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "#8AB8FF",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/search_query/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "#FF7383",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/safepoint/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "rgb(112, 85, 17)",
    "mode": "fixed"
}
}
    ]
},
{
    "matcher": {
    "id": "byRegexp",
    "options": "/gc_pause/"
},
    "properties": [
{
    "id": "color",
    "value": {
    "fixedColor": "#8F3BB8",
    "mode": "fixed"
}
}
    ]
}
    ]
},
    "gridPos": {
    "h": 9,
    "w": 24,
    "x": 0,
    "y": 8
},
    "id": 8,
    "options": {
    "legend": {
    "calcs": [],
    "displayMode": "tooltip",
    "placement": "bottom",
    "showLegend": true
},
    "tooltip": {
    "mode": "multi",
    "sort": "desc"
}
},
    "pluginVersion": "8.1.8",
    "targets": [
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "hide": false,
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-WALL_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #wall_time#,#literal#\n)",
    "refId": "A",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #app_cpu_time#,#literal#\n)",
    "refId": "B",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            SCALE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-DB_TOTAL_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max,#0.000001#)\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #db_total_time#,#literal#\n)",
    "refId": "C",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.OracleStat-DB_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #ora_db_time#,#literal#\n)",
    "refId": "D",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            SCALE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-TRANSACTIONAL_CACHE{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max,#0.000001#)\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #transactional_cache#,#literal#\n)",
    "refId": "E",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            SCALE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-MEMCACHED{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max,#0.000001#)\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #memcached#,#literal#\n)",
    "refId": "F",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.ApexLogMetric-CALLOUT_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #apex_callout#,#literal#\n)",
    "refId": "G",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            SCALE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-REDIS{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max,#0.000001#)\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #redis#,#literal#\n)",
    "refId": "H",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            SCALE($start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.TimeEvent-PHOENIX_EXEC_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max,#0.000001#)\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #phoenix_hbase_query#,#literal#\n)",
    "refId": "I",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-SEARCH_QUERY_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #search_query#,#literal#\n)",
    "refId": "J",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-SAFEPOINT_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #safepoint#,#literal#\n)",
    "refId": "K",
    "target": "select metric",
    "type": "timeserie"
},
{
    "aggregator": "avg",
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "downsampleAggregator": "avg",
    "queryMode": "expression",
    "rawSql": "ALIAS(\n  DOWNSAMPLE(\n    DIVIDE(\n      SUM(\n        CULL_BELOW(\n          RATE(\n            $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-GC_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n          ),\n          #0#,#value#\n        ),\n        #union#\n      ),\n      CULL_BELOW(\n        SUM(\n          CULL_BELOW(\n            RATE(\n              $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max\n            ),\n            #0#,#value#\n          ),\n          #union#\n        ),\n        #1#,#value#\n      ),\n      #union#,#0#\n    ),\n    #$interval-$agg#\n  ),\n  #gc_pause#,#literal#\n)",
    "refId": "L",
    "target": "select metric",
    "type": "timeserie"
}
    ],
    "title": "APT Dissection (ms / request)",
    "type": "timeseries"
}
    ],
    "templating": {
    "list": [
{
    "current": {
    "selected": false,
    "text": "aws",
    "value": substrate
},
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "definition": "",
    "hide": 0,
    "includeAll": false,
    "label": "Substrate",
    "multi": false,
    "name": "substrate",
    "options": [],
    "query": "type(scope),scope(core."+substrate + "."+fi+"."+domain+"),metric(java-lang_type-Runtime.Uptime),tagk(k8s_container_name),tagv(coreapp),limit(5000)",
    "refresh": 1,
    "regex": "/core\\.(.*)\\..*\\..*/",
    "skipUrlSync": false,
    "sort": 1,
    "tagValuesQuery": "",
    "tagsQuery": "",
    "type": "query",
    "useTags": false
},
{
    "current": {
    "selected": false,
    "text": cell,
    "value": cell
},
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "definition": "",
    "hide": 0,
    "includeAll": false,
    "label": "Cell",
    "multi": false,
    "name": "cell",
    "options": [],
    "query": "type(tagv),scope(core."+substrate + "."+fi+"."+domain+"),metric(java-lang_type-Runtime.Uptime),tag(k8s_container_name=coreapp),tagk(cell),limit(5000)",
    "refresh": 1,
    "regex": "",
    "skipUrlSync": false,
    "sort": 1,
    "tagValuesQuery": "",
    "tagsQuery": "",
    "type": "query",
    "useTags": false
},
{
    "current": {
    "selected": false,
    "text": fi,
    "value": fi
},
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "definition": "",
    "hide": 0,
    "includeAll": false,
    "label": "Falcon Instance",
    "multi": false,
    "name": "falcon_instance",
    "options": [],
    "query": "type(scope),scope(core."+substrate + "."+fi+"."+domain+"),metric(java-lang_type-Runtime.Uptime),tagk(cell),tagv("+cell+"),limit(5000)",
    "refresh": 1,
    "regex": "/core\\..*\\.(.*)\\..*/",
    "skipUrlSync": false,
    "sort": 1,
    "tagValuesQuery": "",
    "tagsQuery": "",
    "type": "query",
    "useTags": false
},
{
    "current": {
    "selected": false,
    "text": domain,
    "value": domain
},
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "definition": "",
    "hide": 0,
    "includeAll": false,
    "label": "Functional Domain",
    "multi": false,
    "name": "functional_domain",
    "options": [],
    "query": "type(scope),scope(core."+substrate + "."+fi+"."+domain+"),metric(java-lang_type-Runtime.Uptime),tagk(cell),tagv("+cell+"),limit(5000)",
    "refresh": 1,
    "regex": "/core\\..*\\..*\\.(.*)/",
    "skipUrlSync": false,
    "sort": 1,
    "tagValuesQuery": "",
    "tagsQuery": "",
    "type": "query",
    "useTags": false
},
{
    "allValue": "*",
    "current": {
    "selected": false,
    "text": [
    "All"
    ],
    "value": [
    "$__all"
    ]
},
    "datasource": {
    "type": "argus",
    "uid": "000000001"
},
    "definition": "",
    "hide": 0,
    "includeAll": true,
    "label": "k8s Pod",
    "multi": true,
    "name": "pod",
    "options": [],
    "query": "service(metrics?expression=$start:$end:kube-state-metrics.*.$falcon_instance.$functional_domain:kube_pod_container_info{k8s_namespace=core-on-sam,k8s_container_name=coreapp,k8s_pod_name=$cell-*-app-*}:avg:1m-avg),jsonpath(value=value.tags.k8s_pod_name)",
    "refresh": 2,
    "regex": "",
    "skipUrlSync": false,
    "sort": 1,
    "tagValuesQuery": "",
    "tagsQuery": "",
    "type": "query",
    "useTags": false
},
{
    "auto": false,
    "auto_count": 300,
    "auto_min": "10s",
    "current": {
    "selected": true,
    "text": "1m",
    "value": "1m"
},
    "hide": 0,
    "label": "Interval",
    "name": "interval",
    "options": [
{
    "selected": true,
    "text": "1m",
    "value": "1m"
},
{
    "selected": false,
    "text": "2m",
    "value": "2m"
},
{
    "selected": false,
    "text": "5m",
    "value": "5m"
},
{
    "selected": false,
    "text": "10m",
    "value": "10m"
},
{
    "selected": false,
    "text": "30m",
    "value": "30m"
},
{
    "selected": false,
    "text": "1h",
    "value": "1h"
},
{
    "selected": false,
    "text": "6h",
    "value": "6h"
},
{
    "selected": false,
    "text": "12h",
    "value": "12h"
},
{
    "selected": false,
    "text": "1d",
    "value": "1d"
},
{
    "selected": false,
    "text": "7d",
    "value": "7d"
}
    ],
    "query": "1m,2m,5m,10m,30m,1h,6h,12h,1d,7d",
    "refresh": 2,
    "skipUrlSync": false,
    "type": "interval"
},
{
    "current": {
    "selected": false,
    "text": "avg",
    "value": "avg"
},
    "description": "Aggregation options for graphs, in conjunction with the interval.",
    "hide": 0,
    "includeAll": false,
    "label": "Aggregate",
    "multi": false,
    "name": "agg",
    "options": [
{
    "selected": true,
    "text": "avg",
    "value": "avg"
},
{
    "selected": false,
    "text": "sum",
    "value": "sum"
},
{
    "selected": false,
    "text": "min",
    "value": "min"
},
{
    "selected": false,
    "text": "max",
    "value": "max"
}
    ],
    "query": "avg,sum,min,max",
    "skipUrlSync": false,
    "type": "custom"
}
    ]
}
};
    return dashboardJson;
}

    function getHostHintinputjson(start,end){
    const inputJson = {
    panelRefreshOnTimeRangeChange: false,  // auto refresh panels on timerange change
    isAnomalyProcessInUI: false,  // Set to false to use backend
    // Optional backend configuration
    //genieAnomalyEndpoint: '/api/v1/genie/anomaly',  // Custom endpoint (optional)
    genieAnomalyMaxDataPoints: 3600,  // Max data points per series (optional)
    genieAnomalyEnablePattern: false,  // Enable pattern analysis (optional)
    // Backend calculation parameter (affects how anomaly score is calculated)
    genieAnomalyThreshold: 1.5,  // Default: 1.5 (IQR multiplier)
    // UI collapse/expand threshold (for final anomaly scores 0.0-1.0)
    genieAnomalyCollapseThreshold: 0.4,  // Default: 0.3
    // Alternative name for collapse threshold (for backward compatibility)
    genieAnomalyColorThreshold: 0.3,  // Used if genieAnomalyCollapseThreshold not set
    genieNonCompareThresholdPercent: 10, //at least this percent of group should be above genieAnomalyColorThreshold, if so all members greater than genieAnomalyColorThreshold average should used to sort panels
    includePanelsAboveThreshold: true,  // dashboard assistant, only in genie check view, if this is true include panels that are above threshold which is _geniePanelsMetThresholdList, for step 1 metadata and step 2 batch requests


    // REST endpoint with QEURY placeholder (will be replaced with URL-encoded query)
    argus: '/v1/geniequery/?query=QEURY',
    genie: '/v1/geniequery/?query=QEURY',
    // Variables to replace in queries (all $ keys will be replaced)
    '$start': start,//1763514000000,  // 1 hour ago
    '$end': end,//1763517600000,
    "placeholdernamemappings": {
    "Cell": ["$cell", "$cellkey"],
    "Substrate": ["$substrate", "$sub"],
    "HF Instance": ["$fi", "$falcon_instance", "$fd_instance", "$instance"],
    "Domain": ["$fd", "$functional_domain", "$domain"],
    "Interval": ["$interval"],
    "Aggregate": ["$agg", "$aggregation"]
},
    //'previous': 'none',
    '$host': 'tmphost',
    'overrides': {
    "panels":
{
    "options": {
    "legend": {
    "displayMode": "tooltip"
}
}
}
}
};
    return inputJson;
}

    let hosthintdashboard = undefined;
    function loadDashboard(substrate,cell,fi,domain,start,end) {
    if(hosthintdashboard != undefined){
    //hosthintdashboard.destroy();
}
    hosthintdashboard = new GenieDashboard('dashboard-container');
    let dashboardJson = getHostHintDashboardJson(substrate,cell,fi,domain);
    let inputJson = getHostHintinputjson(start,end);
    hosthintdashboard.render(dashboardJson, inputJson);
}

    function handleHostHints(startTime1, endTime1, tenant1){
    //falcon-aws-prod2-apsouth1-core1-ind86
    let cell="";
    let substrate = "";
    let fi = "";
    let domain = "";

    if(tenant1.includes("falcon")){
    let tokens = tenant1.split("-");
    cell = tokens[5];
    substrate = tokens[1];
    fi = substrate + "-" + tokens[2] + "-" + tokens[3];
    domain = tokens[4];
}
    if ($("#dashboard-container").length) {
    $("#dashboard-container").removeClass("hide");
}
    loadDashboard(substrate,cell,fi,domain,startTime1,endTime1);
    //dashboard.destroy();

    //if ($("#dashboard-container").length) {
    //$("#dashboard-container").removeClass("hide");
    //}
}

</script>
