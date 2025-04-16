package perfgenie.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.io.Resources;
import org.checkerframework.checker.units.qual.A;
import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.HashMap;

import static perfgenie.utils.ArgusQueryT.getCanaryPods;
//import static perfgenie.utils.Canary.*;


public class WeekOverWeek {
    public static long mindiff = 3600000;
    public static long maxTimeWindow = 5 * 60 * 60 * 1000; // 4 hours due to argus query limitations, need to switch to huron

    public static CanaryResponse processWeekOverWeekCanary(long timestampStart, long timestampEnd, String cell) {
        return processWeekOverWeekCanaryTask(timestampStart,timestampEnd, (String)ArgusQueryT.pc.config.get(cell).get("instance"), (String)ArgusQueryT.pc.config.get(cell).get("domain"), cell);
    }

    private static CanaryResponse processWeekOverWeekCanaryTask(long timestampStart, long timestampEnd, String instance, String domain, String cell) {

        List<String> metricList = new ArrayList(Arrays.asList("rCPUTime", "avgJCPU", "jCPUTime", "cCPUTime", "sfPt", "5xx", "4xx"));
        List<String> header = new ArrayList<>();
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
                System.out.println(cell + " adjusted start: " + range.start + " end: " + range.end);
            }

            if (range != null){
                List<Object> record = new ArrayList<>();
                long previousTimeDiffMs = 7 * 24 * 60 * 60 * 1000;
                List<String> pods1 = getCanaryPods(String.valueOf(range.start), String.valueOf(range.end), instance, domain, cell);
                List<String> pods2 = getCanaryPods(String.valueOf(range.start-previousTimeDiffMs), String.valueOf(range.end-previousTimeDiffMs), instance, domain, cell);
                if(!pods1.isEmpty() && !pods2.isEmpty()){
                    record.add(timestampEnd);//epoch
                    header.add("timestamp:timestamp");
                    record.add(1);//tid
                    header.add("tid:text");
                    record.add(cell);//cell
                    header.add("cell:text");

                    //total request Count
                    ArgusQueryT.QueryResponse reqCount1 = ArgusQueryT.getArgusMetric("reqCount", range.start, range.end, instance, domain, cell, pods1);
                    ArgusQueryT.QueryResponse reqCount2 = ArgusQueryT.getArgusMetric("reqCount", range.start - previousTimeDiffMs, range.end - previousTimeDiffMs, instance, domain, cell, pods2);
                    Double rCount1 = 0.0;
                    Double rCount2 = 0.0;
                    if (reqCount1 != null && reqCount2 != null) {
                        rCount1 = reqCount1.getMetric();
                        rCount2 = reqCount2.getMetric();
                        record.add(rCount1);//reqCount1
                        header.add("rCount1:number");
                        record.add(rCount2);//reqCount2
                        header.add("rCount2:number");
                        Double rCountPercentChange = 100.0 * (rCount1 - rCount2) / rCount1;
                        record.add(rCountPercentChange);//jvmCpuPercentPerReqPercentChange
                        header.add("rCount %c:number");
                    } else {
                        return null;
                    }

                    //startup
                    ArgusQueryT.QueryResponse startUp1 = ArgusQueryT.getStatupAVG(range.start, range.end, instance, domain, cell, pods1);
                    ArgusQueryT.QueryResponse startUp2 = ArgusQueryT.getStatupAVG(range.start - previousTimeDiffMs, range.end - previousTimeDiffMs, instance, domain, cell, pods2);
                    if (startUp1 != null && startUp2 != null) {
                        record.add(startUp1.getMetric());//APT1
                        header.add("startUp1:number");
                        record.add(startUp2.getMetric());//APT2
                        header.add("startUp2:number");
                        Double startUpPercentChange = 100.0 * (startUp1.getMetric() - startUp2.getMetric()) / startUp1.getMetric();
                        record.add(startUpPercentChange);//startUpPercentChange
                        header.add("startUp %c:number");
                    } else {
                        record.add(null);
                        header.add("startUp1:number");
                        record.add(null);
                        header.add("startUp2:number");
                        record.add(null);
                        header.add("startUp %c:number");
                    }

                    //average APT
                    ArgusQueryT.QueryResponse APT1 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, range.start, range.end, instance, domain, cell, pods1);
                    ArgusQueryT.QueryResponse APT2 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, range.start - previousTimeDiffMs, range.end - previousTimeDiffMs, instance, domain, cell, pods2);
                    if (APT1 != null && APT2 != null) {
                        record.add(APT1.getMetric());//APT1
                        record.add(APT2.getMetric());//APT2
                        Double aptPercentChange = 100.0 * (APT1.getMetric() - APT2.getMetric()) / APT1.getMetric();
                        record.add(aptPercentChange);//aptPercentChange
                        header.add("avgAPT %c:number");
                    }else {
                        record.add(null);
                        header.add("avgAPT1:number");
                        record.add(null);
                        header.add("avgAPT1:number");
                        record.add(null);
                        header.add("avgAPT %c:number");
                    }

                    for (int i=0; i<metricList.size();i++){
                        ArgusQueryT.QueryResponse res1 = ArgusQueryT.getArgusMetric(metricList.get(i), range.start, range.end, instance, domain, cell, pods1);
                        ArgusQueryT.QueryResponse res2 = ArgusQueryT.getArgusMetric(metricList.get(i), range.start - previousTimeDiffMs, range.end - previousTimeDiffMs, instance, domain, cell, pods2);
                        if (res1 != null && res2 != null) {
                            record.add(res1.getMetric());
                            header.add(metricList.get(i) + "1:number");
                            record.add(res2.getMetric());
                            header.add(metricList.get(i) + "2:number");
                            Double metricPercentChange = 100.0 * (res1.getMetric() - res2.getMetric()) / res1.getMetric();
                            record.add(metricPercentChange);
                            header.add(metricList.get(i) + " %c:number");
                        }else {
                            record.add(null);
                            header.add(metricList.get(i) + "1:number");
                            record.add(null);
                            header.add(metricList.get(i) + "2:number");
                            record.add(null);
                            header.add(metricList.get(i) + "/r %c:number");
                        }
                    }

                    record.add(instance);//instance
                    header.add("instance:text");
                    record.add(domain);//instance
                    header.add("domain:text");
                    record.add(cell);//cell
                    header.add("cell:text");
                    record.add(1);//type release:1, sidebyside:2
                    header.add("type:number");

                    return new CanaryResponse(header,record);
                }
            }

        }
        return null;
    }

    public static String getCanaryDashboardURL(List<String> pod1, List<String> pod2, long curfinalStart,
                                               long curfinalEnd, String instance, String domain, String cell) {
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

    public static void main(String[] args) {
        try {
            CanaryResponse res = processWeekOverWeekCanary(1742270400000L, 1742302800000L, "ind86");
            System.out.println("--->" + Utils.toJson(res));
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
