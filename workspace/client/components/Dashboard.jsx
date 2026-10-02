'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import Marketplace from './Marketplace';
import AuditPanel from './AuditPanel';
import AppSettingsDrawer from './AppSettingsDrawer';

import { 
  fetchBots, 
  fetchModels, 
  fetchChatHistory, 
  fetchSettings,
  createBot, 
  updateBot,
  desktopService
} from '../lib/api';

export default function Dashboard({ onLogout }) {
  const [bots, setBots] = useState([]);
  const [models, setModels] = useState([]);
  const [activeBotId, setActiveBotId] = useState('');
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  useEffect(() => window.loomaDesktop?.onOpenSettings?.(() => setIsSettingsOpen(true)), []);
  const [defaultModel, setDefaultModel] = useState('gpt-5-mini');
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('open_dots_user_name') || 'You';
    }
    return 'You';
  });

  // Initial Data Fetch
  useEffect(() => {
    async function initData() {
      try {
        const [botsData, modelsData, settingsData] = await Promise.all([fetchBots(), fetchModels(), fetchSettings()]);
        setBots(botsData);
        setModels(modelsData);
        if (settingsData?.default_model) {
          setDefaultModel(settingsData.default_model);
        }
        if (botsData.length > 0) {
          setActiveBotId(botsData.find(bot => bot.id === 'bot-looma')?.id || botsData[0].id);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    initData();
  }, []);

  useEffect(() => {
    const reload = () => fetchModels().then(setModels);
    window.addEventListener('looma-models-changed', reload);
    return () => window.removeEventListener('looma-models-changed', reload);
  }, []);

  // Fetch chat history whenever active bot changes
  useEffect(() => {
    if (!activeBotId) return;
    fetchChatHistory(activeBotId)
      .then((history) => setMessages(history))
      .catch((err) => console.error('Failed to load history:', err));
  }, [activeBotId]);

  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (activeBotId) fetchChatHistory(activeBotId).then(history => {
        if (live) setMessages(current => {
          const ids = new Set(history.map(message => message.id));
          return [...history, ...current.filter(message => !ids.has(message.id))];
        });
      }).catch(() => {});
    };
    window.addEventListener('focus', refresh);
    const unsubscribe = window.loomaDesktop?.onHistoryChanged?.(refresh);
    return () => { live = false; unsubscribe?.(); window.removeEventListener('focus', refresh); };
  }, [activeBotId]);

  const activeBot = bots.find((b) => b.id === activeBotId) || bots[0];

  const handleUpdateBotModel = async (botId, newModel) => {
    try {
      await desktopService("providers", {action:"select", model:newModel});
      const updated = await updateBot(botId, { model: newModel });
      setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    } catch (err) {
      throw err;
    }
  };

  const handleCreateNewBot = async () => {
    const name = `Chat ${bots.length + 1}`;
    const role = 'A fresh conversation';
    const model = activeBot?.model || defaultModel;

    try {
      const newBot = await createBot({
        name,
        role: role || 'AI Assistant',
        model: model || defaultModel,
        description: `Custom assistant configured to use ${model || defaultModel}.`,
        avatar: '🤖',
        system_prompt: `You are ${name}, a helpful AI assistant.`
      });
      setBots((prev) => [...prev, newBot]);
      setActiveBotId(newBot.id);
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create bot:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#faf6ee] text-zinc-100 font-sans">
      {/* Sidebar Navigation & Bot Roster */}
      <Sidebar
        onLogout={onLogout}
        bots={bots}
        activeBotId={activeBotId}
        userName={userName}
        onSelectBot={(id) => {
          setActiveBotId(id);
          setActiveTab('chat');
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        onOpenNewBot={handleCreateNewBot}
      />

      {/* Main Workspace Display Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatWindow
            bot={activeBot}
            models={models}
            messages={messages}
            setMessages={setMessages}
            onUpdateBotModel={handleUpdateBotModel}
            defaultModel={defaultModel}
          />
        )}


        {activeTab === 'marketplace' && (
          <Marketplace onOpenSettings={() => setIsSettingsOpen(true)} />
        )}

        {activeTab === 'audit' && <AuditPanel />}
      </main>

      {/* Right Side App Settings Drawer Panel */}
      <AppSettingsDrawer
        models={models}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentModel={defaultModel}
        onUpdateDefaultModel={async (newModel) => {
          setDefaultModel(newModel);
          setModels(await fetchModels());
        }}
        onProfileUpdate={(name) => setUserName(name || 'You')}
      />
    </div>
  );
}
