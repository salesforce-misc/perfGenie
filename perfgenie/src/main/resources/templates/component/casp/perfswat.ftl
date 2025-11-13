
<div id="my-chart"></div>
<div id="perfswat-dashboard-container" style="width:100%"></div>
<div id="spinnerperfswat" style="width:100%"></div>


<div style="padding:0px !important; overflow: scroll;font-size: 95%" class="col-lg-12">
    <div id="canaryperfswatview"></div>
</div>

<script>
let perfswatdashboardJson = undefined;
let perfswatdashboard = undefined;
$(document).ready(() => {
        // 4. Initialize and render the dashboard
       perfswatdashboard = new GenieDashboard('perfswat-dashboard-container');

        // 5. Define dashboard configuration (Grafana-style JSON)
        perfswatdashboardJson = {
        toolbar: {
                enabled: false,  // Set to false to hide toolbar
                showTimeRange: true,  // Show time range selector (clock icon)
                showInterval: true,  // Show interval input
                showAggregation: true,  // Show aggregation dropdown
                showRefresh: true,  // Show refresh button
                collapse:false
            },
        panels: [
        {
        id: 1,
        seriesContextMenu: [
                        {
                            label: 'Select host',
                            handler: function(seriesName) {
                                console.log('View details for:', seriesName);
                                alert('View details for: ' + seriesName);
                            }
                        }
                        ],
        tab: 'Statistics',
        tabs: true,
        transpose: false,
        type: 'timeseries',  // or 'stat', 'table', 'gauge', 'bargauge'
        title: 'Pidstats data',
        description: 'pidstats data',
        gridPos: { x: 0, y: 0, w: 24, h: 6 },  // Grid position (24-column system)
        stats: ['sum','avg'],  // Statistics for stats tab
        fieldConfig: {
        defaults: {
        unit: 'ms',  // Unit for Y-axis
        custom: {
        drawStyle: 'line',
        lineWidth: 0.5,
        fillOpacity: 0.1,
        showPoints: 'never'
        }
        },
        overrides: [
                            {
                                matcher: { id: 'byRegexp', options: '/ddcpu_time|CPU Usage/' },
                                properties: [
                                    {
                                        id: 'displayName',
                                        value: 'CPU Usage'
                                    }
                                ]
                            },
                            {
                                matcher: { id: 'byRegexp', options: '/ddwall_time|Wallclock Time/' },
                                properties: [
                                    {
                                        id: 'displayName',
                                        value: 'Wallclock Time'
                                    }
                                ]
                            }
                        ]
        },
        options: {
        performance: true,
        aggregation : {
                                            tag: 'k8s_pod_name',           // Tag name to use as aggregation key
                                            type: 'sum',           // Default aggregation type (optional)
                                            span: '1m',            // Optional: span duration for time window aggregation
                                            spanAggregation: 'sum' // Optional: aggregation type for span (sum or avg)
                                            },
        download: true,
        statsTable: {
                    transpose: false,  // Table will be transposed by default
                    base_series: 'containerCpu',
                    'previous': '-7d,none,-1d,-7d,-14d,-21d,-28d',
                    'displayName': "scope",
                    'percentBase': "containerCpu",
                    'percentTargets': ["c2Cpu","gcCpu","jfrCpu"]
                },

                        "timeSeries": {
                            "zoomSlider": true,
                            "zoomSliderPosition": "bottom",
                            "sort":true,
                            'previous': '-7d,none,-1d,-14d,-21d,-28d',
                          },

        legend: {
        showLegend: true,
        displayMode: 'tooltip',
        placement: 'bottom'
        },
        tooltip: {
        mode: 'multi'
        }
        },
        targets: [
        {
            refId: 'pidstats',
            rawSql: '$start:$end:$instance:$cell:$datahost',
            datasource: { type: 'genie' }
        }
        ]
        }


        ]
        };

        // 6. Define input configuration (endpoints and variables)


        // 8. Optional: Clean up when done
        //dashboard.destroy();
});
</script>


