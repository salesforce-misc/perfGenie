package perfgenie.utils;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.HashMap;
import java.util.concurrent.Future;

import static perfgenie.utils.ArgusQueryT.canaryKpodsQueryT;
import static perfgenie.utils.ArgusQueryT.getCanaryPods;
//import static perfgenie.utils.Canary.*;


public class WeekOverWeek {
    public static long mindiff = 3600000;
    public static long maxTimeWindow = 120 * 60 * 60 * 1000; // 5*24 hours due to argus query limitations, need to switch to huron

    private static EventStore eventStore;

    public static void setEventStore(EventStore eventStore1) {
        eventStore = eventStore1;
    }


    static FunctionExecutorPool pool = new FunctionExecutorPool(8);

    public static CanaryResponse processWeekOverWeekCanary(long timestampStart, long timestampEnd, String cell, String host) {
        return processWeekOverWeekCanaryTask(timestampStart,timestampEnd, cell, host);
    }

    private static CanaryResponse processWeekOverWeekCanaryTask(long timestampStart, long timestampEnd, String cell, String host) {
        String scope = ArgusQueryT.getScope(timestampStart,timestampEnd,cell);
        if(scope == null){
            System.out.println(cell + " failed get scope");
            return null;
        }

        String[] parts = scope.split("\\.");
        String instance = parts[2];
        String domain = parts[3];

        System.out.println(scope + ":" + instance + ":" + domain);
        /*
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
            PeakRange.TimeRange range = PeakRange.findLargestContinuousRangeAbovePercentile(epochTimestampsMap, 60);
            //argus time window limit check
            if (range != null && maxTimeWindow < (range.end - range.start)) {
                long diff = (range.end - range.start - maxTimeWindow) / 2;
                range.end = range.end - diff - 1;
                range.start = range.start + diff + 1;
                System.out.println(cell + " adjusted weekoverweek start: " + Utils.convertEpochToUTCString(range.start) + " end: " + Utils.convertEpochToUTCString(range.end));
            }else{
                System.out.println(cell + " not adjusted weekoverweek start: " + Utils.convertEpochToUTCString(range.start) + " end: " + Utils.convertEpochToUTCString(range.end));
            }
            if (range != null){
                long previousTimeDiffMs = 7 * 24 * 60 * 60 * 1000L;

                return getCanaryResponseWeekOverWeek(range.start,range.end, instance, domain, cell, range.start-previousTimeDiffMs, range.end-previousTimeDiffMs, instance, domain, cell, 1);
            }
        }
         */
        long previousTimeDiffMs = 7 * 24 * 60 * 60 * 1000L;
        return getCanaryResponseWeekOverWeek(timestampStart,timestampEnd, instance, domain, cell, timestampStart-previousTimeDiffMs, timestampEnd-previousTimeDiffMs, instance, domain, cell, 1, host);
    }

    public static String getSplunkweekAPTURL(long finalStart1,long finalEnd1, String instance1,String domain1, String cell1, List<String> pod1, long finalStart2,long finalEnd2, String instance2,String domain2, String cell2, List<String> pod2){
        String p1 = "";
        String or = "";
        try {
            for (int i = 0; i < pod1.size(); i++) {
                p1 = p1 + or + URLEncoder.encode("host=\"" + pod1.get(i) + "\"",StandardCharsets.UTF_8.toString());
                if(i == 0){
                    or = "%20OR%20";
                }
            }
            String p2 = "";
            or = "";
            for (int i = 0; i < pod2.size(); i++) {
                p2 = p2 + or + URLEncoder.encode("host=\"" + pod2.get(i) + "\"",StandardCharsets.UTF_8.toString());
                if(i == 0){
                    or = "%20OR%20";
                }
            }

            System.out.println(p1);
            System.out.println(p2);
            return "https://splunk-web.log-analytics.monitoring.aws-esvc1-useast2.aws.sfdc.is/en-US/app/publicSharing/zing_falcon_prod_canary_apt?form.time1.earliest=" + finalStart1 / 1000 + "&form.time1.latest=" + finalEnd1 / 1000 +"&form.time2.earliest=" + finalStart2 / 1000 + "&form.time2.latest=" + finalEnd2 / 1000 + "&form.POD1=" + cell1 + "&form.POD2=" + cell2+ "&form.Baseline=" + p1 + "&form.Canary=" + p2;

            //return URLEncoder.encode("https://splunk-web.log-analytics.monitoring.aws-esvc1-useast2.aws.sfdc.is/en-US/app/publicSharing/zing_falcon_prod_canary_apt?earliest=" + finalStart / 1000 + "&latest=" + finalEnd / 1000 + "&form.POD=" + cell + "&form.Baseline=" + p1 + "&form.Canary=" + p2, StandardCharsets.UTF_8.toString());
        }catch (Exception e){
            return null;
        }
    }

    public static String getweekMetricDashboardURL(long finalStart1,long finalEnd1, String instance1,String domain1, String cell1, List<String> pod1, long finalStart2,long finalEnd2, String instance2,String domain2, String cell2, List<String> pod2) {
        String URL1 = "https://monitoring.internal.salesforce.com/argusmvp/#/dashboards/130683428?&span=1m&aggregate=avg&k8s_pod_name=%2A&substrate=aws";
        URL1 = URL1 + "&cell1=" + cell1;
        URL1 = URL1 + "&instance1=" + instance1;
        URL1 = URL1 + "&domain1=" + domain1;
        URL1 = URL1 + "&start1=" + finalStart1;
        URL1 = URL1 + "&end1=" + finalEnd1;
        URL1 = URL1 + "&cell2=" + cell2;
        URL1 = URL1 + "&instance2=" + instance2;
        URL1 = URL1 + "&domain2=" + domain2;
        URL1 = URL1 + "&start2=" + finalStart2;
        URL1 = URL1 + "&end2=" + finalEnd2;
        String pods = "";
        for (int i = 0; i < pod1.size(); i++) {
            if (i == 0) {
                pods = pod1.get(i);
            } else {
                pods = pods + "|" + pod1.get(i);
            }
        }
        URL1 = URL1 + "&pod1=" + pods;
        pods = "";
        for (int i = 0; i < pod2.size(); i++) {
            if (i == 0) {
                pods = pod2.get(i);
            } else {
                pods = pods + "|" + pod2.get(i);
            }
        }
        URL1 = URL1 + "&pod2=" + pods;
        URL1 = URL1 + "&prev=" + (finalStart1-finalStart2)/(1000*60) + "m";
        System.out.println(URL1);
        return URL1;
    }

    public static int isZuluOrZing(String timestampStart1, String timestampEnd1, String instance1, String domain1, String cell1){
        boolean check = true;
        String metric = ArgusQueryT.getGCMetric(timestampStart1, timestampEnd1, instance1, domain1, cell1);
        JSONObject jsonObject = new JSONObject(metric);
        JSONArray jsonArray = jsonObject.getJSONArray("array");

        boolean hasMinusOne = false;
        boolean hasNotMinusOne = false;
        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject object = jsonArray.getJSONObject(i);
            JSONObject datapoints = object.getJSONObject("datapoints");
            JSONObject tags = object.getJSONObject("tags");
            Iterator keys = datapoints.keys();
            while (keys.hasNext()) {
                String k = keys.next().toString();
                if(datapoints.getDouble(String.valueOf(k)) == -1){
                    hasMinusOne = true;
                }else{
                    hasNotMinusOne = true;
                }
                if (hasMinusOne && hasNotMinusOne) {
                    return 0;
                }
            }
        }
        if(hasMinusOne){
            return 1;
        }else {
            return 2;
        }
    }

    public static CanaryResponse getCanaryResponseWeekOverWeek(final long timestampStart1, final long timestampEnd1, final String cell1, final long timestampStart2, final long timestampEnd2, final String cell2, final int type, String host) {
        String scope1 = ArgusQueryT.getScope(timestampStart1,timestampEnd1,cell1);
        if(scope1 == null){
            System.out.println(cell1 + " failed get scope1");
            return null;
        }
        String scope2 = ArgusQueryT.getScope(timestampStart2,timestampEnd2,cell2);
        if(scope2 == null){
            System.out.println(cell2 + " failed get scope2");
            return null;
        }
        String[] parts1 = scope1.split("\\.");
        String[] parts2 = scope2.split("\\.");
        final String instance1 = parts1[2];
        final String instance2 = parts2[2];
        final String domain1 =  parts1[3];
        final String domain2 = parts2[3];

        System.out.println(scope1 + ":" + instance1 + ":" + domain1 + ":" + instance2 + ":" + domain2);
        return getCanaryResponseWeekOverWeek(timestampStart1, timestampEnd1, instance1,domain1, cell1, timestampStart2, timestampEnd2, instance2, domain2, cell2, type, host);
    }

    static void getLast24hrCanaryTypeSeries(final long timestampEnd, String cell, final String instance, final String domain, final String host) {
        long startTimestamp = timestampEnd - 24 * 60 * 60 * 1000;
        String metric = "CanaryType";
        String query = "SUM(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-AveGCUsage.OneMinuteAverage{cell=CELL,k8s_pod_name=CELL-casam-app-*}:avg:1m-avg)";
        query = query.replaceAll("START", String.valueOf(startTimestamp));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        boolean exists = eventEsists(timestampEnd, host, cell, metric);
        if (!exists) {
            boolean success = false;
            JSONObject datapoints = ArgusQueryT.getArgusTimeSeriesForMetric(query, cell);
            if(datapoints != null) {
                List<Long> timestamps = new ArrayList<>();
                List<Double> values = new ArrayList<>();
                HashMap<String, List> data = new HashMap<>();
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    Long t = Long.parseLong(k);
                    Double v = datapoints.getDouble(k);
                    timestamps.add(t);
                    if(v < 0){
                        values.add(1.0);//zing
                    }else{
                        values.add(2.0);//zulu
                    }
                }
                System.out.println("getLast24hrCanaryTypeSeries Count of rows adding " + values.size());
                try {
                    data.put("x", timestamps);
                    data.put("v", values);
                    addTimeSeriesEvent(data, timestampEnd, cell, host, metric);
                }catch (IOException e){
                    System.out.println("getLast24hrCanaryTypeSeries Exception of rows adding " + e);
                }
            }
        }else{
            try {
                Object res = Utils.readValue(fetchTimeSeriesEvent(timestampEnd, cell, host, metric), HashMap.class);
                System.out.println(res);
            }catch (IOException e){
                System.out.println("Exception");
            }
        }
    }

    static void getLast24hrHeapSeries(final long timestampEnd, String cell, final String instance, final String domain, final String host) {
        long startTimestamp = timestampEnd - 24 * 60 * 60 * 1000;
        String metric = "heap";
        String query = "MAX(DIVIDE(START:END:core.aws.INSTANCE.DOMAIN:java-lang_type-Memory.HeapMemoryUsage_max{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=CELL-casam-app-*,role=app}:max:1m-max,#1073741824#))";
        query = query.replaceAll("START", String.valueOf(startTimestamp));
        query = query.replaceAll("END", String.valueOf(timestampEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        boolean exists = eventEsists(timestampEnd, host, cell, metric);
        if (!exists) {
            boolean success = false;
            JSONObject datapoints = ArgusQueryT.getArgusTimeSeriesForMetric(query, cell);
            if(datapoints != null) {
                List<Long> timestamps = new ArrayList<>();
                List<Double> values = new ArrayList<>();
                HashMap<String, List> data = new HashMap<>();
                Iterator keys = datapoints.keys();
                while (keys.hasNext()) {
                    String k = keys.next().toString();
                    Long t = Long.parseLong(k);
                    Double v = datapoints.getDouble(k);
                    timestamps.add(t);
                    values.add(v);
                }
                System.out.println("--------------------> getLast24hrHeapSeries Count of rows adding " + values.size());
                try {
                    data.put("x", timestamps);
                    data.put("v", values);
                    addTimeSeriesEvent(data, timestampEnd, cell, host, metric);
                }catch (IOException e){
                    System.out.println("getLast24hrHeapSeries Exception of rows adding " + e);
                }
            }
        }else{
            try {
                Object res = Utils.readValue(fetchTimeSeriesEvent(timestampEnd, cell, host, metric), HashMap.class);
                System.out.println(res);
            }catch (IOException e){
                System.out.println("Exception");
            }
        }
    }

    static Map<String, String> metricQueries = new HashMap<>() {{
        put("cCpuT", "SUM(DIVIDE(RATE(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=CELL-casam-app-*}:max:2m-max),#60#))");
        put("cCpuTN","DIVIDE_V(SUM(RATE(START:END:cadvisor.aws.INSTANCE.DOMAIN:container_cpu_usage_seconds_total{k8s_container_name=coreapp,k8s_pod_name=CELL-casam-app-*}:max:2m-max)),SUM(RATE(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_pod_name=CELL-casam-app*}:avg:2m-max)))");
        put("rCnt", "SUM(RATE(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-COUNT{cell=CELL,k8s_pod_name=CELL-casam-app*}:avg:1m-max))");
        put("Apt","AVERAGE(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-trustAptRequestTime.Last_1_Min_Avg{cell=CELL,k8s_pod_name=CELL-casam-app*}:avg:1m-avg)");
        put("rCpuT","SUM(RATE(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-ServerMetrics.LogMetric-APP_CPU_TIME{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=CELL-casam-app*}:avg:1m-avg))");
        put("PA", "AVERAGE(START:END:mars.sam.aws.INSTANCE.DOMAIN:predicted_replicas{deployment_name=CELL-casam-app-*,deployment_namespace=core-on-sam}:max:1m-max)");
        put("kpodC","SUM(START:END:mars.sam.aws.INSTANCE.DOMAIN:current_replicas{deployment_name=CELL-casam-app-*,deployment_namespace=core-on-sam}:max:1m-max)");
        put("heap","MAX(DIVIDE(START:END:core.aws.INSTANCE.DOMAIN:java-lang_type-Memory.HeapMemoryUsage_max{cell=CELL,k8s_container_name=coreapp,k8s_pod_name=CELL-casam-app-*,role=app}:max:1m-max,#1073741824#))");
        put("CanaryType","SUM(START:END:core.aws.INSTANCE.DOMAIN:SFDC_type-Stats-name1-System-name2-AveGCUsage.OneMinuteAverage{cell=CELL,k8s_pod_name=CELL-casam-app-*}:avg:1m-avg)");
    }};

    private static Map<String, Double> fetchLast24HrTimeSeriesData(final long peakStart, final long timestampEnd, String cell, final String instance, final String domain, final String host,String metric, final boolean doPerc) {
        List<Future<JSONObject>> futures = new ArrayList<>();
        final long timestampStart = timestampEnd - 24 * 60 * 60 * 1000;
        //try incremental
        long window = 3 * 60 * 60 * 1000;

        boolean exists = eventEsists(timestampEnd, host, cell, metric);
        List<Long> timestamps = new ArrayList<>();
        List<Double> values = new ArrayList<>();
        HashMap<String, List> data = new HashMap<>();
        try {
            if (!exists) {
                boolean success = false;
                long currentStart = timestampStart;
                while (currentStart <= timestampEnd) {
                    long currentEnd = currentStart + window;
                    if (currentEnd > timestampEnd) {
                        currentEnd = timestampEnd; // handle last partial window
                    }
                    System.out.println("fetchLast24HrTimeSeriesData Looping for 1:" + metric + ":" + instance + ":" + domain + ":" + cell + ":" + Utils.convertEpochToUTCString(currentStart) + ":" + Utils.convertEpochToUTCString(currentEnd));
                    final long currentStarttmp = currentStart;
                    final long currentEndtmp = currentEnd;
                    if (metricQueries.containsKey(metric)) {
                        String query = metricQueries.get(metric);
                        query = query.replaceAll("START", String.valueOf(currentStarttmp));
                        query = query.replaceAll("END", String.valueOf(currentEndtmp));
                        query = query.replaceAll("INSTANCE", instance);
                        query = query.replaceAll("DOMAIN", domain);
                        query = query.replaceAll("CELL", cell);
                        String tmpQuery = query;
                        futures.add(pool.submitTask(() -> ArgusQueryT.getArgusTimeSeriesForMetric(tmpQuery, cell)));
                        success = true;
                    }
                    currentStart = currentEnd + 1;
                }

                boolean isCanaryType = metric.equals("CanaryType");
                for (Future<JSONObject> future : futures) {
                    JSONObject datapoints = future.get();
                    if(datapoints != null) {
                        Iterator keys = datapoints.keys();
                        while (keys.hasNext()) {
                            String k = keys.next().toString();
                            Long t = Long.parseLong(k);
                            Double v = datapoints.getDouble(k);
                            timestamps.add(t);
                            if(isCanaryType) {
                                if (v < 0) {
                                    values.add(1.0);//zing
                                } else {
                                    values.add(2.0);//zulu
                                }
                            }else {
                                values.add(v);
                            }
                        }
                    }else{
                        success = false;
                    }
                }
                futures.clear();
                TimeseriesSorter.sortByTimestampsIfNeeded(values,timestamps);
                data.put("x", timestamps);
                data.put("v", values);
                if(success) {
                    System.out.println("Count of rows adding " + values.size());
                    addTimeSeriesEvent(data, timestampEnd, cell, host, metric);
                }
            }else{
                if(doPerc) {
                    System.out.println("fetchLast24HrTimeSeriesData time series event exists " + cell + ":" + timestampEnd);
                    //fetch event and calculate percentiles
                    Object res = Utils.readValue(fetchTimeSeriesEvent(timestampEnd,cell,host, metric),HashMap.class);
                    data = (HashMap<String, List>) res;
                    List<Long> x = data.get("x");
                    List<Double> v = data.get("v");
                    List<Double> v2 = new ArrayList<>();
                    for (int i = 0; i < x.size(); i++) {
                        long t = x.get(i);
                        if (t > peakStart) {//only peak time values
                            v2.add(v.get(i));
                        }
                    }
                    Map<String,Double> percentiles = Utils.getPercentiles(v2);

                    if(metric.equals("PA")){
                        int startIndex = getPeakIndexIfExists(x,peakStart);
                        int index = getPAKickinIndexIfExists(v,startIndex);
                        long offset = x.get(index) - peakStart;
                        if(offset < 0){
                            offset = 0;
                        }
                        System.out.println("---> PAStartOfset2 time:" + offset + ":" +peakStart+":"+x.get(index) + ":"+ Utils.convertEpochToUTCString(x.get(index)));
                        percentiles.put("PAStartOfset", offset*1.0);
                    }
                    return percentiles;
                }
                return null;
            }
        } catch (Exception e) {
            return null;
        }
        if(doPerc) {
            List<Double> v2 = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                long t = timestamps.get(i);
                if (t > peakStart) {//only peak time values
                    v2.add(values.get(i));
                }
            }
            Map<String,Double> percentiles = Utils.getPercentiles(v2);
            if(metric.equals("PA")){
                int startIndex = getPeakIndexIfExists(timestamps,peakStart);
                int index = getPAKickinIndexIfExists(values,startIndex);
                long offset = timestamps.get(index) - peakStart;
                if(offset < 0){
                    offset = 0;
                }
                System.out.println("---> PAStartOfset1 time:" + offset + ":" + peakStart+":"+timestamps.get(index) + ":" + Utils.convertEpochToUTCString(timestamps.get(index)));
                percentiles.put("PAStartOfset", 1.0*offset);
            }
            return percentiles;
        }
        return null;
    }

    private static int getPeakIndexIfExists(final List<Long> timestamps, long peakStart){
        for (int i = 0; i < timestamps.size(); i++) {
            if(timestamps.get(i) >= peakStart){
                return i;
            }
        }
        return 0;//default first
    }

    private static int getPAKickinIndexIfExists(final List<Double> values, int startIndex){
        Double startPA = 0.0;
        for (int i = 0; i < values.size(); i++) {
            if(i == 0 || values.get(i) < startPA){
                startPA = values.get(i);
            }else{
                if(values.get(i) > startPA){//PA shift
                    return i;
                }
            }
        }
        return 0;//default first
    }

    private static CanaryResponse getCanaryResponseWeekOverWeek(final long timestampStart11, final long timestampEnd11, final String instance1, final String domain1, final String cell1, final long timestampStart21, final long timestampEnd21, final String instance2, final String domain2, final String cell2, final int type, String host) {
        try {
            //hack, check if all zulu or zing
            List<Future<Integer>> futures = new ArrayList<>();
            futures.add(pool.submitTask(() -> isZuluOrZing(String.valueOf(timestampStart11), String.valueOf(timestampEnd11), instance1, domain1, cell1)));
            futures.add(pool.submitTask(() -> isZuluOrZing(String.valueOf(timestampStart21), String.valueOf(timestampEnd21), instance2, domain2, cell2)));
            //int check1 = isZuluOrZing(String.valueOf(timestampStart1), String.valueOf(timestampEnd1), instance1, domain1, cell1);
            //int check2 = isZuluOrZing(String.valueOf(timestampStart2), String.valueOf(timestampEnd2), instance2, domain2, cell2);
            int check1 = futures.get(0).get();
            int check2 = futures.get(1).get();
            futures.clear();

            //1 zing, 2 zulu, 0 mixed
            String canaryTag = "";
            if (check1 == 0 || check2 == 0) {
                System.out.println("Skip Mixed canary for " + instance1 + ":" + domain1 + ":" + cell1 + ":" + check1 + ":" + check2);
                canaryTag = "mixed-zing";
                //return null;
            } else {
                if(check1 == check2){
                    if(check1 == 1){
                        canaryTag = "zing-zing";
                    }else{
                        canaryTag = "zulu-zulu";
                    }
                }else{
                    if(check1 == 1){
                        canaryTag = "zing-zulu";
                    }else{
                        canaryTag = "zulu-zing";
                    }
                }
                System.out.println(canaryTag + " canary for " + instance1 + ":" + domain1 + ":" + cell1 + ":" + check1 + ":" + check2);
            }

            long timestampStart12 = timestampStart11;
            long timestampEnd12 = timestampEnd11;
            long timestampStart22 = timestampStart21;
            long timestampEnd22 = timestampEnd21;

            if (check1 == 1) {//zing, swap timestamps, first timestamp should be zulu
                long tmpStart = timestampStart12;
                long tmpEnd = timestampEnd12;
                timestampStart12 = timestampStart22;
                timestampEnd12 = timestampEnd22;
                timestampStart22 = tmpStart;
                timestampEnd22 = tmpEnd;
            }

            final long timestampStart1 = timestampStart12;
            final long timestampEnd1 = timestampEnd12;
            final long timestampStart2 = timestampStart22;
            final long timestampEnd2 = timestampEnd22;


            List<Future<List<String>>> futures1 = new ArrayList<>();
            futures1.add(pool.submitTask(() -> getCanaryPods(String.valueOf(timestampStart1), String.valueOf(timestampEnd1), instance1, domain1, cell1)));
            futures1.add(pool.submitTask(() -> getCanaryPods(String.valueOf(timestampStart2), String.valueOf(timestampEnd2), instance2, domain2, cell2)));
            //List<String> pods1 = getCanaryPods(String.valueOf(timestampStart1), String.valueOf(timestampEnd1), instance1, domain1, cell1);
            //List<String> pods2 = getCanaryPods(String.valueOf(timestampStart2), String.valueOf(timestampEnd2), instance2, domain2, cell2);
            List<String> pods1 = futures1.get(0).get();
            List<String> pods2 = futures1.get(1).get();
            futures1.clear();

            if (!pods1.isEmpty() && !pods2.isEmpty()) {

                List<Object> record = new ArrayList<>();
                List<String> header = new ArrayList<>();

                List<String> metricList = new ArrayList(Arrays.asList("rCpuT", "jCpuT", "cCpuT","cCpuTPeak", "cCpuR", "sfPt", "5xx", "4xx"));

                record.add("timestamp:timestamp");
                if (type == 3) {
                    record.add(System.currentTimeMillis());//add time stamp of when it ran
                } else {
                    //record.add(timestampEnd1);//epoch
                    record.add(timestampEnd11);//epoch

                }
                header.add("timestamp:timestamp");

                record.add("tid:data");
                record.add(1);//tid
                header.add("tid:text");

                record.add("cell:text");
                record.add(cell1);//cell
                header.add("cell:text");

                record.add("type:number");
                record.add(type);//type release:1, sidebyside:2
                header.add("type:number");

                record.add("cnt1:int");
                record.add(pods1.size());
                header.add("cnt1:int");
                record.add("cnt2:int");
                record.add(pods2.size());
                header.add("cnt2:int");

                record.add("canaryTag:text");
                record.add(canaryTag);//canaryTag
                header.add("canaryTag:text");

                System.out.println(cell1 + "start getCanaryDashboardURL");
                record.add("dashboard:url");
                record.add(getCanaryWeekDashboardURL(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2));
                header.add("dashboard:url");

                System.out.println(cell1 + "start getMetricDashboardURL");
                record.add("metrics:url");
                record.add(getweekMetricDashboardURL(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2));
                header.add("metrics:url");


                String aptURL = getSplunkweekAPTURL(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                System.out.println(aptURL);


                //total request Count
                List<Future<ArgusQueryT.QueryResponse>> futures2 = new ArrayList<>();
                //ArgusQueryT.QueryResponse reqCount1 = ArgusQueryT.getArgusMetric("reqCount", timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                //ArgusQueryT.QueryResponse reqCount2 = ArgusQueryT.getArgusMetric("reqCount", timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric("reqCount", timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1)));
                futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric("reqCount", timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2)));
                ArgusQueryT.QueryResponse reqCount1 = futures2.get(0).get();
                ArgusQueryT.QueryResponse reqCount2 = futures2.get(1).get();
                futures2.clear();

                Double rCount1 = 0.0;
                Double rCount2 = 0.0;
                if (reqCount1 != null && reqCount2 != null) {
                    rCount1 = reqCount1.getMetric();
                    rCount2 = reqCount2.getMetric();
                    record.add("rCnt1:number");
                    record.add(rCount1);//reqCount1
                    header.add("rCnt1:number");
                    record.add("rCnt2:number");
                    record.add(rCount2);//reqCount2
                    header.add("rCnt2:number");
                    Double rCountPercentChange = 100.0 * (rCount1 - rCount2) / rCount1;
                    record.add("rCnt %c:number");
                    record.add(rCountPercentChange);//jvmCpuPercentPerReqPercentChange
                    header.add("rCnt %c:number");

                    long spanSec = (timestampEnd1 - timestampStart1) / (1000);
                    record.add("CellReqPerSec1:number");
                    record.add(rCount1 / spanSec);//rPerSec1
                    header.add("CellReqPerSec1:number");
                    record.add("CellReqPerSec2:number");
                    record.add(rCount2 / spanSec);//rPerSec2
                    header.add("CellReqPerSec2:number");
                } else {
                    return null;
                }

                String metric = "kpodC";
                Map<String,Double> percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,true);
                Map<String,Double> percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,true);
                if(percentiles1 != null && percentiles2 != null && percentiles1.size() == percentiles2.size()) {
                    for (String key : percentiles1.keySet()) {
                        if(key.equals("P50")) {
                            Double percentileChange = 100.0 * (percentiles1.get(key) - percentiles2.get(key)) / percentiles1.get(key);
                            record.add(key + metric + " %c:number");
                            record.add(percentileChange);//jvmCpuPercentPerReqPercentChange
                            header.add(key + metric + " %c:number");

                            record.add(key + metric + " diff:number");
                            record.add(percentiles1.get(key) - percentiles2.get(key));//jvmCpuPercentPerReqPercentChange
                            header.add(key + metric + " diff:number");
                        }
                    }
                }

                metric = "cCpuT";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,true);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,true);

                if(percentiles1 != null && percentiles2 != null && percentiles1.size() == percentiles2.size()) {
                    for (String key : percentiles1.keySet()) {
                        record.add(key + metric + "1:number");
                        record.add(percentiles1.get(key));
                        header.add(key + metric + "1:number");

                        record.add(key + metric + "2:number");
                        record.add(percentiles2.get(key));
                        header.add(key + metric + "2:number");

                        if(key.equals("P95")) {
                            Double percentileChange = 100.0 * (percentiles1.get(key) - percentiles2.get(key)) / percentiles1.get(key);
                            record.add(key + metric + " %c:number");
                            record.add(percentileChange);//jvmCpuPercentPerReqPercentChange
                            header.add(key + metric + " %c:number");

                            Double percentileChangePerReq = 100.0 * ((percentiles1.get(key) / rCount1) - (percentiles2.get(key) / rCount2)) / (percentiles1.get(key) / rCount1);
                            record.add(key + metric + "/r  %c:number");
                            record.add(percentileChangePerReq);//jvmCpuPercentPerReqPercentChange
                            header.add(key + metric + "/r %c:number");
                        }
                    }
                }

                metric = "cCpuTN";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,true);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,true);

                if(percentiles1 != null && percentiles2 != null && percentiles1.size() == percentiles2.size()) {
                    for (String key : percentiles1.keySet()) {
                        record.add(key + metric + "1:number");
                        record.add(percentiles1.get(key));
                        header.add(key + metric + "1:number");

                        record.add(key + metric + "2:number");
                        record.add(percentiles2.get(key));
                        header.add(key + metric + "2:number");

                        if(key.equals("P95")) {
                            Double percentileChange = 100.0 * (percentiles1.get(key) - percentiles2.get(key)) / percentiles1.get(key);
                            record.add(key + metric + " %c:number");
                            record.add(percentileChange);//jvmCpuPercentPerReqPercentChange
                            header.add(key + metric + " %c:number");
                        }
                    }
                }

                metric = "rCnt";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,false);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,false);
                metric = "Apt";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,false);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,false);
                metric = "rCpuT";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,false);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,false);
                metric = "PA";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,true);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,false);
                long PAStartOfset = 0;
                if(percentiles1 != null) {
                    for (String key : percentiles1.keySet()) {
                        if(key.equals("PAStartOfset")) {
                            PAStartOfset = percentiles1.get(key).longValue();
                            System.out.println(cell1 +"PA ofset -------->" + PAStartOfset);
                        }
                    }
                }

                //get canary type series with values 1 for zing, 2 for zulu
                metric = "CanaryType";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,false);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,false);

                metric = "heap";
                percentiles1 = fetchLast24HrTimeSeriesData(timestampStart1, timestampEnd1, cell1,instance1,domain1,host,metric,false);
                percentiles2 = fetchLast24HrTimeSeriesData(timestampStart2, timestampEnd2, cell2,instance2,domain2,host, metric,false);

                //startup
                List<PeakRange.TimeRange> ranges1 = ArgusQueryT.getPeakTimeRanges(timestampStart1 - 2 * 24 * 60 * 60 * 1000, timestampEnd1, instance1, domain1, cell1); //last 2 day
                List<PeakRange.TimeRange> ranges2 = ArgusQueryT.getPeakTimeRanges(timestampStart2 - 2 * 24 * 60 * 60 * 1000, timestampEnd2, instance2, domain2, cell2); //last 2 day

                //ArgusQueryT.QueryResponse startUp1 = ArgusQueryT.getStatupAVG(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1, timestampStart1, timestampEnd1, ranges1, type);
                //ArgusQueryT.QueryResponse startUp2 = ArgusQueryT.getStatupAVG(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2, timestampStart2, timestampEnd2, ranges2, type);
                futures2.add(pool.submitTask(() -> ArgusQueryT.getStatupAVG(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1, timestampStart1, timestampEnd1, ranges1, type)));
                futures2.add(pool.submitTask(() -> ArgusQueryT.getStatupAVG(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2, timestampStart2, timestampEnd2, ranges2, type)));
                ArgusQueryT.QueryResponse startUp1 = futures2.get(0).get();
                ArgusQueryT.QueryResponse startUp2 = futures2.get(1).get();
                futures2.clear();

                if (startUp1 != null && startUp2 != null) {
                    record.add("avgStp1:number");
                    record.add(startUp1.getMetric());//APT1
                    header.add("avgStp1:number");
                    record.add("avgStp2:number");
                    record.add(startUp2.getMetric());//APT2
                    header.add("avgStp2:number");
                    Double startUpPercentChange = 100.0 * (startUp1.getMetric() - startUp2.getMetric()) / startUp1.getMetric();
                    record.add("avgStp %c:number");
                    record.add(startUpPercentChange);//startUpPercentChange
                    header.add("avgStp %c:number");

                    record.add("avgWrmpApt1:number");
                    record.add(startUp1.getMetric1());//APT1
                    header.add("avgWrmpApt1:number");
                    record.add("avgWrmpApt2:number");
                    record.add(startUp2.getMetric1());//APT2
                    header.add("avgWrmpApt2:number");
                    Double warmupUpPercentChange = 100.0 * (startUp1.getMetric1() - startUp2.getMetric1()) / startUp1.getMetric1();
                    record.add("avgWrmpApt %c:number");
                    record.add(warmupUpPercentChange);//startUpPercentChange
                    header.add("avgWrmpApt %c:number");

                    record.add("avgpeakWrmpApt1:number");
                    record.add(startUp1.getMetric2());//APT1
                    header.add("avgpeakWrmpApt1:number");
                    record.add("avgpeakWrmpApt2:number");
                    record.add(startUp2.getMetric2());//APT2
                    header.add("avgpeakWrmpApt2:number");
                    Double warmuppeakUpPercentChange = 100.0 * (startUp1.getMetric2() - startUp2.getMetric2()) / startUp1.getMetric2();
                    record.add("avgpeakWrmpApt %c:number");
                    record.add(warmuppeakUpPercentChange);//startUpPercentChange
                    header.add("avgpeakWrmpApt %c:number");
                } else {
                    record.add("avgStp1:number");
                    record.add(null);
                    header.add("avgStp1:number");
                    record.add("avgStp2:number");
                    record.add(null);
                    header.add("avgStp2:number");
                    record.add("avgStp %c:number");
                    record.add(null);
                    header.add("avgStp %c:number");

                    record.add("avgWrmpApt1:number");
                    record.add(null);
                    header.add("avgWrmpApt1:number");
                    record.add("avgWrmpApt2:number");
                    record.add(null);
                    header.add("avgWrmpApt2:number");
                    record.add("avgWrmpApt %c:number");
                    record.add(null);
                    header.add("avgWrmpApt %c:number");

                    record.add("avgpeakWrmpApt1:number");
                    record.add(null);//APT1
                    header.add("avgpeakWrmpApt1:number");
                    record.add("avgpeakWrmpApt2:number");
                    record.add(null);//APT2
                    header.add("avgpeakWrmpApt2:number");
                    record.add("avgpeakWrmpApt %c:number");
                    record.add(null);//startUpPercentChange
                    header.add("avgpeakWrmpApt %c:number");
                }

                //average APT
                //ArgusQueryT.QueryResponse APT1 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                //ArgusQueryT.QueryResponse APT2 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                futures2.add(pool.submitTask(() -> ArgusQueryT.getMetric(ArgusQueryT.avgAPT, timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1)));
                futures2.add(pool.submitTask(() -> ArgusQueryT.getMetric(ArgusQueryT.avgAPT, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2)));
                ArgusQueryT.QueryResponse APT1 = futures2.get(0).get();
                ArgusQueryT.QueryResponse APT2 = futures2.get(1).get();
                futures2.clear();

                if (APT1 != null && APT2 != null) {
                    record.add("avgApt1:number");
                    record.add(APT1.getMetric());//APT1
                    header.add("avgApt1:number");
                    record.add("avgApt2:number");
                    record.add(APT2.getMetric());//APT2
                    header.add("avgApt2:number");
                    Double aptPercentChange = 100.0 * (APT1.getMetric() - APT2.getMetric()) / APT1.getMetric();
                    record.add("avgApt %c:number");
                    record.add(aptPercentChange);//aptPercentChange
                    header.add("avgApt %c:number");
                } else {
                    record.add("avgApt1:number");
                    record.add(null);
                    header.add("avgApt1:number");
                    record.add("avgApt2:number");
                    record.add(null);
                    header.add("avgApt2:number");
                    record.add("avgApt %c:number");
                    record.add(null);
                    header.add("avgApt %c:number");
                }

                for (int i = 0; i < metricList.size(); i++) {
                    final String m = metricList.get(i);
                    System.out.println(cell1 + "start query for :" + m);
                    if(m.equals("jCpuT")){
                        record.add(metricList.get(i) + "1:number");
                        record.add(null);
                        header.add(metricList.get(i) + "1:number");
                        record.add(metricList.get(i) + "2:number");
                        record.add(null);
                        header.add(metricList.get(i) + "2:number");
                        record.add(metricList.get(i) + "/r %c:number");
                        record.add(null);
                        header.add(metricList.get(i) + "/r %c:number");
                        continue;
                    }
                    //ArgusQueryT.QueryResponse res1 = ArgusQueryT.getArgusMetric(metricList.get(i), timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                    //ArgusQueryT.QueryResponse res2 = ArgusQueryT.getArgusMetric(metricList.get(i), timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                    if(m.equals("cCpuTPeak")){
                        final long PAofset = PAStartOfset + 3 * 60 * 60 * 1000;//ignore first 3 hours after PA
                        final String tmpm = "cCpuT";
                        final long startTimeoffset1 = timestampStart1+PAofset;
                        final long startTimeoffset2 = timestampStart2+PAofset;
                        System.out.println(instance1 + ":" + domain1 + ":" + cell1 + ": ---> " + PAofset + ":"+timestampStart1+": new start:" + Utils.convertEpochToUTCString(startTimeoffset1) + ": old start"+ Utils.convertEpochToUTCString(timestampStart1) + " end:" + Utils.convertEpochToUTCString(timestampEnd1));
                        futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(tmpm, startTimeoffset1, timestampEnd1, instance1, domain1, cell1, pods1)));
                        futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(tmpm, startTimeoffset2, timestampEnd2, instance2, domain2, cell2, pods2)));
                    }else {
                        futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(m, timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1)));
                        futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(m, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2)));
                    }

                    ArgusQueryT.QueryResponse res1 = futures2.get(0).get();
                    ArgusQueryT.QueryResponse res2 = futures2.get(1).get();
                    futures2.clear();

                    if (res1 != null && res2 != null) {
                        record.add(metricList.get(i) + "1:number");
                        record.add(res1.getMetric());
                        header.add(metricList.get(i) + "1:number");
                        record.add(metricList.get(i) + "2:number");
                        record.add(res2.getMetric());
                        header.add(metricList.get(i) + "2:number");
                        Double metricPercentChange = 100.0 * ((res1.getMetric() / rCount1) - (res2.getMetric() / rCount2)) / (res1.getMetric() / rCount1);
                        record.add(metricList.get(i) + "/r %c:number");
                        record.add(metricPercentChange);
                        header.add(metricList.get(i) + "/r %c:number");
                    } else if (metricList.get(i).equals("cCpuT") || metricList.get(i).equals("cCpuR") || metricList.get(i).equals("cCpuTPeak")) {
                        //try incremental
                        long window = 3 * 60 * 60 * 1000;
                        Double cCpuTime1Total = 0.0;
                        Double cCpuTime2Total = 0.0;
                        Boolean success = true;

                        long currentStart = timestampStart1;
                        if(m.equals("cCpuTPeak")){
                            final long PAofset = PAStartOfset + 3 * 60 * 60 * 1000;//ignore first 3 hours after PA
                            currentStart = currentStart+PAofset;
                        }
                        while (currentStart <= timestampEnd1 && success) {
                            long currentEnd = currentStart + window;
                            if (currentEnd > timestampEnd1) {
                                currentEnd = timestampEnd1; // handle last partial window
                            }

                            System.out.println("Looping for 1:" + instance1 + ":" + domain1 + ":" + cell1 + ":" + Utils.convertEpochToUTCString(currentStart) + ":" + Utils.convertEpochToUTCString(currentEnd));
                            // ArgusQueryT.QueryResponse res = ArgusQueryT.getArgusMetric(metricList.get(i), currentStart, currentEnd, instance1, domain1, cell1, pods1);
                            final long currentStarttmp = currentStart;
                            final long currentEndtmp = currentEnd;
                            if(m.equals("cCpuTPeak")) {
                                final String tmpm = "cCpuT";
                                futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(tmpm, currentStarttmp, currentEndtmp, instance1, domain1, cell1, pods1)));
                            }else {
                                futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(m, currentStarttmp, currentEndtmp, instance1, domain1, cell1, pods1)));
                            }
                            currentStart = currentEnd + 1;
                        }
                        for (Future<ArgusQueryT.QueryResponse> future : futures2) {
                            ArgusQueryT.QueryResponse res = future.get();
                            if (res != null) {
                                cCpuTime1Total += res.getMetric();
                            } else {
                                success = false;
                            }
                        }
                        futures2.clear();
                        if (success) {
                            System.out.println("Looping success for1:" + instance2 + ":" + domain2 + ":" + cell2);
                            currentStart = timestampStart2;
                            if(m.equals("cCpuTPeak")){
                                final long PAofset = PAStartOfset + 3 * 60 * 60 * 1000;//ignore first 3 hours after PA
                                currentStart = currentStart+PAofset;
                            }
                            while (currentStart <= timestampEnd2 && success) {
                                long currentEnd = currentStart + window;
                                if (currentEnd > timestampEnd2) {
                                    currentEnd = timestampEnd2; // handle last partial window
                                }
                                System.out.println("Looping for 2:" + instance2 + ":" + domain2 + ":" + cell2 + ":" + Utils.convertEpochToUTCString(currentStart) + ":" + Utils.convertEpochToUTCString(currentEnd));
                                //ArgusQueryT.QueryResponse res = ArgusQueryT.getArgusMetric(metricList.get(i), currentStart, currentEnd, instance2, domain2, cell2, pods2);
                                final long currentStarttmp = currentStart;
                                final long currentEndtmp = currentEnd;
                                if(m.equals("cCpuTPeak")) {
                                    final String tmpm = "cCpuT";
                                    futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(tmpm, currentStarttmp, currentEndtmp, instance2, domain2, cell2, pods2)));
                                }else {
                                    futures2.add(pool.submitTask(() -> ArgusQueryT.getArgusMetric(m, currentStarttmp, currentEndtmp, instance2, domain2, cell2, pods2)));
                                }
                                currentStart = currentEnd + 1;
                            }
                            for (Future<ArgusQueryT.QueryResponse> future : futures2) {
                                ArgusQueryT.QueryResponse res = future.get();
                                if (res != null) {
                                    cCpuTime2Total += res.getMetric();
                                } else {
                                    success = false;
                                }
                            }
                            futures2.clear();
                        }
                        if (success) {
                            System.out.println("Looping success for:" + instance2 + ":" + domain2 + ":" + cell2);
                            record.add(metricList.get(i) + "1:number");
                            record.add(cCpuTime1Total);
                            header.add(metricList.get(i) + "1:number");
                            record.add(metricList.get(i) + "2:number");
                            record.add(cCpuTime2Total);
                            header.add(metricList.get(i) + "2:number");
                            Double metricPercentChange = 100.0 * ((cCpuTime1Total / rCount1) - (cCpuTime2Total / rCount2)) / (cCpuTime1Total / rCount1);
                            record.add(metricList.get(i) + "/r %c:number");
                            record.add(metricPercentChange);
                            header.add(metricList.get(i) + "/r %c:number");
                        } else {
                            System.out.println("Looping failed for:" + instance1 + ":" + domain1 + ":" + cell1);
                            record.add(metricList.get(i) + "1:number");
                            record.add(null);
                            header.add(metricList.get(i) + "1:number");
                            record.add(metricList.get(i) + "2:number");
                            record.add(null);
                            header.add(metricList.get(i) + "2:number");
                            record.add(metricList.get(i) + "/r %c:number");
                            record.add(null);
                            header.add(metricList.get(i) + "/r %c:number");
                        }
                    } else {
                        record.add(metricList.get(i) + "1:number");
                        record.add(null);
                        header.add(metricList.get(i) + "1:number");
                        record.add(metricList.get(i) + "2:number");
                        record.add(null);
                        header.add(metricList.get(i) + "2:number");
                        record.add(metricList.get(i) + "/r %c:number");
                        record.add(null);
                        header.add(metricList.get(i) + "/r %c:number");
                    }
                    System.out.println(cell1 + "end query for :" + metricList.get(i));
                }

                record.add("instance:text");
                record.add(instance1.replace("aws-", "").replace("-", "."));//instance
                header.add("instance:text");
                //record.add(domain);//instance
                //header.add("domain:text");

                header.add("spanMin:int");
                record.add("spanMin:int");
                record.add((timestampEnd1 - timestampStart1) / (60 * 1000));

                if (type == 4 || type == 1) {
                    record.add("start1:timestamp");
                    record.add(timestampStart1);
                    header.add("start1:timestamp");
                    record.add("end1:timestamp");
                    record.add(timestampEnd1);
                    header.add("end1:timestamp");

                    record.add("start2:timestamp");
                    record.add(timestampStart2);
                    header.add("start2:timestamp");
                    record.add("end2:timestamp");
                    record.add(timestampEnd2);
                    header.add("end2:timestamp");
                } else {
                    record.add("start:data");
                    record.add(timestampStart1);
                    header.add("start:data");
                    record.add("end:data");
                    record.add(timestampEnd1);
                    header.add("end:data");
                }

                record.add("pod1:data");
                record.add(Utils.toJson(pods1));
                header.add("pod1:data");
                record.add("pod2:data");
                record.add(Utils.toJson(pods2));
                header.add("pod2:data");

                System.out.println("getHeap start");
                List<Future<Double>> futures3 = new ArrayList<>();
                //Double heap1 = ArgusQueryT.getHeap(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                //Double heap2 = ArgusQueryT.getHeap(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                futures3.add(pool.submitTask(() -> ArgusQueryT.getHeap(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1)));
                futures3.add(pool.submitTask(() -> ArgusQueryT.getHeap(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2)));

                System.out.println("getInstanceTypeTag start");
                //hack use only 1 hr
                long tmp1 = timestampEnd1;
                long tmp2 = timestampEnd2;
                if ((timestampEnd1 - timestampStart1) > 60 * 60 * 1000) {
                    tmp1 = timestampStart1 + 60 * 60 * 1000;
                    tmp2 = timestampStart2 + 60 * 60 * 1000;

                }
                List<Future<String>> futures4 = new ArrayList<>();
                //String instanceType1 = ArgusQueryT.getInstanceTypeTag(timestampStart1, tmp1, instance1, domain1, cell1, pods1);
                //String instanceType2 = ArgusQueryT.getInstanceTypeTag(timestampStart2, tmp2, instance2, domain2, cell2, pods2);
                final long tmp11 = tmp1;
                final long tmp22 = tmp2;
                futures4.add(pool.submitTask(() -> ArgusQueryT.getInstanceTypeTag(timestampStart1, tmp11, instance1, domain1, cell1, pods1)));
                futures4.add(pool.submitTask(() -> ArgusQueryT.getInstanceTypeTag(timestampStart2, tmp22, instance2, domain2, cell2, pods2)));

                System.out.println("getReleaseTag start");
                //String release1 = ArgusQueryT.getReleaseTag(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                //String release2 = ArgusQueryT.getReleaseTag(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                futures4.add(pool.submitTask(() -> ArgusQueryT.getReleaseTag(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1)));
                futures4.add(pool.submitTask(() -> ArgusQueryT.getReleaseTag(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2)));

                Double heap1 = futures3.get(0).get();
                Double heap2 = futures3.get(1).get();
                futures3.clear();
                System.out.println("getHeap end");

                String instanceType1 = futures4.get(0).get();
                String instanceType2 = futures4.get(1).get();
                System.out.println("getInstanceTypeTag end");

                String release1 = futures4.get(2).get();
                String release2 = futures4.get(3).get();
                futures4.clear();
                System.out.println("getReleaseTag end");

                header.add("heap1:number");
                record.add("heap1:number");
                if (heap1 != null) {
                    record.add(heap1 / (1024 * 1024 * 1024));
                } else {
                    record.add("NA");
                }
                header.add("heap2:number");
                record.add("heap2:number");
                if (heap2 != null) {
                    record.add(heap2 / (1024 * 1024 * 1024));
                } else {
                    record.add("NA");
                }
                header.add("awsInstance1:text");
                record.add("awsInstance1:text");
                record.add(instanceType1);
                header.add("awsInstance2:text");
                record.add("awsInstance2:text");
                record.add(instanceType2);
                header.add("release1:text");
                record.add("release1:text");
                record.add(release1);
                header.add("release2:text");
                record.add("release2:text");
                record.add(release2);

                Double aptc1 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCount, timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                Double aptc2 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCountBelow500, timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                Double aptC500Percent1 = null;
                Double aptC1above500 = null;
                if (aptc1 != null && aptc2 != null) {
                    record.add("aptC1:number");
                    record.add(aptc1);
                    header.add("aptC1:number");
                    record.add("aptC1<500:number");
                    record.add(aptc2);
                    header.add("aptC1<500:number");
                    aptC500Percent1 = 100.0 * aptc2 / aptc1;
                    record.add("aptC1<500 %:number");
                    record.add(aptC500Percent1);
                    header.add("aptC1<500 %:number");
                    aptC1above500 = aptc1 - aptc2;
                }
                aptc1 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCount, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                aptc2 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCountBelow500, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
                Double aptC500Percent2 = null;
                Double aptC2above500 = null;
                if (aptc1 != null && aptc2 != null) {
                    record.add("aptC2:number");
                    record.add(aptc1);
                    header.add("aptC2:number");
                    record.add("aptC2<500:number");
                    record.add(aptc2);
                    header.add("aptC2<500:number");
                    aptC500Percent2 = 100.0 * aptc2 / aptc1;
                    record.add("aptC2<500 %:number");
                    record.add(aptC500Percent2);
                    header.add("aptC2<500 %:number");
                    aptC2above500 = aptc1 - aptc2;
                }
                if (aptC500Percent1 != null && aptC500Percent2 != null) {
                    Double aptC500Percent = 100.00 * (aptC500Percent1 - aptC500Percent2) / aptC500Percent1;
                    record.add("aptC<500 % %c:number");
                    record.add(aptC500Percent);
                    header.add("aptC<500 % %c:number");

                    Double aptCabove500Percent = 100.00 * (aptC2above500 - aptC1above500) / aptC1above500;
                    record.add("aptC>500 % %c:number");
                    record.add(aptCabove500Percent);
                    header.add("aptC>500 % %c:number");
                }

                String release = SideBySide.cellReleaseMap.getOrDefault(cell1, "NA");
                record.add("release:text");
                record.add(release);
                header.add("release:text");

                record.add("splunkapt:url");
                record.add(aptURL);
                header.add("splunkapt:url");

                return new CanaryResponse(header, record);
            }
        }catch (Exception e){
            System.out.println( "Exception:" + e.getMessage());
        }
        return null;
    }

    public static String getCanaryWeekDashboardURL(long finalStart1,long finalEnd1, String instance1,String domain1, String cell1, List<String> pod1, long finalStart2,long finalEnd2, String instance2,String domain2, String cell2, List<String> pod2) {
        String URL = "https://moncloud-grafana.sfproxy.monitoring.aws-esvc1-useast2.aws.sfdc.cl/d/ndLYoVsHz/week-over-week-falcon-rpulle-automation?orgId=1&";
        URL = URL + "&var-cell1=" + cell1;
        URL = URL + "&var-cell2=" + cell2;
        URL = URL + "&var-functional_domain1=" + domain1;
        URL = URL + "&var-functional_domain2=" + domain2;
        URL = URL + "&var-falcon_instance1=" + instance1;
        URL = URL + "&var-falcon_instance2=" + instance2;
        URL = URL + "&var-interval=1m";
        URL = URL + "&var-prev="+(finalStart1-finalStart2)/(1000*60)+"m";
        for (int i = 0; i < pod2.size(); i++) {
            URL = URL + "&var-pod2=" + pod2.get(i);
        }
        for (int i = 0; i < pod1.size(); i++) {
            URL = URL + "&var-pod1=" + pod1.get(i);
        }
        URL = URL + "&from=" + finalStart1;
        URL = URL + "&to=" + finalEnd1;
        URL = URL + "&var-start2=" + finalStart2;
        URL = URL + "&var-end2=" + finalEnd2;
        return URL;
    }

    private static void addTimeSeriesEvent(Object data, long timestamp, String cell, String host, String metric) throws IOException {
        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "gold");
        queryMap.put("tenant-id", "timeseries");
        queryMap.put("instance-id", host);
        queryMap.put("host", host);
        queryMap.put("source-file", "timeseries");
        queryMap.put("file-name", "canary-timeseries");//
        queryMap.put("type", "timeseries");
        queryMap.put("name", "timeseries");
        queryMap.put("cell", cell);
        queryMap.put("metric", metric);
        queryMap.put("etime", String.valueOf(System.currentTimeMillis()));

        System.out.println("1 addTimeSeriesEvent --------->" + timestamp + ":" + Utils.toJson(queryMap));

        eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(data), "dev");
    }

    private static String fetchTimeSeriesEvent(long timestamp, String cell, String host, String metric) {
        if (eventStore == null) {
            return null;
        }

        Map<Long, Map<String, String>> profiles;
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "=gold");
        queryMap.put("name", "=timeseries");
        queryMap.put("tenant-id", "=timeseries");
        queryMap.put("cell", "=" + cell);
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        queryMap.put("cell", "=" + cell);
        queryMap.put("metric", "=" + metric);
        try {
            return eventStore.getGenieEvent(timestamp, timestamp, queryMap, dimMap, "dev");
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean eventEsists(long timestamp, String host, String cell, String metric) {
        if(eventStore == null){
            return true;
        }
        Map<Long, Map<String, String>> profiles;
        final Map<String, String> dimMap = new HashMap<>();
        final Map<String, String> queryMap = new HashMap<>();
        queryMap.put("source", "=gold");
        queryMap.put("name", "=timeseries");
        queryMap.put("tenant-id", "=timeseries");
        queryMap.put("cell", "=" + cell);
        queryMap.put("instance-id", "=" + host);
        queryMap.put("host", "=" + host);
        queryMap.put("cell", "=" + cell);
        queryMap.put("metric", "=" + metric);
        try {
            int count = eventStore.isEventExist("dev", timestamp - 1, timestamp + 1, queryMap, dimMap);
            System.out.println("1 eventEsists --------->" + timestamp + ":"+ count + ":" + Utils.toJson(queryMap));
            if (count > 0) {
                return true;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    public static void main(String[] args) {
        try {
            CanaryResponse res = processWeekOverWeekCanary(1742270400000L, 1742302800000L, "ind86", null);
            //
            System.out.println("--->" + Utils.toJson(res));
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
