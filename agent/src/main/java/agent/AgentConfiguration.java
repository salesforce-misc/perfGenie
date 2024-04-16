/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
package agent;

import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.h2.CantorOnH2;
import com.salesforce.cantor.mysql.CantorOnMysql;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import perfgenie.utils.Config;
import perfgenie.utils.CustomJfrParser;
import perfgenie.utils.EventStore;

import java.io.IOException;

@Configuration
public class AgentConfiguration {
    //final CustomJfrParser.Config config = new CustomJfrParser.Config();

    @Bean
    public Cantor getCantor(Config config) throws IOException {
        if (config.getStorageType().equals("mySQL")) {
            return new CantorOnMysql(config.getMySQL_host(), config.getMySQL_port(), config.getMySQL_user(), config.getMySQL_pwd());
        } else if (config.getStorageType().equals("grpc")) {
            return new CantorOnGrpc(config.getGrpc_target());
        } else {
            return new CantorOnH2(config.getH2dir());//default
        }
    }

    @Bean
    public EventStore getEventStore(final Cantor cantor, final Config config) throws IOException {
        return new EventStore(cantor, config);
    }

    @Bean
    public CustomJfrParser getCustomParser() throws IOException {
        return new CustomJfrParser(2);
    }

    @Bean
    public AgentApplication getServerService(final EventStore eventStore, final CustomJfrParser parser, final Config config) throws IOException {
        return new AgentApplication(eventStore, parser, config);
    }

    @Bean
    public Config getConfig(){
        return new Config();
    }
}