export const MAINTENANCE_MODE = import.meta.env.PUBLIC_MAINTENANCE_MODE === 'true';

// Optional end time (ISO string) to display on maintenance splash
export const MAINTENANCE_END = import.meta.env.PUBLIC_MAINTENANCE_END || ''; 