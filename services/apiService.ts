
import { PaymentOrder, User, UserRole, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, WarehouseItem, WarehouseTransaction } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { Capacitor } from '@capacitor/core';

// تنظیمات آدرس سرور
let DEFAULT_SERVER_URL = ''; 

export const getServerHost = () => {
    const stored = localStorage.getItem('app_server_host');
    if (stored) return stored.trim().replace(/\/$/, '');
    if (DEFAULT_SERVER_URL) return DEFAULT_SERVER_URL.replace(/\/$/, '');
    return '';
};

export const setServerHost = (url: string) => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem('app_server_host', cleanUrl);
};

const isNativeApp = Capacitor.isNativePlatform();

const MOCK_USERS: User[] = [
    { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم (آفلاین)', role: UserRole.ADMIN, canManageTrade: true }
];

export const LS_KEYS = {
    ORDERS: 'app_data_orders',
    USERS: 'app_data_users',
    SETTINGS: 'app_data_settings',
    CHAT: 'app_data_chat',
    GROUPS: 'app_data_groups',
    TASKS: 'app_data_tasks',
    TRADE: 'app_data_trade',
    WH_ITEMS: 'app_data_wh_items',
    WH_TX: 'app_data_wh_tx'
};

export const getLocalData = <T>(key: string, defaultData: T): T => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultData;
    } catch {
        return defaultData;
    }
};

export const apiCall = async <T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 

        let baseUrl = '';
        const host = getServerHost();

        // Robust Base URL Construction
        if (isNativeApp) {
            if (!host) throw new Error("SERVER_URL_MISSING");
            // Prevent double /api if user entered it in host
            const cleanHost = host.replace(/\/api$/, '');
            baseUrl = `${cleanHost}/api`;
        } else {
            if (host) {
                const cleanHost = host.replace(/\/api$/, '');
                baseUrl = `${cleanHost}/api`;
            } else {
                baseUrl = '/api';
            }
        }

        // Ensure endpoint starts with / and construction doesn't double it
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const finalUrl = `${baseUrl}${cleanEndpoint}`;

        console.log(`[API] ${method} ${finalUrl}`); 

        const response = await fetch(finalUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            }
            return { success: true } as unknown as T;
        }

        // If not ok, try to get error message
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server Error: ${response.status}`);
        
    } catch (error: any) {
        if (error.message === "SERVER_URL_MISSING") throw error;
        console.warn(`[API ERROR] ${endpoint}:`, error);

        if (method === 'GET') {
            if (endpoint === '/orders') return getLocalData<any>(LS_KEYS.ORDERS, INITIAL_ORDERS);
            if (endpoint === '/settings') return getLocalData<any>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 });
            if (endpoint === '/users') return getLocalData<any>(LS_KEYS.USERS, MOCK_USERS);
        }
        
        throw error;
    }
};
