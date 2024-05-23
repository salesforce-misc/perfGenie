package perfgenie.utils;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class CommandExecutor {
    private static final int MAX_QUEUE_DEPTH = 5;
    private final BlockingQueue<String> commandQueue;
    private final ExecutorService executorService;
    private final Set<String> commandSet; // To track commands in the queue

    // Single instance of the class
    private static CommandExecutor instance;

    // Private constructor to prevent instantiation
    private CommandExecutor() {
        commandQueue = new LinkedBlockingQueue<>();
        executorService = Executors.newSingleThreadExecutor();
        commandSet = new HashSet<>();
        startProcessing();
    }

    // Public method to provide access to the single instance
    public static synchronized CommandExecutor getInstance() {
        if (instance == null) {
            instance = new CommandExecutor();
        }
        return instance;
    }

    // Method to add a command to the queue
    public synchronized boolean addCommand(String command) {
        if (commandQueue.size() >= MAX_QUEUE_DEPTH) {
            System.err.println("Queue is full. Command rejected: " + command);
            return false;
        }
        if (commandSet.contains(command)) {
            System.err.println("Duplicate command. Command rejected: " + command);
            return false;
        }
        try {
            commandQueue.put(command);
            commandSet.add(command);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("Failed to add command to the queue: " + e.getMessage());
            return false;
        }
    }

    // Method to start processing commands
    private void startProcessing() {
        executorService.submit(() -> {
            while (true) {
                try {
                    // Take a command from the queue and execute it
                    String command = commandQueue.take();
                    executeCommand(command);
                    commandSet.remove(command); // Remove from set when starting execution
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    System.err.println("Command processing interrupted: " + e.getMessage());
                    break;
                }
            }
        });
    }

    // Method to execute a command
    private void executeCommand(String command) {
        try {
            System.out.println("Executing Command : " + command);
            Process process = Runtime.getRuntime().exec(command);
            process.waitFor(); // Wait for the command to complete
            int exitCode = process.exitValue();
            System.out.println("Command executed with exit code: " + exitCode);
        } catch (Exception e) {
            System.err.println("Failed to execute command: " + command);
            e.printStackTrace();
        }
    }

    // Method to stop the executor service gracefully
    public void shutdown() {
        executorService.shutdownNow();
    }
}