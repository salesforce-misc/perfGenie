/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package server;

import java.io.IOException;
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
    boolean addEvent(final String payload, final long timestamp, final Map<String, Double> dimMap, final Map<String, String> queryMap) throws IOException;

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
    String getTenants(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;


    /**
     * get event metadata
     *
     * @param start    start time ms
     * @param end      end time ms
     * @param queryMap event filters
     * @param dimMap   event dimentions
     * @return none
     */
    String getMeta(long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap, final String namespace, final String instance) throws IOException;

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
    String getProfile(String tenant, long start, long end, Map<String, String> queryMap, Map<String, String> dimMap) throws IOException;

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
    String getProfiles(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;

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
    String getCustomEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;

    String getJstack(final String tenant, final long start, final long end, final Map<String, String> queryMap) throws IOException;

    public String getInstances(long start, long end, final String tenant) throws IOException;
    public String getOtherEvents(final String tenant, long start, long end, final Map<String, String> queryMap, final Map<String, String> dimMap) throws IOException;

}
