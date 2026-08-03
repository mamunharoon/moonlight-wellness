import React, { useState } from 'react';

export const Toolkit = () => {
  const [selectedTool, setSelectedTool] = useState(null);

  const tools = [
    {
      id: 'calm',
      title: 'Instant Calm',
      desc: 'Regulate your parasympathetic nervous system with a guided 4-7-8 breathing exercise.',
      icon: 'waves',
      color: 'text-primary bg-primary/10 border-primary/20'
    },
    {
      id: 'stress',
      title: 'Stress Buster',
      desc: 'Release physical tension with Progressive Muscle Relaxation (PMR) combined with synchronized feedback.',
      icon: 'vibration',
      color: 'text-secondary bg-secondary/10 border-secondary/20'
    },
    {
      id: 'ground',
      title: 'Panic Reset',
      desc: 'Ground yourself quickly using the 5-4-3-2-1 technique to engage your physical senses.',
      icon: 'energy_savings_leaf',
      color: 'text-tertiary bg-tertiary/10 border-tertiary/20'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline-lg text-2xl md:text-3xl text-primary font-bold tracking-tight">Relief Toolkit</h2>
        <p className="text-on-surface-variant font-body-md max-w-lg mt-1">
          Quick-access sensory tools designed to ground you and restore calm in moments of high stress.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          {tools.map((tool) => (
            <div 
              key={tool.id}
              onClick={() => setSelectedTool(tool)}
              className="glass-panel p-6 rounded-3xl flex justify-between items-center group cursor-pointer hover:bg-white/10 hover:border-primary/40 transition-all duration-300"
            >
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${tool.color} shrink-0`}>
                  <span className="material-symbols-outlined text-2xl">{tool.icon}</span>
                </div>
                <div>
                  <h3 className="font-headline-md text-lg text-white font-bold">{tool.title}</h3>
                  <p className="text-xs text-on-surface-variant max-w-md mt-1">{tool.desc}</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-all">arrow_forward</span>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="glass-panel rounded-3xl p-6 min-h-[350px] flex flex-col justify-center items-center text-center">
            {selectedTool ? (
              <div className="space-y-6">
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center border ${selectedTool.color}`}>
                  <span className="material-symbols-outlined text-4xl">{selectedTool.icon}</span>
                </div>
                <div>
                  <h4 className="font-headline-md text-xl text-white font-bold">{selectedTool.title}</h4>
                  <p className="text-sm text-on-surface-variant mt-2">{selectedTool.desc}</p>
                </div>
                <button className="w-full py-3 rounded-xl bg-primary-container text-on-primary-container font-semibold hover:opacity-90 active:scale-95 transition-all">
                  Begin Guidance
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-on-surface-variant/40">touch_app</span>
                </div>
                <h4 className="font-headline-md text-md text-on-surface-variant font-bold">Select a Tool</h4>
                <p className="text-xs text-on-surface-variant/60 px-4">Pick a relief method to begin your guided experience</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};