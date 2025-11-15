
<!-- Chart.js is loaded here, but jQuery and genieDashboard.js are already loaded in canarynew.ftl -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<div id="dashboard-container1"></div>

<script>
$(document).ready(() => {
        // 4. Initialize and render the dashboard
        const dashboard1 = new GenieDashboard('dashboard-container1');

        //////
        // Override fetchData method to return mock data

        // Track fetch calls to handle multiple targets and previous period detection
        let fetchCallCount = 0;
        let timeseriesFetchCount = 0; // Track only timeseries panel calls (exclude stat panel)
        let originalStartValue = null;
        let originalEndValue = null;
        let currentPeriodRange = null;

        dashboard1.fetchData1 = async function(endpoint, query, startTimestamp = null, endTimestamp = null) {
            fetchCallCount++;

            // Check if this is for a stat panel
            if (query && query.includes('COUNT')) {
                // For stat panels, return a single value
                let isPreviousPeriod = false;
                // Detect previous period (simplified - check timestamp difference)
                if (originalStartValue && startTimestamp && startTimestamp < originalStartValue - 3600000) {
                    isPreviousPeriod = true;
                }
                return {
                    displayName: 'Total Requests',
                    datapoints: {
                        [Date.now()]: Math.floor(Math.random() * 10000) + (isPreviousPeriod ? 4000 : 6000)
                    }
                };
            }

            // Track timeseries panel calls
            timeseriesFetchCount++;
            // Determine which target based on call order
            // Odd calls (1, 3, 5...) = target A, Even calls (2, 4, 6...) = target B
            const isTargetA = (timeseriesFetchCount % 2 === 1);
            const targetMetric = isTargetA ? 'cpu_usage' : 'memory_usage';

            // Detect previous period
            let isPreviousPeriod = false;
            if (originalStartValue && startTimestamp && startTimestamp < originalStartValue - 3600000) {
                isPreviousPeriod = true;
            }

            // Use provided timestamps if available, otherwise use defaults
            let queryStart = startTimestamp || (Date.now() - 3600000);
            let queryEnd = endTimestamp || Date.now();

            // Store original period on first call
            if (!originalStartValue) {
                originalStartValue = queryStart;
                originalEndValue = queryEnd;
                currentPeriodRange = queryEnd - queryStart;
            }

            // Generate multiple series for the target metric
            const response = [];
            const scopes = ['core.aws.aws-prod0-uswest2.core1', 'core.aws.aws-prod0-uswest2.core2'];
            const cells = ['usa12', 'usa13'];
            const roles = ['app', 'api'];
            const seriesCount = 1; // 2 series per target

            for (let i = 0; i < seriesCount; i++) {
                const scope = scopes[i % scopes.length];
                const cell = cells[i % cells.length];
                const role = roles[i % roles.length];

                // Generate datapoints for this series
                const datapoints = {};
                const dataPointCount = 20;
                const timeRange = queryEnd - queryStart;
                const interval = Math.max(60000, Math.floor(timeRange / dataPointCount));

                // Different base values for different metrics
                let baseValue = 50;
                if (targetMetric === 'cpu_usage') {
                    baseValue = 60 + (i * 15); // CPU usage: 60-75%
                } else if (targetMetric === 'memory_usage') {
                    baseValue = 70 + (i * 20); // Memory usage: 70-90%
                }

                for (let j = 0; j < dataPointCount; j++) {
                    const timestamp = queryStart + (j * interval);
                    const variation = (Math.random() * 20) - 10; // ±10 variation
                    const adjustedValue = isPreviousPeriod
                        ? (baseValue + variation) * (0.9 + Math.random() * 0.2)
                        : baseValue + variation;
                    datapoints[timestamp] = Math.max(0, adjustedValue);
                }

                response.push({
                    scope: scope,
                    metric: targetMetric,
                    tags: {
                        cell: cell,
                        role: role,
                        service: 'coreapp',
                        pod: cell + '-pod-' + (i % 3),
                        k8s_pod_name: cell + '-casam-app-blue-' + (i % 2),
                        environment: 'prod'
                    },
                    // displayName will be auto-generated from scope:metric:{tags}
                    datapoints: datapoints  // Object format: { "timestamp": value }
                });
            }

            return response; // Return array format
        };
        ///////////



        // 5. Define dashboard configuration (Grafana-style JSON)
        const dashboardJson = {
        toolbar: {
                enabled: true,  // Set to false to hide toolbar
                showTimeRange: true,  // Show time range selector (clock icon)
                showInterval: true,  // Show interval input
                showAggregation: true,  // Show aggregation dropdown
                showRefresh: true,  // Show refresh button
                collapse:false,
                edit: true
            },
        panels: [
        /*{
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
        tab: 'Timeseries',
        tabs: true,
        transpose: false,
        type: 'timeseries',  // or 'stat', 'table', 'gauge', 'bargauge'
        title: 'Example Time Series Chart with Tooltips',
        description: 'Hover over the chart to see interactive tooltips showing all series values at each timestamp',
        gridPos: { x: 0, y: 0, w: 24, h: 6 },  // Grid position (24-column system)
        stats: ['avg','max'],  // Statistics for stats tab
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
        download: true,
        aggregation : {
                            //tag: 'k8s_pod_name',           // Tag name to use as aggregation key
                            type: 'sum',           // Default aggregation type (optional)
                            span: '1m',            // Optional: span duration for time window aggregation
                            spanAggregation: 'sum' // Optional: aggregation type for span (sum or avg)
                            },
        statsTable: {
                    transpose: false,  // Table will be transposed by default
                    base_series: 'Wallclock Time',
                    'previous': 'none,-1d,-7d,-14d,-21d,-28d',
                    'displayName': "scope",
                    'percentBase': "cpu_time",
                    'percentTargets': ["wall_time"]
                },
"timeSeries": {
    "zoomSlider": true,
    "zoomSliderPosition": "bottom",
    "sort":true
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
            refId: 'wall_time',
            rawSql: 'ALIAS( DOWNSAMPLE( DIVIDE( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-WALL_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), CULL_BELOW( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), #1#,#value# ), #union#,#0# ), #$interval-$agg# ), #wall_time#,#literal# )',
            datasource: { type: 'argus' }
        },
        {
                    refId: 'cpu_time',
                    rawSql: 'ALIAS( DOWNSAMPLE( DIVIDE( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-WALL_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), CULL_BELOW( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), #1#,#value# ), #union#,#0# ), #$interval-$agg# ), #wall_time#,#literal# )',
                    datasource: { type: 'argus' }
                }
        ]
        },
        {
                id: 5,
                seriesContextMenu: [
                                {
                                    label: 'Select host',
                                    handler: function(seriesName) {
                                        console.log('View details for:', seriesName);
                                        alert('View details for: ' + seriesName);
                                    }
                                }
                                ],
                tab: 'Timeseries',
                tabs: true,
                transpose: false,
                type: 'timeseries',  // or 'stat', 'table', 'gauge', 'bargauge'
                title: 'Example Time Series Chart with Tooltips',
                description: 'Hover over the chart to see interactive tooltips showing all series values at each timestamp',
                gridPos: { x: 0, y: 6, w: 24, h: 6 },  // Grid position (24-column system)
                stats: ['avg','max'],  // Statistics for stats tab
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
                aggregation : {
                                    tag: 'k8s_pod_name',           // Tag name to use as aggregation key
                                    type: 'sum',           // Default aggregation type (optional)
                                    span: '1m',            // Optional: span duration for time window aggregation
                                    spanAggregation: 'avg' // Optional: aggregation type for span (sum or avg)
                                    },
                statsTable: {
                            transpose: false,  // Table will be transposed by default
                            base_series: 'Wallclock Time',
                            'previous': 'none,-1d,-7d,-14d,-21d,-28d',
                            'displayName': "scope",
                            'percentBase': "cpu_time",
                            'percentTargets': ["wall_time"]
                        },
        "timeSeries": {
            "zoomSlider": true,
            "zoomSliderPosition": "bottom",
            "sort":true
          },

                legend: {
                showLegend: true,
                displayMode: 'list',
                placement: 'bottom'
                },
                tooltip: {
                mode: 'multi'
                }
                },
                targets: [
                {
                    refId: 'wall_time',
                    rawSql: 'ALIAS( DOWNSAMPLE( DIVIDE( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-WALL_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), CULL_BELOW( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), #1#,#value# ), #union#,#0# ), #$interval-$agg# ), #wall_time#,#literal# )',
                    datasource: { type: 'argus' }
                },
                {
                            refId: 'cpu_time',
                            rawSql: 'ALIAS( DOWNSAMPLE( DIVIDE( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-WALL_TIME{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), CULL_BELOW( SUM( CULL_BELOW( RATE( $start:$end:core.$substrate.$fi.$fd:SFDC_type-ServerMetrics.LogMetric-COUNT{role=app,cell=$cell,k8s_pod_name=*}:none:1m-max ), #0#,#value# ), #union# ), #1#,#value# ), #union#,#0# ), #$interval-$agg# ), #wall_time#,#literal# )',
                            datasource: { type: 'argus' }
                        }
                ]
                },*/
        {
                id: 3,
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
                title: 'Pidstats',
                description: 'Hover over the chart to see interactive tooltips showing all series values at each timestamp',
                gridPos: { x: 0, y: 8, w: 24, h: 6 },  // Grid position (24-column system)
                stats: ['avg',"p95","p90"],  // Statistics for stats tab
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
                download: true,
                aggregation : {
                                            tag: 'cell',           // Tag name to use as aggregation key
                                            type: 'sum',           // Default aggregation type (optional)
                                            span: '1m',            // Optional: span duration for time window aggregation
                                            spanAggregation: 'avg' // Optional: aggregation type for span (sum or avg)
                                            },
                statsTable: {
                            transpose: false,  // Table will be transposed by default

                            'previous': '-7d,none,-1d,-7d,-14d,-21d,-28d',
                            'displayName': "scope",
                            base_series: 'containerCpu',
                            'percentBase': "containerCpu",
                            'percentTargets': ["c2Cpu","gcCpu","jfrCpu"]
                        },
                        "timeSeries": {
                            "zoomSlider": true,
                            "zoomSliderPosition": "bottom",
                            "sort":true
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
                },

        {
        id: 2,
        type: 'stat',
        title: 'Heap',

        gridPos: { x: 0, y: 14, w: 4, h: 0 },
        fieldConfig: {
        defaults: {
        unit: 'G'
        }
        },
        options: {
        reduceOptions: {
        calcs: ['lastNotNull']
        }
        },
        targets: [
        {
        refId: 'D',
        rawSql: 'HIGHEST( $start:$end:core.$substrate.$fi.$fd:java-lang_type-Memory.HeapMemoryUsage_max{cell=$cell,k8s_container_name=coreapp,k8s_pod_name=*,role=app}:avg:$interval-avg,#1# )',
        datasource: { type: 'argus' }
        }
        ]
        },
        {
               stats: ['sum'],
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
                "h": 8,
                "w": 24,
                "x": 0,
                "y": 0
              },
              "id": 9,
              tab: 'Statistics',
              "options": {
                "legend": {
                  "calcs": [],
                  "displayMode": "list",
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
                  "refId": "wall_time",
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
                  "refId": "app_cpu_time",
                  "target": "select metric",
                  "type": "timeserie"
                }
              ],
              "title": "APT Dissection (ms / request)",
              "type": "timeseries"
            }/*,
            {
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
                            "h": 8,
                            "w": 24,
                            "x": 0,
                            "y": 20
                          },
                          "id": 8,
                          "options": {
                            "legend": {
                              "calcs": [],
                              "displayMode": "list",
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
                              "refId": "wall_time",
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
                              "refId": "app_cpu_time",
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
                              "refId": "db_total_time",
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
                              "refId": "ora_db_time",
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
                              "refId": "transactional_cache",
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
                              "refId": "memcached",
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
                              "refId": "apex_callout",
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
                              "refId": "redis",
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
                              "refId": "phoenix_hbase_query",
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
                              "refId": "search_query",
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
                              "refId": "safepoint",
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
                              "refId": "gc_pause",
                              "target": "select metric",
                              "type": "timeserie"
                            }
                          ],
                          "title": "APT Dissection (ms / request)",
                          "type": "timeseries"
                        }*/
        ]
        };

        // 6. Define input configuration (endpoints and variables)
        const inputJson = {
        // REST endpoint with QEURY placeholder (will be replaced with URL-encoded query)
        argus: '/v1/geniequery/?query=QEURY',
        genie: '/v1/geniequery/?query=QEURY',
        // Variables to replace in queries (all $ keys will be replaced)
        '$start': 1762548460436,  // 1 hour ago
        '$end': 1762552060436,
        '$cell': 'usa12',
        '$substrate': 'aws',
        '$fi': 'aws-prod0-uswest2',
        '$fd': 'core1',
        '$interval': '1m',
        '$agg': 'avg',
        'previous': '-7d,none,-1d,-14d,-21d,-28d',
        '$host' : 'tmphost',
        '$instance': 'prod0.uswest2',
        'overrides' : {
        "panels":
        {
        "options":{
        "legend":{
        "displayMode":"tooltip"
        }
        }
        }

        }
        };

        // 7. Render the dashboard
        dashboard1.render(dashboardJson, inputJson);

        // 8. Optional: Clean up when done
        //dashboard.destroy();
});
</script>
