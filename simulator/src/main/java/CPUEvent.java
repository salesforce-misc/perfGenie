/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import jdk.jfr.Event;
import jdk.jfr.Label;

class CPUEvent extends Event {
    @Label("tenant")
    String tenant;

    @Label("cpuPerc")
    double cpuPerc;
}
