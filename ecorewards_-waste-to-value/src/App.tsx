import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  ShoppingBag, 
  Users, 
  Trophy, 
  Settings, 
  Bell, 
  Search, 
  Filter, 
  MoreVertical,
  Gift,
  Coins,
  ArrowUpRight,
  Navigation,
  Recycle,
  Store,
  History,
  TrendingUp,
  Award
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mock Data
const WASTE_DISTRIBUTION = [
  { name: 'Plastic', value: 45, color: '#3b82f6' },
  { name: 'Paper', value: 25, color: '#10b981' },
  { name: 'Metal', value: 15, color: '#f59e0b' },
  { name: 'Glass', value: 15, color: '#8b5cf6' },
];

const RECENT_TRANSACTIONS = [
  { id: 'TX-9021', user: 'Ahmed B.', type: 'Deposit', material: 'Plastic (2kg)', points: '+200', time: '2m ago' },
  { id: 'TX-9020', user: 'Sarah K.', type: 'Redeem', material: 'Starbucks Voucher', points: '-500', time: '15m ago' },
  { id: 'TX-9019', user: 'Mike R.', type: 'Deposit', material: 'Metal (5kg)', points: '+750', time: '1h ago' },
  { id: 'TX-9018', user: 'Elena G.', type: 'Deposit', material: 'Paper (10kg)', points: '+300', time: '3h ago' },
];

const PARTNER_SHOPS = [
  { name: 'HyperOne', category: 'Grocery', activeOffers: 4, pointsRedeemed: '120k', logo: 'H1' },
  { name: 'Starbucks', category: 'Cafe', activeOffers: 2, pointsRedeemed: '85k', logo: 'SB' },
  { name: 'H&M', category: 'Fashion', activeOffers: 3, pointsRedeemed: '42k', logo: 'HM' },
  { name: 'Jumia', category: 'E-commerce', activeOffers: 5, pointsRedeemed: '210k', logo: 'JU' },
];

const LEADERBOARD = [
  { rank: 1, name: 'Ahmed Bahrawy', points: 12450, impact: '120kg saved' },
  { rank: 2, name: 'Sarah Smith', points: 10200, impact: '95kg saved' },
  { rank: 3, name: 'John Doe', points: 8900, impact: '82kg saved' },
];

// Components
const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <span className={cn("text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1", 
          trend > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : null}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-bold uppercase tracking-wider">{title}</h3>
    <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group",
      active 
        ? "bg-emerald-600 text-white shadow-xl shadow-emerald-200" 
        : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
    )}
  >
    <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", active ? "text-white" : "text-slate-400 group-hover:text-emerald-600")} />
    <span className="font-bold text-sm">{label}</span>
  </button>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <div className="flex h-screen bg-[#FDFDFD] font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col p-8">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-100">
            <Recycle className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-emerald-900 leading-none">EcoRewards</h1>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Waste to Value</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Admin Dashboard" 
            active={activeTab === 'Overview'} 
            onClick={() => setActiveTab('Overview')} 
          />
          <SidebarItem 
            icon={Users} 
            label="User Management" 
            active={activeTab === 'Users'} 
            onClick={() => setActiveTab('Users')} 
          />
          <SidebarItem 
            icon={Store} 
            label="Partner Shops" 
            active={activeTab === 'Partners'} 
            onClick={() => setActiveTab('Partners')} 
          />
          <SidebarItem 
            icon={MapIcon} 
            label="Drop-off Points" 
            active={activeTab === 'Map'} 
            onClick={() => setActiveTab('Map')} 
          />
          <SidebarItem 
            icon={ShoppingBag} 
            label="Reward Catalog" 
            active={activeTab === 'Market'} 
            onClick={() => setActiveTab('Market')} 
          />
          <SidebarItem 
            icon={Trophy} 
            label="Leaderboard" 
            active={activeTab === 'Leaderboard'} 
            onClick={() => setActiveTab('Leaderboard')} 
          />
        </nav>

        <div className="mt-auto pt-8 border-t border-slate-50">
          <div className="p-5 bg-slate-50 rounded-3xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-black shadow-md">
                AB
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate">Ahmed Bahrawy</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Platform Owner</p>
              </div>
              <Settings className="w-4 h-4 text-slate-300 cursor-pointer hover:text-slate-600" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-50 px-10 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4 bg-slate-50 px-6 py-3 rounded-2xl w-[450px] border border-slate-100 focus-within:ring-2 ring-emerald-100 transition-all">
            <Search className="w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search users, transactions, or partners..." 
              className="bg-transparent border-none outline-none text-sm w-full font-medium"
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
              <Coins className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-black text-amber-700">1.2M Points Issued</span>
            </div>
            <button className="relative p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all">
              <Bell className="w-6 h-6" />
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'Overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-10"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight text-slate-900">Platform Insights</h2>
                    <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-xs">Real-time ecosystem performance</p>
                  </div>
                  <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                      <Filter className="w-4 h-4" />
                      Advanced Filters
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                      <TrendingUp className="w-4 h-4" />
                      Export Report
                    </button>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  <StatCard 
                    title="Active Citizens" 
                    value="12,450" 
                    icon={Users} 
                    trend={18} 
                    color="bg-blue-600" 
                  />
                  <StatCard 
                    title="Waste Collected" 
                    value="42.8 Tons" 
                    icon={Recycle} 
                    trend={24} 
                    color="bg-emerald-600" 
                  />
                  <StatCard 
                    title="Points Redeemed" 
                    value="842.5k" 
                    icon={Gift} 
                    trend={12} 
                    color="bg-amber-500" 
                  />
                  <StatCard 
                    title="Partner Stores" 
                    value="156" 
                    icon={Store} 
                    trend={5} 
                    color="bg-indigo-600" 
                  />
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  {/* Chart Section */}
                  <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-10">
                      <div>
                        <h3 className="font-black text-xl">Waste Type Distribution</h3>
                        <p className="text-slate-400 text-xs font-bold mt-1">By weight and point value</p>
                      </div>
                      <div className="flex gap-6">
                        {WASTE_DISTRIBUTION.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-[350px] w-full flex items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={WASTE_DISTRIBUTION}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={120}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {WASTE_DISTRIBUTION.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-1/3 space-y-6">
                        {WASTE_DISTRIBUTION.map((item) => (
                          <div key={item.name} className="flex justify-between items-end border-b border-slate-50 pb-2">
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.name}</p>
                              <p className="text-xl font-black text-slate-900">{item.value}%</p>
                            </div>
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                              {item.name === 'Plastic' ? '100pts/kg' : item.name === 'Paper' ? '50pts/kg' : '150pts/kg'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="font-black text-xl">Live Feed</h3>
                      <History className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="space-y-6">
                      {RECENT_TRANSACTIONS.map((tx) => (
                        <div key={tx.id} className="flex gap-4 group cursor-pointer">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center transition-transform group-hover:scale-110",
                            tx.type === 'Deposit' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {tx.type === 'Deposit' ? <Recycle className="w-6 h-6" /> : <Gift className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-black text-slate-900 truncate">{tx.user}</p>
                              <span className={cn(
                                "text-xs font-black",
                                tx.points.startsWith('+') ? "text-emerald-600" : "text-amber-600"
                              )}>{tx.points}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">{tx.material}</p>
                            <p className="text-[10px] font-bold text-slate-300 mt-1 uppercase">{tx.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button className="w-full mt-10 py-4 text-sm font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-2xl transition-all">
                      View All Transactions
                    </button>
                  </div>
                </div>

                {/* Partners & Gamification */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="font-black text-xl">Top Partner Shops</h3>
                      <Store className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {PARTNER_SHOPS.map((shop) => (
                        <div key={shop.name} className="p-5 rounded-3xl border border-slate-50 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs">
                              {shop.logo}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{shop.category}</span>
                          </div>
                          <h4 className="font-black text-slate-900">{shop.name}</h4>
                          <div className="mt-4 flex justify-between items-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{shop.activeOffers} Offers</p>
                            <p className="text-xs font-black text-emerald-600">{shop.pointsRedeemed} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-emerald-600 p-8 rounded-[40px] shadow-xl shadow-emerald-100 relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex justify-between items-center mb-8">
                        <h3 className="font-black text-xl text-white">Impact Leaderboard</h3>
                        <Award className="w-6 h-6 text-emerald-200" />
                      </div>
                      <div className="space-y-4">
                        {LEADERBOARD.map((user) => (
                          <div key={user.rank} className="bg-white/10 backdrop-blur-md p-4 rounded-2xl flex items-center gap-4 border border-white/10">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-xs">
                              {user.rank}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-black text-white">{user.name}</p>
                              <p className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">{user.impact}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-white">{user.points.toLocaleString()}</p>
                              <p className="text-[10px] font-bold text-emerald-100 uppercase">Points</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="w-full mt-8 py-4 text-sm font-black text-emerald-600 bg-white rounded-2xl hover:bg-emerald-50 transition-all shadow-lg">
                        View Full Rankings
                      </button>
                    </div>
                    {/* Decorative Elements */}
                    <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
                    <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl"></div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab !== 'Overview' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center">
                  <Recycle className="w-10 h-10 text-slate-200" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Module Under Construction</h3>
                  <p className="text-slate-400 font-bold mt-2">We are building the {activeTab} experience for you.</p>
                </div>
                <button 
                  onClick={() => setActiveTab('Overview')}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Back to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
