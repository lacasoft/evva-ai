import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import {
  createRuntimeSkill,
  getUserRuntimeSkills,
  disableRuntimeSkill,
  type RuntimeSkillConfig,
} from "@evva/database";

export const skillCreatorSkill: SkillDefinition = {
  name: "skill-creator",
  description:
    "Crea nuevos skills en tiempo de ejecucion cuando el usuario pide funcionalidades que no existen",
  category: "utility",
  forProfiles: ["young", "adult"],

  buildTools: (ctx) => ({
    create_runtime_skill: tool({
      description:
        "Crea un nuevo skill funcional en tiempo real. " +
        "El skill solo puede hacer HTTP requests a APIs externas — es seguro y declarativo. " +
        "Usalo cuando el usuario pida una funcionalidad que no existe. " +
        "Ejemplo: 'Quiero que busques precios en MercadoLibre', 'Quiero saber el estado de mi paquete'. " +
        "El skill queda activo inmediatamente para el usuario.",
      parameters: z.object({
        skill_name: z
          .string()
          .describe(
            "Nombre del skill en kebab-case (ej: 'mercadolibre-search')",
          ),
        description: z.string().describe("Descripcion del skill"),
        category: z
          .enum([
            "productivity",
            "communication",
            "finance",
            "health",
            "utility",
            "search",
          ])
          .default("utility"),
        tools: z
          .array(
            z.object({
              name: z.string().describe("Nombre del tool (snake_case)"),
              description: z.string().describe("Descripcion para el LLM"),
              parameters: z
                .record(
                  z.object({
                    type: z
                      .enum(["string", "number", "boolean"])
                      .default("string"),
                    description: z.string(),
                  }),
                )
                .describe("Parametros que recibe el tool"),
              action: z.object({
                type: z.literal("http_request"),
                url: z
                  .string()
                  .describe(
                    "URL con placeholders {{params.key}} y {{env.KEY}}",
                  ),
                method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
                headers: z.record(z.string()).optional(),
                body: z
                  .string()
                  .optional()
                  .describe("Body template con {{params.key}}"),
              }),
              responseMapping: z
                .string()
                .optional()
                .describe(
                  "Path para extraer datos del response (ej: 'data.results')",
                ),
            }),
          )
          .describe("Tools del skill — cada uno hace un HTTP request"),
      }),
      execute: async ({
        skill_name,
        description,
        category,
        tools: toolConfigs,
      }) => {
        try {
          // Validate: only http/https URLs
          for (const t of toolConfigs) {
            if (
              !t.action.url.startsWith("http://") &&
              !t.action.url.startsWith("https://") &&
              !t.action.url.includes("{{")
            ) {
              return {
                success: false,
                error: `URL invalida en tool ${t.name}: solo se permiten http:// y https://`,
              };
            }
          }

          const config: RuntimeSkillConfig = { tools: toolConfigs };

          const skill = await createRuntimeSkill({
            userId: ctx.user.id,
            name: skill_name,
            description,
            category,
            config,
          });

          return {
            success: true,
            skillId: skill.id,
            name: skill_name,
            toolsCount: toolConfigs.length,
            toolNames: toolConfigs.map((t) => t.name),
            message: `Skill "${skill_name}" creado con ${toolConfigs.length} tools. Ya esta activo — puedes usarlo ahora.`,
          };
        } catch (err) {
          return {
            success: false,
            error: `No se pudo crear el skill: ${err instanceof Error ? err.message : "error desconocido"}`,
          };
        }
      },
    }),

    list_runtime_skills: tool({
      description: "Lista los skills personalizados que el usuario ha creado.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const skills = await getUserRuntimeSkills(ctx.user.id);
          if (skills.length === 0) {
            return {
              success: true,
              skills: [],
              message: "No tienes skills personalizados.",
            };
          }
          return {
            success: true,
            skills: skills.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              tools: s.config.tools.map((t) => t.name),
              active: s.isActive,
            })),
          };
        } catch {
          return { success: false, error: "No se pudieron listar los skills" };
        }
      },
    }),

    disable_runtime_skill: tool({
      description: "Desactiva un skill personalizado del usuario.",
      parameters: z.object({
        skill_name: z.string().describe("Nombre del skill a desactivar"),
      }),
      execute: async ({ skill_name }) => {
        try {
          const skills = await getUserRuntimeSkills(ctx.user.id);
          const skill = skills.find((s) => s.name === skill_name);
          if (!skill) {
            return {
              success: false,
              error: `No encontre un skill llamado "${skill_name}"`,
            };
          }
          await disableRuntimeSkill(skill.id, ctx.user.id);
          return {
            success: true,
            message: `Skill "${skill_name}" desactivado`,
          };
        } catch {
          return { success: false, error: "No se pudo desactivar el skill" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- create_runtime_skill: Crea un skill funcional nuevo que hace HTTP requests. Se activa inmediatamente.",
    "- list_runtime_skills: Lista los skills personalizados del usuario.",
    "- disable_runtime_skill: Desactiva un skill personalizado.",
    "REGLA: Si el usuario pide algo que NO puedes hacer y es posible via una API web publica, usa create_runtime_skill para crearlo en el momento. El skill queda activo inmediatamente.",
  ],
};
