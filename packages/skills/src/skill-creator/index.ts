import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import { createNote, getUserNotes } from "@evva/database";

/**
 * Skill Creator — the agent can design new skills.
 *
 * Since we can't write files at runtime in a deployed environment,
 * this skill generates the skill specification as a note that a
 * developer can later implement. It also stores the spec in a
 * structured format ready for code generation.
 *
 * Flow:
 * 1. User describes what they want: "Quiero que puedas controlar mi Spotify"
 * 2. Claude analyzes the request and generates a skill spec
 * 3. The spec is saved as a note with the skill definition
 * 4. A developer (or future automation) can implement it
 */
export const skillCreatorSkill: SkillDefinition = {
  name: "skill-creator",
  description:
    "Diseña y propone nuevos skills cuando el usuario pide funcionalidades que no existen",
  category: "utility",
  forProfiles: ["young", "adult"],

  buildTools: (ctx) => ({
    design_new_skill: tool({
      description:
        "Diseña un nuevo skill cuando el usuario pide una funcionalidad que no existe. " +
        "Analiza lo que el usuario quiere, define los tools necesarios, y genera una especificacion. " +
        "Usalo cuando el usuario diga 'quiero que puedas...', 'seria genial si pudieras...', " +
        "'puedes agregar...', o pida algo que no esta en tus capacidades actuales.",
      parameters: z.object({
        skill_name: z
          .string()
          .describe(
            "Nombre del skill en kebab-case (ej: 'spotify-control', 'uber-integration')",
          ),
        description: z
          .string()
          .describe("Descripcion de lo que hace el skill"),
        category: z
          .enum([
            "productivity",
            "communication",
            "finance",
            "health",
            "utility",
            "search",
          ])
          .describe("Categoria del skill"),
        tools: z
          .array(
            z.object({
              name: z.string().describe("Nombre del tool (snake_case)"),
              description: z
                .string()
                .describe("Que hace este tool"),
              parameters: z
                .string()
                .describe(
                  "Parametros que recibe (descripcion textual)",
                ),
            }),
          )
          .describe("Lista de tools que necesita el skill"),
        required_env: z
          .array(z.string())
          .optional()
          .describe("Variables de entorno necesarias (API keys, etc.)"),
        requires_oauth: z
          .string()
          .optional()
          .describe("Provider OAuth necesario (google, spotify, etc.)"),
        external_apis: z
          .array(z.string())
          .optional()
          .describe("APIs externas que usaria"),
        user_request: z
          .string()
          .describe("Lo que el usuario pidio originalmente"),
      }),
      execute: async ({
        skill_name,
        description,
        category,
        tools,
        required_env,
        requires_oauth,
        external_apis,
        user_request,
      }) => {
        try {
          const spec = [
            `# Skill Request: ${skill_name}`,
            ``,
            `## Solicitud del usuario`,
            `${user_request}`,
            ``,
            `## Especificacion`,
            `- **Nombre:** ${skill_name}`,
            `- **Descripcion:** ${description}`,
            `- **Categoria:** ${category}`,
            required_env
              ? `- **Variables de entorno:** ${required_env.join(", ")}`
              : null,
            requires_oauth
              ? `- **OAuth requerido:** ${requires_oauth}`
              : null,
            external_apis
              ? `- **APIs externas:** ${external_apis.join(", ")}`
              : null,
            ``,
            `## Tools`,
            ...tools.map(
              (t) =>
                `### ${t.name}\n- **Descripcion:** ${t.description}\n- **Parametros:** ${t.parameters}`,
            ),
            ``,
            `## Implementacion`,
            `Archivo: packages/skills/src/${skill_name}/index.ts`,
            `Registrar en: packages/skills/src/index.ts`,
            ``,
            `Estado: PENDIENTE`,
          ]
            .filter(Boolean)
            .join("\n");

          // Save as a note for the developer
          await createNote({
            userId: ctx.user.id,
            title: `Skill Request: ${skill_name}`,
            content: spec,
            isList: false,
          });

          return {
            success: true,
            skill_name,
            tools_count: tools.length,
            spec_preview: `${description} (${tools.length} tools: ${tools.map((t) => t.name).join(", ")})`,
            message: `Skill "${skill_name}" disenado con ${tools.length} tools. La especificacion se guardo como nota. Un desarrollador puede implementarlo en packages/skills/src/${skill_name}/index.ts`,
          };
        } catch {
          return {
            success: false,
            error: "No se pudo guardar la especificacion del skill",
          };
        }
      },
    }),

    list_skill_requests: tool({
      description:
        "Lista los skills que el usuario ha solicitado y que estan pendientes de implementar.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const notes = await getUserNotes(ctx.user.id);
          const requests = notes.filter((n) =>
            n.title.startsWith("Skill Request:"),
          );

          if (requests.length === 0) {
            return {
              success: true,
              requests: [],
              message: "No hay solicitudes de skills pendientes.",
            };
          }

          return {
            success: true,
            requests: requests.map((r) => ({
              title: r.title,
              content: r.content.slice(0, 200) + "...",
              createdAt: r.createdAt.toISOString().split("T")[0],
            })),
          };
        } catch {
          return {
            success: false,
            error: "No se pudieron listar las solicitudes",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- design_new_skill: Cuando el usuario pida una funcionalidad que NO tienes, disena un nuevo skill con sus tools y guardalo como especificacion.",
    "- list_skill_requests: Lista skills solicitados por el usuario pendientes de implementar.",
    "REGLA: Si el usuario pide algo que no puedes hacer, NO digas 'no puedo'. En su lugar, usa design_new_skill para disenar la solucion y explicale que un desarrollador puede implementarla.",
  ],
};
