// ============================================================
// User — quien usa Evva
// ============================================================
export interface User {
  id: string;
  telegramId: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  language: 'es' | 'en';
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// ============================================================
// Assistant — el asistente personal de cada usuario
// ============================================================
export interface Assistant {
  id: string;
  userId: string;
  name: string;                    // El nombre que el usuario le dio: "Luna", "Max", etc.
  personalityBase: string;         // System prompt base de personalidad
  learnedPreferences: string;      // Instrucciones acumuladas con el tiempo
  onboardingCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Message — un mensaje en la conversación
// ============================================================
export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  userId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata?: MessageMetadata;
  createdAt: Date;
}

export interface MessageMetadata {
  telegramMessageId?: number;
  toolsUsed?: string[];
  tokensUsed?: number;
  modelUsed?: string;
  processingTimeMs?: number;
}

// ============================================================
// MemoryFact — un hecho persistente sobre el usuario
// ============================================================
export type MemoryCategory =
  | 'personal'      // nombre, edad, ubicación
  | 'relationship'  // familia, pareja, amigos
  | 'work'          // trabajo, proyectos, colegas
  | 'preference'    // gustos, hábitos, estilo de comunicación
  | 'goal'          // objetivos, planes, sueños
  | 'reminder'      // cosas que no quiere olvidar
  | 'other';

export interface MemoryFact {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  embedding?: number[];
  importance: number;           // 0.0 - 1.0
  lastAccessedAt?: Date;
  sourceMessageId?: string;     // de qué mensaje se extrajo
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// ScheduledJob — trabajo programado para acción proactiva
// ============================================================
export type JobType =
  | 'reminder'          // recordatorio único
  | 'proactive_check'   // el agente revisa algo y decide si contactar
  | 'recurring';        // recurrente (cada lunes, cada día, etc.)

export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ScheduledJob {
  id: string;
  userId: string;
  type: JobType;
  triggerAt: Date;
  cronExpression?: string;       // para jobs recurrentes
  context: JobContext;
  status: JobStatus;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobContext {
  message: string;               // qué decirle al usuario
  assistantName: string;
  additionalContext?: string;    // contexto extra para el LLM
  metadata?: Record<string, unknown>;
}

// ============================================================
// Note — notas y listas del usuario
// ============================================================
export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  isList: boolean;            // true = lista con items, false = nota libre
  items?: NoteItem[];
  isPinned: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteItem {
  text: string;
  checked: boolean;
}

// ============================================================
// Contact — contactos del usuario
// ============================================================
export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  relationship?: string;     // "dentista", "esposa", "jefe", etc.
  notes?: string;            // info adicional
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Finanzas — tarjetas, ingresos, gastos, planes
// ============================================================

export interface CreditCard {
  id: string;
  userId: string;
  name: string;              // "BBVA Oro", "Nu", "Banorte Platinum"
  lastFourDigits: string;    // "4523"
  brand?: string;            // "visa", "mastercard", "amex"
  creditLimit?: number;
  currentBalance: number;    // saldo actual (deuda)
  cutOffDay: number;         // día de corte (1-31)
  paymentDueDay: number;     // día límite de pago (1-31)
  annualRate?: number;       // tasa de interés anual (CAT)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankAccount {
  id: string;
  userId: string;
  name: string;              // "BBVA Nómina", "Nu Ahorro"
  lastFourDigits?: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'debit' | 'credit';

export type ExpenseCategory =
  | 'food'          // comida y restaurantes
  | 'transport'     // uber, gasolina, transporte
  | 'housing'       // renta, servicios, mantenimiento
  | 'health'        // doctor, farmacia, gym
  | 'entertainment' // cine, suscripciones, salidas
  | 'shopping'      // ropa, electrónica, cosas
  | 'education'     // cursos, libros, colegiaturas
  | 'services'      // teléfono, internet, seguros
  | 'transfers'     // transferencias entre cuentas
  | 'debt'          // pago de deudas/tarjetas
  | 'savings'       // ahorro
  | 'other';

export type IncomeCategory =
  | 'salary'        // sueldo
  | 'freelance'     // trabajo independiente
  | 'rental'        // rentas
  | 'investment'    // rendimientos
  | 'gift'          // regalos, bonos
  | 'refund'        // reembolsos
  | 'other';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;           // "MXN", "USD"
  description: string;
  category: ExpenseCategory | IncomeCategory;
  paymentMethod?: PaymentMethod;
  creditCardId?: string;      // si se pagó con tarjeta
  bankAccountId?: string;     // si se pagó con débito/cuenta
  isRecurring: boolean;
  recurringDay?: number;      // día del mes si es recurrente
  date: Date;                 // fecha de la transacción
  createdAt: Date;
  updatedAt: Date;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;               // "Viaje a Europa", "Fondo de emergencia"
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Medication — seguimiento de medicamentos
// ============================================================
export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage?: string;
  frequency: string;
  times: string[];
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Habit — seguimiento de hábitos
// ============================================================
export interface Habit {
  id: string;
  userId: string;
  name: string;
  targetPerDay: number;
  unit?: string;
  reminderTimes?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  count: number;
  createdAt: Date;
}

// ============================================================
// EmergencyContact — contacto de emergencia
// ============================================================
export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: Date;
}

// ============================================================
// UserPreferences — configuración personal
// ============================================================
export interface UserPreferences {
  userId: string;
  dailyBriefingEnabled: boolean;
  dailyBriefingHour: number;   // 0-23
  dailyBriefingMinute: number; // 0-59
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================
// Onboarding — estado del proceso de bienvenida
// ============================================================
export type OnboardingStep =
  | 'welcome'
  | 'name_selection'
  | 'user_name'
  | 'age_range'
  | 'interests'
  | 'personality_setup'
  | 'timezone_setup'
  | 'completed';

export type AgeRange = 'young' | 'adult' | 'senior';

export interface OnboardingState {
  userId: string;
  currentStep: OnboardingStep;
  data: Partial<OnboardingData>;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingData {
  assistantName: string;
  userFirstName: string;
  userName: string;
  ageRange: AgeRange;
  interests: string[];
  timezone: string;
  language: 'es' | 'en';
}
