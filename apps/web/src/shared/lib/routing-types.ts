export type RouteType = 'none' | 'ura' | 'queue' | 'extension' | 'call_flow';
export type DtmfAction = 'none' | 'extension' | 'queue' | 'ura' | 'hangup';
export type AfterHoursAction = 'hangup' | 'extension' | 'queue' | 'ura';

export type ScheduleWindow = {
  days: number[];
  startTime: string;
  endTime: string;
};

export type BusinessSchedule = {
  enabled?: boolean;
  holidayListName?: string;
  afterHoursAudioId?: number | null;
  afterHoursAction?: AfterHoursAction;
  afterHoursDestinationId?: number | null;
  windows?: ScheduleWindow[];
};

export type DtmfActionRow = {
  digit: string;
  action: DtmfAction;
  destinationId?: number | null;
  destinationLabel?: string | null;
};

export const ROUTE_TYPES: RouteType[] = ['none', 'ura', 'queue', 'extension', 'call_flow'];
export const DTMF_ACTIONS: DtmfAction[] = ['none', 'extension', 'queue', 'ura', 'hangup'];
export const AFTER_HOURS_ACTIONS: AfterHoursAction[] = ['hangup', 'extension', 'queue', 'ura'];

export function defaultDtmfActions(): DtmfActionRow[] {
  return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => ({
    digit,
    action: 'none',
    destinationId: null,
  }));
}

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
