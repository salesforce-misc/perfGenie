package perfgenie.utils;

import com.google.common.io.Resources;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.util.*;


//import static perfgenie.utils.Canary.*;


public class SideBySide {
    public static long mindiff = 3600000;
    public static long maxTimeWindow = 4 * 60 * 60 * 1000; // 4 hours due to argus query limitations, need to switch to huron
    public static HashMap<String, String> cellReleaseMap;
    static {
        try {
            cellReleaseMap = (HashMap<String, String>) Utils.readValue(Resources.toString(Resources.getResource("releasemap.json"), StandardCharsets.UTF_8), HashMap.class);
        }catch (IOException e){
            cellReleaseMap = new HashMap<>();
        }
    }

    public static CanaryResponse processSideBySideCanary(long timestampStart, long timestampEnd, String cell) {
        return processSideBySideCanaryTask(timestampStart, timestampEnd, cell, 2);
    }

    public static synchronized CanaryResponse processSideBySideCanaryTask(long timestampStart, long timestampEnd, String cell, int type) {

        String scope = ArgusQueryT.getScope(timestampStart,timestampEnd,cell);
        if(scope == null){
            System.out.println(cell + " failed get scope");
            return null;
        }

        String[] parts = scope.split("\\.");
        String instance = parts[2];
        String domain = parts[3];

        System.out.println(scope + ":" + instance + ":" + domain);

        List<Object> record = new ArrayList<>();
        List<String> metricList = new ArrayList(Arrays.asList("rCpuT", "jCpuT", "cCpuT", "sfPt", "5xx", "4xx"));
        List<String> header = new ArrayList<>();

        CanaryDetails canary = processCanary(String.valueOf(timestampStart), String.valueOf(timestampEnd), instance, domain, cell);
        if (canary != null && canary.pod1.size() == canary.pod2.size()) {
            record.add("timestamp:timestamp");
            if(type == 3){
                record.add(System.currentTimeMillis());//add time stamp of when it ran
            }else {
                record.add(timestampEnd);//epoch
            }
            header.add("timestamp:timestamp");
            record.add("tid:data");
            record.add(1);//tid
            header.add("tid:text");

            record.add("cell:text");
            record.add(cell);//cell
            header.add("cell:text");

            record.add("type:number");
            record.add(type);//type release:1, sidebyside:2
            header.add("type:number");

            record.add("cmpCnt:int");
            record.add(canary.pod1.size());
            header.add("cmpCnt:int");
            record.add("cnt1:int");
            record.add(canary.podall1.size());
            header.add("cnt1:int");
            record.add("cnt2:int");
            record.add(canary.podall2.size());
            header.add("cnt2:int");

            //VarianceResult varianceZulu = Variance.getVarianceOf("jvmCpuMs", canary.finalStart,canary.finalEnd,instance,domain,cell, canary.pod1);
            //VarianceResult varianceZing = Variance.getVarianceOf("jvmCpuMs", canary.finalStart,canary.finalEnd,instance,domain,cell, canary.pod2);
            /*record.add(-1);
            header.add("variance1:number");
            record.add(-1);
            header.add("variance2:number");*/

            //total request Count
            ArgusQueryT.QueryResponse reqCount1 = ArgusQueryT.getArgusMetric("reqCount", canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
            ArgusQueryT.QueryResponse reqCount2 = ArgusQueryT.getArgusMetric("reqCount", canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
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

                long spanSec = (canary.finalEnd-canary.finalStart)/(1000);
                record.add("JvmReqPerSec1:number");
                record.add(rCount1/(canary.pod1.size()*spanSec));//rPerSec1
                header.add("JvmReqPerSec1:number");
                record.add("JvmReqPerSec2:number");
                record.add(rCount2/(canary.pod1.size()*spanSec));//rPerSec2
                header.add("JvmReqPerSec2:number");

            } else {
                return null;
            }

            //startup
            List<PeakRange.TimeRange> ranges = ArgusQueryT.getPeakTimeRanges( timestampEnd-2*24*60*60*1000,  timestampEnd,  instance,  domain,  cell); //last 2 day
            ArgusQueryT.QueryResponse startUp1 = ArgusQueryT.getStatupAVG(canary.finalStart, canary.finalEnd, instance, domain, cell, canary.podallseen1,timestampStart,timestampEnd,ranges, type);
            ArgusQueryT.QueryResponse startUp2 = ArgusQueryT.getStatupAVG(canary.finalStart, canary.finalEnd, instance, domain, cell, canary.podallseen2,timestampStart,timestampEnd,ranges, type);
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
            }

            //average APT
            ArgusQueryT.QueryResponse APT1 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
            ArgusQueryT.QueryResponse APT2 = ArgusQueryT.getMetric(ArgusQueryT.avgAPT, canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
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
                System.out.println(cell + "start query for :" + metricList.get(i));
                ArgusQueryT.QueryResponse res1 = ArgusQueryT.getArgusMetric(metricList.get(i), canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod1);
                ArgusQueryT.QueryResponse res2 = ArgusQueryT.getArgusMetric(metricList.get(i), canary.finalStart, canary.finalEnd, instance, domain, cell, canary.pod2);
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
                }else {
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
                System.out.println(cell + "end query for :" + metricList.get(i));
            }
            record.add("instance:text");
            record.add(instance.replace("aws-","").replace("-","."));//instance
            header.add("instance:text");
            //record.add(domain);//instance
            //header.add("domain:text");


            System.out.println(cell + "start getCanaryDashboardURL");
            record.add("dashboard:url");
            record.add(getCanaryDashboardURL(canary.pod1,canary.pod2,canary.finalStart,canary.finalEnd,instance,domain,cell));
            header.add("dashboard:url");

            System.out.println(cell + "start getMetricDashboardURL");
            record.add("metrics:url");
            record.add(getMetricDashboardURL(canary.pod1,canary.pod2,canary.finalStart,canary.finalEnd,instance,domain,cell));
            header.add("metrics:url");

            String aptURL = getSplunkAPTURL(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1, canary.pod2);
            System.out.println(aptURL);

            VarianceResult varianceZulu = Variance.getVarianceOf("jvmCpuMs", canary.finalStart,canary.finalEnd,instance,domain,cell, canary.pod1);
            VarianceResult varianceZing = Variance.getVarianceOf("jvmCpuMs", canary.finalStart,canary.finalEnd,instance,domain,cell, canary.pod2);

            // fewer column values converted to string for zulu & zing in a single column
            DecimalFormat df = new DecimalFormat("#.###");
            header.add("confidence:text");
            record.add("confidence:text");
            record.add(df.format(varianceZulu.confidence) + " / " + df.format(varianceZing.confidence));
            header.add("variance:text");
            record.add("variance:text");
            record.add(df.format(varianceZulu.variance) + " / " + df.format(varianceZing.variance));
            header.add("timeVariance:text");
            record.add("timeVariance:text");
            record.add(df.format(varianceZulu.timeVariance) + " / " + df.format(varianceZing.timeVariance));

            header.add("spanMin:int");
            record.add("spanMin:int");
            record.add((canary.finalEnd-canary.finalStart)/(60*1000));
            /*
            // the bootstrapped median statistic
            record.add(varianceZulu.median);
            header.add("cpuPerReqZulu:number");
            record.add(varianceZing.median);
            header.add("cpuPerReqZing:number");

             // full variance and confidence
            record.add(varianceZulu.confidence);
            header.add("confidenceZulu:number");
            record.add(varianceZing.confidence);
            header.add("confidenceZing:number");

            record.add(varianceZulu.variance);
            header.add("varianceZulu:number");
            record.add(varianceZing.variance);
            header.add("varianceZing:number");

            record.add(varianceZulu.timeVariance);
            header.add("timeVarianceZulu:number");
            record.add(varianceZing.timeVariance);
            header.add("timeVarianceZing:number");*/

            if(type == 3){
                record.add("start:timestamp");
                record.add(canary.finalStart);
                header.add("start:timestamp");
                record.add("end:timestamp");
                record.add(canary.finalEnd);
                header.add("end:timestamp");
            }else {
                record.add("start:data");
                record.add(canary.finalStart);
                header.add("start:data");
                record.add("end:data");
                record.add(canary.finalEnd);
                header.add("end:data");
            }
            record.add("pod1:data");
            record.add(Utils.toJson(canary.pod1));
            header.add("pod1:data");
            record.add("pod2:data");
            record.add(Utils.toJson(canary.pod2));
            header.add("pod2:data");
            System.out.println("getHeap start");
            Double heap1 = ArgusQueryT.getHeap(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1);
            Double heap2 = ArgusQueryT.getHeap(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod2);
            System.out.println("getHeap end");
            System.out.println("getInstanceTypeTag start");
            String instanceType1 = ArgusQueryT.getInstanceTypeTag(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1);
            String instanceType2 = ArgusQueryT.getInstanceTypeTag(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod2);
            System.out.println("getInstanceTypeTag end");

            System.out.println("getReleaseTag start");
            String release1 = ArgusQueryT.getReleaseTag(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1);
            String release2 = ArgusQueryT.getReleaseTag(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod2);
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


            Double aptc1 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCount,canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1);
            Double aptc2 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCountBelow500,canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1);
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
            aptc1 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCount,canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod2);
            aptc2 = ArgusQueryT.getAPTCount(ArgusQueryT.TotalAPTCountBelow500,canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod2);
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

            String release = cellReleaseMap.getOrDefault(cell,"NA");
            record.add("release:text");
            record.add(release);
            header.add("release:text");

            //splunk APT URL
            //https://splunk-web.log-analytics.monitoring.aws-esvc1-useast2.aws.sfdc.is/en-US/app/publicSharing/zing_falcon_prod_canary_apt?earliest=1749029040&latest=1749040560&form.POD=swe72&form.Baseline=host="swe72-casam-app-green-5659c9d5d9-b6tx6"&form.Canary=host="swe72-casam-app-green-5659c9d5d9-8tzt2"
            //String aptURL = getSplunkAPTURL(canary.finalStart,canary.finalEnd, instance,domain,cell, canary.pod1, canary.pod2);
            record.add("splunkapt:url");

            record.add(aptURL);
            header.add("splunkapt:url");

            return new CanaryResponse(header,record);
        }
        return null;
    }

    public static String getSplunkAPTURL(long finalStart,long finalEnd, String instance,String domain, String cell, List<String> pod1, List<String> pod2){
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
            return "https://splunk-web.log-analytics.monitoring.aws-esvc1-useast2.aws.sfdc.is/en-US/app/publicSharing/zing_falcon_prod_canary_apt?earliest=" + finalStart / 1000 + "&latest=" + finalEnd / 1000 + "&form.POD=" + cell + "&form.Baseline=" + p1 + "&form.Canary=" + p2;

            //return URLEncoder.encode("https://splunk-web.log-analytics.monitoring.aws-esvc1-useast2.aws.sfdc.is/en-US/app/publicSharing/zing_falcon_prod_canary_apt?earliest=" + finalStart / 1000 + "&latest=" + finalEnd / 1000 + "&form.POD=" + cell + "&form.Baseline=" + p1 + "&form.Canary=" + p2, StandardCharsets.UTF_8.toString());
        }catch (Exception e){
            return null;
        }
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

    public static String getMetricDashboardURL(List<String> pod1, List<String> pod2, long curfinalStart, long curfinalEnd, String instance, String
            domain, String cell) {
        String URL1 = "https://monitoring.internal.salesforce.com/argusmvp/#/dashboards/94076428?&span=1m&aggregate=avg&k8s_pod_name=%2A&substrate=aws";
        URL1 = URL1 + "&cell=" + cell;
        URL1 = URL1 + "&instance=" + instance;
        URL1 = URL1 + "&domain=" + domain;
        URL1 = URL1 + "&start=" + curfinalStart;
        URL1 = URL1 + "&end=" + curfinalEnd;
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
        System.out.println(URL1);
        return URL1;
    }

    public static CanaryDetails processCanary(String start, String end, String instance, String domain, String cell) {
        String metric = ArgusQueryT.getGCMetric(start, end, instance, domain, cell);
        CanaryDetails cd = null;
        try {
            cd = parse(metric,cell);
        }catch (OutOfMemoryError e){
            System.out.println( cell + " processCanary OutOfMemoryError");
        }
        return cd;
    }

    public static class CanaryDetails {
        public List<String> podall1;
        public List<String> podall2;
        public List<String> podallseen1;
        public List<String> podallseen2;
        public List<String> pod1;
        public List<String> pod2;
        public int count1;
        public int count2;
        public long finalStart;
        public long finalEnd;

        CanaryDetails() {
            podall1 = new ArrayList<>();
            podall2 = new ArrayList<>();
            podallseen1 = new ArrayList<>();
            podallseen2 = new ArrayList<>();
            pod1 = new ArrayList<>();
            pod2 = new ArrayList<>();
            count1 = 0;
            count2 = 0;
            finalStart = 0L;
            finalEnd = 0L;
        }
    }

    public static CanaryDetails parse(String metric, String cell) {

        CanaryDetails canary = new CanaryDetails();

        List<long[]> zingtimeRanges = new ArrayList<>();
        List<long[]> zulutimeRanges = new ArrayList<>();
        List<long[]> zingtimeRanges1 = new ArrayList<>();
        List<long[]> zulutimeRanges1 = new ArrayList<>();
        int maxKpodLimit = 15;

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
                        type = 1;
                        if ((end - start) > mindiff && canary.count2 < maxKpodLimit) {
                            zingtimeRanges.add(new long[]{start, end});
                            zingtimeRanges1.add(new long[]{start, end});
                            canary.podall2.add(pod);
                            canary.count2++;
                        }
                        canary.podallseen2.add(pod);
                        //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + " zing diff:" + (end - start));
                        start = k;
                    } else if (type != 0 && !(datapoints.getDouble(String.valueOf(k)) != -1 && type == 1)) {
                        type = 0;
                        if ((end - start) > mindiff && canary.count1 < maxKpodLimit) {
                            zulutimeRanges.add(new long[]{start, end});
                            zulutimeRanges1.add(new long[]{start, end});
                            canary.podall1.add(pod);
                            canary.count1++;
                        }
                        canary.podallseen1.add(pod);
                        //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + "zulu diff:" + (end - start));
                        start = k;
                    }
                }
                end = k;
            }
            //System.out.println("type:" + type + " pod:" + pod + " start:" + start + " end:" + end + " diff:" + (end - start));

            if (type == 0) {
                if ((end - start) > mindiff && canary.count2 < maxKpodLimit) {
                    canary.count2++;
                    zingtimeRanges.add(new long[]{start, end});
                    zingtimeRanges1.add(new long[]{start, end});
                    canary.podall2.add(pod);
                }
                canary.podallseen2.add(pod);
            } else {
                if ((end - start) > mindiff && canary.count1 < maxKpodLimit) {
                    zulutimeRanges.add(new long[]{start, end});
                    zulutimeRanges1.add(new long[]{start, end});
                    canary.podall1.add(pod);
                    canary.count1++;
                }
                canary.podallseen1.add(pod);
            }
        }
        System.out.println(cell + " canary.count2:" + canary.count2 + " canary.count1:" + canary.count1);
        Result result = null;
        Result result1 = null;

        while(true) {
            if (canary.count2 > canary.count1) {
                canary.count2 = canary.count1;
            }
            if (canary.count1 > canary.count2) {
                canary.count1 = canary.count2;
            }
            if (canary.count2 == 0 || canary.count1 == 0) {
                System.out.println(cell + "adjusted zingCount:" + canary.count2 + " zuluCount:" + canary.count1);
                return null;
            }

            result = findLargestIntersection(zingtimeRanges, canary.count2);
            HashMap<Integer, Boolean> zingpods = new HashMap<>();
            canary.pod2.clear();
            if (result != null && result.largestIntersection != null) {
                System.out.println(cell + "Largest Intersection zing: Start = " + Utils.convertEpochToUTCString(result.largestIntersection[0]) + ", End = " + Utils.convertEpochToUTCString(result.largestIntersection[1]) + " diff:" + (result.largestIntersection[0] - result.largestIntersection[1]));
                System.out.println(cell + "Combination for largest intersection:" + result.finalCombination.size());
                for (long[] range : result.finalCombination) {
                    for (int k = 0; k < zingtimeRanges1.size(); k++) {
                        if (!zingpods.containsKey(k)) {
                            long[] tmp = zingtimeRanges1.get(k);
                            if (tmp[0] == range[0] && tmp[1] == range[1]) {
                                zingpods.put(k, true);
                                System.out.println(canary.podall2.get(k) + ":" + Arrays.toString(range));
                                //URL = URL + "&var-pod2=" + zingkpods.get(k);
                                canary.pod2.add(canary.podall2.get(k));
                                break;
                            }
                        }
                    }
                }
            } else {
                System.out.println(cell + " No valid intersection found1.");
                canary.count2--;
                continue;
                //return null;
            }

            result1 = findLargestIntersection(zulutimeRanges, canary.count2);
            HashMap<Integer, Boolean> zulupods = new HashMap<>();
            canary.pod1.clear();
            if (result1 != null && result1.largestIntersection != null) {
                System.out.println(cell + "Largest Intersection zulu: Start = " + Utils.convertEpochToUTCString(result1.largestIntersection[0]) + ", End = " + Utils.convertEpochToUTCString(result1.largestIntersection[1]) + " diff:" + (result1.largestIntersection[0] - result1.largestIntersection[1]));
                System.out.println(cell + "Combination for largest intersection:"+ result1.finalCombination.size());
                for (long[] range : result1.finalCombination) {
                    for (int k = 0; k < zulutimeRanges1.size(); k++) {
                        if (!zulupods.containsKey(k)) {
                            long[] tmp = zulutimeRanges1.get(k);
                            if (tmp[0] == range[0] && tmp[1] == range[1]) {
                                zulupods.put(k, true);
                                System.out.println(canary.podall1.get(k) + ":" + Arrays.toString(range));
                                canary.pod1.add(canary.podall1.get(k));
                                break;
                            }
                        }
                    }
                }
                canary.finalStart = result.largestIntersection[0];
                if (result1.largestIntersection[0] > canary.finalStart) {
                    canary.finalStart = result1.largestIntersection[0];
                }

                canary.finalEnd = result.largestIntersection[1];
                if (result1.largestIntersection[1] < canary.finalEnd) {
                    canary.finalEnd = result1.largestIntersection[1];
                }
                long finalDiff = canary.finalEnd - canary.finalStart;
                if(finalDiff < mindiff){
                    canary.count2--;
                    System.out.println(cell + ":"+ finalDiff + " less than " + mindiff + " continue");
                }else {
                    System.out.println(cell + " final zingCount:" + canary.count2 + " zuluCount:" + canary.count1);
                    break;
                }
            } else {
                System.out.println(cell + "No valid intersection found2.");
                canary.count2--;
                //return null;
            }

        }

        long finalDiff = canary.finalEnd - canary.finalStart;
        if(finalDiff < mindiff){
            System.out.println(cell + ": final "+ finalDiff + " less than " + mindiff + " return null");
            return null;
        }

        System.out.println(cell + " start: " + Utils.convertEpochToUTCString(canary.finalStart) + " end: " + Utils.convertEpochToUTCString(canary.finalEnd) + " finalDiff: " + finalDiff);

        //argus time window limit check
        if (maxTimeWindow < (canary.finalEnd - canary.finalStart)) {
            long diff = (canary.finalEnd - canary.finalStart - maxTimeWindow) / 2;
            canary.finalEnd = canary.finalEnd - diff - 1;
            canary.finalStart = canary.finalStart + diff + 1;
            finalDiff = canary.finalEnd - canary.finalStart;
            System.out.println(cell + " adjusted start: " + Utils.convertEpochToUTCString(canary.finalStart) + " end: " + Utils.convertEpochToUTCString(canary.finalEnd) + " finalDiff: " + finalDiff);
        }
        return canary;
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

                if (intersectionStart > intersectionEnd || (intersectionEnd - intersectionStart) < mindiff) {
                    break;  // No intersection in this combination
                }
            }

            // If the intersection is valid, check if it's the largest we've found
            if (intersectionStart <= intersectionEnd && (intersectionEnd - intersectionStart) >= mindiff) {
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

    private static void generateCombinationsHelper(List<long[]> list, int k, int start, List<long[]>
            current, List<List<long[]>> combinations) {
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

    public static class Result {
        long[] largestIntersection;
        List<long[]> finalCombination;

        Result(long[] largestIntersection, List<long[]> finalCombination) {
            this.largestIntersection = largestIntersection;
            this.finalCombination = finalCombination;
        }
    }

    public static void main(String[] args) {
        try {
            int start = 1;
            int end = 1;

            for (int lastndays = end; lastndays <= start; lastndays++) {
                for (String cell : ArgusQueryT.pc.config.keySet()) {
                    if ((boolean) ArgusQueryT.pc.config.get(cell).get("enabled") == true && cell.equals("deu6s")) {
                        System.out.println(((List) ArgusQueryT.pc.config.get(cell).get("peak")).get(0));
                        //long tmp1 = Utils.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.config.get(cell).get("peak")).get(0)));
                        //long tmp2 = Utils.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.config.get(cell).get("peak")).get(1)));

                        long tmp2 = Utils.getUtcEpochForHour((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(0)));//end hour
                        long tmp1 = tmp2 - ((int) (((List) ArgusQueryT.pc.getConfig().get(cell).get("peak")).get(1))) * 60 * 60 * 1000; // tmp2 minus duration hours * 60 * 60 * 1000

                        tmp1 = tmp1 - lastndays * 24 * 60 * 60 * 1000L;
                        tmp2 = tmp2 - lastndays * 24 * 60 * 60 * 1000L;
                        CanaryResponse response = processSideBySideCanary(tmp1, tmp2, cell);
                        String dateString1 = Utils.convertEpochToUTCString(tmp1);
                        String dateString2 = Utils.convertEpochToUTCString(tmp2);
                        System.out.println(dateString1 + ":" + dateString2 + ":" + cell + "--->" + Utils.toJson(response));
                    }
                }
            }
        } catch (Exception e) {
            System.out.println(e.getMessage());
        }
    }


}
