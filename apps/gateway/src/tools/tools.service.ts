import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import type { User, Assistant, NoteItem } from '@evva/core';
import {
  createNote, getUserNotes, findNoteByTitle, updateNote, deleteNote,
  createContact, searchContacts, getUserContacts, updateContact, deleteContact,
  upsertPreferences, getPreferences,
  getOAuthToken, upsertOAuthToken,
  createCreditCard, getUserCreditCards,
  createTransaction, getTransactions, getMonthSummary,
  createSavingsGoal, getUserSavingsGoals, updateSavingsGoal,
  createMedication, getUserMedications, updateMedication,
  createHabit, getUserHabits, logHabit, getTodayProgress,
  createEmergencyContact, getUserEmergencyContacts,
} from '@evva/database';
import {
  getGoogleAuthUrl, refreshGoogleToken,
  listCalendarEvents, createCalendarEvent,
  listEmails, getEmail, sendEmail,
} from '@evva/ai';
import { MemoryService } from '../memory/memory.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly schedulerService: SchedulerService,
  ) {}

  // ============================================================
  // Helper: obtener access token válido de Google (con auto-refresh)
  // ============================================================

  private async getGoogleAccessToken(userId: string): Promise<string | null> {
    const token = await getOAuthToken(userId, 'google');
    if (!token) return null;

    // Si no ha expirado, usar el actual
    if (token.expiresAt && token.expiresAt > new Date()) {
      return token.accessToken;
    }

    // Refresh
    if (!token.refreshToken) return null;

    try {
      const refreshed = await refreshGoogleToken(token.refreshToken);
      const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
      await upsertOAuthToken({
        userId,
        provider: 'google',
        accessToken: refreshed.accessToken,
        expiresAt,
      });
      return refreshed.accessToken;
    } catch (error) {
      this.logger.error(`Failed to refresh Google token for user ${userId}: ${error}`);
      return null;
    }
  }

  // ============================================================
  // Construye el objeto de tools para una sesión específica
  // Cada tool tiene acceso al contexto del usuario por closure
  // ============================================================

  buildTools(user: User, assistant: Assistant) {
    return {
      // ----------------------------------------------------------
      // save_fact — guarda un hecho importante del usuario
      // ----------------------------------------------------------
      save_fact: tool({
        description:
          'Guarda un hecho importante sobre el usuario en su memoria permanente. ' +
          'Úsalo cuando el usuario comparta información personal relevante como ' +
          'nombres de familiares, preferencias, fechas importantes, o cualquier ' +
          'dato que sea útil recordar en futuras conversaciones.',
        parameters: z.object({
          content: z
            .string()
            .describe('El hecho a guardar, escrito de forma clara y concisa'),
          category: z
            .enum([
              'personal',
              'relationship',
              'work',
              'preference',
              'goal',
              'reminder',
              'other',
            ])
            .describe('La categoría del hecho'),
          importance: z
            .number()
            .min(0.1)
            .max(1.0)
            .default(0.5)
            .describe(
              'Importancia del hecho (0.1 = poco importante, 1.0 = muy importante)',
            ),
        }),
        execute: async ({ content, category, importance }) => {
          try {
            await this.memoryService.saveFact({
              userId: user.id,
              content,
              category,
              importance,
            });
            this.logger.debug(`Fact saved for user ${user.id}: "${content}"`);
            return { success: true, saved: content };
          } catch (error) {
            this.logger.error(`Failed to save fact: ${error}`);
            return { success: false, error: 'No se pudo guardar el hecho' };
          }
        },
      }),

      // ----------------------------------------------------------
      // create_reminder — programa una notificación futura
      // ----------------------------------------------------------
      create_reminder: tool({
        description:
          'Programa un recordatorio para enviarle un mensaje al usuario en un momento específico. ' +
          'Úsalo cuando el usuario pida que le recuerdes algo.',
        parameters: z.object({
          message: z
            .string()
            .describe('El mensaje del recordatorio que se enviará al usuario'),
          trigger_at: z
            .string()
            .describe(
              'Fecha y hora del recordatorio en formato ISO 8601 (ej: 2026-04-05T08:00:00)',
            ),
          context: z
            .string()
            .optional()
            .describe('Contexto adicional para el recordatorio'),
        }),
        execute: async ({ message, trigger_at, context }) => {
          try {
            const triggerDate = new Date(trigger_at);

            if (isNaN(triggerDate.getTime())) {
              return { success: false, error: 'Fecha inválida' };
            }

            const jobId = await this.schedulerService.scheduleReminder({
              userId: user.id,
              telegramId: user.telegramId,
              message,
              assistantName: assistant.name,
              triggerAt: triggerDate,
              additionalContext: context,
            });

            const formatted = triggerDate.toLocaleString('es-MX', {
              timeZone: user.timezone,
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            this.logger.log(
              `Reminder created: ${jobId} for ${formatted}`,
            );

            return {
              success: true,
              jobId,
              scheduledFor: formatted,
            };
          } catch (error) {
            this.logger.error(`Failed to create reminder: ${error}`);
            return {
              success: false,
              error: 'No se pudo programar el recordatorio',
            };
          }
        },
      }),

      // ----------------------------------------------------------
      // web_search — búsqueda web via Brave Search
      // ----------------------------------------------------------
      web_search: tool({
        description:
          'Busca información actualizada en internet. ' +
          'Úsalo cuando el usuario pregunte sobre eventos actuales, precios, ' +
          'noticias, o cualquier información que pueda haber cambiado recientemente.',
        parameters: z.object({
          query: z.string().describe('La consulta de búsqueda'),
        }),
        execute: async ({ query }) => {
          const apiKey = process.env.BRAVE_SEARCH_API_KEY;

          if (!apiKey) {
            return {
              success: false,
              error: 'Búsqueda web no disponible en este momento',
            };
          }

          try {
            const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;

            const response = await fetch(url, {
              headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip',
                'X-Subscription-Token': apiKey,
              },
            });

            if (!response.ok) {
              return { success: false, error: 'Error en la búsqueda' };
            }

            const data = (await response.json()) as {
              web?: {
                results: Array<{
                  title: string;
                  description: string;
                  url: string;
                }>;
              };
            };

            const results =
              data.web?.results.slice(0, 4).map((r) => ({
                title: r.title,
                snippet: r.description,
                url: r.url,
              })) ?? [];

            this.logger.debug(
              `Web search for "${query}": ${results.length} results`,
            );

            return { success: true, query, results };
          } catch (error) {
            this.logger.error(`Web search failed: ${error}`);
            return { success: false, error: 'Error al buscar en internet' };
          }
        },
      }),

      // ----------------------------------------------------------
      // create_note — crear una nota o lista
      // ----------------------------------------------------------
      create_note: tool({
        description:
          'Crea una nota o lista para el usuario. ' +
          'Úsalo cuando el usuario quiera anotar algo, crear una lista de compras, ' +
          'lista de pendientes, o cualquier nota de texto.',
        parameters: z.object({
          title: z.string().describe('Título de la nota o lista'),
          content: z.string().optional().describe('Contenido de la nota (para notas de texto libre)'),
          is_list: z.boolean().default(false).describe('true si es una lista con items'),
          items: z.array(z.string()).optional().describe('Items de la lista (solo si is_list es true)'),
        }),
        execute: async ({ title, content, is_list, items }) => {
          try {
            const noteItems: NoteItem[] = items?.map(text => ({ text, checked: false })) ?? [];
            const note = await createNote({
              userId: user.id,
              title,
              content: content ?? '',
              isList: is_list,
              items: noteItems,
            });
            this.logger.debug(`Note created for user ${user.id}: "${title}"`);
            return { success: true, noteId: note.id, title };
          } catch (error) {
            this.logger.error(`Failed to create note: ${error}`);
            return { success: false, error: 'No se pudo crear la nota' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_notes — ver notas del usuario
      // ----------------------------------------------------------
      get_notes: tool({
        description:
          'Muestra las notas y listas activas del usuario. ' +
          'Úsalo cuando el usuario pregunte por sus notas, listas, pendientes o quiera ver lo que tiene anotado.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const notes = await getUserNotes(user.id);
            if (notes.length === 0) {
              return { success: true, notes: [], message: 'No hay notas guardadas' };
            }
            return {
              success: true,
              notes: notes.map(n => ({
                id: n.id,
                title: n.title,
                content: n.isList ? undefined : n.content,
                items: n.isList ? n.items : undefined,
                isPinned: n.isPinned,
                updatedAt: n.updatedAt.toISOString(),
              })),
            };
          } catch (error) {
            this.logger.error(`Failed to get notes: ${error}`);
            return { success: false, error: 'No se pudieron obtener las notas' };
          }
        },
      }),

      // ----------------------------------------------------------
      // update_note — modificar una nota existente
      // ----------------------------------------------------------
      update_note: tool({
        description:
          'Modifica una nota o lista existente. ' +
          'Úsalo para agregar items a una lista, tachar items, cambiar el contenido, o archivar/eliminar una nota.',
        parameters: z.object({
          title: z.string().describe('Título de la nota a modificar'),
          action: z.enum(['add_items', 'check_item', 'uncheck_item', 'update_content', 'archive', 'delete'])
            .describe('Acción a realizar sobre la nota'),
          items: z.array(z.string()).optional().describe('Items a agregar (solo para add_items)'),
          item_text: z.string().optional().describe('Texto del item a tachar/destachar'),
          new_content: z.string().optional().describe('Nuevo contenido (solo para update_content)'),
        }),
        execute: async ({ title, action, items, item_text, new_content }) => {
          try {
            const note = await findNoteByTitle(user.id, title);
            if (!note) {
              return { success: false, error: `No encontré una nota llamada "${title}"` };
            }

            switch (action) {
              case 'add_items': {
                const newItems = [...(note.items ?? []), ...(items ?? []).map(t => ({ text: t, checked: false }))];
                await updateNote(note.id, user.id, { items: newItems });
                return { success: true, message: `${items?.length ?? 0} items agregados a "${title}"` };
              }
              case 'check_item':
              case 'uncheck_item': {
                const updatedItems = (note.items ?? []).map(item =>
                  item.text.toLowerCase().includes((item_text ?? '').toLowerCase())
                    ? { ...item, checked: action === 'check_item' }
                    : item,
                );
                await updateNote(note.id, user.id, { items: updatedItems });
                return { success: true, message: `Item "${item_text}" ${action === 'check_item' ? 'tachado' : 'destacado'}` };
              }
              case 'update_content':
                await updateNote(note.id, user.id, { content: new_content ?? '' });
                return { success: true, message: `Nota "${title}" actualizada` };
              case 'archive':
                await updateNote(note.id, user.id, { isArchived: true });
                return { success: true, message: `Nota "${title}" archivada` };
              case 'delete':
                await deleteNote(note.id, user.id);
                return { success: true, message: `Nota "${title}" eliminada` };
              default:
                return { success: false, error: 'Acción no reconocida' };
            }
          } catch (error) {
            this.logger.error(`Failed to update note: ${error}`);
            return { success: false, error: 'No se pudo modificar la nota' };
          }
        },
      }),

      // ----------------------------------------------------------
      // save_contact — guardar un contacto
      // ----------------------------------------------------------
      save_contact: tool({
        description:
          'Guarda un contacto del usuario. ' +
          'Úsalo cuando el usuario comparta datos de una persona: nombre, teléfono, email, o relación.',
        parameters: z.object({
          name: z.string().describe('Nombre del contacto'),
          phone: z.string().optional().describe('Número de teléfono'),
          email: z.string().optional().describe('Email'),
          relationship: z.string().optional().describe('Relación con el usuario (dentista, jefe, esposa, etc.)'),
          notes: z.string().optional().describe('Notas adicionales sobre el contacto'),
        }),
        execute: async ({ name, phone, email, relationship, notes }) => {
          try {
            const contact = await createContact({
              userId: user.id,
              name,
              phone,
              email,
              relationship,
              notes,
            });
            this.logger.debug(`Contact saved for user ${user.id}: "${name}"`);
            return { success: true, contactId: contact.id, name };
          } catch (error) {
            this.logger.error(`Failed to save contact: ${error}`);
            return { success: false, error: 'No se pudo guardar el contacto' };
          }
        },
      }),

      // ----------------------------------------------------------
      // search_contacts — buscar contactos
      // ----------------------------------------------------------
      search_contacts: tool({
        description:
          'Busca contactos del usuario por nombre o relación. ' +
          'Úsalo cuando el usuario pregunte por el teléfono, email o datos de alguien.',
        parameters: z.object({
          query: z.string().describe('Nombre o relación a buscar'),
        }),
        execute: async ({ query }) => {
          try {
            const contacts = await searchContacts(user.id, query);
            if (contacts.length === 0) {
              return { success: true, contacts: [], message: `No encontré contactos con "${query}"` };
            }
            return {
              success: true,
              contacts: contacts.map(c => ({
                name: c.name,
                phone: c.phone,
                email: c.email,
                relationship: c.relationship,
                notes: c.notes,
              })),
            };
          } catch (error) {
            this.logger.error(`Failed to search contacts: ${error}`);
            return { success: false, error: 'No se pudieron buscar los contactos' };
          }
        },
      }),

      // ----------------------------------------------------------
      // add_credit_card — registrar tarjeta de crédito
      // ----------------------------------------------------------
      add_credit_card: tool({
        description:
          'Registra una tarjeta de crédito del usuario. ' +
          'Úsalo cuando el usuario quiera agregar una tarjeta con sus datos: nombre, últimos 4 dígitos, fecha de corte y pago.',
        parameters: z.object({
          name: z.string().describe('Nombre de la tarjeta (ej: "BBVA Oro", "Nu")'),
          last_four_digits: z.string().length(4).describe('Últimos 4 dígitos de la tarjeta'),
          brand: z.enum(['visa', 'mastercard', 'amex', 'other']).optional().describe('Marca de la tarjeta'),
          credit_limit: z.number().optional().describe('Límite de crédito'),
          cut_off_day: z.number().min(1).max(31).describe('Día de corte (1-31)'),
          payment_due_day: z.number().min(1).max(31).describe('Día límite de pago (1-31)'),
          annual_rate: z.number().optional().describe('Tasa de interés anual (CAT)'),
        }),
        execute: async ({ name, last_four_digits, brand, credit_limit, cut_off_day, payment_due_day, annual_rate }) => {
          try {
            const card = await createCreditCard({
              userId: user.id, name, lastFourDigits: last_four_digits,
              brand, creditLimit: credit_limit, cutOffDay: cut_off_day,
              paymentDueDay: payment_due_day, annualRate: annual_rate,
            });
            this.logger.log(`Credit card added for user ${user.id}: ${name} (****${last_four_digits})`);
            return { success: true, cardId: card.id, name, lastFour: last_four_digits };
          } catch (error) {
            this.logger.error(`Failed to add credit card: ${error}`);
            return { success: false, error: 'No se pudo registrar la tarjeta' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_credit_cards — ver tarjetas del usuario
      // ----------------------------------------------------------
      get_credit_cards: tool({
        description:
          'Muestra las tarjetas de crédito registradas del usuario con sus saldos, fechas de corte y pago. ' +
          'Úsalo cuando el usuario pregunte por sus tarjetas o quiera saber con cuál le conviene pagar.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const cards = await getUserCreditCards(user.id);
            if (cards.length === 0) return { success: true, cards: [], message: 'No tienes tarjetas registradas.' };
            return {
              success: true,
              cards: cards.map(c => ({
                id: c.id, name: c.name, lastFour: c.lastFourDigits, brand: c.brand,
                creditLimit: c.creditLimit, currentBalance: c.currentBalance,
                cutOffDay: c.cutOffDay, paymentDueDay: c.paymentDueDay, annualRate: c.annualRate,
              })),
            };
          } catch (error) {
            this.logger.error(`Failed to get credit cards: ${error}`);
            return { success: false, error: 'No se pudieron obtener las tarjetas' };
          }
        },
      }),

      // ----------------------------------------------------------
      // record_transaction — registrar ingreso o gasto
      // ----------------------------------------------------------
      record_transaction: tool({
        description:
          'Registra un ingreso o gasto del usuario. ' +
          'Úsalo cuando el usuario diga que gastó, compró, pagó, recibió dinero, o cobró algo.',
        parameters: z.object({
          type: z.enum(['income', 'expense']).describe('income o expense'),
          amount: z.number().positive().describe('Monto en pesos'),
          description: z.string().describe('Descripción del movimiento'),
          category: z.string().describe('Categoría: food, transport, housing, health, entertainment, shopping, education, services, salary, freelance, etc.'),
          payment_method: z.enum(['cash', 'debit', 'credit']).optional().describe('Método de pago'),
          credit_card_last_four: z.string().optional().describe('Últimos 4 dígitos si pagó con tarjeta'),
          is_recurring: z.boolean().default(false).describe('true si es recurrente mensual'),
          date: z.string().optional().describe('Fecha ISO 8601 (default: hoy)'),
        }),
        execute: async ({ type, amount, description, category, payment_method, credit_card_last_four, is_recurring, date }) => {
          try {
            let creditCardId: string | undefined;
            if (payment_method === 'credit' && credit_card_last_four) {
              const cards = await getUserCreditCards(user.id);
              creditCardId = cards.find(c => c.lastFourDigits === credit_card_last_four)?.id;
            }
            const tx = await createTransaction({
              userId: user.id, type, amount, description, category,
              paymentMethod: payment_method, creditCardId, isRecurring: is_recurring,
              date: date ? new Date(date) : undefined,
            });
            this.logger.log(`Transaction: ${type} $${amount} - ${description}`);
            return { success: true, transactionId: tx.id, type, amount, description, category };
          } catch (error) {
            this.logger.error(`Failed to record transaction: ${error}`);
            return { success: false, error: 'No se pudo registrar el movimiento' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_finance_summary — resumen financiero del mes
      // ----------------------------------------------------------
      get_finance_summary: tool({
        description:
          'Resumen financiero del mes: ingresos, gastos, balance y desglose por categoría. ' +
          'Úsalo cuando pregunte cuánto ha gastado, su balance, o quiera ver sus finanzas.',
        parameters: z.object({
          month: z.number().min(1).max(12).optional().describe('Mes (1-12, default: actual)'),
          year: z.number().optional().describe('Año (default: actual)'),
        }),
        execute: async ({ month, year }) => {
          try {
            const now = new Date();
            const m = month ?? (now.getMonth() + 1);
            const y = year ?? now.getFullYear();
            const summary = await getMonthSummary(user.id, y, m);
            const cards = await getUserCreditCards(user.id);
            return {
              success: true, month: m, year: y,
              totalIncome: summary.totalIncome, totalExpense: summary.totalExpense,
              balance: summary.balance, expensesByCategory: summary.byCategory,
              creditCards: cards.map(c => ({ name: c.name, lastFour: c.lastFourDigits, balance: c.currentBalance, paymentDueDay: c.paymentDueDay })),
            };
          } catch (error) {
            this.logger.error(`Failed to get finance summary: ${error}`);
            return { success: false, error: 'No se pudo obtener el resumen financiero' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_recent_transactions — movimientos recientes
      // ----------------------------------------------------------
      get_recent_transactions: tool({
        description: 'Muestra los movimientos recientes del usuario.',
        parameters: z.object({
          type: z.enum(['income', 'expense']).optional().describe('Filtrar por tipo'),
          category: z.string().optional().describe('Filtrar por categoría'),
          limit: z.number().min(1).max(20).default(10).describe('Cantidad'),
        }),
        execute: async ({ type, category, limit }) => {
          try {
            const txs = await getTransactions(user.id, { type: type as any, category, limit });
            if (txs.length === 0) return { success: true, transactions: [], message: 'No hay movimientos.' };
            return {
              success: true,
              transactions: txs.map(t => ({
                type: t.type, amount: t.amount, description: t.description,
                category: t.category, paymentMethod: t.paymentMethod,
                date: t.date.toISOString().split('T')[0],
              })),
            };
          } catch (error) {
            return { success: false, error: 'No se pudieron obtener los movimientos' };
          }
        },
      }),

      // ----------------------------------------------------------
      // create_savings_goal — crear meta de ahorro
      // ----------------------------------------------------------
      create_savings_goal: tool({
        description: 'Crea una meta de ahorro: viaje, fondo de emergencia, compra, etc.',
        parameters: z.object({
          name: z.string().describe('Nombre de la meta'),
          target_amount: z.number().positive().describe('Monto objetivo'),
          target_date: z.string().optional().describe('Fecha meta ISO 8601'),
        }),
        execute: async ({ name, target_amount, target_date }) => {
          try {
            const goal = await createSavingsGoal({
              userId: user.id, name, targetAmount: target_amount,
              targetDate: target_date ? new Date(target_date) : undefined,
            });
            return { success: true, goalId: goal.id, name, targetAmount: target_amount };
          } catch (error) {
            return { success: false, error: 'No se pudo crear la meta de ahorro' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_savings_goals — ver metas de ahorro
      // ----------------------------------------------------------
      get_savings_goals: tool({
        description: 'Muestra las metas de ahorro activas con su progreso.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const goals = await getUserSavingsGoals(user.id);
            if (goals.length === 0) return { success: true, goals: [], message: 'No tienes metas de ahorro.' };
            return {
              success: true,
              goals: goals.map(g => ({
                id: g.id, name: g.name, targetAmount: g.targetAmount,
                currentAmount: g.currentAmount,
                progress: Math.round((g.currentAmount / g.targetAmount) * 100),
                targetDate: g.targetDate?.toISOString().split('T')[0],
              })),
            };
          } catch (error) {
            return { success: false, error: 'No se pudieron obtener las metas' };
          }
        },
      }),

      // ----------------------------------------------------------
      // connect_google — conectar cuenta de Google
      // ----------------------------------------------------------
      connect_google: tool({
        description:
          'Genera un link para que el usuario conecte su cuenta de Google (Calendar + Gmail). ' +
          'Un solo link conecta ambos servicios. ' +
          'Úsalo cuando el usuario quiera conectar Google, su calendario, su correo/Gmail, o cualquier servicio de Google.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const existingToken = await getOAuthToken(user.id, 'google');
            if (existingToken) {
              return { success: true, already_connected: true, message: 'Tu calendario de Google ya está conectado.' };
            }

            const authUrl = getGoogleAuthUrl(user.id);
            return {
              success: true,
              auth_url: authUrl,
              message: 'Abre este link para conectar tu calendario de Google.',
            };
          } catch (error) {
            this.logger.error(`Failed to generate Google auth URL: ${error}`);
            return { success: false, error: 'La integración con Google Calendar no está configurada.' };
          }
        },
      }),

      // ----------------------------------------------------------
      // list_calendar_events — ver eventos del calendario
      // ----------------------------------------------------------
      list_calendar_events: tool({
        description:
          'Lista los próximos eventos del calendario de Google del usuario. ' +
          'Úsalo cuando el usuario pregunte qué tiene en su agenda, calendario, o eventos.',
        parameters: z.object({
          days_ahead: z.number().min(1).max(30).default(7)
            .describe('Cuántos días hacia adelante buscar (default: 7)'),
        }),
        execute: async ({ days_ahead }) => {
          try {
            const accessToken = await this.getGoogleAccessToken(user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error: 'No tienes Google Calendar conectado. Usa connect_google primero.',
              };
            }

            const timeMin = new Date().toISOString();
            const timeMax = new Date(Date.now() + days_ahead * 24 * 60 * 60 * 1000).toISOString();

            const events = await listCalendarEvents(accessToken, { timeMin, timeMax, maxResults: 15 });

            if (events.length === 0) {
              return { success: true, events: [], message: `No tienes eventos en los próximos ${days_ahead} días.` };
            }

            return {
              success: true,
              events: events.map(e => ({
                summary: e.summary,
                start: e.start,
                end: e.end,
                location: e.location,
                allDay: e.allDay,
              })),
            };
          } catch (error) {
            this.logger.error(`Failed to list calendar events: ${error}`);
            return { success: false, error: 'No se pudieron obtener los eventos del calendario.' };
          }
        },
      }),

      // ----------------------------------------------------------
      // create_calendar_event — crear evento en el calendario
      // ----------------------------------------------------------
      create_calendar_event: tool({
        description:
          'Crea un evento en el Google Calendar del usuario. ' +
          'Úsalo cuando el usuario pida agendar algo, crear una cita, o bloquear tiempo.',
        parameters: z.object({
          summary: z.string().describe('Título del evento'),
          description: z.string().optional().describe('Descripción o notas del evento'),
          location: z.string().optional().describe('Ubicación del evento'),
          start_datetime: z.string().describe('Inicio del evento en ISO 8601 (ej: 2026-04-05T10:00:00)'),
          end_datetime: z.string().describe('Fin del evento en ISO 8601 (ej: 2026-04-05T11:00:00)'),
        }),
        execute: async ({ summary, description, location, start_datetime, end_datetime }) => {
          try {
            const accessToken = await this.getGoogleAccessToken(user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error: 'No tienes Google Calendar conectado. Usa connect_google primero.',
              };
            }

            const event = await createCalendarEvent(accessToken, {
              summary,
              description,
              location,
              startDateTime: start_datetime,
              endDateTime: end_datetime,
              timeZone: user.timezone,
            });

            this.logger.log(`Calendar event created for user ${user.id}: "${summary}"`);
            return { success: true, eventId: event.id, summary, start: event.start, end: event.end };
          } catch (error) {
            this.logger.error(`Failed to create calendar event: ${error}`);
            return { success: false, error: 'No se pudo crear el evento en el calendario.' };
          }
        },
      }),

      // ----------------------------------------------------------
      // list_emails — ver correos recientes
      // ----------------------------------------------------------
      list_emails: tool({
        description:
          'Lista los correos recientes del Gmail del usuario. ' +
          'Úsalo cuando el usuario pregunte por sus correos, emails, o si le llegó algo.',
        parameters: z.object({
          query: z.string().optional().describe('Filtro de búsqueda (ej: "from:amazon", "subject:factura")'),
          unread_only: z.boolean().default(false).describe('Solo correos no leídos'),
          max_results: z.number().min(1).max(10).default(5).describe('Cantidad de correos a mostrar'),
        }),
        execute: async ({ query, unread_only, max_results }) => {
          try {
            const accessToken = await this.getGoogleAccessToken(user.id);
            if (!accessToken) {
              return { success: false, not_connected: true, error: 'No tienes Google conectado. Usa connect_google primero.' };
            }

            const emails = await listEmails(accessToken, { query, unreadOnly: unread_only, maxResults: max_results });

            if (emails.length === 0) {
              return { success: true, emails: [], message: 'No hay correos que coincidan.' };
            }

            return {
              success: true,
              emails: emails.map(e => ({
                id: e.id,
                from: e.from,
                subject: e.subject,
                snippet: e.snippet,
                date: e.date,
                unread: e.isUnread,
              })),
            };
          } catch (error) {
            this.logger.error(`Failed to list emails: ${error}`);
            return { success: false, error: 'No se pudieron obtener los correos.' };
          }
        },
      }),

      // ----------------------------------------------------------
      // read_email — leer un correo específico
      // ----------------------------------------------------------
      read_email: tool({
        description:
          'Lee el contenido completo de un correo específico. ' +
          'Úsalo después de list_emails cuando el usuario quiera ver el detalle de un correo.',
        parameters: z.object({
          email_id: z.string().describe('ID del correo (obtenido de list_emails)'),
        }),
        execute: async ({ email_id }) => {
          try {
            const accessToken = await this.getGoogleAccessToken(user.id);
            if (!accessToken) {
              return { success: false, not_connected: true, error: 'No tienes Google conectado.' };
            }

            const email = await getEmail(accessToken, email_id);
            if (!email) {
              return { success: false, error: 'No se encontró el correo.' };
            }

            return {
              success: true,
              from: email.from,
              to: email.to,
              subject: email.subject,
              date: email.date,
              body: email.body,
            };
          } catch (error) {
            this.logger.error(`Failed to read email: ${error}`);
            return { success: false, error: 'No se pudo leer el correo.' };
          }
        },
      }),

      // ----------------------------------------------------------
      // send_email — enviar un correo
      // ----------------------------------------------------------
      send_email: tool({
        description:
          'Envía un correo electrónico desde el Gmail del usuario. ' +
          'Úsalo cuando el usuario quiera enviar un email, responder un correo, o mandar un mensaje por correo.',
        parameters: z.object({
          to: z.string().describe('Email del destinatario'),
          subject: z.string().describe('Asunto del correo'),
          body: z.string().describe('Contenido del correo en texto plano'),
        }),
        execute: async ({ to, subject, body }) => {
          try {
            const accessToken = await this.getGoogleAccessToken(user.id);
            if (!accessToken) {
              return { success: false, not_connected: true, error: 'No tienes Google conectado. Usa connect_google primero.' };
            }

            const result = await sendEmail(accessToken, { to, subject, body });
            this.logger.log(`Email sent by user ${user.id} to ${to}: "${subject}"`);
            return { success: true, messageId: result.id, to, subject };
          } catch (error) {
            this.logger.error(`Failed to send email: ${error}`);
            return { success: false, error: 'No se pudo enviar el correo.' };
          }
        },
      }),

      // ----------------------------------------------------------
      // configure_daily_briefing — activar/configurar resumen diario
      // ----------------------------------------------------------
      configure_daily_briefing: tool({
        description:
          'Activa o configura el resumen diario matutino. ' +
          'El asistente enviará un mensaje cada mañana con pendientes, notas y contexto del día. ' +
          'Úsalo cuando el usuario pida activar el resumen diario o cambiar la hora.',
        parameters: z.object({
          enabled: z.boolean().describe('true para activar, false para desactivar'),
          hour: z.number().min(0).max(23).default(8).describe('Hora del resumen (0-23, formato 24h, UTC)'),
          minute: z.number().min(0).max(59).default(0).describe('Minuto del resumen (0-59)'),
        }),
        execute: async ({ enabled, hour, minute }) => {
          try {
            const prefs = await upsertPreferences(user.id, {
              dailyBriefingEnabled: enabled,
              dailyBriefingHour: hour,
              dailyBriefingMinute: minute,
            });
            const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            this.logger.log(`Daily briefing ${enabled ? 'enabled' : 'disabled'} for user ${user.id} at ${formatted} UTC`);
            return {
              success: true,
              enabled,
              time: formatted,
              message: enabled
                ? `Resumen diario activado a las ${formatted} UTC`
                : 'Resumen diario desactivado',
            };
          } catch (error) {
            this.logger.error(`Failed to configure briefing: ${error}`);
            return { success: false, error: 'No se pudo configurar el resumen diario' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_weather — clima actual de una ciudad
      // ----------------------------------------------------------
      get_weather: tool({
        description: 'Obtiene el clima actual de una ciudad.',
        parameters: z.object({
          city: z.string().describe('El nombre de la ciudad'),
          country: z
            .string()
            .optional()
            .describe('El código de país (ej: MX, US, ES)'),
        }),
        execute: async ({ city, country }) => {
          try {
            const location = country ? `${city},${country}` : city;
            const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;

            const response = await fetch(url, {
              headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
              return { success: false, error: 'No se pudo obtener el clima' };
            }

            const data = (await response.json()) as {
              current_condition: Array<{
                temp_C: string;
                FeelsLikeC: string;
                weatherDesc: Array<{ value: string }>;
                humidity: string;
                windspeedKmph: string;
              }>;
              nearest_area: Array<{
                areaName: Array<{ value: string }>;
                country: Array<{ value: string }>;
              }>;
            };

            const current = data.current_condition[0];
            const area = data.nearest_area[0];

            return {
              success: true,
              city: area.areaName[0].value,
              country: area.country[0].value,
              temperature: `${current.temp_C}°C`,
              feelsLike: `${current.FeelsLikeC}°C`,
              description: current.weatherDesc[0].value,
              humidity: `${current.humidity}%`,
              wind: `${current.windspeedKmph} km/h`,
            };
          } catch (error) {
            this.logger.error(`Weather fetch failed: ${error}`);
            return { success: false, error: 'No se pudo obtener el clima' };
          }
        },
      }),

      // ----------------------------------------------------------
      // translate — traducir texto entre idiomas
      // ----------------------------------------------------------
      translate: tool({
        description: 'Traduce texto entre idiomas. Úsalo cuando el usuario pida traducir algo.',
        parameters: z.object({
          text: z.string().describe('Texto a traducir'),
          target_language: z.string().describe('Idioma destino (ej: "inglés", "francés", "portugués")'),
          source_language: z.string().optional().describe('Idioma origen (se detecta automáticamente si no se especifica)'),
        }),
        execute: async ({ text, target_language, source_language }) => {
          // Claude already knows how to translate — just return instruction for the LLM
          return {
            success: true,
            instruction: `Traduce el siguiente texto ${source_language ? 'de ' + source_language : ''} a ${target_language}: "${text}"`,
            note: 'El LLM traduce directamente, no se necesita API externa',
          };
        },
      }),

      // ----------------------------------------------------------
      // calculate_exchange_rate — tipo de cambio entre divisas
      // ----------------------------------------------------------
      calculate_exchange_rate: tool({
        description: 'Obtiene el tipo de cambio actual entre divisas. Úsalo cuando pregunten por tipo de cambio, conversión de moneda, o cuánto vale el dólar.',
        parameters: z.object({
          from: z.string().default('USD').describe('Moneda origen (código ISO: USD, EUR, MXN, etc.)'),
          to: z.string().default('MXN').describe('Moneda destino'),
          amount: z.number().default(1).describe('Cantidad a convertir'),
        }),
        execute: async ({ from, to, amount }) => {
          try {
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
            if (!response.ok) return { success: false, error: 'No se pudo obtener el tipo de cambio' };
            const data = (await response.json()) as { rates: Record<string, number> };
            const rate = data.rates[to.toUpperCase()];
            if (!rate) return { success: false, error: `No se encontró la moneda ${to}` };
            return {
              success: true,
              from: from.toUpperCase(),
              to: to.toUpperCase(),
              rate,
              amount,
              result: Math.round(amount * rate * 100) / 100,
            };
          } catch (error) {
            return { success: false, error: 'Error al consultar tipo de cambio' };
          }
        },
      }),

      // ----------------------------------------------------------
      // add_medication — registrar medicamento
      // ----------------------------------------------------------
      add_medication: tool({
        description: 'Registra un medicamento que el usuario toma regularmente. Úsalo cuando diga que toma alguna medicina, pastilla o tratamiento.',
        parameters: z.object({
          name: z.string().describe('Nombre del medicamento (ej: "Metformina 500mg")'),
          dosage: z.string().optional().describe('Dosis (ej: "1 pastilla", "10ml")'),
          frequency: z.enum(['daily', 'twice_daily', 'three_times', 'weekly']).default('daily').describe('Frecuencia'),
          times: z.array(z.string()).describe('Horas de toma en formato HH:MM (ej: ["08:00", "20:00"])'),
          notes: z.string().optional().describe('Notas (ej: "Tomar con alimentos")'),
        }),
        execute: async ({ name, dosage, frequency, times, notes }) => {
          try {
            const med = await createMedication({ userId: user.id, name, dosage, frequency, times, notes });
            this.logger.log(`Medication added for user ${user.id}: ${name}`);
            return { success: true, medicationId: med.id, name, times };
          } catch (error) {
            return { success: false, error: 'No se pudo registrar el medicamento' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_medications — ver medicamentos activos
      // ----------------------------------------------------------
      get_medications: tool({
        description: 'Muestra los medicamentos activos del usuario. Úsalo cuando pregunte por sus medicinas o tratamiento.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const meds = await getUserMedications(user.id);
            if (meds.length === 0) return { success: true, medications: [], message: 'No tienes medicamentos registrados.' };
            return {
              success: true,
              medications: meds.map(m => ({
                id: m.id, name: m.name, dosage: m.dosage, frequency: m.frequency, times: m.times, notes: m.notes,
              })),
            };
          } catch (error) {
            return { success: false, error: 'No se pudieron obtener los medicamentos' };
          }
        },
      }),

      // ----------------------------------------------------------
      // create_habit — crear hábito para trackear
      // ----------------------------------------------------------
      create_habit: tool({
        description: 'Crea un hábito para trackear diariamente. Úsalo cuando el usuario quiera llevar control de agua, ejercicio, lectura, etc.',
        parameters: z.object({
          name: z.string().describe('Nombre del hábito (ej: "Tomar agua", "Ejercicio")'),
          target_per_day: z.number().min(1).default(1).describe('Meta diaria (ej: 8 vasos, 30 minutos)'),
          unit: z.string().optional().describe('Unidad (ej: "vasos", "minutos", "veces")'),
        }),
        execute: async ({ name, target_per_day, unit }) => {
          try {
            const habit = await createHabit({ userId: user.id, name, targetPerDay: target_per_day, unit });
            this.logger.log(`Habit created for user ${user.id}: ${name}`);
            return { success: true, habitId: habit.id, name, target: target_per_day, unit };
          } catch (error) {
            return { success: false, error: 'No se pudo crear el hábito' };
          }
        },
      }),

      // ----------------------------------------------------------
      // log_habit — registrar progreso de un hábito
      // ----------------------------------------------------------
      log_habit: tool({
        description: 'Registra progreso en un hábito. Úsalo cuando el usuario diga "ya tomé agua", "hice ejercicio", "ya medité", etc.',
        parameters: z.object({
          habit_name: z.string().describe('Nombre del hábito'),
          count: z.number().min(1).default(1).describe('Cantidad a registrar'),
        }),
        execute: async ({ habit_name, count }) => {
          try {
            const habits = await getUserHabits(user.id);
            const habit = habits.find(h => h.name.toLowerCase().includes(habit_name.toLowerCase()));
            if (!habit) return { success: false, error: `No encontré un hábito llamado "${habit_name}"` };
            const today = new Date().toISOString().split('T')[0];
            await logHabit(habit.id, user.id, today, count);
            return { success: true, habit: habit.name, logged: count, unit: habit.unit };
          } catch (error) {
            return { success: false, error: 'No se pudo registrar el progreso' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_habit_progress — ver progreso de hábitos de hoy
      // ----------------------------------------------------------
      get_habit_progress: tool({
        description: 'Muestra el progreso de los hábitos del día. Úsalo cuando pregunte "¿cómo voy con mis hábitos?" o "¿ya tomé agua hoy?".',
        parameters: z.object({}),
        execute: async () => {
          try {
            const progress = await getTodayProgress(user.id);
            if (progress.length === 0) return { success: true, habits: [], message: 'No tienes hábitos configurados.' };
            return {
              success: true,
              habits: progress.map(p => ({
                name: p.habit.name, logged: p.logged, target: p.target,
                unit: p.habit.unit, completed: p.logged >= p.target,
              })),
            };
          } catch (error) {
            return { success: false, error: 'No se pudo obtener el progreso' };
          }
        },
      }),

      // ----------------------------------------------------------
      // add_emergency_contact — agregar contacto de emergencia
      // ----------------------------------------------------------
      add_emergency_contact: tool({
        description: 'Registra un contacto de emergencia. Úsalo cuando el usuario quiera guardar a alguien como contacto de emergencia.',
        parameters: z.object({
          name: z.string().describe('Nombre del contacto'),
          phone: z.string().describe('Teléfono'),
          relationship: z.string().describe('Relación (hijo, esposa, doctor, vecino, etc.)'),
          is_primary: z.boolean().default(false).describe('true si es el contacto principal'),
        }),
        execute: async ({ name, phone, relationship, is_primary }) => {
          try {
            const contact = await createEmergencyContact({
              userId: user.id, name, phone, relationship, isPrimary: is_primary,
            });
            this.logger.log(`Emergency contact added for user ${user.id}: ${name}`);
            return { success: true, contactId: contact.id, name, phone, relationship };
          } catch (error) {
            return { success: false, error: 'No se pudo registrar el contacto de emergencia' };
          }
        },
      }),

      // ----------------------------------------------------------
      // get_emergency_contacts — ver contactos de emergencia
      // ----------------------------------------------------------
      get_emergency_contacts: tool({
        description: 'Muestra los contactos de emergencia del usuario.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const contacts = await getUserEmergencyContacts(user.id);
            if (contacts.length === 0) return { success: true, contacts: [], message: 'No tienes contactos de emergencia.' };
            return {
              success: true,
              contacts: contacts.map(c => ({
                name: c.name, phone: c.phone, relationship: c.relationship, isPrimary: c.isPrimary,
              })),
            };
          } catch (error) {
            return { success: false, error: 'No se pudieron obtener los contactos de emergencia' };
          }
        },
      }),

      // ----------------------------------------------------------
      // draft_message — generar un mensaje formal o informal
      // ----------------------------------------------------------
      draft_message: tool({
        description: 'Genera un mensaje formal o informal para el usuario. Úsalo cuando pida "escribe un mensaje para mi jefe", "redacta un correo", "ayúdame a escribir...".',
        parameters: z.object({
          recipient: z.string().describe('Para quién es el mensaje (jefe, doctor, cliente, etc.)'),
          purpose: z.string().describe('Propósito del mensaje (pedir permiso, agradecer, reclamar, etc.)'),
          tone: z.enum(['formal', 'informal', 'friendly', 'professional']).default('professional').describe('Tono del mensaje'),
          key_points: z.array(z.string()).optional().describe('Puntos clave que debe incluir'),
          context: z.string().optional().describe('Contexto adicional'),
        }),
        execute: async ({ recipient, purpose, tone, key_points, context }) => {
          return {
            success: true,
            instruction: `Genera un mensaje ${tone} para ${recipient}. Propósito: ${purpose}.${key_points ? ' Puntos clave: ' + key_points.join(', ') : ''}${context ? ' Contexto: ' + context : ''}`,
          };
        },
      }),

      // ----------------------------------------------------------
      // summarize_news — buscar y resumir noticias
      // ----------------------------------------------------------
      summarize_news: tool({
        description: 'Busca y resume las noticias más relevantes del momento. Úsalo cuando el usuario pregunte por noticias, qué está pasando, o quiera un resumen informativo.',
        parameters: z.object({
          topic: z.string().optional().describe('Tema específico (ej: "México", "tecnología", "deportes")'),
          count: z.number().min(1).max(5).default(3).describe('Cantidad de noticias'),
        }),
        execute: async ({ topic, count }) => {
          const apiKey = process.env.BRAVE_SEARCH_API_KEY;
          if (!apiKey) {
            return { success: false, error: 'Búsqueda de noticias no disponible (falta BRAVE_SEARCH_API_KEY)' };
          }
          try {
            const query = topic ? `noticias ${topic} hoy` : 'noticias importantes hoy México';
            const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&freshness=pd&text_decorations=false`;
            const response = await fetch(url, {
              headers: {
                Accept: 'application/json',
                'X-Subscription-Token': apiKey,
              },
            });
            if (!response.ok) return { success: false, error: 'Error buscando noticias' };
            const data = (await response.json()) as {
              web?: { results: Array<{ title: string; description: string; url: string }> };
            };
            const results = data.web?.results.slice(0, count).map(r => ({
              title: r.title,
              snippet: r.description,
              url: r.url,
            })) ?? [];
            return { success: true, topic: topic ?? 'general', news: results };
          } catch (error) {
            return { success: false, error: 'Error al buscar noticias' };
          }
        },
      }),
    };
  }
}
