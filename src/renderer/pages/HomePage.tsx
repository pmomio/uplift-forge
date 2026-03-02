import { BarChart3, Settings, Briefcase, Users, User, ClipboardList } from 'lucide-react';
import type { ProjectInfo } from '../App';
import type { Persona } from '../../shared/types';
import logoSrc from '../../../assets/logo.png';

const PERSONA_GREETINGS: Record<Persona, { title: string; subtitle: string }> = {
  management: {
    title: 'Executive Dashboard',
    subtitle: 'Cross-project performance overview with strategic KPIs and team health indicators.',
  },
  engineering_manager: {
    title: 'Team Performance Hub',
    subtitle: 'Deep insights across your projects. Track team output, individual growth, and continuous improvement.',
  },
  individual: {
    title: 'Your Performance Dashboard',
    subtitle: 'Track your personal growth, compare against team averages, and identify areas for improvement.',
  },
  delivery_manager: {
    title: 'Delivery Command Center',
    subtitle: 'Epic-level progress tracking, risk identification, and cycle time analysis for on-time delivery.',
  },
};

interface HomePageProps {
  project?: ProjectInfo | null;
  persona?: Persona;
}

const HomePage: React.FC<HomePageProps> = ({ project, persona }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-slate-700/50 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-100">Home</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
        <div className="max-w-2xl w-full mt-8 animate-slide-up">
          {/* Welcome */}
          <div className="text-center mb-10">
            <img
              src={project?.avatar || logoSrc}
              alt=""
              className="w-14 h-14 rounded-2xl mx-auto mb-4"
            />
            <h2
              className="text-3xl font-bold tracking-tight mb-2"
              style={{ background: 'linear-gradient(135deg, #f1f5f9, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {persona && PERSONA_GREETINGS[persona]
                ? PERSONA_GREETINGS[persona].title
                : project?.name ? `${project.name}` : 'Welcome to Uplift Forge'}
            </h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              {persona && PERSONA_GREETINGS[persona]
                ? PERSONA_GREETINGS[persona].subtitle
                : project?.name
                  ? `Engineering performance dashboard for the ${project.name} team. Data-driven insights and automated JIRA field management.`
                  : 'A tool for uplifting engineering team performance through data-driven insights and automated JIRA field management.'}
            </p>
          </div>

          {/* Getting started */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Getting Started</h3>

            <div className="glass-card p-5 space-y-4">
              <Step
                number={1}
                icon={<Settings size={16} />}
                title="Configure your JIRA project"
                description="Go to Settings and set your JIRA Project Key, then click Fetch Fields to load your custom fields and statuses."
              />
              <Step
                number={2}
                icon={<Settings size={16} />}
                title="Map your fields"
                description="Select the JIRA custom fields for TPD Business Unit, Engineering Hours, and Work Stream. Set the start and end statuses for engineering hours calculation."
              />
              <Step
                number={3}
                icon={<Settings size={16} />}
                title="Set up mapping rules"
                description="Use the visual rule builder to define how tickets are classified into Business Units and Work Streams. Rules support AND/OR logic across fields like parent key, labels, components, and more."
              />
              <Step
                number={4}
                icon={<BarChart3 size={16} />}
                title="View Engineering Attribution"
                description="Once configured, navigate to Attribution to see your tickets with auto-computed engineering hours, business units, and work streams. Edit inline and save back to JIRA."
              />
            </div>
          </div>

          {/* Features overview */}
          <div className="mt-8 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Features</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FeatureCard
                title="Engineering Hours"
                description="Auto-calculated from status transitions, respecting office hours and excluded statuses."
              />
              <FeatureCard
                title="Rule-Based Mapping"
                description="Flexible AND/OR rules to assign TPD Business Unit and Work Stream from ticket metadata."
              />
              <FeatureCard
                title="Inline Editing"
                description="Edit fields directly in the table and save back to JIRA with one click."
              />
              <FeatureCard
                title="Smart Filters"
                description="Filter by all tickets, last X months, or only those missing required fields."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Step = ({ number, icon, title, description }: { number: number; icon: React.ReactNode; title: string; description: string }) => (
  <div className="flex gap-3">
    <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 ring-1 ring-indigo-500/30">
      {number}
    </div>
    <div>
      <h4 className="text-sm font-medium text-slate-200 mb-0.5">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
    </div>
  </div>
);

const FeatureCard = ({ title, description }: { title: string; description: string }) => (
  <div className="glass-card p-4 hover:bg-slate-700/40 hover:border-slate-600/50 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-default">
    <h4 className="text-sm font-medium text-slate-200 mb-1">{title}</h4>
    <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
  </div>
);

export default HomePage;
