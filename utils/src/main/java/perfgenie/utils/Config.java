package perfgenie.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

public  class Config {
    private static final Logger logger = LoggerFactory.getLogger(CustomJfrParser.class);

    public List<String> getProfiles() {
        return profiles;
    }

    public void setProfiles(List<String> profiles) {
        this.profiles = profiles;
    }

    public List<String> getCustomevents() {
        return customevents;
    }

    public void setCustomevents(List<String> customevents) {
        this.customevents = customevents;
    }

    public String getJfrdir() {
        return jfrdir;
    }

    String jfrdir = "/tmp/jfrs";

    public String getTenant() {
        return tenant;
    }

    String tenant = "dev";

    String jfrparser = "parserv1.jar";

    public String getJfrparser() {
        return jfrparser;
    }

    public String getH2dir() {
        return h2dir;
    }

    String h2dir = "/tmp/h2";

    public String getStorageType() {
        return storageType;
    }

    String mySQL_host="localhost";
    int mySQL_port=3306;
    String mySQL_user="root";


    public double getThreshold() {
        return threshold;
    }

    public int getFilterDepth() {
        return filterDepth;
    }

    public int getMaxStackDepth() {
        return maxStackDepth;
    }

    public int filterDepth = 4;
    public int maxStackDepth = 128;
    public double threshold = 0.05; //percentage

    public boolean isExperimental() {
        return isExperimental;
    }

    public boolean isExperimental = false;


    public String getMySQL_host() {
        return mySQL_host;
    }

    public int getMySQL_port() {
        return mySQL_port;
    }

    public String getMySQL_user() {
        return mySQL_user;
    }

    public String getMySQL_pwd() {
        return mySQL_pwd;
    }

    String mySQL_pwd="xxxx";

    public String getGrpc_target() {
        return grpc_target;
    }

    String grpc_target = "localhost:7443";



    String storageType = "h2";
    List<String> profiles = new ArrayList<>(); //Arrays.asList("ExecutionS", "Socket");
    List<String> customevents = new ArrayList<>(); //rrays.asList("LogContext", "MqFrm", "CPUEvent", "MemoryEvent");

    public Config(){
        try (InputStream config = CustomJfrParser.class.getClassLoader().getResourceAsStream("config.properties")) {
            Properties prop = new Properties();
            if (config == null) {
                logger.error("Error: unable to find config.properties, adding default entries");
                profiles.add("ExecutionS");
                profiles.add("Socket");
                customevents.add("MqFrm");
                customevents.add("LogContext");
                customevents.add("CPUEvent");
                customevents.add("MemoryEvent");
                logger.info(profiles.toString());
                logger.info(customevents.toString());
                return;
            }
            prop.load(config);
            String [] ce = prop.getProperty("customevents").split(";");
            for(int i = 0; i< ce.length; i++){
                customevents.add(ce[i]);
            }

            String [] pe = prop.getProperty("profiles").split(";");
            for(int i = 0; i< pe.length; i++){
                profiles.add(pe[i]);
            }
            if(prop.getProperty("jfrdir") != null){
                jfrdir=prop.getProperty("jfrdir");
            }
            if(prop.getProperty("tenant") != null){
                tenant=prop.getProperty("tenant");
            }
            if(prop.getProperty("h2dir") != null){
                h2dir=prop.getProperty("h2dir");
            }
            if(prop.getProperty("storageType") != null){
                String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    storageType=prop.getProperty("storageType");
                } else {// for aws TODO in config
                    storageType="grpc";
                }
            }
            if(prop.getProperty("mySQL.host") != null){
                mySQL_host=prop.getProperty("mySQL.host");
            }
            if(prop.getProperty("mySQL.port") != null){
                mySQL_port=Integer.parseInt(prop.getProperty("mySQL.port"));
            }
            if(prop.getProperty("mySQL.pwd") != null){
                mySQL_pwd=prop.getProperty("mySQL.pwd");
            }
            if(prop.getProperty("grpc.target") != null){
                String substrate = System.getenv("SUBSTRATE");
                if (substrate == null) {
                    grpc_target=prop.getProperty("grpc.target");
                } else {//cantor.warden.svc.mesh.sfdc.net:7443 for aws TODO in config
                    grpc_target="cantor.warden.svc.mesh.sfdc.net:7443";
                }
            }
            if(prop.getProperty("mySQL.user") != null){
                mySQL_user=prop.getProperty("mySQL.user");
            }

            if(prop.getProperty("threshold") != null){
                threshold=Double.parseDouble(prop.getProperty("threshold"));
            }

            if(prop.getProperty("filterDepth") != null){
                filterDepth=Integer.parseInt(prop.getProperty("filterDepth"));
            }

            if(prop.getProperty("maxStackDepth") != null){
                maxStackDepth=Integer.parseInt(prop.getProperty("maxStackDepth"));
            }

            if(prop.getProperty("isExperimental") != null){
                isExperimental= prop.getProperty("isExperimental").equals("true");
            }

            if(prop.getProperty("jfrparser") != null){
                jfrparser= prop.getProperty("jfrparser");
            }



            logger.info("profiles being parsed:" + profiles.toString());
            logger.info("customevents being parsed:" + customevents.toString());
            logger.info("dir monitored to parse jfr files:" + jfrdir);

        } catch (IOException ex) {
            logger.error("Exception: unable to find config.properties");
            ex.printStackTrace();
        }
    }

    public boolean isCustomEvent(String type) {
        for (int i = 0; i < customevents.size(); i++) {
            if (type.contains(customevents.get(i))) {
                return true;
            }
        }
        return false;
    }

    public boolean isProfile(String type) {
        for (int i = 0; i < profiles.size(); i++) {
            if (type.contains(profiles.get(i))) {
                return true;
            }
        }
        return false;
    }
}