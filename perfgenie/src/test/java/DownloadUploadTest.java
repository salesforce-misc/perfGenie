import com.google.common.io.Resources;
import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import org.testng.annotations.AfterSuite;
import org.testng.annotations.BeforeSuite;
import org.testng.annotations.Test;
import server.utils.Downloader;
import server.utils.Uploader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

import static org.testng.AssertJUnit.assertEquals;

public class DownloadUploadTest {
    private Cantor cantor;
    private final String testNamespace = "perfGenie-download-upload-test";
    private final long timestamp = System.currentTimeMillis();

    @BeforeSuite
    public void setup() throws IOException {
        this.cantor = new CantorOnGrpc("localhost:7443");
        this.cantor.events().create(testNamespace);
    }

    @Test
    public void test() throws IOException {
        final Uploader uploader = new Uploader(this.cantor);
        final String original = Resources.toString(Resources.getResource("test.jfr"), StandardCharsets.UTF_8);
        uploader.upload(testNamespace, timestamp, new HashMap<>(), new HashMap<>(), original);

        final Downloader downloader = new Downloader(this.cantor);
        final String downloaded = downloader.download(testNamespace, timestamp, timestamp, new HashMap<>(), new HashMap<>());
        assertEquals(original, downloaded);
    }

    @AfterSuite
    public void cleanup() throws IOException {
        // expire endpoint does not work
//        this.cantor.events().expire(testNamespace, timestamp);
    }
}
