package com.example.demo;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import server.utils.CustomJfrParser;
import server.utils.EventHandler;

import java.io.IOException;

@SpringBootTest
class DemoApplicationTests {
    private static  CustomJfrParser parser = new CustomJfrParser(1);
    /*@Test
    void contextLoads() throws IOException {
        EventHandler handler = new EventHandler();
        //final CustomJfrParser.Config config = new CustomJfrParser.Config();
        //handler.initializeProfiles(config.getProfiles());
        parser.parseStream(handler,"/tmp//jfrs/jfr_dump_ondemand_1.jfr");
        //Object o = handler.getLogContext();
        //Object t = handler.getProfileTree();
        System.out.println("done");
    }*/


}
