/**
 * Settings CRUD is already served by StoresController @Get/@Patch("settings").
 * This module remains as a thin placeholder so the module graph stays
 * explicit and future settings sub-features (e.g. GST profile) have a home.
 */
import { Module } from "@nestjs/common";

@Module({})
export class SettingsModule {}
