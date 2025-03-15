package perfgenie.utils;

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
import java.time.*;
import java.util.*;

public class Canary {
    static String substrate = System.getenv("SUBSTRATE");
    static String GCQueryT = "START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-AveGCUsage.OneMinuteAverage{cell=CELL,k8s_pod_name=*}:avg:1m-avg";
    static String APTQueryT = "SCALE(DIVIDE(DIFF(DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(GROUPBYTAG(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_pod_name#,#SCALE#,#union#),#k8s_container_name#,#SUM#,#union#),FILL(CULL_BELOW(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#),#1#,#value#),#1m#,#0m#,#1#),#k8s_container_name#,#DIVIDE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#),DOWNSAMPLE(ALIASBYREGEX(ALIAS(SHIFT(GROUPBYTAG(GROUPBYTAG(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD2,role=app}:avg:1m-avg,START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD2,role=app}:avg:1m-avg,#k8s_pod_name#,#SCALE#,#union#),#k8s_container_name#,#SUM#,#union#),FILL(CULL_BELOW(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD2,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#),#1#,#value#),#1m#,#0m#,#1#),#k8s_container_name#,#DIVIDE#),#0m#),#:#,#literal#,#0m-canary-CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#))," +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(GROUPBYTAG(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_pod_name#,#SCALE#,#union#),#k8s_container_name#,#SUM#,#union#),FILL(CULL_BELOW(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#SUM#,#union#),#1#,#value#),#1m#,#0m#,#1#),#k8s_container_name#,#DIVIDE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            "),#100#)";
    static String JVMCpuQueryT = "SCALE(" +
            "DIVIDE(" +
            "DIFF(" +
            "DIVIDE(DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuLoadPercent.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#),DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-sum#,#0#,#abs#))" +
            "," +
            "DIVIDE(DOWNSAMPLE(ALIASBYREGEX(ALIAS(SHIFT(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuLoadPercent.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD2,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#0m#),#:#,#literal#,#0m-canary-CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#),DOWNSAMPLE(ALIASBYREGEX(ALIAS(SHIFT(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD2,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#0m#),#:#,#literal#,#0m-canary-CELL#,#literal#),#(.*)::\\{#),#1d-sum#,#0#,#abs#))" +
            ")," +
            "DIVIDE(DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:Jvm.processCpuLoadPercent.Value{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#),DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-sum#,#0#,#abs#))" +
            "),#100#)";
    static String containerCpuQueryT = "SCALE(" +
            "DIVIDE(" +
            "DIFF(" +
            "DIVIDE(" +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(DOWNSAMPLE(GROUPBYTAG(SCALE(GROUPBYTAG(DOWNSAMPLE(DIVIDE(RATE(INCLUDE(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD1}:avg,#.*k8s_pod_name=CELL-casam-app-.*#)),#60#),#2m-avg#),PROPAGATE(INCLUDE(START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD1,resource=cpu}:avg:1m-avg,#.*k8s_pod_name=CELL-casam-app-.*#),#1m#),#k8s_pod_name#,#DIVIDE_V#),#100#),#k8s_container_name#,#AVERAGE#),#1m-avg#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            "," +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            ")" +
            "," +
            "DIVIDE(" +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(SHIFT(DOWNSAMPLE(GROUPBYTAG(SCALE(GROUPBYTAG(DOWNSAMPLE(DIVIDE(RATE(INCLUDE(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD2}:avg,#.*k8s_pod_name=CELL-casam-app-.*#)),#60#),#2m-avg#),PROPAGATE(INCLUDE(START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD2,resource=cpu}:avg:1m-avg,#.*k8s_pod_name=CELL-casam-app-.*#),#1m#),#k8s_pod_name#,#DIVIDE_V#),#100#),#k8s_container_name#,#AVERAGE#),#1m-avg#),#0m#),#:#,#literal#,#0m-canary-CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            "," +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(SHIFT(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD2,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#0m#),#:#,#literal#,#0m-canary-CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            ")" +
            ")" +
            "," +
            "DIVIDE(" +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(DOWNSAMPLE(GROUPBYTAG(SCALE(GROUPBYTAG(DOWNSAMPLE(DIVIDE(RATE(INCLUDE(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=POD1}:avg,#.*k8s_pod_name=CELL-casam-app-.*#)),#60#),#2m-avg#),PROPAGATE(INCLUDE(START:END:kube-state-metrics.aws.INSTANCE.DOMAIN:kube_pod_container_resource_requests{k8s_container_name=coreapp,k8s_pod_name=POD1,resource=cpu}:avg:1m-avg,#.*k8s_pod_name=CELL-casam-app-.*#),#1m#),#k8s_pod_name#,#DIVIDE_V#),#100#),#k8s_container_name#,#AVERAGE#),#1m-avg#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            "," +
            "DOWNSAMPLE(ALIASBYREGEX(ALIAS(GROUPBYTAG(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestCount.Last_1_Min_Avg{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=POD1,role=app}:avg:1m-avg,#k8s_container_name#,#AVERAGE#),#:#,#literal#,#CELL#,#literal#),#(.*)::\\{#),#1d-avg#,#0#,#abs#)" +
            ")" +
            "),#100#)";

    static String startupQueryT = "START:END:core.aws.INSTANCE.DOMAIN:AppStartup.totalStartupMs{cell=CELL,k8s_pod_name=POD}:avg:1m-avg";

    public static HashMap<String, String> podsInstance = new HashMap<>();
    public static HashMap<String, Integer[]> podsList = new HashMap<>();
    public static HashMap<String, String> podsDomain = new HashMap<>();
    public static String URL1 = "";
    static String startupQueryZing = "";
    static String startupQueryZulu = "";
    static String curargusMetricQuery = "";
    public static long curfinalStart = 0;
    public static long curfinalend = 0;

    static{
        podsInstance.put("ind86", "aws-prod2-apsouth1");//min 18, max 50
        podsInstance.put("usa270s", "aws-prod5-uswest2");//min 14, max 50
        podsInstance.put("usa710s", " aws-prod21-useast2");//min 8, max 40
        podsInstance.put("usa30s", "aws-prod5-uswest2");//min 8, max 40
        podsInstance.put("usa432s", "aws-prod5-uswest2");//min 10, max 40
        podsInstance.put("usa762s", "aws-prod21-useast2");//min 8, max 40
        podsInstance.put("usa14s", "aws-prod0-uswest2");//min 8, max 40
        //podsInstance.put("sdb2", "dev1-uswest2");
        podsDomain.put("ind86", "core1");
        podsDomain.put("usa270s", "core1");
        podsDomain.put("usa710s", "core1");
        podsDomain.put("usa762s", "core1");
        podsDomain.put("usa30s", "core1");
        podsDomain.put("usa432s", "core1");
        podsDomain.put("usa14s", "core1");
        //podsDomain.put("sdb2", "core002");
        podsList.put("ind86", new Integer[]{4, 12});
        //podsList.put("ind86", new Integer[]{2, 3});
        podsList.put("usa270s", new Integer[]{14, 21});
        podsList.put("usa710s", new Integer[]{14, 22});
        podsList.put("usa762s", new Integer[]{15, 22});
        podsList.put("usa30s", new Integer[]{12, 20});
        podsList.put("usa432s", new Integer[]{8, 14});
        podsList.put("usa14s", new Integer[]{5, 11});
        //podsList.put("sdb2", new Integer[]{6, 10});
    }

    public static int getCurrentHourUTC() {
        ZonedDateTime currentTimeUTC = ZonedDateTime.now(ZoneOffset.UTC);
        return currentTimeUTC.getHour();
    }

    public static long getUtcEpochForHour(int hour) {
        // Get the current date in UTC
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        // Create a LocalDateTime for the given hour on the current day in UTC
        LocalDateTime dateTime = today.atTime(hour, 0);  // Using hour and minute 0

        // Convert LocalDateTime to Instant (epoch time) in UTC
        Instant instant = dateTime.atZone(ZoneOffset.UTC).toInstant();

        // Return the epoch time (milliseconds since Unix epoch)
        return instant.toEpochMilli();
    }

    //public static void main(String[] args) {
    //    getCanaryResults();
    //}

    public static boolean inUse = false;
    public static List<Object> processCellCanary(long tmp1, long tmp2, String key) {
        if(inUse){//basic check
            return new ArrayList<>();
        }
        inUse=true;
        List<Object> record = new ArrayList<>();
        try {
            zingCount = 0;
            zuluCount = 0;
            pod1 = new ArrayList<>();
            pod2 = new ArrayList<>();
            URL1 = "";
            startupQueryZing = "";
            startupQueryZulu = "";
            curargusMetricQuery = "";
            curfinalStart = 0;
            curfinalend = 0;

            String URL = process(String.valueOf(tmp1), String.valueOf(tmp2), podsInstance.get(key), podsDomain.get(key), key);
            if (URL != null) {
                record.add(tmp1);//epoch
                record.add(1);//tid
                System.out.println("CELL:" + key);
                record.add(key);
                String APT = getMetric(APTQueryT, String.valueOf(curfinalStart), String.valueOf(curfinalend), podsInstance.get(key), podsDomain.get(key), key);
                String aptQ=curargusMetricQuery;
                System.out.println("APT:" + APT);
                record.add(Double.parseDouble(APT));
                String JVMCpu = getMetric(JVMCpuQueryT, String.valueOf(curfinalStart), String.valueOf(curfinalend), podsInstance.get(key), podsDomain.get(key), key);
                String JVMCpuQ=curargusMetricQuery;
                System.out.println("JVMCpu:" + JVMCpu);
                record.add(Double.parseDouble(JVMCpu));
                String containerCpu = getMetric(containerCpuQueryT, String.valueOf(curfinalStart), String.valueOf(curfinalend), podsInstance.get(key), podsDomain.get(key), key);
                String containerCpuQ=curargusMetricQuery;
                System.out.println("containerCpu:" + containerCpu);
                record.add(Double.parseDouble(containerCpu));
                System.out.println("URL:" + URL);
                record.add(URL);
                record.add(zingCount);
                record.add(zuluCount);

                URL1 = getMetricDashboardURL(curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(URL1);

                Double t1 = getStatupAVG(startupQueryZing);
                Double t2 = getStatupAVG(startupQueryZulu);
                if(!(t2 == 0.0 || t1 == 0.0)) {
                    record.add(100 * (t2 - t1) / t2);//for startup
                }else{
                    record.add(-10000.0);//for startup
                }
                record.add(aptQ);
                record.add(JVMCpuQ);
                record.add(containerCpuQ);
                startupQueryZing = getStartupQueryURL(podall2, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(startupQueryZing);
                startupQueryZulu = getStartupQueryURL(podall1, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(startupQueryZulu);
            }
        }catch (Exception e){
            System.out.println("getCanaryResults Exception:" + e.getMessage());
            return new ArrayList<>();
        }
        inUse=false;
        return record;
    }

    public static Double getStatupAVG(String query){
        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;
        //System.out.println(metricCommand);
        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        }else{
            try {
                //String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    Path path = Paths.get("/Users/rpulle/work/argusmetrics/src/main/resources/startup.json");
                    metric = Files.readString(path);
                }
            }catch (Exception e){
                metric = "{}";
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
                    if(t>prevT){
                        prevT = t;
                        prevS = datapoints.getDouble(String.valueOf(k));
                    }
                }
                if(prevT != -1) {
                    sum = sum + prevS;
                    count++;
                }
            }
            return sum/count;
        } catch (Exception e) {
            return 0.0;
        }
    }

    public static String getMetric(String Query, String startquery, String endquery, String instance, String domain, String cell) {
        if (pod1.size() == 0 || pod2.size() == 0) {
            return null;
        }
        String query = Query.replaceAll("START", startquery);
        query = query.replaceAll("END", endquery);
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String pods = "";
        for (int i = 0; i < pod1.size(); i++) {
            if (i == 0) {
                pods = pod1.get(i);
            } else {
                pods = pods + "|" + pod1.get(i);
            }
        }
        query = query.replaceAll("POD1", pods);
        pods = "";
        for (int i = 0; i < pod2.size(); i++) {
            if (i == 0) {
                pods = pod2.get(i);
            } else {
                pods = pods + "|" + pod2.get(i);
            }
        }
        query = query.replaceAll("POD2", pods);
        curargusMetricQuery=query;
        try {
            query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
        } catch (Exception e) {
            return null;
        }
        String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;

        String metric = "";
        if (accessToken != null) {
            metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
        }else{
            try {
                //String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    Path path = Paths.get("/Users/rpulle/work/argusmetrics/src/main/resources/apt.json");
                    metric = Files.readString(path);
                }
            }catch (Exception e){
                metric = "{}";
            }
        }
        if(cell.equals("ind86")){
            //System.out.println(metric);
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
                    return String.valueOf(datapoints.getDouble(String.valueOf(k)));
                }
            }
        } catch (Exception e) {
            return null;
        }
        return metric;
    }

    public static String accessToken = "";
    public static boolean updateAccessToken(){
        String curlCommand = "curl -vX POST \"https://monitoring-api.salesforce.com/monexws/auth/1.0/token\" "
                + "--capath /etc/identity/client/certificates/ "
                + "--cert /etc/identity/client/certificates/client.pem "
                + "--key /etc/identity/client/keys/client-key.pem";
        String response = executeCurlCommand(curlCommand);

        accessToken = parseAccessToken(response);
        if (accessToken != null) {
            return false;
        }else{
            return true;
        }
    }

    public static String getGCMetric(String startquery, String endquery, String instance, String domain, String cell){
        try {
            if(accessToken != null) {
                String query = GCQueryT.replaceFirst("START", startquery);
                query = query.replaceFirst("END", endquery);
                query = query.replaceFirst("INSTANCE", instance);
                query = query.replaceFirst("DOMAIN", domain);
                query = query.replaceFirst("CELL", cell);
                System.out.println(query);
                query = URLEncoder.encode(query, StandardCharsets.UTF_8.toString());
                String metricCommand = "curl -H \"Authorization: Bearer " + accessToken + "\" " + "https://monitoring-api.salesforce.com/argusws/metrics?expression=" + query;
                String metric = "{\"array\":" + executeCurlCommand(metricCommand) + "}";
                return metric;
            }else{
                //String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    Path path = Path.of("/Users/rpulle/work/argusmetrics/src/main/resources/gc.json");
                    String metric = Files.readString(path);
                    return metric;
                }
                return null;
            }
        }catch(Exception e){
            return null;
        }
    }

    public static String process(String startquery, String endquery, String instance, String domain, String cell) {
        try {
            updateAccessToken();
            String metric = getGCMetric(startquery,endquery,instance,domain,cell);
            if(metric != null){
                if(parse(metric, instance, domain, cell)){
                    return getCanaryDashboardURL(pod1,pod2,curfinalStart,curfinalend,instance, domain,cell );
                }else{
                    return null;
                }

            }else{
                return null;
            }
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
        return null;
    }

    public static List<String> pod1 = null;
    public static List<String> pod2 = null;
    public static List<String> podall1 = null;
    public static List<String> podall2 = null;
    public static int zingCount = 0;
    public static int zuluCount = 0;

    //updates curfinalStart, curfinalend, zingCount, zuluCount, pod1, pod2
    public static boolean parse(String metric, String instance, String domain, String cell) {

        long mindiff = 3600000;

        if(cell.equals("ind86")){
            //System.out.println(metric);
        }

        List<long[]> zingtimeRanges = new ArrayList<>();
        List<long[]> zulutimeRanges = new ArrayList<>();
        List<long[]> zingtimeRanges1 = new ArrayList<>();
        List<long[]> zulutimeRanges1 = new ArrayList<>();
        podall1 = new ArrayList<>();
        podall2 = new ArrayList<>();

        JSONObject jsonObject = new JSONObject(metric);
        JSONArray jsonArray = jsonObject.getJSONArray("array");
        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject object = jsonArray.getJSONObject(i);
            JSONObject datapoints = object.getJSONObject("datapoints");
            JSONObject tags = object.getJSONObject("tags");
            Iterator keys = datapoints.keys();
            //System.out.println("pod: " + tags.get("k8s_pod_name"));
            String pod = tags.get("k8s_pod_name").toString();
            int type = 0;
            long start = -1;
            long end = -1;
            boolean enter = true;

            List<Long> tmplist = new ArrayList<>();
            while (keys.hasNext()) {
                String k = keys.next().toString();
                tmplist.add(Long.parseLong(k));
            }
            Collections.sort(tmplist);

            for (int j = 0; j < tmplist.size(); j++) {
                Long k = tmplist.get(j);
                if (enter) {
                    start = k;
                    if (datapoints.getDouble(String.valueOf(k)) == -1) {
                        type = 0;
                    } else {
                        type = 1;
                    }
                    enter = false;
                } else {
                    if (type != 1 && !(datapoints.getDouble(String.valueOf(k)) == -1 && type == 0)) {
                        zingtimeRanges.add(new long[]{start, end});
                        zingtimeRanges1.add(new long[]{start, end});
                        podall2.add(pod);
                        //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + " zing diff:" + (end - start));
                        type = 1;
                        if ((end - start) > mindiff) {
                            zingCount++;
                        }
                        start = k;
                    } else if (type != 0 && !(datapoints.getDouble(String.valueOf(k)) != -1 && type == 1)) {
                        zulutimeRanges.add(new long[]{start, end});
                        zulutimeRanges1.add(new long[]{start, end});
                        podall1.add(pod);
                        //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + "zulu diff:" + (end - start));
                        type = 0;
                        start = k;
                        zuluCount++;
                    }
                }
                end = k;
            }
            //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + " diff:" + (end - start));

            if (type == 0) {
                if ((end - start) > mindiff) {
                    zingCount++;
                }
                zingtimeRanges.add(new long[]{start, end});
                zingtimeRanges1.add(new long[]{start, end});
                podall2.add(pod);
            } else {
                zulutimeRanges.add(new long[]{start, end});
                zulutimeRanges1.add(new long[]{start, end});
                podall1.add(pod);
                zuluCount++;
            }
        }
        System.out.println("zingCount:" + zingCount + " zuluCount:" + zuluCount);


        if (zingCount == 0) {
            return false;
        }

        Result result = findLargestIntersection(zingtimeRanges, zingCount);
        HashMap<Integer, Boolean> zingpods = new HashMap<>();
        if (result != null && result.largestIntersection != null) {
            System.out.println("Largest Intersection zing: Start = " + result.largestIntersection[0] + ", End = " + result.largestIntersection[1] + " diff:" + (result.largestIntersection[0] - result.largestIntersection[1]));
            System.out.println("Combination for largest intersection:");
            for (long[] range : result.finalCombination) {

                for (int k = 0; k < zingtimeRanges1.size(); k++) {
                    if (!zingpods.containsKey(k)) {
                        long[] tmp = zingtimeRanges1.get(k);
                        if (tmp[0] == range[0] && tmp[1] == range[1]) {
                            zingpods.put(k, true);
                            System.out.println(podall2.get(k) + ":" + Arrays.toString(range));
                            //URL = URL + "&var-pod2=" + zingkpods.get(k);
                            pod2.add(podall2.get(k));
                            break;
                        }
                    }
                }
            }
        } else {
            System.out.println("No valid intersection found.");
            return false;
        }

        if (zingCount == 0) {
            return false;
        }
        Result result1 = findLargestIntersection(zulutimeRanges, zingCount);
        HashMap<Integer, Boolean> zulupods = new HashMap<>();
        if (result1 != null && result1.largestIntersection != null) {
            System.out.println("Largest Intersection zulu: Start = " + result1.largestIntersection[0] + ", End = " + result1.largestIntersection[1] + " diff:" + (result1.largestIntersection[0] - result1.largestIntersection[1]));
            System.out.println("Combination for largest intersection:");
            for (long[] range : result1.finalCombination) {
                for (int k = 0; k < zulutimeRanges1.size(); k++) {
                    if (!zulupods.containsKey(k)) {
                        long[] tmp = zulutimeRanges1.get(k);
                        if (tmp[0] == range[0] && tmp[1] == range[1]) {
                            zulupods.put(k, true);
                            System.out.println(podall1.get(k) + ":" + Arrays.toString(range));
                            //URL = URL + "&var-pod1=" + zulukpods.get(k);
                            pod1.add(podall1.get(k));
                            break;
                        }
                    }
                }
                //System.out.println(Arrays.toString(range));
            }
        } else {
            System.out.println("No valid intersection found.");
            return false;
        }

        long finalStart = result.largestIntersection[0];
        if (result1.largestIntersection[0] > finalStart) {
            finalStart = result1.largestIntersection[0];
        }

        long finalEnd = result.largestIntersection[1];
        if (result1.largestIntersection[1] < finalEnd) {
            finalEnd = result1.largestIntersection[1];
        }

        long finalDiff = finalEnd - finalStart;

        curfinalStart = finalStart;
        curfinalend = finalEnd;
        System.out.println("start: " + finalStart + " end: " + finalEnd + " finalDiff: " + finalDiff);

        /*String URL = "https://moncloud-grafana.sfproxy.monitoring.aws-esvc1-useast2.aws.sfdc.cl/d/evIw19pHz/zulu-zing-canary-falcon-rpulle-automation?orgId=1&";
        URL = URL + "&var-cell1=" + cell;
        URL = URL + "&var-cell2=" + cell;
        URL = URL + "&var-functional_domain1=" + domain;
        URL = URL + "&var-functional_domain2=" + domain;
        URL = URL + "&var-falcon_instance1=" + instance;
        URL = URL + "&var-falcon_instance2=" + instance;
        URL = URL + "&var-interval=1m";
        URL = URL + "&var-prev=0m";
        for (int i = 0; i < pod2.size(); i++) {
            URL = URL + "&var-pod2=" + pod2.get(i);
        }
        for (int i = 0; i < pod1.size(); i++) {
            URL = URL + "&var-pod1=" + pod1.get(i);
        }
        URL = URL + "&from=" + finalStart;
        URL = URL + "&to=" + finalEnd;*/

        return true;//getCanaryDashboardURL( pod1,  pod2,  curfinalStart,  curfinalend,  instance,  domain,  cell);

        //start=3/6/25 4:00 AM GMT&end=3/6/25 12:00 PM GMT

        /*URL1 = "https://monitoring.internal.salesforce.com/argusmvp/#/dashboards/94076428?&span=1m&aggregate=avg&k8s_pod_name=%2A&substrate=aws";
        URL1 = URL1 + "&cell="+cell;
        URL1 = URL1 + "&instance="+instance;
        URL1 = URL1 + "&domain="+domain;
        URL1 = URL1 + "&start="+finalStart;
        URL1 = URL1 + "&end="+finalEnd;
        System.out.println(URL1);*/

/*
        String pods = "";
        for (int i = 0; i < zingkpods.size(); i++) {
            if (i == 0) {
                pods = zingkpods.get(i);
            } else {
                pods = pods + "|" + zingkpods.get(i);
            }
        }

        startupQueryZing = startupQueryT.replaceAll("START", String.valueOf(finalStart - 7 * 24 * 60 * 60 * 1000));//previous 2 days startups
        startupQueryZing = startupQueryZing.replaceAll("END", String.valueOf(finalStart));
        startupQueryZing = startupQueryZing.replaceAll("INSTANCE", instance);
        startupQueryZing = startupQueryZing.replaceAll("DOMAIN", domain);
        startupQueryZing = startupQueryZing.replaceAll("CELL", cell);
        startupQueryZing = startupQueryZing.replaceAll("POD", pods);
        System.out.println(startupQueryZing);

        getStartupQueryURL(pod1, curfinalStart, curfinalend, instance, domain, cell);
*/
        //return URL;
    }

    public static String getCanaryDashboardURL(List<String> pod1, List<String> pod2, long curfinalStart, long curfinalEnd, String instance, String domain, String cell){
        String URL = "https://moncloud-grafana.sfproxy.monitoring.aws-esvc1-useast2.aws.sfdc.cl/d/evIw19pHz/zulu-zing-canary-falcon-rpulle-automation?orgId=1&";
        URL = URL + "&var-cell1=" + cell;
        URL = URL + "&var-cell2=" + cell;
        URL = URL + "&var-functional_domain1=" + domain;
        URL = URL + "&var-functional_domain2=" + domain;
        URL = URL + "&var-falcon_instance1=" + instance;
        URL = URL + "&var-falcon_instance2=" + instance;
        URL = URL + "&var-interval=1m";
        URL = URL + "&var-prev=0m";
        for (int i = 0; i < pod2.size(); i++) {
            URL = URL + "&var-pod2=" + pod2.get(i);
        }
        for (int i = 0; i < pod1.size(); i++) {
            URL = URL + "&var-pod1=" + pod1.get(i);
        }
        URL = URL + "&from=" + curfinalStart;
        URL = URL + "&to=" + curfinalEnd;
        return URL;
    }

    public static String getMetricDashboardURL(long curfinalStart, long curfinalEnd, String instance, String domain, String cell){
        String URL1 = "https://monitoring.internal.salesforce.com/argusmvp/#/dashboards/94076428?&span=1m&aggregate=avg&k8s_pod_name=%2A&substrate=aws";
        URL1 = URL1 + "&cell="+cell;
        URL1 = URL1 + "&instance="+instance;
        URL1 = URL1 + "&domain="+domain;
        URL1 = URL1 + "&start="+curfinalStart;
        URL1 = URL1 + "&end="+curfinalEnd;
        System.out.println(URL1);
        return URL1;
    }

    public static String getStartupQueryURL(List<String> podlist, long curfinalStart, long curfinalEnd, String instance, String domain, String cell){
        startupQueryZulu = startupQueryT.replaceAll("START", String.valueOf(curfinalStart - 7 * 24 * 60 * 60 * 1000));//previous 7 days startups
        startupQueryZulu = startupQueryZulu.replaceAll("END", String.valueOf(curfinalEnd));
        startupQueryZulu = startupQueryZulu.replaceAll("INSTANCE", instance);
        startupQueryZulu = startupQueryZulu.replaceAll("DOMAIN", domain);
        startupQueryZulu = startupQueryZulu.replaceAll("CELL", cell);
        String pods = "";
        for (int i = 0; i < podlist.size(); i++) {
            if (i == 0) {
                pods = podlist.get(i);
            } else {
                pods = pods + "|" + podlist.get(i);
            }
        }
        startupQueryZulu = startupQueryZulu.replaceAll("POD", pods);
        System.out.println(startupQueryZulu);
        return startupQueryZulu;
    }

    // Method to execute the curl command
    public static String executeCurlCommand(String command) {
        ProcessBuilder processBuilder = new ProcessBuilder();

        // Split the command into arguments
        processBuilder.command("bash", "-c", command);

        StringBuilder output = new StringBuilder();

        try {
            // Start the process
            Process process = processBuilder.start();

            // Read the output of the curl command
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }

            // Wait for the process to finish
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                System.out.println(output);
                //throw new IOException("Curl command failed with exit code " + exitCode);
            }

        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
        }


        return output.toString();
    }

    // Method to parse the access token from the response (JSON)
    public static String parseAccessToken(String response) {
        try {
            // Convert the response to a JSONObject
            JSONObject jsonResponse = new JSONObject(response);

            // Get the access token from the JSON response
            if (jsonResponse.has("access_token")) {
                return jsonResponse.getString("access_token");
            }
        } catch (Exception e) {
            System.out.println("Error parsing access token: " + e.getMessage());
        }

        return null;  // Return null if the access token is not found
    }

    public static class Result {
        long[] largestIntersection;
        List<long[]> finalCombination;

        Result(long[] largestIntersection, List<long[]> finalCombination) {
            this.largestIntersection = largestIntersection;
            this.finalCombination = finalCombination;
        }
    }

    public static Result findLargestIntersection(List<long[]> timeRanges, int k) {
        if (timeRanges == null || timeRanges.size() < k) {
            return null;  // Not enough ranges to choose from
        }

        // Sort the ranges by their start time
        timeRanges.sort(Comparator.comparingLong(range -> range[0]));

        long[] bestIntersection = null;
        long bestIntersectionSize = 0;
        List<long[]> finalCombination = null;

        // Generate all combinations of `k` ranges
        List<List<long[]>> combinations = generateCombinations(timeRanges, k);

        // Debugging: Output the combinations and check each one
        System.out.println("Total combinations: " + combinations.size());

        for (List<long[]> combination : combinations) {
            long intersectionStart = combination.get(0)[0];
            long intersectionEnd = combination.get(0)[1];

            // Check the intersection of this combination
            for (long[] range : combination) {
                intersectionStart = Math.max(intersectionStart, range[0]);
                intersectionEnd = Math.min(intersectionEnd, range[1]);

                if (intersectionStart > intersectionEnd) {
                    break;  // No intersection in this combination
                }
            }

            // If the intersection is valid, check if it's the largest we've found
            if (intersectionStart <= intersectionEnd) {
                long intersectionSize = intersectionEnd - intersectionStart;
                if (intersectionSize > bestIntersectionSize) {
                    bestIntersectionSize = intersectionSize;
                    bestIntersection = new long[]{intersectionStart, intersectionEnd};
                    finalCombination = combination;  // Store the combination that gave the largest intersection
                }
            }
        }

        // Return the result with the largest intersection and the corresponding combination
        if (bestIntersection != null) {
            return new Result(bestIntersection, finalCombination);
        } else {
            return null;
        }
    }

    // Generate combinations of k elements from a list
    private static List<List<long[]>> generateCombinations(List<long[]> list, int k) {
        List<List<long[]>> combinations = new ArrayList<>();
        generateCombinationsHelper(list, k, 0, new ArrayList<>(), combinations);
        return combinations;
    }

    private static void generateCombinationsHelper(List<long[]> list, int k, int start, List<long[]> current, List<List<long[]>> combinations) {
        if (current.size() == k) {
            combinations.add(new ArrayList<>(current));
            return;
        }

        for (int i = start; i < list.size(); i++) {
            current.add(list.get(i));
            generateCombinationsHelper(list, k, i + 1, current, combinations);
            current.remove(current.size() - 1);
        }
    }

}

//curl -vX POST "https://monitoring-api.salesforce.com/monexws/auth/1.0/token" --capath /etc/identity/client/certificates/ --cert /etc/identity/client/certificates/client.pem --key /etc/identity/client/keys/client-key.pem
//curl -H "Authorization: Bearer eyJ2ZXJzaW9uIjoiMC4xMS4xIiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiJtb25leC5hcmd1cy5tb25pdG9yaW5nLmF3cy1lc3ZjMS11c2Vhc3QyLmF3cy5zZmRjLmNsIiwiaWF0IjoxNzQxMjk1OTk3LCJuYmYiOjE3NDEyOTU5OTcsImV4cCI6MTc0MTMzOTE5NywiYXVkIjoiTW9uQ2xvdWQiLCJzdWIiOiJjb3JlLW9uLXNhbS5kYXBwIiwiZW1haWwiOiIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJjb3JlLW9uLXNhbS5kYXBwIiwidHlwZSI6IkFDQ0VTUyIsInVzZXJncm91cCI6Ilt7XCJ1c2VyRGVmYXVsdEdyb3VwR3VpZFwiOlwiXCIsXCJncm91cEd1aWRcIjpcImIwZjY1NzE1LWFjYWMtNDhhYS1hNzVhLWZlNGVhN2YxZDZhM1wifV0ifQ.ACCzMFK_qU1ROzypi8CCFqjM6Vc8Xwu4ZMUMgm44K2shLc-i2AnrysrL7zIiKTK9r07qFu6N_Z_ZW7lHQ-xFvXYSbPLKoMk1SH4NIwVqLi5r0Asb8WEIFw1J9j_rggIPD7GJi79nG6MgqEKdBXRbJj5NIO8pElwFPThaqCi_CHwqNQN_xqvAwhtUcleOTSA4AqVsq_diA2_O82uqqjkyYKoI4lMpvfKJXDk90g6Pxr8sNa0Twpi-KLpIf9aKdMEobMr2jyprwV5SNg6cReuqDPdBZYvPE7px1CXRKU52emlfMhNSfSU3bTzFa0_zzNCIWExBjouSgC1h9y2B6CnKJA" https://monitoring-api.salesforce.com/argusws/metrics?expression=1741145400000%3A1741146300000%3Acore.aws.aws-prod2-apsouth1.core1%3AJvm.CodeCacheMaxMb.Value%7Bcell%3Dind86%7D%3Aavg