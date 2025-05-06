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
import java.time.*;
import java.util.*;

import static java.awt.Color.blue;
import static perfgenie.utils.ArgusQueries.*;

public class Canary {
    public static HashMap<String, String> podsInstance = new HashMap<>();
    public static HashMap<String, Integer[]> podsList = new HashMap<>();
    public static HashMap<String, String> podsDomain = new HashMap<>();
    public static String URL1 = "";
    static String startupQueryZing = "";
    static String startupQueryZulu = "";
    static String curargusMetricQuery = "";
    public static long curfinalStart = 0;
    public static long curfinalend = 0;
    public static long maxTimeWindow = 4 * 60 * 60 * 1000; // 5 hours due to argus query limitations, need to switch to huron

    static {
        podsInstance.put("ind86", "aws-prod2-apsouth1");//min 18, max 50
        podsInstance.put("usa270s", "aws-prod5-uswest2");//min 14, max 50
        podsInstance.put("usa710s", "aws-prod21-useast2");//min 8, max 40
        podsInstance.put("usa30s", "aws-prod5-uswest2");//min 8, max 40
        podsInstance.put("usa432s", "aws-prod5-uswest2");//min 10, max 40
        podsInstance.put("usa762s", "aws-prod21-useast2");//min 8, max 40
        podsInstance.put("usa14s", "aws-prod0-uswest2");//min 8, max 40
        podsInstance.put("ind56", "aws-prod2-apsouth1");//min 8, max 40
        podsInstance.put("usa726", "aws-prod21-useast2");//
        podsInstance.put("usa854", "aws-prod21-useast2");//
        podsInstance.put("usa62s", "aws-prod5-uswest2");//
        podsInstance.put("usa224s", "aws-prod5-uswest2");//

        podsInstance.put("ind10s", "aws-prod2-apsouth1");//
        podsList.put("ind10s", new Integer[]{4, 12});
        podsDomain.put("ind10s", "core1");

        podsInstance.put("usa20s", "aws-prod5-uswest2");//
        podsList.put("usa20s", new Integer[]{12, 20});
        podsDomain.put("usa20s", "core1");

        podsInstance.put("ind8s", "aws-prod2-apsouth1");//
        podsList.put("ind8s", new Integer[]{4, 12});
        podsDomain.put("ind8s", "core1");

        podsInstance.put("usa770s", "aws-prod21-useast2");//
        podsList.put("usa770s", new Integer[]{12, 20});
        podsDomain.put("usa770s", "core1");

        podsInstance.put("che2s", "aws-prod15-eucentral2");//
        podsList.put("che2s", new Integer[]{7, 14});
        podsDomain.put("che2s", "core1");

        podsInstance.put("usa660s", "aws-prod5-uswest2");//
        podsList.put("usa60s", new Integer[]{5, 13});
        podsDomain.put("usa60s", "core1");

        podsInstance.put("deu6s", "aws-prod3-eucentral1");//
        podsList.put("deu6s", new Integer[]{7, 13});
        podsDomain.put("deu6s", "core1");

        podsInstance.put("usa250s", "aws-prod1-useast1");//
        podsList.put("usa250s", new Integer[]{9, 17});
        podsDomain.put("usa250s", "core1");

        podsInstance.put("ind64", "aws-prod2-apsouth1");//
        podsList.put("ind64", new Integer[]{4, 10});
        podsDomain.put("ind64", "core1");

        podsInstance.put("ind90", "aws-prod2-apsouth1");//
        podsList.put("ind90", new Integer[]{8, 14});
        podsDomain.put("ind90", "core1");

        podsInstance.put("usa34", "aws-prod5-uswest2");//
        podsList.put("usa34", new Integer[]{13, 19});
        podsDomain.put("usa34", "core1");

        podsInstance.put("ind58", "aws-prod2-apsouth1");//
        podsList.put("ind58", new Integer[]{9, 13});
        podsDomain.put("ind58", "core1");

        podsInstance.put("usa290", "aws-prod5-uswest2");//
        podsList.put("usa290", new Integer[]{13, 19});
        podsDomain.put("usa290", "core1");

        podsInstance.put("usa286", "aws-prod5-uswest2");//
        podsList.put("usa286", new Integer[]{13, 19});
        podsDomain.put("usa286", "core1");

        podsInstance.put("usa476", "aws-prod5-uswest2");//
        podsList.put("usa476", new Integer[]{13, 19});
        podsDomain.put("usa476", "core1");

        podsInstance.put("usa430", "aws-prod5-uswest2");//
        podsList.put("usa430", new Integer[]{13, 19});
        podsDomain.put("usa430", "core1");

        podsInstance.put("usa442", "aws-prod5-uswest2");//
        podsList.put("usa442", new Integer[]{13, 19});
        podsDomain.put("usa442", "core1");


        podsList.put("ind86", new Integer[]{4, 12});
        podsList.put("usa270s", new Integer[]{15, 20});
        podsList.put("usa710s", new Integer[]{15, 21});
        podsList.put("usa62s", new Integer[]{15, 21});
        podsList.put("usa762s", new Integer[]{16, 21});
        podsList.put("usa30s", new Integer[]{12, 20});
        podsList.put("usa224s", new Integer[]{12, 20});
        podsList.put("usa432s", new Integer[]{8, 14});
        podsList.put("usa14s", new Integer[]{5, 11});


        //podsInstance.put("sdb2", "dev1-uswest2");
        podsDomain.put("ind86", "core1");
        podsDomain.put("usa270s", "core1");
        podsDomain.put("usa710s", "core1");
        podsDomain.put("usa762s", "core1");
        podsDomain.put("usa30s", "core1");
        podsDomain.put("usa432s", "core1");
        podsDomain.put("usa14s", "core1");
        podsDomain.put("ind56", "core1");
        podsDomain.put("usa726", "core1");
        podsDomain.put("usa854", "core1");
        podsDomain.put("usa62s", "core1");
        podsDomain.put("usa224s", "core1");
        //podsDomain.put("sdb2", "core002");




        //podsList.put("usa726", new Integer[]{14, 22});
        //podsList.put("usa854", new Integer[]{14, 22});
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



    public static KpodsResponse getReleaseKpodRanges(String startquery1, String endquery1, String startquery2, String endquery2, String instance, String
            domain, String cell) {
        String metric1 = getRequestCountKpodMetric1(startquery1, endquery1, instance, domain, cell);
        String metric2 = getRequestCountKpodMetric2(startquery2, endquery2, instance, domain, cell);

        if (metric1 != null && metric2 != null) {
            List<long[]> ranges1 = new ArrayList<>();
            List<long[]> ranges2 = new ArrayList<>();
            try {
                JSONObject jsonObject = new JSONObject(metric1);
                JSONArray jsonArray = jsonObject.getJSONArray("array");
                for (int i = 0; i < jsonArray.length(); i++) {
                    JSONObject object = jsonArray.getJSONObject(i);
                    JSONObject datapoints = object.getJSONObject("datapoints");
                    String kpodname = object.getJSONObject("tags").get("k8s_pod_name").toString();
                    Iterator keys = datapoints.keys();
                    long max = Long.parseLong(startquery1);
                    long min = Long.parseLong(endquery1);
                    while (keys.hasNext()) {
                        long timestamp = Long.parseLong(keys.next().toString());
                        if (timestamp < min) {
                            min = timestamp;
                        }
                        if (timestamp > max) {
                            max = timestamp;
                        }
                    }
                    if (max - min > 0) {
                        ranges1.add(new long[]{min, max});
                    }
                }
                List<long[]> overlappingRanges = TimeRangeOverlap.findOverlappingRanges(ranges1, 50);
                int count = overlappingRanges.size();
                if (count != 0) {
                    long start1 = overlappingRanges.get(0)[0];
                    long end1 = overlappingRanges.get(0)[1];
                    long start2 = overlappingRanges.get(0)[0] - 7 * 24 * 60 * 60 * 1000;
                    long end2 = overlappingRanges.get(0)[1] - 7 * 24 * 60 * 60 * 1000;
                    List<String> pods2 = new ArrayList<>();
                    List<String> pods1 = new ArrayList<>();
                    System.out.println(overlappingRanges.size());
                    JSONObject jsonObject1 = new JSONObject(metric2);
                    JSONArray jsonArray1 = jsonObject1.getJSONArray("array");
                    for (int i = 0; i < jsonArray1.length(); i++) {
                        JSONObject object = jsonArray1.getJSONObject(i);
                        JSONObject datapoints = object.getJSONObject("datapoints");
                        String kpodname = object.getJSONObject("tags").get("k8s_pod_name").toString();
                        Iterator keys = datapoints.keys();
                        long max = start2;
                        long min = end2;
                        while (keys.hasNext()) {
                            long timestamp = Long.parseLong(keys.next().toString());
                            if (timestamp < min) {
                                min = timestamp;
                            }
                            if (timestamp > max) {
                                max = timestamp;
                            }
                        }
                        if (max - min > 0) {
                            if (min <= start2 && max >= end2 && ranges2.size() < count) {
                                ranges2.add(new long[]{min, max});
                                pods2.add(kpodname);
                            }
                        }
                    }
                    count = pods2.size();
                    if (count != 0) {//get pods1 list
                        JSONObject jsonObject2 = new JSONObject(metric1);
                        JSONArray jsonArray2 = jsonObject.getJSONArray("array");
                        for (int i = 0; i < jsonArray2.length(); i++) {
                            JSONObject object = jsonArray2.getJSONObject(i);
                            JSONObject datapoints = object.getJSONObject("datapoints");
                            String kpodname = object.getJSONObject("tags").get("k8s_pod_name").toString();
                            Iterator keys = datapoints.keys();
                            long max = start1;
                            long min = end1;
                            while (keys.hasNext()) {
                                long timestamp = Long.parseLong(keys.next().toString());
                                if (timestamp < min) {
                                    min = timestamp;
                                }
                                if (timestamp > max) {
                                    max = timestamp;
                                }
                            }
                            if (max - min > 0) {
                                if (min <= start1 && max >= end1 && pods1.size() < count) {
                                    pods1.add(kpodname);
                                }
                            }
                        }
                    }
                    System.out.println(cell + " " + pods1.size() + ":" + pods2.size());
                    if (pods1.size() != 0 && pods2.size() != 0) {
                        return new KpodsResponse(start1, end1, start2, end2, pods1, pods2);
                    }
                }
            } catch (Exception e) {
                System.out.println(cell + " getReleaseKpodRanges " + e.getMessage());
                return null;
            }
        }
        return null;
    }

    public static class KpodsResponse {
        long start1;
        long end1;
        long start2;
        long end2;
        List<String> pods1;
        List<String> pods2;

        public KpodsResponse(long start1, long end1, long start2, long end2, List<String> pods1, List<String> pods2) {
            this.start1 = start1;
            this.end1 = end1;
            this.start2 = start2;
            this.end2 = end2;
            this.pods1 = pods1;
            this.pods2 = pods2;
        }
    }

    public static List<Object> processCellCanary(long tmp1, long tmp2, String key) {
        if (inUse) {//basic check
            return new ArrayList<>();
        }
        inUse = true;
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

            boolean res = processZingCanary(String.valueOf(tmp1), String.valueOf(tmp2), podsInstance.get(key), podsDomain.get(key), key);
            if (res) {
                String URL = getCanaryDashboardURL(pod1, pod2, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(tmp2);//epoch
                record.add(1);//tid
                System.out.println(key + " CELL:" + key);
                record.add(key);
                String APT = getMetric(APTQueryT, pod1, pod2, String.valueOf(curfinalStart), String.valueOf(curfinalend), String.valueOf(curfinalStart), String.valueOf(curfinalend), podsInstance.get(key), podsDomain.get(key), key);
                String aptQ = curargusMetricQuery;
                System.out.println(key + " APT:" + APT);
                record.add(Double.parseDouble(APT));
                String JVMCpu = getMetric(JVMCpuQueryT, pod1, pod2, String.valueOf(curfinalStart), String.valueOf(curfinalend), String.valueOf(curfinalStart), String.valueOf(curfinalend), podsInstance.get(key), podsDomain.get(key), key);
                String JVMCpuQ = curargusMetricQuery;
                System.out.println(key + " JVMCpu:" + JVMCpu);
                record.add(Double.parseDouble(JVMCpu));
                String containerCpu = getMetric(containerCpuQueryT, pod1, pod2, String.valueOf(curfinalStart), String.valueOf(curfinalend), String.valueOf(curfinalStart), String.valueOf(curfinalend), podsInstance.get(key), podsDomain.get(key), key);
                String containerCpuQ = curargusMetricQuery;
                System.out.println(key + " containerCpu:" + containerCpu);
                record.add(Double.parseDouble(containerCpu));
                System.out.println(key + " URL:" + URL);
                record.add(URL);
                record.add(zingCount);
                record.add(zuluCount);

                URL1 = getMetricDashboardURL(pod1, pod2, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(URL1);//metric URL

                startupQueryZing = getStartupQueryURL(podall2, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                System.out.println(startupQueryZing);
                Double t1 = getStatupAVG(startupQueryZing);

                startupQueryZulu = getStartupQueryURL(podall1, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                System.out.println(startupQueryZulu);
                Double t2 = getStatupAVG(startupQueryZulu);

                System.out.println(startupQueryZing);
                if (!(t2 == 0.0 || t1 == 0.0)) {
                    record.add(100 * (t2 - t1) / t2);//for startup
                } else {
                    record.add(-10000.0);//for startup
                }
                System.out.println(key + " startup:" + t1 + ":" + t2);
                record.add(aptQ);//aptQ
                record.add(JVMCpuQ);//JVMCpuQ
                record.add(containerCpuQ);//containerCpuQ
                //startupQueryZing = getStartupQueryURL(podall2, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(startupQueryZing);//startupQueryZing
                //startupQueryZulu = getStartupQueryURL(podall1, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key);
                record.add(startupQueryZulu);//startupQueryZulu

                try {
                    ArgusQueryT.QueryResponse reqCount1 = ArgusQueryT.getMetric(ArgusQueryT.totalRequestsLogMetric_COUNT, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod1);
                    ArgusQueryT.QueryResponse reqCount2 = ArgusQueryT.getMetric(ArgusQueryT.totalRequestsLogMetric_COUNT, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod2);

                    ArgusQueryT.QueryResponse totalReqCPUSec1 = ArgusQueryT.getMetric(ArgusQueryT.requestCPUSecondsTotalDiff, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod1);
                    ArgusQueryT.QueryResponse totalReqCPUSec2 = ArgusQueryT.getMetric(ArgusQueryT.requestCPUSecondsTotalDiff, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod2);

                    Double totalReqCPUSec1perReqPerKpod = totalReqCPUSec1.getMetric() / (reqCount1.getMetric() * pod1.size());
                    Double totalReqCPUSec2perReqPerKpod = totalReqCPUSec2.getMetric() / (reqCount2.getMetric() * pod2.size());

                    Double totalRequestCPUSecperReqPercentChange = 100.0 * (totalReqCPUSec1perReqPerKpod - totalReqCPUSec2perReqPerKpod) / totalReqCPUSec1perReqPerKpod;

                    record.add(totalRequestCPUSecperReqPercentChange);//totalRequestCPUSecperReqPercentChange

                    ArgusQueryT.QueryResponse total5xx4xxCount1 = ArgusQueryT.getMetric(ArgusQueryT.total5xx4xxCount, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod1);
                    ArgusQueryT.QueryResponse total5xx4xxCount2 = ArgusQueryT.getMetric(ArgusQueryT.total5xx4xxCount, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod2);

                    Double total5xx4xxCount1perKpod = total5xx4xxCount1.getMetric() / pod1.size();
                    Double total5xx4xxCount2perKpod = total5xx4xxCount2.getMetric() / pod2.size();

                    Double total5xx4xxCountperKpodPercentChange = 100.0 * (total5xx4xxCount1perKpod - total5xx4xxCount2perKpod) / total5xx4xxCount1perKpod;

                    //record.add(total5xx4xxCount1perKpod);//total5xx4xxCount1perKpod
                    //record.add(total5xx4xxCount2perKpod);//total5xx4xxCount2perKpod
                    record.add(total5xx4xxCountperKpodPercentChange);//total5xx4xxCountperKpodPercentChange

                    record.add(podsInstance.get(key));//instance
                    record.add(podsDomain.get(key));//domain
                    //JcpuT
                    ArgusQueryT.QueryResponse totalJCPUMs1 = ArgusQueryT.getMetric(ArgusQueryT.jvmCPUMsTotalDiff, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod1);
                    ArgusQueryT.QueryResponse totalJCPUMs2 = ArgusQueryT.getMetric(ArgusQueryT.jvmCPUMsTotalDiff, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod2);
                    Double totalJCPUMs1perReqPerKpod = totalJCPUMs1.getMetric() / (reqCount1.getMetric() * pod1.size());
                    Double totalJCPUMs2perReqPerKpod = totalJCPUMs2.getMetric() / (reqCount2.getMetric() * pod2.size());
                    Double totalJCPUMsperReqPercentChange = 100.0 * (totalJCPUMs1perReqPerKpod - totalJCPUMs2perReqPerKpod) / totalJCPUMs1perReqPerKpod;
                    record.add(totalJCPUMsperReqPercentChange);
                    //CcpuT
                    ArgusQueryT.QueryResponse totalCCPUSec1 = ArgusQueryT.getMetric(ArgusQueryT.containerCPUUsageSecondsTotalDiff, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod1);
                    ArgusQueryT.QueryResponse totalCCPUSec2 = ArgusQueryT.getMetric(ArgusQueryT.containerCPUUsageSecondsTotalDiff, curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod2);
                    Double totalCCPUSec1perReqPerKpod = totalCCPUSec1.getMetric() / (reqCount1.getMetric() * pod1.size());
                    Double totalCCPUSec2perReqPerKpod = totalCCPUSec2.getMetric() / (reqCount2.getMetric() * pod2.size());
                    Double totalCCPUSecperReqPercentChange = 100.0 * (totalCCPUSec1perReqPerKpod - totalCCPUSec2perReqPerKpod) / totalCCPUSec1perReqPerKpod;
                    record.add(totalCCPUSecperReqPercentChange);

                    record.add(reqCount1.getMetric());
                    record.add(reqCount2.getMetric());
                    record.add(totalJCPUMs1.getMetric());
                    record.add(totalJCPUMs2.getMetric());
                    record.add(totalCCPUSec1.getMetric());
                    record.add(totalCCPUSec2.getMetric());

                } catch (Exception e) {
                    System.out.println("--------> skip 4xx 5xx" + e.getMessage());
                }

                //VarianceResult varianceZulu = Variance.getVarianceOf("jvmCpuMs", curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod1);
                //VarianceResult varianceZing = Variance.getVarianceOf("jvmCpuMs", curfinalStart, curfinalend, podsInstance.get(key), podsDomain.get(key), key, pod2);
                //record.add(varianceZulu.variance);
                //record.add(varianceZing.variance);
            }
        } catch (Exception e) {
            System.out.println(key + " getCanaryResults Exception:" + e.getMessage());
            inUse = false;
            return new ArrayList<>();
        }
        inUse = false;
        return record;
    }

    public static Double getStatupAVG(String query) {
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
        } else {
            try {
                //String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("startup.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
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
            return sum / count;
        } catch (Exception e) {
            System.out.println("getStatupAVG Exception " + e.getMessage() + ":" + metric);
            return 0.0;
        }
    }

    public static String getMetric(String Query, List<String> pod1, List<String> pod2, String startquery1, String endquery1, String startquery2, String endquery2, String instance, String
            domain, String cell) {
        if (pod1.size() == 0 || pod2.size() == 0) {
            return null;
        }
        String query = Query.replaceAll("START1", startquery1);
        query = query.replaceAll("START2", startquery2);
        query = query.replaceAll("END1", endquery1);
        query = query.replaceAll("END2", endquery2);
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
        curargusMetricQuery = query;
        //System.out.println(curargusMetricQuery);
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
                //String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    metric = "{\"array\":" + Resources.toString(Resources.getResource("apt.json"), StandardCharsets.UTF_8) + "}";
                }
            } catch (Exception e) {
                metric = "{}";
                System.out.println(cell + " getMetric2 " + e.getMessage());
            }
        }
        if (cell.equals("ind86")) {
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
            System.out.println(cell + " getMetric3 " + e.getMessage() + "\n" + curargusMetricQuery + "\n" + metric);
            return null;
        }
        return metric;
    }

    public static String accessToken = "";

    public static boolean updateAccessToken() {
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

    public static String getGCMetric(String startquery, String endquery, String instance, String domain, String
            cell) {
        try {
            if (accessToken != null) {
                String query = GCQueryT.replaceFirst("START1", startquery);
                query = query.replaceAll("END1", endquery);
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
                        String metric = "{\"array\":" + Resources.toString(Resources.getResource("gc.json"), StandardCharsets.UTF_8) + "}";
                        return metric;
                    }
                }
                return null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    public static String getRequestCountMetric(String startquery, String endquery, String instance, String
            domain, String cell) {
        try {
            if (accessToken != null) {
                String query = requestCountQueryT.replaceFirst("START1", startquery);
                query = query.replaceAll("END1", endquery);
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
                    String metric = Resources.toString(Resources.getResource("requests.json"), StandardCharsets.UTF_8);
                    return metric;
                }
                return null;
            }
        } catch (Exception e) {
            System.out.println(cell + " getRequestCountMetric " + e.getMessage());
            return null;
        }
    }

    public static String getRequestCountKpodMetric1(String startquery, String endquery, String instance, String
            domain, String cell) {
        try {
            if (accessToken != null) {
                String query = requestCountKpodsQueryT.replaceFirst("START1", startquery);
                query = query.replaceAll("END1", endquery);
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
                        String metric = "{\"array\":" + Resources.toString(Resources.getResource("requestkpods1.json"), StandardCharsets.UTF_8) + "}";
                        return metric;
                    }
                }
                return null;
            }
        } catch (Exception e) {
            System.out.println(cell + " getRequestCountKpodMetric1 " + e.getMessage());
            return null;
        }
    }

    public static String getRequestCountKpodMetric2(String startquery, String endquery, String instance, String
            domain, String cell) {
        try {
            if (accessToken != null) {
                String query = requestCountKpodsQueryT.replaceFirst("START1", startquery);
                query = query.replaceAll("END1", endquery);
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
                        String metric = "{\"array\":" + Resources.toString(Resources.getResource("requestkpods2.json"), StandardCharsets.UTF_8) + "}";
                        return metric;
                    }
                }
                return null;
            }
        } catch (Exception e) {
            System.out.println(cell + " getRequestCountKpodMetric2 " + e.getMessage());
            return null;
        }
    }

    public static boolean processZingCanary(String startquery, String endquery, String instance, String domain, String cell) {
        try {
            updateAccessToken();
            String metric = getGCMetric(startquery, endquery, instance, domain, cell);
            if (metric != null) {
                if (parse(metric, instance, domain, cell)) {
                    //return getCanaryDashboardURL(pod1, pod2, curfinalStart, curfinalend, instance, domain, cell);
                    return true;
                } else {
                    return false;
                }

            } else {
                return false;
            }
        } catch (Exception e) {
            System.out.println(cell + " processZingCanary " + e.getMessage());
        }
        return false;
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

        //if (cell.equals("ind86")) {
        //System.out.println(metric);
        //}

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
        System.out.println(cell + " zingCount:" + zingCount + " zuluCount:" + zuluCount);

        Result result = null;
        Result result1 = null;

        while(true) {
            if (zingCount > zuluCount) {
                zingCount = zuluCount;
            }
            if (zingCount == 0 || zuluCount == 0) {
                System.out.println(cell + " adjusted zingCount:" + zingCount + " zuluCount:" + zuluCount);
                return false;
            }
            System.out.println(cell + " adjusted zingCount:" + zingCount + " zuluCount:" + zuluCount);
            result = findLargestIntersection(zingtimeRanges, zingCount);
            HashMap<Integer, Boolean> zingpods = new HashMap<>();
            pod2.clear();
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
                System.out.println(" No valid intersection found1.");
                return false;
            }

            result1 = findLargestIntersection(zulutimeRanges, zingCount);
            HashMap<Integer, Boolean> zulupods = new HashMap<>();
            pod1.clear();
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
                }
                System.out.println(cell + " final zingCount:" + zingCount + " zuluCount:" + zuluCount);
                break;
            } else {
                System.out.println("No valid intersection found2.");
                zingCount--;
                //return false;
            }
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
        System.out.println(cell + " start: " + finalStart + " end: " + finalEnd + " finalDiff: " + finalDiff);
        //argus time window limit check
        if (maxTimeWindow < (curfinalend - curfinalStart)) {
            long diff = (curfinalend - curfinalStart - maxTimeWindow) / 2;
            curfinalend = curfinalend - diff - 1;
            curfinalStart = curfinalStart + diff + 1;
            System.out.println(cell + " adjusted start: " + finalStart + " end: " + finalEnd + " finalDiff: " + finalDiff);
        }


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

        startupQueryZing = startupQueryT.replaceAll("START1", String.valueOf(finalStart - 7 * 24 * 60 * 60 * 1000));//previous 2 days startups
        startupQueryZing = startupQueryZing.replaceAll("END1", String.valueOf(finalStart));
        startupQueryZing = startupQueryZing.replaceAll("INSTANCE", instance);
        startupQueryZing = startupQueryZing.replaceAll("DOMAIN", domain);
        startupQueryZing = startupQueryZing.replaceAll("CELL", cell);
        startupQueryZing = startupQueryZing.replaceAll("POD", pods);
        System.out.println(startupQueryZing);

        getStartupQueryURL(pod1, curfinalStart, curfinalend, instance, domain, cell);
*/
        //return URL;
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

    public static String getStartupQueryURL(List<String> podlist, long curfinalStart, long curfinalEnd, String
            instance, String domain, String cell) {
        String query = startupQueryT.replaceAll("START1", String.valueOf(curfinalStart - 7 * 24 * 60 * 60 * 1000));//previous 7 days startups
        query = query.replaceAll("END1", String.valueOf(curfinalEnd));
        query = query.replaceAll("INSTANCE", instance);
        query = query.replaceAll("DOMAIN", domain);
        query = query.replaceAll("CELL", cell);
        String pods = "";
        for (int i = 0; i < podlist.size(); i++) {
            if (i == 0) {
                pods = podlist.get(i);
            } else {
                pods = pods + "|" + podlist.get(i);
            }
        }
        query = query.replaceAll("POD", pods);
        System.out.println(query);
        return query;
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
}

//curl -vX POST "https://monitoring-api.salesforce.com/monexws/auth/1.0/token" --capath /etc/identity/client/certificates/ --cert /etc/identity/client/certificates/client.pem --key /etc/identity/client/keys/client-key.pem
//curl -H "Authorization: Bearer eyJ2ZXJzaW9uIjoiMC4xMS4xIiwiYWxnIjoiUlMyNTYifQ.eyJpc3MiOiJtb25leC5hcmd1cy5tb25pdG9yaW5nLmF3cy1lc3ZjMS11c2Vhc3QyLmF3cy5zZmRjLmNsIiwiaWF0IjoxNzQxMjk1OTk3LCJuYmYiOjE3NDEyOTU5OTcsImV4cCI6MTc0MTMzOTE5NywiYXVkIjoiTW9uQ2xvdWQiLCJzdWIiOiJjb3JlLW9uLXNhbS5kYXBwIiwiZW1haWwiOiIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJjb3JlLW9uLXNhbS5kYXBwIiwidHlwZSI6IkFDQ0VTUyIsInVzZXJncm91cCI6Ilt7XCJ1c2VyRGVmYXVsdEdyb3VwR3VpZFwiOlwiXCIsXCJncm91cEd1aWRcIjpcImIwZjY1NzE1LWFjYWMtNDhhYS1hNzVhLWZlNGVhN2YxZDZhM1wifV0ifQ.ACCzMFK_qU1ROzypi8CCFqjM6Vc8Xwu4ZMUMgm44K2shLc-i2AnrysrL7zIiKTK9r07qFu6N_Z_ZW7lHQ-xFvXYSbPLKoMk1SH4NIwVqLi5r0Asb8WEIFw1J9j_rggIPD7GJi79nG6MgqEKdBXRbJj5NIO8pElwFPThaqCi_CHwqNQN_xqvAwhtUcleOTSA4AqVsq_diA2_O82uqqjkyYKoI4lMpvfKJXDk90g6Pxr8sNa0Twpi-KLpIf9aKdMEobMr2jyprwV5SNg6cReuqDPdBZYvPE7px1CXRKU52emlfMhNSfSU3bTzFa0_zzNCIWExBjouSgC1h9y2B6CnKJA" https://monitoring-api.salesforce.com/argusws/metrics?expression=1741145400000%3A1741146300000%3Acore.aws.aws-prod2-apsouth1.core1%3AJvm.CodeCacheMaxMb.Value%7Bcell%3Dind86%7D%3Aavg