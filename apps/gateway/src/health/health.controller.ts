import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      service: "evva-gateway",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get("ready")
  ready() {
    return {
      status: "ready",
      timestamp: new Date().toISOString(),
    };
  }
}
