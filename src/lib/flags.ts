import { PUBLIC_MAINTENANCE_MODE, PUBLIC_MAINTENANCE_END } from '$env/static/public';

export const MAINTENANCE_MODE = PUBLIC_MAINTENANCE_MODE === 'true';

// Optional end time (ISO string) to display on maintenance splash
export const MAINTENANCE_END = PUBLIC_MAINTENANCE_END || ''; 