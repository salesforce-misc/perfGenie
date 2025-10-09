package perfgenie.utils;
import java.util.List;
import java.util.concurrent.*;

public class FunctionExecutorPool {
    private final ExecutorService executor;

    // Constructor with given concurrency level
    public FunctionExecutorPool(int concurrencyLevel) {
        if (concurrencyLevel <= 0) {
            throw new IllegalArgumentException("Concurrency level must be > 0");
        }
        this.executor = Executors.newFixedThreadPool(concurrencyLevel);
    }

    // Submit a Runnable task (no return value)
    public void submitTask(Runnable task) {
        executor.submit(task);
    }

    // Submit a Callable task (with return value)
    public <T> Future<T> submitTask(Callable<T> task) {
        return executor.submit(task);
    }

    // Submit multiple Callable tasks and wait for results
    public <T> List<Future<T>> invokeAll(List<Callable<T>> tasks) throws InterruptedException {
        return executor.invokeAll(tasks);
    }

    // Shut down the pool
    public void shutdown() {
        executor.shutdown();
    }

    // Force shutdown (optional)
    public List<Runnable> shutdownNow() {
        return executor.shutdownNow();
    }

    // Wait for termination
    public boolean awaitTermination(long timeout, TimeUnit unit) throws InterruptedException {
        return executor.awaitTermination(timeout, unit);
    }
}

