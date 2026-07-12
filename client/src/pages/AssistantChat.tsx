import React, { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import {
  Bot,
  Send,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const SAMPLE_QUESTIONS = [
  { text: 'Which vehicle has the lowest ROI?', label: 'Lowest ROI Vehicle' },
  { text: 'Who has an expired or expiring driver license?', label: 'Driver Compliance Expiry' },
  { text: 'What maintenance is due next week?', label: 'Upcoming Service Schedules' },
  { text: 'Which vehicle is the highest fuel consumer?', label: 'Highest Fuel Consumer' },
  { text: 'Give me a monthly fleet summary overview.', label: 'Fleet Executive Summary' }
];

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "Hi! I am your **TransitOps AI Fleet Assistant**. I have direct access to your local fleet database.\n\nAsk me questions about **driver compliance expiries**, **maintenance schedules**, **vehicle ROIs**, or **fuel expenditures**!",
      timestamp: new Date()
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Chat request mutation
  const chatMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await api.post('/assistant/chat', { message: messageText });
      return response.data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data.message,
          timestamp: new Date()
        }
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          text: "I'm sorry, I encountered an error communicating with the database. Please try again in a moment.",
          timestamp: new Date()
        }
      ]);
    }
  });

  const handleSendMessage = (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;

    // 1. Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');

    // 2. Trigger mutation
    chatMutation.mutate(text);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: "Hi! I am your **TransitOps AI Fleet Assistant**. I have direct access to your local fleet database.\n\nAsk me questions about **driver compliance expiries**, **maintenance schedules**, **vehicle ROIs**, or **fuel expenditures**!",
        timestamp: new Date()
      }
    ]);
  };

  // Simple custom parser for bold, headers, list points, and codeblocks
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content = line;

      // Handle custom block headers
      if (content.startsWith('### ')) {
        return <h4 key={idx} className="font-extrabold text-white text-xs mt-3 mb-1.5 uppercase tracking-wider">{content.replace('### ', '')}</h4>;
      }
      
      // Handle list items
      const isListItem = content.startsWith('- ') || content.match(/^\d+\.\s/);
      if (isListItem) {
        content = content.replace(/^(-\s|\d+\.\s)/, '');
      }

      // Handle bold tags **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="text-white font-extrabold">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      const renderedText = parts.length > 0 ? parts : content;

      if (isListItem) {
        return (
          <li key={idx} className="list-disc ml-4 text-[11px] text-slate-300 mb-1 leading-relaxed">
            {renderedText}
          </li>
        );
      }

      return (
        <p key={idx} className="text-[11px] text-slate-300 leading-relaxed mb-1.5">
          {renderedText}
        </p>
      );
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>AI Fleet Assistant</span>
            <span className="bg-primary/10 border border-primary/20 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase">Real DB Integrations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Query real-time assets, driver licenses, and expenditures using natural language.
          </p>
        </div>

        <button
          onClick={clearChat}
          className="p-2 border border-white/10 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all flex items-center space-x-1.5 text-xs font-semibold"
          title="Reset conversation"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6 flex-1 min-h-0">
        {/* Left Side: Prompt templates */}
        <div className="lg:col-span-1 space-y-4 hidden lg:block overflow-y-auto">
          <div className="glass-panel p-4 rounded-xl border border-white/10 space-y-4">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Quick Prompts</span>
            <div className="space-y-2">
              {SAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(q.text)}
                  disabled={chatMutation.isPending}
                  className="w-full text-left p-2.5 bg-slate-900 border border-white/5 hover:border-primary/45 rounded-xl text-[10px] text-slate-300 hover:text-white transition-all flex items-center justify-between group"
                >
                  <span>{q.label}</span>
                  <ArrowRight size={10} className="text-slate-500 group-hover:text-primary transition-colors shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Chat Console */}
        <div className="lg:col-span-3 glass-panel rounded-2xl border border-white/10 flex flex-col overflow-hidden h-full">
          {/* Chat message display */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 px-4 text-xs relative ${
                    m.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-none shadow-[0_4px_15px_rgba(59,130,246,0.2)]'
                      : 'bg-slate-950 border border-white/10 text-slate-300 rounded-tl-none'
                  }`}
                >
                  {/* Bubble body */}
                  <div className="space-y-1">
                    {parseMarkdown(m.text)}
                  </div>

                  {/* Timestamp */}
                  <span className={`text-[8px] mt-1.5 block text-right ${m.sender === 'user' ? 'text-blue-100/60' : 'text-slate-500'}`}>
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {/* Thinking / Loading state */}
            {chatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-slate-950 border border-white/10 text-slate-400 rounded-2xl rounded-tl-none p-3.5 px-4 flex items-center space-x-2 text-[10px]">
                  <div className="flex space-x-1">
                    <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce" />
                    <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>Assistant is scanning databases...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat message input form */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputVal);
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask me about worst ROI, expired licenses, monthly operational summaries..."
                className="flex-1 bg-slate-900 border border-white/10 focus:border-primary/50 text-white rounded-xl px-4 py-2.5 text-xs outline-none transition-all placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!inputVal.trim() || chatMutation.isPending}
                className="bg-primary hover:bg-primary/95 text-white p-2.5 rounded-xl disabled:opacity-40 transition-all flex items-center justify-center shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
