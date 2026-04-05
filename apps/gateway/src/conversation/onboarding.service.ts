import { Injectable, Logger } from '@nestjs/common';
import type { User } from '@evva/core';
import {
  ONBOARDING_MESSAGES,
  isValidAssistantName,
  normalizeAssistantName,
} from '@evva/core';
import { UsersService } from '../users/users.service.js';

export interface OnboardingResponse {
  message: string;
  isComplete: boolean;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly usersService: UsersService) {}

  // ============================================================
  // Inicia el flujo de onboarding para un usuario nuevo
  // ============================================================

  async startOnboarding(user: User): Promise<string> {
    await this.usersService.setOnboardingStep(user.id, 'name_selection', {
      userFirstName: user.telegramFirstName,
    });

    this.logger.log(`Starting onboarding for user ${user.id}`);

    return ONBOARDING_MESSAGES.WELCOME(user.telegramFirstName ?? 'amigo');
  }

  // ============================================================
  // Procesa la respuesta del usuario durante el onboarding
  // ============================================================

  async handleOnboardingMessage(
    user: User,
    text: string,
  ): Promise<OnboardingResponse> {
    const state = await this.usersService.getOnboardingState(user.id);
    const currentStep = state?.currentStep ?? 'welcome';

    switch (currentStep) {
      case 'name_selection':
        return this.handleNameSelection(user, text);

      case 'completed':
        return { message: '', isComplete: true };

      default:
        // Si el estado es inconsistente, reiniciamos
        return {
          message: await this.startOnboarding(user),
          isComplete: false,
        };
    }
  }

  // ============================================================
  // Paso: el usuario elige el nombre de su asistente
  // ============================================================

  private async handleNameSelection(
    user: User,
    text: string,
  ): Promise<OnboardingResponse> {
    const name = text.trim();

    // Validar que el nombre sea apropiado
    if (!isValidAssistantName(name)) {
      return {
        message:
          'Ese nombre no funciona. Usa entre 2 y 20 letras, sin símbolos especiales. ¿Cómo quieres llamarme?',
        isComplete: false,
      };
    }

    const normalizedName = normalizeAssistantName(name);

    // Crear el asistente
    await this.usersService.createAssistant(user.id, normalizedName);
    await this.usersService.completeOnboarding(user.id);

    this.logger.log(
      `Onboarding complete for user ${user.id} — assistant: "${normalizedName}"`,
    );

    return {
      message: ONBOARDING_MESSAGES.READY(normalizedName),
      isComplete: true,
    };
  }

  // ============================================================
  // Verifica si el usuario necesita onboarding
  // ============================================================

  async needsOnboarding(userId: string): Promise<boolean> {
    const complete = await this.usersService.isOnboardingComplete(userId);
    return !complete;
  }
}
