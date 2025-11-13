/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package perfgenie.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ThreadPoolExecutor utility class for parallel execution with configurable concurrency limit
 */
public class ParallelExecutor {
    private static final Logger logger = LoggerFactory.getLogger(ParallelExecutor.class);
    private final ThreadPoolExecutor executor;
    private final int concurrencyLimit;
    
    /**
     * Creates a ParallelExecutor with the specified concurrency limit
     * @param concurrencyLimit Maximum number of threads to run concurrently
     */
    public ParallelExecutor(int concurrencyLimit) {
        if (concurrencyLimit <= 0) {
            throw new IllegalArgumentException("Concurrency limit must be > 0");
        }
        this.concurrencyLimit = concurrencyLimit;
        
        // Create a ThreadPoolExecutor with:
        // - Core pool size = concurrency limit
        // - Max pool size = concurrency limit
        // - Keep alive time = 60 seconds
        // - Unbounded queue
        // - Custom thread factory with naming
        this.executor = new ThreadPoolExecutor(
            concurrencyLimit,
            concurrencyLimit,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(),
            new ThreadFactory() {
                private final AtomicInteger threadNumber = new AtomicInteger(1);
                @Override
                public Thread newThread(Runnable r) {
                    Thread t = new Thread(r, "ParallelExecutor-" + threadNumber.getAndIncrement());
                    t.setDaemon(true);
                    return t;
                }
            },
            new ThreadPoolExecutor.CallerRunsPolicy() // If queue is full, run in caller thread
        );
        
        logger.info("ParallelExecutor created with concurrency limit: {}", concurrencyLimit);
    }
    
    /**
     * Submits a task for execution
     * @param task The task to execute
     * @return Future representing the task
     */
    public <T> Future<T> submit(Callable<T> task) {
        return executor.submit(task);
    }
    
    /**
     * Submits a runnable task for execution
     * @param task The task to execute
     * @return Future representing the task
     */
    public Future<?> submit(Runnable task) {
        return executor.submit(task);
    }
    
    /**
     * Executes all tasks and waits for completion
     * @param tasks List of tasks to execute
     * @return List of futures
     * @throws InterruptedException if interrupted while waiting
     */
    public <T> List<Future<T>> invokeAll(List<Callable<T>> tasks) throws InterruptedException {
        return executor.invokeAll(tasks);
    }
    
    /**
     * Gets the current concurrency limit
     * @return The concurrency limit
     */
    public int getConcurrencyLimit() {
        return concurrencyLimit;
    }
    
    /**
     * Gets the current number of active threads
     * @return Number of active threads
     */
    public int getActiveCount() {
        return executor.getActiveCount();
    }
    
    /**
     * Gets the current queue size
     * @return Queue size
     */
    public int getQueueSize() {
        return executor.getQueue().size();
    }
    
    /**
     * Shuts down the executor gracefully
     */
    public void shutdown() {
        executor.shutdown();
        logger.info("ParallelExecutor shutdown initiated");
    }
    
    /**
     * Shuts down the executor immediately
     * @return List of tasks that were not executed
     */
    public java.util.List<Runnable> shutdownNow() {
        logger.info("ParallelExecutor shutdown now requested");
        return executor.shutdownNow();
    }
    
    /**
     * Waits for the executor to terminate
     * @param timeout Timeout duration
     * @param unit Time unit
     * @return true if terminated, false if timeout
     * @throws InterruptedException if interrupted
     */
    public boolean awaitTermination(long timeout, TimeUnit unit) throws InterruptedException {
        return executor.awaitTermination(timeout, unit);
    }
}

