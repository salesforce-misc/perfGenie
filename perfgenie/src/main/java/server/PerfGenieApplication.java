/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import perfgenie.utils.EventHandler;

import java.util.logging.Logger;

@SpringBootApplication
@EnableScheduling
public class PerfGenieApplication {
    private static final Logger logger = Logger.getLogger(EventHandler.class.getName());

    public static void main(String[] args) {
        SpringApplication.run(PerfGenieApplication.class, args);
    }
}


