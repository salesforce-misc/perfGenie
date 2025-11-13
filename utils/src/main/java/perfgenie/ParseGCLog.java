package perfgenie;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Java port of the Python parsegc.py script
 * Parses GC log files and extracts CPU metrics for different components
 */
public class ParseGCLog {
    
    private static final DateTimeFormatter DATE_TIME_FORMATTER = 
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSZ");
    
    /**
     * Parses a log file and extracts CPU metrics
     * 
     * @param filename The path to the log file to parse
     * @param pod The pod identifier to include in the output
     */
    public static void parseLog(String filename, String pod) {
        try (BufferedReader reader = new BufferedReader(new FileReader(filename))) {
            String line;
            while ((line = reader.readLine()) != null) {
                processLine(line, pod);
            }
        } catch (IOException e) {
            System.err.println("Error reading file: " + e.getMessage());
        }
    }
    
    /**
     * Processes a single line from the log file
     * 
     * @param line The log line to process
     * @param pod The pod identifier
     */
    private static void processLine(String line, String pod) {
        String[] parts = line.split("\\[");
        
        if (parts.length >= 6) {
            // Check if the uptime part ends with "ms]"
            if (!parts[2].endsWith("ms]")) {
                return;
            }
            
            try {
                // Parse timestamp
                String timestampStr = parts[1].substring(0, parts[1].length() - 1); // Remove ']'
                LocalDateTime dateTime = LocalDateTime.parse(timestampStr, DATE_TIME_FORMATTER);
                long time = dateTime.toEpochSecond(ZoneOffset.UTC) * 1000;
                
                // Parse uptime
                String uptimeStr = parts[2].substring(0, parts[2].length() - 3); // Remove 'ms]'
                int uptime = Integer.parseInt(uptimeStr);
                
                // Process different log entry types
                String logEntry = parts[5];
                
                if (logEntry.startsWith("SYSINFO ")) {
                    processSysInfo(logEntry, pod, time, uptime);
                } else if (logEntry.startsWith("COMPSTATS 2 ")) {
                    processCompStats2(logEntry, pod, time, uptime);
                } else if (logEntry.startsWith("COMPSTATS 1 ")) {
                    processCompStats1(logEntry, pod, time, uptime);
                } else if (logEntry.startsWith("GC Old Max ")) {
                    processGCOldMax(logEntry, pod, time, uptime);
                } else if (logEntry.startsWith("GC New Max ")) {
                    processGCNewMax(logEntry, pod, time, uptime);
                }
                
            } catch (DateTimeParseException e) {
                System.err.println("Error parsing timestamp: " + e.getMessage());
                System.err.println("Timestamp string: " + parts[1].substring(0, parts[1].length() - 1));
            } catch (NumberFormatException e) {
                System.err.println("Error parsing number: " + e.getMessage());
            } catch (ArrayIndexOutOfBoundsException e) {
                System.err.println("Error accessing array element: " + e.getMessage());
            }
        }
    }
    
    /**
     * Processes SYSINFO log entries
     */
    private static void processSysInfo(String logEntry, String pod, long time, int uptime) {
        String[] fields = logEntry.split("\\s+");
        if (fields.length > 52) {
            double cpu = Double.parseDouble(fields[52]) / 1000000.0; // Convert from ns to ms
            System.out.printf("%d,%s,containerCpu,%.6f%n", time, pod, cpu);
        }
    }
    
    /**
     * Processes COMPSTATS 2 log entries
     */
    private static void processCompStats2(String logEntry, String pod, long time, int uptime) {
        String[] fields = logEntry.split("\\s+");
        if (fields.length > 43) {
            double cpu = Double.parseDouble(fields[43]); // Already in ms
            System.out.printf("%d,%s,c2Cpu,%.6f%n", time, pod, cpu);
        }
    }
    
    /**
     * Processes COMPSTATS 1 log entries
     */
    private static void processCompStats1(String logEntry, String pod, long time, int uptime) {
        String[] fields = logEntry.split("\\s+");
        if (fields.length > 43) {
            double cpu = Double.parseDouble(fields[43]); // Already in ms
            System.out.printf("%d,%s,c1Cpu,%.6f%n",  time, pod, cpu);
        }
    }
    
    /**
     * Processes GC Old Max log entries
     */
    private static void processGCOldMax(String logEntry, String pod, long time, int uptime) {
        String[] fields = logEntry.split("\\s+");
        if (fields.length > 70) {
            double cpu = Double.parseDouble(fields[69]) + Double.parseDouble(fields[70]);
            System.out.printf("%d,%s,gcOldCpu,%.6f%n",  time, pod, cpu);
        }
    }
    
    /**
     * Processes GC New Max log entries
     */
    private static void processGCNewMax(String logEntry, String pod, long time, int uptime) {
        String[] fields = logEntry.split("\\s+");
        if (fields.length > 70) {
            double cpu = Double.parseDouble(fields[69]) + Double.parseDouble(fields[70]);
            System.out.printf("%d,%s,gcNewCpu,%.6f%n", time, pod, cpu);
        }
    }
    
    /**
     * Main method for command line usage
     * Usage: java ParseGCLog <filename> <pod>
     */
    public static void main(String[] args) {
        if (args.length <= 2) {
            System.err.println("Usage: java ParseGCLog <filename> <pod>");
            System.exit(1);
        }
        
        String filename = args[0];
        String pod = args[1];
        
        parseLog(filename, pod);
    }
}
