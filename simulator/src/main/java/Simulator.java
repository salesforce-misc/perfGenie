/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import com.sun.management.OperatingSystemMXBean;
import org.apache.commons.cli.*;

import javax.tools.*;
import java.io.*;
import java.lang.management.ManagementFactory;
import java.lang.reflect.Method;
import java.net.InetAddress;
import java.net.URL;
import java.net.URLClassLoader;
import java.net.UnknownHostException;
import java.util.*;
import java.util.stream.Collectors;

public class Simulator extends Thread {
    public static OperatingSystemMXBean osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    static int maxDepth, txCount;
    static Float highCpuProb, highMemoryProb, highIOProb;
    static Map<String, String> codeBlocks;
    static String hostname;

    Simulator() {
        try {
            hostname = InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            e.printStackTrace();
        }
        codeBlocks = new HashMap<>();
        codeBlocks.put("methodTemplate", "\n    public static void %s(int depth) throws InterruptedException {\n" +
                "        if(depth>=maxDepth){\n" +
                "            switch(rand.nextInt(3)) {\n" +
                "                case 0:\n" +
                "                    cpu();\n" +
                "                    return;\n" +
                "                case 1:\n" +
                "                    io();\n" +
                "                    return;\n" +
                "                case 2:\n" +
                "                    memory();\n" +
                "                    return;\n" +
                "            }\n" +
                "        }\n" +
                "        switch(rand.nextInt(maxDepth)) {\n" +
                "%s" +
                "        }\n" +
                "    }\n");
        codeBlocks.put("caseMethodCall", "%s(depth+rand.nextInt(3));\n");
        codeBlocks.put("caseTemplate", "                case %s:\n" +
                "                    %s" +
                "                    break;\n");
    }

    private static String getSource() {
        final StringBuilder methods = new StringBuilder();
        final ClassLoader classloader = Thread.currentThread().getContextClassLoader();
        final String classTemplate = new BufferedReader(new InputStreamReader(Objects.requireNonNull(classloader.getResourceAsStream("class.template"))))
                .lines().collect(Collectors.joining("\n"));
        for(int i=0; i<maxDepth; i++) {
            StringBuilder caseStr = new StringBuilder();
            for(int r=0; r<maxDepth; r++) {
                String methodName = String.format(codeBlocks.get("caseMethodCall"), "method_" + i + "_" + r);
                caseStr.append(String.format(codeBlocks.get("caseTemplate"), r, methodName));
            }
            for(int j=0; j<maxDepth; j++) {
                methods.append(String.format(codeBlocks.get("methodTemplate"), "method_" + i + "_" + j, caseStr));
            }
        }
        return String.format(
                classTemplate,
                maxDepth,
                txCount,
                highMemoryProb*100,
                highCpuProb*100,
                highIOProb*100,
                methods
        );
    }

    public void run() {
        try {
            generateAndExecSourceFile();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) throws InterruptedException, ParseException, IOException {
        final Options options = new Options();
        final Option threadOpt = new Option("t", "threads", true, "Simulator instance count (Default: 10)");
        final Option txCountOpt = new Option("b", "txCount", true, "Transactions per simulator (Default: 1000)");
        final Option maxDepthOpt = new Option("d", "maxDepth", true, "Max depth of transaction trace (Default: 10)");
        final Option highCpuProbOpt = new Option("c", "highCpuProb", true, "High CPU event probability (Default: 0.05)");
        final Option highMemoryProbOpt = new Option("m", "highMemoryProb", true, "High Memory event probability (Default: 0.01)");
        final Option highIOProbOpt = new Option("i", "highIoProb", true, "High IO events probability (Default: 0.01)");

        options.addOption(threadOpt);
        options.addOption(maxDepthOpt);
        options.addOption(txCountOpt);
        options.addOption(highCpuProbOpt);
        options.addOption(highMemoryProbOpt);
        options.addOption(highIOProbOpt);

        final HelpFormatter formatter = new HelpFormatter();
        final CommandLineParser parser = new DefaultParser();
        CommandLine cmd = null;
        try {
            cmd = parser.parse(options, args);
        } catch (Exception ignored) {
            formatter.printHelp("java -jar simulator/target/simulator-0.0.1-SNAPSHOT.jar", "", options, "Note: Probability values range form (0-1)",true);
            System.exit(1);
        }

        final int threadCount = Integer.parseInt(cmd.getOptionValue("threads", "10"));
        final Map<Integer, Simulator> threads = new HashMap<>();

        txCount = Integer.parseInt(cmd.getOptionValue("txCount", "1000"));
        maxDepth = Integer.parseInt(cmd.getOptionValue("maxDepth", "10"));
        highCpuProb = Float.parseFloat(cmd.getOptionValue("highCpuProb", "0.5"));
        highMemoryProb = Float.parseFloat(cmd.getOptionValue("highMemoryProb", "0.01"));
        highIOProb = Float.parseFloat(cmd.getOptionValue("highIOProb", "0.01"));

        System.out.println("Available processors: "+ osBean.getAvailableProcessors());
        long pid = Long.parseLong(ManagementFactory.getRuntimeMXBean().getName().split("@")[0]);

        for(int i = 0; i < threadCount; ++i) {
            threads.put(i, new Simulator());
            threads.get(i).start();
        }

        while(true) {
            Thread.sleep(60000L);
            final CPUEvent cpuEvent = new CPUEvent();
            cpuEvent.begin();
            cpuEvent.tenant = hostname;
            cpuEvent.cpuPerc = osBean.getProcessCpuLoad()*100;
            final File outFile = new File(String.format("%s_%s.jstack", pid, System.currentTimeMillis()));
            final ProcessBuilder builder = new ProcessBuilder("jstack", "-l" , String.valueOf(pid));
            builder.redirectOutput(outFile);
            builder.redirectError(outFile);
            builder.start();
            cpuEvent.commit();
            System.out.println("CPU Usage: " + osBean.getProcessCpuLoad());
        }
    }

    private static void generateAndExecSourceFile() throws Exception {
        File sourceFile = File.createTempFile("Class", ".java");
        sourceFile.deleteOnExit();
        writeMethods(sourceFile);
        compileAndExecSource(sourceFile);
    }

    private static void compileAndExecSource(final File sourceFile) throws Exception {
        final JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        final StandardJavaFileManager fileManager = compiler.getStandardFileManager(null, null, null);
        final File parentDirectory = sourceFile.getParentFile();
        fileManager.setLocation(StandardLocation.CLASS_OUTPUT, Collections.singletonList(parentDirectory));
        final File txCpuClass = new File("simulator/src/main/java/TxCPUEvent.java");

        final Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjectsFromFiles(Arrays.asList(sourceFile, txCpuClass));
        compiler.getTask(null, fileManager, null, null, null, compilationUnits).call();
        fileManager.close();

        final URLClassLoader classLoader = URLClassLoader.newInstance(new URL[]{parentDirectory.toURI().toURL()});
        final Class<?> genClass = classLoader.loadClass(sourceFile.getName().split("\\.")[0]);
        final Method mainMethod = genClass.getDeclaredMethod("main", String[].class);
        final Object[] args = new Object[1];
        System.out.println(Thread.currentThread().getName() + " executing the simulator");
        mainMethod.invoke(genClass.newInstance(), args);
    }

    private static void writeMethods(final File sourceFile) throws Exception {
        final FileWriter writer = new FileWriter(sourceFile);
        writer.write("");
        writer.write(getSource().replace("CLASS_NAME", sourceFile.getName().split("\\.")[0]));
        writer.close();
    }
}
