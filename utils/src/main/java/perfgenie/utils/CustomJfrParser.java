/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package perfgenie.utils;

import com.google.common.base.Stopwatch;
import org.openjdk.jmc.common.IMCStackTrace;
import org.openjdk.jmc.common.IMCThread;
import org.openjdk.jmc.common.IMCType;
import org.openjdk.jmc.common.item.*;
import org.openjdk.jmc.common.unit.IQuantity;
import org.openjdk.jmc.common.unit.ITypedQuantity;
import org.openjdk.jmc.common.unit.IUnit;
import org.openjdk.jmc.common.unit.LinearUnit;
import org.openjdk.jmc.flightrecorder.CouldNotLoadRecordingException;
import org.openjdk.jmc.flightrecorder.JfrLoaderToolkit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import java.util.concurrent.*;

import static com.google.common.base.Preconditions.checkNotNull;
import static org.openjdk.jmc.flightrecorder.JfrAttributes.EVENT_STACKTRACE;

/**
 * This class is used for parsing JFR Method samples and to generate Json format
 * it uses JMC toolkit to traverse JFR content.
 */

public class CustomJfrParser {
    private static final Logger logger = LoggerFactory.getLogger(CustomJfrParser.class);
    // only parse 2 jfr concurrently + 10 max in the queue
    private final ExecutorService executor;
    private double threshold = 0.005;
    long duration = 600000000000L; //include samples of duration 10min starting epoch
    final Config config = new Config();

    public CustomJfrParser(final int maxParallelAllowed) {
        executor = new ThreadPoolExecutor(
                1, maxParallelAllowed,
                300L, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(10),
                new ThreadPoolExecutor.AbortPolicy()
        );
    }

    public void setThreshold(final double threshold) {
        this.threshold = threshold;
    }

    public void setDuration(final long duration) {
        this.duration = duration;
    }

    public EventHandler parseStream(final EventHandler builder, final ByteArrayInputStream stream) throws IOException {
        try {
            builder.setThreshold(config.getThreshold());
            builder.setMaxStackDepth(config.getMaxStackDepth());
            return executor.submit(() -> doParseStream(builder, stream)).get();
        } catch (RejectedExecutionException e) {
            logger.warn("JFR parser is busy please try after some time");
            throw new IOException("JFR parser is busy please try after some time");
        } catch (InterruptedException | ExecutionException e) {
            throw new IOException(e);
        }
    }

    public EventHandler parseStream(final EventHandler builder, final String path) throws IOException {
        try {
            builder.setThreshold(config.getThreshold());
            builder.setMaxStackDepth(config.getMaxStackDepth());
            return executor.submit(() -> doParseStream(builder, path)).get();
        } catch (RejectedExecutionException e) {
            logger.warn("JFR parser is busy please try after some time");
            throw new IOException("JFR parser is busy please try after some time");
        } catch (InterruptedException | ExecutionException e) {
            throw new IOException(e);
        }
    }

    public EventHandler doParseStream(final EventHandler handler, final String path) throws IOException {
        checkNotNull(handler, "null/empty builder argumet");
        checkNotNull(path, "null/empty path argumet");
        try {
            final Stopwatch timer = Stopwatch.createStarted();
            IItemCollection events = JfrLoaderToolkit.loadEvents(new File(path));
            processJfrEvents(handler, events);
            logger.info("doParseStream parse time sec: {}", timer.stop().elapsed(TimeUnit.SECONDS));
            return handler;
        } catch (CouldNotLoadRecordingException e) {
            throw new RuntimeException(e);
        }
    }

    public EventHandler doParseStream(final EventHandler handler, final ByteArrayInputStream stream) throws IOException {
        checkNotNull(handler, "null/empty builder argumet");
        checkNotNull(stream, "null/empty stream argumet");

        try {
            final Stopwatch timer = Stopwatch.createStarted();
            IItemCollection events = JfrLoaderToolkit.loadEvents(stream);
            processJfrEvents(handler, events);
            logger.info("doParseStream parse time sec: {}", timer.stop().elapsed(TimeUnit.SECONDS));
            return handler;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    void processJfrEvents(final EventHandler handler, final IItemCollection events){
        final StringBuilder sb = new StringBuilder();
        final Map<String, List> header = new HashMap<>();
        final Map<String, Integer> unique = new HashMap<>();
        boolean errorOnce = true;
        for (IItemIterable iterable_element : events) {
            if (config.isProfile(iterable_element.getType().getIdentifier())) {
                //Object[] r = iterable_element.get().toArray();
                Map k = iterable_element.getType().getAccessorKeys();
                int tid = -1;
                long epoc = -1;
                int weight = 1;
                boolean memoryEvent = false;
                String classStr = null;
                handler.initializeProfile(iterable_element.getType().getIdentifier());
                handler.initializePid(iterable_element.getType().getIdentifier());
                System.out.println("profile:" + iterable_element.getType().getIdentifier());
                final IMemberAccessor<IMCStackTrace, IItem> accessor = iterable_element.getType()
                        .getAccessor(EVENT_STACKTRACE.getKey());
                for (final IItem item : iterable_element) {
                    final IMCStackTrace stackTrace = accessor.getMember(item);
                    for (Object key : k.keySet()) {
                        if(((Attribute) key).getName().equals("Allocation Size")){
                            ITypedQuantity<LinearUnit> v = (ITypedQuantity<LinearUnit>) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(item);
                            weight = (int)v.longValue();
                            memoryEvent = true;
                        }
                        if (((Attribute) key).getContentType().getIdentifier().equals("class")) {
                            classStr=((IMCType)iterable_element.getType().getAccessor((IAccessorKey) key).getMember(item)).getTypeName();
                        }
                        if (((Attribute) key).getContentType().getIdentifier().equals("thread")) {
                            final IMCThread thread = (IMCThread) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(item);
                            if(thread != null){
                                tid = thread.getThreadId().intValue();
                                if(tid == 0){//zing hack
                                    if(!thread.getThreadName().contains("GC")) {
                                        tid = thread.getThreadName().hashCode();
                                        if (tid > 0) {
                                            tid = 0 - tid; // set it to negitive to avoid clashing with other tids
                                        }
                                    }else{
                                        tid = -100;
                                    }
                                }
                            }else{
                                if(errorOnce) {
                                    errorOnce=false;
                                    logger.warn("null pointer, mall formed thread " + item.toString());
                                }
                            }

                        } else if (((Attribute) key).getContentType().getIdentifier().equals("timestamp")) {
                            ITypedQuantity<LinearUnit> v = (ITypedQuantity<LinearUnit>) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(item);
                            epoc = v.longValue();
                        }
                    }

                    try {
                        if(stackTrace != null) {
                            if(memoryEvent){//experiment to reduce size
                                handler.processMemoryEvent(sb, stackTrace, iterable_element.getType().getIdentifier(), tid, epoc, weight, classStr);
                            }else {
                                handler.processEvent(sb, stackTrace, iterable_element.getType().getIdentifier(), tid, epoc, weight, classStr);
                            }
                        }
                    }catch (Exception e){
                        throw e;
                    }
                }
            } else if (config.isCustomEvent(iterable_element.getType().getIdentifier())) {
                System.out.println("event:" + iterable_element.getType().getIdentifier());
                List l = iterable_element.getType().getAttributes();
                Map k = iterable_element.getType().getAccessorKeys();
                Object[] r = iterable_element.get().toArray();
                boolean addHeader = false;
                if (!header.containsKey(iterable_element.getType().getIdentifier())) {
                    header.put(iterable_element.getType().getIdentifier(), new ArrayList<String>());
                    addHeader = true;
                }

                for (int i = 0; i < r.length; i++) {
                    IUnit u = null;
                    List<Object> record = new ArrayList<>();
                    int tid = -1;
                    boolean textFound = false;
                    for (Object key : k.keySet()) {
                        if (((Attribute) key).getContentType().getIdentifier().equals("thread")) {
                            final IMCThread thread = (IMCThread) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(r[i]);
                            if(thread != null) {
                                tid = thread.getThreadId().intValue();
                                if (tid == 0) {//zing hack
                                    tid = thread.getThreadName().hashCode();
                                    if (tid > 0) {
                                        tid = 0 - tid; // set it to negitive to avoid clashing with other tids
                                    }
                                }
                            }else{
                                if(errorOnce) {
                                    errorOnce=false;
                                    logger.warn("null pointer, mall formed thread " + key.toString());
                                }
                            }
                            record.add(tid);
                            if(thread != null) {
                                record.add(thread.getThreadName());
                            }else{
                                record.add("null");
                            }
                            textFound=true;
                            if (addHeader) {
                                header.get(iterable_element.getType().getIdentifier()).add("tid:text");
                                header.get(iterable_element.getType().getIdentifier()).add("threadname:text");
                            }
                        } else if (((Attribute) key).getContentType().getIdentifier().equals("timestamp")) {
                            ITypedQuantity<LinearUnit> v = (ITypedQuantity<LinearUnit>) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(r[i]);
                            u = v.getUnit();
                            record.add(Math.round(v.longValue() / 1000000d));
                            if (addHeader) {
                                header.get(iterable_element.getType().getIdentifier()).add("timestamp:timestamp");
                            }
                        } else if (((Attribute) key).getContentType().getIdentifier().equals("timespan")) {
                            ITypedQuantity<LinearUnit> v = (ITypedQuantity<LinearUnit>) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(r[i]);
                            record.add((long) Math.round(v.getUnit().valueTransformTo(u.getDeltaUnit()).getMultiplier() * v.longValue() / 1000000d)); //convert to ms
                            if (addHeader) {
                                header.get(iterable_element.getType().getIdentifier()).add("duration:number");
                            }
                        } else if (((Attribute) key).getContentType().getIdentifier().equals("text")) {
                            textFound=true;
                            record.add(iterable_element.getType().getAccessor((IAccessorKey) key).getMember(r[i]));
                            if (addHeader) {
                                header.get(iterable_element.getType().getIdentifier()).add(((Attribute) key).getIdentifier() + ":text");
                            }
                        } else if (((Attribute) key).getContentType().getIdentifier().equals("number")) {
                            record.add(((IQuantity) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(r[i])).longValue());
                            if (addHeader) {
                                header.get(iterable_element.getType().getIdentifier()).add(((Attribute) key).getIdentifier() + ":number");
                            }
                        } else if (((Attribute) key).getContentType().getIdentifier().equals("percentage")) {
                            record.add(((int)(((IQuantity) iterable_element.getType().getAccessor((IAccessorKey) key).getMember(r[i])).doubleValue()*10000))/100.0);
                            if (addHeader) {
                                header.get(iterable_element.getType().getIdentifier()).add(((Attribute) key).getIdentifier() + ":number");
                            }
                        }
                    }

                    if(!textFound){
                        record.add(iterable_element.getType().getIdentifier());
                        if (addHeader) {
                            header.get(iterable_element.getType().getIdentifier()).add( iterable_element.getType().getIdentifier()+":text");
                        }
                    }

                    if (addHeader) {
                        handler.initializeEvent(iterable_element.getType().getIdentifier());
                        handler.addHeader(iterable_element.getType().getIdentifier(), header.get(iterable_element.getType().getIdentifier()));
                        addHeader = false;
                    }
                    handler.processContext(record, tid, iterable_element.getType().getIdentifier());
                }
            }else{
                if(!unique.containsKey(iterable_element.getType().getIdentifier())){
                    unique.put(iterable_element.getType().getIdentifier(),1);
                }else{
                    unique.put(iterable_element.getType().getIdentifier(),unique.get(iterable_element.getType().getIdentifier()) + 1);
                }
            }
        }
        for (Map.Entry<String, Integer> entry : unique.entrySet()) {
            //System.out.println(entry.getKey() + " : " + entry.getValue());
        }

    }



}
