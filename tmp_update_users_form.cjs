const fs = require('fs');
let content = fs.readFileSync('components/ManageUsers.tsx', 'utf8');

// Add field to formData
const fdT = `          receiveNotifications: true, 
          avatar: '', 
          telegramChatId: '', `;
const fdR = `          receiveNotifications: true, 
          avatar: '', 
          signatureBase64: '',
          telegramChatId: '', `;
content = content.replace(fdT, fdR);

const fillFormTarget = `          canManageTrade: user.canManageTrade || false,
          canManageSales: user.canManageSales || false,
          receiveNotifications: user.receiveNotifications ?? true,
          avatar: user.avatar || '',
          telegramChatId: user.telegramChatId || '',
          baleChatId: user.baleChatId || '',
          phoneNumber: user.phoneNumber || ''
      });`;
const fillFormRep = `          canManageTrade: user.canManageTrade || false,
          canManageSales: user.canManageSales || false,
          receiveNotifications: user.receiveNotifications ?? true,
          avatar: user.avatar || '',
          signatureBase64: user.signatureBase64 || '',
          telegramChatId: user.telegramChatId || '',
          baleChatId: user.baleChatId || '',
          phoneNumber: user.phoneNumber || ''
      });`;
content = content.replace(fillFormTarget, fillFormRep);

const resetTarget = `          canManageTrade: false, 
          canManageSales: false, 
          receiveNotifications: true, 
          avatar: '', 
          telegramChatId: '', 
          baleChatId: '', 
          phoneNumber: '' 
      }); 
  };`;
const resetRep = `          canManageTrade: false, 
          canManageSales: false, 
          receiveNotifications: true, 
          avatar: '', 
          signatureBase64: '',
          telegramChatId: '', 
          baleChatId: '', 
          phoneNumber: '' 
      }); 
  };`;
content = content.replace(resetTarget, resetRep);


const handlersTarget = `  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
const handlersRep = `  const [uploadingSignature, setUploadingSignature] = useState(false);
  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setUploadingSignature(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          try { const result = await uploadFile('sig_' + file.name, base64); setFormData({ ...formData, signatureBase64: result.url }); } catch (error) { alert('خطا در آپلود امضا'); } finally { setUploadingSignature(false); }
      };
      reader.readAsDataURL(file);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {`;
content = content.replace(handlersTarget, handlersRep);

const uploadHtmlTarget = `        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 lg:col-span-4 flex items-center gap-4 mb-2">
              <div className="relative w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden group">
                  {formData.avatar ? <img src={formData.avatar} className="w-full h-full object-cover"/> : <Camera className="text-gray-400"/>}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <span className="text-[10px] text-white">تغییر</span>
                      <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                  </div>
              </div>
              <div className="text-xs text-gray-500">
                  <p className="font-bold text-gray-700">تصویر پروفایل</p>
                  <p>فرمت‌های مجاز: JPG, PNG</p>
                  {uploadingAvatar && <p className="text-blue-500 animate-pulse mt-1">در حال آپلود...</p>}
              </div>
          </div>`;
          
const uploadHtmlRep = `        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 lg:col-span-4 flex flex-wrap items-center gap-8 mb-2">
              <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden group">
                      {formData.avatar ? <img src={formData.avatar} className="w-full h-full object-cover"/> : <Camera className="text-gray-400"/>}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <span className="text-[10px] text-white">تغییر</span>
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleAvatarChange} disabled={uploadingAvatar} />
                      </div>
                  </div>
                  <div className="text-xs text-gray-500">
                      <p className="font-bold text-gray-700">تصویر پروفایل</p>
                      <p>فرمت‌های مجاز: JPG, PNG</p>
                      {uploadingAvatar && <p className="text-blue-500 animate-pulse mt-1">در حال آپلود...</p>}
                  </div>
              </div>
              <div className="flex items-center gap-4">
                  <div className="relative w-24 h-16 rounded border-2 border-dashed border-blue-200 bg-blue-50 flex items-center justify-center overflow-hidden group">
                      {formData.signatureBase64 ? <img src={formData.signatureBase64} className="w-full h-full object-contain mix-blend-multiply" /> : <span className="text-xs text-blue-500 font-bold">بدون امضا</span>}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <span className="text-white text-xs font-bold px-2 text-center">آپلود مهر و امضا</span>
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/png, image/jpeg" onChange={handleSignatureChange} disabled={uploadingSignature} />
                      </div>
                  </div>
                  <div className="text-xs text-gray-500">
                      <p className="font-bold text-gray-700">امضای دیجیتال (مهر/امضا)</p>
                      <p>تصویر PNG شفاف (بدون پس‌زمینه)</p>
                      {uploadingSignature && <p className="text-blue-500 animate-pulse mt-1">در حال آپلود امضا...</p>}
                  </div>
              </div>
          </div>`;
content = content.replace(uploadHtmlTarget, uploadHtmlRep);

fs.writeFileSync('components/ManageUsers.tsx', content);
