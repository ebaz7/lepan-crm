const fs = require('fs');
let content = fs.readFileSync('components/Layout.tsx', 'utf8');

const navTarget = `  const canSeeSayan = currentUser.role === UserRole.ADMIN || perms.canViewSayan === true;
  const canSeeNotifications = true;

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];`;

const navRep = `  const canSeeSayan = currentUser.role === UserRole.ADMIN || perms.canViewSayan === true;
  const canSeeSecretariat = currentUser.role === UserRole.ADMIN || [UserRole.CEO, UserRole.MANAGER, UserRole.FACTORY_MANAGER, UserRole.FINANCIAL, UserRole.SALES_MANAGER, UserRole.COMMERCIAL].includes(currentUser.role as UserRole) || perms.canViewSecretariat === true;
  const canSeeNotifications = true;

  const navItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  ];`;

content = content.replace(navTarget, navRep);

const navItemsTarget = `  if (canSeePurchase) navItems.push({ id: 'purchase', label: 'درخواست خرید', icon: ShoppingCart });
  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessageSquare });`;

const navItemsRep = `  if (canSeePurchase) navItems.push({ id: 'purchase', label: 'درخواست خرید', icon: ShoppingCart });
  if (canSeeSecretariat) navItems.push({ id: 'secretariat', label: 'دبیرخانه', icon: Mail });
  navItems.push({ id: 'chat', label: 'گفتگو', icon: MessageSquare });`;

content = content.replace(navItemsTarget, navItemsRep);

const importsTarget = `import { Mail, Settings, User as UserIcon, BellOff, ArrowRight, Printer, AlertTriangle, MessageSquare, BookOpen, Container, LogOut, Wallet, UserPlus } from 'lucide-react';
import Dashboard from './Dashboard';
import ManageOrders from './ManageOrders';`;

const importsRep = `import { Mail, Settings, User as UserIcon, BellOff, ArrowRight, Printer, AlertTriangle, MessageSquare, BookOpen, Container, LogOut, Wallet, UserPlus } from 'lucide-react';
import Dashboard from './Dashboard';
import ManageOrders from './ManageOrders';
import SecretariatModule from './SecretariatModule';`;

content = content.replace(importsTarget, importsRep);

fs.writeFileSync('components/Layout.tsx', content);
