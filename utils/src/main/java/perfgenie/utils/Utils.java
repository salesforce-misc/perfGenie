/*
 * Copyright (c) 2022, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

package perfgenie.utils;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.io.ByteStreams;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

public class Utils {
    // special handling for lambdas
    private static String lambdaFrameIndicator = "Lambda$";
    private static char lambdaBeginningCharacter = lambdaFrameIndicator.charAt(0);
    // special handling for sfdc generated frames
    private static String sfdcGeneratedFrameIndicator = "EnhancerBySpringCGLIB$$";
    private static char sfdcGeneratedBeginningCharacter = sfdcGeneratedFrameIndicator.charAt(0);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static boolean trimAfterNthMatchingCharacter(final String str, final StringBuilder builder, final int count, char trimAfter){
        if(str == null){
            return false;
        }
        int length = str.length();
        int c=0;
        for (int i = 0; i < length; i++) {
            final char character = str.charAt(i);
            if(character == trimAfter){
                c++;
            }
            if(c >= count){
                return true;
            }
            builder.append(character);
        }
        return false;
    }
    public static boolean normalizeFrame(final String frame, final StringBuilder builder, final int startIndex) {
        boolean previousCharacterDollarSign = false;
        boolean previousCharacterNormalized = false;
        boolean isNormalized = false;
        for (int i = startIndex; i < frame.length(); i++) {
            final char character = frame.charAt(i);
            // open parentheses indicates we're done, throw away parentheses/filename
            if (character == '(') {
                return isNormalized;
            }
            // dollar sign indicates potential start of lambda
            if (character == '$') {
                // always append dollar signs (don't normalize them)
                builder.append(character);
                // if the frame is a lambda, normalize the rest and we're done
                if (frameIsLambda(frame, i, previousCharacterDollarSign)) {
                    normalizeLambdaFrame(frame, i, builder);
                    isNormalized=true;
                    return isNormalized;
                }
                // can't tell if frame is lambda yet, indicate we've seen a dollar sign and continue to next character
                previousCharacterDollarSign = true;
                continue;
            } else {
                previousCharacterDollarSign = false;
            }

            final boolean shouldNormalize = shouldNormalizeCharacter(character);
            if (!shouldNormalize) {
                builder.append(character);
                previousCharacterNormalized = false;
            } else if (!previousCharacterNormalized) {
                builder.append('?');
                isNormalized=true;
                previousCharacterNormalized = true;
            }
        }
        return isNormalized;
    }


    private static void normalizeLambdaFrame(final String frame, final int index, final StringBuilder normalized) {
        final char nextCharacter = frame.charAt(index + 1);
        if (nextCharacter == lambdaBeginningCharacter) {
            // append the indicator and a replacement for the guid
            normalized.append(lambdaFrameIndicator).append("?");
            // normalize the rest of the method
            normalizeFrame(frame, normalized, getNextPeriodIndex(frame, index + lambdaFrameIndicator.length()));
        } else if (nextCharacter == sfdcGeneratedBeginningCharacter) {
            // append the indicator and a replacement for the guid
            normalized.append(sfdcGeneratedFrameIndicator).append("?");
            // skip over the guid until we reach the '.' indicating the start of the method name
            // normalize the rest of the method
            normalizeFrame(frame, normalized, getNextPeriodIndex(frame, index + sfdcGeneratedFrameIndicator.length()));
        } else {
            // neither lambda nor sfdc generated code, just normalize the rest
            normalizeFrame(frame, normalized, index);
        }
    }

    private static boolean shouldNormalizeCharacter(final char c) {
        // valid characters are [a-zA-Z.$<>] -> normalize everything else
        // (we don't check for c == '$' here because we've done it above in lambda checks)
        return !(Character.isLetter(c) || (c == '.' || c == '<' || c == '>'));
    }

    private static boolean frameIsLambda(final String frame, final int index, final boolean previousCharacterDollarSign) {
        return previousCharacterDollarSign && frame.length() > index + 1;
    }

    private static int getNextPeriodIndex(final String frame, final int start) {
        int skipTo = start;
        while (skipTo < frame.length() && frame.charAt(skipTo) != '.') {
            skipTo++;
        }
        return skipTo;
    }

    public static byte[] compress(final byte[] bytes) throws IOException {
        if (bytes == null || bytes.length == 0) {
            return new byte[0];
        }

        try (final ByteArrayOutputStream bos = new ByteArrayOutputStream(bytes.length);
             final GZIPOutputStream gzip = new GZIPOutputStream(bos)) {
            gzip.write(bytes);
            gzip.finish();
            return bos.toByteArray();
        }
    }

    public static byte[] decompress(final byte[] compressedBytes) throws IOException {
        if (compressedBytes == null || compressedBytes.length == 0) {
            return new byte[0];
        }

        final byte[] unzippedPayload;
        try (final ByteArrayInputStream byteStream = new ByteArrayInputStream(compressedBytes);
             final GZIPInputStream gzis = new GZIPInputStream(byteStream)) {
            unzippedPayload = ByteStreams.toByteArray(gzis);
        }

        return unzippedPayload;
    }

    public static String toJson(final Object object) {
        try {
            return objectMapper.writeValueAsString(object);
        } catch (final JsonProcessingException e) {
            return "{\"error\": \"" +
                    e.getMessage() +
                    "\"}";
        }
    }

    public static Object readValue(final String json, final Class cls) throws IOException{
        try {
            return objectMapper.readValue(json, cls);
        } catch (final JsonProcessingException e) {
            return "{\"error\": \"" +
                    e.getMessage() +
                    "\"}";
        }
    }

    public static String generateGuid() {
        return UUID.randomUUID().toString();
    }

}
