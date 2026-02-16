
import React, { useState, useEffect, useRef } from 'react';
import { SystemSettings, Company, CompanyBank, UserRole, PrintTemplate } from '../types';
import { getSettings, saveSettings, uploadFile } from '../services/storageService';
import { Save, Building2, Smartphone, Shield, Printer, FileText, Database, Power, Image as ImageIcon, Loader2, Plus, Trash2, Edit } from 'lucide-react';
import { apiCall } from '../services/apiService';
import RolePermissionsEditor from './settings/RolePermissionsEditor';
import BotManager from './settings/BotManager';
import BackupManager from './settings/BackupManager';
import { FiscalYearManager } from './FiscalModule';
import SecondExitGroupSettings from './settings/SecondExitGroupSettings';
import PrintTemplateDesigner from './PrintTemplateDesigner';
import { generateUUID } from '../constants';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'companies' | 'permissions' | 'fiscal' | 'templates' | 'bots' | 'backup'>('general');
  const [loading, setLoading] = useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [message, setMessage] = useState('');
  
  // Template Editor State
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);
  const [showTemplateDesigner, setShowTemplateDesigner] = useState(false);

  // Companies State
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);

  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (newSettings: SystemSettings) => {
    try {
      await saveSettings(newSettings);
      setSettings(newSettings);
      setMessage('تنظیمات با موفقیت ذخیره شد.');
      setTimeout(() => setMessage(''), 3000);
    } catch (e) {
      alert('خطا در ذخیره تنظیمات');
    }
  };

  const handleDefaultWallpaperChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setUploadingWallpaper(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try { 
              const res = await uploadFile(file.name, ev.target?.result as string); 
              if (settings) {
                  const updatedSettings = { ...settings, defaultChatBackground: res.url };
                  await handleSaveSettings(updatedSettings);
              }
          } catch (e) { alert('خطا در ذخیره تصویر'); } finally { setUploadingWallpaper(false); }
      };
      reader.readAsDataURL(file);
  };

  // --- COMPANY MANAGEMENT ---
  const handleSaveCompany = () => {
      if (!editingCompany?.name || !settings) return;
      let newCompanies = [...(settings.companies || [])];
      
      if (newCompanies.find(c => c.id === editingCompany.id)) {
          newCompanies = newCompanies.map(c => c.id === editingCompany.id ? editingCompany : c);
      } else {
          newCompanies.push(editingCompany);
      }
      
      handleSaveSettings({ ...settings, companies: newCompanies, companyNames: newCompanies.map(c => c.name) });
      setIsEditingCompany(false);
      setEditingCompany(null);
  };

  const handleDeleteCompany = (id: string) => {
      if (!confirm('آیا از حذف این شرکت اطمینان دارید؟') || !settings) return;
      const newCompanies = (settings.companies || []).filter(c => c.id !== id);
      handleSaveSettings({ ...settings, companies: newCompanies, companyNames: newCompanies.map(c => c.name) });
  };

  const handleAddBankToCompany = () => {
      if (!editingCompany) return;
      const newBank: CompanyBank = { id: generateUUID(), bankName: '', accountNumber: '' };
      setEditingCompany({ ...editingCompany, banks: [...(editingCompany.banks || []), newBank] });
  };

  const handleUpdateBank = (bankId: string, field: keyof CompanyBank, value: any) => {
      if (!editingCompany) return;
      const newBanks = (editingCompany.banks || []).map(b => b.id === bankId ? { ...b, [field]: value } : b);
      setEditingCompany({ ...editingCompany, banks: newBanks });
  };

  const handleRemoveBank = (bankId: string) => {
      if (!editingCompany) return;
      setEditingCompany({ ...editingCompany, banks: (editingCompany.banks || []).filter(b => b.id !== bankId) });
  };

  // --- TEMPLATE MANAGEMENT ---
  const handleSaveTemplate = (template: PrintTemplate) => {
      if (!settings) return;
      let newTemplates = [...(settings.printTemplates || [])];
      const idx = newTemplates.findIndex(t => t.id === template.id);
      if (idx >= 0) newTemplates[idx] = template;
      else newTemplates.push(template);
      
      handleSaveSettings({ ...settings, printTemplates: newTemplates });
      setShowTemplateDesigner(false);
      setEditingTemplate(null);
  };

  const handleDeleteTemplate = (id: string) => {
      if (!confirm('قالب حذف شود؟') || !settings) return;
      const newTemplates = (settings.printTemplates || []).filter(t => t.id !== id);
      handleSaveSettings({ ...settings, printTemplates: newTemplates });
  };

  if (loading || !settings) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600"/></div>;

  if (showTemplateDesigner) {
      return <PrintTemplateDesigner initialTemplate={editingTemplate} onSave={handleSaveTemplate} onCancel={() => setShowTemplateDesigner(false)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <SettingsIcon className="text-gray-600" /> تنظیمات سیستم
      </h1>

      {message && (
          <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl mb-4 font-bold border border-green-200">
              {message}
          </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2 overflow-x-auto">
        <TabButton id="general" label="عمومی" icon={FileText} active={activeTab} onClick={setActiveTab} />
        <TabButton id="companies" label="شرکت‌ها و بانک‌ها" icon={Building2} active={activeTab} onClick={setActiveTab} />
        <TabButton id="permissions" label="دسترسی‌ها" icon={Shield} active={activeTab} onClick={setActiveTab} />
        <TabButton id="fiscal" label="سال مالی" icon={Database} active={activeTab} onClick={setActiveTab} />
        <TabButton id="templates" label="قالب‌های چاپ" icon={Printer} active={activeTab} onClick={setActiveTab} />
        <TabButton id="bots" label="ربات‌ها" icon={Smartphone} active={activeTab} onClick={setActiveTab} />
        <TabButton id="backup" label="پشتیبان‌گیری" icon={Database} active={activeTab} onClick={setActiveTab} />
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">شرکت پیش‌فرض</label>
                    <select 
                        className="w-full border rounded-xl p-3"
                        value={settings.defaultCompany || ''}
                        onChange={e => handleSaveSettings({ ...settings, defaultCompany: e.target.value })}
                    >
                        <option value="">انتخاب کنید...</option>
                        {settings.companies?.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>

                <div className="pt-4 border-t">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <ImageIcon size={18}/> تصویر پس‌زمینه چت (پیش‌فرض)
                    </label>
                    <div className="flex items-center gap-4">
                        {settings.defaultChatBackground && (
                            <img src={settings.defaultChatBackground} className="w-20 h-20 object-cover rounded-lg border" alt="Background" />
                        )}
                        <input type="file" ref={wallpaperInputRef} className="hidden" accept="image/*" onChange={handleDefaultWallpaperChange} />
                        <button 
                            onClick={() => wallpaperInputRef.current?.click()} 
                            disabled={uploadingWallpaper}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 flex items-center gap-2"
                        >
                            {uploadingWallpaper ? <Loader2 className="animate-spin" size={16}/> : <ImageIcon size={16}/>}
                            {settings.defaultChatBackground ? 'تغییر تصویر' : 'آپلود تصویر'}
                        </button>
                        {settings.defaultChatBackground && (
                            <button 
                                onClick={() => handleSaveSettings({ ...settings, defaultChatBackground: '' })}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                            >
                                <Trash2 size={18}/>
                            </button>
                        )}
                    </div>
                </div>

                <SecondExitGroupSettings settings={settings} setSettings={handleSaveSettings} contacts={settings.savedContacts || []} />
            </div>
        )}

        {/* COMPANIES TAB */}
        {activeTab === 'companies' && (
            <div className="space-y-6">
                {!isEditingCompany ? (
                    <>
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-700">لیست شرکت‌ها</h3>
                            <button 
                                onClick={() => { setEditingCompany({ id: generateUUID(), name: '', banks: [] }); setIsEditingCompany(true); }}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
                            >
                                <Plus size={16}/> افزودن شرکت
                            </button>
                        </div>
                        <div className="grid gap-3">
                            {settings.companies?.map(c => (
                                <div key={c.id} className="border p-4 rounded-xl flex justify-between items-center bg-gray-50 hover:bg-white transition-colors">
                                    <div>
                                        <div className="font-bold text-lg">{c.name}</div>
                                        <div className="text-xs text-gray-500">{c.banks?.length || 0} حساب بانکی</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingCompany(c); setIsEditingCompany(true); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"><Edit size={18}/></button>
                                        <button onClick={() => handleDeleteCompany(c.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><Trash2 size={18}/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <h3 className="font-bold text-lg">ویرایش شرکت</h3>
                            <button onClick={() => setIsEditingCompany(false)} className="text-gray-500 hover:text-gray-700">انصراف</button>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">نام شرکت</label>
                            <input className="w-full border rounded-lg p-2" value={editingCompany?.name} onChange={e => setEditingCompany({ ...editingCompany!, name: e.target.value })} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-bold text-gray-700">حساب‌های بانکی</label>
                                <button onClick={handleAddBankToCompany} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1 hover:bg-green-100"><Plus size={12}/> افزودن حساب</button>
                            </div>
                            {editingCompany?.banks?.map((bank, idx) => (
                                <div key={bank.id} className="flex gap-2 items-center bg-gray-50 p-2 rounded border">
                                    <span className="text-xs font-bold text-gray-400 w-6">{idx + 1}</span>
                                    <input className="flex-1 border rounded p-1 text-sm" placeholder="نام بانک" value={bank.bankName} onChange={e => handleUpdateBank(bank.id, 'bankName', e.target.value)} />
                                    <input className="flex-1 border rounded p-1 text-sm dir-ltr" placeholder="شماره حساب" value={bank.accountNumber} onChange={e => handleUpdateBank(bank.id, 'accountNumber', e.target.value)} />
                                    <input className="flex-1 border rounded p-1 text-sm dir-ltr" placeholder="شبا (IR...)" value={bank.sheba || ''} onChange={e => handleUpdateBank(bank.id, 'sheba', e.target.value)} />
                                    <button onClick={() => handleRemoveBank(bank.id)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={16}/></button>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={handleSaveCompany} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">ذخیره تغییرات</button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* PERMISSIONS TAB */}
        {activeTab === 'permissions' && (
            <RolePermissionsEditor settings={settings} onUpdateSettings={handleSaveSettings} />
        )}

        {/* FISCAL TAB */}
        {activeTab === 'fiscal' && <FiscalYearManager />}

        {/* TEMPLATES TAB */}
        {activeTab === 'templates' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-700">قالب‌های چاپ</h3>
                    <button onClick={() => { setEditingTemplate(null); setShowTemplateDesigner(true); }} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 flex items-center gap-2"><Plus size={16}/> طراحی قالب جدید</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {settings.printTemplates?.map(t => (
                        <div key={t.id} className="border p-4 rounded-xl flex justify-between items-center bg-purple-50 hover:bg-white transition-colors">
                            <div className="font-bold">{t.name} <span className="text-xs text-gray-500 font-normal">({t.pageSize} - {t.orientation})</span></div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingTemplate(t); setShowTemplateDesigner(true); }} className="text-blue-600 hover:bg-blue-100 p-2 rounded"><Edit size={16}/></button>
                                <button onClick={() => handleDeleteTemplate(t.id)} className="text-red-600 hover:bg-red-100 p-2 rounded"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                    {(!settings.printTemplates || settings.printTemplates.length === 0) && <div className="text-gray-400 text-sm col-span-2 text-center py-4">قالبی تعریف نشده است.</div>}
                </div>
            </div>
        )}

        {/* BOTS TAB */}
        {activeTab === 'bots' && <BotManager />}

        {/* BACKUP TAB */}
        {activeTab === 'backup' && <BackupManager />}

      </div>
    </div>
  );
};

const TabButton = ({ id, label, icon: Icon, active, onClick }: any) => (
    <button 
        onClick={() => onClick(id)} 
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active === id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
    >
        <Icon size={16} /> {label}
    </button>
);

// Helper Icon component for title
const SettingsIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
);

export default Settings;
