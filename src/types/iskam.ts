export interface KontoRow {
    name: string;
    nameCs?: string;
    nameEn?: string;
    balance: number;
    balanceText: string;
    topUpHref: string | null;
}

export type UbytovaniStatus = 'Ubytovaný' | 'Rezervace' | 'Odhlášen' | string;

export interface UbytovaniRow {
    dorm: string;
    block: string;
    room: string;
    startDate: string;
    endDate: string;
    status: UbytovaniStatus;
    contractHref: string | null;
}

export interface IskamData {
    konta: KontoRow[];
    ubytovani: UbytovaniRow[];
    syncedAt: number;
}
