"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    minLength?: number;
    name?: string;
    autoComplete?: string;
    id?: string;
    /** Show the leading lock icon (matches the auth forms). */
    withLockIcon?: boolean;
    className?: string;
}

/**
 * Password input with a show/hide toggle (eye icon). Reused across register, login,
 * and the change-password form so the toggle behaves identically everywhere. The
 * caller supplies the input className — leave room on the right (pr-10) for the eye
 * button.
 */
export function PasswordInput({
    value,
    onChange,
    placeholder,
    required,
    minLength,
    name,
    autoComplete,
    id,
    withLockIcon = false,
    className = "",
}: PasswordInputProps) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            {withLockIcon && (
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                </div>
            )}
            <input
                type={show ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                minLength={minLength}
                name={name}
                autoComplete={autoComplete}
                id={id}
                className={className}
            />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                title={show ? "Sembunyikan password" : "Tampilkan password"}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-brand-primary transition-colors"
            >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
        </div>
    );
}
