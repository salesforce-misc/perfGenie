import com.google.common.io.Resources;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.h2.CantorOnH2;
import org.testng.annotations.AfterSuite;
import org.testng.annotations.BeforeSuite;
import org.testng.annotations.Test;
import perfgenie.utils.Config;
import perfgenie.utils.EventStore;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.UUID;

import static org.testng.AssertJUnit.assertEquals;

public class DownloadUploadTest {
    private final long timestamp = System.currentTimeMillis();

    private static EventStore eventStore;
    private static Config config = new Config();

    static {
        try {
            eventStore = new EventStore(getCantorInstance(), config);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @BeforeSuite
    public void setup() throws IOException {
    }

    @Test
    public void test() throws IOException {
        final String original = Resources.toString(Resources.getResource("test.jfr"), StandardCharsets.UTF_8);
        eventStore.addEvent(timestamp, new HashMap<>(), new HashMap<>(), original);

        final String downloaded = eventStore.getEvent(timestamp, timestamp, new HashMap<>(), new HashMap<>(), original.length());
        assertEquals(original, downloaded);
    }

    @AfterSuite
    public void cleanup() throws IOException {
    }

    public static Cantor getCantorInstance() {
        try {
            return new CantorOnH2("/tmp/mat-report-job-test/" + UUID.randomUUID().toString());
        } catch (Exception e) {
            return null;
        }
    }
}
