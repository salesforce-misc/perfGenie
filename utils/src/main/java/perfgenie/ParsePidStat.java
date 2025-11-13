package perfgenie;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Java port of the Python pidstatparser.py script
 * Parses pidstat files and extracts CPU metrics for different components
 */
public class ParsePidStat {
    
    private static final double REQUEST_CPU = 29.593;
    private static final DateTimeFormatter DATE_TIME_FORMATTER = 
        DateTimeFormatter.ofPattern("MM/dd/yy HH:mm:ss");
    
    // List to store parsed results: List<List<Object>> where each inner list contains [pod, kpod, timestamp, kind, value]
    private List<List<Object>> pidstatParseOutputArray;
    
    /**
     * Constructor - initializes the output array
     */
    public ParsePidStat() {
        this.pidstatParseOutputArray = new ArrayList<>();
    }
    
    /**
     * Parses a pidstat file and extracts CPU metrics
     * 
     * @param cell The cell/pod identifier
     * @param kpod The kpod identifier
     * @param filepath The path to the pidstat file to parse
     */
    public void parsePidStat(String cell, String kpod, String filepath) {
        try (BufferedReader reader = new BufferedReader(new FileReader(filepath))) {
            StringBuilder content = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
            parsePidStatContent(cell, kpod, content.toString());
        } catch (IOException e) {
            System.err.println("Error reading file " + filepath + ": " + e.getMessage());
        }
    }
    
    /**
     * Parses pidstat content from a String and extracts CPU metrics
     * 
     * @param cell The cell/pod identifier
     * @param kpod The kpod identifier
     * @param fileContent The content of the pidstat file as a String
     */
    public void parsePidStatString(String cell, String kpod, String fileContent) {
        parsePidStatContent(cell, kpod, fileContent);
    }
    
    /**
     * Internal method that parses pidstat content and extracts CPU metrics
     * Shared by both parsePidStat and parsePidStatString
     * 
     * @param cell The cell/pod identifier
     * @param kpod The kpod identifier
     * @param fileContent The content of the pidstat file as a String
     */
    private void parsePidStatContent(String cell, String kpod, String fileContent) {
        String pod = cell;
        
        String[] lines = fileContent.split("\n");
        boolean header = true;
        double totalCpu = 0.0;
        double gcCpu = 0.0;
        double c2Cpu = 0.0;
        double jfrCpu = 0.0;
        String xDate = null;
        String xTime = null;
        
        for (String line : lines) {
            // Extract date from first non-empty line (assuming it's in the format with date)
            if (xDate == null && !line.trim().isEmpty()) {
                String[] parts = line.trim().split("\\s+");
                if (parts.length > 3) {
                    xDate = parts[3];
                }
            }
            
            // Check if header section
            if (header) {
                if (line.startsWith("# Time")) {
                    header = false;
                }
                continue;
            }
            
            // Parse data line
            String[] parts = line.trim().split("\\s+");
            if (parts.length < 22) {
                continue; // Skip lines that don't have enough columns
            }
            
            // Extract time from first data line
            if (xTime == null) {
                xTime = parts[0];
            }
            
            // Extract CPU usage (column 8, index 8)
            double cpu = 0.0;
            try {
                cpu = Double.parseDouble(parts[8]);
            } catch (NumberFormatException e) {
                continue; // Skip lines with invalid CPU values
            }
            
            // Extract thread name (column 21, index 21, possibly 22)
            String tname = parts[21];
            if (parts.length > 22) {
                tname = tname + " " + parts[22];
            }
            
            // Categorize threads and accumulate CPU
            if (tname.startsWith("|__GC Thread") || 
                tname.startsWith("|__GC task") || 
                tname.startsWith("|__GPGC_")) {
                gcCpu += cpu * REQUEST_CPU / 100.0 * 300.0;
            } else if (tname.startsWith("|__JFR") || 
                       tname.startsWith("|__TickProfiler")) {
                jfrCpu += cpu * REQUEST_CPU / 100.0 * 300.0;
            } else if (tname.startsWith("|__C2 CompilerThre") || 
                      tname.startsWith("|__FalconCompThr") || 
                      tname.startsWith("|__CompileBrokerTh")) {
                c2Cpu += cpu * REQUEST_CPU / 100.0 * 300.0;
            } else if (tname.equals("java")) {
                totalCpu = cpu * REQUEST_CPU / 100.0 * 300.0;
            }
        }
        
        // Parse timestamp
        long timestamp = 0L;
        if (xDate != null && xTime != null) {
            try {
                LocalDateTime dateTime = LocalDateTime.parse(xDate + " " + xTime, DATE_TIME_FORMATTER);
                timestamp = dateTime.toEpochSecond(ZoneOffset.UTC);
            } catch (DateTimeParseException e) {
                System.err.println("Error parsing date/time: " + xDate + " " + xTime + " - " + e.getMessage());
            }
        }
        
        // Create lists for each metric and add to output array
        List<Object> containerCpuEntry = new ArrayList<>();
        containerCpuEntry.add(pod);
        containerCpuEntry.add(kpod);
        containerCpuEntry.add(timestamp);
        containerCpuEntry.add("containerCpu");
        containerCpuEntry.add(totalCpu);
        pidstatParseOutputArray.add(containerCpuEntry);
        
        List<Object> gcCpuEntry = new ArrayList<>();
        gcCpuEntry.add(pod);
        gcCpuEntry.add(kpod);
        gcCpuEntry.add(timestamp);
        gcCpuEntry.add("gcCpu");
        gcCpuEntry.add(gcCpu);
        pidstatParseOutputArray.add(gcCpuEntry);
        
        List<Object> c2CpuEntry = new ArrayList<>();
        c2CpuEntry.add(pod);
        c2CpuEntry.add(kpod);
        c2CpuEntry.add(timestamp);
        c2CpuEntry.add("c2Cpu");
        c2CpuEntry.add(c2Cpu);
        pidstatParseOutputArray.add(c2CpuEntry);
        
        List<Object> jfrCpuEntry = new ArrayList<>();
        jfrCpuEntry.add(pod);
        jfrCpuEntry.add(kpod);
        jfrCpuEntry.add(timestamp);
        jfrCpuEntry.add("jfrCpu");
        jfrCpuEntry.add(jfrCpu);
        pidstatParseOutputArray.add(jfrCpuEntry);
    }
    
    /**
     * Gets the final output array containing all parsed results
     * 
     * @return List<List<Object>> where each inner list contains [pod, kpod, timestamp, kind, value]
     */
    public List<List<Object>> getPidstatParseOutputArray() {
        return pidstatParseOutputArray;
    }
    
    /**
     * Clears the output array (useful for resetting the parser)
     */
    public void clearOutput() {
        pidstatParseOutputArray.clear();
    }
    
    /**
     * Main method for command line usage
     * Usage: java ParsePidStat <directory>
     * 
     * @param args Command line arguments - expects directory path as first argument
     */
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("Usage: java ParsePidStat <directory>");
            System.err.println("  <directory> - Path to directory containing pidstat .txt files");
            System.exit(1);
        }
        
        String directoryPath = args[0];
        File directory = new File(directoryPath);
        
        if (!directory.exists() || !directory.isDirectory()) {
            System.err.println("Error: Directory does not exist or is not a directory: " + directoryPath);
            System.exit(1);
        }
        
        // Create ParsePidStat instance
        ParsePidStat parser = new ParsePidStat();
        
        // Get all .txt files in the directory
        File[] files = directory.listFiles((dir, name) -> name.toLowerCase().endsWith(".txt"));
        
        if (files == null || files.length == 0) {
            System.err.println("No .txt files found in directory: " + directoryPath);
            System.exit(1);
        }
        
        System.out.println("Found " + files.length + " .txt file(s) in directory: " + directoryPath);
        System.out.println();
        
        // Process each file
        for (File file : files) {
            if (file.isFile()) {
                String filepath = file.getAbsolutePath();
                String filename = file.getName();
                
                // Extract cell and kpod from filename
                // Format: "usa746-casam-app-blue-659857bbd7-2l4n9_1761840642160.txt"
                // Cell: "usa746" (first segment before first dash)
                // Kpod: "2l4n9" (last segment before underscore)
                
                String cell = "ind86"; // Default fallback
                String kpod = "ind86"; // Default fallback
                
                // Remove .txt extension
                String nameWithoutExt = filename;
                if (filename.endsWith(".txt")) {
                    nameWithoutExt = filename.substring(0, filename.length() - 4);
                }
                
                // Split by underscore to get the part before timestamp
                if (nameWithoutExt.contains("_")) {
                    String partBeforeUnderscore = nameWithoutExt.substring(0, nameWithoutExt.indexOf("_"));
                    
                    // Extract cell: first segment before first dash
                    if (partBeforeUnderscore.contains("-")) {
                        cell = partBeforeUnderscore.substring(0, partBeforeUnderscore.indexOf("-"));
                    } else {
                        cell = partBeforeUnderscore;
                    }
                    
                    // Extract kpod: last segment (after last dash, before underscore)
                    if (partBeforeUnderscore.contains("-")) {
                        int lastDashIndex = partBeforeUnderscore.lastIndexOf("-");
                        kpod = partBeforeUnderscore.substring(lastDashIndex + 1);
                    } else {
                        kpod = partBeforeUnderscore;
                    }
                } else {
                    // Fallback: try to extract from filename without extension
                    if (nameWithoutExt.contains("-")) {
                        cell = nameWithoutExt.substring(0, nameWithoutExt.indexOf("-"));
                        int lastDashIndex = nameWithoutExt.lastIndexOf("-");
                        kpod = nameWithoutExt.substring(lastDashIndex + 1);
                    } else {
                        cell = nameWithoutExt;
                        kpod = nameWithoutExt;
                    }
                }
                
                System.out.println("Processing: " + filename);
                System.out.println("  Extracted cell: " + cell + ", kpod: " + kpod);
                parser.parsePidStat(cell, kpod, filepath);
            }
        }
        
        // Get final result array and print
        List<List<Object>> results = parser.getPidstatParseOutputArray();
        
        System.out.println();
        System.out.println("========================================");
        System.out.println("Final Results (" + results.size() + " entries):");
        System.out.println("========================================");
        System.out.println("pod,kpod,time,kind,value");
        
        for (List<Object> entry : results) {
            if (entry.size() >= 5) {
                String pod = entry.get(0).toString();
                String kpodValue = entry.get(1).toString();
                Object timestamp = entry.get(2);
                String kind = entry.get(3).toString();
                Object value = entry.get(4);
                
                // Format output with kpod included
                System.out.printf("%s,%s,%s,%s,%s%n", pod, kpodValue, timestamp, kind, value);
            }
        }
        
        System.out.println("========================================");
        System.out.println("Total entries: " + results.size());
    }
}

