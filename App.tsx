
import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Preference, MealTime, UserSettings, MealPlan } from './types';
import { generateMealSuggestion } from './services/geminiService';

export default function App() {
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('vigadi_user');
    return saved ? JSON.parse(saved) : { name: 'Gourmet', preference: Preference.NON_VEG, location: 'Cuddalore, Tamil Nadu' };
  });

  const [history, setHistory] = useState<MealPlan[]>(() => {
    const saved = localStorage.getItem('vigadi_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);

  // Form states
  const [ingredients, setIngredients] = useState('');
  const [people, setPeople] = useState(4);
  const [time, setTime] = useState(MealTime.LUNCH);
  const [duration, setDuration] = useState(60);

  useEffect(() => {
    localStorage.setItem('vigadi_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('vigadi_history', JSON.stringify(history));
  }, [history]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateMealSuggestion(
        { ingredients, people, time, preference: user.preference, duration },
        user
      );
      const newPlan: MealPlan = {
        ...result,
        id: Date.now().toString(),
        date: new Date().toLocaleDateString(),
        time,
        ingredientsUsed: ingredients.split(',').map(s => s.trim())
      };
      setSuggestion(newPlan);
      setHistory(prev => [newPlan, ...prev]);
    } catch (error) {
      console.error(error);
      alert("Failed to generate menu. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderHome = () => (
    <div className="p-4 pb-24 max-w-2xl mx-auto animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-orange-600">Vigadi</h1>
        <p className="text-gray-500">Vanakkam, {user.name}! What's in your pantry?</p>
      </header>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Available Ingredients</label>
            <textarea
              placeholder="e.g. Brinjal, Potato, Raw Mango, Fish..."
              className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none h-24 transition-all"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">No. of People</label>
              <input
                type="number"
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                value={people}
                onChange={(e) => setPeople(parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Duration (min)</label>
              <input
                type="number"
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Meal Time</label>
              <select
                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                value={time}
                onChange={(e) => setTime(e.target.value as MealTime)}
              >
                {Object.values(MealTime).map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading || !ingredients}
                className="w-full p-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50 active:scale-95 transition-all"
              >
                {loading ? 'Thinking...' : 'Get Suggestion'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {suggestion && (
        <div className="bg-white rounded-2xl p-6 shadow-md border-l-4 border-orange-600 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-gray-800">Today's Balanced Menu</h2>
            <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold uppercase">{time}</span>
          </div>
          
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Main Dish</h3>
            <p className="text-lg font-semibold text-gray-800">{suggestion.main}</p>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Side Dishes</h3>
            <ul className="space-y-2">
              {suggestion.sides.map((side: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-gray-700">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                  {side}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-dashed border-gray-200 grid grid-cols-4 gap-2 text-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Calories</span>
              <span className="font-bold text-orange-600">{suggestion.nutritionalInfo.calories}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Protein</span>
              <span className="font-bold text-gray-700">{suggestion.nutritionalInfo.protein}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Carbs</span>
              <span className="font-bold text-gray-700">{suggestion.nutritionalInfo.carbs}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Fat</span>
              <span className="font-bold text-gray-700">{suggestion.nutritionalInfo.fat}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderHistory = () => {
    const grouped = history.reduce((acc: any, item) => {
      if (!acc[item.date]) acc[item.date] = [];
      acc[item.date].push(item);
      return acc;
    }, {});

    return (
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Meal History</h2>
        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <span className="text-4xl mb-4 block">🍲</span>
            No saved menus yet.
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]: any) => (
            <div key={date} className="mb-8">
              <h3 className="text-sm font-bold text-gray-400 mb-3 ml-2">{date}</h3>
              <div className="space-y-4">
                {items.map((item: MealPlan) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-gray-800">{item.time}</span>
                      <span className="text-xs text-orange-600 font-bold">{item.nutritionalInfo.calories} kcal</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1"><span className="font-medium text-gray-800">Main:</span> {item.main}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Sides:</span> {item.sides.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderSettings = () => (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
        <div>
          <label className="block text-sm font-semibold mb-1">Display Name</label>
          <input
            type="text"
            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
            value={user.name}
            onChange={(e) => setUser({ ...user, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Location</label>
          <input
            type="text"
            className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none"
            value={user.location}
            onChange={(e) => setUser({ ...user, location: e.target.value })}
          />
          <p className="text-xs text-gray-400 mt-1">Used for regional spice & cuisine styling.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Diet Preference</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setUser({ ...user, preference: Preference.VEG })}
              className={`p-3 rounded-xl border font-bold ${
                user.preference === Preference.VEG 
                ? 'border-orange-600 bg-orange-50 text-orange-600' 
                : 'border-gray-200 text-gray-400'
              }`}
            >
              Veg
            </button>
            <button
              onClick={() => setUser({ ...user, preference: Preference.NON_VEG })}
              className={`p-3 rounded-xl border font-bold ${
                user.preference === Preference.NON_VEG 
                ? 'border-orange-600 bg-orange-50 text-orange-600' 
                : 'border-gray-200 text-gray-400'
              }`}
            >
              Non-Veg
            </button>
          </div>
        </div>
        
        <div className="pt-4">
          <button className="w-full p-3 border border-red-200 text-red-500 font-semibold rounded-xl hover:bg-red-50 transition-colors">
            Logout
          </button>
        </div>
      </div>
      
      <div className="mt-8 text-center text-gray-300 text-xs">
        Vigadi v1.0.0 • Made with ❤️ in Tamil Nadu
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {tab === 'home' && renderHome()}
      {tab === 'favorites' && renderHistory()}
      {tab === 'settings' && renderSettings()}
      <Navigation currentTab={tab} setTab={setTab} />
    </div>
  );
}
