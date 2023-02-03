/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.h2.CantorOnH2;
import com.salesforce.cantor.mysql.CantorOnMysql;
import com.salesforce.cantor.grpc.CantorOnGrpc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import server.utils.CustomJfrParser;
import server.utils.EventStore;

import java.io.IOException;

@Configuration
public class PerfGenieConfiguration {
    final CustomJfrParser.Config config = new CustomJfrParser.Config();

    @Bean
    public Cantor getCantor() throws IOException {
        if (config.getStorageType().equals("mySQL")) {
            return new CantorOnMysql(config.getMySQL_host(), config.getMySQL_port(), config.getMySQL_user(), config.getMySQL_pwd());
        } else if (config.getStorageType().equals("grpc")) {
            return new CantorOnGrpc(config.getGrpc_target());
        } else {
            return new CantorOnH2(config.getH2dir());//default
        }
    }

    @Bean
    public EventStore getEventStore(final Cantor cantor) throws IOException {
        return new EventStore(cantor);
    }

    @Bean
    public CustomJfrParser getCustomParser() throws IOException {
        return new CustomJfrParser(2);
    }

    @Bean
    public PerfGenieService getServerService(final EventStore eventStore, final CustomJfrParser parser) throws IOException {
        return new PerfGenieService(eventStore, parser);
    }
}
