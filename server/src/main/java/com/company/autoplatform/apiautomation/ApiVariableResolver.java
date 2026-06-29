package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.BadRequestException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.net.URLEncoder;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiKeyValueInput;

@Component
public class ApiVariableResolver {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([\\w.-]+)\\s*}}|\\$\\{\\s*([\\w.-]+)\\s*}");
    private static final Pattern FUNCTION_START_PATTERN = Pattern.compile("\\{\\{\\$\\s*([A-Za-z][A-Za-z0-9_]*)\\s*\\(");
    private static final ZoneId DEFAULT_ZONE = ZoneId.systemDefault();
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final String LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final String NUMBERS = "0123456789";
    private static final String[] MOBILE_PREFIXES = {"130", "131", "132", "133", "135", "136", "137", "138", "139", "150", "151", "152", "157", "158", "159", "166", "170", "171", "172", "173", "175", "176", "177", "178", "180", "181", "182", "183", "185", "186", "187", "188", "189", "198", "199"};
    private static final String[] FAMILY_NAMES = {"张", "王", "李", "赵", "刘", "陈", "杨", "黄", "周", "吴", "徐", "孙", "胡", "朱", "高", "林"};
    private static final String[] GIVEN_NAME_CHARS = {"一", "子", "小", "明", "华", "欣", "宇", "轩", "泽", "然", "佳", "琪", "涵", "宁", "晨", "悦"};

    public String replaceVariables(String text, Map<String, String> variables) {
        if (text == null || text.isBlank()) {
            return text;
        }
        String withFunctions = replaceFunctions(text, variables == null ? Map.of() : variables);
        Matcher matcher = VARIABLE_PATTERN.matcher(withFunctions);
        StringBuffer buffer = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1) == null ? matcher.group(2) : matcher.group(1);
            if (variables == null || !variables.containsKey(key)) {
                throw new BadRequestException("Missing variable: " + key);
            }
            matcher.appendReplacement(buffer, Matcher.quoteReplacement(Optional.ofNullable(variables.get(key)).orElse("")));
        }
        matcher.appendTail(buffer);
        return buffer.toString();
    }

    public Map<String, String> resolveVariableValues(Map<String, String> variables) {
        LinkedHashMap<String, String> resolved = new LinkedHashMap<>();
        if (variables == null || variables.isEmpty()) {
            return resolved;
        }
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            resolved.put(entry.getKey(), entry.getValue());
        }
        for (Map.Entry<String, String> entry : variables.entrySet()) {
            resolved.put(entry.getKey(), replaceVariables(entry.getValue(), resolved));
        }
        return resolved;
    }

    public Map<String, String> toEnabledMap(List<ApiKeyValueInput> items, Map<String, String> variables) {
        LinkedHashMap<String, String> result = new LinkedHashMap<>();
        for (ApiKeyValueInput item : items) {
            if (item == null || item.key() == null || item.key().isBlank() || Boolean.FALSE.equals(item.enabled())) {
                continue;
            }
            result.put(item.key(), replaceVariables(Optional.ofNullable(item.value()).orElse(""), variables));
        }
        return result;
    }

    public String buildQueryString(List<ApiKeyValueInput> items, Map<String, String> variables) {
        List<String> parts = new ArrayList<>();
        for (ApiKeyValueInput item : items) {
            if (item == null || item.key() == null || item.key().isBlank() || Boolean.FALSE.equals(item.enabled())) {
                continue;
            }
            String key = replaceVariables(item.key(), variables);
            String value = replaceVariables(Optional.ofNullable(item.value()).orElse(""), variables);
            if (Boolean.TRUE.equals(item.encode())) {
                key = URLEncoder.encode(key, StandardCharsets.UTF_8);
                value = URLEncoder.encode(value, StandardCharsets.UTF_8);
            }
            parts.add(key + "=" + value);
        }
        return String.join("&", parts);
    }

    public String buildQueryString(Map<String, String> values) {
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            parts.add(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8)
                    + "="
                    + URLEncoder.encode(Optional.ofNullable(entry.getValue()).orElse(""), StandardCharsets.UTF_8));
        }
        return String.join("&", parts);
    }

    private String replaceFunctions(String text, Map<String, String> variables) {
        String current = text;
        for (int guard = 0; guard < 20; guard++) {
            FunctionCall call = findFirstFunctionCall(current);
            if (call == null) {
                return current;
            }
            String value = evaluateFunction(call.name(), call.arguments(), variables);
            current = current.substring(0, call.start()) + value + current.substring(call.end());
        }
        throw new BadRequestException("Dynamic function nesting is too deep");
    }

    private FunctionCall findFirstFunctionCall(String text) {
        Matcher matcher = FUNCTION_START_PATTERN.matcher(text);
        while (matcher.find()) {
            int argsStart = matcher.end();
            int index = argsStart;
            int depth = 1;
            char quote = 0;
            while (index < text.length()) {
                char ch = text.charAt(index);
                if (quote != 0) {
                    if (ch == '\\' && index + 1 < text.length()) {
                        index += 2;
                        continue;
                    }
                    if (ch == quote) {
                        quote = 0;
                    }
                } else if (ch == '\'' || ch == '"') {
                    quote = ch;
                } else if (ch == '(') {
                    depth++;
                } else if (ch == ')') {
                    depth--;
                    if (depth == 0 && index + 2 < text.length() && text.charAt(index + 1) == '}' && text.charAt(index + 2) == '}') {
                        return new FunctionCall(matcher.start(), index + 3, matcher.group(1), text.substring(argsStart, index));
                    }
                }
                index++;
            }
        }
        return null;
    }

    private String evaluateFunction(String name, String rawArguments, Map<String, String> variables) {
        List<String> args = parseArguments(rawArguments).stream()
                .map(argument -> replaceVariables(stripQuotes(argument), variables))
                .toList();
        String functionName = name.toLowerCase();
        return switch (functionName) {
            case "timestamp" -> timestamp(args);
            case "date" -> formatNow(requiredArg(args, 0, "date"));
            case "dateadd" -> formatDateShift(args, true);
            case "datesub" -> formatDateShift(args, false);
            case "randomint" -> randomInt(args);
            case "randomstr" -> randomStr(args);
            case "randomfloat" -> randomFloat(args);
            case "uuid" -> UUID.randomUUID().toString();
            case "md5" -> digest("MD5", requiredArg(args, 0, "md5"));
            case "sha256" -> digest("SHA-256", requiredArg(args, 0, "sha256"));
            case "base64encode" -> Base64.getEncoder().encodeToString(requiredArg(args, 0, "base64Encode").getBytes(StandardCharsets.UTF_8));
            case "base64decode" -> new String(Base64.getDecoder().decode(requiredArg(args, 0, "base64Decode")), StandardCharsets.UTF_8);
            case "urlencode" -> URLEncoder.encode(requiredArg(args, 0, "urlEncode"), StandardCharsets.UTF_8);
            case "randommobile" -> randomMobile();
            case "randomemail" -> "test_" + randomString(8, ALPHANUMERIC) + "@example.com";
            case "randomname" -> randomName();
            case "randomidcard" -> randomIdCard(args.isEmpty() ? null : args.getFirst());
            case "randomboolean" -> String.valueOf(ThreadLocalRandom.current().nextBoolean());
            default -> throw new BadRequestException("Unsupported dynamic function: " + name);
        };
    }

    private List<String> parseArguments(String rawArguments) {
        List<String> args = new ArrayList<>();
        if (rawArguments == null || rawArguments.isBlank()) {
            return args;
        }
        StringBuilder current = new StringBuilder();
        char quote = 0;
        int parenDepth = 0;
        int braceDepth = 0;
        for (int i = 0; i < rawArguments.length(); i++) {
            char ch = rawArguments.charAt(i);
            if (quote != 0) {
                current.append(ch);
                if (ch == '\\' && i + 1 < rawArguments.length()) {
                    current.append(rawArguments.charAt(++i));
                } else if (ch == quote) {
                    quote = 0;
                }
                continue;
            }
            if (ch == '\'' || ch == '"') {
                quote = ch;
                current.append(ch);
            } else if (ch == '(') {
                parenDepth++;
                current.append(ch);
            } else if (ch == ')') {
                parenDepth--;
                current.append(ch);
            } else if (ch == '{') {
                braceDepth++;
                current.append(ch);
            } else if (ch == '}') {
                braceDepth--;
                current.append(ch);
            } else if (ch == ',' && parenDepth == 0 && braceDepth == 0) {
                args.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        args.add(current.toString().trim());
        return args;
    }

    private String stripQuotes(String value) {
        if (value == null || value.length() < 2) {
            return Optional.ofNullable(value).orElse("");
        }
        String trimmed = value.trim();
        char first = trimmed.charAt(0);
        char last = trimmed.charAt(trimmed.length() - 1);
        if ((first == '\'' && last == '\'') || (first == '"' && last == '"')) {
            return trimmed.substring(1, trimmed.length() - 1)
                    .replace("\\'", "'")
                    .replace("\\\"", "\"")
                    .replace("\\\\", "\\");
        }
        return trimmed;
    }

    private String timestamp(List<String> args) {
        long millis = System.currentTimeMillis();
        if (!args.isEmpty() && "s".equalsIgnoreCase(args.getFirst())) {
            return String.valueOf(millis / 1000);
        }
        return String.valueOf(millis);
    }

    private String formatNow(String pattern) {
        return LocalDateTime.now(DEFAULT_ZONE).format(toFormatter(pattern));
    }

    private String formatDateShift(List<String> args, boolean add) {
        long amount = parseLong(requiredArg(args, 0, add ? "dateAdd" : "dateSub"), add ? "dateAdd amount" : "dateSub amount");
        String unit = requiredArg(args, 1, add ? "dateAdd" : "dateSub").toLowerCase();
        String pattern = requiredArg(args, 2, add ? "dateAdd" : "dateSub");
        LocalDateTime value = LocalDateTime.now(DEFAULT_ZONE);
        long delta = add ? amount : -amount;
        value = switch (unit) {
            case "year", "years" -> value.plusYears(delta);
            case "month", "months" -> value.plusMonths(delta);
            case "day", "days" -> value.plusDays(delta);
            case "hour", "hours" -> value.plusHours(delta);
            case "minute", "minutes" -> value.plusMinutes(delta);
            case "second", "seconds" -> value.plusSeconds(delta);
            default -> throw new BadRequestException("Unsupported date unit: " + unit);
        };
        return value.format(toFormatter(pattern));
    }

    private DateTimeFormatter toFormatter(String pattern) {
        String javaPattern = pattern
                .replace("YYYY", "yyyy")
                .replace("DD", "dd");
        return DateTimeFormatter.ofPattern(javaPattern);
    }

    private String randomInt(List<String> args) {
        int min = parseInt(requiredArg(args, 0, "randomInt"), "randomInt min");
        int max = parseInt(requiredArg(args, 1, "randomInt"), "randomInt max");
        if (max < min) {
            throw new BadRequestException("randomInt max must be greater than or equal to min");
        }
        return String.valueOf(ThreadLocalRandom.current().nextInt(min, max + 1));
    }

    private String randomStr(List<String> args) {
        int length = parseInt(requiredArg(args, 0, "randomStr"), "randomStr length");
        String mode = args.size() > 1 ? args.get(1).toLowerCase() : "mixed";
        String source = switch (mode) {
            case "number", "numeric" -> NUMBERS;
            case "letter", "alpha" -> LETTERS;
            default -> ALPHANUMERIC;
        };
        return randomString(length, source);
    }

    private String randomString(int length, String source) {
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < length; i++) {
            result.append(source.charAt(ThreadLocalRandom.current().nextInt(source.length())));
        }
        return result.toString();
    }

    private String randomFloat(List<String> args) {
        int scale = parseInt(requiredArg(args, 0, "randomFloat"), "randomFloat scale");
        double min = parseDouble(requiredArg(args, 1, "randomFloat"), "randomFloat min");
        double max = parseDouble(requiredArg(args, 2, "randomFloat"), "randomFloat max");
        if (max < min) {
            throw new BadRequestException("randomFloat max must be greater than or equal to min");
        }
        double value = ThreadLocalRandom.current().nextDouble(min, Math.nextUp(max));
        return BigDecimal.valueOf(value).setScale(scale, RoundingMode.HALF_UP).toPlainString();
    }

    private String digest(String algorithm, String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance(algorithm);
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte current : bytes) {
                builder.append(String.format("%02x", current));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new BadRequestException("Unsupported digest algorithm: " + algorithm);
        }
    }

    private String randomMobile() {
        String prefix = MOBILE_PREFIXES[ThreadLocalRandom.current().nextInt(MOBILE_PREFIXES.length)];
        return prefix + randomString(8, NUMBERS);
    }

    private String randomName() {
        String familyName = FAMILY_NAMES[ThreadLocalRandom.current().nextInt(FAMILY_NAMES.length)];
        int givenLength = ThreadLocalRandom.current().nextInt(1, 3);
        StringBuilder givenName = new StringBuilder();
        for (int i = 0; i < givenLength; i++) {
            givenName.append(GIVEN_NAME_CHARS[ThreadLocalRandom.current().nextInt(GIVEN_NAME_CHARS.length)]);
        }
        return familyName + givenName;
    }

    private String randomIdCard(String birthday) {
        String areaCode = String.valueOf(ThreadLocalRandom.current().nextInt(110000, 659005));
        String birth = birthday == null || birthday.isBlank()
                ? randomBirthday()
                : birthday.replace("-", "");
        if (!birth.matches("\\d{8}")) {
            throw new BadRequestException("randomIdCard birthday must use yyyy-MM-dd or yyyyMMdd");
        }
        String body = areaCode + birth + randomString(3, NUMBERS);
        return body + idCardCheckCode(body);
    }

    private String randomBirthday() {
        int year = ThreadLocalRandom.current().nextInt(1970, 2006);
        int month = ThreadLocalRandom.current().nextInt(1, 13);
        int day = ThreadLocalRandom.current().nextInt(1, 29);
        return "%04d%02d%02d".formatted(year, month, day);
    }

    private String idCardCheckCode(String body) {
        int[] weights = {7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2};
        char[] codes = {'1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'};
        int sum = 0;
        for (int i = 0; i < body.length(); i++) {
            sum += (body.charAt(i) - '0') * weights[i];
        }
        return String.valueOf(codes[sum % 11]);
    }

    private String requiredArg(List<String> args, int index, String functionName) {
        if (args.size() <= index || args.get(index) == null || args.get(index).isBlank()) {
            throw new BadRequestException(functionName + " requires argument " + (index + 1));
        }
        return args.get(index);
    }

    private int parseInt(String value, String label) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException exception) {
            throw new BadRequestException(label + " must be an integer");
        }
    }

    private long parseLong(String value, String label) {
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException exception) {
            throw new BadRequestException(label + " must be an integer");
        }
    }

    private double parseDouble(String value, String label) {
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException exception) {
            throw new BadRequestException(label + " must be a number");
        }
    }

    private record FunctionCall(
            int start,
            int end,
            String name,
            String arguments
    ) {
    }
}
