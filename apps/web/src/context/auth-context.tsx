'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { ApiClient } from '../lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'AGENCY_ACCOUNT_MANAGER' | 'CLIENT_ADMIN' | 'CLIENT_SALES_USER' | 'CUSTOM';
  organizationId: string;
  organizationName: string;
  organizationType: 'AGENCY' | 'CLIENT';
  permissions: string[];
}

export interface ClientWorkspace {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  activeClient: ClientWorkspace | null;
  availableClients: ClientWorkspace[];
  setActiveClient: (client: ClientWorkspace | null) => void;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isAgencyUser: boolean;
  isSuperAdmin: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeClient, setActiveClient] = useState<ClientWorkspace | null>(null);
  const [availableClients, setAvailableClients] = useState<ClientWorkspace[]>([]);

  const fetchUserData = async () => {
    const token = ApiClient.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await ApiClient.get<User>('/auth/me');
      if (res.data) {
        setUser(res.data);
        
        // If agency user, fetch accessible clients
        if (res.data.organizationType === 'AGENCY') {
          const orgsRes = await ApiClient.get<ClientWorkspace[]>('/organizations');
          if (orgsRes.data) {
            setAvailableClients(orgsRes.data);
            if (orgsRes.data.length > 0 && !activeClient) {
              setActiveClient(orgsRes.data[0]);
            }
          }
        } else {
          // Client user belongs directly to their organization
          const currentClient: ClientWorkspace = {
            id: res.data.organizationId,
            name: res.data.organizationName,
            slug: res.data.organizationName.toLowerCase().replace(/\s+/g, '-'),
          };
          setActiveClient(currentClient);
          setAvailableClients([currentClient]);
        }
      }
    } catch (err) {
      console.error('Failed to load user session', err);
      ApiClient.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const login = (token: string, userData: User, refreshToken?: string) => {
    ApiClient.setToken(token, refreshToken);
    setUser(userData);
    if (userData.organizationType === 'CLIENT') {
      const client: ClientWorkspace = {
        id: userData.organizationId,
        name: userData.organizationName,
        slug: userData.organizationName.toLowerCase().replace(/\s+/g, '-'),
      };
      setActiveClient(client);
      setAvailableClients([client]);
    }
    fetchUserData();
  };

  const logout = () => {
    ApiClient.clearTokens();
    setUser(null);
    setActiveClient(null);
    setAvailableClients([]);
    window.location.href = '/login';
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return user.permissions?.includes(permission) ?? false;
  };

  const isAgencyUser = user?.organizationType === 'AGENCY';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        activeClient,
        availableClients,
        setActiveClient,
        login,
        logout,
        hasPermission,
        isAgencyUser,
        isSuperAdmin,
        refreshUserData: fetchUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
