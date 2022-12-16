/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import com.salesforce.cantor.Cantor;
import com.salesforce.cantor.h2.CantorOnH2;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import server.utils.CustomJfrParser;

import java.io.IOException;

@Configuration
public class PerfGenieConfiguration {

    @Bean
    public Cantor getCantor()  throws IOException {
        return new CantorOnH2("/tmp/h2");
    }
    @Bean
    public CustomJfrParser getCustomParser()  throws IOException {
        return new CustomJfrParser(2);
    }
    @Bean
    public PerfGenieService getServerService(final Cantor cantor, final CustomJfrParser parser)  throws IOException {
        return new PerfGenieService(cantor, parser);
    }
}
