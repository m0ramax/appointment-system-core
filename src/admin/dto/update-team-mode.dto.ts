import { IsBoolean } from 'class-validator';

export class UpdateTeamModeDto {
  @IsBoolean()
  teamMode: boolean;
}
