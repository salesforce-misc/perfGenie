/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package perfgenie.utils;

import org.openjdk.jmc.common.IMCFrame;
import org.openjdk.jmc.common.IMCMethod;
import org.openjdk.jmc.common.IMCStackTrace;
import org.slf4j.LoggerFactory;


import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class EventHandler {
    private static final org.slf4j.Logger  logger =  LoggerFactory.getLogger(EventHandler.class);
    private static final String ROOT = "root";
    private static final int WRAP_MESSAGE_HASH = "wrapped.single stack in profile".hashCode();
    private static final int FILTER_MESSAGE_HASH = "below threshold ...".hashCode();
    private static final String patternString = "at (.*)\\(.*\\n|.*- waiting to lock <(.*)>\\s+\\(a (.*)\\)\\n|.*- locked <(.*)>\\s+\\(a (.*)\\)\\n|\"(.*)\" #(\\w+) .*\\n|.*java.lang.Thread.State: (\\w+).*\\n|(JNI global references:).*|.*- waiting on the Class initialization monitor for (.*)"; //"\"(.*)\" #(\\w+) .*\\n|.*java.lang.Thread.State: (\\w+).*\\n|at (.*)\\(.*\\n";
    private static final Pattern pattern = Pattern.compile(patternString);

    private final Map<Integer, String> frames = new ConcurrentHashMap<>();
    private final Map<String, Map<Integer, List<StackidTime>>> pidDatas = new ConcurrentHashMap<>();
    private Map<String, Map<Integer, List<LogContext>>> records = new ConcurrentHashMap<>();

    private Map<String, List<String>> header = new ConcurrentHashMap<>();
    //private final Map<Integer, Long> sampleCount = new ConcurrentHashMap<>();

    //aggregations
    private StackFrame calltreeAggregated = new StackFrame(ROOT.hashCode());
    private final Map<Integer, String> framesAggregated = new ConcurrentHashMap<>();
    private Map<Integer, List<StackidTime>> pidDataAggregated = new ConcurrentHashMap<Integer, List<StackidTime>>();

    private Map<String, StackFrame> profiles = new ConcurrentHashMap<>();
    private Map<String, Long> eventCounts = new ConcurrentHashMap<>();

    private Map<Integer, List<SFLogContext>> sfrecords = new ConcurrentHashMap();

    private int eventCount = 0;
    private double threshold = 0.01;
    private Long startEpoch = 0L;
    private Long endEpoch = 0L;
    private Long startEpochAggerated = 0L;
    private Long endEpochAggerated = 0L;

    public void setMaxStackDepth(int maxStackDepth) {
        this.maxStackDepth = maxStackDepth;
    }

    private int maxStackDepth = 64;

    private int exceptionCount = 0;

    private enum ThreadState {
        RUNNABLE,
        BLOCKED,
        WAITING,
        TIMED_WAITING,
        UNKNOWN
    }

    public void processMonitorLog(String logfile){
        try (BufferedReader reader = new BufferedReader(new FileReader(logfile))) {
            logger.info("processing file: " + logfile);
            String line;

            List<String> header = new ArrayList<>();

            header.add("timestamp:timestamp");
            header.add("tid:text");
            header.add("CPU:number");
            header.add("threadname:text");
            initializeEvent("processcpu");
            addHeader("processcpu", header);

            // Read each line from the file
            int span = 1;
            while ((line = reader.readLine()) != null) {
                // Split the line into parts using ":" as the separator
                String[] parts = line.split(":");

                if (parts.length >= 4) {
                    if(span < 2) {
                        List<Object> record = new ArrayList<>();
                        record.add(Long.parseLong(parts[0])*1000);
                        record.add(parts[1]);
                        record.add(Double.parseDouble(parts[2]));
                        if (parts[3].length() > 232) {
                            if(parts[3].indexOf("jdk/") != -1){
                                record.add(parts[3].substring(parts[3].indexOf("jdk/"), 200) + ".." + parts[3].substring(parts[3].length() - 30));
                            }else {
                                record.add(parts[3].substring(0, 200) + ".." + parts[3].substring(parts[3].length() - 30));
                            }
                        }else{
                            if(parts[3].indexOf("jdk/") != -1){
                                record.add(parts[3].substring(parts[3].indexOf("jdk/"), parts[3].length()));
                            }else {
                                record.add(parts[3]);
                            }
                        }
                        processContext(record, Integer.parseInt(parts[1]), "processcpu");
                    }
                    //span++;
                    if(span > 6){
                        span = 1;
                    }

                } else {
                    System.err.println("Invalid line format: " + line);
                }
            }
        } catch (IOException e) {
            System.err.println("Error reading file: " + logfile + ":" + e.getMessage());
        }
    }

    public void processContext(List l, int tid, String type) {
        try {
            if (!records.get(type).containsKey(tid)) {
                records.get(type).put(tid, Collections.synchronizedList(new ArrayList<LogContext>()));
            }
            records.get(type).get(tid).add(new LogContext(l));
        }catch(Exception e){
           e.printStackTrace();
        }
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
        threshold = 0.01;
        startEpoch = 0L;
        endEpoch = 0L;
        //sampleCount.clear();
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
        threshold = percentThreshold;
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

        return new JfrParserResponse(profiles.get(type), null, null, new JfrContext(pidDatas.get(type), frames, startEpoch, endEpoch));
    }

    public Object getProfileTree(int filterDepth, String type, boolean experimental) {

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

        Map<String, String> meta = new HashMap<>();
        try {
            if(experimental){
                try {
                    SurfaceDataResponse res = genSurfaceData(profiles.get(type), pidDatas.get(type));
                    //get CPU events if exists
                    for (final String event : header.keySet()) {
                        if (event.equals("CPUEvent")) {
                            List<Long> cpu = res.getCpuSamplesList();
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
                        }
                    }

                    meta.put("data", Utils.toJson(res));
                }catch(Exception e){
                    meta.put("data", "{}");//Utils.toJson(res));
                }

            }else {
                meta.put("data", "{}");//Utils.toJson(res));
            }
        } catch (Exception e) {
            meta.put("exception", Utils.toJson(e));
        }

        frames.put(FILTER_MESSAGE_HASH,"below parsing threshold ...");
        frames.put(WRAP_MESSAGE_HASH, "single stack in profile");
        return new JfrParserResponse(profiles.get(type), null, meta, new JfrContext(pidDatas.get(type), frames, startEpoch, endEpoch));
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
                //final Iterator<StackFrame> chIterator = ch.iterator();
                final ListIterator<StackFrame> chIterator = ch.listIterator();
                boolean check = true;
                while (chIterator.hasNext()) {
                    final StackFrame child = chIterator.next();
                    if (child.getSz() == 1) {
                        //truncate if single stack after maxD
                        filterChild(child, totalSz, maxD, true, depth + 1);
                    } else if( 100.0 *child.getSz()/totalSz < threshold){
                        if(check){
                            check=false;
                            child.nm = FILTER_MESSAGE_HASH;
                            child.setCh(null);
                        }else {
                            chIterator.remove();
                        }
                    }else {
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
            if(fullNm == null){
                fullNm = "unknown";
            }
        } catch (StringIndexOutOfBoundsException e) {
            fullNm = "unknown";
        }
        String methodNm = method.getMethodName();
        if(methodNm == null){
            methodNm = "unknown";
        }
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

    public class DeadlockDetector {
        private final Map<String, List<String>> resourceGraph = new HashMap<>();
        private final Set<String> visited = new HashSet<>();
        private final Set<String> recursionStack = new HashSet<>();
        private List<String> cycleNodes = new ArrayList<>();
        private List<List<String>> deadlockCycles = new ArrayList<>();
        private Set<String> currentCycleSet = new HashSet<>();

        // Add a resource allocation
        public void addResource(String threadId, String resourceId) {
            resourceGraph.putIfAbsent(threadId, new ArrayList<>());
            resourceGraph.get(threadId).add(resourceId);
        }

        // Add a resource request
        public void addRequest(String threadId, String resourceId) {
            resourceGraph.putIfAbsent(resourceId, new ArrayList<>());
            resourceGraph.get(resourceId).add(threadId);
        }

        // Detect deadlocks and return all cycle nodes if found
        public List<List<String>> findDeadlockCycles() {
            String substrate = System.getenv("SUBSTRATE");
            /*if(substrate != null) {//enable dead lock detection  in local
                logger.info("dead lock detection disabled.");
                return deadlockCycles; // Return all deadlock cycles
            }*/
            visited.clear();
            recursionStack.clear();
            deadlockCycles.clear();

            for (String node : resourceGraph.keySet()) {
                currentCycleSet.clear(); // Clear current cycle set for new DFS
                cycleNodes.clear(); // Clear cycle nodes for new search

                if (detectCycle(node)) {
                    // Only add complete cycles to deadlockCycles
                    deadlockCycles.add(new ArrayList<>(cycleNodes));
                }
            }
            return deadlockCycles; // Return all deadlock cycles
        }

        // Helper method to detect cycles using DFS
        private boolean detectCycle(String node) {
            if (!visited.contains(node)) {
                visited.add(node);
                recursionStack.add(node);
                currentCycleSet.add(node); // Track nodes in the current cycle
                cycleNodes.add(node); // Add node to the cycle path

                for (String neighbor : resourceGraph.getOrDefault(node, Collections.emptyList())) {
                    if (!visited.contains(neighbor)) {
                        if (detectCycle(neighbor)) {
                            return true;
                        }
                    } else if (recursionStack.contains(neighbor) && currentCycleSet.contains(neighbor)) {
                        // Cycle detected, include the cycle path up to the neighbor
                        cycleNodes.add(neighbor); // Add neighbor to complete the cycle
                        return true;
                    }
                }
            }

            recursionStack.remove(node);
            currentCycleSet.remove(node); // Remove from current cycle tracking
            if (cycleNodes.contains(node)) {
                cycleNodes.remove(cycleNodes.size() - 1); // Remove node from cycle path on backtrack
            }
            return false;
        }
    }

    private void checkClassLocks(HashSet<String> waits, DeadlockDetector detector, List<String> stacks, int tid, List<MonitorContext> locks, String tname, HashSet<String> classlocks) {
        for (int i = 0; i < stacks.size(); i++) {
            for (String ele : waits) {
                if (stacks.get(i).contains(ele) && i != 0) {
                    if (stacks.get(i - 1).contains("java.lang.reflect.Constructor.newInstance")) {
                        //detector.addResource(Integer.toString(tid), ele);
                        locks.add(new MonitorContext(tid,tname,ele,ele,i,stacks.get(i)));
                        classlocks.add(ele);
                    }
                }
            }
        }
    }

    public boolean processJstackEvent(long time, final String jstack) {
        return processJstackEvent(time,jstack,true);
    }

    public static boolean isNumeric(String str) {
        try {
            Double.parseDouble(str);
            return true;
        } catch(NumberFormatException e){
            return false;
        }
    }

    public boolean processJstackEvent(long time, final String jstack, final boolean includeProfileEvents) {
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
            try {
                //zing [Mon Jul 01 10:32:12 PM UTC 2024]
                String zingDate = jstack.substring(jstack.indexOf("[")+1, jstack.indexOf("]"));
                SimpleDateFormat df = new SimpleDateFormat("E MMM dd HH:mm:ss aa zzz yyyy");
                Date date = df.parse(zingDate);
                //take jstack timestamp if event time is too off ( more than 1 min)
                long diff = Math.abs(time / 1000000 - date.getTime());
                if (diff > 6000) {
                    time = date.getTime() * 1000000;
                }
                System.out.println("Using E MMM dd HH:mm:ss aa zzz yyyy format timestamp ");
            }catch (Exception ex){
                try {
                    //zing [Mon Jul 01 10:32:12 PM UTC 2024]
                    String zingDate = jstack.substring(jstack.indexOf("[")+1, jstack.indexOf("]"));

                    SimpleDateFormat df = new SimpleDateFormat("E MMM dd HH:mm:ss zzz yyyy");
                    Date date = df.parse(zingDate);
                    //take jstack timestamp if event time is too off ( more than 1 min)
                    long diff = Math.abs(time / 1000000 - date.getTime());
                    if (diff > 6000) {
                        time = date.getTime() * 1000000;
                    }
                    System.out.println("Using E MMM dd HH:mm:ss zzz yyyy format timestamp ");
                }catch (Exception exx){
                    return false;
                }
            }
        }

        if (startEpoch == 0L || time < startEpoch) {
            setStartEpoch(time);
        }
        if (time > endEpoch) {
            setEndEpoch(time);
        }

        DeadlockDetector detector = new DeadlockDetector();
        HashSet<String> classwaits = new HashSet<>();
        HashSet<String> classlocks = new HashSet<>();
        final String patternString2 = ".*- waiting on the Class initialization monitor for (.*)|\"(.*)\" #(\\w+) .*\\n";
        final Pattern pattern2 = Pattern.compile(patternString2);
        final Matcher matcher2 = pattern2.matcher(jstack);
        Integer tid = -1;
        String tname = "";
        List<MonitorContext> waits = new ArrayList<>();
        List<MonitorContext> locks = new ArrayList<>();

        while (matcher2.find()) {
            if (matcher2.group(1) != null) {
                classwaits.add(matcher2.group(1));
                detector.addRequest(Integer.toString(tid),matcher2.group(1));
            }else if (matcher2.group(3) != null) {
                tid = Integer.parseInt(matcher2.group(3).toUpperCase());
                tname = matcher2.group(2);
            }
        }

        final Matcher matcher = pattern.matcher(jstack);
        final List<String> stack = new ArrayList<>();
        int sampleCount = 0;
        int tstate = -1;
        tname = "";
        tid = 0;
        final StringBuilder normalized = new StringBuilder();

        final HashSet tmpLocks = new HashSet();
        final HashSet tmpWaits = new HashSet();

        //"at (.*)\\(.*\\n|.*- waiting to lock \<(.*))\>(.*)\\n|.*- locked \<(.*))\>(.*)\\n|\"(.*)\" #(\\w+) .*\\n|.*java.lang.Thread.State: (\\w+).*\\n";
        // "Thread-1" #7661 prio=5 os_prio=0 tid=0x62001de00000 nid=0x161e  [ JVM thread_state=_thread_in_vm, locked by VM (w/poll advisory bit) acquiring VM lock 'java.util.concurrent.ConcurrentHashMap', polling bits: safep ]
        //   java.lang.Thread.State: BLOCKED (on object monitor)
        //- waiting to lock <0x0000080108a7c220> (a java.util.concurrent.ConcurrentHashMap)
        //- locked <0x00000800cfa1f330> (a java.lang.Class)
        // at org.springframework.beans.factory.support.DefaultSingletonBeanRegistry.getSingleton(DefaultSingletonBeanRegistry.java:216)

        while (matcher.find()) {
            //if (tid != -1 && matcher.group(4) != null) {
            if (tid != -1 && matcher.group(1) != null) {
                //if(includeProfileEvents) {
                    normalized.setLength(0);
                    Utils.normalizeFrame(matcher.group(1), normalized, 0);
                    stack.add(normalized.toString());
                //}
            } else if (matcher.group(8) != null) {
                if (stack.size() != 0 && tid != -1) {
                    sampleCount++;
                    //processEvent(tid, (int) ((time - startEpoch) / 1000000), tstate + ";" + tname, stack, "Jstack");
                    if(includeProfileEvents) {
                        checkClassLocks(classwaits, detector, stack, tid,locks,tname,classlocks);
                        processEvent(tid, time, tstate + ";" + tname, stack, "Jstack");
                    }
                    tid = -1;
                    tname = "";
                    stack.clear();
                    tmpLocks.clear();
                    tmpWaits.clear();
                }
                tstate = getThreadState(matcher.group(8)).ordinal();
            } else if (matcher.group(6) != null) {
                //process previous stack
                if (stack.size() != 0) {
                    sampleCount++;
                    if(includeProfileEvents) {
                        //processEvent(tid, (int) ((time - startEpoch) / 1000000), tstate + ";" + tname, stack, "Jstack");
                        checkClassLocks(classwaits, detector, stack, tid,locks,tname,classlocks);
                        processEvent(tid, time, tstate + ";" + tname, stack, "Jstack");
                    }
                    stack.clear();
                    tmpLocks.clear();
                    tmpWaits.clear();
                    tid = -1;
                    tname = "";
                    tstate = -1;
                }
                tid = Integer.parseInt(matcher.group(7).toUpperCase());
                tname = matcher.group(6);
            } else if(matcher.group(2) != null){
                if(!tmpWaits.contains(matcher.group(2))) {
                    //detector.addRequest(Integer.toString(tid),matcher.group(2));
                    waits.add(new MonitorContext(tid, tname, matcher.group(2), matcher.group(3), stack.size(), stack.get(stack.size() - 1)));
                    tmpWaits.add(matcher.group(2));
                }
                //System.out.println(time + "wait :" + tid + ":" + tname + ":" + matcher.group(2) + ":" + matcher.group(3));
            }else if(matcher.group(4) != null){
                if(!tmpLocks.contains(matcher.group(4))) {
                    //detector.addResource(Integer.toString(tid), matcher.group(4));
                    locks.add(new MonitorContext(tid, tname, matcher.group(4), matcher.group(5), stack.size(), stack.get(stack.size() - 1)));
                    tmpLocks.add(matcher.group(4));
                }
                //System.out.println(time + "lock :" + tid + ":" + tname + ":" + matcher.group(4) + ":" + matcher.group(5) );
            }else if(matcher.group(9) != null){
                break;
            }else if(matcher.group(10) != null){
                if(!tmpWaits.contains(matcher.group(10))) {
                    //detector.addRequest(Integer.toString(tid),matcher.group(10));
                    waits.add(new MonitorContext(tid, tname, matcher.group(10), matcher.group(10), stack.size(), "na"));
                    tmpWaits.add(matcher.group(10));
                }
                //System.out.println(time + "wait :" + tid + ":" + tname + ":" + matcher.group(2) + ":" + matcher.group(3));
            }
        }
        //handle left over stack
        if (stack.size() != 0 && tid != -1) {
            //processEvent(tid, (int) ((time - startEpoch) / 1000000), tstate + ";" + tname, stack, "Jstack");
            if(includeProfileEvents) {
                checkClassLocks(classwaits, detector, stack, tid,locks,tname,classlocks);
                processEvent(tid, time, tstate + ";" + tname, stack, "Jstack");
            }
        }
        final int startIndex = jstack.lastIndexOf("Java stack information for the threads listed above");
        final int endIndex = jstack.lastIndexOf("Found");

        HashMap<Integer, String> allDeadLocks = new HashMap<>();
        HashSet<String> deadlocks =  new HashSet<>();
        for(int i = 0; i<locks.size();i++) {
            String lock = locks.get(i).getLock();
            boolean isContention = false;
            for (int j = 0; j < waits.size(); j++) {
                if (lock.equals(waits.get(j).getLock())) {
                    detector.addRequest(Integer.toString(waits.get(j).getTid()),waits.get(j).getLock());
                    isContention=true;
                }
            }
            if(isContention){
                detector.addResource(Integer.toString(locks.get(i).getTid()),locks.get(i).getLock());
            }
        }
        List<List<String>> deadlockCycles = detector.findDeadlockCycles();
        if (!deadlockCycles.isEmpty()) {
            System.out.println("Deadlocks detected!");

            for (List<String> cycle : deadlockCycles) {
                String curLock = "";
                HashSet<Integer> tmpTids = new HashSet<>();
                for(int i = 0; i<cycle.size()-1;i++){
                    int tmptid = 0;
                    String tmplock = "";
                    if (isNumeric(cycle.get(i))) {
                        if (i + 1 < cycle.size()) {
                            tmptid = Integer.parseInt(cycle.get(i));
                            tmplock = cycle.get(i + 1);
                        }
                    } else {
                        tmptid = Integer.parseInt(cycle.get(i + 1));
                        tmplock = cycle.get(i);
                    }
                    deadlocks.add(tmplock);
                    for(int j = 0; j<locks.size();j++) {
                        if(locks.get(j).getLock().equals(tmplock) && locks.get(j).getTid() == tmptid) {
                            if(classlocks.contains(locks.get(j).getLock())) {
                                curLock += "class init pending tid:" + locks.get(j).getTid() + " lock:" + locks.get(j).getLock() + " frame:" + locks.get(j).getFrame() + "\n";
                                System.out.println("class init pending tid:" + locks.get(j).getTid() + " lock:" + locks.get(j).getLock() + " frame:" + locks.get(j).getFrame());
                            }else{
                                curLock += "locked tid:" + locks.get(j).getTid() + " lock:" + locks.get(j).getLock() + " frame:" + locks.get(j).getFrame() + "\n";
                                System.out.println("locked tid:" + locks.get(j).getTid() + " lock:" + locks.get(j).getLock() + " frame:" + locks.get(j).getFrame());
                            }
                        }
                    }
                    for(int j = 0; j<waits.size();j++) {
                        if(waits.get(j).getLock().equals(tmplock) && waits.get(j).getTid() == tmptid) {
                            if(classwaits.contains(waits.get(j).getLock())) {
                                curLock += "wait on the class tid:" + waits.get(j).getTid() + " lock:" + waits.get(j).getLock() + " frame:" + waits.get(j).getFrame() + "\n";
                                System.out.println("wait on the class tid:" + waits.get(j).getTid() + " lock:" + waits.get(j).getLock() + " frame:" + waits.get(j).getFrame());
                            }else{
                                curLock += "waiting to lock tid:" + waits.get(j).getTid() + " lock:" + waits.get(j).getLock() + " frame:" + waits.get(j).getFrame() + "\n";
                                System.out.println("waiting to lock tid:" + waits.get(j).getTid() + " lock:" + waits.get(j).getLock() + " frame:" + waits.get(j).getFrame());
                            }
                        }
                    }
                    tmpTids.add(tmptid);
                }
                curLock = "Deadlock:" + cycle.toString() + "\n" + curLock;
                String stackString = "";
                for (Integer t : tmpTids) {
                    stackString += getLockStack(t, jstack) + "\n\n";
                }
                for (Integer t : tmpTids) {
                    allDeadLocks.put(t,curLock+"\n\nThread stask(s):\n"+stackString);
                }
                System.out.println(curLock);
            }
        } else {
            System.out.println("No deadlock.");
        }

        if (sampleCount > 0|| !includeProfileEvents) {
            List<String> header = new ArrayList<>();
            header.add("timestamp:timestamp");
            header.add("tidGotLock:text");
            header.add("threadnameGotLock:text");
            header.add("lock:text");
            header.add("Object:text");
            header.add("frameGotLock:text");
            header.add("waitcount:number");
            header.add("lockcount:number");
            header.add("isDeadlock:text");
            header.add("lockDetails:text");
            header.add("waitTids:text");
            initializeEvent("monitor-context");
            addHeader("monitor-context", header);

            for(int i = 0; i<locks.size();i++){
                String lock = locks.get(i).getLock();
                List<Integer> l = new ArrayList<>();
                List<Integer> w = new ArrayList<>();
                l.add(locks.get(i).getPos());
                for(int j=0; j<waits.size();j++){
                    if(lock.equals(waits.get(j).getLock())){
                        l.add(waits.get(j).getTid());
                        l.add(waits.get(j).getPos());
                    }
                }
                if(l.size() > 1 || deadlocks.contains(lock)){//monitor contention
                    List<Object> record = new ArrayList<>();
                    record.add(time/1000000);
                    record.add(locks.get(i).getTid());
                    record.add(locks.get(i).getTname());
                    record.add(lock);
                    record.add(locks.get(i).getCls());
                    record.add(locks.get(i).getFrame());
                    record.add((l.size()-1)/2);
                    record.add(1);
                    if(allDeadLocks.containsKey(locks.get(i).getTid())){
                        record.add("true");
                    }else{
                        record.add("false");
                    }
                    if(allDeadLocks.containsKey(locks.get(i).getTid())) {
                        record.add(l.toString() + "\n\n" + allDeadLocks.get(locks.get(i).getTid()));
                    }else{
                        record.add(l.toString());
                    }
                    processContext(record, locks.get(i).getTid(), "monitor-context");
                }
            }
            return true;
        } else {
            return false;
        }
    }
    private String getLockStack(Integer tid, String jstack){
        int i = jstack.indexOf("#"+Integer.toString(tid));

        int tmp = i;
        while(tmp >= 0){
            tmp--;
            if(jstack.charAt(tmp) == '\n'){
                tmp++;
                break;
            }
        }
        int j = jstack.indexOf("\n\n",i);
        return jstack.substring(tmp, j);
    }

    class MonitorContext{
        public int getTid() {
            return tid;
        }

        public String getTname() {
            return tname;
        }

        public String getLock() {
            return lock;
        }

        public String getCls() {
            return cls;
        }

        public int getPos() {
            return pos;
        }

        int tid;
        String tname;
        String lock;
        String cls;
        int pos;

        public String getFrame() {
            return frame;
        }

        String frame;
        MonitorContext(int tid, String tname, String lock, String cls, int pos, String frame){
            this.cls=cls;
            this.lock=lock;
            this.tid=tid;
            this.tname=tname;
            this.pos=pos;
            this.frame=frame;
        }
    }

    private int getHash(int hash, final StringBuilder stringBuilder, final IMCStackTrace stackTrace) {
        try {
//            int hash = 0; //toddo, check if it causes any collisions due to int instead of long
            for (int i = 0; i < stackTrace.getFrames().size(); i++) {
                hash = CustomHash(hash, getFrameNm(stringBuilder, stackTrace.getFrames().get(i)));
            }
            return hash;
        }catch (Exception e){
            throw e;
        }
    }

    public void processEvent(final StringBuilder sb, final IMCStackTrace stackTrace, String type, int tid, long time, long weight, String cls) {
        if (startEpoch == 0L || time < startEpoch) {
            setStartEpoch(time);
        }
        if (time > endEpoch) {
            setEndEpoch(time);
        }
        StackFrame frame = profiles.get(type);
        final int hash = getHash(cls == null ? 0 : cls.hashCode(), sb, stackTrace);

        long sz = weight;
        if (!pidDatas.get(type).containsKey(tid)) {
            pidDatas.get(type).put(tid, new ArrayList<StackidTime>());
        }
        pidDatas.get(type).get(tid).add(new StackidTime(hash, time));

        //if (sampleCount.containsKey(hash)) {
        //    sz = sampleCount.get(hash);
        //    frame = profiles.get(type);
        //}

        if (!eventCounts.containsKey(type)) {
            eventCounts.put(type, weight);
        } else {
            eventCounts.put(type, eventCounts.get(type) + weight);
        }

        if (sz >= 0) {
            frame.sz += sz;
            long sf = 0;
            int count = stackTrace.getFrames().size();
            if(cls == null) {
                for (int i = 0; i < count; i++) {

                    if(i>=maxStackDepth){
                        i = count-1; //skip other frames
                        frame = frame.addFrame("...".hashCode(), sz, sf, false, 0);
                    }

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
            }else{
                frame = frame.addFrame(cls.hashCode(), sz, sf, true, hash);
                if(!frames.containsKey(cls.hashCode())) {
                    frames.put(cls.hashCode(), cls);
                }
                for (int i = 0; i < count; i++) {

                    if(i>=maxStackDepth){
                        i = count-1; //skip other frames
                        frame = frame.addFrame("...".hashCode(), sz, sf, false, 0);
                    }

                    final int fN = getFrameNm(sb, stackTrace.getFrames().get(i));

                    if (i == count - 1) {
                        sf = sz;
                    }
                    if (i == count - 1) {
                        frame = frame.addFrame(fN, sz, sf, true, hash);
                    } else {
                        frame = frame.addFrame(fN, sz, sf, false, 0);
                    }
                }
            }
        }
    }

    public void processMemoryEvent(final StringBuilder sb, final IMCStackTrace stackTrace, String type, int tid, long time, long weight, String cls) {
        if (startEpoch == 0L || time < startEpoch) {
            setStartEpoch(time);
        }
        if (time > endEpoch) {
            setEndEpoch(time);
        }
        StackFrame frame = profiles.get(type);
        final int hash = getHash(cls == null ? 0 : cls.hashCode(), sb, stackTrace);

        long sz = weight;
        if (!pidDatas.get(type).containsKey(tid)) {
            pidDatas.get(type).put(tid, new ArrayList<StackidTime>());
        }
        pidDatas.get(type).get(tid).add(new StackidTime(hash, time));

        //if (sampleCount.containsKey(hash)) {
        //    sz = sampleCount.get(hash);
        //    frame = profiles.get(type);
        //}

        if (!eventCounts.containsKey(type)) {
            eventCounts.put(type, weight);
        } else {
            eventCounts.put(type, eventCounts.get(type) + weight);
        }

        if (sz >= 0) {
            frame.sz += sz;
            long sf = 0;
            int count = stackTrace.getFrames().size();
            if(cls == null) {
                for (int i = 0; i < count; i++) {

                    if(i>=maxStackDepth){
                        i = count-1; //skip other frames
                        frame = frame.addFrame("...".hashCode(), sz, sf, false, 0);
                    }

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
            }else{
                frame = frame.addFrame(cls.hashCode(), sz, sf, true, hash);
                if(!frames.containsKey(cls.hashCode())) {
                    frames.put(cls.hashCode(), cls);
                }
                int prevFn = -1;
                final Map<Integer, Integer> occuranceCount = new HashMap<>();
                for (int i = 0; i < count; i++) {
                    int fN;
                    try {
                        if (i == count - 1) {
                            //if (i == count - 1 || sz < threshold) {
                            fN = getPackageNm(stackTrace.getFrames().get(i), sb, occuranceCount);
                        } else if (i < 8 ) {
                            fN = getFrameNm(sb, stackTrace.getFrames().get(i));
                        } else if (i < 48) {
                            fN = getFrameClassNm(stackTrace.getFrames().get(i), sb, occuranceCount);
                        } else {
                            fN = getPackageNm(stackTrace.getFrames().get(i), sb, occuranceCount);
                        }
                    } catch (NullPointerException e) {
                        if (exceptionCount == 0) {
                            System.out.println("Warning: processMemoryEvent NullPointerException");
                            e.printStackTrace(System.out);
                        }
                        exceptionCount++;
                        continue; //Sometimes package name is null
                    }
                    if(fN == jetty){
                        i=count-1;
                    }
                    //if(sz < threshold || !(i < 8 || i != (count - 1))) {
                    if( !(i < 8 || i != (count - 1))) {
                        if (occuranceCount.size() > 0 && occuranceCount.containsKey(fN) && occuranceCount.get(fN) > 1) {
                            continue;
                        }
                    }

                    if (prevFn == -1 || prevFn != fN) {
                        prevFn = fN;
                        if (i == (count - 1)) {
                            sf = sz;
                            frame = frame.addFrame(fN, sz, sf, true, hash);
                        } else {
                            frame = frame.addFrame(fN, sz, sf, false, 0);
                        }
                    }
                }
            }
        }
    }

    private final int jetty = "org.eclipse.jetty".hashCode();

    private int getPackageNm(final IMCFrame frame, final StringBuilder stringBuilder, final Map<Integer, Integer> occuranceCount) {
        String name = frame.getMethod().getType().getPackage().getName();
        if(name == null){
            name = "NA";
        }
        stringBuilder.setLength(0);
        if (Utils.trimAfterNthMatchingCharacter(name, stringBuilder, 3, '.')) {
            name = stringBuilder.toString();
        }
        if(name.startsWith("org.eclipse.jetty")){
            if (!frames.containsKey(jetty)) {
                frames.put(jetty, "org.eclipse.jetty");
            }
            return jetty;
        }
        int hash = name.hashCode();
        //if (occuranceCount.size() > 0 || (name.contains("jetty") || name.contains("eclipse"))) {
        if (occuranceCount.containsKey(hash)) {
            occuranceCount.put(hash, occuranceCount.get(hash) + 1);
        } else {
            occuranceCount.put(hash, 1);
            if (!frames.containsKey(hash)) {
                frames.put(hash, name);
            }
        }
        //}
        return hash;
    }

    private int getFrameClassNm(final IMCFrame frame, final StringBuilder stringBuilder,  final Map<Integer, Integer> occuranceCount) {
        final IMCMethod method = frame.getMethod();
        String fullNm = null;
        try {
            fullNm = method.getType().getFullName();
        } catch (StringIndexOutOfBoundsException e) {
            fullNm = "unknown";
        }
        if(fullNm.startsWith("org.eclipse.jetty")){
            if (!frames.containsKey(jetty)) {
                frames.put(jetty, "org.eclipse.jetty");
            }
            return jetty;
        }
        final String methodNm = method.getMethodName();
        int hash = CustomHash(0,fullNm.hashCode());
        if (!frames.containsKey(hash)) {
            stringBuilder.setLength(0);
            if (Utils.normalizeFrame(fullNm, stringBuilder, 0)) {
                String nm = stringBuilder.toString();
                hash = CustomHash(0,nm.hashCode());
                if (!frames.containsKey(hash)) {
                    frames.put(hash, nm);
                }
            } else {
                frames.put(hash, fullNm);
            }
        }
        if (occuranceCount.containsKey(hash)) {
            occuranceCount.put(hash, occuranceCount.get(hash) + 1);
        } else {
            occuranceCount.put(hash, 1);
        }
        return hash;
    }

    public void processEvent(final int tid, final long time, final String ctx, final List<String> stackTrace, String type) {
        final int hash = getHash(stackTrace);
        if (!pidDatas.get(type).containsKey(tid)) {
            pidDatas.get(type).put(tid, new ArrayList<StackidTime>());
        }
        pidDatas.get(type).get(tid).add(new StackidTime(hash, time, ctx));
        StackFrame frame = profiles.get(type);
        int sz = 1;

        if (!eventCounts.containsKey(type)) {
            eventCounts.put(type, 1L);
        } else {
            eventCounts.put(type, eventCounts.get(type) + 1);
        }

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
        if(!header.containsKey(type)) {
            header.put(type, l);
        }
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
    public void aggregatePS(final String psOutput, final Long timestamp) throws IOException {

        int topCount = 11;
        // Split the input into lines
        String[] lines = psOutput.split("\n");

        if (lines.length < 2) {
            System.out.println("Invalid ps output format");
        }

        //PID  PPID   LWP NLWP    VSZ   RSS %MEM %CPU  MAJFL  MINFL CMD
        List<String> header = new ArrayList<>();
        header.add("timestamp:timestamp");
        header.add("tid:text");
        header.add("ppid:text");
        header.add("RSS:number");
        header.add("%CPU:number");
        header.add("%MEM:number");
        header.add("COMMAND:text");
        initializeEvent("ps-processes");
        addHeader("ps-processes", header);


        // Regular expression to match process information based on the number of columns
        String processInfoPattern = "^\\s{0,}(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+([\\d.]+)\\s+([\\d.]+)\\s+(\\d+)\\s+(\\d+)\\s+(.*)$";

        // Pattern and Matcher for process information
        Pattern processPattern = Pattern.compile(processInfoPattern);
        for (int i = 1; i < lines.length; i++) {
            Matcher processMatcher = processPattern.matcher(lines[i].trim());
            if (processMatcher.matches()) {
                List<Object> record = new ArrayList<>();
                record.add(timestamp);//timestamp
                int tid = Integer.parseInt(processMatcher.group(1));
                record.add(processMatcher.group(1));//tid
                record.add(processMatcher.group(2));//ppid
                record.add(Long.parseLong(processMatcher.group(6)));//rss
                record.add(Double.parseDouble(processMatcher.group(7)));//cpu
                record.add(Double.parseDouble(processMatcher.group(8)));//mem
                String cmd = processMatcher.group(11);//cmd
                cmd.trim();
                int index = cmd.indexOf("jdk/");
                if (cmd.length() > 232) {
                    if(index != -1){
                        int index1 = cmd.indexOf("/java");
                        record.add(cmd.substring(index,index1+5) + "..." + cmd.substring(cmd.length() - 30));
                    }else {
                        record.add(cmd.substring(0, 100) + "..." + cmd.substring(cmd.length() - 30));
                    }
                }else{
                    if(index != -1){
                        record.add(cmd.substring(cmd.indexOf("jdk/"), cmd.length()));
                    }else {
                        record.add(cmd);
                    }
                }
                processContext(record, tid, "ps-processes");
            }
        }
        System.out.println("aggregatePS");
    }
    public void aggregatePIDSTAT(final String pidstatOutput, final Long timestamp) throws IOException {
        // Split the input into lines
        String[] lines = pidstatOutput.split("\n");
        if (lines.length < 2) {
            System.out.println("Invalid ps output format");
        }
        //PID  PPID   LWP NLWP    VSZ   RSS %MEM %CPU  MAJFL  MINFL CMD
        List<String> header = new ArrayList<>();
        header.add("timestamp:timestamp");
        header.add("tgid:text");
        header.add("tid:text");
        header.add("user%:number");
        header.add("system%:number");
        header.add("%CPU:number");
        header.add("CPU:number");
        header.add("RSS:number");
        header.add("%MEM:number");
        header.add("COMMAND:text");
        initializeEvent("pidstat-extract");
        addHeader("pidstat-extract", header);
        //#Time   UID      TGID(2)       TID(3)    %usr %system  %guest    %CPU(7)   CPU  minflt/s  majflt/s     VSZ    RSS(12)   %MEM(13)   kB_rd/s   kB_wr/s kB_ccwr/s   cswch/s nvcswch/s  Command(19)
        for (int i = 3; i < lines.length; i++) {
            List<Object> record = new ArrayList<>();
            String[] parts = lines[i].trim().split("\\s+");
            if(parts.length > 10){
                int tid = Integer.parseInt(parts[3]);
                try {
                    record.add(Long.parseLong(parts[0])*1000);
                    record.add(Integer.parseInt(parts[2]));
                    record.add(tid);//tid
                    record.add(Double.parseDouble(parts[4]));
                    record.add(Double.parseDouble(parts[5]));
                    record.add(Double.parseDouble(parts[7]));
                    record.add(Integer.parseInt(parts[8]));
                    record.add(Long.parseLong(parts[12]));
                    record.add(Double.parseDouble(parts[13]));
                    record.add(parts[19]);
                }catch (Exception e){
                    System.out.println("check");
                }
                processContext(record, tid, "pidstat-extract");
            }
        }
        System.out.println("aggregatePS");
    }

    public void aggregateTop(final String topOutput, final Long timestamp) throws IOException {
        String[] sections = topOutput.split("\n\n");
        if (sections.length >= 1) {
            // Process host-level metrics
            String hostMetrics = sections[0];
            parseTopHostMetrics(hostMetrics, timestamp);
        }
        if (sections.length >= 2) {
            // Process individual process details
            String processDetails = sections[1];
            parseTopProcessDetails(processDetails, timestamp);
        }
    }

    public void parseTopHostMetrics(final String hostMetrics, final Long timestamp){
// Regular expressions to match host-level metrics
        String loadAvgPattern = "load average: ([\\d.]+), ([\\d.]+), ([\\d.]+)";
        String taskInfoPattern = "Tasks: (\\d+) total,\\s{0,}(\\d+) running,\\s{0,}(\\d+) sleeping,\\s{0,}(\\d+) stopped,\\s{0,}(\\d+) zombie";
        String cpuUsagePattern = "%Cpu\\(s\\): ([\\d.]+) us,\\s{0,}([\\d.]+) sy,\\s{0,}([\\d.]+) ni,\\s{0,}([\\d.]+) id,\\s{0,}([\\d.]+) wa,\\s{0,}([\\d.]+) hi,\\s{0,}([\\d.]+) si,\\s{0,}([\\d.]+) st";
        String memInfoPattern = "KiB\\s{0,}Mem\\s{0,}:\\s{0,}(\\d+\\+?)\\s{0,}total,\\s{0,}(\\d+)\\s{0,}free,\\s{0,}(\\d+)\\s{0,}used,\\s{0,}(\\d+)\\s{0,}buff/cache";
        String swapInfoPattern = "KiB Swap:\\s{0,}(\\d+)\\s{0,}total,\\s{0,}(\\d+)\\s{0,}free,\\s{0,}(\\d+)\\s{0,}used";

        // Pattern and Matcher for host-level metrics
        Pattern loadAvgPatternRegex = Pattern.compile(loadAvgPattern);
        Pattern taskInfoPatternRegex = Pattern.compile(taskInfoPattern);
        Pattern cpuUsagePatternRegex = Pattern.compile(cpuUsagePattern);
        Pattern memInfoPatternRegex = Pattern.compile(memInfoPattern);
        Pattern swapInfoPatternRegex = Pattern.compile(swapInfoPattern);

        // Matcher for host-level metrics
        Matcher loadAvgMatcher = loadAvgPatternRegex.matcher(hostMetrics);
        Matcher taskInfoMatcher = taskInfoPatternRegex.matcher(hostMetrics);
        Matcher cpuUsageMatcher = cpuUsagePatternRegex.matcher(hostMetrics);
        Matcher memInfoMatcher = memInfoPatternRegex.matcher(hostMetrics);
        Matcher swapInfoMatcher = swapInfoPatternRegex.matcher(hostMetrics);

        List<String> header = new ArrayList<>();
        header.add("timestamp:timestamp");
        header.add("tid:text");
        header.add("monitor:text");
        header.add("LoadAvg1min:number");
        header.add("LoadAvg5min:number");
        header.add("LoadAvg15min:number");

        /*
        header.add("TotalTasks:number");
        header.add("RunningTasks:number");
        header.add("SleepingTasks:number");
        header.add("StoppedTasks:number");
        header.add("ZombieTasks:number");*/

        header.add("UserCPU:number");
        header.add("SystemCPU:number");
        header.add("Nice:number");
        header.add("IdleCPU:number");
        header.add("I/O wait:number");
        /*header.add("Hardware interrupt:number");
        header.add("Software interrupt:number");
        header.add("Steal:number");*/

        /*header.add("TotalMem:number");
        header.add("FreeMem:number");
        header.add("UsedMem:number");
        header.add("Buffer/Cache:number");*/

        /*header.add("TotalSwap:number");
        header.add("FreeSwap:number");
        header.add("UsedSwap:number");*/

        initializeEvent("top-hostmetrics");
        addHeader("top-hostmetrics", header);

        List<Object> record = new ArrayList<>();
        record.add(timestamp);//timestamp
        record.add("top-hostmetrics".hashCode());//tid
        record.add("top-hostmetrics");//tid

        // Find and display host-level metrics
        if (loadAvgMatcher.find()) {
            record.add(Double.parseDouble(loadAvgMatcher.group(1)));
            record.add(Double.parseDouble(loadAvgMatcher.group(2)));
            record.add(Double.parseDouble(loadAvgMatcher.group(3)));
        }

        if (taskInfoMatcher.find() && false) {
            record.add(Integer.parseInt(taskInfoMatcher.group(1)));
            record.add(Integer.parseInt(taskInfoMatcher.group(2)));
            record.add(Integer.parseInt(taskInfoMatcher.group(3)));
            record.add(Integer.parseInt(taskInfoMatcher.group(4)));
            record.add(Integer.parseInt(taskInfoMatcher.group(5)));
        }

        if (cpuUsageMatcher.find()) {
            record.add(Double.parseDouble(cpuUsageMatcher.group(1)));
            record.add(Double.parseDouble(cpuUsageMatcher.group(2)));
            record.add(Double.parseDouble(cpuUsageMatcher.group(3)));
            record.add(Double.parseDouble(cpuUsageMatcher.group(4)));
            record.add(Double.parseDouble(cpuUsageMatcher.group(5)));
            //record.add(Double.parseDouble(cpuUsageMatcher.group(6)));
            //record.add(Double.parseDouble(cpuUsageMatcher.group(7)));
            //record.add(Double.parseDouble(cpuUsageMatcher.group(8)));
        }

        if (memInfoMatcher.find() && false) {
            record.add(memInfoMatcher.group(1));
            record.add(memInfoMatcher.group(2));
            record.add(memInfoMatcher.group(3));
            record.add(memInfoMatcher.group(4));
        }

        if (swapInfoMatcher.find() && false) {
            record.add(swapInfoMatcher.group(1));
            record.add(swapInfoMatcher.group(2));
            record.add(swapInfoMatcher.group(3));
        }
        processContext(record, "top-hostmetrics".hashCode(), "top-hostmetrics");
        System.out.println("parseTopHostMetrics");
    }
    public void parseTopProcessDetails(final String processDetails, final Long timestamp){
        List<String> parsedProcesses = new ArrayList<>();
        int topCount = 11;
        // Split the input into lines
        String[] lines = processDetails.split("\n");

        if (lines.length < 2) {
            System.out.println("Invalid top output format");
            return;
        }

        List<String> header = new ArrayList<>();
        header.add("timestamp:timestamp");
        header.add("tid:text");
        header.add("user:text");
        header.add("cpu:number");
        header.add("memory:number");
        header.add("time:text");
        header.add("command:text");
        initializeEvent("top-processes");
        addHeader("top-processes", header);

        for (int i = 1; i < topCount; i++) {
            String[] tokens = lines[i].trim().split("\\s+");
            List<Object> record = new ArrayList<>();
            record.add(timestamp);//timestamp
            record.add(Integer.parseInt(tokens[0]));//tid
            record.add(tokens[1]);//user
            record.add(Double.parseDouble(tokens[8]));//cpu
            record.add(Double.parseDouble(tokens[9]));//memory
            record.add(tokens[10]);//time

            int index = lines[i].indexOf("jdk/");
            if(index != -1){
                tokens[11] =  lines[i].substring( index,  lines[i].length());
                if(tokens[11].length() > 100) {
                    record.add(tokens[11].substring(0, 100) + "...");
                }else{
                    record.add(tokens[11]);
                }
            }else{
                record.add(tokens[11] + " ... " + tokens[tokens.length - 1]);
            }

            processContext(record, Integer.parseInt(tokens[0]), "top-processes");
        }
        System.out.println("parseTopProcessDetails");
    }


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

        public void setSz(long sz) {
            this.sz = sz;
        }

        public void setSf(long sf) {
            this.sf = sf;
        }

        int nm;
        long sz = 0;

        public long getSf() {
            return sf;
        }

        long sf = 0;
        List<StackFrame> ch = null;
        transient Map<Integer, StackFrame> chMap = new HashMap<>(1);
        transient Map<Integer, Integer> sm = new HashMap<>(1);//to tell a stack start and end in tree

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

        public StackFrame addFrame(final int frameNm, final long sz, final long sf, final boolean start, final int hash) {
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

        public long getSz() {
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
    private final Map<String, Long> uniquePathsSize = new HashMap<>();
    private boolean useTimeSeries = true;
    private long totalSize = 0;
    private Map<String, Integer> chunkSurfaceData = new ConcurrentHashMap<>();

    class SurfaceDataResponse {
        private List cpuSamplesList;
        private List<Integer> chunkSamplesTotalList;
        private List<String> pathList = new ArrayList<String>();
        private List<Long> pathSizeList = new ArrayList<Long>();
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

        public List<Long> getPathSizeList() {
            return pathSizeList;
        }

        public void setPathSizeList(List<Long> pathSizeList) {
            this.pathSizeList = pathSizeList;
        }

        public Map<Integer, List<Integer>> getData() {
            return data;
        }

        public void setData(Map<Integer, List<Integer>> data) {
            this.data = data;
        }
    }

    public SurfaceDataResponse genSurfaceData(final StackFrame source, Map<Integer, List<StackidTime>> tidMap) throws IOException {
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

        List<timeSeries> ts = getCPUTimeSeries(contextStart, contextEnd);
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
                List<StackidTime> list = tidMap.get(tid);
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
                executorService.execute(new GetSurfaceData(source, stackid, stackMap.get(stackid)));
            }
            executorService.shutdown();
            try {
                executorService.awaitTermination(600, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                System.out.println(e);
            }

            /*for (Integer stackid : stackMap.keySet()) {
                chunkSamplesTotal = chunkSamplesTotal + stackMap.get(stackid);
                getSurfaceData(source,stackid,stackMap.get(stackid));
            }*/

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

        return new SurfaceDataResponse(cpuSamplesList, chunkSamplesTotalList, surfaceData);

    }

    private void getSurfaceData(final StackFrame tree, int stackid, int size) {

        if (tree.getSm().containsKey(stackid) && tree.getCh() != null && tree.getCh().size() > tree.getSm().get(stackid)) {
            final StackFrame baseJsonTree = tree.getCh().get(tree.getSm().get(stackid));
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
        final StackFrame tree;
        int stackid;
        int size;

        GetSurfaceData(final StackFrame tree, int stackid, int size) {
            this.tree = tree;
            this.stackid = stackid;
            this.size = size;
        }

        @Override
        public void run() {
            getSurfaceData(tree, stackid, size);
        }
    }

    private boolean addStackSurfaceData(final StackFrame tree, final List<Integer> list, int stackid, int size, boolean flag) {
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

    public void getAllPaths(final StackFrame baseJsonTree, final List<Integer> list) {
        if (baseJsonTree.getCh() == null) {
            if (baseJsonTree.getSz() > 0 ) { //do it for all counts
                try {
                    Map.Entry<Integer, Integer> entry = baseJsonTree.getSm().entrySet().iterator().next();
                }catch (Exception e){
                    return;//check this, todo
                    //e.printStackTrace();
                }
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

    private List<timeSeries> getCPUTimeSeries(long start, long end) {
        int columnCount = 0;
        try {

            List<timeSeries> ts = new ArrayList<>();
            for (int i = 0; i < columnCount; i++) {
                ts.add(new timeSeries(0L, 0d));
            }
            return ts;
        } catch (Exception e) {

        }
        return null;
    }


    public static class SFContextResponse {
        public Map<Integer, List<SFLogContext>> records; //map of pid and List where list is log context entries
        public List<Entry> tidlist; // list of entry where entry is a map of k=pid and v=runtime in descending order

        SFContextResponse() {

        }

        SFContextResponse(final Map<Integer, List<SFLogContext>> records, final List<Entry> tidlist) {
            this.records = records;
            this.tidlist = tidlist;
        }

        public Map<Integer, List<SFLogContext>> getRecords() {
            return records;
        }

        public List<Entry> getTidlist() {
            return tidlist;
        }

        public void setRecords(final Map<Integer, List<SFLogContext>> records) {
            this.records = records;
        }

        public void setTidlist(final List<Entry> tidlist) {
            this.tidlist = tidlist;
        }
    }
    public static class SFLogContext {
        public List<Object> getRecord() {
            return record;
        }
        public void setRecord(List<Object> record) {
            this.record = record;
        }
        List<Object> record = new ArrayList<>();
        SFLogContext() {
        }
    }
    public void aggregateSFLogContext(final SFContextResponse res) throws IOException {

        if (this.sfrecords == null) {
            sfrecords = res.records;
        } else {
            for (final Integer key : res.records.keySet()) {
                if (this.sfrecords.containsKey(key)) {
                    final List<SFLogContext> list = this.sfrecords.get(key);
                    for (final SFLogContext lc : res.records.get(key)) {
                        list.add(lc);
                    }
                } else {
                    this.sfrecords.put(key, res.records.get(key));
                }
            }
        }
    }
    public Object getSFLogContext() {
        final Map<Integer, Long> tidMap = new HashMap<>();
        int cpu = 0;
        int pid = 0;
        int type = 0;
        for (final Integer key : this.sfrecords.keySet()) {
            final List<SFLogContext> list = this.sfrecords.get(key);
            for (final SFLogContext lc : list) {
                type = (Integer) lc.record.get(0);
                //include only context log types
                if (type == EventType.CONTEXT.ordinal()) {
                    cpu = (Integer) lc.record.get(7);
                    pid = (Integer) lc.record.get(2);
                    if (tidMap.containsKey(pid)) {
                        tidMap.put(pid, cpu + tidMap.get(pid));
                    } else {
                        tidMap.put(pid, (long) cpu);
                    }
                }
            }
        }
        return new SFContextResponse(sfrecords, sortMap(tidMap));
    }
}

