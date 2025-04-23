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
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import static perfgenie.utils.ArgusQueries.*;

public class ArgusQueryT {
    static String substrate = System.getenv("SUBSTRATE");
    static String GCQueryT = "START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-AveGCUsage.OneMinuteAverage{cell=CELL,k8s_pod_name=*}:avg:1m-avg";
    static String containerResourceCount = "GROUPBYTAG(START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD,resource=cpu}:max:all-max,#k8s_container_name#,#SUM#)";
    static String containerCPUUsageSecondsTotalDiff = "DIFF(" +
            "  GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD}:min:all-min,#k8s_container_name#,#SUM#)" +
            ")";
    static String requestCPUSecondsTotalDiff = "DIFF(" +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:max:all-max,#k8s_container_name#,#SUM#)," +
            "  GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD,role=app}:min:all-min,#k8s_container_name#,#SUM#)" +
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

    static String requestCountQueryT = "GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_pod_name=*}:sum:10m-sum,#cell#,#SUM#)";

    static String canaryKpodsQueryT = "START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{k8s_container_name=coreapp,cell=CELL,k8s_pod_name=*}:sum:1m-sum";

    static String startupQueryT = "START:END:core.aws.INSTANCE.DOMAIN:AppStartup.totalStartupMs{cell=CELL,k8s_pod_name=POD}:avg:1m-avg";

    static ArgusConfig ac;

    static {
        try {
            ac = (ArgusConfig) Utils.readValue(Resources.toString(Resources.getResource("argus.json"), StandardCharsets.UTF_8), ArgusConfig.class);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    static PodConfig pc;

    static {
        try {
            pc = (PodConfig) Utils.readValue(Resources.toString(Resources.getResource("podconfig.json"), StandardCharsets.UTF_8), PodConfig.class);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    public static QueryResponse getStatupAVG(long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
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
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            Double sum = 0.0;
            int count = 0;
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
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
                }
                if (prevT != -1) {
                    sum = sum + prevS;
                    count++;
                }
            }
            response.setMetric(sum / count);
            return response;
        } catch (Exception e) {
            System.out.println("getStatupAVG Exception " + e.getMessage() + ":" + metric);
            return null;
        }
    }

    public static String getRequestCountMetric(String startquery, String endquery, String instance, String
            domain, String cell) {
        try {
            if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
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
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
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

    /* Like getArgusMetric, but returns all of the datapoints in a double[].
     */
    public static DatapointsQueryResponse getArgusMetricDatapoints(String m, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }
        DatapointsQueryResponse response = new DatapointsQueryResponse();
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
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
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

        ArrayList<Double> data = new ArrayList<>();
        try {
            JSONObject jsonObject = new JSONObject(metric);
            JSONArray jsonArray = jsonObject.getJSONArray("array");
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject object = jsonArray.getJSONObject(i);
                JSONObject datapoints = object.getJSONObject("datapoints");
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    data.add(datapoints.getDouble(String.valueOf(k)));
                }
            }
            if (!data.isEmpty()) {
                response.setDatapoints(data.stream().mapToDouble(Double::doubleValue).toArray());
                return response;
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

    public static QueryResponse getArgusMetric(String m, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
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
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
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
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
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
            return null;
        }
    }

    public static List<String> getContainerResourceCount(long start, long end, String instance, String domain, String cell, String PODs) {
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
            updateAccessToken();
            lastUpdated = System.currentTimeMillis();
        }

        return null;
    }

    static class QueryResponse {
        Double metric;

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
        }

        public Double getMetric() {
            return metric;
        }

        public void setMetric(Double metric) {
            this.metric = metric;
        }
    }

    /* Query response that returns all datapoints in a double array, not just the last one.
     */
    static class DatapointsQueryResponse {
        double [] datapoints;

        public String getQuery() { return query; }

        public void setQuery(String query) {
            this.query = query;
        }

        String query;

        DatapointsQueryResponse() {
            datapoints = null;
            query = null;
        }

        public double [] getDatapoints() {
            return datapoints;
        }

        public void setDatapoints(double [] datapoints) {
            this.datapoints = datapoints;
        }
    }

    public static QueryResponse getMetric(String queryT, long timestampStart, long timestampEnd, String instance, String domain, String cell, List<String> pods) {
        if (pods.size() == 0) {
            return null;
        }
        if ((System.currentTimeMillis() - lastUpdated) > 5 * 60 * 1000) {//5 min
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
        String curlCommand = "curl -vX POST \"https://monitoring-api.salesforce.com/monexws/auth/1.0/token\" "
                + "--capath /etc/identity/client/certificates/ "
                + "--cert /etc/identity/client/certificates/client.pem "
                + "--key /etc/identity/client/keys/client-key.pem";
        String response = executeCurlCommand(curlCommand);
        accessToken = parseAccessToken(response);
        if (accessToken != null) {
            return false;
        } else {
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

    public static void main(String[] args) {
        try {
            String metric = getGCMetric("1742270400000", "1742302800000", "instance", "domain", "cell");
            System.out.println("check");
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
