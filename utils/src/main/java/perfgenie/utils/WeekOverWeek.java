package perfgenie.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.io.Resources;
import org.checkerframework.checker.guieffect.qual.UIType;
import org.checkerframework.checker.units.qual.A;
import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.HashMap;
import java.util.concurrent.Future;

import static perfgenie.utils.ArgusQueryT.getCanaryPods;
//import static perfgenie.utils.Canary.*;


public class WeekOverWeek {
    public static long mindiff = 3600000;
    public static long maxTimeWindow = 120 * 60 * 60 * 1000; // 5*24 hours due to argus query limitations, need to switch to huron

    static FunctionExecutorPool pool = new FunctionExecutorPool(5);

    public static CanaryResponse processWeekOverWeekCanary(long timestampStart, long timestampEnd, String cell) {
        return processWeekOverWeekCanaryTask(timestampStart,timestampEnd, (String)ArgusQueryT.pc.config.get(cell).get("instance"), (String)ArgusQueryT.pc.config.get(cell).get("domain"), cell);
    }

    private static CanaryResponse processWeekOverWeekCanaryTask(long timestampStart, long timestampEnd, String instance, String domain, String cell) {
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
                long previousTimeDiffMs = 7 * 24 * 60 * 60 * 1000;
                return getCanaryResponseWeekOverWeek(range.start,range.end, instance, domain, cell, range.start-previousTimeDiffMs, range.end-previousTimeDiffMs, instance, domain, cell, 1);
            }
        }
        return null;
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

    public static CanaryResponse getCanaryResponseWeekOverWeek(final long timestampStart1, final long timestampEnd1, final String instance1, final String domain1, final String cell1, final long timestampStart2, final long timestampEnd2, final String instance2, final String domain2, final String cell2, final int type){
        //hack, check if all zulu or zing
        List<Future<Integer>> futures = new ArrayList<>();
        futures.add(pool.submitTask(() -> isZuluOrZing(String.valueOf(timestampStart1), String.valueOf(timestampEnd1), instance1, domain1, cell1)));
        int check1 = isZuluOrZing(String.valueOf(timestampStart1), String.valueOf(timestampEnd1), instance1, domain1, cell1);
        int check2 = isZuluOrZing(String.valueOf(timestampStart2), String.valueOf(timestampEnd2), instance2, domain2, cell2);


        if(check1 == 0 || check2 == 0 || check1 == check2){
            System.out.println("No canary for " + instance1 + ":" +  domain1 +":"+ cell1 + ":"+check1+":"+check2);
            return null;
        }else{
            System.out.println("canary for " + instance1 + ":" +  domain1 +":"+ cell1 + ":"+check1+":"+check2);
        }

        if(check1 == 1){//zing, swap timestamps, first timestamp should be zulu
            long tmpStart = timestampStart1;
            long tmpEnd = timestampEnd1;
            timestampStart1 = timestampStart2;
            timestampEnd1 = timestampEnd2;
            timestampStart2 = tmpStart;
            timestampEnd2 = tmpEnd;
        }

        List<String> pods1 = getCanaryPods(String.valueOf(timestampStart1), String.valueOf(timestampEnd1), instance1, domain1, cell1);
        List<String> pods2 = getCanaryPods(String.valueOf(timestampStart2), String.valueOf(timestampEnd2), instance2, domain2, cell2);
        if(!pods1.isEmpty() && !pods2.isEmpty()){
            List<String> header = new ArrayList<>();
            List<Object> record = new ArrayList<>();
            List<String> metricList = new ArrayList(Arrays.asList("rCpuT", "jCpuT", "cCpuT", "cCpuR", "sfPt", "5xx", "4xx"));

            record.add("timestamp:timestamp");
            if(type == 3){
                record.add(System.currentTimeMillis());//add time stamp of when it ran
            }else {
                record.add(timestampEnd1);//epoch
            }
            header.add("timestamp:timestamp");

            record.add("tid:data");
            record.add(1);//tid
            header.add("tid:text");
            record.add("cell:text");
            record.add(cell1);//cell
            header.add("cell:text");

            record.add("cnt1:int");
            record.add(pods1.size());
            header.add("cnt1:int");
            record.add("cnt2:int");
            record.add(pods2.size());
            header.add("cnt2:int");

            System.out.println(cell1 + "start getCanaryDashboardURL");
            record.add("dashboard:url");
            record.add(getCanaryWeekDashboardURL(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1,timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2));
            header.add("dashboard:url");

            System.out.println(cell1 + "start getMetricDashboardURL");
            record.add("metrics:url");
            record.add(getweekMetricDashboardURL(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1,timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2));
            header.add("metrics:url");


            String aptURL = getSplunkweekAPTURL(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1,timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
            System.out.println(aptURL);


            //total request Count
            ArgusQueryT.QueryResponse reqCount1 = ArgusQueryT.getArgusMetric("reqCount", timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
            ArgusQueryT.QueryResponse reqCount2 = ArgusQueryT.getArgusMetric("reqCount", timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
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

                long spanSec = (timestampEnd1-timestampStart1)/(1000);
                record.add("CellReqPerSec1:number");
                record.add(rCount1/spanSec);//rPerSec1
                header.add("CellReqPerSec1:number");
                record.add("CellReqPerSec2:number");
                record.add(rCount2/spanSec);//rPerSec2
                header.add("CellReqPerSec2:number");
            } else {
                return null;
            }

            //startup
            List<PeakRange.TimeRange> ranges1 = ArgusQueryT.getPeakTimeRanges( timestampStart1-2*24*60*60*1000,  timestampEnd1,  instance1,  domain1,  cell1); //last 2 day
            List<PeakRange.TimeRange> ranges2 = ArgusQueryT.getPeakTimeRanges( timestampStart2-2*24*60*60*1000,  timestampEnd2,  instance2,  domain2,  cell2); //last 2 day
            ArgusQueryT.QueryResponse startUp1 = ArgusQueryT.getStatupAVG(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1,timestampStart1,timestampEnd1,ranges1,type);
            ArgusQueryT.QueryResponse startUp2 = ArgusQueryT.getStatupAVG(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2,timestampStart2,timestampEnd2,ranges2,type);
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
            ArgusQueryT.QueryResponse APT1 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
            ArgusQueryT.QueryResponse APT2 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
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
                System.out.println(cell1 + "start query for :" + metricList.get(i));
                ArgusQueryT.QueryResponse res1 = ArgusQueryT.getArgusMetric(metricList.get(i), timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
                ArgusQueryT.QueryResponse res2 = ArgusQueryT.getArgusMetric(metricList.get(i), timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
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
                } else if (metricList.get(i).equals("cCpuT") || metricList.get(i).equals("cCpuR")) {
                    //try incremental
                    long window = 3 * 60 * 60 * 1000;
                    Double cCpuTime1Total = 0.0;
                    Double cCpuTime2Total = 0.0;
                    Boolean success = true;

                    long currentStart = timestampStart1;
                    while (currentStart <= timestampEnd1 && success) {
                        long currentEnd = currentStart + window;
                        if (currentEnd > timestampEnd1) {
                            currentEnd = timestampEnd1; // handle last partial window
                        }
                        System.out.println("Looping for 1:" + instance1 + ":" + domain1 + ":" + cell1 + ":" + Utils.convertEpochToUTCString(currentStart) + ":" + Utils.convertEpochToUTCString(currentEnd));
                        ArgusQueryT.QueryResponse res = ArgusQueryT.getArgusMetric(metricList.get(i), currentStart, currentEnd, instance1, domain1, cell1, pods1);
                        if (res != null) {
                            cCpuTime1Total += res.getMetric();
                        } else {
                            success = false;
                        }
                        currentStart = currentEnd + 1;
                    }
                    if (success) {
                        System.out.println("Looping success for1:" + instance2 + ":" + domain2 + ":" + cell2);
                        currentStart = timestampStart2;
                        while (currentStart <= timestampEnd2 && success) {
                            long currentEnd = currentStart + window;
                            if (currentEnd > timestampEnd2) {
                                currentEnd = timestampEnd2; // handle last partial window
                            }
                            System.out.println("Looping for 2:" + instance2 + ":" + domain2 + ":" + cell2 + ":" + Utils.convertEpochToUTCString(currentStart) + ":" + Utils.convertEpochToUTCString(currentEnd));
                            ArgusQueryT.QueryResponse res = ArgusQueryT.getArgusMetric(metricList.get(i), currentStart, currentEnd, instance2, domain2, cell2, pods2);
                            if (res != null) {
                                cCpuTime2Total += res.getMetric();
                            } else {
                                success = false;
                            }
                            currentStart = currentEnd + 1;
                        }
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
            record.add(instance1.replace("aws-","").replace("-","."));//instance
            header.add("instance:text");
            //record.add(domain);//instance
            //header.add("domain:text");
            record.add("type:number");
            record.add(type);//type release:1, sidebyside:2
            header.add("type:number");

            header.add("spanMin:int");
            record.add("spanMin:int");
            record.add((timestampEnd1-timestampStart1)/(60*1000));

            if(type == 4){
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
            }else {
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
            Double heap1 = ArgusQueryT.getHeap(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
            Double heap2 = ArgusQueryT.getHeap(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
            System.out.println("getHeap end");

            System.out.println("getInstanceTypeTag start");
            //hack use only 1 hr
            long tmp1 = timestampEnd1;
            long tmp2 = timestampEnd2;
            if((timestampEnd1 - timestampStart1) > 60*60*1000){
                tmp1 = timestampStart1 + 60*60*1000;
                tmp2 = timestampStart2 + 60*60*1000;

            }
            String instanceType1 = ArgusQueryT.getInstanceTypeTag(timestampStart1, tmp1, instance1, domain1, cell1, pods1);
            String instanceType2 = ArgusQueryT.getInstanceTypeTag(timestampStart2, tmp2, instance2, domain2, cell2, pods2);
            System.out.println("getInstanceTypeTag end");

            System.out.println("getReleaseTag start");
            String release1 = ArgusQueryT.getReleaseTag(timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
            String release2 = ArgusQueryT.getReleaseTag(timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
            System.out.println("getReleaseTag end");


            header.add("heap1:number");
            record.add("heap1:number");
            if(heap1 != null) {
                record.add(heap1/(1024*1024*1024));
            }else{
                record.add("NA");
            }
            header.add("heap2:number");
            record.add("heap2:number");
            if(heap2 != null) {
                record.add(heap2/(1024*1024*1024));
            }else{
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

            Double aptc1 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCount,timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
            Double aptc2 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCountBelow500,timestampStart1, timestampEnd1, instance1, domain1, cell1, pods1);
            Double aptC500Percent1=null;
            Double aptC1above500=null;
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
            aptc1 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCount,timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
            aptc2 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCountBelow500,timestampStart2, timestampEnd2, instance2, domain2, cell2, pods2);
            Double aptC500Percent2 = null;
            Double aptC2above500=null;
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
                Double aptC500Percent = 100.00 * (aptC500Percent1-aptC500Percent2)/aptC500Percent1;
                record.add("aptC<500 % %c:number");
                record.add(aptC500Percent);
                header.add("aptC<500 % %c:number");

                Double aptCabove500Percent = 100.00 * (aptC2above500-aptC1above500)/aptC1above500;
                record.add("aptC>500 % %c:number");
                record.add(aptCabove500Percent);
                header.add("aptC>500 % %c:number");
            }

            String release = SideBySide.cellReleaseMap.getOrDefault(cell1,"NA");
            record.add("release:text");
            record.add(release);
            header.add("release:text");

            record.add("splunkapt:url");
            record.add(aptURL);
            header.add("splunkapt:url");

            return new CanaryResponse(header,record);
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

    public static void main(String[] args) {
        try {

            CanaryResponse res = processWeekOverWeekCanary(1742270400000L, 1742302800000L, "ind86");
            //
            System.out.println("--->" + Utils.toJson(res));
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }
}
