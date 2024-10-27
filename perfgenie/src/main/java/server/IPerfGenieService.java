/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

public interface IPerfGenieService {

    /**
     * Store an event iwth given metadata
     *
     * @param payload   event payload
     * @param timestamp event timestamp
     * @param queryMap  event filters
     * @param dimMap    event dimentions
     * @return true/false
     */
    void addGenieLargeEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException;

    boolean addGenieEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap, final String tenant) throws IOException;

    /**
     * get event metadata
     *
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none

    String getMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;
*/

    /**
     * get event metadata
     *
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none
     */
    String getGenieTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;


    /**
     * get event metadata
     *
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none
     */
    String getGenieMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String namespace, final String instance) throws IOException;

    /**
     * get profile event data
     *
     * @param tenant   tenant name from where event to be fetched
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none
     */
    String getGenieProfile(String tenant, long start, long end, Map<String, String> queryMap, Map<String, String> dimMap) throws IOException;

    /**
     * get combined profile event data
     *
     * @param tenant   tenant name from where event to be fetched
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none
     */
    String getGenieProfiles(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;

    /**
     * get custom event data
     *
     * @param tenant   tenant name from where event to be fetched
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none
     */
    String getContextEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;

    String getJstackProfile(final String tenant, final long start, final long end, final Map<String, String> queryMap) throws IOException;

    public String getGenieInstances(long start, long end, final String tenant, final Map<String, String> queryMap) throws IOException;
    public String getOtherEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap);

    String getGenieEvent(String tenant, long start, long end, Map<String, String> queryMap, Map<String, String> dimMap) throws IOException;

    InputStream getGenieEventStream(final String tenant, long timestamp, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;
}
