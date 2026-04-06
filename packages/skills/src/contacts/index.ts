import { tool } from "ai";
import { z } from "zod";
import { createContact, searchContacts } from "@evva/database";
import { saveFactForRAG } from "../rag-helper.js";
import type { SkillDefinition } from "../base-skill.js";

export const contactsSkill: SkillDefinition = {
  name: "contacts",
  description: "Guarda y busca contactos del usuario",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    save_contact: tool({
      description:
        "Guarda un contacto del usuario. " +
        "Úsalo cuando el usuario comparta datos de una persona: nombre, teléfono, email, o relación.",
      parameters: z.object({
        name: z.string().describe("Nombre del contacto"),
        phone: z.string().optional().describe("Número de teléfono"),
        email: z.string().optional().describe("Email"),
        relationship: z
          .string()
          .optional()
          .describe("Relación con el usuario (dentista, jefe, esposa, etc.)"),
        notes: z
          .string()
          .optional()
          .describe("Notas adicionales sobre el contacto"),
      }),
      execute: async ({ name, phone, email, relationship, notes }) => {
        try {
          const contact = await createContact({
            userId: ctx.user.id,
            name,
            phone,
            email,
            relationship,
            notes,
          });
          await saveFactForRAG({
            userId: ctx.user.id,
            content: `Contacto: ${name}${phone ? ", tel: " + phone : ""}${email ? ", email: " + email : ""}${relationship ? ", relacion: " + relationship : ""}`,
            category: "relationship",
            importance: 0.7,
          });
          return { success: true, contactId: contact.id, name };
        } catch (error) {
          return { success: false, error: "No se pudo guardar el contacto" };
        }
      },
    }),

    search_contacts: tool({
      description:
        "Busca contactos del usuario por nombre o relación. " +
        "Úsalo cuando el usuario pregunte por el teléfono, email o datos de alguien.",
      parameters: z.object({
        query: z.string().describe("Nombre o relación a buscar"),
      }),
      execute: async ({ query }) => {
        try {
          const contacts = await searchContacts(ctx.user.id, query);
          if (contacts.length === 0) {
            return {
              success: true,
              contacts: [],
              message: `No encontré contactos con "${query}"`,
            };
          }
          return {
            success: true,
            contacts: contacts.map((c) => ({
              name: c.name,
              phone: c.phone,
              email: c.email,
              relationship: c.relationship,
              notes: c.notes,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron buscar los contactos",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- save_contact: Guarda un contacto con nombre, teléfono, email y relación",
    "- search_contacts: Busca contactos por nombre o relación",
  ],
};
