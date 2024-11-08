/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package perfgenie.utils;

import com.google.common.base.Stopwatch;
import com.google.common.collect.ImmutableMap;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.Events;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import com.salesforce.cantor.h2.CantorOnH2;
import com.salesforce.cantor.mysql.CantorOnMysql;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class EventStore {
    private final static Logger logger = LoggerFactory.getLogger(EventStore.class);
    //public static final String NAMESPACE_JFR_JSON_CACHE = "jfr-json-cache";
    //public static final String NAMESPACE_EVENT_LARGE_FILE = "event-large-file";
    public static final String NAMESPACE_EVENT_META = "event-meta-data";
    public static final int LARGE_FILE_SIZE = 1024 * 1024;
    public static boolean enableLargeFile = true;
    private final Cantor cantor;
    final Config config;
    public static HashMap<String, String> tenantsCache = new HashMap<>();
    public static Long tenantsCacheTime = System.currentTimeMillis();

    private static Lock cacheLock = new ReentrantLock();

    final CommandExecutor executor = CommandExecutor.getInstance();

    public EventStore(final Config config) throws IOException {
        this.config = config;
        if (config.getStorageType().equals("mySQL")) {
            this.cantor = new CantorOnMysql(config.getMySQL_host(), config.getMySQL_port(), config.getMySQL_user(), config.getMySQL_pwd());
        } else if (config.getStorageType().equals("grpc")) {
            this.cantor = new CantorOnGrpc(config.getGrpc_target());
        } else {
            this.cantor = new CantorOnH2(config.getH2dir());//default
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getEventNameSpace(config.getTenant(), true),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getEventNameSpace(config.getTenant(), true));
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), true),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), true));
        }
        try {
            this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(NAMESPACE_EVENT_META);
        }
    }

    public EventStore(final Cantor cantor, final Config config) throws IOException {
        this.cantor = cantor;
        this.config = config;
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getEventNameSpace(config.getTenant(), true),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getEventNameSpace(config.getTenant(), true));
        }
        try {
            this.cantor.events().get(
                    PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), true),
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(PerfGenieConstants.getLargeEventNameSpace(config.getTenant(), true));
        }
        try {
            this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    0L,
                    0L);
        } catch (Exception e) {
            this.cantor.events().create(NAMESPACE_EVENT_META);
        }
    }

    public boolean addGenieEventMetaData(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        if(queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
            this.cantor.events().store(
                    NAMESPACE_EVENT_META,
                    timestamp,
                    queryMap,
                    dimMap,
                    null);
            logger.info("addGenieEventMetaData successfully added event metadata under namespace: " + NAMESPACE_EVENT_META + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        }else{
            logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
            return false;
        }
        return true;
    }

    private boolean addOtherEventMetaData(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String namespace) throws IOException { //TODO merge this with addGenieEventMetaData
        final Stopwatch timer = Stopwatch.createStarted();
        if(queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
            this.cantor.events().store(
                    namespace,
                    timestamp,
                    queryMap,
                    dimMap,
                    null);
            logger.info("addGenieEventMetaData successfully added event metadata under namespace: " + namespace + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        }else{
            logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
            return false;
        }
        return true;
    }

    public boolean addGenieEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        if(payload != null) {
            queryMap.put("size", String.valueOf(payload.length()));
        }
        try {
            if (queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
                addGenieEventMetaData(timestamp, queryMap, dimMap, config.getTenant());

                this.cantor.events().store(
                        PerfGenieConstants.getEventNameSpace(tenant, true),
                        timestamp,
                        queryMap,
                        dimMap,
                        payload != null ? Utils.compress(payload.getBytes(StandardCharsets.UTF_8)) : null);
                logger.info("addEvent successfully stored even in database under namespace: " + PerfGenieConstants.getEventNameSpace(tenant, true) + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            } else {
                logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
                return false;
            }
        }catch(Exception e){
            logger.error("Failed to add event " + PerfGenieConstants.getEventNameSpace(tenant, true) + " " + queryMap.toString());
            return false;
        }
        return true;
    }

    public void addGenieLargeEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload, final String tenant, final boolean isGenie) throws IOException {
        queryMap.put("size", String.valueOf(payload.length()));
        if(isGenie){
            addGenieEventMetaData(timestamp, queryMap, dimMap,config.getTenant());//metadata event
        }else{
            addOtherEventMetaData(timestamp, queryMap, dimMap,PerfGenieConstants.getEventNameSpace(tenant, isGenie));//metadata event
        }
        upload(timestamp, queryMap, dimMap, payload, PerfGenieConstants.getLargeEventNameSpace(tenant, isGenie));
    }

    public void addGenieLargeEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final byte[] payload, final String tenant, final boolean isGenie) throws IOException {
        queryMap.put("size", String.valueOf(payload.length));
        if(isGenie){
            addGenieEventMetaData(timestamp, queryMap, dimMap,config.getTenant());//metadata event
        }else{
            addOtherEventMetaData(timestamp, queryMap, dimMap,PerfGenieConstants.getEventNameSpace(tenant, isGenie));//metadata event
        }
        uploadBytes(timestamp, queryMap, dimMap, payload, PerfGenieConstants.getLargeEventNameSpace(tenant, isGenie));
    }

    public String getGenieTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final List<String> namespaces) throws IOException {
        try {
            Long currTime = System.currentTimeMillis();
            if (tenantsCache.size() == 0 || (currTime - tenantsCacheTime) > 5 * 60 * 1000) {
                currTime = System.currentTimeMillis();
                cacheLock.lock();
                logger.warn("acquired lock at" + currTime);
                if (tenantsCache.size() == 0 || (currTime - tenantsCacheTime) > 5 * 60 * 1000) {
                    logger.warn("Updating tenantCache at " + currTime);
                    tenantsCache.clear();
                    final Collection<String> tenantst;
                    tenantst = this.cantor.objects().keys("tenants", 0, 20000);
                    for (String tenant : tenantst) {
                        tenantsCache.put(tenant, "other");
                    }
                    tenantsCacheTime = System.currentTimeMillis();
                } else {
                    logger.warn("updated at " + tenantsCacheTime);
                }
                cacheLock.unlock();
            }
        }catch(Exception e){
            cacheLock.unlock();
            logger.warn("getTenants cantor tenants namespace does not exist");
        }

        namespaces.add(NAMESPACE_EVENT_META);//1715561760005
        for (final String namespace : namespaces) {
            final List<Events.Event> results = this.cantor.events().get(
                    NAMESPACE_EVENT_META,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() > 0) {
                for (final Events.Event result : results) {
                    if(result.getMetadata().containsKey("tenant-id")){
                        tenantsCache.put(result.getMetadata().get("tenant-id"),"genie");
                    }
                }
            }
        }
        return Utils.toJson(tenantsCache);
    }

    public String getGenieInstances(final String tenant, long start, long end, final Map<String, String> queryMap) throws IOException{

        HashMap<String, String> instances = new HashMap();
        if (tenant != null) {
            if(queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)){
                try {
                    final List<Events.Event> results = this.cantor.events().get(
                            NAMESPACE_EVENT_META,
                            start,
                            end,
                            Collections.emptyMap(),
                            Collections.emptyMap()
                    );

                    if (results.size() > 0) {
                        for (final Events.Event result : results) {
                            if(result.getMetadata().containsKey("host")){
                                instances.put(result.getMetadata().get("host"),"genie");
                            }
                        }
                    }
                } catch (final IOException exception) {
                    logger.warn("exception while getting instances from " + PerfGenieConstants.getLargeEventNameSpace(tenant, true));
                }
            }else{
                try {
                    final Collection<String> instances1 = this.cantor.events().metadata(
                            String.format("maiev-heartbeat-%s", tenant),
                            "instance-id",
                            start,
                            end,
                            Collections.emptyMap(),
                            Collections.emptyMap());
                    for (String s : instances1) {
                        instances.put(s, "other");
                    }
                } catch (final IOException exception) {
                    logger.warn("exception while getting instances from namespace" + String.format("maiev-heartbeat-%s", tenant));
                }
            }
        }
        return  Utils.toJson(instances);
    }

    public String getGenieMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String tenant, final String instance) throws IOException {
        if (tenant != null && instance != null) {
            String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? NAMESPACE_EVENT_META : PerfGenieConstants.getEventNameSpace(tenant, false);
            queryMap.put("tenant-id", tenant);
            queryMap.put("instance-id", instance);
            final List<Events.Event> results = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    queryMap,
                    dimMap,
                    false
            );
            if (results.size() != 0) {
                logger.info("getMeta successfully fetched metadata from namespace: " + namespace);
                return Utils.toJson(results);
            }
        }
        return "";
    }

    public static boolean waitForFile(final String filePath, long timeout) throws IOException, InterruptedException {
        long maxWaitSec = timeout*60*1000;
        long checkInterval = 1000; // 1 second
        long startTime = System.currentTimeMillis();
        File file = new File(filePath);
        while (System.currentTimeMillis() - startTime < maxWaitSec) {
            if (file.exists()) {
                return true;
            }
            try {
                Thread.sleep(checkInterval);
            } catch (InterruptedException e) {
                System.err.println("Thread was interrupted.");
            }
        }
        return false;
    }
    
    private void addGenieLargeEventFromFile(final long timestamp, final Map<String, String> queryMap, final String tenant, final String file) throws IOException{
        final String uploaded = config.getJfrdir() + "/" + file.replaceAll(".json" ,".done");
        File check = new File(uploaded);
        if (check.exists()) {
            logger.info("Upload tried once : " + uploaded);
            return;
        }

        final Map<String, Double> dimMap = new HashMap<>();
        final Map<String, String> queryMapTmp = new HashMap<>();

        final String filePath = config.getJfrdir() + "/" + file;
        final byte[] payload = Utils.compress(Files.readAllBytes(Paths.get(filePath)));
        dimMap.put("file-length", (double) payload.length);
        queryMapTmp.put("host", queryMap.get("host").replaceAll("^=", ""));
        queryMapTmp.put("instance-id", queryMap.get("host").replaceAll("^=", ""));
        queryMapTmp.put("guid", queryMap.get("guid").replaceAll("^=", "") + file.replaceAll("^\\d+", "") + ".gz");
        queryMapTmp.put("tenant-id", queryMap.get("tenant-id").replaceAll("^=", ""));
        queryMapTmp.put("name", "jfr");
        queryMapTmp.put("file-name", file.replaceAll("^\\d+", "") + ".gz");
        queryMapTmp.put(".is-large-file", "true");

        logger.info("Uploading parsed event: " + file + ":" + queryMapTmp + ":" + dimMap);
        //add an upload flag
        check.createNewFile();
        addGenieLargeEvent(timestamp, queryMapTmp, dimMap, payload, tenant, false); //TODO use correct destination

        /*
        Uploading parsed event: 1730959240745jfr_dump_socket.json:
        {
        instance-id=sdb34-casam-app-green-b5f79dcd4-t4hjt,
        host=sdb34-casam-app-green-b5f79dcd4-t4hjt,
        name=jfr, guid=434adba3-e7ca-4af7-99aa-a47415379968jfr_dump_socket.json.gz,
        file-name=jfr_dump_socket.json.gz,
        tenant-id=falcon-perf1-useast2-core1-sdb34,
        .is-large-file=true
        }
        {file-length=284165.0}
//needed
{
  "timestampMillis": 1730994142867,
  "metadata": {
    "instance-id": "ind64-casam-app-blue-59d597f9cd-l8lrq",
    "host": "ind64-casam-app-blue-59d597f9cd-l8lrq",
    "name": "jfr",
    "guid": "94f5fdff-8af6-4741-94d3-9f95bfc82aa0jfr_dump.json.gz",
    "file-name": "jfr_dump.json.gz",
    "tenant-id": "falcon-aws-prod2-apsouth1-core1-ind64",
    ".is-large-file": "true",
  },
  "dimensions": {
    ".maiev-event-payload-size": 0,
    "file-length": 7830098,
    "chunk-total": 1
  },
  "payload": ""
}
         */
    }

    public String getGenieLargeEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String tenant) throws IOException {

        String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true) : PerfGenieConstants.getLargeEventNameSpace(tenant, false);
        final Stopwatch timer = Stopwatch.createStarted();
        try {
            if(queryMap.containsKey("file-name") && queryMap.get("file-name").contains(".jfr.gz")){
                final String filepath = config.getJfrdir() +"/"+ Long.toString(start);
                queryMap.put("guid",queryMap.get("guid").replace(queryMap.get("file-name").replace("=",""), ""));
                if(downloadToFile(start, end, queryMap, dimMap, namespace,filepath+".tmp")){
                    File f = new File(filepath+"jfr_dump.json");
                    if(!f.exists()) {
                        executor.addCommand("java -Xloggc:"+config.getJfrdir()+"/jfrparsergc.log -XX:ErrorFile="+config.getJfrdir()+"/jfrparser_error.log -XX:ParallelGCThreads=8 -XX:+PrintGCDetails -XX:NewSize=400m -XX:MaxNewSize=400m -Xms7G -Xmx7G  -cp "+config.getJfrparser()+" Parser -c -jfr " + filepath + ".tmp  -timeout 90000 -timestamp " + start*1000000 + " -json " + filepath + "jfr_dump.json");
                    }
                    if(waitForFile(filepath+"jfr_dump.json", 2)){
                        logger.info("successfully parsed jfr: " + queryMap + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                        final HashMap<String, String> profiles = new HashMap();
                        Thread.sleep(5000);//let parser create all files
                        File folder = new File(config.getJfrdir());
                        File[] listOfFiles = folder.listFiles();
                        if(listOfFiles != null) {
                            for (File file : listOfFiles) {
                                if(file.getName().contains(Long.toString(start))){
                                    String tmpfileName = file.getName();
                                    if(!(tmpfileName.contains("_sql.json") || tmpfileName.contains(".tmp"))) {
                                        if(tmpfileName.contains(".json")) {
                                            tmpfileName = tmpfileName.replace(Long.toString(start), "");
                                            profiles.put(tmpfileName+".gz", Long.toString(start) + " - " + queryMap.get("guid").replaceAll("^=", ""));
                                            addGenieLargeEventFromFile(start, queryMap, tenant, file.getName());
                                        }
                                    }
                                }
                            }
                            return Utils.toJson(profiles);
                        }else {
                            return Utils.toJson(new EventHandler.JfrParserResponse(null, "parsed json not found", queryMap, null));
                        }
                    }else{
                        return Utils.toJson(new EventHandler.JfrParserResponse(null, "Failed to parse jfr", queryMap, null));
                    }
                }else {
                    return Utils.toJson(new EventHandler.JfrParserResponse(null, "Failed to download jfr", queryMap, null));
                }
            }else{
                String res = download(start, end, queryMap, dimMap, namespace);
                logger.info("successfully fetched event from namespace: " + namespace + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
                return res;
            }
        }catch(Exception e){
            return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Event not found", queryMap, null));
        }
    }

    public String getGenieEvent(final long start, final long end, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String tenant) throws IOException {

        final Stopwatch timer = Stopwatch.createStarted();
        String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true) : PerfGenieConstants.getEventNameSpace(tenant, false);
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start - 1,
                end + 1,
                queryMap,
                dimMap,
                true
        );
        if (results.size() > 0) {
            String res = new String(Utils.decompress(results.get(0).getPayload()));
            logger.info("successfully fetched event from namespace: " + namespace + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            return res;
        } else {
            logger.warn("failed to fetch event from namespace: " + namespace + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
        }
        return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Event not found", queryMap, null));
    }

    //done
    /*public boolean addEvent(final long timestamp, final Map<String, String> queryMap, final Map<String, Double> dimMap, final String payload, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        queryMap.put("size", String.valueOf(payload.length()));

        if (enableLargeFile && payload.length() > LARGE_FILE_SIZE) {
            addMeta(timestamp, dimMap, queryMap,tenant);
            upload(timestamp, queryMap, dimMap, payload, PerfGenieConstants.getLargeEventNameSpace(tenant, true));
        } else {
            if(queryMap.containsKey(PerfGenieConstants.TENANT_KEY)) {
                this.cantor.events().store(
                        PerfGenieConstants.getEventNameSpace(tenant,true),
                        timestamp,
                        queryMap,
                        dimMap,
                        Utils.compress(payload.getBytes(StandardCharsets.UTF_8)));
                logger.info("addEvent successfully stored even in database under namespace: " + PerfGenieConstants.getEventNameSpace(tenant,true) + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            }else{
                logger.error("addEvent missing value of " + PerfGenieConstants.TENANT_KEY);
                return false;
            }
        }
        return true;
    }*/

    //done
   /* public boolean addMeta(final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException {
        final Stopwatch timer = Stopwatch.createStarted();
        String namespace = PerfGenieConstants.getEventNameSpace(tenant, true);
        this.cantor.events().store(
                namespace,
                timestamp,
                queryMap,
                dimMap,
                null);
        logger.info("addMeta successfully stored metadata in database under namespace: " + namespace + " time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));

        return true;
    }*/

    public List getGeniePayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true) : PerfGenieConstants.getEventNameSpace(tenant, false);
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            List<String> payloads = new ArrayList<>();
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                payloads.add(new String(Utils.decompress(result.getPayload())));
            }
            return payloads;
        }
        return null;
    }

    public Map getOtherPayLoads(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getEventNameSpace(tenant, true) : PerfGenieConstants.getEventNameSpace(tenant, false);
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        if (results.size() > 0) {
            Map<Long,String> payloads = new HashMap<>();//timestamp payload map
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                payloads.put(result.getTimestampMillis(),new String(Utils.decompress(result.getPayload())));
            }
            return payloads;
        }
        return null;
    }

    public Collection<com.salesforce.cantor.Events.Event> getHeartbeatEvents(final String tenant, final String instanceId, final long startTimestamp, final long endTimestamp) {
        try {
            return this.cantor.events().get(
                    String.format("maiev-heartbeat-%s", tenant),
                    startTimestamp,
                    endTimestamp,
                    ImmutableMap.of("instance-id", instanceId),
                    Collections.emptyMap());
        } catch (final IOException exception) {
            logger.warn("exception while getting heartbeat events: tenant={} instance={} start={} end={}",
                    tenant, instanceId, startTimestamp, endTimestamp, exception);
            throw new RuntimeException(String.format("Error retrieving events from database for: tenant=%s instance=%s", tenant, instanceId), exception);
        }
    }
    public Map<Long,Map<String, String>> loadGenieProfiles(final String tenant, final long start, final long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final boolean payload) throws IOException {
        String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true) : PerfGenieConstants.getLargeEventNameSpace(tenant, false);
        final List<Events.Event> results = this.cantor.events().get(
                namespace,
                start,
                end,
                queryMap,
                dimMap,
                payload
        );
        Map<Long, Map<String, String>> profiles = new HashMap<>();
        if (results.size() > 0) {
            results.sort(Comparator.comparing(Events.Event::getTimestampMillis));
            for (final Events.Event result : results) {
                profiles.put(result.getTimestampMillis(), result.getMetadata());

            }
            //return profiles;
        }

        if(!queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)){//for sfdc check full jfrs too
            //try to look for full jfrs, sfdc fix
            final Map<String, String> tmpqueryMap = new HashMap<>();
            tmpqueryMap.put("host",queryMap.get("host"));
            tmpqueryMap.put("tenant-id",queryMap.get("tenant-id"));
            tmpqueryMap.put("file-name","=jfr_dump_toparse.jfr.gz");

            final List<Events.Event> results1 = this.cantor.events().get(
                    namespace,
                    start,
                    end,
                    tmpqueryMap,
                    dimMap,
                    payload
            );
            if (results1.size() > 0) {
                //Map<Long, Map<String, String>> profiles = new HashMap<>();
                results1.sort(Comparator.comparing(Events.Event::getTimestampMillis));
                final HashMap<Long, Boolean> check = new HashMap<>();
                for (final Events.Event result : results1) {
                    if(!check.containsKey(result.getTimestampMillis())) {
                        final Map<String, String> meta = new HashMap<>();
                        meta.put("host",queryMap.get("host").replace("=",""));
                        meta.put("tenant-id",queryMap.get("tenant-id").replace("=",""));
                        meta.put("file-name",queryMap.get("file-name").replace("=",""));
                        meta.put("guid",result.getMetadata().get("guid") + queryMap.get("file-name").replace("=",""));
                        profiles.put(result.getTimestampMillis(), meta);
                        check.put(result.getTimestampMillis(), true);
                    }
                }
            }
        }
        if(profiles.size() > 0){
            return profiles;
        }

        return null;
    }

    private void uploadBytes(final long timestamp, final Map<String, String> metadata,
                        final Map<String, Double> dimensions, final byte[] bytes, final String namespace) throws IOException {
        logger.info("Started uploading bytes {} to {}", metadata, namespace);
        final UploadIterator iterator = new UploadIterator(metadata, dimensions, bytes);
        this.cantor.events().store(namespace, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(namespace, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading bytes to {} {} as {} cantor events", namespace, metadata, dimensions.get("chunk-total").longValue());
    }

    //Done
    private void upload(final long timestamp, final Map<String, String> metadata,
                        final Map<String, Double> dimensions, final String rawPayload, final String namespace) throws IOException {
        logger.info("Started uploading {} to {}", metadata, namespace);
        final UploadIterator iterator = new UploadIterator(metadata, dimensions, rawPayload);
        this.cantor.events().store(namespace, timestamp, iterator.metadata, iterator.dimension);
        while (iterator.hasNext()) {
            final Events.Event event = iterator.next();
            this.cantor.events().store(namespace, timestamp, event.getMetadata(), event.getDimensions(), event.getPayload());
        }
        logger.info("Completed uploading to {} {} as {} cantor events", namespace, metadata, dimensions.get("chunk-total").longValue());
    }

    public synchronized InputStream eventStream(final long timestamp, final Map<String,
            String> queryMap, final Map<String, String> dimMap, final String tenant) throws IOException {

        String namespace = queryMap.containsKey(PerfGenieConstants.SOURCE_KEY) ? PerfGenieConstants.getLargeEventNameSpace(tenant, true) : PerfGenieConstants.getLargeEventNameSpace(tenant, false);
        final Stopwatch timer = Stopwatch.createStarted();
        try {
            final DownloadIterator iterator = new DownloadIterator(namespace, timestamp, timestamp, queryMap, dimMap);
            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            while (iterator.hasNext()) {
                final Events.Event event = iterator.next();
                outStream.write(event.getPayload());
                outStream.flush();
            }
            logger.info("Completed downloading {}", queryMap);
            if (queryMap.containsKey(PerfGenieConstants.SOURCE_KEY)) {//genie
                return new ByteArrayInputStream(outStream.toByteArray());
            } else {
                return new ByteArrayInputStream(Utils.decompress(outStream.toByteArray()));
            }
        } catch (IOException e) {
            logger.error("Failed to download from {}  {}", namespace, queryMap);
            e.printStackTrace();
            throw e;
        }
    }

    public final Map<String, Boolean> downloadRequests = new ConcurrentHashMap<String,Boolean>();
    private synchronized boolean downloadToFile(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery, final String namespace, final String filepath) throws IOException {

        String req = metadataQuery.toString() + Long.toString(startTimestamp);

        File file = new File(filepath);

        if(file.exists()){
            logger.info("already download req  {}", metadataQuery);
            return true;
        }else if(downloadRequests.containsKey(req)){
            logger.info("duplicate  download req  {}", metadataQuery);
            return true;
        }

        downloadRequests.put(req,true);

        logger.info("Started downloading  {}", metadataQuery);
        if(namespace != null){
            try {
                final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                Path path = Paths.get(filepath);
                while (iterator.hasNext()) {
                    final Events.Event event = iterator.next();
                    outStream.write(event.getPayload());
                    outStream.flush();
                }
                logger.info("Completed downloading {}", metadataQuery);
                if(metadataQuery.containsKey(PerfGenieConstants.SOURCE_KEY)) {//genie
                    Files.write(path, outStream.toByteArray());
                    downloadRequests.remove(req);
                    return true;
                }else{
                    Files.write(path, Utils.decompress(outStream.toByteArray()));
                    downloadRequests.remove(req);
                    return true;
                }
            }catch(Exception e){
                logger.error("Failed to download from {}  {}", namespace, metadataQuery);
                e.printStackTrace();
                downloadRequests.remove(req);
                return false;
            }
        }
        downloadRequests.remove(req);
        return false;
    }



    private String download(final long startTimestamp, final long endTimestamp, final Map<String,
            String> metadataQuery, final Map<String, String> dimensionsQuery, final String namespace) throws IOException {

        if(metadataQuery.containsKey("file-name")){
             String filepath = config.getJfrdir() +"/"+ Long.toString(startTimestamp) + metadataQuery.get("file-name");
             filepath = filepath.replace("=","");
             filepath = filepath.replace(".gz","");
             File f = new File(filepath);
             if(f.exists()){
                 logger.info("using local downloaded  {}", metadataQuery);
                  return new String(Files.readAllBytes(Paths.get(filepath)));
             }
        }
        logger.info("Started downloading  {}", metadataQuery);
        if(namespace != null){
            try {
                final DownloadIterator iterator = new DownloadIterator(namespace, startTimestamp, endTimestamp, metadataQuery, dimensionsQuery);
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                while (iterator.hasNext()) {
                    final Events.Event event = iterator.next();
                    outStream.write(event.getPayload());
                    outStream.flush();
                }
                logger.info("Completed downloading {}", metadataQuery);
                if(metadataQuery.containsKey(PerfGenieConstants.SOURCE_KEY)) {//genie
                    return new String(Utils.decompress(outStream.toByteArray()));
                }else{
                    //return new String(Utils.decompress(outStream.toByteArray()));
                    return new String(Utils.decompress(Utils.decompress(outStream.toByteArray())));
                }
            }catch(Exception e){
                logger.error("Failed to download from {}  {}", namespace, metadataQuery);
                e.printStackTrace();
                return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to download 1 ", metadataQuery, null));
            }
        }
        return Utils.toJson(new EventHandler.JfrParserResponse(null, "Error: Failed to download 2 ", metadataQuery, null));
    }

    private static class UploadIterator implements Iterator<Events.Event> {
        public static final int MAX_CHUNK_SIZE = 4 * 1024 * 1024; // 4MB
        final Map<String, String> metadata;
        final Map<String, Double> dimension;
        private final byte[] payload;
        private final int fileLength;
        private final int totalChunkCount;

        private int chunkIndex;
        private int start;
        private int end;
        private byte[] currentChunk;
        UploadIterator(final Map<String, String> metadata, final Map<String, Double> dimension, final byte[] bytes) throws IOException {
            this.metadata = metadata;
            this.dimension = dimension;

            payload = Utils.compress(bytes);
            fileLength = payload.length;
            totalChunkCount = (fileLength / MAX_CHUNK_SIZE) + (fileLength % MAX_CHUNK_SIZE != 0 ? 1 : 0);
            dimension.put("file-length", (double) fileLength);
            dimension.put("chunk-total", (double) totalChunkCount);

            chunkIndex = 0;
            start = 0;
            end = MAX_CHUNK_SIZE - 1;
            currentChunk = new byte[MAX_CHUNK_SIZE];

            if (fileLength < MAX_CHUNK_SIZE) {
                end = this.fileLength - 1;
                currentChunk = new byte[Long.valueOf(fileLength).intValue()];
            }
        }

        UploadIterator(final Map<String, String> metadata, final Map<String, Double> dimension, final String rawPayload) throws IOException {
            this.metadata = metadata;
            this.dimension = dimension;

            payload = Utils.compress(rawPayload.getBytes(StandardCharsets.UTF_8));
            fileLength = payload.length;
            totalChunkCount = (fileLength / MAX_CHUNK_SIZE) + (fileLength % MAX_CHUNK_SIZE != 0 ? 1 : 0);
            dimension.put("file-length", (double) fileLength);
            dimension.put("chunk-total", (double) totalChunkCount);

            chunkIndex = 0;
            start = 0;
            end = MAX_CHUNK_SIZE - 1;
            currentChunk = new byte[MAX_CHUNK_SIZE];

            if (fileLength < MAX_CHUNK_SIZE) {
                end = this.fileLength - 1;
                currentChunk = new byte[Long.valueOf(fileLength).intValue()];
            }
        }

        @Override
        public boolean hasNext() {
            return chunkIndex < totalChunkCount;
        }

        @Override
        public Events.Event next() {
            if (!hasNext()) throw new IllegalArgumentException("No more chunk to iterate");

            currentChunk = Arrays.copyOfRange(payload, start, end + 1);
            final Events.Event event = createChunkEvent();
            start = end + 1;
            chunkIndex++;
            if (end + MAX_CHUNK_SIZE > fileLength - 1) {
                end = fileLength - 1;
                currentChunk = new byte[Long.valueOf(end - start + 1).intValue()];
            } else {
                end = end + MAX_CHUNK_SIZE;
                currentChunk = new byte[MAX_CHUNK_SIZE];
            }
            return event;
        }

        Events.Event createChunkEvent() {
            final Map<String, Double> dimensions = new HashMap<>(this.dimension);
            final Map<String, String> metadata = new HashMap<>(this.metadata);
            dimensions.put("start", (double) start);
            dimensions.put("end", (double) end);
            dimensions.put("chunk-index", (double) chunkIndex);
            return new Events.Event(0, metadata, dimensions, currentChunk);
        }
    }

    private class DownloadIterator implements Iterator<Events.Event> {

        private final String namespace;
        private final long startTimestamp;
        private final long endTimestamp;
        private final Map<String, String> metadataQuery;
        private final Map<String, String> dimensionQuery;

        private long totalCount = 1;
        private long processedCount = 0;
        private boolean retry = true;

        DownloadIterator(final String namespace, final long startTimestamp, final long endTimestamp,
                         final Map<String, String> metadataQuery, final Map<String, String> dimensionQuery) {
            this.namespace = namespace;
            this.startTimestamp = startTimestamp;
            this.endTimestamp = endTimestamp;
            this.metadataQuery = metadataQuery;
            this.dimensionQuery = dimensionQuery;
        }

        @Override
        public boolean hasNext() {
            return processedCount < totalCount;
        }

        @Override
        public Events.Event next() {
            try {
                if (!hasNext()) {
                    throw new IllegalArgumentException("No more events to iterate.");
                }
                final Map<String, String> currentDimensionQuery = new HashMap<>(dimensionQuery);
                currentDimensionQuery.put("chunk-index", Double.toString(this.processedCount));
                final List<Events.Event> result = cantor.events().get(
                        this.namespace,
                        this.startTimestamp,
                        this.endTimestamp,
                        metadataQuery,
                        currentDimensionQuery,
                        true
                );

                if (result.size() < 1) {
                    throw new IllegalArgumentException("Should have exactly one event per query but found: " + result.size());
                }

                final Events.Event event = result.get(0);
                if (this.processedCount == 0) {
                    this.totalCount = event.getDimensions().get("chunk-total").longValue();
                }
                processedCount++;
                retry = true;
                return event;
            } catch (final IOException e) {
                logger.warn("exception caught getting event for payload download: ", e);
                if (retry) {
                    logger.info("retrying event pull once...");
                    retry = false;
                    return next();
                }
            } catch (final NullPointerException e) {
                logger.warn("event is missing one or more required fields: ", e);
            }

            throw new IllegalArgumentException(String.format("failed to load the file with: namespace=%s " +
                            "timestamp=%d-%d current-count=%d total-count=%d", this.namespace, this.startTimestamp,
                    this.endTimestamp, this.processedCount, this.totalCount));
        }
    }
}
