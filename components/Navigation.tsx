
import React from 'react';

interface NavigationProps {
  currentTab: string;
  setTab: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, setTab }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'favorites', label: 'History', icon: '⭐' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-3 z-50">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setTab(tab.id)}
          className={`flex flex-col items-center gap-1 transition-colors ${
            currentTab === tab.id ? 'text-orange-600' : 'text-gray-400'
          }`}
        >
          <span className="text-xl">{tab.icon}</span>
          <span className="text-xs font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
};
