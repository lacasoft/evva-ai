import { tool } from "ai";
import { z } from "zod";
import type { Tool } from "ai";
import type { RuntimeSkillConfig } from "@evva/database";

/**
 * Converts a declarative runtime skill config into executable AI SDK tools.
 * Only supports HTTP requests — no code execution, no filesystem, no DB access.
 */
export function buildRuntimeTools(
  config: RuntimeSkillConfig,
): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  for (const toolConfig of config.tools) {
    // Build zod schema from parameter definitions
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const [key, param] of Object.entries(toolConfig.parameters)) {
      switch (param.type) {
        case "number":
          shape[key] = z.number().describe(param.description);
          break;
        case "boolean":
          shape[key] = z.boolean().describe(param.description);
          break;
        default:
          shape[key] = z.string().describe(param.description);
      }
    }

    const paramSchema = z.object(shape);

    tools[toolConfig.name] = tool({
      description: toolConfig.description,
      parameters: paramSchema,
      execute: async (params: Record<string, unknown>) => {
        try {
          // Template URL with parameters
          let url = toolConfig.action.url;
          let body = toolConfig.action.body;
          const headers: Record<string, string> = {
            ...toolConfig.action.headers,
          };

          // Replace {{params.key}} in URL, body, and headers
          for (const [key, value] of Object.entries(params)) {
            const placeholder = `{{params.${key}}}`;
            const strValue = String(value);
            url = url.replace(placeholder, encodeURIComponent(strValue));
            if (body) body = body.replace(placeholder, strValue);
            for (const [hKey, hVal] of Object.entries(headers)) {
              headers[hKey] = hVal.replace(placeholder, strValue);
            }
          }

          // Replace {{env.KEY}} with environment variables
          const envPattern = /\{\{env\.(\w+)\}\}/g;
          url = url.replace(envPattern, (_, key) => process.env[key] ?? "");
          if (body)
            body = body.replace(envPattern, (_, key) => process.env[key] ?? "");
          for (const [hKey, hVal] of Object.entries(headers)) {
            headers[hKey] = hVal.replace(
              envPattern,
              (_, key) => process.env[key] ?? "",
            );
          }

          // Validate URL (security: only allow http/https)
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            return {
              success: false,
              error: "URL invalida — solo se permiten http:// y https://",
            };
          }

          // Execute HTTP request
          const fetchOptions: RequestInit = {
            method: toolConfig.action.method,
            headers,
            signal: AbortSignal.timeout(10_000),
          };

          if (body && toolConfig.action.method !== "GET") {
            fetchOptions.body = body;
            if (!headers["Content-Type"]) {
              headers["Content-Type"] = "application/json";
            }
          }

          const response = await fetch(url, fetchOptions);

          if (!response.ok) {
            return {
              success: false,
              error: `HTTP ${response.status}: ${response.statusText}`,
            };
          }

          const contentType = response.headers.get("content-type") ?? "";
          let data: unknown;

          if (contentType.includes("application/json")) {
            data = await response.json();
          } else {
            const text = await response.text();
            // Truncate large text responses
            data = text.length > 2000 ? text.slice(0, 2000) + "..." : text;
          }

          // Apply response mapping if specified
          if (toolConfig.responseMapping && typeof data === "object") {
            try {
              const path = toolConfig.responseMapping.split(".");
              let result: unknown = data;
              for (const key of path) {
                if (result && typeof result === "object") {
                  result = (result as Record<string, unknown>)[key];
                }
              }
              return { success: true, data: result };
            } catch {
              return { success: true, data };
            }
          }

          return { success: true, data };
        } catch (err) {
          return {
            success: false,
            error: `Error ejecutando skill: ${err instanceof Error ? err.message : "desconocido"}`,
          };
        }
      },
    });
  }

  return tools;
}
