import { tool } from "ai";
import { z } from "zod";
import {
  createNote,
  getUserNotes,
  findNoteByTitle,
  updateNote,
  deleteNote,
} from "@evva/database";
import type { NoteItem } from "@evva/core";
import type { SkillDefinition } from "../base-skill.js";

export const notesSkill: SkillDefinition = {
  name: "notes",
  description: "Crea, consulta y modifica notas y listas del usuario",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    create_note: tool({
      description:
        "Crea una nota o lista para el usuario. " +
        "Úsalo cuando el usuario quiera anotar algo, crear una lista de compras, " +
        "lista de pendientes, o cualquier nota de texto.",
      parameters: z.object({
        title: z.string().describe("Título de la nota o lista"),
        content: z
          .string()
          .optional()
          .describe("Contenido de la nota (para notas de texto libre)"),
        is_list: z
          .boolean()
          .default(false)
          .describe("true si es una lista con items"),
        items: z
          .array(z.string())
          .optional()
          .describe("Items de la lista (solo si is_list es true)"),
      }),
      execute: async ({ title, content, is_list, items }) => {
        try {
          const noteItems: NoteItem[] =
            items?.map((text) => ({ text, checked: false })) ?? [];
          const note = await createNote({
            userId: ctx.user.id,
            title,
            content: content ?? "",
            isList: is_list,
            items: noteItems,
          });
          return { success: true, noteId: note.id, title };
        } catch (error) {
          return { success: false, error: "No se pudo crear la nota" };
        }
      },
    }),

    get_notes: tool({
      description:
        "Muestra las notas y listas activas del usuario. " +
        "Úsalo cuando el usuario pregunte por sus notas, listas, pendientes o quiera ver lo que tiene anotado.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const notes = await getUserNotes(ctx.user.id);
          if (notes.length === 0) {
            return {
              success: true,
              notes: [],
              message: "No hay notas guardadas",
            };
          }
          return {
            success: true,
            notes: notes.map((n) => ({
              id: n.id,
              title: n.title,
              content: n.isList ? undefined : n.content,
              items: n.isList ? n.items : undefined,
              isPinned: n.isPinned,
              updatedAt: n.updatedAt.toISOString(),
            })),
          };
        } catch (error) {
          return { success: false, error: "No se pudieron obtener las notas" };
        }
      },
    }),

    update_note: tool({
      description:
        "Modifica una nota o lista existente. " +
        "Úsalo para agregar items a una lista, tachar items, cambiar el contenido, o archivar/eliminar una nota.",
      parameters: z.object({
        title: z.string().describe("Título de la nota a modificar"),
        action: z
          .enum([
            "add_items",
            "check_item",
            "uncheck_item",
            "update_content",
            "archive",
            "delete",
          ])
          .describe("Acción a realizar sobre la nota"),
        items: z
          .array(z.string())
          .optional()
          .describe("Items a agregar (solo para add_items)"),
        item_text: z
          .string()
          .optional()
          .describe("Texto del item a tachar/destachar"),
        new_content: z
          .string()
          .optional()
          .describe("Nuevo contenido (solo para update_content)"),
      }),
      execute: async ({ title, action, items, item_text, new_content }) => {
        try {
          const note = await findNoteByTitle(ctx.user.id, title);
          if (!note) {
            return {
              success: false,
              error: `No encontré una nota llamada "${title}"`,
            };
          }

          switch (action) {
            case "add_items": {
              const newItems = [
                ...(note.items ?? []),
                ...(items ?? []).map((t) => ({ text: t, checked: false })),
              ];
              await updateNote(note.id, ctx.user.id, { items: newItems });
              return {
                success: true,
                message: `${items?.length ?? 0} items agregados a "${title}"`,
              };
            }
            case "check_item":
            case "uncheck_item": {
              const updatedItems = (note.items ?? []).map((item) =>
                item.text
                  .toLowerCase()
                  .includes((item_text ?? "").toLowerCase())
                  ? { ...item, checked: action === "check_item" }
                  : item,
              );
              await updateNote(note.id, ctx.user.id, { items: updatedItems });
              return {
                success: true,
                message: `Item "${item_text}" ${action === "check_item" ? "tachado" : "destacado"}`,
              };
            }
            case "update_content":
              await updateNote(note.id, ctx.user.id, {
                content: new_content ?? "",
              });
              return { success: true, message: `Nota "${title}" actualizada` };
            case "archive":
              await updateNote(note.id, ctx.user.id, { isArchived: true });
              return { success: true, message: `Nota "${title}" archivada` };
            case "delete":
              await deleteNote(note.id, ctx.user.id);
              return { success: true, message: `Nota "${title}" eliminada` };
            default:
              return { success: false, error: "Acción no reconocida" };
          }
        } catch (error) {
          return { success: false, error: "No se pudo modificar la nota" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- create_note: Crea una nota o lista (compras, pendientes, texto libre)",
    "- get_notes: Muestra todas las notas y listas activas del usuario",
    "- update_note: Modifica una nota existente (agregar items, tachar, archivar, eliminar)",
  ],
};
