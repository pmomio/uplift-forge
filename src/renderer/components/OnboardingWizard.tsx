import React, { useState, useCallback } from 'react';
import { Users, User, ClipboardList, Building2, ChevronRight, ChevronLeft, Check, Rocket, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveConfig, getConfig } from '../api';
import type { Persona } from '../../shared/types';
import logoSrc from '../../../assets/logo.png';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const PERSONA_OPTIONS: { value: Persona; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  {
    value: 'engineering_manager',
    label: 'Engineering Manager / VP',
    description: 'Deep team insights across 1-10 projects. Cycle time distribution, contribution spread, rework rate, and full metric access.',
    icon: <Users size={24} />,
    color: 'cyan',
  },
  {
    value: 'individual',
    label: 'Individual Contributor',
    description: 'Private personal metrics — your cycle time, throughput, and growth trends. Optional anonymous team comparison.',
    icon: <User size={24} />,
    color: 'emerald',
  },
  {
    value: 'delivery_manager',
    label: 'Delivery Manager',
    description: 'Flow metrics — CFD, lead time distribution, WIP aging, blocker analysis, and Monte Carlo forecasting.',
    icon: <ClipboardList size={24} />,
    color: 'orange',
  },
  {
    value: 'management',
    label: 'Member of Management',
    description: 'Organizational health radar — cross-project delivery, quality, and efficiency metrics. No individual visibility.',
    icon: <Building2 size={24} />,
    color: 'violet',
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; ring: string; activeBg: string }> = {
  indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', ring: 'ring-indigo-500/50', activeBg: 'bg-indigo-500/20' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', ring: 'ring-cyan-500/50', activeBg: 'bg-cyan-500/20' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', ring: 'ring-emerald-500/50', activeBg: 'bg-emerald-500/20' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', ring: 'ring-orange-500/50', activeBg: 'bg-orange-500/20' },
  violet: { bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', ring: 'ring-violet-500/50', activeBg: 'bg-violet-500/20' },
};

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [projectKey, setProjectKey] = useState('');
  const [projectKeys, setProjectKeys] = useState<string[]>(['']);
  const [hasExistingProject, setHasExistingProject] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if user already has a project configured (upgrade path)
  React.useEffect(() => {
    getConfig().then(res => {
      const cfg = res.data as Record<string, unknown>;
      if (cfg.project_key && (cfg.project_key as string).trim()) {
        setHasExistingProject(true);
        setProjectKey(cfg.project_key as string);
      }
    }).catch(() => {});
  }, []);

  const totalSteps = hasExistingProject ? 3 : 4; // Skip project step for existing users
  const stepLabels = hasExistingProject
    ? ['Welcome', 'Your Role', 'Ready!']
    : ['Welcome', 'Your Role', 'Project', 'Ready!'];

  const isMultiProject = persona === 'engineering_manager' || persona === 'management';

  const handleNext = useCallback(async () => {
    if (step === totalSteps - 1) {
      // Final step — save and complete
      setSaving(true);
      try {
        const payload: Record<string, unknown> = { persona };
        if (!hasExistingProject) {
          if (isMultiProject) {
            // Management: first key is primary, rest go to projects[]
            const validKeys = projectKeys.map(k => k.trim()).filter(Boolean);
            if (validKeys.length > 0) {
              payload.project_key = validKeys[0];
              if (validKeys.length > 1) {
                payload.projects = validKeys.slice(1).map(k => ({
                  project_key: k,
                  project_name: k,
                  field_ids: { tpd_bu: '', eng_hours: '', work_stream: '', story_points: '' },
                  mapping_rules: { tpd_bu: {}, work_stream: {} },
                  eng_start_status: 'In Progress',
                  eng_end_status: 'In Review',
                }));
              }
            }
          } else if (projectKey.trim()) {
            payload.project_key = projectKey.trim();
          }
        }
        await saveConfig(payload);
        toast.success('Setup complete!');
        onComplete();
      } catch {
        toast.error('Failed to save configuration');
      } finally {
        setSaving(false);
      }
      return;
    }
    setStep(s => s + 1);
  }, [step, totalSteps, persona, projectKey, projectKeys, hasExistingProject, isMultiProject, onComplete]);

  const handleBack = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
  }, []);

  const canProceed = () => {
    if (step === 0) return true; // Welcome
    const personaStepIndex = 1;
    const projectStepIndex = hasExistingProject ? -1 : 2;

    if (step === personaStepIndex) return persona !== null;
    if (step === projectStepIndex) {
      if (isMultiProject) {
        return projectKeys.some(k => k.trim().length > 0);
      }
      return projectKey.trim().length > 0;
    }
    return true; // Done step
  };

  const renderStep = () => {
    // Welcome step
    if (step === 0) {
      return (
        <div className="text-center animate-slide-up">
          <img src={logoSrc} alt="Uplift Forge" className="w-20 h-20 rounded-2xl mx-auto mb-6 shadow-xl shadow-indigo-500/20" />
          <h2
            className="text-4xl font-bold tracking-tight mb-3"
            style={{ background: 'linear-gradient(135deg, #f1f5f9, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          >
            Welcome to Uplift Forge
          </h2>
          <p className="text-slate-400 text-base max-w-md mx-auto mb-2">
            Engineering performance platform powered by data-driven insights.
          </p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Let's set up your workspace in a few quick steps.
          </p>
        </div>
      );
    }

    // Persona step
    const personaStepIndex = 1;
    if (step === personaStepIndex) {
      return (
        <div className="animate-slide-up">
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-2">What's your role?</h2>
          <p className="text-sm text-slate-400 text-center mb-2">This tailors your dashboard, metrics, and AI suggestions to your needs.</p>
          <p className="text-xs text-amber-400/80 text-center mb-8">This choice is permanent — reset the app to change later.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {PERSONA_OPTIONS.map(opt => {
              const isSelected = persona === opt.value;
              const colors = COLOR_MAP[opt.color];
              return (
                <button
                  key={opt.value}
                  onClick={() => setPersona(opt.value)}
                  className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                    isSelected
                      ? `${colors.activeBg} ${colors.border} ring-2 ${colors.ring} shadow-lg`
                      : `bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 hover:border-slate-600/60`
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${isSelected ? colors.activeBg : 'bg-slate-700/50'} flex items-center justify-center flex-shrink-0 ${isSelected ? colors.text : 'text-slate-400'}`}>
                      {opt.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isSelected ? colors.text : 'text-slate-200'}`}>{opt.label}</span>
                        {isSelected && <Check size={16} className={colors.text} />}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{opt.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Project step (only for new users)
    const projectStepIndex = hasExistingProject ? -1 : 2;
    if (step === projectStepIndex) {
      // Management persona: multi-project input
      if (isMultiProject) {
        return (
          <div className="animate-slide-up max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-slate-100 text-center mb-2">Connect your JIRA projects</h2>
            <p className="text-sm text-slate-400 text-center mb-8">Add all JIRA project keys you want to track. You'll see aggregated metrics across all projects.</p>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider">Project Keys</label>
              {projectKeys.map((pk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="bg-slate-700/60 border border-slate-600/60 text-slate-100 text-lg rounded-lg flex-1 p-3 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50"
                    value={pk}
                    onChange={(e) => {
                      const updated = [...projectKeys];
                      updated[i] = e.target.value.toUpperCase();
                      setProjectKeys(updated);
                    }}
                    placeholder={i === 0 ? 'e.g. PROJ' : 'e.g. TEAM'}
                    autoFocus={i === 0}
                  />
                  {i > 0 && (
                    <button
                      onClick={() => setProjectKeys(projectKeys.filter((_, j) => j !== i))}
                      className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Remove project"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setProjectKeys([...projectKeys, ''])}
                className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors mt-1"
              >
                <Plus size={16} />
                Add Another Project
              </button>
              <p className="text-xs text-slate-500 mt-2">The first project is your primary. Additional projects will inherit default settings — you can customize each in Settings later.</p>
            </div>
          </div>
        );
      }

      // Other personas: single project input
      return (
        <div className="animate-slide-up max-w-md mx-auto">
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-2">Connect your JIRA project</h2>
          <p className="text-sm text-slate-400 text-center mb-8">Enter your JIRA project key to get started. You can configure field mappings and rules in Settings later.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-indigo-300 mb-2 uppercase tracking-wider">Project Key</label>
              <input
                type="text"
                className="bg-slate-700/60 border border-slate-600/60 text-slate-100 text-lg rounded-lg w-full p-3 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400/50"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="e.g. PROJ"
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-2">You can find this in your JIRA project URL. Additional settings can be configured after setup.</p>
            </div>
          </div>
        </div>
      );
    }

    // Done step
    return (
      <div className="text-center animate-slide-up">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
          <Rocket size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 mb-2">You're all set!</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
          Your workspace is configured as <span className="text-slate-200 font-medium">{PERSONA_OPTIONS.find(p => p.value === persona)?.label}</span>.
          {hasExistingProject
            ? ' Your existing project settings have been preserved.'
            : isMultiProject && projectKeys.filter(k => k.trim()).length > 1
              ? ` ${projectKeys.filter(k => k.trim()).length} projects are ready to sync.`
              : (isMultiProject ? projectKeys[0]?.trim() : projectKey) ? ` Project ${isMultiProject ? projectKeys[0]?.trim() : projectKey} is ready to sync.` : ''}
        </p>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Your role is locked. Reset the app to change it later.
        </p>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8">
        {stepLabels.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i <= step ? 'opacity-100' : 'opacity-40'}`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i < step ? 'bg-indigo-400' : i === step ? 'bg-indigo-500 ring-4 ring-indigo-500/20' : 'bg-slate-600'
              }`} />
              <span className="text-[11px] text-slate-400 font-medium">{label}</span>
            </div>
            {i < stepLabels.length - 1 && (
              <div className={`w-8 h-px ${i < step ? 'bg-indigo-400/50' : 'bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center w-full max-w-3xl">
        {renderStep()}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center gap-4 mt-8">
        {step > 0 && (
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-slate-800/50 transition-all"
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        <button
          onClick={handleNext}
          disabled={!canProceed() || saving}
          className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
              Saving...
            </>
          ) : step === totalSteps - 1 ? (
            <>
              Start Using Uplift Forge
              <Rocket size={16} />
            </>
          ) : (
            <>
              Continue
              <ChevronRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OnboardingWizard;
