import { 
  Users, BookOpen, FileText, CheckCircle, 
  Clock, AlertCircle, TrendingUp, Activity, Building2
} from 'lucide-react';
// 👇 Importación de tipos separada para evitar error 'verbatimModuleSyntax'
import type { LucideIcon } from 'lucide-react';
import type { StatItem } from '../types/dashboard.types';

// Tipado estricto para el mapa de íconos
const iconMap: Record<string, LucideIcon> = {
  users: Users,
  book: BookOpen,
  file: FileText,
  check: CheckCircle,
  clock: Clock,
  alert: AlertCircle,
  'trending-up': TrendingUp,
  activity: Activity,
  building: Building2
};

// Tipado estricto para el mapa de colores
const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  red: 'bg-red-100 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
  orange: 'bg-orange-100 text-orange-600',
  indigo: 'bg-indigo-100 text-indigo-600'
};

interface Props {
  stats: StatItem[];
  // Opcional: si se pasa, cada tarjeta se vuelve cliqueable y llama a esto
  // con el `type` de la tarjeta (quien la use decide qué popup mostrar).
  // Pedido explícito de producto: "que al hacer clic en ellas se abran
  // pop-ups con información más amplia" — antes solo AcademicDashboard.tsx
  // tenía sus propias tarjetas clicables con su propio JSX duplicado; ahora
  // el StatsGrid genérico (que usa Admin/Centro) también puede serlo.
  onStatClick?: (type?: string) => void;
}

export const StatsGrid = ({ stats, onStatClick }: Props) => {
  if (!stats || stats.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {stats.map((stat, index) => {
        // Fallback seguro si el ícono no existe
        const IconComponent = iconMap[stat.icon] || FileText;
        // Fallback seguro si el color no existe
        const colorClass = colorMap[stat.color] || colorMap.blue;
        const clickable = Boolean(onStatClick && stat.type);

        return (
          <div
            key={index}
            onClick={clickable ? () => onStatClick!(stat.type) : undefined}
            className={`bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow ${clickable ? 'cursor-pointer active:scale-[0.98]' : ''}`}
          >
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-800">{stat.value}</h3>
            </div>
            <div className={`p-3 rounded-full ${colorClass}`}>
              <IconComponent size={24} />
            </div>
          </div>
        );
      })}
    </div>
  );
};