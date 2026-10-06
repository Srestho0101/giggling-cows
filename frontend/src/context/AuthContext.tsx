"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { CurrentUser, UserRole } from "@/types/models";

interface AuthContextType {
  user: CurrentUser;
  role: UserRole;
  switchRole: (newRole: UserRole) => void;
  getAuthHeaders: () => Record<string, string>;
}

const defaultUser: CurrentUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@cowfarm.local",
  role: "admin",
  permissions: {
    can_manage_users: true,
    can_view_financial_reports: true,
    can_record_payments: true,
    can_edit_operational_data: true,
  },
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  role: "admin",
  switchRole: () => {},
  getAuthHeaders: () => ({ Authorization: "Bearer dev-user:admin" }),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<UserRole>("admin");
  const [user, setUser] = useState<CurrentUser>(defaultUser);

  useEffect(() => {
    const savedRole = localStorage.getItem("cowfarm_role") as UserRole;
    if (savedRole && ["admin", "manager", "data_entry"].includes(savedRole)) {
      setRole(savedRole);
      updateUserWithRole(savedRole);
    }
  }, []);

  const updateUserWithRole = (r: UserRole) => {
    setUser({
      id: "00000000-0000-0000-0000-000000000001",
      email: `${r}@cowfarm.local`,
      role: r,
      permissions: {
        can_manage_users: r === "admin",
        can_view_financial_reports: r === "admin" || r === "manager",
        can_record_payments: r === "admin" || r === "manager",
        can_edit_operational_data: true,
      },
    });
  };

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem("cowfarm_role", newRole);
    updateUserWithRole(newRole);
  };

  const getAuthHeaders = (): Record<string, string> => {
    return {
      Authorization: `Bearer dev-user:${role}`,
    };
  };

  return (
    <AuthContext.Provider value={{ user, role, switchRole, getAuthHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
