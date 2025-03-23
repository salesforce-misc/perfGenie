import com.google.common.io.Resources;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.h2.CantorOnH2;
import org.testng.annotations.AfterSuite;
import org.testng.annotations.BeforeSuite;
import org.testng.annotations.Test;
import perfgenie.utils.Config;
import perfgenie.utils.EventHandler;
import perfgenie.utils.EventStore;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.testng.AssertJUnit.assertEquals;

public class EventHandlerTest {
    private final long timestamp = System.currentTimeMillis();
    private static Config config = new Config();

    @BeforeSuite
    public void setup() throws IOException {
    }

    @Test
    public void testJstackParsing() throws IOException {
        EventHandler handler = new EventHandler();
        handler.initializeProfile("Jstack");
        handler.initializePid("Jstack");
        final String jstack = Resources.toString(Resources.getResource("jstack.txt"), StandardCharsets.UTF_8);
        handler.processJstackEvent(1,jstack);
        Object profile = handler.getProfileTree("Jstack");
        assertEquals(jstack, jstack);
    }

    @AfterSuite
    public void cleanup() throws IOException {
    }
}
