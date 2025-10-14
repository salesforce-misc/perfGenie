package perfgenie.utils;

import com.google.common.io.Resources;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

import static perfgenie.utils.ArgusQueries.*;

public class ArgusQueryT {
    static String substrate = System.getenv("SUBSTRATE");
    static String GCQueryT = "START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-AveGCUsage.OneMinuteAverage{cell=CELL,k8s_pod_name=*,role=app,k8s_container_name=coreapp}:avg:1m-avg";
    static String containerResourceCount = "GROUPBYTAG(START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD,resource=cpu}:max:all-max,#k8s_container_name#,#SUM#)";
    static String containerCPUUsageSecondsTotalDiff = "DIFF(" +
            "  GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD}:min:all-min,#k8s_container_name#,#SUM#)" +
            ")";
    static String requestCPUSecondsTotalDiff = "DIFF(" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)" +
            ")";
    static String jvmCPUMsTotalDiff = "DIFF(" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuTimeMs.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuTimeMs.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)" +
            ")";
    static String totalTrustRequestCountLast_1_Min_Avg = "DOWNSAMPLE(" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#)," +
            "  #1d-sum#,#0#,#abs#" +
            ")";
    static String totalRequestsLogMetric_COUNT = "DIFF(" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)" +
            ")";
    static String avgJvmCpuPercent = "DOWNSAMPLE(" +
            "  ALIASBYREGEX(" +
            "    ALIAS(" +
            "      GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuLoadPercent.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#)," +
            "      #:#,#literal#,#CELL#,#literal#" +
            "    )," +
            "    #(.*)::\\{#" +
            "  )," +
            "  #1d-avg#,#0#,#abs#" +
            ")";
    static String avgAPT = "DOWNSAMPLE(" +
            "  ALIASBYREGEX(" +
            "    ALIAS(" +
            "      GROUPBYTAG(" +
            "        GROUPBYTAG(" +
            "          GROUPBYTAG(" +
            "            START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_pod_name#,#SCALE#,#union#" +
            "          )," +
            "          #k8s_container_name#,#SUM#,#union#" +
            "        )," +
            "        FILL(" +
            "          CULL_BELOW(" +
            "            GROUPBYTAG(" +
            "              START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#" +
            "            )," +
            "            #1#,#value#" +
            "          )," +
            "          #1m#,#0m#,#1#" +
            "        )," +
            "        #k8s_container_name#,#DIVIDE#" +
            "      )," +
            "      #:#,#literal#,#CELL#,#literal#" +
            "    )," +
            "    #(.*)::\\{#" +
            "  )," +
            "  #1d-avg#,#0#,#abs#" +
            ")";
    static String total5xx4xxCount = "DIFF(GROUPBYTAG(JOIN(" +
            "  START:END:core.aws.INSTANCE.DOMAIN:jetty.sh.response.4xx{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max," +
            "  START:END:core.aws.INSTANCE.DOMAIN:jetty.sh.response.5xx{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max" +
            "),#k8s_container_name#,#SUM#)," +
            "GROUPBYTAG(JOIN(" +
            "  START:END:core.aws.INSTANCE.DOMAIN:jetty.sh.response.4xx{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min," +
            "  START:END:core.aws.INSTANCE.DOMAIN:jetty.sh.response.5xx{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min" +
            "),#k8s_container_name#,#SUM#))";

    static String totalCoreCpuSecRequested = "SCALE(\n" +
            "  SUM(\n" +
            "    DIFF_V(\n" +
            "      DOWNSAMPLE(\n" +
            "        INTEGRAL(\n" +
            "          START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD,resource=cpu}:avg\n" +
            "        ),\n" +
            "        #all-max#\n" +
            "      ),\n" +
            "      DOWNSAMPLE(\n" +
            "        INTEGRAL(\n" +
            "          START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD,resource=cpu}:avg\n" +
            "        ),\n" +
            "        #all-min#\n" +
            "      )\n" +
            "    )\n" +
            "  ),\n" +
            "  #120#\n" +
            ")";

    static String totalSafepointTime = "DIFF(" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.totalSafepointTimeMs.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.totalSafepointTimeMs.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)" +
            ")";

    static String jvmCpuMsPerReqTimeSeries = "GROUPBYTAG(\n" +
            "  RATE(\n" +
            "    START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuTimeMs.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg\n" +
            "  ),\n" +
            "  FILL(\n" +
            "    CULL_BELOW(\n" +
            "      RATE(\n" +
            "        START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-avg\n" +
            "      ),\n" +
            "      #1#,#value#\n" +
            "    ),\n" +
            "    #1m#,#0m#,#1#\n" +
            "  ),\n" +
            "  #k8s_pod_name#,#DIVIDE#\n" +
            ")";

    static String totalSafepointTimeSeries = "ALIASBYTAG(FILL(CULL_BELOW(DERIVATIVE(START:END:core.aws.INSTANCE.DOMAIN:Jvm.totalSafepointTimeMs.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:1m-max),#-2#,#value#),#1m#,#2m#,#0#),#k8s_pod_name#)";
    static String totalOldgenTimeSeries = "START:END:core.aws.INSTANCE.DOMAIN:Jvm.lastOldGenAfterGcSizeMb.Value{cell=CELL,k8s_pod_name=POD,role=app,k8s_container_name=coreapp}:avg:1m-avg";

    static String requestCountQueryT = "GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_pod_name=*}:sum:10m-sum,#cell#,#SUM#)";

    static String canaryKpodsQueryT = "START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{k8s_container_name=coreapp,cell=CELL,k8s_pod_name=*}:sum:1m-sum";

    static String startupQueryT = "START:END:core.aws.INSTANCE.DOMAIN:AppStartup.totalStartupMs{cell=CELL,k8s_pod_name=POD}:avg:1m-avg";

    static String releaseQueryT = "ALIASBYREGEX(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:app.metric{cell=CELL,role=app,release=*,k8s_pod_name=*}:avg:all-min,#release#,#SUM#,#UNION#),#release=(.+),.*\\}#)";
    static String instanceTypeQueryT = "ALIASBYREGEX(GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_system_seconds_total{k8s_pod_name=POD,k8s_container_name=coreapp,instance_type=*}:avg:all-min,#instance_type#,#SUM#,#UNION#),#^(.+):.*#)";
    static String heapQueryT = "HIGHEST(START:END:core.aws.INSTANCE.DOMAIN:java-lang_type-Memory.HeapMemoryUsage_max{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:avg:all-max,#1#)";

    static String TotalAPTCount = "DOWNSAMPLE(COUNT(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_pod_name=POD,role=app}:avg:1m-avg),#1d-sum#)";
    static String TotalAPTCountBelow500 = "DOWNSAMPLE(COUNT(CULL_ABOVE(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_pod_name=POD,role=app}:avg:1m-avg,#500#,#value#)),#1d-sum#)";

    static String ScopeQuery = "START:END:core.*:java-lang_type-Runtime.Uptime{cell=CELL}:avg:all-max";

    public static ArgusConfig ac;

    static {
        try {
            ac = (ArgusConfig) Utils.readValue(Resources.toString(Resources.getResource("argus.json"), StandardCharsets.UTF_8), ArgusConfig.class);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public static PodConfig pc;

    static {
        try {
            pc = (PodConfig) Utils.readValue(Resources.toString(Resources.getResource("podconfig.json"), StandardCharsets.UTF_8), PodConfig.class);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }


    public static Double getAPTCount(String querytemplate, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = querytemplate.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " getAPTCount1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("heap.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "getAPTCount2 " + e.getMessage());
            }
        }
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            JSONObject object = jsonArray.getJSONObject(0);
            JSONObject datapoints = object.getJSONObject("datapoints");
            Iterator keys = datapoints.keys();
            while (keys.hasNext()) {
                String k = keys.next().toString();
                return datapoints.getDouble(String.valueOf(k));
            }
            return null;
        } catch (Exception e) {
            System.out.println("getAPTCount Exception " + e.getMessage() + ":" + metric);
            return null;
        }
    }

    public static String getScope(long timestampStart, long timestampEnd, String cell) {
        System.out.println(cell+ " getScope");

        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = ScopeQuery.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("CELL", cell);

        try {
            System.out.println("getScope query " + query);
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " getScope1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("uptime.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "getScope2 " + e.getMessage());
            }
        }
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            JSONObject object = jsonArray.getJSONObject(0);
            String scope = object.getString("scope");
            return scope;
        } catch (Exception e) {
            System.out.println("getScope Exception " + e.getMessage() + ":" + metric);
            System.out.println("getScope Exception " + query);
            return null;
        }
    }

    public static Double getHeap(long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        System.out.println(cell+ " getHeap");
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = heapQueryT.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " getHeap1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("heap.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "getHeap2 " + e.getMessage());
            }
        }
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            JSONObject object = jsonArray.getJSONObject(0);
            JSONObject datapoints = object.getJSONObject("datapoints");
            Iterator keys = datapoints.keys();
            while (keys.hasNext()) {
                String k = keys.next().toString();
                return datapoints.getDouble(String.valueOf(k));
            }
            return null;
        } catch (Exception e) {
            System.out.println("getHeap Exception " + e.getMessage() + ":" + metric);
            return null;
        }
    }

    public static String getInstanceTypeTag(long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        System.out.println(cell+ " getInstanceTypeTag");
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = instanceTypeQueryT.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " getInstanceTypeTag1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("instancetype.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "getInstanceTypeTag2 " + e.getMessage());
            }
        }
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            return jsonArray.getJSONObject(0).getJSONObject("tags").get("instance_type").toString();
        } catch (Exception e) {
            System.out.println("getInstanceTypeTag Exception " + e.getMessage() + ":" + metric);
            return null;
        }
    }

    public static String getReleaseTag(long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        System.out.println(cell+ " getReleaseTag");
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = releaseQueryT.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " getReleaseTag1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("release.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "getReleaseTag2 " + e.getMessage());
            }
        }
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            return jsonArray.getJSONObject(0).getJSONObject("tags").get("release").toString();
        } catch (Exception e) {
            System.out.println("getReleaseTag Exception " + e.getMessage() + ":" + metric);
            return null;
        }
    }

    public static QueryResponse getStatupAVG(long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods, long peakStart, long peakEnd, List<PeakRange.TimeRange> ranges, int type) {
        System.out.println(cell+ " getStatupAVG" );
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        QueryResponse response = new QueryResponse();

        String query = startupQueryT.replaceAll("START", String.valueOf(timestampStart - 7 * 24 * 60 * 60 * 1000));//previous 7 days
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        response.query = query;

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " Statup1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("startup.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "Statup2 " + e.getMessage());
            }
        }
        try {
            HashMap<String, Long> kpodStartTimeMap = new HashMap<>();
            HashMap<Long, String> startupKpodMap = new HashMap<>();
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            Double sum = 0.0;
            int count = 0;
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                String kpodname = object.getJSONObject("tags").get("k8s_pod_name").toString();
                JSONObject datapoints = object.getJSONObject("datapoints");
                long prevT = -1;
                Double prevS = 0.0;
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    Long t = Long.parseLong(k);
                    if (t > prevT) {
                        prevT = t;
                        prevS = datapoints.getDouble(String.valueOf(k));
                    }
                    while(startupKpodMap.containsKey(t)){
                        t++;
                    }
                    startupKpodMap.put(t,kpodname);
                }
                if (prevT != -1) {//consider last 24 hr startups
                    kpodStartTimeMap.put(kpodname,prevT);
                    sum = sum + prevS;
                    count++;
                }
            }
            response.setMetric(sum / count);
            List<HashMap<Long, String>> startups = getPeakStarts(instance, domain, cell, startupKpodMap, peakStart,peakEnd, ranges, type);
            System.out.println(cell + "kpods:" +  podstr);
            System.out.println(cell + " : off peak startup count " + startups.get(0).size() + " startup count:" + startupKpodMap.size()+ " pod count: " + pods.size());
            System.out.println(cell + " : peak startup count " + startups.get(1).size()+ " startup count:" + startupKpodMap.size()+ " pod count: " + pods.size());
            response.setMetric1(getWarmupAvgAPT(instance, domain, cell, startups.get(0)));
            response.setMetric2(getWarmupAvgAPT(instance, domain, cell, startups.get(1)));
            return response;
        } catch (Exception e) {
            System.out.println("getStatupAVG Exception " + e.getMessage() + ":" + metric);
            return null;
        }
    }

    public static List<HashMap<Long, String>> getPeakStarts(String instance, String domain, String cell,HashMap<Long, String> startupKpodMap, long peakStart, long peakEnd,List<PeakRange.TimeRange> ranges, int type){
         if(ranges == null){
            return null;
        }
        HashMap<Long, String> peakstartupKpodMap = new HashMap<>();
        HashMap<Long, String> offpeakstartupKpodMap = new HashMap<>();
        for (Long start : startupKpodMap.keySet()) {
            boolean ispeakStart = false;
            if(type == 3 || type == 4){
                if (start >= peakStart && start <= peakEnd) {
                    System.out.println(startupKpodMap.get(start) + ":" + Utils.convertEpochToUTCString(peakStart) + ":" + Utils.convertEpochToUTCString(start) + ":" + Utils.convertEpochToUTCString(peakEnd));
                    peakstartupKpodMap.put(start, startupKpodMap.get(start));
                    ispeakStart = true;
                    break;
                }
            }else {
                for (int i = 0; i < ranges.size(); i++) {
                    if (start >= ranges.get(i).start && start <= ranges.get(i).end) {
                        System.out.println(startupKpodMap.get(start) + ":" + Utils.convertEpochToUTCString(ranges.get(i).start) + ":" + Utils.convertEpochToUTCString(start) + ":" + Utils.convertEpochToUTCString(ranges.get(i).end));
                        peakstartupKpodMap.put(start, startupKpodMap.get(start));
                        ispeakStart = true;
                        break;
                    }
                }
                if(!ispeakStart && (start > peakEnd-2*24*60*60*1000)){//consider only last 48 hr startups
                    offpeakstartupKpodMap.put(start,startupKpodMap.get(start));
                }
            }
        }
        List<HashMap<Long, String>> list = new ArrayList<>();
        list.add(offpeakstartupKpodMap);
        list.add(peakstartupKpodMap);
        return list;
    }

    public static List<PeakRange.TimeRange> getPeakTimeRanges(long timestampStart, long timestampEnd, String instance, String domain, String cell) {
        String metric = ArgusQueryT.getRequestCountMetric(String.valueOf(timestampStart), String.valueOf(timestampEnd), instance, domain, cell);
        if (metric != null) {
            Map<Long, Integer> epochTimestampsMap = new HashMap<>();
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    epochTimestampsMap.put(Long.parseLong(k), datapoints.getInt(String.valueOf(k)));
                }
            }
            List<PeakRange.TimeRange> ranges = PeakRange.findContinuousRangesAbovePercentile(epochTimestampsMap, 60);
            return ranges;
        }
        return null;
    }

    public static Double getWarmupAvgAPT(String instance, String domain, String cell, HashMap<Long, String> startupKpodMap){
        Double totalAPT = 0.0;
        int count = 0;
        for (Long start : startupKpodMap.keySet()) {
            String kpod = startupKpodMap.get(start);
            long end = start + 15 * 60 * 1000; // 15 min
            ArgusQueryT.QueryResponse APT = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, start, end, instance, domain, cell,  Arrays.asList(kpod));
            if(APT != null) {
                totalAPT += APT.getMetric();
                if(count == 0){
                    //System.out.println("getWarmupAvgAPT query: " + APT.getQuery());
                }
                count++;
            }
        }
        return totalAPT/count;
    }

    public static String getRequestCountMetric(String startquery, String endquery, String instance, String
            domain, String cell) {
        try {
            if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
                updateAccessToken();
                lastUpdated = System.currentTimeMillis();
            }
            if (accessToken != null) {
                String query = requestCountQueryT.replaceFirst("START", startquery);
                query = query.replaceAll("END", endquery);
                query = query.replaceFirst("INSTANCE", instance);
                query = query.replaceFirst("DOMAIN", domain);
                query = query.replaceFirst("CELL", cell);
                System.out.println(query);
                query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
                String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;
                String metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
                return metric;
            } else {
                //String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    if (substrate == null) {
                        String metric = "{\"array\":" + Resources.toString(Resources.getResource("requests.json"), StandardCharsets.UTF_8) + "}";
                        return metric;
                    }
                }
                return null;
            }
        } catch (Exception e) {
            System.out.println(cell+ " getRequestCountMetric " + e.getMessage());
            return null;
        }
    }

    public static List<String> getCanaryPods(String startquery, String endquery, String instance, String
            domain, String cell) {
        System.out.println(cell+ " getCanaryPods");
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        try {
            String metric = "";
            if (accessToken != null) {
                String query = canaryKpodsQueryT.replaceFirst("START", startquery);
                query = query.replaceAll("END", endquery);
                query = query.replaceFirst("INSTANCE", instance);
                query = query.replaceFirst("DOMAIN", domain);
                query = query.replaceFirst("CELL", cell);
                System.out.println(query);
                query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
                String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;
                metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
            } else {
                if (substrate == null) {
                    Path path = Path.of("/Users/rpulle/work/casp/findpeak/src/main/resources/requestkpods1.json");
                    metric = "{\"array\":" + Files.readString(path) + "}";
                }
            }
            List<String> pods = new ArrayList<>();
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                String kpodname = object.getJSONObject("tags").get("k8s_pod_name").toString();
                pods.add(kpodname);
            }
            return pods;
        } catch (Exception e) {
            System.out.println(cell+ " getRequestCountKpodMetric1 " + e.getMessage());
            return null;
        }
    }

    public static String getSafepointData(long timestampStart, long timestampEnd, String instance, String domain, String cell, String pod){
        String tok[] = cell.split("-");//falcon-aws-prod1-useast1-core1-usa358
        if(cell.contains("falcon")){
            instance = tok[1]+"-"+tok[2]+"-"+tok[3];
            domain = tok[4];
            cell = tok[5];
        }

        List<String> header = new ArrayList<>();
        header.add("timestamp:timestamp");
        header.add("name:text");
        header.add("safepointMs:number");

        final EventHandler aggregator = new EventHandler();
        aggregator.initializeEvent("safepoint");
        aggregator.addHeader("safepoint", header);


        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = totalSafepointTimeSeries.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        query = query.replaceAll("POD", pod);

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ "safepoint1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("gc.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "safepoint2 " + e.getMessage());
            }
        }

        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    List<Object> record = new ArrayList<>();
                    String k = keys.next().toString();
                    record.add(Long.parseLong(k));
                    record.add("safepoint");
                    record.add(datapoints.getDouble(String.valueOf(k)));
                    aggregator.processContext(record, 1, "safepoint");
                }
                Object logContext = aggregator.getLogContext();
                return Utils.toJson(logContext);
            }
        } catch (Exception e) {
            System.out.println("query->" + query);
            System.out.println("metric->" + metric);
            System.out.println(cell + "safepoint3 " + e.getMessage());
            return null;
        }
        System.out.println("query->" + query);
        System.out.println("metric->" + metric);
        System.out.println(cell + "safepoint4 ");
        return null;
    }

    public static String getOldgenData(long timestampStart, long timestampEnd, String instance, String domain, String cell, String pod){

        String tok[] = cell.split("-");//falcon-aws-prod1-useast1-core1-usa358
        if(cell.contains("falcon")){
            instance = tok[1]+"-"+tok[2]+"-"+tok[3];
            domain = tok[4];
            cell = tok[5];
        }

        List<String> header = new ArrayList<>();

        header.add("timestamp:timestamp");
        header.add("name:text");
        header.add("oldgen:number");

        final EventHandler aggregator = new EventHandler();
        aggregator.initializeEvent("oldgen");
        aggregator.addHeader("oldgen", header);


        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        String query = totalOldgenTimeSeries.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        query = query.replaceAll("POD", pod);
        System.out.println("query->" + query);
        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ "oldgen1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("gc.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + "oldgen2 " + e.getMessage());
            }
        }

        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    List<Object> record = new ArrayList<>();
                    String k = keys.next().toString();
                    record.add(Long.parseLong(k));
                    record.add("oldgen");
                    record.add(datapoints.getDouble(String.valueOf(k)));
                    aggregator.processContext(record, 1, "oldgen");
                }
                Object logContext = aggregator.getLogContext();
                return Utils.toJson(logContext);
            }
        } catch (Exception e) {
            System.out.println("query->" + query);
            System.out.println("metric->" + metric);
            System.out.println(cell + "oldgen3 " + e.getMessage());
            return null;
        }
        System.out.println("query->" + query);
        System.out.println("metric->" + metric);
        System.out.println(cell + "oldgen4 ");
        return null;
    }
    public static JSONObject getArgusTimeSeriesForMetric(String query, String cell){
        System.out.println(cell+ " getArgusTimeSeriesForMetric");
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " " +query+" getArgusTimeSeriesForMetric1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = executeCurlCommand(metricCommand);
            if(metric.contains("request timeout")){
                System.out.println("--> timeout Retry");
                metric = executeCurlCommand(metricCommand);
            }else if(metric.contains("disable this java.lang.RuntimeException")){
                System.out.println("--> java.lang.RuntimeException Retry");
                metric = executeCurlCommand(metricCommand);
            }
            metric = "{\"array\":" + metric + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("apt.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell+ " " +query+" getArgusTimeSeriesForMetric2 " + e.getMessage());
            }
        }

        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                return datapoints;
            }
        } catch (Exception e) {
            System.out.println("query->" + query);
            System.out.println("metric->" + metric);
            System.out.println(cell+ " " +query+" getArgusTimeSeriesForMetric3 " + e.getMessage());
            return null;
        }

        return null;
    }

    public static QueryResponse getArgusMetric(String m, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        System.out.println(cell+ " getArgusMetric " +m);
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        QueryResponse response = new QueryResponse();
        String queryT = ac.queries.get(ac.metrics.get(m).get("type"));

        String query = queryT.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("SCOPE", ac.metrics.get(m).get("scope"));
        query = query.replaceAll("METRIC", ac.metrics.get(m).get("metric"));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        response.query = query;

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " " +m+"1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = executeCurlCommand(metricCommand);
            if(metric.contains("request timeout")){
                System.out.println("--> timeout Retry");
                metric = executeCurlCommand(metricCommand);
            }else if(metric.contains("disable this java.lang.RuntimeException")){
                System.out.println("--> java.lang.RuntimeException Retry");
                metric = executeCurlCommand(metricCommand);
            }
            metric = "{\"array\":" + metric + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("apt.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + " " +m+"2 " + e.getMessage());
            }
        }

        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    response.metric = datapoints.getDouble(String.valueOf(k));
                    return response;
                }
            }
        } catch (Exception e) {
            System.out.println("query->" + response.query);
            System.out.println("metric->" + metric);
            System.out.println(cell + " " +m+"3 " + e.getMessage());
            return null;
        }
        System.out.println("query->" + response.query);
        System.out.println("metric->" + metric);
        System.out.println(cell + " " +m+"4 ");
        return null;
    }

    public static String getGCMetric(String startquery, String endquery, String instance, String domain, String cell) {
        System.out.println(cell + " getGCMetric");
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        try {
            if (accessToken != null) {
                String query = GCQueryT.replaceFirst("START", startquery);
                query = query.replaceAll("END", endquery);
                query = query.replaceFirst("INSTANCE", instance);
                query = query.replaceFirst("DOMAIN", domain);
                query = query.replaceFirst("CELL", cell);
                System.out.println(query);
                query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
                String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;
                String metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
                return metric;
            } else {
                if (substrate == null) {
                    String metric = "{\"array\":" + Resources.toString(Resources.getResource("gc.json"), StandardCharsets.UTF_8) + "}";
                    return metric;
                }
                return null;
            }
        } catch (Exception e) {
            System.out.println(cell + " getGCMetric " +e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    public static List<String> getContainerResourceCount(long start, long end, String instance, String domain, String cell, String PODs) {
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }

        return null;
    }

    static class QueryResponse {
        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        String type;
        Double metric;

        public Double getMetric1() {
            return metric1;
        }

        public void setMetric1(Double metric1) {
            this.metric1 = metric1;
        }

        Double metric1;

        public Double getMetric2() {
            return metric2;
        }

        public void setMetric2(Double metric2) {
            this.metric2 = metric2;
        }

        Double metric2;

        public String getQuery() {
            return query;
        }

        public void setQuery(String query) {
            this.query = query;
        }

        String query;

        QueryResponse() {
            metric = null;
            query = null;
            type = null;
        }

        public Double getMetric() {
            return metric;
        }

        public void setMetric(Double metric) {
            this.metric = metric;
        }
    }

    public static QueryResponse getMetric(String queryT, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        System.out.println(cell + " getMetric");
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        QueryResponse response = new QueryResponse();
        String query = queryT.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        response.query = query;

        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell + " getMetric1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    Path path = Paths.get("/Users/rpulle/work/argusmetrics/src/main/resources/apt.json");
                    metric = Files.readString(path);
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + " getMetric2 " + e.getMessage());
            }
        }

        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    response.metric = datapoints.getDouble(String.valueOf(k));
                    return response;
                }
            }
        } catch (Exception e) {
            System.out.println("query->" + response.query);
            System.out.println("metric->" + metric);
            System.out.println(cell + " getMetric3 " + e.getMessage());
            return null;
        }
        System.out.println("query->" + response.query);
        System.out.println("metric->" + metric);
        System.out.println(cell + " getMetric4 ");
        return null;
    }

    private static String accessToken = null;
    private static long lastUpdated = 0;

    public static synchronized boolean updateAccessToken() {
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            String curlCommand = "curl -vX POST \"https://monitoring-api.salesforce.com/monexws/auth/1.0/token\" "
                    + "--capath /etc/identity/client/certificates/ "
                    + "--cert /etc/identity/client/certificates/client.pem "
                    + "--key /etc/identity/client/keys/client-key.pem";
            String response = executeCurlCommand(curlCommand);
            accessToken = parseAccessToken(response);
            lastUpdated = System.currentTimeMillis();
            if (accessToken != null) {
                return false;
            } else {
                return true;
            }
        }else{
            return true;
        }
    }

    public static String parseAccessToken(String response) {
        try {
            JSONObject jsonResponse = new JSONObject(response);
            if (jsonResponse.has("access_token")) {
                return jsonResponse.getString("access_token");
            }
        } catch (Exception e) {
            System.out.println("Error parsing access token: " + e.getMessage());
        }
        return null;
    }

    public static String executeCurlCommand(String command) {
        ProcessBuilder processBuilder = new ProcessBuilder();
        processBuilder.command("bash", "-c", command);
        StringBuilder output = new StringBuilder();
        try {
            Process process = processBuilder.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                System.out.println(output);
            }
        } catch (IOException | InterruptedException e) {
            System.out.println( "executeCurlCommand -> " + e.getMessage());
        }
        return output.toString();
    }

    /* Like getArgusMetric, but returns all the datapoints in a double[].
     */
    public static DatapointsQueryResponse getJvmCpuMsPerReqTimeSeriesDatapoints(long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 3 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        DatapointsQueryResponse response = new DatapointsQueryResponse();

        String query = jvmCpuMsPerReqTimeSeries.replaceAll("START", String.valueOf(timestampStart));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String podstr = "";
        for (int i = 0; i < pods.size(); i++) {
            if (i == 0) {
                podstr = pods.get(i);
            } else {
                podstr = podstr + "|" + pods.get(i);
            }
        }
        query = query.replaceAll("POD", podstr);

        response.query = query;
        //System.out.println(cell + " query->" + response.query);
        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            System.out.println(cell+ " getJvmCpuMsPerReqTimeSeriesDatapoints1 " + e.getMessage());
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        } else {
            try {
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("jcpuperreq.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + " getJvmCpuMsPerReqTimeSeriesDatapoints2 " + e.getMessage());
            }
        }

        ArrayList<AbstractMap.SimpleEntry<double[], double[]>> data = new ArrayList<>();
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                AbstractMap.SimpleEntry<Double, Double>[] items = new AbstractMap.SimpleEntry[datapoints.length()];
                Iterator keys = datapoints.keys();
                int ii = 0;
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    items[ii] = new AbstractMap.SimpleEntry<>(
                            Double.parseDouble(k),
                            datapoints.getDouble(String.valueOf(k))
                    );
                    ii++;
                }
                // sort items by time as the JSON datapoints are object, not an array so the order is not guaranteed
                Arrays.sort(items, Comparator.comparing(AbstractMap.SimpleEntry::getKey));
                // and add to the result
                data.add(new AbstractMap.SimpleEntry<>(
                        Arrays.stream(items).mapToDouble(AbstractMap.SimpleEntry::getKey).toArray(),
                        Arrays.stream(items).mapToDouble(AbstractMap.SimpleEntry::getValue).toArray()
                ));
            }
            if (!data.isEmpty()) {
                response.setDatapoints(data);
                return response;
            }
        } catch (Exception e) {
            System.out.println("query->" + response.query);
            System.out.println("metric->" + metric);
            System.out.println(cell + " getJvmCpuMsPerReqTimeSeriesDatapoints3 " + e.getMessage());
            return null;
        }
        System.out.println("query->" + response.query);
        System.out.println("metric->" + metric);
        System.out.println(cell + " getJvmCpuMsPerReqTimeSeriesDatapoints4 ");
        return null;
    }

    /* Query response that returns all datapoints in a double array, not just the last one.
     */
    static class DatapointsQueryResponse {
        ArrayList<AbstractMap.SimpleEntry<double[], double[]>> datapoints;

        public String getQuery() { return query; }

        public void setQuery(String query) {
            this.query = query;
        }

        String query;

        DatapointsQueryResponse() {
            datapoints = null;
            query = null;
        }

        public ArrayList<AbstractMap.SimpleEntry<double[], double[]>> getDatapoints() {
            return datapoints;
        }

        public void setDatapoints(ArrayList<AbstractMap.SimpleEntry<double[], double[]>> datapoints) {
            this.datapoints = datapoints;
        }
    }

    public static void main(String[] args) {
        try {
            String metric = getGCMetric("1742270400000", "1742302800000", "instance", "domain", "cell");
            System.out.println("check");
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
