/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package agent;

import com.google.common.base.Stopwatch;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import perfgenie.utils.*;

import java.io.*;
import java.net.InetAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;

@SpringBootApplication
@EnableScheduling
public class AgentApplication {
    private static final org.slf4j.Logger  logger =  LoggerFactory.getLogger(AgentApplication.class);

    private static String tenant = "dev";
    private static String host = "localhost";
    final Config config;

    final EventStore eventStore;
    final CustomJfrParser parser;

    public AgentApplication(EventStore eventStore, CustomJfrParser parser, Config config) {
        this.eventStore = eventStore;
        this.parser = parser;
        this.config = config;
    }

    public static void main(String[] args) {
        SpringApplication.run(AgentApplication.class, args);
    }
    @Scheduled(cron = "*/10 * * ? * *")
    private void cronJob() throws IOException {
        tenant = config.getTenant();
        host = InetAddress.getLocalHost().getHostName();
        logger.info("looking for Jfrs at " + config.getJfrdir());
        File folder = new File(config.getJfrdir());
        File[] listOfFiles = folder.listFiles();

        if (listOfFiles == null)
            return;

        Arrays.sort(listOfFiles, Comparator.comparingLong(File::lastModified));

        for (File file : listOfFiles) {
            if (file.isFile() && file.getName().contains(".jfr") || file.getName().contains(".jfr.gz")) {
                logger.info("processing file: " + file.getName());
                EventHandler handler = new EventHandler();
                long timestamp = System.currentTimeMillis();
                String guid = Utils.generateGuid();
                final Stopwatch timer = Stopwatch.createStarted();
                try {
                    parser.parseStream(handler, file.getPath());
                    handler.processMonitorLog("/tmp/jfrs/monitor.log");
                    Path path = Paths.get("/tmp/jfrs/monitor.log");
                    // deleteIfExists File
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                    final Map<String, Double> dimMap = new HashMap<>();
                    final Map<String, String> queryMap = new HashMap<>();
                    queryMap.put("guid", guid);
                    queryMap.put("source", "genie");
                    queryMap.put("tenant-id", tenant);
                    queryMap.put("instance-id", host);
                    queryMap.put("host", host);
                    queryMap.put("source-file", file.getName());

                    List<String> l = handler.getProfileList();
                    for (int i = 0; i < l.size(); i++) {
                        Object profile = handler.getProfileTree(config.getFilterDepth(),l.get(i),config.isExperimental());
                        queryMap.put("type", "jfrprofile");
                        queryMap.put("name", "jfr");
                        queryMap.put("file-name", l.get(i));//
                        final String payload = Utils.toJson(profile);
                        int payloadSize = payload.length();
                        queryMap.put("size", String.valueOf(payloadSize));
                        System.out.println(payloadSize);
                        eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, payload, config.getTenant(), true);
                    }
                    Object logContext = handler.getLogContext();
                    queryMap.put("file-name", "jfr-context");//
                    queryMap.put("type", "jfrevent");
                    queryMap.put("name", "jfr");

                    eventStore.addGenieLargeEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext), config.getTenant(), true);
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warn("Exception parsing file 3" + file.getPath() + ":" + e.getStackTrace());
                    e.printStackTrace();
                }
                new File(file.getPath()).delete();
                logger.info("successfully parsed " + file.getPath() + " and stored " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            } else if (file.isFile() && file.getName().contains(".jstack")) {
                EventHandler handler = new EventHandler();
                long timestamp = System.currentTimeMillis();
                String guid = Utils.generateGuid();
                final Stopwatch timer = Stopwatch.createStarted();
                try {
                    BufferedReader reader = new BufferedReader(new FileReader(file.getPath()));
                    StringBuilder stringBuilder = new StringBuilder();
                    char[] buffer = new char[10];
                    while (reader.read(buffer) != -1) {
                        stringBuilder.append(new String(buffer));
                        buffer = new char[10];
                    }
                    reader.close();
                    String content = stringBuilder.toString();
                    handler.initializeProfile("Jstack");
                    handler.initializePid("Jstack");
                    handler.processJstackEvent(timestamp * 1000000, content);
                    final Map<String, Double> dimMap = new HashMap<>();
                    final Map<String, String> queryMap = new HashMap<>();
                    queryMap.put("guid", guid);
                    queryMap.put("source", "genie");
                    queryMap.put("tenant-id", tenant);
                    queryMap.put("instance-id", host);
                    queryMap.put("host", host);
                    queryMap.put("source-file", file.getName());
                    queryMap.put("file-name", "json-jstack");
                    Object profile = handler.getProfileTree("Jstack");
                    queryMap.put("type", "json-jstack");
                    queryMap.put("name", "jstack");
                    eventStore.addGenieEvent(timestamp, queryMap, dimMap, Utils.toJson(profile),config.getTenant());
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warn("Exception parsing file 4" + file.getPath() + ":" + e.getStackTrace());
                    e.printStackTrace();
                }
                new File(file.getPath()).delete();
                logger.info("successfully parsed " + file.getPath() + " and stored event " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            }
        }
    }
}
