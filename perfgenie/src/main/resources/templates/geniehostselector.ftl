
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="/js/genieDashboard.js"></script>


<script>
$(document).ready(() => {
        // 4. Initialize and render the dashboard
        const dashboard = new GenieDashboard('dashboard-container');

        //////
        // Override fetchData method to return mock data

        // Track fetch calls to handle multiple targets and previous period detection
        let fetchCallCount = 0;
        let timeseriesFetchCount = 0; // Track only timeseries panel calls (exclude stat panel)
        let originalStartValue = null;
        let originalEndValue = null;
        let currentPeriodRange = null;

        dashboard.fetchData1 = async function(endpoint, query, startTimestamp = null, endTimestamp = null) {
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
                enabled: false,  // Set to false to hide toolbar
                showTimeRange: true,  // Show time range selector (clock icon)
                showInterval: true,  // Show interval input
                showAggregation: true,  // Show aggregation dropdown
                showRefresh: true,  // Show refresh button
                collapse:true
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
        title: 'Host selector hints',
        description: 'right click on a host to select',
        gridPos: { x: 0, y: 0, w: 24, h: 6 },  // Grid position (24-column system)
        stats: ['sum'],  // Statistics for stats tab
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
        options: {

        statsTable: {
                    transpose: false,  // Table will be transposed by default
                    base_series: 'Wallclock Time',
                    'previous': 'none,-1d,-7d,-14d,-21d,-28d',
                    //'previous': 'none,-7d',
                    'displayName': "cell",
                    'percentBase': "wall_time",
                    'percentTargets': ["App CPU Time","gc_pause","memcached","ora_db_time","phoenix_hbase_query","redis","search_query","transactional_cache","db_total_time","apex_callout","app_cpu_time","safepoint"]
                },
        "timeSeries": {

                                    "zoomSlider": true,
                                    "zoomSliderPosition": "bottom",
                                    "sort":false,
                                    'previous': 'none,-1d,-7d,-14d,-21d,-28d'
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
        }


        ]
        };

        // 6. Define input configuration (endpoints and variables)
        const inputJson = {
        // REST endpoint with QEURY placeholder (will be replaced with URL-encoded query)
        argus: '/v1/geniequery/?query=QEURY',

        // Variables to replace in queries (all $ keys will be replaced)
        '$start': Date.now() - 3600000,  // 1 hour ago
        '$end': Date.now(),
        '$cell': 'usa12',
        '$substrate': 'aws',
        '$fi': 'aws-prod0-uswest2',
        '$fd': 'core1',
        '$interval': '1m',
        '$agg': 'avg',
        //'previous': 'none,-1d,-7d,-14d,-21d,-28d'
        };

        // 7. Render the dashboard
        dashboard.render(dashboardJson, inputJson);

        // 8. Optional: Clean up when done
        //dashboard.destroy();
});
</script>
