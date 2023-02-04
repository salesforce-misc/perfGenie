/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package agent;

import com.google.common.base.Stopwatch;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import perfgenie.utils.*;

import java.io.*;
import java.net.InetAddress;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;

@SpringBootApplication
@EnableScheduling
public class AgentApplication {
    private static final Logger logger = Logger.getLogger(AgentApplication.class.getName());
    private static String tenant = "dev";
    private static String host = "localhost";
    final CustomJfrParser.Config config = new CustomJfrParser.Config();

    final EventStore eventStore;
    final CustomJfrParser parser;

    public AgentApplication(EventStore eventStore, CustomJfrParser parser) {
        this.eventStore = eventStore;
        this.parser = parser;
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
        Arrays.sort(listOfFiles, Comparator.comparingLong(File::lastModified));

        if (listOfFiles == null)
            return;

        for (File file : listOfFiles) {

            logger.info("processing file: " + file.getName());

            if (file.isFile() && file.getName().contains(".jfr") || file.getName().contains(".jfr.gz")) {
                EventHandler handler = new EventHandler();
                long timestamp = System.currentTimeMillis();
                String guid = Utils.generateGuid();
                final Stopwatch timer = Stopwatch.createStarted();
                try {
                    parser.parseStream(handler, file.getPath());
                    final Map<String, Double> dimMap = new HashMap<>();
                    final Map<String, String> queryMap = new HashMap<>();
                    queryMap.put("guid", guid);
                    queryMap.put("tenant", tenant);
                    queryMap.put("host", host);
                    queryMap.put("file-name", file.getName());

                    List<String> l = handler.getProfileList();
                    for (int i = 0; i < l.size(); i++) {
                        Object profile = handler.getProfileTree(l.get(i));
                        queryMap.put("type", "jfrprofile");
                        queryMap.put("name", l.get(i));
                        final String payload = Utils.toJson(profile);
                        int payloadSize = payload.length();
                        queryMap.put("size", String.valueOf(payloadSize));
                        eventStore.addEvent(timestamp, queryMap, dimMap, payload);
                    }
                    Object logContext = handler.getLogContext();
                    queryMap.put("type", "jfrevent");
                    queryMap.put("name", "customEvent");

                    eventStore.addEvent(timestamp, queryMap, dimMap, Utils.toJson(logContext));
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warning("Exception parsing file " + file.getPath() + ":" + e.getStackTrace());
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
                    queryMap.put("tenant", tenant);
                    queryMap.put("host", host);
                    queryMap.put("file-name", file.getName());
                    Object profile = handler.getProfileTree("Jstack");
                    queryMap.put("type", "jstack");
                    queryMap.put("name", "Jstack");
                    eventStore.addEvent(timestamp, queryMap, dimMap, Utils.toJson(profile));
                } catch (Exception e) {
                    System.out.println(e);
                    logger.warning("Exception parsing file " + file.getPath() + ":" + e.getStackTrace());
                }
                new File(file.getPath()).delete();
                logger.info("successfully parsed " + file.getPath() + " and stored event " + "time ms: " + timer.stop().elapsed(TimeUnit.MILLISECONDS));
            }
        }
    }
}
