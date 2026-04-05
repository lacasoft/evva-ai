export { getPool, query, queryOne, setPool, resetPool, closePool } from './client.js';

export {
  findUserByTelegramId,
  findUserById,
  createUser,
  upsertUser,
  findAssistantByUserId,
  createAssistant,
  updateAssistant,
  getOnboardingState,
  upsertOnboardingState,
} from './repositories/users.repository.js';

export {
  saveMessage,
  getRecentMessages,
  getSessionMessages,
} from './repositories/messages.repository.js';

export {
  saveMemoryFact,
  searchSimilarFacts,
  getAllUserFacts,
  deleteMemoryFact,
} from './repositories/memory.repository.js';

export {
  createNote,
  getUserNotes,
  getNoteById,
  findNoteByTitle,
  updateNote,
  deleteNote,
} from './repositories/notes.repository.js';

export {
  getPreferences,
  upsertPreferences,
  getUsersWithBriefingAt,
} from './repositories/preferences.repository.js';

export {
  getOAuthToken,
  upsertOAuthToken,
  deleteOAuthToken,
} from './repositories/oauth.repository.js';
export type { OAuthToken } from './repositories/oauth.repository.js';

export {
  createCreditCard, getUserCreditCards, updateCreditCardBalance,
  createBankAccount, getUserBankAccounts,
  createTransaction, getTransactions, getMonthSummary,
  createSavingsGoal, getUserSavingsGoals, updateSavingsGoal,
} from './repositories/finance.repository.js';

export {
  createContact,
  searchContacts,
  getUserContacts,
  getContactById,
  updateContact,
  deleteContact,
} from './repositories/contacts.repository.js';

export {
  createMedication,
  getUserMedications,
  updateMedication,
  deleteMedication,
} from './repositories/medications.repository.js';

export {
  createHabit,
  getUserHabits,
  logHabit,
  getHabitLogs,
  getTodayProgress,
  deleteHabit,
} from './repositories/habits.repository.js';

export {
  createEmergencyContact,
  getUserEmergencyContacts,
  deleteEmergencyContact,
} from './repositories/emergency.repository.js';
