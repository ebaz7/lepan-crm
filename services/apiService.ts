
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

// Exported so App.tsx can use it for instant load
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

        if (isNativeApp) {
            if (!host) {
                throw new Error("SERVER_URL_MISSING");
            }
            baseUrl = `${host}/api`;
        } else {
            if (host) {
                baseUrl = `${host}/api`;
            } else {
                baseUrl = '/api';
            }
        }

        const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        
        // Add cache busting for GET requests
        const separator = safeEndpoint.includes('?') ? '&' : '?';
        const urlWithCacheBuster = method === 'GET' ? `${safeEndpoint}${separator}_t=${Date.now()}` : safeEndpoint;
        
        const finalUrl = `${baseUrl}${urlWithCacheBuster}`;

        // console.log(`API calling: ${method} ${finalUrl}`); 

        const response = await fetch(finalUrl, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                // If response is OK but not JSON (e.g. empty body), return simple success
                data = { success: true } as unknown as T;
            }

            // --- CACHING ENABLED (Write to LocalStorage for Offline Fallback) ---
            if (method === 'GET') {
                try {
                    if (endpoint === '/orders') localStorage.setItem(LS_KEYS.ORDERS, JSON.stringify(data));
                    else if (endpoint === '/users') localStorage.setItem(LS_KEYS.USERS, JSON.stringify(data));
                    else if (endpoint === '/settings') localStorage.setItem(LS_KEYS.SETTINGS, JSON.stringify(data));
                    else if (endpoint === '/chat') localStorage.setItem(LS_KEYS.CHAT, JSON.stringify(data));
                    else if (endpoint === '/trade') localStorage.setItem(LS_KEYS.TRADE, JSON.stringify(data));
                    else if (endpoint === '/warehouse/items') localStorage.setItem(LS_KEYS.WH_ITEMS, JSON.stringify(data));
                    else if (endpoint === '/warehouse/transactions') localStorage.setItem(LS_KEYS.WH_TX, JSON.stringify(data));
                } catch (cacheError) {
                    console.warn("Cache write failed", cacheError);
                }
            }
            
            return data;
        } else {
            let serverErrorMsg = `Server Error: ${response.status}`;
            try {
                const errData = await response.json();
                if (errData && errData.error) {
                    serverErrorMsg = errData.error;
                }
            } catch (e) {}
            throw new Error(serverErrorMsg);
        }

    } catch (error: any) {
        
        if (error.message === "SERVER_URL_MISSING") {
            throw error; 
        }

        console.warn(`API Error for ${endpoint}:`, error);

        if (endpoint === '/login' && method === 'POST') {
             if (error.message.includes("Server Error") || (error.message && error.message.includes("خطا"))) throw error; 
             throw new Error('اتصال به سرور برقرار نشد. آدرس سرور یا اینترنت را بررسی کنید.');
        }

        // --- CACHE FALLBACK (READ-ONLY) ---
        if (method === 'GET') {
            if (endpoint === '/orders') return getLocalData<any>(LS_KEYS.ORDERS, INITIAL_ORDERS);
            if (endpoint === '/trade') return getLocalData<any>(LS_KEYS.TRADE, []);
            if (endpoint === '/warehouse/items') return getLocalData<any>(LS_KEYS.WH_ITEMS, []);
            if (endpoint === '/warehouse/transactions') return getLocalData<any>(LS_KEYS.WH_TX, []);
            if (endpoint === '/settings') return getLocalData<any>(LS_KEYS.SETTINGS, { currentTrackingNumber: 1000 });
            if (endpoint === '/chat') return getLocalData<any>(LS_KEYS.CHAT, []);
            if (endpoint === '/users') return getLocalData<any>(LS_KEYS.USERS, MOCK_USERS);
        }
        
        throw error;
    }
};
