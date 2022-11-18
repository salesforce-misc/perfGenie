/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server.utils;

import org.openjdk.jmc.common.IMCFrame;
import org.openjdk.jmc.common.IMCMethod;
import org.openjdk.jmc.common.IMCStackTrace;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Iterator;
import java.util.HashMap;
import java.util.Date;
import java.util.Arrays;
import java.util.Comparator;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.LinkedList;

public class EventHandler {
    private static final Logger logger = Logger.getLogger(EventHandler.class.getName());
    private static final String ROOT = "root";
    private static final int WRAP_MESSAGE_HASH = "wrapped.single stack in profile".hashCode();
    private static final String patternString = "\"(.*)\" #(\\w+) .*\\n|.*java.lang.Thread.State: (\\w+).*\\n|at (.*)\\(.*\\n";
    private static final Pattern pattern = Pattern.compile(patternString);

    private final Map<Integer, String> frames = new ConcurrentHashMap<>();
    private final Map<String, Map<Integer, List<StackidTime>>> pidDatas = new ConcurrentHashMap<>();
    private Map<String, Map<Integer, List<LogContext>>> records = new ConcurrentHashMap<>();

    private Map<String, List<String>> header = new ConcurrentHashMap<>();
    private final Map<Integer, Integer> sampleCount = new ConcurrentHashMap<>();

    //aggregations
    private StackFrame calltreeAggregated = new StackFrame(ROOT.hashCode());
    private final Map<Integer, String> framesAggregated = new ConcurrentHashMap<>();
    private Map<Integer, List<StackidTime>> pidDataAggregated = new ConcurrentHashMap<Integer, List<StackidTime>>();

    private Map<String, StackFrame> profiles = new ConcurrentHashMap<>();
    private Map<String, Integer> eventCounts = new ConcurrentHashMap<>();

    private int eventCount = 0;
    private int threshold = 1;
    private Long startEpoch = 0L;
    private Long endEpoch = 0L;
    private Long startEpochAggerated = 0L;
    private Long endEpochAggerated = 0L;

    private enum ThreadState {
        RUNNABLE,
        BLOCKED,
        WAITING,
        TIMED_WAITING,
        UNKNOWN
    }

    public void processContext(List l, int tid, String type) {
        if (!records.get(type).containsKey(tid)) {
            records.get(type).put(tid, Collections.synchronizedList(new ArrayList<LogContext>()));
        }
        records.get(type).get(tid).add(new LogContext(l));
    }

    private ThreadState getThreadState(final String state) {
        if (state.equals("RUNNABLE")) {
            return ThreadState.RUNNABLE;
        } else if (state.equals("WAITING")) {
            return ThreadState.WAITING;
        } else if (state.equals("TIMED_WAITING")) {
            return ThreadState.TIMED_WAITING;
        } else if (state.equals("BLOCKED")) {
            return ThreadState.BLOCKED;
        }
        return ThreadState.UNKNOWN;
    }

    public void reset() {
        eventCount = 0;
        eventCounts.clear();
        threshold = 1;
        startEpoch = 0L;
        endEpoch = 0L;
        sampleCount.clear();
        clearProfile();
        frames.clear();
        for (Map.Entry<String, Map<Integer, List<StackidTime>>> entry : pidDatas.entrySet()) {
            entry.getValue().clear();
        }
        records.clear();
    }

    public List getProfileList() {
        return Arrays.asList(profiles.keySet().toArray());
    }

    public void initializeProfile(String type) {
        if (!profiles.containsKey(type)) {
            profiles.put(type, new StackFrame(ROOT.hashCode()));
        }
    }

    public void initializeEvent(String type) {
        if (!records.containsKey(type)) {
            records.put(type, new ConcurrentHashMap<>());
        }
    }

    public void initializePid(String type) {
        if (!pidDatas.containsKey(type)) {
            pidDatas.put(type, new ConcurrentHashMap<>());
        }
    }


    public void initializeProfiles(List<String> profiles) {
        for (int i = 0; i < profiles.size(); i++) {
            this.profiles.put(profiles.get(i), new StackFrame(ROOT.hashCode()));
        }
    }

    public void clearProfile() {
        for (Map.Entry<String, StackFrame> entry : profiles.entrySet()) {
            entry.setValue(new StackFrame(ROOT.hashCode()));
        }
    }

    public void setThreshold(double percentThreshold) {
        threshold = (int) (eventCount * percentThreshold / 100);
    }

    public void setStartEpoch(long epoch) {
        startEpoch = epoch;
    }

    public void setEndEpoch(long end) {
        endEpoch = end;
    }

    public long getStartEpoch() {
        return startEpoch;
    }

    public long getEndEpoch() {
        return endEpoch;
    }

    public Object getProfileTree(String type) {
        //sort pidData
        final Iterator<Map.Entry<Integer, List<StackidTime>>> itr = pidDatas.get(type).entrySet().iterator();

        while (itr.hasNext()) {
            final Map.Entry<Integer, List<StackidTime>> entry = itr.next();
            List<StackidTime> list = entry.getValue();
            for (int i = 0; i < list.size(); i++) {
                list.get(i).setTime(Math.round((list.get(i).getTime() - startEpoch) / 1000000d));
            }
            Collections.sort(entry.getValue(), (StackidTime a1, StackidTime a2) -> Long.compare(a1.getTime(), a2.getTime()));
        }

        sortProfile(profiles.get(type));
        addStackIndex(profiles.get(type));
        if (eventCounts.containsKey(type)) {
            profiles.get(type).setSz(eventCounts.get(type));
        } else {
            profiles.get(type).setSz(0);
        }
        Map<String, String> meta = new HashMap<>();
        try {
            EventHandler.SurfaceDataResponse res = genSurfaceData(profiles.get(type), pidDatas.get(type));
            meta.put("data", Utils.toJson(res));
        } catch (Exception e) {
            meta.put("exception", Utils.toJson(e));
        }

        for (final String event : header.keySet()) {
            if (event.contains("CPUEvent")) {
                List<Long> cpu = new ArrayList<>();
                for (int i = 0; i < header.get(event).size(); i++) {
                    if (header.get(event).get(i).equals("cpuPerc:number")) {
                        for (final int tid : records.get(event).keySet()) {
                            List l = records.get(event).get(tid);
                            for (int k = 0; k < l.size(); k++) {
                                cpu.add((Long) records.get(event).get(tid).get(k).record.get(i));
                            }
                        }
                    }
                }
                //if(!meta.containsKey("cpuPerc")) {
                meta.put("cpuPerc", Utils.toJson(cpu));
                //break;
                //}
            }
        }
        return new JfrParserResponse(profiles.get(type), null, meta, new JfrContext(pidDatas.get(type), frames, startEpoch, endEpoch));
    }

    public Object getProfileTree(int filterDepth, String type) {

        //sort pidData
        final Iterator<Map.Entry<Integer, List<StackidTime>>> itr = pidDatas.get(type).entrySet().iterator();

        while (itr.hasNext()) {
            final Map.Entry<Integer, List<StackidTime>> entry = itr.next();
            List<StackidTime> list = entry.getValue();
            for (int i = 0; i < list.size(); i++) {
                list.get(i).setTime(Math.round((list.get(i).getTime() - startEpoch) / 1000000d));
            }
            Collections.sort(entry.getValue(), (StackidTime a1, StackidTime a2) -> Long.compare(a1.getTime(), a2.getTime()));
        }

        sortProfile(profiles.get(type));

        filterProfile(profiles.get(type), filterDepth); //truncate after depth filterDepth if this is a single stack

        addStackIndex(profiles.get(type));

        if (eventCounts.containsKey(type)) {
            profiles.get(type).setSz(eventCounts.get(type));
        } else {
            profiles.get(type).setSz(0);
        }

        return new JfrParserResponse(profiles.get(type), null, null, new JfrContext(pidDatas.get(type), frames, startEpoch, endEpoch));
    }

    private void sortProfile(final StackFrame p) {
        final List<StackFrame> ch = p.getCh();
        if (ch != null) {

            Collections.sort(ch, new Comparator<StackFrame>() {
                public int compare(StackFrame v1, StackFrame v2) {
                    return (int) (v2.sz - v1.sz);
                }
            });

            final Iterator<StackFrame> chIterator = ch.iterator();

            while (chIterator.hasNext()) {
                sortProfile(chIterator.next());
            }
        }
    }

    private void addStackIndex(final StackFrame root) {
        final List<StackFrame> children = root.getCh();
        if (children != null) {
            final Iterator<StackFrame> childrenIterator = children.iterator();
            int index = 0;
            while (childrenIterator.hasNext()) {
                final StackFrame child = childrenIterator.next();
                for (Integer stackId : child.sm.keySet()) {
                    root.sm.put(stackId, index);
                }
                index++;
            }
        }
    }

    private StackFrame filterProfile(final StackFrame profile, final int maxD) {
        final int totalSz = (int) profile.getSz();
        filterChild(profile, totalSz, maxD, false, 0);
        return profile;
    }

    private void filterChild(final StackFrame p, final int totalSz, final int maxD, final boolean filter, final int depth) {
        if (filter && depth > maxD) {
            p.nm = WRAP_MESSAGE_HASH;
            StackFrame cur = p;
            while (cur.getCh() != null) {
                cur = cur.getCh().get(0);
            }
            p.setCh(null);
            if (cur != p) {
                p.addFrame(cur);
            }
        } else {
            final List<StackFrame> ch = p.getCh();
            if (ch != null) {
                final Iterator<StackFrame> chIterator = ch.iterator();
                while (chIterator.hasNext()) {
                    final StackFrame child = chIterator.next();
                    if (child.getSz() == 1) {
                        //truncate if single stack after maxD
                        filterChild(child, totalSz, maxD, true, depth + 1);
                    } else {
                        filterChild(child, totalSz, maxD, false, depth + 1);
                    }
                }
            }
        }
    }

    private int getFrameNm(final StringBuilder stringBuilder, final IMCFrame frame) {
        final IMCMethod method = frame.getMethod();
        String fullNm = null;
        try {
            fullNm = method.getType().getFullName();
        } catch (StringIndexOutOfBoundsException e) {
            fullNm = "unknown";
        }
        final String methodNm = method.getMethodName();
        int hash = CustomHash(fullNm.hashCode(), methodNm.hashCode());
        if (!frames.containsKey(hash)) {
            stringBuilder.setLength(0);
            if (Utils.normalizeFrame(fullNm, stringBuilder, 0)) {
                String nm = stringBuilder.toString();
                hash = CustomHash(nm.hashCode(), methodNm.hashCode());
                nm = nm + "." + methodNm;
                if (!frames.containsKey(hash)) {
                    frames.put(hash, nm);
                }
            } else {
                //Utils.normalizeFrame(fullNm, stringBuilder, 0);
                //stringBuilder.append(fullNm.replaceAll("\\$Lambda\\$.*", "\\$Lambda\\$\\?"));
                stringBuilder.append(".")
                        .append(methodNm);
                final String nm = stringBuilder.toString();
                if (nm.contains("GeneratedMethodAccessor")) {
                    System.out.println(nm);
                }
                frames.put(hash, nm);
            }
        }

        return hash;
    }

    public boolean processJstackEvent(long time, final String jstack) {
        try {
            SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss zzz");
            Date date = df.parse(jstack.substring(0, jstack.indexOf("\n")) + " UTC");
            //take jstack timestamp if event time is too off ( more than 1 min)
            long diff = Math.abs(time / 1000000 - date.getTime());
            if (diff > 6000) {
                time = date.getTime() * 1000000;
            }
        } catch (Exception e) {
            //first line must be a date
            return false;
        }

        if (startEpoch == 0L || time < startEpoch) {
            setStartEpoch(time);
        }
        if (time > endEpoch) {
            setEndEpoch(time);
        }
        final Matcher matcher = pattern.matcher(jstack);
        final List<String> stack = new ArrayList<>();
        int sampleCount = 0;
        int tstate = -1;
        String tname = "";
        int tid = 0;
        final StringBuilder normalized = new StringBuilder();

        while (matcher.find()) {
            if (tid != -1 && matcher.group(4) != null) {
                normalized.setLength(0);
                Utils.normalizeFrame(matcher.group(4), normalized, 0);
                stack.add(normalized.toString());
            } else if (matcher.group(3) != null) {
                if (stack.size() != 0 && tid != -1) {
                    sampleCount++;
                    processEvent(tid, (int) ((time - startEpoch) / 1000000), tstate + ";" + tname, stack, "Jstack");
                    tid = -1;
                    tname = "";
                    stack.clear();
                }
                tstate = getThreadState(matcher.group(3)).ordinal();
            } else if (matcher.group(1) != null) {
                //process previous stack
                if (stack.size() != 0) {
                    sampleCount++;
                    processEvent(tid, (int) ((time - startEpoch) / 1000000), tstate + ";" + tname, stack, "Jstack");
                    stack.clear();
                    tid = -1;
                    tname = "";
                    tstate = -1;
                }
                tid = Integer.parseInt(matcher.group(2).toUpperCase());
                tname = matcher.group(1);
            }
        }
        //handle left over stack
        if (stack.size() != 0 && tid != -1) {
            processEvent(tid, (int) ((time - startEpoch) / 1000000), tstate + ";" + tname, stack, "Jstack");
        }
        if (sampleCount > 0) {
            return true;
        } else {
            return false;
        }
    }

    private int getHash(final StringBuilder stringBuilder, final IMCStackTrace stackTrace) {
        int hash = 0; //toddo, check if it causes any collisions due to int instead of long
        for (int i = 0; i < stackTrace.getFrames().size(); i++) {
            hash = CustomHash(hash, getFrameNm(stringBuilder, stackTrace.getFrames().get(i)));
        }
        return hash;
    }

    public void processEvent(final StringBuilder sb, final IMCStackTrace stackTrace, String type, int tid, long time) {
        if (startEpoch == 0L || time < startEpoch) {
            setStartEpoch(time);
        }
        if (time > endEpoch) {
            setEndEpoch(time);
        }
        StackFrame frame = profiles.get(type);
        final int hash = getHash(sb, stackTrace);
        int sz = 1;
        if (!pidDatas.get(type).containsKey(tid)) {
            pidDatas.get(type).put(tid, new ArrayList<StackidTime>());
        }
        pidDatas.get(type).get(tid).add(new StackidTime(hash, time));

        if (sampleCount.containsKey(hash)) {
            sz = sampleCount.get(hash);
            frame = profiles.get(type);
        }
        if (!eventCounts.containsKey(type)) {
            eventCounts.put(type, 1);
        } else {
            eventCounts.put(type, eventCounts.get(type) + 1);
        }

        if (sz >= 0) {
            frame.sz += sz;
            int sf = 0;
            final int count = stackTrace.getFrames().size();
            for (int i = 0; i < count; i++) {
                final int fN = getFrameNm(sb, stackTrace.getFrames().get(i));

                if (i == count - 1) {
                    sf = sz;
                }
                if (i == 0 || i == count - 1) {
                    frame = frame.addFrame(fN, sz, sf, true, hash);
                } else {
                    frame = frame.addFrame(fN, sz, sf, false, 0);
                }
            }
        }
    }

    public void processEvent(final int tid, final long time, final String ctx, final List<String> stackTrace, String type) {
        final int hash = getHash(stackTrace);
        if (!pidDatas.get(type).containsKey(tid)) {
            pidDatas.get(type).put(tid, new ArrayList<StackidTime>());
        }
        pidDatas.get(type).get(tid).add(new StackidTime(hash, time, ctx));
        StackFrame frame = profiles.get(type);
        int sz = 1;
        eventCount++;

        frame.sz += sz;
        int sf = 0;
        final int count = stackTrace.size();
        for (int i = 0; i < count; i++) {
            final int fN = stackTrace.get(i).hashCode();
            if (!frames.containsKey(hash)) {
                frames.put(fN, stackTrace.get(i));
            }

            if (i == count - 1) {
                sf = sz;
            }
            if (i == 0 || i == count - 1) {
                frame = frame.addFrame(fN, sz, sf, true, hash);
            } else {
                frame = frame.addFrame(fN, sz, sf, false, 0);
            }
        }
    }

    private int getHash(final List<String> stack) {
        int hash = 0; //toddo, check if it causes any collisions due to int instead of long
        for (int i = 0; i < stack.size(); i++) {
            hash = CustomHash(hash, stack.get(i).hashCode());
        }
        return hash;
    }

    private static int CustomHash(int a, int b) {
        return (((a + b) * (a + b + 1)) / 2) + b;
    }


    public void addHeader(String type, List l) {
        header.put(type, l);
    }


    public Object getLogContext() {
        final Map<Integer, Long> tidMap = new HashMap<>();
        return new ContextResponse(records, sortMap(tidMap), header);
    }

    private List sortMap(final Map inputMap) {
        final List outList = new LinkedList(inputMap.entrySet());
        // Defined Custom Comparator here
        Collections.sort(outList, new Comparator() {
            public int compare(final Object o1, final Object o2) {
                return ((Comparable) ((Map.Entry) (o2)).getValue())
                        .compareTo(((Map.Entry) (o1)).getValue());
            }
        });
        final List<Entry> sortedList = new ArrayList<>();
        for (Iterator it = outList.iterator(); it.hasNext(); ) {
            final Map.Entry entry = (Map.Entry) it.next();
            sortedList.add(new Entry(String.valueOf(entry.getKey()), (Long) entry.getValue()));
        }
        return sortedList;
    }

    public JfrParserResponse getAggregatedProfileTree() {
        addStackIndex(this.calltreeAggregated);
        //sort pidData
        final Iterator<Map.Entry<Integer, List<StackidTime>>> itr = pidDataAggregated.entrySet().iterator();

        while (itr.hasNext()) {
            final Map.Entry<Integer, List<StackidTime>> entry = itr.next();
            Collections.sort(entry.getValue(), (StackidTime a1, StackidTime a2) -> Long.compare(a1.getTime(), a2.getTime()));
        }
        return new JfrParserResponse(this.calltreeAggregated, null, null, new JfrContext(pidDataAggregated, framesAggregated, startEpochAggerated, endEpochAggerated));
    }

    public void aggregateTree(final JfrParserResponse response) {
        if (((StackFrame) response.getTree()).sz > 0) {//no need to merge if there are no samples
            aggregateTree((StackFrame) response.getTree());
            aggregateContext((JfrContext) response.getContext());
        } else {
            System.out.println("aggregateTree skipped, no samples found");
        }
    }

    private void aggregateContext(final JfrContext context) {
        if (context == null) {
            return;
        }
        mergeContext(context);
    }

    private void mergeContext(final JfrContext context) {
        //merge start and end times
        if (startEpochAggerated == 0L) {
            startEpochAggerated = context.getStart();
        }

        if (context.getEnd() > endEpochAggerated) {
            endEpochAggerated = context.getEnd();
        }

        //merge frames
        if (context.getFrames() != null) {
            for (final int frameId : context.getFrames().keySet()) {
                if (!framesAggregated.containsKey(frameId)) {
                    framesAggregated.put(frameId, context.getFrames().get(frameId));
                }
            }
        }

        final int offSet = (int) (context.getStart() / 1000000 - startEpochAggerated / 1000000); //offset is in milliseconds

        //merge pidData
        final Iterator<Map.Entry<Integer, List<StackidTime>>> itrPid = context.getTidMap().entrySet().iterator();
        while (itrPid.hasNext()) {
            final Map.Entry<Integer, List<StackidTime>> entry = itrPid.next();
            if (pidDataAggregated.containsKey(entry.getKey())) {
                final List<StackidTime> target = pidDataAggregated.get(entry.getKey());
                //append all source to target
                final List<StackidTime> source = entry.getValue();
                if (offSet > 0) {
                    source.forEach((e) -> {
                        e.setTime(e.getTime() + offSet);
                    });
                }
                target.addAll(source);
            } else {
                final List<StackidTime> source = entry.getValue();
                if (offSet > 0) {
                    source.forEach((e) -> {
                        e.setTime(e.getTime() + offSet);
                    });
                }
                pidDataAggregated.put(entry.getKey(), source);
            }
        }
    }

    private void aggregateTree(final StackFrame tree) {
        mergeTree(tree, this.calltreeAggregated);
    }

    private void mergeTree(final StackFrame source, final StackFrame target) {
        if (source == null || target == null) {
            return;
        }
        target.sz += source.sz;
        target.sf += source.sf;

        //merge stackID map
        if (source.sm != null) {
            for (final Integer stackId : source.sm.keySet()) {
                if (!target.sm.containsKey(stackId)) {
                    target.sm.put(stackId, 1);
                }
            }
        }

        if (source.ch == null) {
            return;
        }

        for (final StackFrame child : source.ch) {
            final StackFrame frame = target.chMap.get(child.nm);
            if (frame == null) {
                target.chMap.put(child.nm, child);
                if (target.ch == null) {
                    target.ch = new ArrayList<>();
                }
                target.ch.add(child);
                fillChildrenMap(child); // tree built from parsed json will not have children map filled
            } else {
                mergeTree(child, frame);
            }
        }
    }

    private void fillChildrenMap(final StackFrame root) {
        if (root == null || root.ch == null) {
            return;
        }
        for (final StackFrame child : root.ch) {
            if (!root.chMap.containsKey(child.nm)) {
                root.chMap.put(child.nm, child);
            }
            fillChildrenMap(child);
        }
    }

    //Aggregation with filter start
    double szThreshold = 0;
    double filterP = 1.0;
    Map<Integer, String> sourceFrames = null;

    public void aggregateTreeWithFilter(final JfrParserResponse response, double filterP) {
        if (((StackFrame) response.getTree()).sz > 0) {//no need to merge if there are no samples
            sourceFrames = ((JfrContext) response.getContext()).getFrames();
            aggregateTreeWithFilter((StackFrame) response.getTree(), filterP);
            aggregateContextForFilter((JfrContext) response.getContext());
        } else {
            System.out.println("aggregateTree skipped, no samples found");
        }
    }

    private void aggregateTreeWithFilter(final StackFrame tree, double filterP) {
        szThreshold = tree.sz;
        this.filterP = filterP;
        mergeTreeWithFilter(tree, this.calltreeAggregated, null, false, 0);
    }

    private void cleanChildrenSm(final StackFrame root, Map<Integer, Integer> sm) {
        if (root == null) {
            return;
        }
        if (root.sm != null) {
            for (final Integer stackId : root.sm.keySet()) {
                if (sm.containsKey(stackId)) {
                    sm.remove(stackId);
                }
            }
        }
        if (root.ch != null) {
            for (final StackFrame child : root.ch) {
                cleanChildrenSm(child, sm);
            }
        }
    }

    private void filterAggregateChild(StackFrame source, Map<Integer, Integer> sm, int hash) {
        if (source.ch == null) {
            return;
        }
        for (int index = source.ch.size() - 1; index >= 0; --index) {
            if (100 * source.ch.get(index).sz / szThreshold >= filterP) {
                filterAggregateChild(source.ch.get(index), sm, CustomHash(hash, source.ch.get(index).nm));
            } else {
                source.sm.put(hash, 1);
                sm.put(hash, 1);
                source.sf = source.sf + source.ch.get(index).sz;
                cleanChildrenSm(source.ch.get(index), sm);
                source.ch.remove(index);
            }
        }
    }

    private void mergeTreeWithFilter(final StackFrame source, final StackFrame target, Map<Integer, Integer> sm, boolean notRoot, int hash) {
        if (source == null || target == null || 100 * source.sz / szThreshold < filterP) {
            return;
        }
        target.sz += source.sz;
        target.sf += source.sf;

        //merge stackID map
        if (notRoot && source.sm != null) {
            for (final Integer stackId : source.sm.keySet()) {
                if (!target.sm.containsKey(stackId)) {
                    target.sm.put(stackId, 1);
                }
            }
        }
        if (source.ch == null) {
            return;
        }
        for (int index = source.ch.size() - 1; index >= 0; --index) {
            //if(notRoot){ //|| index==0 || index==0) {
            if (100 * source.ch.get(index).sz / szThreshold >= filterP) {
                final StackFrame frame = target.chMap.get(source.ch.get(index).nm);
                if (frame == null) {
                    if (sm == null) {
                        //source.ch.get(index).sm.clear();
                        filterAggregateChild(source.ch.get(index), source.ch.get(index).sm, CustomHash(0, source.ch.get(index).nm));
                    } else {
                        filterAggregateChild(source.ch.get(index), sm, CustomHash(hash, source.ch.get(index).nm));
                    }

                    target.chMap.put(source.ch.get(index).nm, source.ch.get(index));
                    if (target.ch == null) {
                        target.ch = new ArrayList<>();
                    }
                    target.ch.add(source.ch.get(index));
                    fillggregatedChildrenMap(source.ch.get(index)); // tree built from parsed json will not have children map filled
                } else {
                    if (sm == null) {
                        mergeTreeWithFilter(source.ch.get(index), frame, frame.sm, true, CustomHash(0, source.ch.get(index).nm));
                    } else {
                        mergeTreeWithFilter(source.ch.get(index), frame, sm, true, CustomHash(hash, source.ch.get(index).nm));
                    }
                }
            } else {
                if (sm != null) {
                    target.sm.put(hash, 1);
                    sm.put(hash, 1);
                    target.sf = target.sf + source.ch.get(index).sz;
                    cleanChildrenSm(source.ch.get(index), sm);
                    source.ch.remove(index);
                }
            }
            //}
        }
    }

    private void fillggregatedChildrenMap(final StackFrame root) {
        if (root == null) {
            return;
        }
        if (!framesAggregated.containsKey(root.nm)) {
            framesAggregated.put(root.nm, sourceFrames.get(root.nm));
        }
        if (root.ch == null) {
            return;
        }
        for (final StackFrame child : root.ch) {
            if (!root.chMap.containsKey(child.nm)) {
                root.chMap.put(child.nm, child);
            }
            //fill aggregated frames
            if (!framesAggregated.containsKey(child.nm)) {
                framesAggregated.put(child.nm, sourceFrames.get(child.nm));
            }
            fillggregatedChildrenMap(child);
        }
    }

    private void aggregateContextForFilter(final JfrContext context) {
        if (context == null) {
            return;
        }
        mergeContextForFilter(context);
    }

    private void mergeContextForFilter(final JfrContext context) {
        //merge start and end times
        if (startEpochAggerated == 0L) {
            startEpochAggerated = context.getStart();
        }

        if (context.getEnd() > endEpochAggerated) {
            endEpochAggerated = context.getEnd();
        }
        //skip merge frames

        //skip merge pidData
    }
    //Aggregation with filter end

    public void aggregateLogContext(final ContextResponse res) throws IOException {

        if (this.header == null || this.header.size() == 0) {
            this.header = res.header;
        }

        if (this.records == null || this.records.size() == 0) {
            this.records = res.records;
        } else {
            //Map<String,Map<Integer, List<LogContext>>>
            for (final String key1 : res.records.keySet()) {

                for (final Integer key : res.records.get(key1).keySet()) {
                    if (this.records.get(key1).containsKey(key)) {
                        final List<LogContext> list = this.records.get(key1).get(key);
                        for (final LogContext lc : res.records.get(key1).get(key)) {
                            list.add(lc);
                        }
                    } else {
                        this.records.get(key1).put(key, res.records.get(key1).get(key));
                    }
                }

            }
        }
    }

    public static class StackFrame {
        public int getNm() {
            return nm;
        }

        public void setNm(int nm) {
            this.nm = nm;
        }

        public void setSz(int sz) {
            this.sz = sz;
        }

        public void setSf(int sf) {
            this.sf = sf;
        }

        int nm;
        int sz = 0;

        public int getSf() {
            return sf;
        }

        int sf = 0;
        List<StackFrame> ch = null;
        transient Map<Integer, StackFrame> chMap = new HashMap<>();
        transient Map<Integer, Integer> sm = new HashMap<>();//to tell a stack start and end in tree

        public StackFrame() {
        }

        public StackFrame(final int nm) {
            this.nm = nm;
        }

        public void addFrame(StackFrame frame) {
            if (ch == null) {
                ch = new ArrayList<>();
            }
            ch.add(frame);
        }

        public StackFrame addFrame(final int frameNm, final int sz, final int sf, final boolean start, final int hash) {
            if (ch == null) {
                ch = new ArrayList<>();
            }
            StackFrame frame = chMap.get(frameNm);
            if (frame == null) {
                frame = new StackFrame(frameNm);
                chMap.put(frameNm, frame);
                ch.add(frame);
            }
            frame.sf += sf;
            frame.sz += sz;
            if (start) {
                frame.sm.put(hash, 1);
            }
            return frame;
        }

        public int getSz() {
            return sz;
        }

        public List<StackFrame> getCh() {
            return ch;
        }

        public void setCh(final List<StackFrame> ch) {
            this.ch = ch;
        }

        public Map<Integer, Integer> getSm() {
            return sm;
        }

        public void setSm(final Map<Integer, Integer> m) {
            this.sm = m;
        }
    }

    public static class StackidTime {
        public String getCtx() {
            return ctx;
        }

        public void setCtx(String ctx) {
            this.ctx = ctx;
        }

        String ctx;

        Integer hash;

        StackidTime() {

        }

        public void setHash(Integer hash) {
            this.hash = hash;
        }

        public void setTime(Long time) {
            this.time = time;
        }

        Long time;

        StackidTime(final int t, final Long m) {
            hash = t;
            time = m;
        }

        StackidTime(final int t, final Long m, final String c) {
            hash = t;
            time = m;
            ctx = c;
        }

        public int getHash() {
            return hash;
        }

        public Long getTime() {
            return time;
        }
    }

    public static class JfrContext {

        public void setStart(Long start) {
            this.start = start;
        }

        public void setEnd(Long end) {
            this.end = end;
        }

        public void setFrames(Map<Integer, String> frames) {
            this.frames = frames;
        }

        public void setTidMap(Map<Integer, List<StackidTime>> pidMap) {
            this.tidMap = pidMap;
        }

        private Long start;
        private Long end;
        private Map<Integer, String> frames;
        private Map<Integer, List<StackidTime>> tidMap;//pid to list of (stackId, timesttamp);

        public JfrContext() {

        }


        public JfrContext(final Map<Integer, List<StackidTime>> tiddata, final Map<Integer, String> frames, final Long start, final Long end) {
            this.start = start;
            this.end = end;
            this.tidMap = tiddata;
            this.frames = frames;
        }

        public Map<Integer, String> getFrames() {
            return frames;
        }

        public Long getStart() {
            return start;
        }

        public Long getEnd() {
            return end;
        }

        public Map<Integer, List<StackidTime>> getTidMap() {
            return tidMap;
        }
    }

    public static class JfrParserResponse {
        private String error;
        private StackFrame tree;
        private Map<String, String> meta;
        private JfrContext context;

        public JfrParserResponse() {

        }

        public JfrParserResponse(final Object tree, final String error, final Map<String, String> meta, final Object context) {
            this.tree = (StackFrame) tree;
            this.error = error;
            this.meta = meta;
            this.context = (JfrContext) context;
        }

        public void addMeta(final Map<String, String> meta) {
            if (this.meta == null) {
                this.meta = meta;
            } else {
                this.meta.putAll(meta);
            }
        }

        public String getError() {
            return error;
        }

        public Object getTree() {
            return tree;
        }

        public Map<String, String> getMeta() {
            return meta;
        }

        public Object getContext() {
            return context;
        }
    }

    public static class TidTime {
        TidTime() {

        }

        public void setTid(Integer tid) {
            this.tid = tid;
        }

        public void setTime(Integer time) {
            this.time = time;
        }

        Integer tid;
        Integer time;

        TidTime(final int t, final int m) {
            tid = t;
            time = m;
        }

        public int getTid() {
            return tid;
        }

        public int getTime() {
            return time;
        }
    }

    public static class LogContext {

        public List<Object> getRecord() {
            return record;
        }

        public void setRecord(List<Object> record) {
            this.record = record;
        }

        List<Object> record;

        LogContext() {
        }

        LogContext(List l) {
            record = l;
        }

    }

    public static class Entry {
        public String key;
        public long val;

        Entry() {
        }

        Entry(final String k, final long v) {
            this.key = k;
            this.val = v;
        }

        public String getKey() {
            return key;
        }

        public long getVal() {
            return val;
        }

        public void setKey(final String key) {
            this.key = key;
        }

        public void setVal(final long val) {
            this.val = val;
        }
    }

    public static class ContextResponse {
        public Map<String, Map<Integer, List<LogContext>>> records; //map of pid and List where list is log context entries
        public List<Entry> tidlist; // list of entry where entry is a map of k=pid and v=runtime in descending order

        public Map<String, List<String>> getHeader() {
            return header;
        }

        public void setHeader(Map<String, List<String>> header) {
            this.header = header;
        }

        private Map<String, List<String>> header;

        public void addHeader(Map header) {
            this.header = header;
        }

        ContextResponse() {

        }

        ContextResponse(final Map<String, Map<Integer, List<LogContext>>> records, final List<Entry> tidlist, Map header) {
            this.records = records;
            this.tidlist = tidlist;
            this.header = header;
        }

        public Map<String, Map<Integer, List<LogContext>>> getRecords() {
            return records;
        }

        public List<Entry> getTidlist() {
            return tidlist;
        }

        public void setRecords(final Map<String, Map<Integer, List<LogContext>>> records) {
            this.records = records;
        }

        public void setTidlist(final List<Entry> tidlist) {
            this.tidlist = tidlist;
        }
    }

    //need to improve
    public static class ContextFilters {
        public static int threadId = -1;
        public static String orgId;
        public static String userId;
        public static String logRecordType;
        public static String reqId;
        public static String frame;
        public static String uri;
        public static String threadName;
        public static Integer racNode;
        public static Integer trust;
        public static Integer queueTier;
        public static String sfdcMsgId;
        public static boolean isEmpty = true;
        public static int contextDataTypeVal = -1; // default all
        public static boolean isFrameFilter = false;

        public static void parseFilters(final String filtersString) {
            for (String filterString : filtersString.split(";")) {
                String[] pair = filterString.split("=");
                if (pair.length == 2) {
                    if (pair[0].equals("tid")) {
                        threadId = Integer.parseInt(pair[1]);
                    } else if (pair[0].equals("org")) {
                        orgId = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("user")) {
                        userId = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("log")) {
                        logRecordType = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("req")) {
                        reqId = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("frame")) {
                        frame = pair[1];
                        isFrameFilter = true;
                    } else if (pair[0].equals("uri")) {
                        uri = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("thread_name")) {
                        threadName = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("rac")) {
                        racNode = Integer.parseInt(pair[1]);
                        isEmpty = false;
                    } else if (pair[0].equals("trust")) {
                        trust = Integer.parseInt(pair[1]);
                        isEmpty = false;
                    } else if (pair[0].equals("tier")) {
                        queueTier = Integer.parseInt(pair[1]);
                        isEmpty = false;
                    } else if (pair[0].equals("sfdcmsgid")) {
                        sfdcMsgId = pair[1];
                        isEmpty = false;
                    } else if (pair[0].equals("context")) {
                        if (pair[1].equals("sync")) {
                            contextDataTypeVal = EventType.CONTEXT.ordinal();
                            isEmpty = false;
                        } else if (pair[1].equals("sync")) {
                            contextDataTypeVal = EventType.MQFRM.ordinal();
                            isEmpty = false;
                        }
                    }
                }
            }
        }
    }

    Map<Integer, String> tmpFrames = new HashMap<>();

    //javascript methods ported to java for aggregation
    public void applyContextFilter(final JfrParserResponse response, final ContextResponse contextRes, final String filter, String type) {
        /*final StackFrame target = profiles.get(type);//new StackFrame(ROOT.hashCode());
        final StackFrame source = (StackFrame) response.getTree();
        Map<Integer, Integer> filteredStackMap = new HashMap<>();
        ContextFilters.parseFilters(filter);

        final JfrContext sourceJfrContext = (JfrContext) response.getContext();
        Map<Integer, List<StackidTime>> treeContextTidMap = sourceJfrContext.getTidMap();
        Map<String,Map<Integer, List<LogContext>>> logContextMap = contextRes.getRecords();
        tmpFrames = sourceJfrContext.getFrames();

        //if only frame filter is given, and no context filter then we need to take all frame matching stacks
        if (ContextFilters.isEmpty && ContextFilters.isFrameFilter && ContextFilters.threadId == -1) {
            //TODO: apply frame filter on source tree and find all matching stacks

            // if only tid filter is given, we will take all samples on that thread
        } else if (ContextFilters.isEmpty && ContextFilters.threadId != -1) {
            if (treeContextTidMap.containsKey(ContextFilters.threadId)) {
                for (StackidTime stackidTime : treeContextTidMap.get(ContextFilters.threadId)) {
                    final Integer stackId = stackidTime.getHash();
                    filteredStackMap.put(stackId, filteredStackMap.getOrDefault(stackId, 0) + 1);
                }
            }
        } else {//context filter is provided
            final Long startT = sourceJfrContext.getStart() / 1000000;
            final Long endT = sourceJfrContext.getEnd() / 1000000;
            for (Integer tid : logContextMap.keySet()) {
                List list = logContextMap.get(tid);
                list = handleActiveRequests(list);

                for (int i = 0; i < list.size(); i++) {
                    List record = ((LogContext) list.get(i)).record;
                    if (filterMatch(record) && treeContextTidMap.containsKey(tid)) {
                        final Long end = (Long) record.get(1) - startT + (Integer) record.get(8);
                        final Long start = (Long) record.get(1) - startT;
                        //do a binary search
                        Integer entryIndex = isinRequest(treeContextTidMap.get(tid), start, end);
                        if (entryIndex != -1) {
                            List requestArr = treeContextTidMap.get(tid);
                            int curIndex = entryIndex;
                            //consider all matching samples downward
                            StackidTime st = (StackidTime) requestArr.get(curIndex);
                            while (curIndex >= 0 && st.time >= start && st.time <= end) {
                                filteredStackMap.put(st.getHash(), filteredStackMap.getOrDefault(st.getHash(), 0) + 1);
                                curIndex--;
                                if (curIndex >= 0) {
                                    st = (StackidTime) requestArr.get(curIndex);
                                }
                            }
                            curIndex = entryIndex + 1;
                            //consider all matching samples upward
                            if (curIndex < requestArr.size()) {
                                st = (StackidTime) requestArr.get(curIndex);
                            }
                            while (curIndex < requestArr.size() && st.time >= start && st.time <= end) {
                                filteredStackMap.put(st.getHash(), filteredStackMap.getOrDefault(st.getHash(), 0) + 1);
                                curIndex++;
                                if (curIndex < requestArr.size()) {
                                    st = (StackidTime) requestArr.get(curIndex);
                                }
                            }
                        }
                    }
                }
            }
        }

        filteredStackMap.forEach((key, value) -> getTreeStack(source, target, key, value));
        eventCount += source.sz;*/
    }

    private List handleActiveRequests(List<LogContext> list) {

        //need to convert active requests into mqfrm entries and sort all requests
        Map<String, Boolean> mqRecordsMap = new HashMap<>();
        Map<String, LogContext> activeRecordsMap = new HashMap<>();

        //find mq active requests that did not finish
        for (LogContext ctx : list) {
            System.out.println(ctx.record);
            final Integer type = (Integer) ctx.record.get(0);
            if (type == EventType.MQFRM.ordinal()) {
                if (!mqRecordsMap.containsKey(ctx.record.get(10))) {
                    mqRecordsMap.put(ctx.record.get(10).toString(), true);
                }
            } else if (type == EventType.ACTIVE.ordinal()) {
                if (!activeRecordsMap.containsKey(ctx.record.get(7))) {
                    activeRecordsMap.put(ctx.record.get(7).toString(), ctx);
                    System.out.println(activeRecordsMap.get(ctx.record.get(7)));
                } else {
                    if ((Integer) activeRecordsMap.get(ctx.record.get(7)).record.get(6) < (Integer) ctx.record.get(6)) {
                        activeRecordsMap.put(ctx.record.get(7).toString(), ctx);
                    }
                }
            }
        }

        for (String reqId : activeRecordsMap.keySet()) {
            if (!mqRecordsMap.containsKey(reqId)) {
                LogContext lc = new LogContext();
                List<Object> record = new ArrayList<>();

                for (Object entry : activeRecordsMap.get(reqId).record) {
                    lc.record.add(entry);
                }
                lc.record.set(0, EventType.MQFRM.ordinal());//add a mqfrm type
                lc.record.set(1, (Long) lc.record.get(1) - (Integer) lc.record.get(6));//update epoch
                list.add(lc);
            }
        }

        //sort records
        Collections.sort(list, (ctx1, ctx2) -> {
            return (int) ((Long) ctx1.record.get(1) - (Long) ctx2.record.get(1));
        });

        return list;
    }

    private int isinRequest(List list, final Long start, final Long end) {
        int l = 0, r = list.size() - 1;
        while (l <= r) {
            int m = (l + r) / 2;
            final StackidTime st = (StackidTime) list.get(m);
            if (st.time >= start && st.time <= end)
                return m;
            else if (st.time > end)
                r = m - 1;
            else
                l = m + 1;
        }
        return -1;
    }

    private boolean filterMatch(final List list) {
        final Integer type = (Integer) list.get(0);
        if (ContextFilters.contextDataTypeVal == -1) {//all
            if (type == EventType.CONTEXT.ordinal()) {
                return isSyncMatch(list);
            } else if (type == EventType.MQFRM.ordinal()) {
                return isAsyncMatch(list);
            }
        } else if (ContextFilters.contextDataTypeVal == EventType.CONTEXT.ordinal() && type == EventType.CONTEXT.ordinal()) {
            return isSyncMatch(list);
        } else if (ContextFilters.contextDataTypeVal == EventType.MQFRM.ordinal() && type == EventType.MQFRM.ordinal()) {
            return isAsyncMatch(list);
        }
        return false;
    }

    private boolean isAsyncMatch(final List list) {
        if ((ContextFilters.threadId == -1 || ContextFilters.threadId == (Integer) list.get(2)) &&
                (ContextFilters.racNode == null || ContextFilters.racNode == (Integer) list.get(10)) &&
                (ContextFilters.queueTier == null || ContextFilters.queueTier == (Integer) list.get(17)) &&

                (ContextFilters.threadName == null || ((String) list.get(3)).contains(ContextFilters.threadName)) &&
                (ContextFilters.logRecordType == null || ContextFilters.logRecordType.equals(list.get(4))) &&
                (ContextFilters.orgId == null || ContextFilters.orgId.equals(list.get(5))) &&
                (ContextFilters.reqId == null || ContextFilters.reqId.equals(list.get(9))) &&
                (ContextFilters.uri == null || ContextFilters.uri.equals(list.get(13))) &&
                (ContextFilters.sfdcMsgId == null || ContextFilters.sfdcMsgId.equals(list.get(18))) &&
                ContextFilters.userId == null && ContextFilters.trust == null) {//userId and trust not available for async
            return true;
        }
        return false;
    }

    private boolean isSyncMatch(final List list) {
        if ((ContextFilters.racNode == null || ContextFilters.racNode == (Integer) list.get(11)) &&
                (ContextFilters.threadId == -1 || ContextFilters.threadId == (Integer) list.get(2)) &&
                (ContextFilters.trust == null || ContextFilters.trust == (Integer) list.get(16)) &&

                (ContextFilters.uri == null || ContextFilters.uri.equals(list.get(3))) &&
                (ContextFilters.logRecordType == null || ContextFilters.logRecordType.equals(list.get(4))) &&
                (ContextFilters.orgId == null || ContextFilters.orgId.equals(list.get(5))) &&
                (ContextFilters.userId == null || ContextFilters.userId.equals(list.get(6))) &&
                (ContextFilters.reqId == null || ContextFilters.reqId.equals(list.get(10))) &&
                (ContextFilters.threadName == null || ((String) list.get(27)).contains(ContextFilters.threadName)) &&
                ContextFilters.sfdcMsgId == null && ContextFilters.queueTier == null) {//sfdcMsgId and queueTier not available for sync
            return true;
        }
        return false;
    }

    private void getTreeStack(final StackFrame tree, final StackFrame target, final Integer stackid, final int size) {
        Map<Integer, Integer> sm = tree.getSm();
        if (sm.containsKey(stackid) && tree.ch.get(sm.get(stackid)).getSm().containsKey(stackid)) {
            final StackFrame bseJsonTree = tree.ch.get(sm.get(stackid));

            //handle single frame case
            if (bseJsonTree.getCh() == null || bseJsonTree.getCh().size() == 0) {
                if (ContextFilters.isFrameFilter && tmpFrames.get(bseJsonTree.getNm()).contains(ContextFilters.frame)) {
                    target.addFrame(bseJsonTree.getNm(), size, size, true, stackid);
                } else {
                    target.addFrame(bseJsonTree.getNm(), size, size, true, stackid);
                }
                return;
            } else {
                final List<Integer> list = new ArrayList<>();

                getStack(tree.getCh().get(tree.getSm().get(stackid)), target, list, size, stackid, false, !ContextFilters.isFrameFilter);
            }
        }
    }

    private void getStack(final StackFrame baseJsonTree, final StackFrame target, final List<Integer> list, final int size, final Integer stackid, boolean flag, boolean isMatch) {
        //include only matching stacks when frame filter is given
        if (!isMatch && (!ContextFilters.isFrameFilter || tmpFrames.get(baseJsonTree.getNm()).contains(ContextFilters.frame))) {
            isMatch = true;
        }

        if (baseJsonTree.getCh() == null || baseJsonTree.getCh().size() == 0) {
            final List<Integer> tmpList = new ArrayList(list);
            tmpList.add(baseJsonTree.getNm());
            if (flag && baseJsonTree.getSm().containsKey(stackid) && isMatch) {
                StackFrame frame = target;
                for (int i = 0; i < tmpList.size(); i++) {
                    if (i == 0 || i == tmpList.size() - 1) {
                        frame = frame.addFrame(tmpList.get(i), size, size, true, stackid);
                    } else {
                        frame = frame.addFrame(tmpList.get(i), size, 0, false, 0);
                    }
                    frames.put(tmpList.get(i), tmpFrames.get(tmpList.get(i)));
                }
            }
        } else {
            for (int treeIndex = 0; treeIndex < baseJsonTree.getCh().size(); treeIndex++) {
                final List<Integer> tmpList = new ArrayList(list);
                tmpList.add(baseJsonTree.getNm());
                getStack(baseJsonTree.getCh().get(treeIndex), target, tmpList, size, stackid, true, isMatch);
            }
            if (flag && baseJsonTree.getSm().containsKey(stackid) && isMatch) {
                StackFrame frame = target;
                final List<Integer> tmpList = new ArrayList(list);
                tmpList.add(baseJsonTree.getNm());
                for (int i = 0; i < tmpList.size(); i++) {
                    if (i == 0 || i == tmpList.size() - 1) {
                        frame = frame.addFrame(tmpList.get(i), size, size, true, stackid);
                    } else {
                        frame = frame.addFrame(tmpList.get(i), size, 0, false, 0);
                    }
                    frames.put(tmpList.get(i), tmpFrames.get(tmpList.get(i)));
                }
            }
        }
    }

    enum EventType {
        METHOD,
        SOCKET,
        CONTEXT,
        APEX,
        AXAPX,
        GLOBALDESCRIBE,
        MQFRM,
        SQLJFR,
        NATIVE,
        ACTIVE,
        UNKNOWN
    }

    ///////////////////////////////
    //experimental work

    private int chunkCount = 0;
    private List<Integer> chunkSamplesTotalList = new ArrayList();
    private List<Double> cpuSamplesList = new ArrayList();
    static double plotThreshold = 0.01;
    private final Map<String, List<String>> surfaceData = new ConcurrentHashMap<String, List<String>>();
    private final List<String> uniquePaths = new ArrayList<String>();
    private final Map<String, Integer> uniquePathsSize = new HashMap<>();
    private boolean useTimeSeries = true;
    private int totalSize = 0;
    private Map<String, Integer> chunkSurfaceData = new ConcurrentHashMap<>();

    class SurfaceDataResponse {
        private List cpuSamplesList;
        private List<Integer> chunkSamplesTotalList;
        private List<String> pathList = new ArrayList<String>();
        private List<Integer> pathSizeList = new ArrayList<Integer>();
        private Map<Integer, List<Integer>> data = new HashMap<>();

        SurfaceDataResponse(List cpuSamplesList, List<Integer> chunkSamplesTotalList, Map<String, List<String>> surfaceData) {
            this.cpuSamplesList = cpuSamplesList;
            this.chunkSamplesTotalList = chunkSamplesTotalList;
            int colIndex = 0;
            int maxCol = chunkCount;
            for (int i = 0; i < uniquePaths.size(); i++) {
                if (surfaceData.containsKey(uniquePaths.get(i)) && surfaceData.get(uniquePaths.get(i)).size() > 0) {
                    List<String> list = surfaceData.get(uniquePaths.get(i));
                    for (int j = 0; j < list.size(); j++) {
                        if (!data.containsKey(colIndex)) {
                            data.put(colIndex, new ArrayList<Integer>());
                        }
                        String[] pair = list.get(j).split(":");
                        if (pair.length > 1) {
                            for (int k = data.get(colIndex).size(); k < Integer.valueOf(pair[1]); k++) {
                                data.get(colIndex).add(0);
                            }
                            data.get(colIndex).add(Integer.valueOf(pair[0]));
                        } else {
                            data.get(colIndex).add(Integer.valueOf(list.get(j)));
                        }
                    }
                    for (int k = data.get(colIndex).size(); k < maxCol; k++) {
                        data.get(colIndex).add(0);
                    }
                    pathList.add(uniquePaths.get(i));
                    pathSizeList.add(uniquePathsSize.get(uniquePaths.get(i)));
                    colIndex++;
                }
            }
        }

        public List getCpuSamplesList() {
            return cpuSamplesList;
        }

        public void setCpuSamplesList(List cpuSamplesList) {
            this.cpuSamplesList = cpuSamplesList;
        }

        public List getChunkSamplesTotalList() {
            return chunkSamplesTotalList;
        }

        public void setChunkSamplesTotalList(List chunkSamplesTotalList) {
            this.chunkSamplesTotalList = chunkSamplesTotalList;
        }

        public List<String> getPathList() {
            return pathList;
        }

        public void setPathList(List<String> pathList) {
            this.pathList = pathList;
        }

        public List<Integer> getPathSizeList() {
            return pathSizeList;
        }

        public void setPathSizeList(List<Integer> pathSizeList) {
            this.pathSizeList = pathSizeList;
        }

        public Map<Integer, List<Integer>> getData() {
            return data;
        }

        public void setData(Map<Integer, List<Integer>> data) {
            this.data = data;
        }
    }

    public EventHandler.SurfaceDataResponse genSurfaceData(final EventHandler.StackFrame source, Map<Integer, List<EventHandler.StackidTime>> tidMap) throws IOException {
        chunkCount = 0;
        chunkSamplesTotalList.clear();
        cpuSamplesList.clear();
        surfaceData.clear();
        uniquePaths.clear();
        uniquePathsSize.clear();
        totalSize = 0;
        chunkSurfaceData.clear();

        totalSize = source.getSz();

        for (int treeIndex = 0; treeIndex < source.getCh().size(); treeIndex++) {
            final List<Integer> tmpList = new ArrayList();
            tmpList.add(treeIndex);
            getAllPaths(source.getCh().get(treeIndex), tmpList);
        }
        long contextStart = startEpoch / 1000000;
        long contextEnd = endEpoch / 1000000;

        long filterStart = contextStart;
        long filterEnd = filterStart + 60000;

        List<EventHandler.timeSeries> ts = getCPUTimeSeries(contextStart, contextEnd);
        if (ts.size() == 0) {
            useTimeSeries = false;
        }
        int startIndex = 0;
        if (useTimeSeries) {
            for (int i = 0; i < ts.size(); i++, startIndex++) {
                if (ts.get(i).epoch > filterStart) {
                    break;
                }
                System.out.println("skip:  " + filterStart + ":" + ts.get(i).epoch);
            }

            filterStart = ts.get(startIndex).epoch;
            filterEnd = ts.get(startIndex + 1).epoch;
        }

        while (filterEnd <= contextEnd) {
            System.out.println(chunkCount + ":" + filterStart + ":" + filterEnd);
            if (useTimeSeries) {
                cpuSamplesList.add(ts.get(startIndex + 1).value);
            }
            HashMap<Integer, Integer> stackMap = new HashMap<>();

            for (Integer tid : tidMap.keySet()) {
                List<EventHandler.StackidTime> list = tidMap.get(tid);
                for (int i = 0; i < list.size(); i++) {
                    if ((list.get(i).getTime() + contextStart) >= filterStart && (list.get(i).getTime() + contextStart) < filterEnd) {
                        if (stackMap.containsKey(list.get(i).getHash())) {
                            stackMap.put(list.get(i).getHash(), stackMap.get(list.get(i).getHash()) + 1);
                        } else {
                            stackMap.put(list.get(i).getHash(), 1);
                        }
                    } else {
                        //break;
                    }
                }
            }
            int chunkSamplesTotal = 0;
            chunkSurfaceData.clear();
            final ExecutorService executorService = Executors.newFixedThreadPool(10);
            for (Integer stackid : stackMap.keySet()) {
                chunkSamplesTotal = chunkSamplesTotal + stackMap.get(stackid);
                //getSurfaceData(source,stackid,stackMap.get(stackid));
                executorService.execute(new EventHandler.GetSurfaceData(source, stackid, stackMap.get(stackid)));
            }
            executorService.shutdown();
            try {
                executorService.awaitTermination(600, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                System.out.println(e);
            }
            chunkSamplesTotalList.add(chunkSamplesTotal);

            for (String key : chunkSurfaceData.keySet()) {
                if (surfaceData.containsKey(key)) {
                    surfaceData.get(key).add(Integer.toString(chunkSurfaceData.get(key)) + ":" + Integer.toString(chunkCount));
                } else {
                    surfaceData.put(key, new ArrayList<String>());
                    surfaceData.get(key).add(Integer.toString(chunkSurfaceData.get(key)) + ":" + Integer.toString(chunkCount));
                }
            }

            if (useTimeSeries) {
                startIndex++;
                filterStart = ts.get(startIndex).epoch;
                if (ts.size() - 1 == startIndex) {
                    filterEnd = contextEnd + 1;//end loop
                } else {
                    filterEnd = ts.get(startIndex + 1).epoch;
                }
            } else {
                filterStart = filterEnd;
                filterEnd = filterStart + 60000;
            }
            chunkCount++;
        }

        return new EventHandler.SurfaceDataResponse(cpuSamplesList, chunkSamplesTotalList, surfaceData);

    }

    private void getSurfaceData(final EventHandler.StackFrame tree, int stackid, int size) {

        if (tree.getSm().containsKey(stackid) && tree.getCh() != null && tree.getCh().size() > tree.getSm().get(stackid)) {
            final EventHandler.StackFrame baseJsonTree = tree.getCh().get(tree.getSm().get(stackid));
            if (baseJsonTree.getCh() == null || baseJsonTree.getCh().size() == 0) {
                return;
            } else {
                final List<Integer> tmpList = new ArrayList();
                tmpList.add(tree.getSm().get(stackid));
                addStackSurfaceData(baseJsonTree, tmpList, stackid, size, false);
            }
        }
    }

    class GetSurfaceData implements Runnable {
        final EventHandler.StackFrame tree;
        int stackid;
        int size;

        GetSurfaceData(final EventHandler.StackFrame tree, int stackid, int size) {
            this.tree = tree;
            this.stackid = stackid;
            this.size = size;
        }

        @Override
        public void run() {
            getSurfaceData(tree, stackid, size);
        }
    }

    private boolean addStackSurfaceData(final EventHandler.StackFrame tree, final List<Integer> list, int stackid, int size, boolean flag) {
        if (tree.getCh() == null || tree.getSz() == 0) {
            if (flag && tree.getSm().containsKey(stackid)) {
                if (((tree.getSz() * 100.0) / totalSize) >= plotThreshold) {
                    final StringBuilder builder = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i == 0) {
                            builder.append(list.get(i));
                        } else {
                            builder.append(":" + list.get(i));
                        }
                    }
                    builder.append(":" + Integer.toString(stackid));
                    final String key = builder.toString();
                    if (chunkSurfaceData.containsKey(key)) {
                        chunkSurfaceData.put(key, chunkSurfaceData.get(key) + size);
                    } else {
                        chunkSurfaceData.put(key, size);
                    }
                }
                return true;
            }
            return false;
        } else {
            boolean res = false;
            for (int treeIndex = 0; treeIndex < tree.getCh().size(); treeIndex++) {
                final List<Integer> tmpList = new ArrayList(list);
                if (tree.getCh() == null || tree.getCh().size() > 1) {
                    tmpList.add(treeIndex);
                }
                if (addStackSurfaceData(tree.getCh().get(treeIndex), tmpList, stackid, size, true) && !res) {
                    res = true;
                }
            }
            if (res && tree.getCh().size() > 1) {
                if (((tree.getSz() * 100.0) / totalSize) >= plotThreshold) {
                    final StringBuilder builder = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i == 0) {
                            builder.append(list.get(i));
                        } else {
                            builder.append(":" + list.get(i));
                        }
                    }
                    final String key = builder.toString();
                    if (chunkSurfaceData.containsKey(key)) {
                        chunkSurfaceData.put(key, chunkSurfaceData.get(key) + size);
                    } else {
                        chunkSurfaceData.put(key, size);
                    }
                }
            }
            if (flag && tree.getSm().containsKey(stackid)) {
                if (((tree.getSz() * 100.0) / totalSize) >= plotThreshold) {
                    final StringBuilder builder = new StringBuilder();
                    for (int i = 0; i < list.size(); i++) {
                        if (i == 0) {
                            builder.append(list.get(i));
                        } else {
                            builder.append(":" + list.get(i));
                        }
                    }
                    builder.append(":" + Integer.toString(stackid));
                    final String key = builder.toString();
                    if (chunkSurfaceData.containsKey(key)) {
                        chunkSurfaceData.put(key, chunkSurfaceData.get(key) + size);
                    } else {
                        chunkSurfaceData.put(key, size);
                    }
                }
                return true;
            }
            return res;
        }
    }

    public void getAllPaths(final EventHandler.StackFrame baseJsonTree, final List<Integer> list) {
        if (baseJsonTree.getCh() == null) {
            if (baseJsonTree.getSz() > 0) { //do it for all counts
                Map.Entry<Integer, Integer> entry = baseJsonTree.getSm().entrySet().iterator().next();
                final StringBuilder builder = new StringBuilder();
                for (int i = 0; i < list.size(); i++) {
                    if (i == 0) {
                        builder.append(list.get(i));
                    } else {
                        builder.append(":" + list.get(i));
                    }
                }
                final String key = builder.toString();

                for (Integer stackid : baseJsonTree.getSm().keySet()) {
                    String tmpKey = key + ":" + Integer.toString(stackid);
                    uniquePaths.add(tmpKey);
                    uniquePathsSize.put(tmpKey, baseJsonTree.getSz());
                }
            }
        } else if (baseJsonTree.getCh().size() > 1) {
            if (baseJsonTree.getSz() > 0) { //do it for all counts
                final StringBuilder builder = new StringBuilder();
                for (int i = 0; i < list.size(); i++) {
                    if (i == 0) {
                        builder.append(list.get(i));
                    } else {
                        builder.append(":" + list.get(i));
                    }
                }
                final String key = builder.toString();
                uniquePaths.add(key);
                uniquePathsSize.put(key, baseJsonTree.getSz());
            }
        }
        if (baseJsonTree.getCh() != null && baseJsonTree.getCh().size() > 0) {
            for (int treeIndex = 0; treeIndex < baseJsonTree.getCh().size(); treeIndex++) {
                final List<Integer> tmpList = new ArrayList(list);
                if (baseJsonTree.getCh() == null || baseJsonTree.getCh().size() > 1) {
                    tmpList.add(treeIndex);
                }
                getAllPaths(baseJsonTree.getCh().get(treeIndex), tmpList);
            }
        }
    }

    class timeSeries {
        long epoch;
        double value;

        void add(long epoch, double value) {
            this.epoch = epoch;
            this.value = value;
        }

        timeSeries(long epoch, double value) {
            this.epoch = epoch;
            this.value = value;
        }

        timeSeries(String time, double value) {
            try {
                SimpleDateFormat df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
                Date date = df.parse(time);
                this.epoch = date.getTime();//always in UTC
                this.value = value;
            } catch (Exception e) {
                System.out.println(e.getMessage());
            }
        }
    }

    private List<EventHandler.timeSeries> getCPUTimeSeries(long start, long end) {
        int columnCount = 0;
        try {

            List<EventHandler.timeSeries> ts = new ArrayList<>();
            for (int i = 0; i < columnCount; i++) {
                ts.add(new EventHandler.timeSeries(0L, 0d));
            }
            return ts;
        } catch (Exception e) {

        }
        return null;
    }
}

