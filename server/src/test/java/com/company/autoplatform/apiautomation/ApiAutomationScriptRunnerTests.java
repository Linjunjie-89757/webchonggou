
package com.company.autoplatform.apiautomation;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ApiAutomationScriptRunnerTests {

    private final ApiAutomationScriptRunner scriptRunner = new ApiAutomationScriptRunner();

    @Test
    void scriptRunnerSupportsUnifiedVariablesAndUtilsApi() {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("seed", "alpha");

        ApiAutomationScriptRunner.ScriptExecutionResult result = scriptRunner.execute("""
                variables.set('token', variables.get('seed') + '-token');
                variables.unset('seed');
                log(utils.upper('ok'));
                """, variables, Map.of(), Map.of());

        assertThat(result.success()).isTrue();
        assertThat(result.variables()).containsEntry("token", "alpha-token");
        assertThat(result.variables()).doesNotContainKey("seed");
        assertThat(result.logs()).contains("OK");
    }

    @Test
    void scriptRunnerBlocksFunctionConstructorEscape() {
        ApiAutomationScriptRunner.ScriptExecutionResult result = scriptRunner.execute("""
                setVar('leak', Function('return process')().cwd());
                """, new LinkedHashMap<>(), Map.of(), Map.of());

        assertThat(result.success()).isFalse();
        assertThat(result.variables()).doesNotContainKey("leak");
        assertThat(result.message()).contains("Function");
    }

    @Test
    void scriptRunnerBlocksConstructorConstructorEscape() {
        ApiAutomationScriptRunner.ScriptExecutionResult result = scriptRunner.execute("""
                variables.set('leak', this.constructor.constructor('return 1')());
                """, new LinkedHashMap<>(), Map.of(), Map.of());

        assertThat(result.success()).isFalse();
        assertThat(result.variables()).doesNotContainKey("leak");
        assertThat(result.message()).contains("constructor");
    }
}
