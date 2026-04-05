import { Injectable, Logger } from "@nestjs/common";
import type { User, Assistant, OnboardingState } from "@evva/core";
import {
  findUserByTelegramId,
  upsertUser,
  findAssistantByUserId,
  createAssistant,
  updateAssistant,
  getOnboardingState,
  upsertOnboardingState,
} from "@evva/database";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  // ============================================================
  // Users
  // ============================================================

  async findOrCreateUser(params: {
    telegramId: number;
    telegramUsername?: string;
    telegramFirstName?: string;
  }): Promise<User> {
    const user = await upsertUser(params);
    this.logger.debug(
      `User resolved: ${user.id} (telegram: ${user.telegramId})`,
    );
    return user;
  }

  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return findUserByTelegramId(telegramId);
  }

  // ============================================================
  // Assistants
  // ============================================================

  async getAssistant(userId: string): Promise<Assistant | null> {
    return findAssistantByUserId(userId);
  }

  async createAssistant(userId: string, name: string): Promise<Assistant> {
    this.logger.log(`Creating assistant "${name}" for user ${userId}`);
    return createAssistant({ userId, name });
  }

  async updateAssistantName(userId: string, name: string): Promise<void> {
    await updateAssistant(userId, { name });
  }

  async completeOnboarding(userId: string): Promise<void> {
    await updateAssistant(userId, { onboardingCompleted: true });
    await upsertOnboardingState(userId, "completed", {});
    this.logger.log(`Onboarding completed for user ${userId}`);
  }

  async updateLearnedPreferences(
    userId: string,
    preferences: string,
  ): Promise<void> {
    await updateAssistant(userId, { learnedPreferences: preferences });
  }

  // ============================================================
  // Onboarding
  // ============================================================

  async getOnboardingState(userId: string): Promise<OnboardingState | null> {
    return getOnboardingState(userId);
  }

  async setOnboardingStep(
    userId: string,
    step: OnboardingState["currentStep"],
    data: OnboardingState["data"] = {},
  ): Promise<void> {
    await upsertOnboardingState(userId, step, data);
  }

  async isOnboardingComplete(userId: string): Promise<boolean> {
    const assistant = await findAssistantByUserId(userId);
    return assistant?.onboardingCompleted ?? false;
  }
}
