
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

/**
 * Robust path joining to ensure exactly one slash between segments.
 * Fixed to handle absolute vs relative paths correctly.
 */
const joinPaths = (...segments: string[]) => {
    return segments
        .map(s => s ? s.toString().replace(/(^\/+|\/+$)/g, '') : '') 
        .filter(s => s.length > 0)
        .join('/');
};

export const apiCall = async <T>(endpoint: string, method: string = 'GET', body?: any): Promise<T> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 

        let baseUrl = '';
        const host = getServerHost();

        // 1. Determine Base URL Context
        if (host) {
            // Re-normalize host to remove any /api suffix before re-adding it
            const cleanHost = host.replace(/\/api\/?$/, '');
            baseUrl = `${cleanHost}/api`;
        } else {
            // Web browser context with local proxy
            baseUrl = '/api';
        }

        // 2. Build Absolute URL if needed, else relative for proxy
        let finalUrl = '';
        if (baseUrl.startsWith('http')) {
            try {
                const urlObj = new URL(baseUrl);
                urlObj.pathname = '/' + joinPaths(urlObj.pathname, endpoint);
                finalUrl = urlObj.toString();
            } catch (urlErr) {
                // Fallback for non-standard URL formats
                finalUrl = `${baseUrl}/${joinPaths('', endpoint)}`;
            }
        } else {
            finalUrl = '/' + joinPaths(baseUrl, endpoint);
        }

        console.debug(`[STABLE API] ${method} ${finalUrl}`); 

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

        // Detailed Error Extraction
        let errorMsg = `Server Error: ${response.status}`;
        try {
            const errorJson = await response.json();
            errorMsg = errorJson.message || errorJson.error || errorMsg;
        } catch (e) { /* ignore parse error */ }
        
        throw new Error(errorMsg);
        
    } catch (error: any) {
        if (error.name === 'AbortError') throw new Error("Timeout: ارتباط با سرور برقرار نشد.");
        console.error(`[API FAIL] ${endpoint}:`, error);

        // Fail-safe logic: Don't block UI if it's just a listing error on an empty restored DB
        if (method === 'GET') {
            if (endpoint === '/orders') return getLocalData<any>(LS_KEYS.ORDERS, INITIAL_ORDERS);
            if (endpoint === '/settings') return getLocalData<any>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 });
        }
        
        throw error;
    }
};
