// Definimos la forma de una sola tarjeta
export interface StatItem {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

// Definimos la respuesta del servidor (ahora es un array)
export interface DashboardStats {
  stats: StatItem[];
}