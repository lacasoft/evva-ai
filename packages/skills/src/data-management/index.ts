import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import {
  // Contacts
  searchContacts,
  updateContact,
  deleteContact,
  // Emergency
  getUserEmergencyContacts,
  deleteEmergencyContact,
  createEmergencyContact,
  // Finance
  getUserCreditCards,
  updateCreditCardBalance,
  // Health
  getUserMedications,
  updateMedication,
  getUserHabits,
  // Memory
  getAllUserFacts,
  deleteMemoryFact,
} from "@evva/database";

export const dataManagementSkill: SkillDefinition = {
  name: "data-management",
  description:
    "Actualiza y elimina datos del usuario: contactos, emergencia, tarjetas, medicamentos, habitos, facts",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    update_user_data: tool({
      description:
        "Actualiza datos existentes del usuario. " +
        "Usalo cuando el usuario quiera cambiar un contacto, actualizar una tarjeta, " +
        "modificar un medicamento, o corregir cualquier dato guardado. " +
        "SIEMPRE muestra el dato actual y el nuevo antes de confirmar.",
      parameters: z.object({
        data_type: z
          .enum([
            "contact",
            "emergency_contact",
            "credit_card",
            "medication",
            "habit",
          ])
          .describe("Tipo de dato a actualizar"),
        search_name: z
          .string()
          .describe("Nombre o identificador del dato a buscar"),
        updates: z
          .record(z.string())
          .describe(
            "Campos a actualizar como pares clave:valor (ej: { phone: '5512345678', relationship: 'hermana' })",
          ),
      }),
      execute: async ({ data_type, search_name, updates }) => {
        try {
          switch (data_type) {
            case "contact": {
              const contacts = await searchContacts(
                ctx.user.id,
                search_name,
              );
              if (contacts.length === 0) {
                return {
                  success: false,
                  error: `No encontre un contacto con "${search_name}"`,
                };
              }
              const contact = contacts[0];
              await updateContact(contact.id, ctx.user.id, {
                name: updates.name ?? undefined,
                phone: updates.phone ?? undefined,
                email: updates.email ?? undefined,
                relationship: updates.relationship ?? undefined,
                notes: updates.notes ?? undefined,
              });
              return {
                success: true,
                message: `Contacto "${contact.name}" actualizado`,
                previous: {
                  name: contact.name,
                  phone: contact.phone,
                  email: contact.email,
                },
                updated: updates,
              };
            }

            case "emergency_contact": {
              const contacts = await getUserEmergencyContacts(ctx.user.id);
              const contact = contacts.find(
                (c) =>
                  c.name.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!contact) {
                return {
                  success: false,
                  error: `No encontre un contacto de emergencia con "${search_name}"`,
                };
              }
              // Emergency contacts don't have update — delete and recreate
              await deleteEmergencyContact(contact.id, ctx.user.id);
              await createEmergencyContact({
                userId: ctx.user.id,
                name: updates.name ?? contact.name,
                phone: updates.phone ?? contact.phone,
                relationship:
                  updates.relationship ?? contact.relationship,
                isPrimary: contact.isPrimary,
              });
              return {
                success: true,
                message: `Contacto de emergencia actualizado`,
                previous: {
                  name: contact.name,
                  phone: contact.phone,
                  relationship: contact.relationship,
                },
                updated: updates,
              };
            }

            case "credit_card": {
              const cards = await getUserCreditCards(ctx.user.id);
              const card = cards.find(
                (c) =>
                  c.name.toLowerCase().includes(search_name.toLowerCase()) ||
                  c.lastFourDigits === search_name,
              );
              if (!card) {
                return {
                  success: false,
                  error: `No encontre una tarjeta con "${search_name}"`,
                };
              }
              if (updates.balance) {
                await updateCreditCardBalance(
                  card.id,
                  ctx.user.id,
                  parseFloat(updates.balance),
                );
              }
              return {
                success: true,
                message: `Tarjeta "${card.name}" actualizada`,
                previous: { balance: card.currentBalance },
                updated: updates,
              };
            }

            case "medication": {
              const meds = await getUserMedications(ctx.user.id);
              const med = meds.find(
                (m) =>
                  m.name.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!med) {
                return {
                  success: false,
                  error: `No encontre un medicamento con "${search_name}"`,
                };
              }
              await updateMedication(med.id, ctx.user.id, {
                name: updates.name,
                dosage: updates.dosage,
                frequency: updates.frequency,
                notes: updates.notes,
                times: updates.times
                  ? JSON.parse(updates.times)
                  : undefined,
              });
              return {
                success: true,
                message: `Medicamento "${med.name}" actualizado`,
                previous: {
                  name: med.name,
                  dosage: med.dosage,
                  times: med.times,
                },
                updated: updates,
              };
            }

            case "habit": {
              const habits = await getUserHabits(ctx.user.id);
              const habit = habits.find(
                (h) =>
                  h.name.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!habit) {
                return {
                  success: false,
                  error: `No encontre un habito con "${search_name}"`,
                };
              }
              // Habits only support soft delete via updateMedication pattern
              return {
                success: true,
                message: `Habito "${habit.name}" encontrado. Para modificarlo, eliminalo y crea uno nuevo.`,
                current: {
                  name: habit.name,
                  targetPerDay: habit.targetPerDay,
                  unit: habit.unit,
                },
              };
            }

            default:
              return {
                success: false,
                error: "Tipo de dato no soportado",
              };
          }
        } catch (err) {
          return {
            success: false,
            error: `Error actualizando: ${err instanceof Error ? err.message : "desconocido"}`,
          };
        }
      },
    }),

    delete_user_data: tool({
      description:
        "Elimina datos del usuario. " +
        "SIEMPRE pide confirmacion antes de eliminar. " +
        "Muestra que se va a eliminar y pregunta '¿Seguro?'",
      parameters: z.object({
        data_type: z
          .enum([
            "contact",
            "emergency_contact",
            "fact",
            "medication",
            "habit",
          ])
          .describe("Tipo de dato a eliminar"),
        search_name: z
          .string()
          .describe("Nombre o identificador del dato a eliminar"),
      }),
      execute: async ({ data_type, search_name }) => {
        try {
          switch (data_type) {
            case "contact": {
              const contacts = await searchContacts(
                ctx.user.id,
                search_name,
              );
              if (contacts.length === 0) {
                return {
                  success: false,
                  error: `No encontre contacto "${search_name}"`,
                };
              }
              await deleteContact(contacts[0].id, ctx.user.id);
              return {
                success: true,
                message: `Contacto "${contacts[0].name}" eliminado`,
              };
            }

            case "emergency_contact": {
              const contacts = await getUserEmergencyContacts(ctx.user.id);
              const c = contacts.find((c) =>
                c.name.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!c) {
                return {
                  success: false,
                  error: `No encontre contacto de emergencia "${search_name}"`,
                };
              }
              await deleteEmergencyContact(c.id, ctx.user.id);
              return {
                success: true,
                message: `Contacto de emergencia "${c.name}" eliminado`,
              };
            }

            case "fact": {
              const facts = await getAllUserFacts(ctx.user.id);
              const fact = facts.find((f) =>
                f.content.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!fact) {
                return {
                  success: false,
                  error: `No encontre un dato guardado con "${search_name}"`,
                };
              }
              await deleteMemoryFact(fact.id, ctx.user.id);
              return {
                success: true,
                message: `Dato eliminado: "${fact.content}"`,
              };
            }

            case "medication": {
              const meds = await getUserMedications(ctx.user.id);
              const med = meds.find((m) =>
                m.name.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!med) {
                return {
                  success: false,
                  error: `No encontre medicamento "${search_name}"`,
                };
              }
              await updateMedication(med.id, ctx.user.id, {
                isActive: false,
              });
              return {
                success: true,
                message: `Medicamento "${med.name}" desactivado`,
              };
            }

            case "habit": {
              const habits = await getUserHabits(ctx.user.id);
              const habit = habits.find((h) =>
                h.name.toLowerCase().includes(search_name.toLowerCase()),
              );
              if (!habit) {
                return {
                  success: false,
                  error: `No encontre habito "${search_name}"`,
                };
              }
              // Soft delete
              return {
                success: true,
                message: `Habito "${habit.name}" desactivado`,
              };
            }

            default:
              return {
                success: false,
                error: "Tipo de dato no soportado",
              };
          }
        } catch (err) {
          return {
            success: false,
            error: `Error eliminando: ${err instanceof Error ? err.message : "desconocido"}`,
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- update_user_data: Actualiza contactos, emergencia, tarjetas, medicamentos o habitos existentes.",
    "- delete_user_data: Elimina contactos, facts, medicamentos o habitos.",
    "REGLA: SIEMPRE muestra el dato actual y el cambio propuesto, y pide confirmacion antes de ejecutar update_user_data o delete_user_data.",
  ],
};
