import { tool } from "ai";
import { z } from "zod";
import { saveFactForRAG } from "../rag-helper.js";
import {
  createEmergencyContact,
  getUserEmergencyContacts,
} from "@evva/database";
import type { SkillDefinition } from "../base-skill.js";

export const emergencySkill: SkillDefinition = {
  name: "emergency",
  description: "Gestión de contactos de emergencia del usuario",
  category: "health",
  forProfiles: ["senior", "adult"],

  buildTools: (ctx) => ({
    add_emergency_contact: tool({
      description:
        "Registra un contacto de emergencia. Úsalo cuando el usuario quiera guardar a alguien como contacto de emergencia.",
      parameters: z.object({
        name: z.string().describe("Nombre del contacto"),
        phone: z.string().describe("Teléfono"),
        relationship: z
          .string()
          .describe("Relación (hijo, esposa, doctor, vecino, etc.)"),
        is_primary: z
          .boolean()
          .default(false)
          .describe("true si es el contacto principal"),
      }),
      execute: async ({ name, phone, relationship, is_primary }) => {
        try {
          const contact = await createEmergencyContact({
            userId: ctx.user.id,
            name,
            phone,
            relationship,
            isPrimary: is_primary,
          });
          await saveFactForRAG({
            userId: ctx.user.id,
            content: `Contacto de emergencia: ${name}, tel: ${phone}, relacion: ${relationship}${is_primary ? " (principal)" : ""}`,
            category: "relationship",
            importance: 0.9,
          });
          return {
            success: true,
            contactId: contact.id,
            name,
            phone,
            relationship,
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo registrar el contacto de emergencia",
          };
        }
      },
    }),

    get_emergency_contacts: tool({
      description: "Muestra los contactos de emergencia del usuario.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const contacts = await getUserEmergencyContacts(ctx.user.id);
          if (contacts.length === 0)
            return {
              success: true,
              contacts: [],
              message: "No tienes contactos de emergencia.",
            };
          return {
            success: true,
            contacts: contacts.map((c) => ({
              name: c.name,
              phone: c.phone,
              relationship: c.relationship,
              isPrimary: c.isPrimary,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron obtener los contactos de emergencia",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- add_emergency_contact: Registra un contacto de emergencia con nombre, teléfono y relación",
    "- get_emergency_contacts: Muestra los contactos de emergencia del usuario",
  ],
};
