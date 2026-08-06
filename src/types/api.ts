export interface AuthUser { id: string; email: string; role: string }
export interface LoginResponse { success: boolean; token: string; user: AuthUser }
export interface MessageResponse { success: boolean; message: string }
