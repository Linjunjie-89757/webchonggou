package com.company.autoplatform.apiautomation;

import com.company.autoplatform.common.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.company.autoplatform.apiautomation.ApiAutomationModels.ApiKeyValueInput;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApiVariableResolverTests {

    private final ApiVariableResolver resolver = new ApiVariableResolver();

    @Test
    void replaceVariablesKeepsMissingVariableFailureBehavior() {
        assertThat(resolver.replaceVariables("Bearer {{ token }}", Map.of("token", "abc")))
                .isEqualTo("Bearer abc");

        assertThatThrownBy(() -> resolver.replaceVariables("Bearer {{missing}}", Map.of()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Missing variable: missing");
    }

    @Test
    void toEnabledMapFiltersDisabledItemsAndResolvesValuesOnly() {
        Map<String, String> result = resolver.toEnabledMap(List.of(
                item("X-Token", "{{token}}", true, null),
                item("X-Skip", "skip", false, null),
                item("{{rawKey}}", "raw", true, null)
        ), Map.of("token", "abc", "rawKey", "resolved-key"));

        assertThat(result)
                .containsEntry("X-Token", "abc")
                .containsEntry("{{rawKey}}", "raw")
                .doesNotContainKey("X-Skip");
    }

    @Test
    void buildQueryStringResolvesKeysAndValuesAndHonorsEncodeFlag() {
        String query = resolver.buildQueryString(List.of(
                item("plain", "{{value}}", true, false),
                item("{{encodedKey}}", "a b", true, true),
                item("disabled", "nope", false, true)
        ), Map.of("value", "ok", "encodedKey", "hello key"));

        assertThat(query).isEqualTo("plain=ok&hello+key=a+b");
    }

    @Test
    void replaceVariablesResolvesStatelessDynamicFunctions() {
        String result = resolver.replaceVariables("""
                ts={{$timestamp()}}
                sec={{$timestamp('s')}}
                day={{$date('yyyyMMdd')}}
                plus={{$dateAdd(1,'day','yyyy-MM-dd')}}
                minus={{$dateSub(1,'day','yyyy-MM-dd')}}
                int={{$randomInt(10, 99)}}
                str={{$randomStr(8)}}
                num={{$randomStr(6,'number')}}
                money={{$randomFloat(2, 0.01, 9.99)}}
                uuid={{$uuid()}}
                md5={{$md5('abc')}}
                sha={{$sha256('abc')}}
                b64={{$base64Encode('abc')}}
                url={{$urlEncode('a b')}}
                """, Map.of());

        assertThat(result).contains("md5=900150983cd24fb0d6963f7d28e17f72");
        assertThat(result).contains("sha=ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
        assertThat(result).contains("b64=YWJj");
        assertThat(result).contains("url=a+b");
        assertThat(result).containsPattern("ts=\\d{13}");
        assertThat(result).containsPattern("sec=\\d{10}");
        assertThat(result).containsPattern("day=\\d{8}");
        assertThat(result).containsPattern("plus=\\d{4}-\\d{2}-\\d{2}");
        assertThat(result).containsPattern("minus=\\d{4}-\\d{2}-\\d{2}");
        assertThat(result).containsPattern("int=\\d{2}");
        assertThat(result).containsPattern("str=[A-Za-z0-9]{8}");
        assertThat(result).containsPattern("num=\\d{6}");
        assertThat(result).containsPattern("money=\\d+\\.\\d{2}");
        assertThat(result).containsPattern("uuid=[0-9a-fA-F-]{36}");
    }

    @Test
    void replaceVariablesResolvesNestedVariablesBeforeDynamicFunctions() {
        String result = resolver.replaceVariables("sign={{$md5({{sign_str}})}}", Map.of("sign_str", "abc"));

        assertThat(result).isEqualTo("sign=900150983cd24fb0d6963f7d28e17f72");
    }

    @Test
    void resolveVariableValuesAllowsVariableSetValuesToUseDynamicFunctions() {
        Map<String, String> result = resolver.resolveVariableValues(Map.of(
                "plain", "abc",
                "name", "测试商品_{{$randomInt(1000, 9999)}}",
                "signature", "{{$md5({{plain}})}}"
        ));

        assertThat(result.get("plain")).isEqualTo("abc");
        assertThat(result.get("name")).containsPattern("测试商品_\\d{4}");
        assertThat(result.get("signature")).isEqualTo("900150983cd24fb0d6963f7d28e17f72");
    }

    @Test
    void replaceVariablesResolvesBusinessDataDynamicFunctions() {
        String result = resolver.replaceVariables("""
                mobile={{$randomMobile()}}
                email={{$randomEmail()}}
                name={{$randomName()}}
                idCard={{$randomIdCard()}}
                bornIdCard={{$randomIdCard('1990-01-01')}}
                flag={{$randomBoolean()}}
                """, Map.of());

        assertThat(result).containsPattern("mobile=1[3-9]\\d{9}");
        assertThat(result).containsPattern("email=test_[A-Za-z0-9]{8}@example\\.com");
        assertThat(result).containsPattern("name=[\\u4e00-\\u9fa5]{2,3}");
        assertThat(result).containsPattern("idCard=\\d{17}[0-9X]");
        assertThat(result).containsPattern("bornIdCard=\\d{6}19900101\\d{3}[0-9X]");
        assertThat(result).containsPattern("flag=(true|false)");
    }

    private ApiKeyValueInput item(String key, String value, Boolean enabled, Boolean encode) {
        return new ApiKeyValueInput(key, value, null, enabled, null, null, encode, null, null, null, null, null);
    }
}
