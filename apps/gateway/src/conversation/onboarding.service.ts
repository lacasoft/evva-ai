import { Injectable, Logger } from "@nestjs/common";
import type { User, AgeRange } from "@evva/core";
import {
  ONBOARDING_MESSAGES,
  isValidAssistantName,
  normalizeAssistantName,
} from "@evva/core";
import { UsersService } from "../users/users.service.js";

export interface OnboardingResponse {
  message: string;
  isComplete: boolean;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly usersService: UsersService) {}

  async startOnboarding(user: User): Promise<string> {
    await this.usersService.setOnboardingStep(user.id, "name_selection", {
      userFirstName: user.telegramFirstName,
    });

    this.logger.log(`Starting onboarding for user ${user.id}`);
    return ONBOARDING_MESSAGES.WELCOME(user.telegramFirstName ?? "amigo");
  }

  async handleOnboardingMessage(
    user: User,
    text: string,
  ): Promise<OnboardingResponse> {
    const state = await this.usersService.getOnboardingState(user.id);
    const currentStep = state?.currentStep ?? "welcome";

    switch (currentStep) {
      case "name_selection":
        return this.handleNameSelection(user, text, state?.data ?? {});

      case "user_name":
        return this.handleUserName(user, text, state?.data ?? {});

      case "age_range":
        return this.handleAgeRange(user, text, state?.data ?? {});

      case "interests":
        return this.handleInterests(user, text, state?.data ?? {});

      case "completed":
        return { message: "", isComplete: true };

      default:
        return {
          message: await this.startOnboarding(user),
          isComplete: false,
        };
    }
  }

  // Paso 1: Elegir nombre del asistente
  private async handleNameSelection(
    user: User,
    text: string,
    data: Record<string, unknown>,
  ): Promise<OnboardingResponse> {
    const name = text.trim();

    if (!isValidAssistantName(name)) {
      return {
        message:
          "Ese nombre no funciona. Usa entre 2 y 20 letras, sin simbolos especiales. ¿Como quieres llamarme?",
        isComplete: false,
      };
    }

    const normalizedName = normalizeAssistantName(name);

    await this.usersService.setOnboardingStep(user.id, "user_name", {
      ...data,
      assistantName: normalizedName,
    });

    return {
      message: ONBOARDING_MESSAGES.ASK_USER_NAME(normalizedName),
      isComplete: false,
    };
  }

  // Paso 2: Nombre real del usuario
  private async handleUserName(
    user: User,
    text: string,
    data: Record<string, unknown>,
  ): Promise<OnboardingResponse> {
    const userName = text.trim();

    if (userName.length < 2 || userName.length > 50) {
      return {
        message: "¿Cual es tu nombre?",
        isComplete: false,
      };
    }

    await this.usersService.setOnboardingStep(user.id, "age_range", {
      ...data,
      userName,
    });

    return {
      message: ONBOARDING_MESSAGES.ASK_AGE_RANGE(userName),
      isComplete: false,
    };
  }

  // Paso 3: Rango de edad
  private async handleAgeRange(
    user: User,
    text: string,
    data: Record<string, unknown>,
  ): Promise<OnboardingResponse> {
    const input = text.trim().toLowerCase();
    let ageRange: AgeRange;

    if (input === "1" || input.includes("joven") || input.includes("young")) {
      ageRange = "young";
    } else if (
      input === "2" ||
      (input.includes("adulto") && !input.includes("mayor")) ||
      input.includes("adult")
    ) {
      ageRange = "adult";
    } else if (
      input === "3" ||
      input.includes("mayor") ||
      input.includes("senior")
    ) {
      ageRange = "senior";
    } else {
      return {
        message:
          "No entendi. Responde con 1 (Joven), 2 (Adulto) o 3 (Adulto mayor).",
        isComplete: false,
      };
    }

    await this.usersService.setOnboardingStep(user.id, "interests", {
      ...data,
      ageRange,
    });

    const assistantName = data.assistantName as string;

    switch (ageRange) {
      case "young":
        return {
          message: ONBOARDING_MESSAGES.ASK_INTERESTS_YOUNG(assistantName),
          isComplete: false,
        };
      case "adult":
        return {
          message: ONBOARDING_MESSAGES.ASK_INTERESTS_ADULT(assistantName),
          isComplete: false,
        };
      case "senior":
        return {
          message: ONBOARDING_MESSAGES.ASK_INTERESTS_SENIOR(assistantName),
          isComplete: false,
        };
    }
  }

  // Paso 4: Intereses — completa el onboarding
  private async handleInterests(
    user: User,
    text: string,
    data: Record<string, unknown>,
  ): Promise<OnboardingResponse> {
    const input = text.trim().toLowerCase();
    const ageRange = data.ageRange as AgeRange;
    const assistantName = data.assistantName as string;
    const userName = data.userName as string;

    const interests = this.parseInterests(input, ageRange);

    // Crear el asistente y completar onboarding
    await this.usersService.createAssistant(user.id, assistantName);
    await this.usersService.completeOnboarding(user.id);

    this.logger.log(
      `Onboarding complete for user ${user.id} — assistant: "${assistantName}", age: ${ageRange}, interests: ${interests.join(",")}`,
    );

    // Mensaje personalizado segun perfil
    switch (ageRange) {
      case "young":
        return {
          message: ONBOARDING_MESSAGES.READY_YOUNG(assistantName, interests),
          isComplete: true,
        };
      case "adult":
        return {
          message: ONBOARDING_MESSAGES.READY_ADULT(assistantName, interests),
          isComplete: true,
        };
      case "senior":
        return {
          message: ONBOARDING_MESSAGES.READY_SENIOR(assistantName, interests),
          isComplete: true,
        };
    }
  }

  private parseInterests(input: string, ageRange: AgeRange): string[] {
    if (
      input.includes("5") ||
      input.includes("todo") ||
      input.includes("all")
    ) {
      switch (ageRange) {
        case "young":
          return ["finance", "google", "notes", "search"];
        case "adult":
          return ["finance", "google", "notes", "health"];
        case "senior":
          return ["medications", "emergency", "notes", "google"];
      }
    }

    const interests: string[] = [];

    if (ageRange === "senior") {
      if (input.includes("1") || input.includes("medic"))
        interests.push("medications");
      if (input.includes("2") || input.includes("emergenc"))
        interests.push("emergency");
      if (
        input.includes("3") ||
        input.includes("record") ||
        input.includes("nota")
      )
        interests.push("notes");
      if (
        input.includes("4") ||
        input.includes("correo") ||
        input.includes("email")
      )
        interests.push("google");
    } else {
      if (
        input.includes("1") ||
        input.includes("finanz") ||
        input.includes("gasto")
      )
        interests.push("finance");
      if (
        input.includes("2") ||
        input.includes("correo") ||
        input.includes("calendar") ||
        input.includes("gmail")
      )
        interests.push("google");
      if (
        input.includes("3") ||
        input.includes("nota") ||
        input.includes("record") ||
        input.includes("lista")
      )
        interests.push("notes");
      if (ageRange === "young") {
        if (
          input.includes("4") ||
          input.includes("busq") ||
          input.includes("noticia")
        )
          interests.push("search");
      } else {
        if (
          input.includes("4") ||
          input.includes("habit") ||
          input.includes("salud")
        )
          interests.push("health");
      }
    }

    // Si no eligio nada, dar todo
    if (interests.length === 0) {
      return this.parseInterests("5", ageRange);
    }

    return interests;
  }

  async needsOnboarding(userId: string): Promise<boolean> {
    const complete = await this.usersService.isOnboardingComplete(userId);
    return !complete;
  }
}
