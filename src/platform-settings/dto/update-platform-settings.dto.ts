import { IsBoolean } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @IsBoolean()
  registrationEnabled: boolean;
}
